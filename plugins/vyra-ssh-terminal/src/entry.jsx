import { hostReact, setReact } from './react.js'
import { h, Fragment } from './jsx-shim.js'
import {
  state, useStore, notify, toast, setCollapsed, setExpanded, setHintsOn,
  openDialog, closeDialog, confirmBox, promptText, askSecret, editConnection,
  importConnections, secretDialog, fileDialog, infoDialog, resultDialog,
  filterConnections,
} from './state.js'
import { api, upload, download, url } from './api.js'
import { loadXterm } from './xterm-loader.js'
import { termTheme, watchTheme } from './theme.js'
import { suggest } from './commands.js'
import {
  activeSession, acceptSuggestion, activate, attach, closeSession, connectSession,
  dispose, disposeAll, focusSession, makeTerminal, openSession, reconnect,
  refreshSuggestions, reloadTree, scheduleFit, sendInput, trackInput, applyTheme,
} from './sessions.js'
import { bytes, level, rate, uptime } from './fmt.js'
import { popupPosition } from './popup-pos.js'
import { MonitorDrawer } from './monitor-panel.jsx'
import { AiPanel } from './ai-panel.jsx'
import { searchPalette } from './palette.js'
import {
  CommandPalette, LogPanel, HistoryPanel, ShortcutsPanel,
  paletteOpen, logOpen, setPaletteOpen, setLogOpen, setHistoryOpen, pushLog, installShortcuts,
} from './overlays.js'
import { EditorPanel, openEditor, editorState } from './editor.js'
import { canEdit } from './edit-gate.js'
import {
  transfers, transferPct, startTransfer, progressTransfer, finishTransfer, clearFinished, formatBytes, onTransferChange,
} from './transfer.js'
import styles from './style.css'

var fail = (e) => toast(e instanceof Error ? e.message : String(e), "error");
var pct = (a, b) => b > 0 ? Math.min(100, Math.round(a / b * 100)) : 0;
var show = (c) => `${c.username || ""}@${c.host || ""}${c.port && c.port !== 22 ? ":" + c.port : ""}`;
function copyText(text, what) {
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  else fallbackCopy(text);
  toast(`\u5DF2\u590D\u5236 ${what}`, "success");
}
function fallbackCopy(text) {
  const t = document.createElement("textarea");
  t.value = text;
  document.body.appendChild(t);
  t.select();
  document.execCommand("copy");
  document.body.removeChild(t);
}
function pickFile(accept) {
  return new Promise((resolve) => {
    const i = document.createElement("input");
    i.type = "file";
    if (accept) i.accept = accept;
    i.onchange = () => resolve(i.files?.[0] || null);
    i.click();
  });
}
var expandPath = (p) => p.replace(/^~(?=[\\/]|$)/, "%USERPROFILE%");
var importReport = (r) => [
  r.imported ? `\u65B0\u589E\u8FDE\u63A5 ${r.imported} \u4E2A` : "",
  r.folders ? `\u65B0\u589E\u6587\u4EF6\u5939 ${r.folders} \u4E2A` : "",
  r.skipped ? `\u8DF3\u8FC7\u91CD\u540D ${r.skipped} \u4E2A` : "",
  r.missingKeys ? `\u6709 ${r.missingKeys} \u4E2A\u8FDE\u63A5\u7684\u79C1\u94A5\u6CA1\u627E\u5230,\u9700\u8981\u91CD\u65B0\u6307\u5B9A` : "",
  r.needsPassword ? `\u6709 ${r.needsPassword} \u4E2A\u8FDE\u63A5\u7684\u5BC6\u7801\u9700\u8981\u91CD\u65B0\u8F93\u5165` : "",
  ...(r.warnings || []).map((w) => `\u26A0 ${w}`)
].filter(Boolean);
function toggleSidebar() {
  setCollapsed(!state.collapsed);
  requestAnimationFrame(() => activeSession()?.fit?.fit());
}
/**
 * 连接栏折叠图标：一条竖线 + 一个指向内侧的箭头（VS Code / LiteShell 同款语义）。
 *
 * 早先用的是 ◀ ▶ 三角字符：字重随字体变化、基线不齐，和旁边 11px 的按钮放一起
 * 像两个时代的产物。改成 14px 细描边 SVG，颜色跟随 currentColor。
 */
