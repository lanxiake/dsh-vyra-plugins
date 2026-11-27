import { hostReact } from './react.js'

export const load = (k, d) => {
  try {
    const v = localStorage.getItem(k);
    return v == null ? d : JSON.parse(v);
  } catch {
    return d;
  }
};
export const save = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
  }
};
export const state = {
  tree: { folders: [], connections: [] },
  loaded: false,
  sessions: [],
  active: null,
  drawer: null,
  // 'files' | 'monitor' | null
  // 用户在这一场里手动关掉了监控：连上新会话时不再自动弹出来。
  monitorDismissed: false,
  // AI 面板开着没有
  aiOpen: false,
  searchOpen: false,
  hintsOn: load("sx-hints", true),
  selected: null,
  query: "",
  collapsed: load("ssh-sidebar-collapsed", false),
  expanded: new Set(load("sx-expanded", [])),
  menu: null,
  // { x, y, kind: 'conn' | 'folder' | 'root', id }
  menuQuery: "",
  // 连接菜单顶部的搜索框
  dialog: null,
  toast: null
};
export function filterConnections(conns, q) {
  const s = String(q ?? "").trim().toLowerCase();
  if (!s) return null;
  return conns.filter((c) => [c.name, c.host, c.username, String(c.port)].some((v) => String(v ?? "").toLowerCase().includes(s)));
}
export const subs = /* @__PURE__ */ new Set();
export const subscribe = (f) => {
  subs.add(f);
  return () => subs.delete(f);
};
export const notify = () => [...subs].forEach((f) => f());
export function useStore() {
  const [, set] = globalThis.__dshSshTerminalReact.useState(0);
  globalThis.__dshSshTerminalReact.useEffect(() => subscribe(() => set((v) => v + 1)), []);
  return state;
}
let dialogId = 0;
export function openDialog(d) {
  return new Promise((resolve) => {
    state.dialog?.resolve(void 0);
    state.dialog = { ...d, resolve, id: ++dialogId };
    notify();
  });
}
export function closeDialog(result) {
  const d = state.dialog;
  if (!d) return;
  state.dialog = null;
  notify();
  d.resolve(result);
}
export const confirmBox = (message, detail = "", okText = "\u786E\u5B9A") => openDialog({ type: "confirm", message, detail, okText });
export const promptText = (title, value = "", placeholder = "") => openDialog({ type: "prompt", title, value, placeholder });
export const askSecret = (conn, message) => openDialog({ type: "secret", conn, message });
export const editConnection = (conn, folderId) => openDialog({ type: "connection", conn, folderId });
export const importConnections = () => openDialog({ type: "import" });
export const secretDialog = (title, note, confirm = "\u786E\u5B9A") => openDialog({ type: "secret-input", title, note, confirm });
export const fileDialog = (title, placeholder = "", note = "") => openDialog({ type: "file", title, placeholder, note });
export const infoDialog = (title, note, lines = [], buttons = null) => openDialog({ type: "info", title, note, lines, buttons });
export const resultDialog = (title, r) => openDialog({ type: "result", title, result: r });
export function setCollapsed(on) {
  state.collapsed = on;
  save("ssh-sidebar-collapsed", on);
  notify();
}
let toastId = 0;
export function toast(text, kind = "info") {
  const id = ++toastId;
  state.toast = { text, kind, id };
  notify();
  setTimeout(() => {
    if (state.toast?.id === id) {
      state.toast = null;
      notify();
    }
  }, 4200);
}
export function setExpanded(id, on) {
  if (on) state.expanded.add(id);
  else state.expanded.delete(id);
  save("sx-expanded", [...state.expanded]);
  notify();
}
export function setHintsOn(on) {
  state.hintsOn = on;
  save("sx-hints", on);
  notify();
}
