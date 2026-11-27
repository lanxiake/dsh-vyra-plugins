import { hostReact } from './react.js'
import { state, notify, toast, useStore } from './state.js'
import { api, url } from './api.js'
import { loadXterm } from './xterm-loader.js'
import { termTheme } from './theme.js'
import { suggest } from './commands.js'
import { popupPosition } from './popup-pos.js'

let es = null;
let seq = 0;
export const byTerm = /* @__PURE__ */ new Map();
export const orphans = /* @__PURE__ */ new Map();
export const toBase64 = (text) => {
  let bin = "";
  new TextEncoder().encode(text).forEach((c) => bin += String.fromCharCode(c));
  return btoa(bin);
};
export function deliver(s, m) {
  if (m.closed) {
    s.status = "closed";
    s.sugg = [];
    notify();
    return;
  }
  if (!m.d) return;
  const buf = Uint8Array.from(atob(m.d), (c) => c.charCodeAt(0));
  const end = m.o + buf.length;
  if (end <= s.received) return;
  s.term.write(m.o < s.received ? buf.subarray(s.received - m.o) : buf);
  s.received = end;
  if (state.active !== s.id && !s.unread) {
    s.unread = true;
    notify();
  }
}
export function ensureEvents() {
  if (es) return;
  es = new EventSource(url("terminal/events"));
  es.onmessage = (ev) => {
    let m;
    try {
      m = JSON.parse(ev.data);
    } catch {
      return;
    }
    const s = byTerm.get(m.id);
    if (s) return deliver(s, m);
    const q = orphans.get(m.id) ?? [];
    if (q.length < 500) q.push(m);
    orphans.set(m.id, q);
  };
}
export const altScreen = (s) => s.term?.buffer?.active?.type === "alternate";
export function refreshSuggestions(s) {
  const on = state.hintsOn && s.lineOk && s.status === "ready" && !altScreen(s);
  s.sugg = on && s.line ? suggest(s.line, s.history, 6) : [];
  s.suggIndex = 0;
  notify();
}
export function trackInput(s, data) {
  if (data === "\r") {
    const cmd = s.line.trim();
    if (cmd && s.lineOk) {
      s.history = [...s.history.filter((c) => c !== cmd), cmd].slice(-300);
      api("history", { connection: s.connId, command: cmd }).catch(() => {
      });
    }
    s.line = "";
    s.lineOk = true;
  } else if (data === "\x7F") {
    s.line = s.line.slice(0, -1);
  } else if (data === "" || data === "" || data === "") {
    s.line = "";
    s.lineOk = true;
  } else if (/^[\x20-\x7e\u00a0-\uffff]+$/.test(data)) {
    s.line += data;
  } else {
    s.lineOk = false;
    s.line = "";
  }
  refreshSuggestions(s);
}
export function sendInput(s, data) {
  if (s.status !== "ready") return;
  s.pending += data;
  if (s.flushing) return;
  s.flushing = true;
  setTimeout(() => {
    const chunk = s.pending;
    s.pending = "";
    s.flushing = false;
    s.chain = s.chain.then(() => api("terminal/input", { id: s.termId, data: toBase64(chunk) })).catch((e) => {
      if (e.code === "terminal_gone") {
        s.status = "closed";
        notify();
      }
    });
  }, 0);
}
export function acceptSuggestion(s, i = s.suggIndex) {
  const pick = s.sugg[i];
  if (!pick) return;
  sendInput(s, pick.cmd.startsWith(s.line) ? pick.cmd.slice(s.line.length) : "" + pick.cmd);
  s.line = pick.cmd;
  s.sugg = [];
  notify();
}
export function makeTerminal(s) {
  const Terminal = window.Terminal?.Terminal ?? window.Terminal;
  const Fit = window.FitAddon?.FitAddon ?? window.FitAddon;
  const Search = window.SearchAddon?.SearchAddon ?? window.SearchAddon;
  const term = new Terminal({
    cursorBlink: true,
    fontSize: 14,
    fontFamily: "JetBrains Mono, Cascadia Mono, Consolas, Menlo, monospace",
    scrollback: 5e3,
    theme: termTheme(),
    allowProposedApi: true
  });
  s.fit = new Fit();
  s.search = new Search();
  term.loadAddon(s.fit);
  term.loadAddon(s.search);
  term.onData((d) => {
    sendInput(s, d);
    trackInput(s, d);
  });
  let t;
  term.onResize(({ cols, rows }) => {
    clearTimeout(t);
    t = setTimeout(() => s.termId && api("terminal/resize", { id: s.termId, cols, rows }).catch(() => {
    }), 120);
  });
  term.onSelectionChange(() => {
    if (term.hasSelection()) navigator.clipboard?.writeText(term.getSelection()).catch(() => {
    });
  });
  term.attachCustomKeyEventHandler((e) => {
    if (e.type !== "keydown") return true;
    const own = () => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };
    if (s.sugg.length) {
      if (e.key === "Tab" && !e.shiftKey) return acceptSuggestion(s), own();
      if (e.key === "Escape") return s.sugg = [], notify(), own();
      if (s.sugg.length > 1 && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        const n = s.sugg.length;
        s.suggIndex = (s.suggIndex + (e.key === "ArrowDown" ? 1 : n - 1)) % n;
        notify();
        return own();
      }
    }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "f") {
      state.searchOpen = true;
      notify();
      return own();
    }
    return true;
  });
  return term;
}
export function scheduleFit(s) {
  cancelAnimationFrame(s.raf);
  s.raf = requestAnimationFrame(() => {
    if (!s.el.isConnected || !s.el.offsetWidth || !s.el.offsetHeight) return;
    try {
      s.fit.fit();
    } catch {
    }
    if (!s.started) {
      s.started = true;
      connectSession(s);
    }
  });
}
export function attach(s, container) {
  if (!container) return;
  if (s.el.parentNode !== container) container.appendChild(s.el);
  if (!s.opened) {
    s.opened = true;
    s.term.open(s.elInner || s.el);
    s.ro = new ResizeObserver(() => scheduleFit(s));
  }
  if (s.container !== container) {
    s.container = container;
    s.ro.disconnect();
    s.ro.observe(container);
  }
  scheduleFit(s);
}
export function focusSession(s) {
  requestAnimationFrame(() => s.term.focus());
}
export async function connectSession(s, creds = {}) {
  s.status = "connecting";
  s.error = "";
  s.sugg = [];
  notify();
  ensureEvents();
  try {
    const { id } = await api("terminal/open", {
      connection: s.connId,
      cols: s.term.cols,
      rows: s.term.rows,
      secret: creds.secret,
      remember: creds.remember
    });
    s.termId = id;
    s.received = 0;
    s.line = "";
    s.lineOk = true;
    byTerm.set(id, s);
    s.status = "ready";
    for (const m of orphans.get(id) ?? []) deliver(s, m);
    orphans.delete(id);
    // 连上就自动打开资源监控——只对当前这个标签生效（后台附加的会话不会偷偷开始采样），
    // 与 liteshell 一致。用户在这一次会话里手动关掉之后就不再擅自打开了。
    if (state.active === s.id && !state.monitorDismissed) state.drawer = "monitor";
    notify();
    if (state.active === s.id) focusSession(s);
  } catch (e) {
    if (e.code === "needs_secret" || e.code === "auth_failed") {
      const conn = state.tree.connections.find((c) => c.id === s.connId);
      const got = await askSecret(conn, e.message);
      if (got?.secret) return connectSession(s, got);
      s.error = "\u5DF2\u53D6\u6D88\u8F93\u5165";
    } else {
      s.error = e.message;
    }
    s.status = "error";
    notify();
  }
}
export async function openSession(conn) {
  try {
    await loadXterm();
  } catch (e) {
    toast(e.message, "error");
    return;
  }
  const s = {
    id: "s" + ++seq,
    connId: conn.id,
    name: conn.name,
    status: "connecting",
    error: "",
    received: 0,
    termId: null,
    pending: "",
    flushing: false,
    chain: Promise.resolve(),
    line: "",
    lineOk: true,
    sugg: [],
    suggIndex: 0,
    history: [],
    unread: false,
    opened: false,
    started: false,
    el: document.createElement("div")
  };
  s.el.className = "sx-termel";
  // xterm 会把 `.xterm` 类加到 term.open() 的那个元素上，而 xterm.css 里
  // `.xterm { background-color: #000 }` 是硬编码的黑色。若直接 open(s.el)，
  // 这个黑底就盖在容器上——浅色主题里看就是一大块黑（连带着看起来像"粗分割线"）。
  // 所以给 xterm 一个内层宿主，黑底只困在里面，外层 sx-termel 保持面板底色。
  s.elInner = document.createElement("div");
  s.elInner.className = "sx-termhost";
  s.el.appendChild(s.elInner);
  s.term = makeTerminal(s);
  s.refCb = (el) => attach(s, el);
  state.sessions.push(s);
  state.active = s.id;
  state.searchOpen = false;
  notify();
  api("history", void 0, { connection: conn.id }).then((r) => s.history = r.commands || []).catch(() => {
  });
}
export function reconnect(s) {
  if (s.termId) {
    byTerm.delete(s.termId);
    api("terminal/close", { id: s.termId }).catch(() => {
    });
    s.termId = null;
  }
  s.term.write("\r\n\x1B[33m[\u91CD\u65B0\u8FDE\u63A5\u2026]\x1B[0m\r\n");
  return connectSession(s);
}
export function activate(s) {
  state.active = s.id;
  s.unread = false;
  state.searchOpen = false;
  notify();
  focusSession(s);
}
export function dispose(s) {
  cancelAnimationFrame(s.raf);
  s.ro?.disconnect();
  try {
    s.term.dispose();
  } catch {
  }
  s.el.remove();
}
export function closeSession(s) {
  if (s.termId) {
    byTerm.delete(s.termId);
    api("terminal/close", { id: s.termId }).catch(() => {
    });
  }
  dispose(s);
  const i = state.sessions.indexOf(s);
  state.sessions.splice(i, 1);
  if (state.active === s.id) state.active = (state.sessions[i] || state.sessions[i - 1])?.id ?? null;
  if (!state.sessions.length) {
    state.drawer = null;
    state.searchOpen = false;
  }
  notify();
}
export function disposeAll() {
  for (const s of state.sessions) dispose(s);
  state.sessions.length = 0;
  byTerm.clear();
  orphans.clear();
  es?.close();
  es = null;
}
export const activeSession = () => state.sessions.find((s) => s.id === state.active) || null;

/**
 * 切换标签：`step` 为 +1/-1，或者直接给目标下标。
 *
 * 循环而不是在两端停住：只有两个标签时停在边界会让 Ctrl+Tab 有一半时间没反应，
 * 用户会以为键没生效。
 */
export function cycleTab(step) {
  const list = state.sessions;
  if (!list.length) return null;
  const at = list.findIndex((s) => s.id === state.active);
  const base = at < 0 ? 0 : at;
  const next = ((base + step) % list.length + list.length) % list.length;
  const target = list[next];
  if (target) activate(target);
  return target;
}
export function applyTheme() {
  const theme = termTheme();
  for (const s of state.sessions) s.term.options.theme = theme;
}
export async function reloadTree() {
  try {
    state.tree = await api("tree");
    state.loaded = true;
  } catch (e) {
    toast("\u52A0\u8F7D\u8FDE\u63A5\u5931\u8D25:" + e.message, "error");
  }
  notify();
}