function CollapseIcon(pointRight) {
  return h(
    "svg",
    {
      width: 14,
      height: 14,
      viewBox: "0 0 16 16",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.4,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": true
    },
    h("rect", { x: 1.5, y: 2.5, width: 13, height: 11, rx: 2 }),
    h("path", { d: "M6 2.5v11" }),
    h("path", { d: pointRight ? "M9 6l2 2-2 2" : "M11 6L9 8l2 2" })
  );
}
function ConnectionTree() {
  const st = useStore();
  const [drag, setDrag] = globalThis.__dshSshTerminalReact.useState(null);
  const [dropId, setDropId] = globalThis.__dshSshTerminalReact.useState(void 0);
  const hits = filterConnections(st.tree.connections, st.query);
  const open = (c) => {
    const s = st.sessions.find((x) => x.connId === c.id && x.status !== "closed" && x.status !== "error");
    if (s) return activate(s);
    openSession(c);
  };
  const menu = (e, kind, id) => {
    e.preventDefault();
    e.stopPropagation();
    state.menu = { x: e.clientX, y: e.clientY, kind, id };
    state.menuQuery = "";
    notify();
  };
  const endDrag = () => (setDrag(null), setDropId(void 0));
  const over = (e, target) => {
    if (!drag) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDropId(target ? target.id : null);
  };
  const dropOn = async (e, target) => {
    e.preventDefault();
    e.stopPropagation();
    const item = drag;
    endDrag();
    if (!item) return;
    const to = target ? target.id : null;
    if ((item.parent ?? null) === to) return;
    try {
      await api("move", { id: item.id, folderId: to });
      if (to) setExpanded(to, true);
      await reloadTree();
    } catch (err) {
      fail(err);
    }
  };
  const renderConn = (c, depth) => {
    const s = st.sessions.find((x) => x.connId === c.id);
    const dot = !s ? "" : s.status === "ready" ? "ok" : s.status === "connecting" ? "warn" : "err";
    return h(
      "div",
      {
        key: c.id,
        className: `sx-row ${st.selected === c.id ? "sel" : ""}`,
        style: { paddingLeft: `${depth * 14 + 22}px` },
        draggable: true,
        title: `${c.name}
${show(c)}`,
        onDragStart: (e) => (e.dataTransfer.effectAllowed = "move", setDrag({ id: c.id, parent: c.folderId })),
        onDragEnd: endDrag,
        onClick: () => (state.selected = c.id, notify()),
        onDoubleClick: () => open(c),
        onContextMenu: (e) => menu(e, "conn", c.id)
      },
      h("span", { className: `sx-dot ${dot}` }),
      h("span", { className: "sx-row-name" }, c.name),
      h("span", { className: "sx-row-sub" }, show(c))
    );
  };
  const renderFolder = (f, depth) => {
    const isOpen = st.expanded.has(f.id);
    const kids = st.tree.connections.filter((c) => c.folderId === f.id);
    const subs2 = st.tree.folders.filter((x) => x.parentId === f.id);
    return h(
      Fragment,
      { key: f.id },
      h(
        "div",
        {
          className: `sx-row folder ${st.selected === f.id ? "sel" : ""} ${dropId === f.id ? "drop" : ""}`,
          style: { paddingLeft: `${depth * 14 + 10}px` },
          draggable: true,
          onDragStart: (e) => (e.dataTransfer.effectAllowed = "move", setDrag({ id: f.id, parent: f.parentId })),
          onDragEnd: endDrag,
          onDragOver: (e) => over(e, f),
          onDrop: (e) => dropOn(e, f),
          onClick: () => (state.selected = f.id, setExpanded(f.id, !isOpen)),
          onContextMenu: (e) => menu(e, "folder", f.id)
        },
        h("span", { className: "sx-chev" }, isOpen ? "\u25BC" : "\u25B6"),
        h("span", { className: "sx-row-name" }, f.name),
        h("span", { className: "sx-count" }, `${kids.length}`)
      ),
      isOpen && subs2.map((x) => renderFolder(x, depth + 1)),
      isOpen && kids.map((c) => renderConn(c, depth + 1))
    );
  };
  const topFolders = st.tree.folders.filter((f) => !f.parentId);
  const topConns = st.tree.connections.filter((c) => !c.folderId);
  if (st.collapsed)
    return h(
      "div",
      { className: "sx-side collapsed" },
      h("button", { className: "sx-collapse", title: "展开连接栏", "aria-label": "展开连接栏", onClick: toggleSidebar }, CollapseIcon(true))
    );
  return h(
    "div",
    { className: "sx-side" },
    h(
      "div",
      { className: "sx-side-head" },
      h(
        "div",
        { className: "sx-side-top" },
        h("input", {
          className: "sx-input",
          placeholder: "搜索名称 / 地址 / 用户…",
          value: st.query,
          onInput: (e) => (state.query = e.target.value, notify())
        }),
        h("button", { className: "sx-collapse", title: "收起连接栏", "aria-label": "收起连接栏", onClick: toggleSidebar }, CollapseIcon(false))
      ),
      h(
        "div",
        { className: "sx-side-btns" },
        h("button", { className: "sx-btn", onClick: async () => await editConnection(null, null) && reloadTree() }, "+ 新建"),
        h("button", { className: "sx-btn", onClick: async () => await importConnections() && reloadTree() }, "导入")
      )
    ),
    h(
      "div",
      {
        className: `sx-tree ${dropId === null ? "drop" : ""}`,
        onDragOver: (e) => over(e, null),
        onDrop: (e) => dropOn(e, null),
        onContextMenu: (e) => menu(e, "root", null)
      },
      !st.loaded ? h("div", { className: "sx-hint" }, "\u52A0\u8F7D\u4E2D\u2026") : st.tree.connections.length === 0 && st.tree.folders.length === 0 ? h("div", { className: "sx-hint" }, "\u8FD8\u6CA1\u6709\u8FDE\u63A5", h("br"), "\u70B9\u4E0A\u65B9\u201C\u65B0\u5EFA\u201D\u6216\u201C\u5BFC\u5165\u201D") : hits ? hits.length ? hits.map((c) => renderConn(c, 0)) : h("div", { className: "sx-hint" }, "\u6CA1\u6709\u5339\u914D\u7684\u8FDE\u63A5") : h(Fragment, null, topFolders.map((f) => renderFolder(f, 0)), topConns.map((c) => renderConn(c, 0)))
    )
  );
}
function TabBar() {
  const st = useStore();
  return h(
    "div",
    { className: "sx-tabs" },
    st.sessions.map(
      (s) => h(
        "div",
        { key: s.id, className: `sx-tab ${st.active === s.id ? "on" : ""}`, onClick: () => activate(s) },
        h("span", { className: `sx-dot ${s.status === "ready" ? "ok" : s.status === "connecting" ? "warn" : "err"}` }),
        h("span", { className: "sx-tab-name", title: s.name }, s.name),
        s.unread && h("span", { className: "sx-unread" }),
        h("span", { className: "sx-tab-x", onClick: (e) => (e.stopPropagation(), closeSession(s)) }, "\xD7")
      )
    )
  );
}
function Toolbar() {
  const st = useStore();
  const s = activeSession();
  const ok2 = s?.status === "ready";
  const drawer = (name) => (state.drawer = state.drawer === name ? null : name, notify());
  // 对齐 LiteShell：纯文字按钮（.sx-tbtn），分组之间用细竖线隔开。
  const btn = (label, opts = {}) =>
    h(
      "button",
      {
        className: `sx-tbtn ${opts.on ? "on" : ""}`,
        disabled: opts.disabled,
        title: opts.title,
        onClick: opts.onClick
      },
      label
    );
  return h(
    "div",
    { className: "sx-toolbar" },
    btn("文件", { on: st.drawer === "files", disabled: !ok2, title: "文件面板（Ctrl+Shift+B）", onClick: () => drawer("files") }),
    btn("监控", { on: st.drawer === "monitor", disabled: !ok2, title: "资源监控（Ctrl+Shift+M）", onClick: () => drawer("monitor") }),
    btn("AI", { on: st.aiOpen, disabled: !ok2, title: "AI 助手（Ctrl+Shift+A，默认用 DSH 里配好的模型）", onClick: () => (state.aiOpen = !st.aiOpen, notify()) }),
    h("span", { className: "sx-tbtn-sep" }),
    btn("历史", { disabled: !ok2, title: "命令历史（Ctrl+Shift+H）", onClick: () => setHistoryOpen(true) }),
    btn("查找", { on: st.searchOpen, disabled: !ok2, title: "终端内查找（Ctrl+Shift+F）", onClick: () => (state.searchOpen = !st.searchOpen, notify()) }),
    btn("日志", { on: logOpen(), title: "日志（Ctrl+Shift+L）", onClick: () => setLogOpen(!logOpen()) }),
    h("span", { className: "sx-tbtn-sep" }),
    btn("清屏", { disabled: !s, title: "清屏（Ctrl+Shift+K）", onClick: () => s.term.clear() }),
    btn("命令提示", { on: st.hintsOn, title: "输入时显示命令提示", onClick: () => setHintsOn(!st.hintsOn) }),
    btn("断开", { disabled: !s, title: "关闭当前标签（Ctrl+Shift+W）", onClick: () => closeSession(s) }),
    s && h("span", { className: "sx-tb-status" }, s.status === "ready" ? show(st.tree.connections.find((c) => c.id === s.connId) || {}) : "")
  );
}
function SearchBar() {
  const [q, setQ] = globalThis.__dshSshTerminalReact.useState("");
  const s = activeSession();
  const find = (dir) => q && s?.search && (dir > 0 ? s.search.findNext(q) : s.search.findPrevious(q));
  const close = () => {
    state.searchOpen = false;
    s?.search?.clearDecorations?.();
    notify();
    s && s.term.focus();
  };
  return h(
    "div",
    { className: "sx-searchbar" },
    h("input", {
      className: "sx-input",
      placeholder: "\u67E5\u627E\u2026",
      value: q,
      autoFocus: true,
      onInput: (e) => setQ(e.target.value),
      onKeyDown: (e) => {
        if (e.key === "Enter") find(e.shiftKey ? -1 : 1);
        else if (e.key === "Escape") close();
      }
    }),
    h("button", { className: "sx-btn sm", onClick: () => find(-1) }, "\u2191"),
    h("button", { className: "sx-btn sm", onClick: () => find(1) }, "\u2193"),
    h("button", { className: "sx-btn sm", onClick: close }, "\xD7")
  );
}
function SuggestPopup({ s }) {
  const ref = globalThis.__dshSshTerminalReact.useRef(null);
  const [pos, setPos] = globalThis.__dshSshTerminalReact.useState(null);
  const useLayout = globalThis.__dshSshTerminalReact.useLayoutEffect || globalThis.__dshSshTerminalReact.useEffect;
  useLayout(() => {
    const el = ref.current;
    const box = el?.parentElement;
    if (!el || !box) return;
    const dim = s.term?._core?._renderService?.dimensions;
    const cw = dim?.css?.cell?.width || dim?.actualCellWidth || 8;
    const ch = dim?.css?.cell?.height || dim?.actualCellHeight || 16;
    const buf = s.term?.buffer?.active;
    const next = popupPosition({
      x: 10 + (buf?.cursorX ?? 0) * cw,
      y: 6 + ((buf?.cursorY ?? 0) + 1) * ch,
      width: el.offsetWidth,
      height: el.offsetHeight,
      viewWidth: box.clientWidth,
      viewHeight: box.clientHeight
    });
    setPos((p) => p && p.left === next.left && p.top === next.top ? p : next);
  });
  return h(
    "div",
    { ref, className: "sx-suggest", style: pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: "hidden" } },
    s.sugg.map(
      (g, i) => h(
        "div",
        {
          key: g.cmd,
          className: `sx-sug ${i === s.suggIndex ? "on" : ""}`,
          onMouseDown: (e) => (e.preventDefault(), acceptSuggestion(s, i))
        },
        h("span", { className: "sx-sug-cmd" }, g.cmd),
        g.hint && h("span", { className: "sx-sug-hint" }, g.hint)
      )
    ),
    h("div", { className: "sx-sug-foot" }, "Tab \u8865\u5168 \xB7 \u2191\u2193 \u9009\u62E9 \xB7 Esc \u5173\u95ED")
  );
}

function TerminalArea() {
  const st = useStore();
  const s = activeSession();
  return h(
    "div",
    { className: "sx-termwrap" },
    // 每个会话的容器始终存�?连接要等容器量出尺寸后才发起
    st.sessions.map(
      (x) => h(
        "div",
        { key: x.id, className: `sx-view ${st.active === x.id ? "active" : ""}` },
        h("div", { className: "sx-host", ref: x.refCb }),
        x.status === "connecting" && h("div", { className: "sx-msg" }, `\u6B63\u5728\u8FDE\u63A5 ${x.name}\u2026`),
        x.status === "error" && h(
          "div",
          { className: "sx-msg err" },
          h("div", null, x.error || "\u8FDE\u63A5\u5931\u8D25"),
          h("button", { className: "sx-btn", onClick: () => reconnect(x) }, "\u91CD\u65B0\u8FDE\u63A5")
        ),
        x.status === "closed" && h(
          "div",
          { className: "sx-closed" },
          h("span", null, "\u8FDE\u63A5\u5DF2\u65AD\u5F00"),
          h("button", { className: "sx-btn sm", onClick: () => reconnect(x) }, "\u91CD\u65B0\u8FDE\u63A5")
        )
      )
    ),
    !s && h("div", { className: "sx-empty" }, "\u53CC\u51FB\u5DE6\u4FA7\u7684\u8FDE\u63A5\u6253\u5F00\u7EC8\u7AEF"),
    st.searchOpen && s && h(SearchBar),
    s && st.hintsOn && s.sugg.length > 0 && h(SuggestPopup, { s })
  );
}
function FileDrawer() {
  const s = activeSession();
  const [dir, setDir] = globalThis.__dshSshTerminalReact.useState({ path: "", entries: [] });
  const [busy, setBusy] = globalThis.__dshSshTerminalReact.useState(false);
  const [over, setOver] = globalThis.__dshSshTerminalReact.useState(false);
  const cid = s?.connId;
  const load2 = async (path) => {
    if (!cid) return;
    setBusy(true);
    try {
      setDir(await api("files/list", void 0, { connection: cid, path }));
    } catch (e) {
      fail(e);
    }
    setBusy(false);
  };
  globalThis.__dshSshTerminalReact.useEffect(() => {
    load2(".");
  }, [cid]);
  const join = (name) => dir.path === "/" ? "/" + name : dir.path + "/" + name;
  const up = () => load2(dir.path.replace(/\/[^/]*$/, "") || "/");
  const send = async (files) => {
    for (const f of files) {
      const remote = join(f.name);
      const track = startTransfer({ name: f.name, direction: "up", size: f.size, from: f.name, to: remote });
      try {
        await upload({ connection: cid, path: remote }, f, (p) => progressTransfer(track, p.loaded));
        finishTransfer(track);
        toast(`\u5DF2\u4E0A\u4F20 ${f.name}`, "success");
      } catch (e) {
        finishTransfer(track, e);
        fail(e);
      }
    }
    load2(dir.path);
  };
  const pull = async (name) => {
    const remote = join(name);
    const track = startTransfer({ name, direction: "down", size: 0, from: remote, to: name });
    try {
      await download({ connection: cid, path: remote }, (p) => progressTransfer(track, p.loaded));
      finishTransfer(track);
      toast(`\u5DF2\u4E0B\u8F7D ${name}`, "success");
    } catch (e) {
      finishTransfer(track, e);
      fail(e);
    }
  };
  const act = async (fn) => {
    try {
      await fn();
      await load2(dir.path);
    } catch (e) {
      fail(e);
    }
  };
  return h(
    "div",
    { className: "sx-drawer" },
    h(
      "div",
      { className: "sx-dhead" },
      h("span", { className: "sx-dtitle" }, "\u6587\u4EF6"),
      h("button", { className: "sx-btn sm", onClick: async () => {
        const name = await promptText("\u65B0\u5EFA\u6587\u4EF6\u5939");
        name && act(() => api("files/mkdir", { connection: cid, path: join(name) }));
      } }, "\u65B0\u5EFA\u6587\u4EF6\u5939"),
      h("button", { className: "sx-btn sm", onClick: () => {
        const i = document.createElement("input");
        i.type = "file";
        i.multiple = true;
        i.onchange = () => send([...i.files]);
        i.click();
      } }, "\u4E0A\u4F20"),
      h("button", { className: "sx-btn sm", onClick: () => (state.drawer = null, notify()) }, "\xD7")
    ),
    h(
      "div",
      { className: "sx-path" },
      h("button", { className: "sx-btn sm", disabled: dir.path === "/" || !dir.path, onClick: up }, "\u2191"),
      h("span", { className: "sx-fname", title: dir.path, style: { alignSelf: "center" } }, dir.path || "\u2026"),
      h("button", { className: "sx-btn sm", onClick: () => load2(dir.path) }, "\u5237\u65B0")
    ),
    h(
      "div",
      {
        className: `sx-dbody ${over ? "sx-dropzone" : ""}`,
        onDragOver: (e) => (e.preventDefault(), setOver(true)),
        onDragLeave: () => setOver(false),
        onDrop: (e) => (e.preventDefault(), setOver(false), e.dataTransfer.files.length && send([...e.dataTransfer.files]))
      },
      busy && !dir.entries.length
        ? h("div", { className: "sx-hint" }, "加载中…")
        : !dir.entries.length
          ? h("div", { className: "sx-hint" }, "空目录（可拖文件到这里上传）")
          : dir.entries.map((f) =>
              h(
                "div",
                {
                  key: f.name,
                  className: `sx-frow ${f.isDir ? "dir" : ""}`,
                  // 单击目录进入；文件双击进编辑器（单击留给选中，免得误触）
                  onClick: f.isDir ? () => load2(join(f.name)) : void 0,
                  onDoubleClick: f.isDir
                    ? void 0
                    : () => {
                        const gate = canEdit({ name: f.name, size: f.size });
                        if (!gate.ok) return toast(gate.reason, "error");
                        void openEditor(cid, join(f.name));
                      }
                },
                h("span", null, f.isDir ? "📁" : "📄"),
                h("span", { className: "sx-fname", title: f.name }, f.name),
                h("span", { className: "sx-fmeta" }, f.isDir ? "" : bytes(f.size)),
                h(
                  "span",
                  { className: "sx-fact" },
                  !f.isDir && h("button", { className: "sx-btn sm", onClick: (e) => (e.stopPropagation(), void pull(f.name)) }, "下载"),
                  h("button", { className: "sx-btn sm", onClick: async (e) => {
                    e.stopPropagation();
                    // 八进制权限：和 ls -l / chmod 的写法一致，用户不用换算成 rwx。
                    const cur = typeof f.mode === "number" ? (f.mode & 0o7777).toString(8).padStart(3, "0") : "";
                    const text = await promptText("权限", cur || "644");
                    if (text === null || text === undefined) return;
                    if (!/^[0-7]{3,4}$/.test(text.trim())) return toast("权限要写成 644 这样的八进制", "error");
                    act(() => api("files/chmod", { connection: cid, path: join(f.name), mode: text.trim() }));
                  } }, "权限"),
                  h("button", { className: "sx-btn sm", onClick: async (e) => {
                    e.stopPropagation();
                    const to = await promptText("重命名", f.name);
                    to && to !== f.name && act(() => api("files/rename", { connection: cid, from: join(f.name), to: join(to) }));
                  } }, "改名"),
                  h("button", { className: "sx-btn sm dng", onClick: async (e) => {
                    e.stopPropagation();
                    const ok2 = await confirmBox(`删除“${f.name}”?`, f.isDir ? "目录里的全部内容都会被删除,无法恢复。" : "删除后无法恢复。", "删除");
                    ok2 && act(() => api("files/delete", { connection: cid, path: join(f.name), dir: f.isDir }));
                  } }, "删除")
                )
              )
            )
    ),
    // 传输条：对齐 LiteShell 的传输面板——进行中看百分比，结束看成功/失败，
    // 失败时把原因直接写在那一行上，而不是只闪一个 toast 就没了。
    h(TransferBar)
  );
}

/** 文件面板底部的传输台账。 */
function TransferBar() {
  const [, force] = globalThis.__dshSshTerminalReact.useState(0);
  globalThis.__dshSshTerminalReact.useEffect(() => {
    onTransferChange(() => force((n) => n + 1));
    const tick = setInterval(() => {
      if (transfers().some((t) => t.state === "running")) force((n) => n + 1);
    }, 500);
    return () => {
      clearInterval(tick);
      onTransferChange(null);
    };
  }, []);
  const list = transfers();
  if (!list.length) return null;
  return h(
    "div",
    { className: "sx-xfers" },
    h(
      "div",
      { className: "sx-xfers-head" },
      h("span", null, `传输（${list.filter((t) => t.state === "running").length} 进行中）`),
      h("button", { className: "sx-btn sm", onClick: () => clearFinished() }, "清除已结束")
    ),
    list.map((t) => {
      const pct = transferPct(t);
      const failed = t.state === "failed";
      const done = t.state === "done";
      return h(
        "div",
        { key: t.id, className: "sx-xfer", title: t.error ? `${t.from} → ${t.to}\n${t.error}` : `${t.from} → ${t.to}` },
        h(
          "div",
          { className: "sx-xfer-head" },
          h("span", { className: "sx-xfer-name" }, `${t.direction === "up" ? "↑" : "↓"} ${t.name}`),
          h("span", { className: `sx-xfer-pct ${failed ? "err" : done ? "ok" : ""}` }, failed ? "失败" : done ? "完成" : `${pct}%`)
        ),
        h("div", { className: "sx-bar sm" }, h("i", { className: failed ? "err" : done ? "ok" : "", style: { width: `${failed || done ? 100 : pct}%` } })),
        h("div", { className: "sx-xfer-sub" }, failed ? (t.error || "失败") : `${formatBytes(t.loaded)} / ${t.size ? formatBytes(t.size) : "?"}`)
      );
    })
  );
}
var Shell = ({ wide, onClose, children }) => h(
  "div",
  { className: "sx-overlay", onMouseDown: (e) => e.target === e.currentTarget && onClose() },
  h("div", { className: `sx-dialog ${wide ? "wide" : ""}` }, children)
);
function ConfirmDialog({ d }) {
  return h(
    Shell,
    { onClose: () => closeDialog(false) },
    h("div", { className: "sx-dmsg" }, d.message),
    d.detail && h("div", { className: "sx-ddetail" }, d.detail),
    h(
      "div",
      { className: "sx-dbtns" },
      h("button", { className: "sx-btn", onClick: () => closeDialog(false) }, "\u53D6\u6D88"),
      h("button", { className: "sx-btn dng", autoFocus: true, onClick: () => closeDialog(true) }, d.okText)
    )
  );
}
function PromptDialog({ d }) {
  const [v, setV] = globalThis.__dshSshTerminalReact.useState(d.value);
  const ok2 = () => v.trim() && closeDialog(v.trim());
  return h(
    Shell,
    { onClose: () => closeDialog(null) },
    h("div", { className: "sx-dtitle2" }, d.title),
    h("input", {
      className: "sx-input",
      value: v,
      placeholder: d.placeholder,
      autoFocus: true,
      onInput: (e) => setV(e.target.value),
      onKeyDown: (e) => e.key === "Enter" ? ok2() : e.key === "Escape" && closeDialog(null)
    }),
    h(
      "div",
      { className: "sx-dbtns" },
      h("button", { className: "sx-btn", onClick: () => closeDialog(null) }, "\u53D6\u6D88"),
      h("button", { className: "sx-btn pri", onClick: ok2 }, "\u786E\u5B9A")
    )
  );
}
function SecretDialog({ d }) {
  const [v, setV] = globalThis.__dshSshTerminalReact.useState("");
  const [keep, setKeep] = globalThis.__dshSshTerminalReact.useState(false);
  const what = d.conn?.authType === "key" ? "\u79C1\u94A5\u53E3\u4EE4" : "\u5BC6\u7801";
  const ok2 = () => v && closeDialog({ secret: v, remember: keep });
  return h(
    Shell,
    { onClose: () => closeDialog(null) },
    h("div", { className: "sx-dtitle2" }, `\u8FDE\u63A5 ${d.conn?.name || ""}`),
    h("div", { className: "sx-ddetail" }, d.message),
    h("input", {
      className: "sx-input",
      type: "password",
      value: v,
      placeholder: `\u8F93\u5165${what}`,
      autoFocus: true,
      onInput: (e) => setV(e.target.value),
      onKeyDown: (e) => e.key === "Enter" ? ok2() : e.key === "Escape" && closeDialog(null)
    }),
    h("label", { className: "sx-check" }, h("input", { type: "checkbox", checked: keep, onChange: (e) => setKeep(e.target.checked) }), `\u8FDE\u63A5\u6210\u529F\u540E\u4FDD\u5B58${what}(\u5B58\u5165 DSH \u51ED\u636E\u5E93,\u754C\u9762\u548C Agent \u90FD\u770B\u4E0D\u5230)`),
    h(
      "div",
      { className: "sx-dbtns" },
      h("button", { className: "sx-btn", onClick: () => closeDialog(null) }, "\u53D6\u6D88"),
      h("button", { className: "sx-btn pri", disabled: !v, onClick: ok2 }, "\u8FDE\u63A5")
    )
  );
}
function ConnectionDialog({ d }) {
  const c = d.conn;
  const [f, setF] = globalThis.__dshSshTerminalReact.useState({
    id: c?.id,
    name: c?.name || "",
    host: c?.host || "",
    port: c?.port || 22,
    username: c?.username || "",
    authType: c?.authType || "password",
    privateKeyPath: c?.privateKeyPath || "",
    folderId: c ? c.folderId : d.folderId || null,
    password: "",
    keyPassphrase: "",
    localIface: c?.localIface || "",
    localAddress: c?.localAddress || ""
  });
  const [ifaces, setIfaces] = globalThis.__dshSshTerminalReact.useState([]);
  globalThis.__dshSshTerminalReact.useEffect(() => {
    let stop = false;
    api("net/interfaces").then((r) => !stop && setIfaces(r.interfaces || [])).catch(() => {
    });
    return () => stop = true;
  }, []);
  const set = (k) => (e) => setF({ ...f, [k]: k === "port" ? Number(e.target.value) || 22 : e.target.value });
  const [busy, setBusy] = globalThis.__dshSshTerminalReact.useState(false);
  const save2 = async () => {
    if (!f.host.trim() || !f.username.trim()) return toast("\u4E3B\u673A\u548C\u7528\u6237\u540D\u4E0D\u80FD\u4E3A\u7A7A", "error");
    if (f.authType === "key" && !f.privateKeyPath.trim()) return toast("\u8BF7\u586B\u5199\u79C1\u94A5\u6587\u4EF6\u8DEF\u5F84", "error");
    setBusy(true);
    try {
      const { password, keyPassphrase, ...connection } = f;
      await api("upsert", { connection, password: password || void 0, keyPassphrase: keyPassphrase || void 0 });
      closeDialog(true);
    } catch (e) {
      fail(e);
      setBusy(false);
    }
  };
  const field = (label, node) => h("div", { className: "sx-field" }, h("label", null, label), node);
  const two = (a, b) => h("div", { className: "sx-two" }, field(a[0], a[1]), field(b[0], b[1]));
  return h(
    Shell,
    { onClose: () => closeDialog(false) },
    h("div", { className: "sx-dtitle2" }, c ? "\u7F16\u8F91\u8FDE\u63A5" : "\u65B0\u5EFA\u8FDE\u63A5"),
    h(
      "div",
      { className: "sx-form" },
      field("\u540D\u79F0(\u7559\u7A7A\u5219\u7528 \u7528\u6237@\u4E3B\u673A)", h("input", { className: "sx-input", value: f.name, onInput: set("name"), autoFocus: true })),
      field("\u4E3B\u673A", h("input", { className: "sx-input", value: f.host, onInput: set("host") })),
      two(
        ["\u7AEF\u53E3", h("input", { className: "sx-input", value: f.port, onInput: set("port") })],
        ["\u7528\u6237\u540D", h("input", { className: "sx-input", value: f.username, onInput: set("username") })]
      ),
      field("\u8BA4\u8BC1\u65B9\u5F0F", h(
        "select",
        { className: "sx-input", value: f.authType, onChange: set("authType") },
        h("option", { value: "password" }, "\u5BC6\u7801"),
        h("option", { value: "key" }, "\u79C1\u94A5\u6587\u4EF6"),
        h("option", { value: "agent" }, "SSH Agent")
      )),
      f.authType === "password" && field(
        c?.hasPassword ? "\u5BC6\u7801(\u5DF2\u4FDD\u5B58,\u7559\u7A7A\u5219\u4E0D\u6539)" : "\u5BC6\u7801(\u53EF\u7559\u7A7A,\u8FDE\u63A5\u65F6\u518D\u8F93\u5165)",
        h("input", { className: "sx-input", type: "password", value: f.password, onInput: set("password") })
      ),
      f.authType === "key" && field("\u79C1\u94A5\u6587\u4EF6\u8DEF\u5F84", h("input", { className: "sx-input", value: f.privateKeyPath, placeholder: "C:\\Users\你\\.ssh\\id_ed25519", onInput: set("privateKeyPath") })),
      f.authType === "key" && field(
        c?.hasKeyPassphrase ? "\u79C1\u94A5\u53E3\u4EE4(\u5DF2\u4FDD\u5B58,\u7559\u7A7A\u5219\u4E0D\u6539)" : "\u79C1\u94A5\u53E3\u4EE4(\u6CA1\u6709\u5C31\u7559\u7A7A)",
        h("input", { className: "sx-input", type: "password", value: f.keyPassphrase, onInput: set("keyPassphrase") })
      ),
      two(
        [
          "\u672C\u673A\u7F51\u5361(VPN \u6362\u5730\u5740\u540E\u81EA\u52A8\u8DDF)",
          h(
            "select",
            { className: "sx-input", value: f.localIface, onChange: (e) => setF({ ...f, localIface: e.target.value, localAddress: "" }) },
            h("option", { value: "" }, "\u4E0D\u6307\u5B9A"),
            ifaces.map((x, i) => h("option", { key: i, value: x.name }, `${x.name} (${x.address})`)),
            f.localIface && !ifaces.some((x) => x.name === f.localIface) && h("option", { value: f.localIface }, `${f.localIface}(\u5F53\u524D\u4E0D\u5728\u7EBF)`)
          )
        ],
        ["\u672C\u673A\u5730\u5740(\u56FA\u5B9A,\u53EF\u8986\u76D6)", h("input", { className: "sx-input", value: f.localAddress, placeholder: "\u7559\u7A7A\u81EA\u52A8", onInput: set("localAddress") })]
      )
    ),
    h(
      "div",
      { className: "sx-dbtns" },
      h("button", { className: "sx-btn", onClick: () => closeDialog(false) }, "\u53D6\u6D88"),
      h("button", { className: "sx-btn pri", disabled: busy, onClick: save2 }, "\u4FDD\u5B58")
    )
  );
}
function ImportDialog() {
  const [src, setSrc] = globalThis.__dshSshTerminalReact.useState("ssh-config");
  const [items, setItems] = globalThis.__dshSshTerminalReact.useState(null);
  const [sel, setSel] = globalThis.__dshSshTerminalReact.useState(/* @__PURE__ */ new Set());
  const [err, setErr] = globalThis.__dshSshTerminalReact.useState("");
  globalThis.__dshSshTerminalReact.useEffect(() => {
    let stop = false;
    setItems(null);
    setErr("");
    api("import/" + src).then((r) => !stop && (setItems(r), setSel(new Set(r.filter((x) => !x.exists).map((x) => x.name))))).catch((e) => !stop && (setErr(e.message), setItems([])));
    return () => stop = true;
  }, [src]);
  const fresh = (items || []).filter((x) => !x.exists);
  const toggle = (n) => setSel((p) => {
    const s = new Set(p);
    s.has(n) ? s.delete(n) : s.add(n);
    return s;
  });
  const go = async () => {
    try {
      const r = await api("import/" + src, { names: [...sel] });
      toast(`\u5DF2\u5BFC\u5165 ${r.imported} \u4E2A\u8FDE\u63A5`, "success");
      closeDialog(true);
    } catch (e) {
      fail(e);
    }
  };
  return h(
    Shell,
    { wide: true, onClose: () => closeDialog(false) },
    h("div", { className: "sx-dtitle2" }, "\u5BFC\u5165\u8FDE\u63A5"),
    h(
      "div",
      { className: "sx-imp-tabs" },
      h("button", { className: `sx-btn ${src === "ssh-config" ? "pri" : ""}`, onClick: () => setSrc("ssh-config") }, "~/.ssh/config"),
      h("button", { className: `sx-btn ${src === "liteshell" ? "pri" : ""}`, onClick: () => setSrc("liteshell") }, "LiteShell"),
      h("button", { className: "sx-btn", onClick: () => (closeDialog(false), importFromFile(null)) }, "\u5907\u4EFD / FinalShell \u6587\u4EF6\u2026")
    ),
    h("div", { className: "sx-ddetail" }, "~/.ssh/config \u548C LiteShell \u53EA\u5BFC\u5165\u540D\u79F0\u3001\u5730\u5740\u3001\u7528\u6237\u548C\u79C1\u94A5\u8DEF\u5F84,\u4E0D\u8BFB\u53D6\u4EFB\u4F55\u5BC6\u7801;\u9700\u8981\u5BC6\u7801\u7684\u8FDE\u63A5\u9996\u6B21\u6253\u5F00\u65F6\u4F1A\u8BE2\u95EE\u3002"),
    h(
      "div",
      { className: "sx-imp-list" },
      items === null ? h("div", { className: "sx-hint" }, "\u8BFB\u53D6\u4E2D\u2026") : err ? h("div", { className: "sx-hint" }, err) : !items.length ? h("div", { className: "sx-hint" }, "\u6CA1\u6709\u627E\u5230\u53EF\u5BFC\u5165\u7684\u8FDE\u63A5") : items.map((it, i) => h(
        "label",
        { key: i, className: `sx-imp-row ${it.exists ? "dup" : ""}` },
        h("input", { type: "checkbox", disabled: it.exists, checked: sel.has(it.name) && !it.exists, onChange: () => toggle(it.name) }),
        h("span", { className: "sx-fname" }, it.name),
        h("span", { className: "sx-fmeta" }, it.exists ? "\u5DF2\u5B58\u5728" : `${show(it)}${it.folder ? " \xB7 " + it.folder : ""}`)
      ))
    ),
    h(
      "div",
      { className: "sx-dbtns" },
      h("button", { className: "sx-btn", onClick: () => closeDialog(false) }, "\u53D6\u6D88"),
      h("button", { className: "sx-btn pri", disabled: !sel.size || !fresh.length, onClick: go }, `\u5BFC\u5165 ${[...sel].filter((n) => fresh.some((x) => x.name === n)).length} \u4E2A`)
    )
  );
}
function SecretInputDialog({ d }) {
  const [v, setV] = globalThis.__dshSshTerminalReact.useState("");
  const custom = typeof d.confirm === "function";
  const ok2 = () => {
    if (custom) {
      try {
        closeDialog(d.confirm(v));
      } catch (e) {
        fail(e);
      }
    } else closeDialog(v || null);
  };
  return h(
    Shell,
    { onClose: () => closeDialog(null) },
    h("div", { className: "sx-dtitle2" }, d.title),
    h("div", { className: "sx-ddetail" }, d.note),
    h("input", {
      className: "sx-input",
      type: "password",
      value: v,
      autoFocus: true,
      placeholder: custom ? "\u53E3\u4EE4(\u7559\u7A7A\u5219\u5BFC\u51FA\u65F6\u4E0D\u5E26\u5BC6\u7801)" : "\u53E3\u4EE4",
      onInput: (e) => setV(e.target.value),
      onKeyDown: (e) => e.key === "Enter" ? ok2() : e.key === "Escape" && closeDialog(null)
    }),
    h(
      "div",
      { className: "sx-dbtns" },
      h("button", { className: "sx-btn", onClick: () => closeDialog(null) }, "\u53D6\u6D88"),
      h("button", { className: "sx-btn pri", onClick: ok2 }, custom ? "\u5BFC\u51FA" : "\u786E\u5B9A")
    )
  );
}
function FileDialog({ d }) {
  const [v, setV] = globalThis.__dshSshTerminalReact.useState("");
  const pick = async () => {
    const f = await pickFile(".json,.txt");
    if (f) setV((cur) => cur || (f.path ? String(f.path) : f.name));
  };
  return h(
    Shell,
    { onClose: () => closeDialog(null) },
    h("div", { className: "sx-dtitle2" }, d.title),
    d.note && h("div", { className: "sx-ddetail" }, d.note),
    h(
      "div",
      { className: "sx-two" },
      h("input", {
        className: "sx-input",
        value: v,
        autoFocus: true,
        placeholder: d.placeholder,
        onInput: (e) => setV(e.target.value),
        onKeyDown: (e) => e.key === "Enter" ? v.trim() && closeDialog(v.trim()) : e.key === "Escape" && closeDialog(null)
      }),
      h("button", { className: "sx-btn", onClick: pick }, "\u9009\u62E9\u6587\u4EF6\u2026")
    ),
    h(
      "div",
      { className: "sx-dbtns" },
      h("button", { className: "sx-btn", onClick: () => closeDialog(null) }, "\u53D6\u6D88"),
      h("button", { className: "sx-btn pri", disabled: !v.trim(), onClick: () => closeDialog(v.trim()) }, "\u786E\u5B9A")
    )
  );
}
function InfoDialog({ d }) {
  // buttons 可以是自定义按钮表（[{label, primary}]），此时点哪个就把下标交回去——
  // 导出报告靠它区分「打开文件夹」和「知道了」。没有 buttons 就是普通的一个「好」。
  const buttons = Array.isArray(d.buttons) && d.buttons.length ? d.buttons : null;
  return h(
    Shell,
    { onClose: () => closeDialog(buttons ? -1 : true) },
    h("div", { className: "sx-dtitle2" }, d.title),
    d.note && h("div", { className: "sx-ddetail" }, d.note),
    d.lines?.length && h("div", { className: "sx-info" }, d.lines.map((l, i) => h("div", { key: i }, l))),
    h(
      "div",
      { className: "sx-dbtns" },
      buttons
        ? buttons.map((b, i) =>
            h(
              "button",
              { key: i, className: `sx-btn${b.primary ? " pri" : ""}`, autoFocus: i === 0, onClick: () => closeDialog(i) },
              b.label
            )
          )
        : h("button", { className: "sx-btn pri", autoFocus: true, onClick: () => closeDialog(true) }, "\u597D")
    )
  );
}
function ResultDialog({ d }) {
  const lines = importReport(d.result);
  return h(
    Shell,
    { onClose: () => closeDialog(true) },
    h("div", { className: "sx-dtitle2" }, d.title),
    lines.length ? h("div", { className: "sx-info" }, lines.map((l, i) => h("div", { key: i }, l))) : h("div", { className: "sx-ddetail" }, "\u6CA1\u6709\u65B0\u589E\u4EFB\u4F55\u8FDE\u63A5\u3002"),
    h("div", { className: "sx-dbtns" }, h("button", { className: "sx-btn pri", autoFocus: true, onClick: () => closeDialog(true) }, "\u597D"))
  );
}
function Dialogs() {
  const d = useStore().dialog;
  if (!d) return null;
  const P = {
    confirm: ConfirmDialog,
    prompt: PromptDialog,
    secret: SecretDialog,
    connection: ConnectionDialog,
    import: ImportDialog,
    "secret-input": SecretInputDialog,
    file: FileDialog,
    info: InfoDialog,
    result: ResultDialog
  }[d.type];
  return P ? h(P, { key: d.id, d }) : null;
}
/**
 * 导出连接。
 *
 * 早先这里用 window.open 挂一个下载链接，结果三件事同时不对：不带密码那条走的是
 * GET，而后端只收 POST，于是永远 405；带密码那条把结果丢进一个 _blank 标签页，
 * 落点是浏览器的默认下载目录，用户点完不知道文件去了哪里；两条路都拿不到文件名和
 * 规模，出没出文件全靠猜。
 *
 * 现在由 **Host 直接写盘**（`export/save`）：它把文件写到你指定的绝对目录（默认
 * 「下载」），并把落点回给界面，所以报告里能直接写出「保存位置：C:\\...\\x.json」，
 * 还能一键 `export/reveal` 在文件管理器里选中它——"东西放哪了"不再需要猜。
 */
async function exportDialog({ scope, id, name }) {
  let preview = null
  try {
    preview = await api('export/preview', undefined, { scope, ...(id ? { id } : {}) })
  } catch {
    // 预览拿不到不影响导出本身，报告里按实际返回的头来写
  }
  const lines = [
    preview ? `将导出 ${preview.connections} 条连接、${preview.folders} 个文件夹、${preview.keys} 个私钥` : '',
    preview?.passwords ? `其中 ${preview.passwords} 条连接带着已保存的密码` : '目前没有任何连接保存过密码'
  ].filter(Boolean)
  const passphrase = await secretDialog(
    `导出「${name}」`,
    `${lines.join('；')}。可以设一个口令把密码一起导出（私钥总是内联在文件里，不受口令影响）；留空则导出不含密码，交给对面重输。`,
    '导出'
  )
  if (passphrase === undefined || passphrase === null) return
  // 走 Host 落盘而不是浏览器下载：浏览器只会把文件塞进默认下载目录然后沉默，
  // 用户事后根本不知道它去了哪。Host 写盘能拿回绝对路径，也能替他打开那个文件夹。
  const r = await api('export/save', { scope, id, passphrase: passphrase || '' })
  const reveal = async () => {
    const shown = await api('export/reveal', { path: r.path })
    if (shown.ok) toast('已在文件管理器中打开', 'success')
    else toast(`目录：${r.dir}（自动打开失败：${shown.reason}）`, 'info')
  }
  const report = [
    `已导出 ${r.connections} 条连接、${r.folders} 个文件夹${r.keys ? `、${r.keys} 个私钥` : ''}。`,
    r.passwords ? `其中 ${r.passwords} 条连接的密码已用口令加密写进文件。` : '文件里不含任何密码。',
    `保存位置：${r.path}`,
    r.missing ? `注意：有 ${r.missing} 条连接的私钥文件找不到，没有打包进去。` : ''
  ].filter(Boolean)
  // 报告里直接给「打开文件夹」按钮：这是「东西放哪了」最省事的答案。
  const opened = await infoDialog('导出完成', '', report, [
    { label: '打开所在文件夹', primary: true },
    { label: '知道了' }
  ])
  if (opened === 0) await reveal()
}
async function passwordlessFor(conn) {
  let secret;
  try {
    const r2 = await api("passwordless", { connection: conn.id });
    return infoDialog("\u514D\u5BC6\u767B\u5F55\u5DF2\u914D\u7F6E", r2.added ? "\u516C\u94A5\u5DF2\u5199\u5165\u670D\u52A1\u5668\u7684 authorized_keys\u3002" : "\u670D\u52A1\u5668\u4E0A\u539F\u6765\u5C31\u6709\u8FD9\u628A\u516C\u94A5,\u6CA1\u6709\u91CD\u590D\u5199\u5165\u3002", [
      `\u672C\u673A\u7EC8\u7AEF\u91CC\u73B0\u5728\u53EF\u4EE5\u76F4\u63A5\u8FD0\u884C:ssh ${r2.alias}`,
      r2.keyPath && `\u79C1\u94A5 ${r2.keyPath}`,
      r2.configPath && `\u914D\u7F6E ${r2.configPath}`,
      "\u79C1\u94A5\u6CA1\u6709\u53E3\u4EE4,\u8BF7\u50CF\u5BC6\u7801\u4E00\u6837\u4FDD\u7BA1\u5B83\u3002"
    ].filter(Boolean));
  } catch (e) {
    if (e.code !== "needs_secret") throw e;
    secret = await secretDialog(`\u914D\u7F6E\u300C${conn.name}\u300D\u514D\u5BC6\u767B\u5F55`, "\u9700\u8981\u5148\u7528\u5BC6\u7801\u767B\u5F55\u4E00\u6B21,\u624D\u597D\u5728\u670D\u52A1\u5668\u4E0A\u5199\u5165\u516C\u94A5\u3002\u5BC6\u7801\u4E0D\u4F1A\u5B58\u5230\u78C1\u76D8\u3002");
    if (!secret) return;
  }
  const r = await api("passwordless", { connection: conn.id, secret });
  return infoDialog("\u514D\u5BC6\u767B\u5F55\u5DF2\u914D\u7F6E", r.added ? "\u516C\u94A5\u5DF2\u5199\u5165\u670D\u52A1\u5668\u7684 authorized_keys\u3002" : "\u670D\u52A1\u5668\u4E0A\u539F\u6765\u5C31\u6709\u8FD9\u628A\u516C\u94A5,\u6CA1\u6709\u91CD\u590D\u5199\u5165\u3002", [
    `\u672C\u673A\u7EC8\u7AEF\u91CC\u73B0\u5728\u53EF\u4EE5\u76F4\u63A5\u8FD0\u884C:ssh ${r.alias}`,
    r.keyPath && `\u79C1\u94A5 ${r.keyPath}`,
    r.configPath && `\u914D\u7F6E ${r.configPath}`,
    "\u79C1\u94A5\u6CA1\u6709\u53E3\u4EE4,\u8BF7\u50CF\u5BC6\u7801\u4E00\u6837\u4FDD\u7BA1\u5B83\u3002"
  ].filter(Boolean));
}
async function importFromFile(folderId) {
  const path = await fileDialog("\u5BFC\u5165\u8FDE\u63A5\u6587\u4EF6\u2026", "\u4F8B\u5982 D:\备\u4EFD\\liteshell-backup.json", "\u652F\u6301 LiteShell \u5907\u4EFD(.json)\u3001FinalShell \u7684\u8FDE\u63A5\u914D\u7F6E(\u5355\u4E2A\u6587\u4EF6\u6216\u5BFC\u51FA\u76EE\u5F55)\u3002\u53EA\u8BFB\u53D6\u540D\u79F0\u3001\u5730\u5740\u548C\u7528\u6237,\u5BC6\u7801\u80FD\u89E3\u5F00\u7684\u624D\u4F1A\u5E26\u8FC7\u6765\u3002");
  if (!path) return;
  const r = await api("import/file", { path: expandPath(path), folderId: folderId || null });
  await reloadTree();
  return resultDialog("\u5BFC\u5165\u7ED3\u679C", r);
}
function ContextMenu() {
  const st = useStore();
  const m = st.menu;
  globalThis.__dshSshTerminalReact.useEffect(() => {
    if (!m) return;
    const close = () => (state.menu = null, notify());
    const t = setTimeout(() => document.addEventListener("mousedown", close, { once: true }), 0);
    window.addEventListener("blur", close, { once: true });
    return () => (clearTimeout(t), document.removeEventListener("mousedown", close), window.removeEventListener("blur", close));
  }, [m]);
  if (!m) return null;
  const conn = m.kind === "conn" ? st.tree.connections.find((c) => c.id === m.id) : null;
  const folder = m.kind === "folder" ? st.tree.folders.find((f) => f.id === m.id) : null;
  const run = (fn) => (e) => {
    e.stopPropagation();
    state.menu = null;
    state.menuQuery = "";
    notify();
    Promise.resolve(fn()).catch(fail);
  };
  const newFolder = (parentId) => async () => {
    const name = await promptText("\u65B0\u5EFA\u6587\u4EF6\u5939");
    if (!name) return;
    await api("folder/save", { name, parentId });
    if (parentId) setExpanded(parentId, true);
    await reloadTree();
  };
  const item = (label, fn, cls = "") => h("div", { className: `sx-mi ${cls}`, onMouseDown: (e) => e.stopPropagation(), onClick: run(fn) }, label);
  const sep = (k) => h("div", { key: k, className: "sx-msep" });
  const menuHits = conn ? filterConnections(st.tree.connections, st.menuQuery) : null;
  const items = [];
  if (conn) {
    if (menuHits) {
      items.push(
        ...menuHits.length ? menuHits.map((c) => h("div", {
          key: c.id,
          className: "sx-mi",
          onMouseDown: (e) => e.stopPropagation(),
          onClick: run(() => openSession(c))
        }, `${c.name}  `, h("span", { className: "sx-sub" }, show(c)))) : [h("div", { key: "none", className: "sx-hint" }, "\u6CA1\u6709\u5339\u914D\u7684\u8FDE\u63A5")]
      );
    } else {
      items.push(
        item("\u8FDE\u63A5", () => openSession(conn)),
        item("\u7F16\u8F91", async () => await editConnection(conn) && reloadTree()),
        item("\u91CD\u547D\u540D", async () => {
          const name = await promptText("\u91CD\u547D\u540D\u8FDE\u63A5", conn.name);
          if (name && name !== conn.name) {
            await api("upsert", { connection: { ...conn, name } });
            await reloadTree();
          }
        }),
        item("\u590D\u5236 IP", () => copyText(conn.host, "IP")),
        item("\u914D\u7F6E\u672C\u673A\u514D\u5BC6\u767B\u5F55\u2026", () => passwordlessFor(conn)),
        item("\u5BFC\u51FA\u2026", () => exportDialog({ scope: "connection", id: conn.id, name: conn.name })),
        item("\u590D\u5236\u8FDE\u63A5", async () => (await api("duplicate", { id: conn.id }), await reloadTree(), toast("\u8FDE\u63A5\u5DF2\u590D\u5236", "success"))),
        sep("s1"),
        item("\u5220\u9664", async () => {
          if (await confirmBox(`\u5220\u9664\u8FDE\u63A5\u201C${conn.name}\u201D?`, "\u5DF2\u4FDD\u5B58\u7684\u5BC6\u7801\u4E5F\u4F1A\u4E00\u8D77\u5220\u9664\u3002", "\u5220\u9664")) {
            await api("delete", { id: conn.id });
            await reloadTree();
          }
        }, "dng")
      );
    }
  } else if (folder) {
    items.push(
      item("\u65B0\u5EFA\u8FDE\u63A5", async () => await editConnection(null, folder.id) && (setExpanded(folder.id, true), reloadTree())),
      item("\u65B0\u5EFA\u5B50\u6587\u4EF6\u5939", newFolder(folder.id)),
      sep("s1"),
      item("\u5BFC\u5165\u8FDE\u63A5\u6587\u4EF6\u2026", () => importFromFile(folder.id)),
      item("\u5BFC\u51FA\u6B64\u6587\u4EF6\u5939\u2026", () => exportDialog({ scope: "folder", id: folder.id, name: folder.name })),
      sep("s2"),
      item("\u91CD\u547D\u540D", async () => {
        const name = await promptText("\u91CD\u547D\u540D\u6587\u4EF6\u5939", folder.name);
        if (name && name !== folder.name) {
          await api("folder/save", { id: folder.id, name, parentId: folder.parentId });
          await reloadTree();
        }
      }),
      item("\u5220\u9664", async () => {
        if (await confirmBox(`\u5220\u9664\u6587\u4EF6\u5939\u201C${folder.name}\u201D?`, "\u6587\u4EF6\u5939\u91CC\u7684\u5B50\u6587\u4EF6\u5939\u548C\u8FDE\u63A5\u90FD\u4F1A\u88AB\u4E00\u5E76\u5220\u9664\u3002", "\u5220\u9664")) {
          await api("folder/delete", { id: folder.id });
          await reloadTree();
        }
      }, "dng")
    );
  } else {
    items.push(
      item('新建连接', async () => await editConnection(null, null) && reloadTree()),
      item('新建文件夹', newFolder(null)),
      sep('s1'),
      item('导入连接文件…', () => importFromFile(null)),
      // 整份导出以前在界面里根本没有入口：后端有 export?scope=all，但没有任何一个菜单
      // 会调它，用户只能导出单条连接或单个文件夹。
      item('导出全部连接…', () => exportDialog({ scope: 'all', id: null, name: '全部连接' }))
    );
  }
  return h(
    "div",
    { className: "sx-menu", style: { left: Math.min(m.x, innerWidth - 190), top: Math.min(m.y, innerHeight - 300) } },
    conn && [
      h("input", {
        key: "q",
        className: "sx-input sm",
        placeholder: "\u641C\u7D22\u8FDE\u63A5\u2026",
        value: st.menuQuery,
        autoFocus: true,
        onMouseDown: (e) => e.stopPropagation(),
        onInput: (e) => (state.menuQuery = e.target.value, notify())
      }),
      sep("s0")
    ],
    items
  );
}
function Toast() {
  const t = useStore().toast;
  return t ? h("div", { className: `sx-toast ${t.kind}` }, t.text) : null;
}
function App() {
  const st = useStore();
  globalThis.__dshSshTerminalReact.useEffect(() => {
    reloadTree();
  }, []);
  return h(
    "div",
    { className: "sx-root" },
    h(ConnectionTree),
    h(
      "div",
      { className: "sx-main" },
      st.sessions.length > 0 && h(TabBar),
      st.sessions.length > 0 && h(Toolbar),
      h(
        "div",
        { className: "sx-body" },
        h(TerminalArea),
        st.drawer === "files" && st.sessions.length > 0 && h(FileDrawer),
        st.drawer === "monitor" && st.sessions.length > 0 && h(MonitorDrawer, { open: true }),
        st.aiOpen && st.sessions.length > 0 && h(AiPanel)
      )
    ),
    h(EditorPanel),
    h(CommandPalette),
    h(LogPanel),
    h(HistoryPanel),
    h(ShortcutsPanel),
    h(Dialogs),
    h(ContextMenu),
    h(Toast)
  );
}
var Icon = ({ size = 16 }) => h(
  "svg",
  { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, "aria-hidden": true },
  h("rect", { x: 2, y: 4, width: 20, height: 16, rx: 2 }),
  h("path", { d: "M6 8l4 4-4 4M12 16h6" })
);
window.__ModuleLoader__.load({
  id: "dsh-vyra-ssh-terminal",
  factory(require2) {
    setReact(require2("react"));
    return {
      inject: ["slots"],
      apply(ctx) {
        ctx.effect(() => {
          const style = document.createElement("style");
          style.textContent = styles;
          document.head.append(style);
          return () => style.remove();
        }, "SSH terminal styles");
        ctx.effect(() => watchTheme(applyTheme), "SSH terminal theme");
        ctx.effect(() => () => disposeAll(), "SSH terminal sessions");
        ctx.effect(installShortcuts, "SSH terminal shortcuts");
        for (const [slot, options, view] of [
          ["main", { key: "ssh-terminal", inject: () => ({}) }, App],
          ["sidebar.panellist", { id: "ssh-terminal", order: 12, label: "SSH" }, Icon]
        ]) ctx.slots.inject(slot, () => ctx.slots.register({ name: slot, ...options }, view));
      }
    };
  }
});
