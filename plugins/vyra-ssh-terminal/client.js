(() => {
  // src/react.js
  var R = {};
  var react_default = R;
  var setReact = (react) => Object.assign(R, react);

  // src/jsx-shim.js
  var h = (...args) => react_default.createElement(...args);
  var Fragment = /* @__PURE__ */ Symbol.for("react.fragment");

  // src/state.js
  var load = (k, d) => {
    try {
      const v = localStorage.getItem(k);
      return v == null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  };
  var save = (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
    }
  };
  var state = {
    tree: { folders: [], connections: [] },
    loaded: false,
    sessions: [],
    active: null,
    drawer: null,
    // 'files' | 'monitor' | null
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
  function filterConnections(conns, q) {
    const s = String(q ?? "").trim().toLowerCase();
    if (!s) return null;
    return conns.filter((c) => [c.name, c.host, c.username, String(c.port)].some((v) => String(v ?? "").toLowerCase().includes(s)));
  }
  var subs = /* @__PURE__ */ new Set();
  var subscribe = (f) => {
    subs.add(f);
    return () => subs.delete(f);
  };
  var notify = () => [...subs].forEach((f) => f());
  function useStore() {
    const [, set] = react_default.useState(0);
    react_default.useEffect(() => subscribe(() => set((v) => v + 1)), []);
    return state;
  }
  var dialogId = 0;
  function openDialog(d) {
    return new Promise((resolve) => {
      state.dialog?.resolve(void 0);
      state.dialog = { ...d, resolve, id: ++dialogId };
      notify();
    });
  }
  function closeDialog(result) {
    const d = state.dialog;
    if (!d) return;
    state.dialog = null;
    notify();
    d.resolve(result);
  }
  var confirmBox = (message, detail = "", okText = "\u786E\u5B9A") => openDialog({ type: "confirm", message, detail, okText });
  var promptText = (title, value = "", placeholder = "") => openDialog({ type: "prompt", title, value, placeholder });
  var askSecret = (conn, message) => openDialog({ type: "secret", conn, message });
  var editConnection = (conn, folderId) => openDialog({ type: "connection", conn, folderId });
  var importConnections = () => openDialog({ type: "import" });
  var secretDialog = (title, note, confirm = "\u786E\u5B9A") => openDialog({ type: "secret-input", title, note, confirm });
  var fileDialog = (title, placeholder = "", note = "") => openDialog({ type: "file", title, placeholder, note });
  var infoDialog = (title, note, lines = []) => openDialog({ type: "info", title, note, lines });
  var resultDialog = (title, r) => openDialog({ type: "result", title, result: r });
  function setCollapsed(on) {
    state.collapsed = on;
    save("ssh-sidebar-collapsed", on);
    notify();
  }
  var toastId = 0;
  function toast(text, kind = "info") {
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
  function setExpanded(id, on) {
    if (on) state.expanded.add(id);
    else state.expanded.delete(id);
    save("sx-expanded", [...state.expanded]);
    notify();
  }
  function setHintsOn(on) {
    state.hintsOn = on;
    save("sx-hints", on);
    notify();
  }

  // src/api.js
  var BASE = "/api/ssh-terminal/";
  var ApiError = class extends Error {
    constructor(message, status, code) {
      super(message);
      this.status = status;
      this.code = code;
    }
  };
  var url = (route, query) => {
    if (!query) return BASE + route;
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v !== void 0 && v !== null) q.set(k, v);
    const s = q.toString();
    return BASE + route + (s ? "?" + s : "");
  };
  async function parse(res) {
    const text = await res.text();
    let value;
    try {
      value = JSON.parse(text);
    } catch {
      throw new ApiError(`\u670D\u52A1\u7AEF\u6CA1\u6709\u8FD4\u56DE JSON(HTTP ${res.status}),\u63D2\u4EF6\u7684\u540E\u7AEF\u53EF\u80FD\u6CA1\u6709\u52A0\u8F7D,\u8BF7\u91CD\u542F DSH \u540E\u518D\u8BD5`, res.status);
    }
    if (!res.ok) throw new ApiError(value.error || `\u8BF7\u6C42\u5931\u8D25(HTTP ${res.status})`, res.status, value.code);
    return value;
  }
  async function api(route, body, query) {
    return parse(
      await fetch(
        url(route, query),
        body !== void 0 ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" }
      )
    );
  }
  async function upload(query, file) {
    return parse(await fetch(url("files/upload", query), { method: "POST", body: file }));
  }
  function download(query) {
    const a = document.createElement("a");
    a.href = url("files/download", query);
    a.download = "";
    document.body.append(a);
    a.click();
    a.remove();
  }

  // src/xterm-loader.js
  var loading = null;
  var ok = false;
  async function loadXterm() {
    if (ok) return;
    if (loading) return loading;
    loading = (async () => {
      const base = "/api/ssh-terminal/";
      const load2 = (src) => new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = base + src;
        s.onload = res;
        s.onerror = () => rej(new Error("\u52A0\u8F7D " + src + " \u5931\u8D25"));
        document.head.append(s);
      });
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = base + "xterm.css";
      document.head.append(link);
      const d = window.define;
      window.define = void 0;
      try {
        await load2("xterm.js");
        await load2("addon-fit.js");
        await load2("addon-search.js");
      } finally {
        window.define = d;
      }
      ok = true;
    })();
    return loading;
  }

  // src/theme.js
  var canvasCtx;
  function toRgb(css2) {
    canvasCtx ?? (canvasCtx = document.createElement("canvas").getContext("2d", { willReadFrequently: true }));
    canvasCtx.canvas.width = canvasCtx.canvas.height = 1;
    canvasCtx.clearRect(0, 0, 1, 1);
    canvasCtx.fillStyle = "#000";
    canvasCtx.fillStyle = css2;
    canvasCtx.fillRect(0, 0, 1, 1);
    const [r, g, b] = canvasCtx.getImageData(0, 0, 1, 1).data;
    return [r, g, b];
  }
  function themeColor(name, fallback) {
    const el = document.createElement("span");
    el.style.cssText = `position:absolute;visibility:hidden;color:var(${name},${fallback})`;
    document.body.append(el);
    const c = getComputedStyle(el).color;
    el.remove();
    return toRgb(c);
  }
  var css = ([r, g, b], a = 1) => a === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;
  var luminance = ([r, g, b]) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  var DARK = {
    black: "#3b4252",
    red: "#f7768e",
    green: "#9ece6a",
    yellow: "#e0af68",
    blue: "#7aa2f7",
    magenta: "#bb9af7",
    cyan: "#7dcfff",
    white: "#c0caf5",
    brightBlack: "#6b7394",
    brightRed: "#ff899d",
    brightGreen: "#b9f27c",
    brightYellow: "#ffc777",
    brightBlue: "#8db0ff",
    brightMagenta: "#c9a9ff",
    brightCyan: "#a4daff",
    brightWhite: "#eef1ff"
  };
  var LIGHT = {
    black: "#24292f",
    red: "#cf222e",
    green: "#116329",
    yellow: "#7d4e00",
    blue: "#0550ae",
    magenta: "#8250df",
    cyan: "#1b7c83",
    white: "#6e7781",
    brightBlack: "#57606a",
    brightRed: "#a40e26",
    brightGreen: "#1a7f37",
    brightYellow: "#9a6700",
    brightBlue: "#0969da",
    brightMagenta: "#a475f9",
    brightCyan: "#3192aa",
    brightWhite: "#8c959f"
  };
  function termTheme() {
    const bg = themeColor("--dsw-alias-bg-layer-1", "#1e1e1e");
    const fg = themeColor("--dsw-alias-label-primary", "#d4d4d4");
    const accent = themeColor("--dsw-alias-brand-primary", "#4aa3ff");
    return {
      background: css(bg),
      foreground: css(fg),
      cursor: css(accent),
      cursorAccent: css(bg),
      selectionBackground: css(accent, 0.35),
      ...luminance(bg) < 0.5 ? DARK : LIGHT
    };
  }
  function watchTheme(cb) {
    let t;
    const fire = () => {
      clearTimeout(t);
      t = setTimeout(cb, 80);
    };
    const mo = new MutationObserver(fire);
    const opts = { attributes: true, attributeFilter: ["class", "style", "data-theme", "data-color-scheme"] };
    mo.observe(document.documentElement, opts);
    mo.observe(document.body, opts);
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    mq?.addEventListener?.("change", fire);
    return () => {
      clearTimeout(t);
      mo.disconnect();
      mq?.removeEventListener?.("change", fire);
    };
  }

  // src/commands.ts
  var COMMON = [
    ["ls", "\u5217\u76EE\u5F55"],
    ["cd", "\u5207\u6362\u76EE\u5F55"],
    ["cat", "\u67E5\u770B\u6587\u4EF6"],
    ["tail", "\u770B\u6587\u4EF6\u672B\u5C3E\uFF0C\u5E38\u7528 -f \u8DDF\u8E2A\u65E5\u5FD7"],
    ["grep", "\u6309\u5185\u5BB9\u641C\u7D22\u6587\u672C"],
    ["ps", "\u67E5\u770B\u8FDB\u7A0B"],
    ["top", "\u5B9E\u65F6\u8FDB\u7A0B\u4E0E\u8D1F\u8F7D"],
    ["systemctl", "\u7BA1\u7406 systemd \u670D\u52A1"],
    ["journalctl", "\u67E5\u770B systemd \u65E5\u5FD7"],
    ["df", "\u78C1\u76D8\u4F7F\u7528\u7387"],
    ["du", "\u76EE\u5F55\u5360\u7528\u7EDF\u8BA1"],
    ["free", "\u5185\u5B58\u4F7F\u7528"],
    ["tar", "\u6253\u5305\u89E3\u5305"],
    ["curl", "\u53D1 HTTP \u8BF7\u6C42"],
    ["docker", "\u5BB9\u5668\u7BA1\u7406"],
    ["git", "\u7248\u672C\u63A7\u5236"],
    ["vim", "\u7F16\u8F91\u6587\u4EF6"],
    ["less", "\u5206\u9875\u67E5\u770B"],
    ["head", "\u770B\u6587\u4EF6\u5F00\u5934"],
    ["find", "\u6309\u6761\u4EF6\u627E\u6587\u4EF6"],
    ["sed", "\u6D41\u5F0F\u66FF\u6362\u6587\u672C"],
    ["awk", "\u6309\u5217\u5904\u7406\u6587\u672C"],
    ["sort", "\u6392\u5E8F"],
    ["uniq", "\u53BB\u91CD"],
    ["wc", "\u7EDF\u8BA1\u884C\u6570\u5B57\u6570"],
    ["lsblk", "\u5217\u51FA\u5757\u8BBE\u5907"],
    ["lsof", "\u67E5\u770B\u7AEF\u53E3/\u6587\u4EF6\u5360\u7528"],
    ["ss", "\u67E5\u770B\u7F51\u7EDC\u8FDE\u63A5"],
    ["netstat", "\u7F51\u7EDC\u8FDE\u63A5\u4E0E\u7AEF\u53E3"],
    ["ping", "\u6D4B\u8BD5\u8FDE\u901A\u6027"],
    ["nvidia-smi", "\u67E5\u770B GPU \u72B6\u6001"],
    ["iptables", "\u9632\u706B\u5899\u89C4\u5219"],
    ["chmod", "\u6539\u6743\u9650"],
    ["chown", "\u6539\u5C5E\u4E3B"],
    ["cp", "\u590D\u5236"],
    ["mv", "\u79FB\u52A8\u6216\u6539\u540D"],
    ["rm", "\u5220\u9664"],
    ["mkdir", "\u65B0\u5EFA\u76EE\u5F55"],
    ["touch", "\u65B0\u5EFA\u7A7A\u6587\u4EF6/\u66F4\u65B0\u65F6\u95F4"],
    ["ln", "\u5EFA\u94FE\u63A5"],
    ["pwd", "\u5F53\u524D\u8DEF\u5F84"],
    ["echo", "\u8F93\u51FA\u6587\u672C"],
    ["export", "\u8BBE\u7F6E\u73AF\u5883\u53D8\u91CF"],
    ["source", "\u5728\u5F53\u524D shell \u6267\u884C\u811A\u672C"],
    ["env", "\u67E5\u770B\u73AF\u5883\u53D8\u91CF"],
    ["which", "\u547D\u4EE4\u7684\u7EDD\u5BF9\u8DEF\u5F84"],
    ["whereis", "\u547D\u4EE4\u76F8\u5173\u7684\u6587\u4EF6"],
    ["man", "\u67E5\u770B\u624B\u518C"],
    ["history", "\u5386\u53F2\u547D\u4EE4"],
    ["crontab", "\u5B9A\u65F6\u4EFB\u52A1"],
    ["date", "\u5F53\u524D\u65F6\u95F4"],
    ["uptime", "\u5F00\u673A\u65F6\u957F\u4E0E\u8D1F\u8F7D"],
    ["who", "\u5F53\u524D\u767B\u5F55\u7528\u6237"],
    ["whoami", "\u5F53\u524D\u7528\u6237\u540D"],
    ["id", "\u7528\u6237\u4E0E\u7EC4\u4FE1\u606F"],
    ["uname", "\u5185\u6838\u4FE1\u606F"],
    ["hostname", "\u4E3B\u673A\u540D"],
    ["kill", "\u6309 PID \u7ED3\u675F\u8FDB\u7A0B"],
    ["pkill", "\u6309\u540D\u5B57\u7ED3\u675F\u8FDB\u7A0B"],
    ["killall", "\u7ED3\u675F\u540C\u540D\u8FDB\u7A0B"],
    ["nohup", "\u540E\u53F0\u5E38\u9A7B\u8FD0\u884C"],
    ["watch", "\u5B9A\u65F6\u91CD\u590D\u6267\u884C"],
    ["screen", "\u4F1A\u8BDD\u4FDD\u6301"],
    ["tmux", "\u7EC8\u7AEF\u590D\u7528"],
    ["crontab -l", "\u5217\u51FA\u5B9A\u65F6\u4EFB\u52A1"],
    ["rsync", "\u589E\u91CF\u540C\u6B65\u6587\u4EF6"],
    ["scp", "\u8FDC\u7A0B\u590D\u5236"],
    ["ssh", "\u767B\u5F55\u53E6\u4E00\u53F0\u673A\u5668"],
    ["ssh-keygen", "\u751F\u6210\u5BC6\u94A5\u5BF9"],
    ["wget", "\u4E0B\u8F7D\u6587\u4EF6"],
    ["unzip", "\u89E3\u538B zip"],
    ["gzip", "\u538B\u7F29/\u89E3\u538B gz"],
    ["zip", "\u6253\u5305 zip"],
    ["uname -a", "\u5B8C\u6574\u7CFB\u7EDF\u4FE1\u606F"],
    ["lscpu", "CPU \u4FE1\u606F"],
    ["lsusb", "USB \u8BBE\u5907"],
    ["lspci", "PCI \u8BBE\u5907"],
    ["dmesg", "\u5185\u6838\u65E5\u5FD7"],
    ["vmstat", "\u7CFB\u7EDF\u6574\u4F53\u72B6\u6001"],
    ["iostat", "\u78C1\u76D8 IO \u7EDF\u8BA1"],
    ["iptables -L", "\u5217\u51FA\u9632\u706B\u5899\u89C4\u5219"],
    ["redis-cli", "\u8FDE\u63A5 Redis"],
    ["mysql", "\u8FDE\u63A5 MySQL"],
    ["nginx", "Nginx \u670D\u52A1"],
    ["make", "\u7F16\u8BD1\u6784\u5EFA"],
    ["gcc", "\u7F16\u8BD1 C"],
    ["python3", "\u8FD0\u884C Python"],
    ["node", "\u8FD0\u884C Node"],
    ["npm", "Node \u5305\u7BA1\u7406"],
    ["pip", "Python \u5305\u7BA1\u7406"],
    ["java", "\u8FD0\u884C Java"],
    ["mvn", "Maven \u6784\u5EFA"],
    ["go", "Go \u5DE5\u5177\u94FE"],
    ["kubectl", "Kubernetes \u96C6\u7FA4"],
    ["pm2", "Node \u8FDB\u7A0B\u7BA1\u7406"],
    ["supervisorctl", "\u7BA1\u7406 supervisord \u8FDB\u7A0B"],
    ["service", "\u670D\u52A1\u7BA1\u7406\uFF08\u65E7\u7248\uFF09"],
    ["apt", "Debian \u7CFB\u5305\u7BA1\u7406"],
    ["yum", "RedHat \u7CFB\u5305\u7BA1\u7406"],
    ["dnf", "Fedora \u7CFB\u5305\u7BA1\u7406"],
    ["firewall-cmd", "firewalld \u89C4\u5219"],
    ["sysctl", "\u5185\u6838\u53C2\u6570"],
    ["mount", "\u6302\u8F7D"],
    ["umount", "\u5378\u8F7D"],
    ["blkid", "\u5757\u8BBE\u5907 UUID"],
    ["fdisk", "\u78C1\u76D8\u5206\u533A"],
    ["reboot", "\u91CD\u542F\u673A\u5668"],
    ["shutdown", "\u5173\u673A"],
    ["sudo", "\u4EE5 root \u6267\u884C"],
    ["su", "\u5207\u6362\u7528\u6237"],
    ["passwd", "\u6539\u5BC6\u7801"],
    ["useradd", "\u65B0\u5EFA\u7528\u6237"],
    ["diff", "\u6BD4\u8F83\u4E24\u4E2A\u6587\u4EF6"],
    ["md5sum", "\u7B97 MD5"],
    ["sha256sum", "\u7B97 SHA256"],
    ["base64", "base64 \u7F16\u89E3\u7801"],
    ["tree", "\u6811\u72B6\u5217\u76EE\u5F55"],
    ["stat", "\u6587\u4EF6\u5143\u4FE1\u606F"],
    ["file", "\u8BC6\u522B\u6587\u4EF6\u7C7B\u578B"],
    ["type", "\u547D\u4EE4\u662F\u5185\u5EFA\u8FD8\u662F\u5916\u90E8"],
    ["alias", "\u67E5\u770B\u6216\u5B9A\u4E49\u522B\u540D"],
    ["history -c", "\u6E05\u7A7A\u5386\u53F2"]
  ];
  var SUBCOMMANDS = {
    systemctl: [
      ["status ", "\u770B\u670D\u52A1\u72B6\u6001\uFF0C\u670D\u52A1\u540D\u8DDF\u5728\u540E\u9762"],
      ["restart ", "\u91CD\u542F\u670D\u52A1"],
      ["reload ", "\u53EA\u91CD\u8BFB\u914D\u7F6E\uFF0C\u4E0D\u65AD\u5F00\u8FDE\u63A5"],
      ["start ", "\u542F\u52A8"],
      ["stop ", "\u505C\u6B62"],
      ["enable --now ", "\u8BBE\u4E3A\u5F00\u673A\u81EA\u542F\u5E76\u7ACB\u523B\u542F\u52A8"],
      ["list-units --failed", "\u54EA\u4E9B\u670D\u52A1\u8D77\u6302\u4E86"],
      ["status -l --no-pager ", "\u957F\u8F93\u51FA\u4E0D\u5206\u9875"],
      ["daemon-reload", "\u6539\u5B8C unit \u6587\u4EF6\u540E\u91CD\u8F7D"]
    ],
    journalctl: [
      ["-u nginx -f", "\u8DDF\u8E2A\u67D0\u4E2A\u670D\u52A1\u7684\u65E5\u5FD7"],
      ["-u nginx -n 200 --no-pager", "\u6700\u8FD1 200 \u884C"],
      ["-xe --no-pager", "\u6700\u8FD1\u7684\u9519\u8BEF\u53CA\u89E3\u91CA"],
      ["--since '1 hour ago'", "\u6309\u65F6\u95F4\u8303\u56F4\u770B"],
      ["-b -p err", "\u672C\u6B21\u542F\u52A8\u4EE5\u6765\u7684\u9519\u8BEF"],
      ["--disk-usage", "journal \u5360\u4E86\u591A\u5C11\u78C1\u76D8"],
      ["--vacuum-time=7d", "\u53EA\u4FDD\u7559 7 \u5929"]
    ],
    docker: [
      ["ps -a", "\u6240\u6709\u5BB9\u5668"],
      ["logs -f --tail 200 ", "\u8DDF\u8E2A\u5BB9\u5668\u65E5\u5FD7\uFF08\u8DDF\u5BB9\u5668\u540D\uFF09"],
      ["exec -it ", "\u8FDB\u5BB9\u5668\uFF08\u8DDF\u5BB9\u5668\u540D sh\uFF09"],
      ["images", "\u672C\u5730\u955C\u50CF"],
      ["stats --no-stream", "\u4E00\u6B21\u8D44\u6E90\u5360\u7528\u5FEB\u7167"],
      ["inspect ", "\u5BB9\u5668\u8BE6\u60C5 JSON"],
      ["system df", "\u955C\u50CF\u4E0E\u5377\u5404\u5360\u591A\u5C11"],
      ["compose ps", "compose \u670D\u52A1\u72B6\u6001"],
      ["compose logs -f --tail 100", "\u8DDF\u8E2A compose \u5168\u90E8\u65E5\u5FD7"],
      ["compose up -d", "\u540E\u53F0\u62C9\u8D77 compose"],
      ["compose restart ", "\u91CD\u542F\u67D0\u4E2A\u670D\u52A1"]
    ],
    kubectl: [
      ["get pods -A -o wide", "\u6240\u6709 Pod \u53CA\u6240\u5728\u8282\u70B9"],
      ["get pods -A --field-selector=status.phase!=Running", "\u4E0D\u6B63\u5E38\u7684 Pod"],
      ["get nodes -o wide", "\u8282\u70B9\u72B6\u6001\u4E0E\u7248\u672C"],
      ["get events -A --sort-by=.lastTimestamp | tail -30", "\u6700\u8FD1\u7684\u96C6\u7FA4\u4E8B\u4EF6"],
      ["top pods -A", "Pod \u8D44\u6E90\u5360\u7528"],
      ["logs -f deploy/app --tail=200", "\u8DDF\u5E94\u7528\u65E5\u5FD7\uFF08\u6539 deploy/app\uFF09"],
      ["exec -it deploy/app -- sh", "\u8FDB\u5BB9\u5668"],
      ["describe pod app-0", "Pod \u8BE6\u60C5\uFF0C\u5148\u770B Events"],
      ["rollout restart deploy/app", "\u6EDA\u52A8\u91CD\u542F"],
      ["rollout status deploy/app", "\u6EDA\u52A8\u66F4\u65B0\u8FDB\u5EA6"],
      ["apply -f deploy.yaml", "\u5E94\u7528\u6E05\u5355"],
      ["delete pod app-0", "\u5220 Pod \u89E6\u53D1\u91CD\u5EFA"]
    ],
    git: [
      ["status", "\u5DE5\u4F5C\u533A\u72B6\u6001"],
      ["diff", "\u672A\u6682\u5B58\u7684\u6539\u52A8"],
      ["diff --staged", "\u5DF2\u6682\u5B58\u7684\u6539\u52A8"],
      ["log --oneline --graph -20", "\u7D27\u51D1\u7684\u5386\u53F2\u56FE"],
      ["add -A", "\u6682\u5B58\u5168\u90E8\u6539\u52A8"],
      ["commit -m ''", "\u63D0\u4EA4\uFF0C\u5F15\u53F7\u91CC\u5199\u8BF4\u660E"],
      ["push", "\u63A8\u5230\u8FDC\u7AEF"],
      ["pull --rebase", "\u62C9\u53D6\u5E76\u53D8\u57FA\uFF0C\u5386\u53F2\u66F4\u5E72\u51C0"],
      ["stash", "\u6682\u5B58\u5F53\u524D\u6539\u52A8"],
      ["stash pop", "\u628A\u6682\u5B58\u7684\u6539\u56DE\u6765"],
      ["switch -c feature/x", "\u65B0\u5EFA\u5E76\u5207\u5230\u5206\u652F"],
      ["branch -a", "\u672C\u5730\u4E0E\u8FDC\u7AEF\u5206\u652F"],
      ["remote -v", "\u8FDC\u7AEF\u5730\u5740"],
      ["restore .", "\u4E22\u5F03\u5DE5\u4F5C\u533A\u6539\u52A8"],
      ["reset --hard HEAD", "\u4E22\u5F03\u5168\u90E8\u672A\u63D0\u4EA4\u6539\u52A8"]
    ],
    apt: [
      ["update", "\u5237\u65B0\u5305\u7D22\u5F15"],
      ["upgrade", "\u5347\u7EA7\u5DF2\u5B89\u88C5\u7684\u5305"],
      ["install ", "\u5B89\u88C5\uFF0C\u8DDF\u5305\u540D"],
      ["remove --purge ", "\u5378\u8F7D\u5E76\u6E05\u6389\u914D\u7F6E"],
      ["list --upgradable", "\u53EF\u5347\u7EA7\u7684\u5305"],
      ["autoremove", "\u6E05\u7406\u4E0D\u518D\u9700\u8981\u7684\u4F9D\u8D56"],
      ["search ", "\u641C\u7D22\u5305"],
      ["show ", "\u5305\u7684\u8BE6\u60C5\u4E0E\u4F9D\u8D56"]
    ],
    yum: [
      ["check-update", "\u53EF\u5347\u7EA7\u7684\u5305"],
      ["update", "\u5347\u7EA7"],
      ["install ", "\u5B89\u88C5\uFF0C\u8DDF\u5305\u540D"],
      ["remove ", "\u5378\u8F7D"],
      ["search ", "\u641C\u7D22\u5305"],
      ["info ", "\u5305\u7684\u8BE6\u60C5"],
      ["clean all", "\u6E05\u7A7A\u7F13\u5B58"]
    ],
    tar: [
      ["-czf backup.tar.gz ", "\u6253\u5305\u538B\u7F29\uFF0C\u8DDF\u8981\u6253\u5305\u7684\u76EE\u5F55"],
      ["-xzf ", "\u89E3\u538B .tar.gz"],
      ["-tzf ", "\u53EA\u770B\u538B\u7F29\u5305\u91CC\u6709\u5565\uFF0C\u4E0D\u89E3\u5F00"],
      ["-czf backup.tar.gz --exclude=.git .", "\u6392\u9664 .git \u6253\u5305"],
      ["-xzf x.tar.gz -C /tmp", "\u89E3\u5230\u6307\u5B9A\u76EE\u5F55"],
      ["-cJf backup.tar.xz ", "\u7528 xz \u538B\uFF0C\u4F53\u79EF\u6700\u5C0F"],
      ["-cjf backup.tar.bz2 ", "\u7528 bzip2 \u538B"]
    ],
    find: [
      ['. -type f -name "*.log"', "\u6309\u540D\u5B57\u627E\u6587\u4EF6"],
      [". -type d -name node_modules", "\u6309\u540D\u5B57\u627E\u76EE\u5F55"],
      [". -type f -mtime -1", "\u4E00\u5929\u5185\u6539\u52A8\u8FC7\u7684"],
      [". -type f -size +100M", "\u5927\u4E8E 100MB \u7684\u6587\u4EF6"],
      ["/var -type f -mtime +30 -delete", "\u6E05\u7406 30 \u5929\u524D\u7684\u6587\u4EF6"],
      [". -perm -4000 -type f", "SUID \u7A0B\u5E8F"],
      ['. -type f -exec grep -l "keyword" {} +', "\u5728\u627E\u5230\u7684\u6587\u4EF6\u91CC\u641C\u5185\u5BB9"]
    ],
    grep: [
      ["-rn 'keyword' .", "\u9012\u5F52\u641C\u7D22\u5E76\u663E\u793A\u884C\u53F7"],
      ["-i -n 'error' app.log", "\u5FFD\u7565\u5927\u5C0F\u5199"],
      ["-v '^#' nginx.conf", "\u53CD\u5411\u5339\u914D\uFF0C\u53BB\u6389\u6CE8\u91CA\u884C"],
      ["-A 3 -B 3 'error' app.log", "\u5E26\u524D\u540E\u4E09\u884C\u4E0A\u4E0B\u6587"],
      ["-c 'error' app.log", "\u53EA\u6570\u5339\u914D\u884C\u6570"],
      ['-E "a|b" file', "\u6269\u5C55\u6B63\u5219\uFF0C\u7528 | \u5E76\u5217"],
      ["-l 'keyword' *.log", "\u53EA\u5217\u6587\u4EF6\u540D"]
    ],
    sed: [
      ["-n '100,200p' app.log", "\u6253\u5370\u6307\u5B9A\u884C\u533A\u95F4"],
      ["-i.bak 's/old/new/g' file", "\u5C31\u5730\u66FF\u6362\u5E76\u7559\u4E00\u4EFD\u5907\u4EFD"],
      ["'/^$/d' file", "\u5220\u6389\u7A7A\u884C"],
      ["'/^#/d' file", "\u5220\u6389\u6CE8\u91CA\u884C"],
      ["'s/\\t/ /g' file", "\u628A\u5236\u8868\u7B26\u6362\u6210\u7A7A\u683C"]
    ],
    awk: [
      ["'{print $1}' file", "\u6253\u5370\u7B2C\u4E00\u5217"],
      ["-F: '{print $1}' /etc/passwd", "\u6307\u5B9A\u5206\u9694\u7B26"],
      ["'{print $NF}' file", "\u6253\u5370\u6700\u540E\u4E00\u5217"],
      ["'$3 > 100 {print $0}' file", "\u6309\u6761\u4EF6\u8FC7\u6EE4"],
      ["'{sum+=$5} END {print sum}' file", "\u628A\u7B2C\u4E94\u5217\u6C42\u548C"],
      ["'NR==10' file", "\u53EA\u770B\u7B2C 10 \u884C"]
    ],
    ps: [
      ["aux", "BSD \u98CE\u683C\u7684\u5168\u91CF\u8FDB\u7A0B"],
      ["-ef", "System V \u98CE\u683C\u7684\u5168\u91CF\u8FDB\u7A0B"],
      ["aux --sort=-%mem | head", "\u6309\u5185\u5B58\u6392\u5E8F"],
      ["-eo pid,ppid,etime,cmd", "\u53EA\u6311\u5173\u5FC3\u7684\u5217"],
      ["-ef | grep java", "\u6309\u5173\u952E\u5B57\u627E\u8FDB\u7A0B"]
    ],
    ls: [
      ["-alh", "\u957F\u5217\u8868\uFF0C\u5927\u5C0F\u597D\u8BFB"],
      ["-alh --time-style=long-iso", "\u65F6\u95F4\u683C\u5F0F\u89C4\u6574\u7684\u957F\u5217\u8868"],
      ["-lt", "\u6309\u4FEE\u6539\u65F6\u95F4\u6392\u5E8F"],
      ["-lhS", "\u6309\u5927\u5C0F\u6392\u5E8F"],
      ["-alh /var/log", "\u770B\u6307\u5B9A\u76EE\u5F55"]
    ],
    df: [
      ["-h", "\u4EBA\u7C7B\u53EF\u8BFB\u7684\u7528\u91CF"],
      ["-hT", "\u5E26\u6587\u4EF6\u7CFB\u7EDF\u7C7B\u578B"],
      ["-i", "inode \u7528\u91CF\uFF0C\u78C1\u76D8\u6CA1\u6EE1\u5374\u5199\u4E0D\u8FDB\u53BB\u65F6\u770B\u5B83"],
      ["-h /var", "\u53EA\u770B\u67D0\u4E2A\u76EE\u5F55\u6240\u5728\u7684\u5206\u533A"],
      ["--total", "\u672B\u5C3E\u7ED9\u4E00\u884C\u603B\u8BA1"]
    ],
    du: [
      ["-sh *", "\u5F53\u524D\u76EE\u5F55\u4E0B\u6BCF\u9879\u7684\u603B\u5360\u7528"],
      ["-sh .", "\u5F53\u524D\u76EE\u5F55\u603B\u5360\u7528"],
      ["-h --max-depth=1", "\u53EA\u770B\u4E00\u5C42"],
      ["-sh * | sort -rh | head", "\u5360\u7528\u6392\u884C\u524D\u51E0"]
    ],
    ss: [
      ["-tunlp", "\u76D1\u542C\u7684\u7AEF\u53E3\u4E0E\u5BF9\u5E94\u8FDB\u7A0B"],
      ["-s", "\u8FDE\u63A5\u6570\u603B\u89C8"],
      ["-tnp", "\u5DF2\u5EFA\u7ACB\u7684\u8FDE\u63A5\u4E0E\u8FDB\u7A0B"],
      ["-tan state established | wc -l", "\u7EDF\u8BA1\u5E76\u53D1\u8FDE\u63A5\u6570"],
      ["-tunlp | grep :80", "\u8C01\u5360\u4E86 80 \u7AEF\u53E3"]
    ],
    ip: [
      ["-br a", "\u6240\u6709\u7F51\u5361\u4E0E\u5730\u5740\uFF0C\u7B80\u6D01"],
      ["-s link", "\u7F51\u5361\u6536\u53D1\u4E0E\u9519\u8BEF\u7EDF\u8BA1"],
      ["route", "\u8DEF\u7531\u8868"],
      ["link", "\u94FE\u8DEF\u5C42\u72B6\u6001"],
      ["neigh", "ARP \u90BB\u5C45\u8868"]
    ],
    curl: [
      ["-I ", "\u53EA\u770B\u54CD\u5E94\u5934"],
      ['-L -s -o /dev/null -w "%{http_code} %{time_total}s\\n" ', "\u6D4B\u54CD\u5E94\u7801\u4E0E\u603B\u8017\u65F6"],
      ["-X POST -H 'Content-Type: application/json' -d '{}' ", "\u53D1\u4E00\u4E2A JSON POST"],
      ["-k ", "\u8DF3\u8FC7\u8BC1\u4E66\u6821\u9A8C\uFF0C\u81EA\u7B7E\u8BC1\u4E66\u8C03\u8BD5\u7528"],
      ["-O ", "\u4E0B\u8F7D\u5230\u5F53\u524D\u76EE\u5F55"],
      ["--resolve example.com:443:10.0.0.1 ", "\u4E0D\u6539 DNS\uFF0C\u76F4\u63A5\u6307\u5B9A\u89E3\u6790\u7ED3\u679C"]
    ],
    ssh: [
      ["-i ~/.ssh/id_rsa ", "\u6307\u5B9A\u79C1\u94A5"],
      ["-p 2222 ", "\u6307\u5B9A\u7AEF\u53E3"],
      ["-L 8080:127.0.0.1:80 ", "\u672C\u5730\u7AEF\u53E3\u8F6C\u53D1"],
      ["-N -f -L 3306:127.0.0.1:3306 ", "\u540E\u53F0\u5E38\u9A7B\u8F6C\u53D1"],
      ["-v ", "\u8C03\u8BD5\u65E5\u5FD7\uFF0C\u8FDE\u4E0D\u4E0A\u65F6\u770B\u5B83"],
      ["-o ConnectTimeout=5 -o BatchMode=yes ", "\u975E\u4EA4\u4E92\u63A2\u6D4B\u80FD\u4E0D\u80FD\u8FDE\u4E0A"]
    ],
    scp: [
      ["-r ./dir user@host:/data/", "\u9012\u5F52\u4E0A\u4F20\u76EE\u5F55"],
      ["user@host:/data/file ./", "\u4E0B\u8F7D\u5230\u5F53\u524D\u76EE\u5F55"],
      ["-P 2222 ", "\u6307\u5B9A\u7AEF\u53E3\uFF0C\u6CE8\u610F\u662F\u5927\u5199 P"],
      ["-C user@host:/big.tar.gz .", "\u4F20\u8F93\u65F6\u987A\u4FBF\u538B\u7F29"]
    ],
    rsync: [
      ["-avz --progress ./ user@host:/data/", "\u589E\u91CF\u540C\u6B65\u5E76\u663E\u793A\u8FDB\u5EA6"],
      ["-avz --delete ./ user@host:/data/", "\u955C\u50CF\u540C\u6B65\uFF0C\u5BF9\u7AEF\u591A\u4F59\u6587\u4EF6\u4F1A\u5220\u6389"],
      ["-avz --exclude=.git --exclude=node_modules ./ user@host:/data/", "\u6392\u9664\u76EE\u5F55\u540C\u6B65"],
      ["-avz --dry-run ./ user@host:/data/", "\u5148\u7A7A\u8DD1\u4E00\u904D\u770B\u4F1A\u52A8\u54EA\u4E9B\u6587\u4EF6"],
      ["-avz --bwlimit=2m ./ user@host:/data/", "\u9650\u901F 2MB/s"]
    ],
    dig: [
      ["+short example.com", "\u53EA\u8981\u89E3\u6790\u7ED3\u679C"],
      ["@8.8.8.8 example.com", "\u6307\u5B9A DNS \u670D\u52A1\u5668"],
      ["+trace example.com", "\u8DDF\u7740\u9012\u5F52\u770B\u6BCF\u4E00\u8DF3"],
      ["-x 8.8.8.8", "\u53CD\u67E5 PTR"],
      ["ANY example.com", "\u8981\u6240\u6709\u8BB0\u5F55\u7C7B\u578B"]
    ],
    lsof: [
      ["-i:80", "\u8C01\u5360\u7740 80 \u7AEF\u53E3"],
      ["-i -P -n", "\u6240\u6709\u7F51\u7EDC\u6587\u4EF6\u4E0E\u8FDB\u7A0B"],
      ["-p $(pgrep -f java | head -1)", "\u67D0\u4E2A\u8FDB\u7A0B\u6253\u5F00\u4E86\u54EA\u4E9B\u6587\u4EF6"],
      ["+L1", "\u5DF2\u5220\u9664\u4F46\u4ECD\u88AB\u5360\u7528\u7684\u6587\u4EF6"],
      ["-u root", "\u67D0\u4E2A\u7528\u6237\u6253\u5F00\u7684\u6587\u4EF6"],
      ["-c nginx", "\u67D0\u4E2A\u8FDB\u7A0B\u540D\u6253\u5F00\u7684\u6587\u4EF6"]
    ],
    tcpdump: [
      ["-i any -nn port 80 -c 20", "\u6293 20 \u4E2A\u5305"],
      ["-i eth0 -w cap.pcap", "\u5B58\u5230\u6587\u4EF6\u91CC\u6162\u6162\u770B"],
      ["-nn host 10.0.0.1", "\u53EA\u770B\u67D0\u53F0\u4E3B\u673A"],
      ["-nn -A port 80", "\u6309 ASCII \u663E\u793A\u5185\u5BB9"],
      ["-i any -nn icmp", "\u53EA\u770B ICMP"]
    ],
    nginx: [
      ["-t", "\u68C0\u67E5\u914D\u7F6E\u8BED\u6CD5"],
      ["-T", "\u6253\u5370\u751F\u6548\u7684\u5B8C\u6574\u914D\u7F6E"],
      ["-s reload", "\u5E73\u6ED1\u91CD\u8F7D"],
      ["-s stop", "\u505C\u6B62"],
      ["-V", "\u7F16\u8BD1\u53C2\u6570\uFF0C\u770B\u88C5\u4E86\u54EA\u4E9B\u6A21\u5757"]
    ],
    mysql: [
      ["-uroot -p", "\u7528 root \u8FDE\u63A5\uFF0C\u4F1A\u63D0\u793A\u8F93\u5BC6\u7801"],
      ["-uroot -p -e ", "\u76F4\u63A5\u6267\u884C\u4E00\u6761\u8BED\u53E5"],
      ["-h 10.0.0.1 -uroot -p", "\u8FDE\u8FDC\u7A0B\u5B9E\u4F8B"],
      ["-uroot -p db < backup.sql", "\u628A\u5907\u4EFD\u5BFC\u56DE\u5E93\u91CC\uFF0C\u5148\u5EFA\u597D\u5E93"],
      ['-uroot -p -e "show processlist"', "\u5F53\u524D\u8FDE\u63A5\u4E0E\u6B63\u5728\u6267\u884C\u7684\u8BED\u53E5"],
      ["-uroot -p --default-character-set=utf8mb4", "\u6307\u5B9A\u5B57\u7B26\u96C6\uFF0C\u907F\u514D\u4E2D\u6587\u4E71\u7801"]
    ],
    "redis-cli": [
      ["ping", "\u770B\u8FD8\u6D3B\u7740\u6CA1"],
      ["info", "\u5168\u90E8\u8FD0\u884C\u4FE1\u606F"],
      ["info memory", "\u5185\u5B58\u5360\u7528\u4E0E\u788E\u7247\u7387"],
      ["--bigkeys", "\u626B\u51FA\u5927 key\uFF0C\u522B\u5728\u9AD8\u5CF0\u671F\u8DD1"],
      ["dbsize", "\u5F53\u524D\u5E93\u6709\u591A\u5C11 key"],
      ["-h 10.0.0.1 -p 6379", "\u8FDE\u8FDC\u7A0B\u5B9E\u4F8B"],
      ["slowlog get 10", "\u6700\u8FD1 10 \u6761\u6162\u67E5\u8BE2"]
    ],
    npm: [
      ["run build", "\u8DD1\u6784\u5EFA\u811A\u672C"],
      ["run dev", "\u8D77\u5F00\u53D1\u670D\u52A1"],
      ["install", "\u6309 package.json \u88C5\u4F9D\u8D56"],
      ["ci", "\u4E25\u683C\u6309 lock \u6587\u4EF6\u5E72\u51C0\u5B89\u88C5"],
      ["ls -g --depth=0", "\u5168\u5C40\u88C5\u4E86\u4EC0\u4E48"],
      ["view react version", "\u67E5\u8FDC\u7AEF\u7684\u5305\u7248\u672C"]
    ],
    pm2: [
      ["list", "\u8FDB\u7A0B\u6E05\u5355\u4E0E\u91CD\u542F\u6B21\u6570"],
      ["logs --lines 200 ", "\u770B\u67D0\u4E2A\u5E94\u7528\u7684\u65E5\u5FD7"],
      ["restart all", "\u5168\u91CF\u91CD\u542F"],
      ["reload all", "\u96F6\u505C\u673A\u91CD\u8F7D"],
      ["monit", "\u5B9E\u65F6\u9762\u677F"],
      ["save", "\u5B58\u4E0B\u8FDB\u7A0B\u5217\u8868\uFF0C\u5F00\u673A\u81EA\u542F\u9760\u5B83"]
    ],
    supervisorctl: [
      ["status", "\u6240\u6709\u8FDB\u7A0B\u7684\u72B6\u6001"],
      ["restart all", "\u5168\u91CF\u91CD\u542F"],
      ["tail -f ", "\u8DDF\u8E2A\u67D0\u4E2A\u8FDB\u7A0B\u7684\u65E5\u5FD7"],
      ["update", "\u91CD\u8BFB\u914D\u7F6E\u5E76\u70ED\u52A0\u8F7D"],
      ["reread", "\u53EA\u91CD\u8BFB\u914D\u7F6E\uFF0C\u4E0D\u91CD\u542F"]
    ],
    "firewall-cmd": [
      ["--list-all", "\u5F53\u524D\u751F\u6548\u7684\u89C4\u5219"],
      ["--reload", "\u91CD\u8F7D\u914D\u7F6E"],
      ["--add-port=8080/tcp --permanent", "\u6C38\u4E45\u653E\u884C\u7AEF\u53E3\uFF0C\u8BB0\u5F97 reload"],
      ["--remove-port=8080/tcp --permanent", "\u64A4\u6389\u653E\u884C"],
      ["--add-service=https --permanent", "\u653E\u884C\u9884\u5B9A\u4E49\u670D\u52A1"]
    ]
  };
  function suggest(line, history, limit) {
    const prefix = line.trimStart();
    if (!prefix || limit <= 0) return [];
    const out = [];
    const seen = /* @__PURE__ */ new Set([prefix]);
    for (const cmd of [...history].reverse()) {
      if (out.length >= limit) break;
      if (seen.has(cmd) || !cmd.startsWith(prefix)) continue;
      seen.add(cmd);
      out.push({ cmd });
    }
    const space = prefix.indexOf(" ");
    if (space > 0) {
      const head = prefix.slice(0, space);
      for (const [sub, hint] of SUBCOMMANDS[head] ?? []) {
        if (out.length >= limit) break;
        const cmd = `${head} ${sub}`;
        if (seen.has(cmd) || !cmd.startsWith(prefix)) continue;
        seen.add(cmd);
        out.push({ cmd, hint });
      }
      return out;
    }
    for (const [cmd, hint] of COMMON) {
      if (out.length >= limit) break;
      if (seen.has(cmd) || !cmd.startsWith(prefix)) continue;
      seen.add(cmd);
      out.push({ cmd, hint });
    }
    return out;
  }

  // src/sessions.js
  var es = null;
  var seq = 0;
  var byTerm = /* @__PURE__ */ new Map();
  var orphans = /* @__PURE__ */ new Map();
  var toBase64 = (text) => {
    let bin = "";
    new TextEncoder().encode(text).forEach((c) => bin += String.fromCharCode(c));
    return btoa(bin);
  };
  function deliver(s, m) {
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
  function ensureEvents() {
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
  var altScreen = (s) => s.term?.buffer?.active?.type === "alternate";
  function refreshSuggestions(s) {
    const on = state.hintsOn && s.lineOk && s.status === "ready" && !altScreen(s);
    s.sugg = on && s.line ? suggest(s.line, s.history, 6) : [];
    s.suggIndex = 0;
    notify();
  }
  function trackInput(s, data) {
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
  function sendInput(s, data) {
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
  function acceptSuggestion(s, i = s.suggIndex) {
    const pick = s.sugg[i];
    if (!pick) return;
    sendInput(s, pick.cmd.startsWith(s.line) ? pick.cmd.slice(s.line.length) : "" + pick.cmd);
    s.line = pick.cmd;
    s.sugg = [];
    notify();
  }
  function makeTerminal(s) {
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
  function scheduleFit(s) {
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
  function attach(s, container) {
    if (!container) return;
    if (s.el.parentNode !== container) container.appendChild(s.el);
    if (!s.opened) {
      s.opened = true;
      s.term.open(s.el);
      s.ro = new ResizeObserver(() => scheduleFit(s));
    }
    if (s.container !== container) {
      s.container = container;
      s.ro.disconnect();
      s.ro.observe(container);
    }
    scheduleFit(s);
  }
  function focusSession(s) {
    requestAnimationFrame(() => s.term.focus());
  }
  async function connectSession(s, creds = {}) {
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
  async function openSession(conn) {
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
    s.term = makeTerminal(s);
    s.refCb = (el) => attach(s, el);
    state.sessions.push(s);
    state.active = s.id;
    state.searchOpen = false;
    notify();
    api("history", void 0, { connection: conn.id }).then((r) => s.history = r.commands || []).catch(() => {
    });
  }
  function reconnect(s) {
    if (s.termId) {
      byTerm.delete(s.termId);
      api("terminal/close", { id: s.termId }).catch(() => {
      });
      s.termId = null;
    }
    s.term.write("\r\n\x1B[33m[\u91CD\u65B0\u8FDE\u63A5\u2026]\x1B[0m\r\n");
    return connectSession(s);
  }
  function activate(s) {
    state.active = s.id;
    s.unread = false;
    state.searchOpen = false;
    notify();
    focusSession(s);
  }
  function dispose(s) {
    cancelAnimationFrame(s.raf);
    s.ro?.disconnect();
    try {
      s.term.dispose();
    } catch {
    }
    s.el.remove();
  }
  function closeSession(s) {
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
  function disposeAll() {
    for (const s of state.sessions) dispose(s);
    state.sessions.length = 0;
    byTerm.clear();
    orphans.clear();
    es?.close();
    es = null;
  }
  var activeSession = () => state.sessions.find((s) => s.id === state.active) || null;
  function applyTheme() {
    const theme = termTheme();
    for (const s of state.sessions) s.term.options.theme = theme;
  }
  async function reloadTree() {
    try {
      state.tree = await api("tree");
      state.loaded = true;
    } catch (e) {
      toast("\u52A0\u8F7D\u8FDE\u63A5\u5931\u8D25:" + e.message, "error");
    }
    notify();
  }

  // src/fmt.js
  function bytes(n) {
    n = Number(n) || 0;
    if (n < 1024) return `${Math.round(n)} B`;
    const u = ["KB", "MB", "GB", "TB", "PB"];
    let i = -1;
    do {
      n /= 1024;
      i++;
    } while (n >= 1024 && i < u.length - 1);
    return `${n >= 100 ? n.toFixed(0) : n.toFixed(1)} ${u[i]}`;
  }
  var rate = (n) => `${bytes(n)}/s`;
  function uptime(sec) {
    sec = Math.floor(Number(sec) || 0);
    const d = Math.floor(sec / 86400);
    const hh = Math.floor(sec % 86400 / 3600);
    const m = Math.floor(sec % 3600 / 60);
    return d ? `${d} \u5929 ${hh} \u5C0F\u65F6` : hh ? `${hh} \u5C0F\u65F6 ${m} \u5206` : `${m} \u5206`;
  }
  var level = (pct2) => pct2 >= 90 ? "err" : pct2 >= 75 ? "warn" : "";

  // src/popup-pos.js
  function popupPosition({ x, y, width, height, viewWidth, viewHeight, gap = 2, margin = 4 }) {
    const maxLeft = viewWidth - margin - width;
    const left = Math.max(margin, Math.min(x, maxLeft));
    const below = y + gap;
    const above = below + height > viewHeight - margin;
    const top = Math.max(margin, above ? y - height - gap * 2 : below);
    return { left, top, above };
  }

  // src/style.css
  var style_default = ".sx-root{\n  --sx-bg:var(--dsw-alias-bg-layer-1,#1e1e1e);--sx-bg2:var(--dsw-alias-bg-layer-2,#252526);\n  --sx-side:var(--dsw-specific-sidebar-fill,var(--dsw-alias-bg-layer-2,#252526));\n  --sx-pop:var(--dsw-alias-bg-overlay,#2b2b2e);\n  --sx-b1:var(--dsw-alias-border-l1,#3a3a3a);--sx-b2:var(--dsw-alias-border-l2,#555);\n  --sx-fg:var(--dsw-alias-label-primary,#d4d4d4);--sx-fg2:var(--dsw-alias-label-secondary,#8a8a8a);\n  --sx-accent:var(--dsw-alias-brand-primary,#4aa3ff);\n  --sx-ok:var(--dsw-alias-state-success-primary,#4ec9b0);--sx-warn:var(--dsw-alias-state-warn-primary,#dcdcaa);\n  --sx-err:var(--dsw-alias-state-error-primary,#f48771);\n  --sx-hover:color-mix(in srgb,var(--sx-fg) 8%,transparent);\n  --sx-sel:color-mix(in srgb,var(--sx-accent) 22%,transparent);\n  display:flex;height:100%;width:100%;background:var(--sx-bg);color:var(--sx-fg);font-size:13px;overflow:hidden;position:relative}\n.sx-root *{box-sizing:border-box}\n.sx-root button{font:inherit;color:inherit}\n.sx-btn{padding:4px 10px;border:1px solid var(--sx-b2);border-radius:5px;background:transparent;cursor:pointer;font-size:12px;white-space:nowrap}\n.sx-btn:hover:not(:disabled){background:var(--sx-hover)}\n.sx-btn:disabled{opacity:.45;cursor:not-allowed}\n.sx-btn.pri{background:var(--sx-accent);border-color:transparent;color:#fff}\n.sx-btn.pri:hover:not(:disabled){filter:brightness(1.1);background:var(--sx-accent)}\n.sx-btn.dng{background:var(--sx-err);border-color:transparent;color:#fff}\n.sx-btn.sm{padding:2px 7px}\n.sx-input{width:100%;padding:6px 9px;border:1px solid var(--sx-b2);border-radius:5px;background:var(--sx-bg);color:var(--sx-fg);font:inherit}\n.sx-input:focus{outline:none;border-color:var(--sx-accent)}\n/* \u5DE6\u4FA7\u8FDE\u63A5\u6811 */\n.sx-side{width:272px;flex-shrink:0;display:flex;flex-direction:column;background:var(--sx-side);border-right:1px solid var(--sx-b1);transition:width .15s}\n.sx-side.collapsed{width:28px;align-items:center;padding-top:8px}\n.sx-collapse{flex:0 0 auto;padding:2px 6px;line-height:1.2}\n.sx-side-head{padding:10px;display:flex;flex-direction:column;gap:8px;border-bottom:1px solid var(--sx-b1)}\n.sx-side-top{display:flex;gap:6px;align-items:center}\n.sx-side-btns{display:flex;gap:6px}\n.sx-side-btns .sx-btn{flex:1}\n.sx-tree{flex:1;overflow-y:auto;padding:4px 0}\n.sx-tree.drop{background:var(--sx-sel)}\n.sx-row{display:flex;align-items:center;gap:6px;padding:5px 10px;cursor:pointer;user-select:none;min-width:0}\n.sx-row:hover{background:var(--sx-hover)}\n.sx-row.sel{background:var(--sx-sel)}\n.sx-row.drop{outline:1px dashed var(--sx-accent);outline-offset:-2px}\n.sx-chev{width:12px;color:var(--sx-fg2);font-size:10px;flex-shrink:0;text-align:center}\n.sx-dot{width:7px;height:7px;border-radius:50%;background:var(--sx-b2);flex-shrink:0}\n.sx-dot.ok{background:var(--sx-ok)}.sx-dot.warn{background:var(--sx-warn)}.sx-dot.err{background:var(--sx-err)}\n.sx-row-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0;max-width:60%}\n.sx-row-sub{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--sx-fg2);font-size:11px;min-width:0}\n.sx-row.folder .sx-row-name{font-weight:600;max-width:none;flex:1}\n.sx-count{color:var(--sx-fg2);font-size:11px}\n.sx-hint{padding:18px 14px;color:var(--sx-fg2);line-height:1.7;text-align:center}\n/* \u53F3\u4FA7 */\n.sx-main{flex:1;min-width:0;display:flex;flex-direction:column}\n.sx-tabs{display:flex;gap:2px;padding:6px 8px 0;background:var(--sx-bg2);border-bottom:1px solid var(--sx-b1);overflow-x:auto;min-height:34px}\n.sx-tab{display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:6px 6px 0 0;cursor:pointer;white-space:nowrap;color:var(--sx-fg2);max-width:220px}\n.sx-tab:hover{background:var(--sx-hover)}\n.sx-tab.on{background:var(--sx-bg);color:var(--sx-fg)}\n.sx-tab-name{overflow:hidden;text-overflow:ellipsis}\n.sx-tab-x{opacity:.55;font-size:15px;line-height:1;padding:0 2px;border-radius:3px}\n.sx-tab-x:hover{opacity:1;background:var(--sx-hover)}\n.sx-unread{width:6px;height:6px;border-radius:50%;background:var(--sx-accent)}\n.sx-toolbar{display:flex;align-items:center;gap:6px;padding:6px 10px;border-bottom:1px solid var(--sx-b1);background:var(--sx-bg)}\n.sx-tb{padding:4px 11px;border:1px solid transparent;border-radius:5px;background:transparent;cursor:pointer;font-size:12px}\n.sx-tb:hover:not(:disabled){background:var(--sx-hover)}\n.sx-tb.on{background:var(--sx-sel);border-color:var(--sx-accent)}\n.sx-tb:disabled{opacity:.4;cursor:not-allowed}\n.sx-tb-status{margin-left:auto;color:var(--sx-fg2);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.sx-body{flex:1;min-height:0;display:flex}\n.sx-termwrap{flex:1;min-width:0;position:relative;background:var(--sx-bg)}\n.sx-view{position:absolute;inset:0}\n.sx-view:not(.active){display:none}\n.sx-host{position:absolute;inset:0}\n.sx-termel{width:100%;height:100%}\n.sx-host .xterm{padding:6px 0 0 10px;height:100%}\n.sx-msg{position:absolute;inset:0;display:flex;flex-direction:column;gap:12px;align-items:center;justify-content:center;background:var(--sx-bg);color:var(--sx-fg2);text-align:center;padding:24px}\n.sx-msg.err{color:var(--sx-err)}\n.sx-closed{position:absolute;left:0;right:0;bottom:0;display:flex;gap:10px;align-items:center;justify-content:center;padding:8px;background:var(--sx-bg2);border-top:1px solid var(--sx-b1);color:var(--sx-warn)}\n.sx-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--sx-fg2)}\n.sx-searchbar{position:absolute;top:8px;right:16px;z-index:5;display:flex;gap:4px;align-items:center;padding:6px;background:var(--sx-pop);border:1px solid var(--sx-b2);border-radius:7px;box-shadow:0 4px 14px rgba(0,0,0,.3)}\n.sx-searchbar .sx-input{width:200px;padding:3px 8px}\n.sx-suggest{position:absolute;z-index:5;min-width:320px;max-width:min(640px,90%);background:var(--sx-pop);border:1px solid var(--sx-b2);border-radius:4px;padding:4px;box-shadow:0 4px 14px rgba(0,0,0,.3)}\n.sx-sug{display:flex;gap:14px;justify-content:space-between;padding:4px 9px;border-radius:4px;cursor:pointer}\n.sx-sug.on,.sx-sug:hover{background:var(--sx-sel)}\n.sx-sug-cmd{font-family:'JetBrains Mono','Cascadia Mono',Consolas,monospace;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.sx-sug-hint{color:var(--sx-fg2);font-size:11px;white-space:nowrap}\n.sx-sug-foot{padding:4px 9px 2px;color:var(--sx-fg2);font-size:11px;border-top:1px solid var(--sx-b1);margin-top:3px}\n/* \u62BD\u5C49 */\n.sx-drawer{width:380px;flex-shrink:0;display:flex;flex-direction:column;border-left:1px solid var(--sx-b1);background:var(--sx-bg2);min-width:0}\n.sx-dhead{display:flex;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid var(--sx-b1)}\n.sx-dtitle{font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.sx-dbody{flex:1;overflow-y:auto;min-height:0}\n.sx-path{display:flex;gap:4px;padding:8px 10px;border-bottom:1px solid var(--sx-b1)}\n.sx-frow{display:flex;align-items:center;gap:8px;padding:5px 10px;cursor:default}\n.sx-frow:hover{background:var(--sx-hover)}\n.sx-frow.dir{cursor:pointer}\n.sx-fname{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.sx-fmeta{color:var(--sx-fg2);font-size:11px;white-space:nowrap}\n.sx-fact{display:none;gap:3px}\n.sx-frow:hover .sx-fact{display:flex}\n.sx-frow:hover .sx-fmeta{display:none}\n.sx-dropzone{outline:2px dashed var(--sx-accent);outline-offset:-4px}\n.sx-sec{padding:10px 12px;border-bottom:1px solid var(--sx-b1)}\n.sx-sec-t{font-weight:600;margin-bottom:6px;display:flex;justify-content:space-between}\n.sx-kv{display:flex;justify-content:space-between;gap:10px;padding:2px 0;font-size:12px}\n.sx-kv span:first-child{color:var(--sx-fg2);flex-shrink:0}\n.sx-kv span:last-child{text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.sx-bar{height:6px;border-radius:3px;background:var(--sx-hover);overflow:hidden;margin:4px 0}\n.sx-bar i{display:block;height:100%;background:var(--sx-accent);transition:width .4s}\n.sx-bar i.warn{background:var(--sx-warn)}.sx-bar i.err{background:var(--sx-err)}\n.sx-proc{display:grid;grid-template-columns:48px 1fr 46px 56px;gap:6px;font-size:11px;padding:2px 0}\n.sx-proc span:nth-child(n+3){text-align:right}\n.sx-proc span:nth-child(2){overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n/* \u5BF9\u8BDD\u6846 */\n.sx-overlay{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5)}\n.sx-dialog{width:440px;max-width:92vw;max-height:88vh;display:flex;flex-direction:column;background:var(--sx-pop);color:var(--sx-fg);border:1px solid var(--sx-b2);border-radius:10px;box-shadow:0 10px 36px rgba(0,0,0,.45);padding:18px}\n.sx-dialog.wide{width:640px}\n.sx-dtitle2{font-size:15px;font-weight:600;margin-bottom:12px}\n.sx-dmsg{margin-bottom:6px;line-height:1.6;word-break:break-word}\n.sx-ddetail{color:var(--sx-fg2);font-size:12px;line-height:1.6;margin-bottom:6px}\n.sx-dbtns{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}\n.sx-form{display:flex;flex-direction:column;gap:10px;overflow-y:auto;padding:2px}\n.sx-field label{display:block;margin-bottom:3px;color:var(--sx-fg2);font-size:12px}\n.sx-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}\n.sx-two:has(> :only-child){grid-template-columns:1fr}\n.sx-check{display:flex;align-items:center;gap:6px;margin-top:8px;font-size:12px;color:var(--sx-fg2)}\n.sx-imp-tabs{display:flex;gap:6px;margin-bottom:10px}\n.sx-imp-list{overflow-y:auto;border:1px solid var(--sx-b1);border-radius:6px;min-height:120px;max-height:46vh}\n.sx-imp-row{display:flex;align-items:center;gap:8px;padding:5px 10px;border-bottom:1px solid var(--sx-b1)}\n.sx-imp-row.dup{opacity:.5}\n.sx-imp-row:last-child{border-bottom:0}\n/* \u83DC\u5355\u4E0E\u63D0\u793A */\n.sx-menu{position:fixed;z-index:1100;min-width:140px;padding:4px;background:var(--sx-pop);color:var(--sx-fg);border:1px solid var(--sx-b2);border-radius:7px;box-shadow:0 6px 20px rgba(0,0,0,.4)}\n.sx-mi{padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px}\n.sx-mi:hover{background:var(--sx-sel)}\n.sx-mi.dng{color:var(--sx-err)}\n.sx-msep{height:1px;background:var(--sx-b1);margin:4px 2px}\n.sx-input.sm{padding:3px 7px;font-size:12px;margin-bottom:2px}\n.sx-sub{color:var(--sx-fg2);font-size:11px}\n.sx-info{display:flex;flex-direction:column;gap:6px;overflow-y:auto;font-size:12px;line-height:1.6;color:var(--sx-fg2);word-break:break-all}\n.sx-toast{position:fixed;right:18px;bottom:18px;z-index:1200;max-width:380px;padding:10px 14px;background:var(--sx-pop);color:var(--sx-fg);border:1px solid var(--sx-b2);border-left:3px solid var(--sx-accent);border-radius:6px;box-shadow:0 4px 14px rgba(0,0,0,.35);word-break:break-word}\n.sx-toast.error{border-left-color:var(--sx-err)}.sx-toast.success{border-left-color:var(--sx-ok)}\n";

  // src/entry.jsx
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
  function ConnectionTree() {
    const st = useStore();
    const [drag, setDrag] = react_default.useState(null);
    const [dropId, setDropId] = react_default.useState(void 0);
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
        h("button", { className: "sx-btn sm sx-collapse", title: "\u5C55\u5F00\u8FDE\u63A5\u680F", onClick: toggleSidebar }, "\u25B6")
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
            placeholder: "\u641C\u7D22\u540D\u79F0 / \u5730\u5740 / \u7528\u6237\u2026",
            value: st.query,
            onInput: (e) => (state.query = e.target.value, notify())
          }),
          h("button", { className: "sx-btn sm sx-collapse", title: "\u6536\u8D77\u8FDE\u63A5\u680F", onClick: toggleSidebar }, "\u25C0")
        ),
        h(
          "div",
          { className: "sx-side-btns" },
          h("button", { className: "sx-btn", onClick: async () => await editConnection(null, null) && reloadTree() }, "+ \u65B0\u5EFA"),
          h("button", { className: "sx-btn", onClick: async () => await importConnections() && reloadTree() }, "\u5BFC\u5165")
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
    return h(
      "div",
      { className: "sx-toolbar" },
      h("button", { className: `sx-tb ${st.drawer === "files" ? "on" : ""}`, disabled: !ok2, onClick: () => drawer("files") }, "\u6587\u4EF6"),
      h("button", { className: `sx-tb ${st.drawer === "monitor" ? "on" : ""}`, disabled: !ok2, onClick: () => drawer("monitor") }, "\u76D1\u63A7"),
      h("button", { className: `sx-tb ${st.searchOpen ? "on" : ""}`, disabled: !ok2, onClick: () => (state.searchOpen = !st.searchOpen, notify()) }, "\u67E5\u627E"),
      h("button", { className: "sx-tb", disabled: !s, onClick: () => s.term.clear() }, "\u6E05\u5C4F"),
      h("button", { className: `sx-tb ${st.hintsOn ? "on" : ""}`, title: "\u8F93\u5165\u65F6\u663E\u793A\u547D\u4EE4\u63D0\u793A", onClick: () => setHintsOn(!st.hintsOn) }, "\u547D\u4EE4\u63D0\u793A"),
      s && h("span", { className: "sx-tb-status" }, s.status === "ready" ? show(st.tree.connections.find((c) => c.id === s.connId) || {}) : "")
    );
  }
  function SearchBar() {
    const [q, setQ] = react_default.useState("");
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
    const ref = react_default.useRef(null);
    const [pos, setPos] = react_default.useState(null);
    const useLayout = react_default.useLayoutEffect || react_default.useEffect;
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
      // 每个会话的容器始终存在:连接要等容器量出尺寸后才发起
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
    const [dir, setDir] = react_default.useState({ path: "", entries: [] });
    const [busy, setBusy] = react_default.useState(false);
    const [over, setOver] = react_default.useState(false);
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
    react_default.useEffect(() => {
      load2(".");
    }, [cid]);
    const join = (name) => dir.path === "/" ? "/" + name : dir.path + "/" + name;
    const up = () => load2(dir.path.replace(/\/[^/]*$/, "") || "/");
    const send = async (files) => {
      for (const f of files) {
        try {
          await upload({ connection: cid, path: join(f.name) }, f);
          toast(`\u5DF2\u4E0A\u4F20 ${f.name}`, "success");
        } catch (e) {
          fail(e);
        }
      }
      load2(dir.path);
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
        busy && !dir.entries.length ? h("div", { className: "sx-hint" }, "\u52A0\u8F7D\u4E2D\u2026") : !dir.entries.length ? h("div", { className: "sx-hint" }, "\u7A7A\u76EE\u5F55(\u53EF\u62D6\u6587\u4EF6\u5230\u8FD9\u91CC\u4E0A\u4F20)") : dir.entries.map(
          (f) => h(
            "div",
            { key: f.name, className: `sx-frow ${f.isDir ? "dir" : ""}`, onClick: f.isDir ? () => load2(join(f.name)) : void 0 },
            h("span", null, f.isDir ? "\u{1F4C1}" : "\u{1F4C4}"),
            h("span", { className: "sx-fname", title: f.name }, f.name),
            h("span", { className: "sx-fmeta" }, f.isDir ? "" : bytes(f.size)),
            h(
              "span",
              { className: "sx-fact" },
              !f.isDir && h("button", { className: "sx-btn sm", onClick: (e) => (e.stopPropagation(), download({ connection: cid, path: join(f.name) })) }, "\u4E0B\u8F7D"),
              h("button", { className: "sx-btn sm", onClick: async (e) => {
                e.stopPropagation();
                const to = await promptText("\u91CD\u547D\u540D", f.name);
                to && to !== f.name && act(() => api("files/rename", { connection: cid, from: join(f.name), to: join(to) }));
              } }, "\u6539\u540D"),
              h("button", { className: "sx-btn sm dng", onClick: async (e) => {
                e.stopPropagation();
                const ok2 = await confirmBox(`\u5220\u9664\u201C${f.name}\u201D?`, f.isDir ? "\u76EE\u5F55\u91CC\u7684\u5168\u90E8\u5185\u5BB9\u90FD\u4F1A\u88AB\u5220\u9664,\u65E0\u6CD5\u6062\u590D\u3002" : "\u5220\u9664\u540E\u65E0\u6CD5\u6062\u590D\u3002", "\u5220\u9664");
                ok2 && act(() => api("files/delete", { connection: cid, path: join(f.name), dir: f.isDir }));
              } }, "\u5220\u9664")
            )
          )
        )
      )
    );
  }
  var Bar = ({ value }) => h("div", { className: "sx-bar" }, h("i", { className: level(value), style: { width: `${value}%` } }));
  var KV = (k, v) => h("div", { className: "sx-kv" }, h("span", null, k), h("span", { title: String(v) }, v));
  function MonitorDrawer() {
    const s = activeSession();
    const cid = s?.connId;
    const [m, setM] = react_default.useState(null);
    const [err, setErr] = react_default.useState("");
    react_default.useEffect(() => {
      if (!cid) return;
      let stop = false;
      let timer;
      setM(null);
      const tick = async () => {
        try {
          const r = await api("monitor", { connection: cid });
          if (!stop) setM(r), setErr("");
        } catch (e) {
          if (!stop) setErr(e.message);
        }
        if (!stop) timer = setTimeout(tick, 2e3);
      };
      tick();
      return () => (stop = true, clearTimeout(timer));
    }, [cid]);
    const nets = m ? m.net.filter((n) => n.name !== "lo").sort((a, b) => b.rx + b.tx - (a.rx + a.tx)).slice(0, 4) : [];
    const memPct = m ? pct(m.memUsed, m.memTotal) : 0;
    return h(
      "div",
      { className: "sx-drawer" },
      h(
        "div",
        { className: "sx-dhead" },
        h("span", { className: "sx-dtitle" }, m?.info?.hostname ? `\u76D1\u63A7 \xB7 ${m.info.hostname}` : "\u76D1\u63A7"),
        h("button", { className: "sx-btn sm", onClick: () => (state.drawer = null, notify()) }, "\xD7")
      ),
      h(
        "div",
        { className: "sx-dbody" },
        !m ? h("div", { className: err ? "sx-hint" : "sx-hint" }, err || "\u8BFB\u53D6\u4E2D\u2026") : h(
          Fragment,
          null,
          err && h("div", { className: "sx-sec", style: { color: "var(--sx-err)" } }, err),
          h(
            "div",
            { className: "sx-sec" },
            h("div", { className: "sx-sec-t" }, h("span", null, "CPU"), h("span", null, `${m.cpu.toFixed(1)}%`)),
            h(Bar, { value: Math.round(m.cpu) }),
            KV("\u6838\u5FC3 / \u8D1F\u8F7D", `${m.cpuCores} \u6838 \xB7 ${m.load.map((x) => x.toFixed(2)).join(" / ")}`),
            m.info.cpuModel && KV("\u578B\u53F7", m.info.cpuModel.trim())
          ),
          h(
            "div",
            { className: "sx-sec" },
            h("div", { className: "sx-sec-t" }, h("span", null, "\u5185\u5B58"), h("span", null, `${memPct}%`)),
            h(Bar, { value: memPct }),
            KV("\u5DF2\u7528 / \u603B\u91CF", `${bytes(m.memUsed)} / ${bytes(m.memTotal)}`),
            m.swapTotal > 0 && KV("\u4EA4\u6362\u5206\u533A", `${bytes(m.swapUsed)} / ${bytes(m.swapTotal)}`)
          ),
          m.disk.length > 0 && h(
            "div",
            { className: "sx-sec" },
            h("div", { className: "sx-sec-t" }, h("span", null, "\u78C1\u76D8")),
            m.disk.slice(0, 8).map((d) => h(
              "div",
              { key: d.mount },
              KV(d.mount, `${bytes(d.used)} / ${bytes(d.size)} (${pct(d.used, d.size)}%)`),
              h(Bar, { value: pct(d.used, d.size) })
            ))
          ),
          h(
            "div",
            { className: "sx-sec" },
            h("div", { className: "sx-sec-t" }, h("span", null, "\u7F51\u7EDC"), h("span", null, `\u2193 ${rate(m.netDown)}  \u2191 ${rate(m.netUp)}`)),
            nets.map((n) => KV(n.name, `\u2193 ${rate(n.rx)}  \u2191 ${rate(n.tx)}`))
          ),
          m.gpu.length > 0 && h(
            "div",
            { className: "sx-sec" },
            h("div", { className: "sx-sec-t" }, h("span", null, "GPU")),
            m.gpu.map((g, i) => h(
              "div",
              { key: i },
              KV(g.name, `${g.util}% \xB7 ${g.temp}\u2103`),
              h(Bar, { value: Math.round(g.util) }),
              KV("\u663E\u5B58", `${bytes(g.memUsed)} / ${bytes(g.memTotal)}`)
            ))
          ),
          m.proc.length > 0 && h(
            "div",
            { className: "sx-sec" },
            h("div", { className: "sx-sec-t" }, h("span", null, "\u8FDB\u7A0B(\u6309 CPU)")),
            h("div", { className: "sx-proc", style: { color: "var(--sx-fg2)" } }, h("span", null, "PID"), h("span", null, "\u547D\u4EE4"), h("span", null, "CPU"), h("span", null, "\u5185\u5B58")),
            m.proc.map((p) => h(
              "div",
              { key: p.pid, className: "sx-proc" },
              h("span", null, p.pid),
              h("span", { title: p.cmd }, p.name),
              h("span", null, `${p.cpu.toFixed(1)}%`),
              h("span", null, bytes(p.rss))
            ))
          ),
          h(
            "div",
            { className: "sx-sec" },
            KV("\u7CFB\u7EDF", m.info.os || "\u2014"),
            KV("\u5185\u6838", `${m.info.kernel} ${m.info.arch}`),
            KV("\u5DF2\u8FD0\u884C", uptime(m.uptime))
          )
        )
      )
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
    const [v, setV] = react_default.useState(d.value);
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
    const [v, setV] = react_default.useState("");
    const [keep, setKeep] = react_default.useState(false);
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
    const [f, setF] = react_default.useState({
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
    const [ifaces, setIfaces] = react_default.useState([]);
    react_default.useEffect(() => {
      let stop = false;
      api("net/interfaces").then((r) => !stop && setIfaces(r.interfaces || [])).catch(() => {
      });
      return () => stop = true;
    }, []);
    const set = (k) => (e) => setF({ ...f, [k]: k === "port" ? Number(e.target.value) || 22 : e.target.value });
    const [busy, setBusy] = react_default.useState(false);
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
        f.authType === "key" && field("\u79C1\u94A5\u6587\u4EF6\u8DEF\u5F84", h("input", { className: "sx-input", value: f.privateKeyPath, placeholder: "C:\\Users\\\u4F60\\.ssh\\id_ed25519", onInput: set("privateKeyPath") })),
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
    const [src, setSrc] = react_default.useState("ssh-config");
    const [items, setItems] = react_default.useState(null);
    const [sel, setSel] = react_default.useState(/* @__PURE__ */ new Set());
    const [err, setErr] = react_default.useState("");
    react_default.useEffect(() => {
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
    const [v, setV] = react_default.useState("");
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
    const [v, setV] = react_default.useState("");
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
    return h(
      Shell,
      { onClose: () => closeDialog(true) },
      h("div", { className: "sx-dtitle2" }, d.title),
      d.note && h("div", { className: "sx-ddetail" }, d.note),
      d.lines?.length && h("div", { className: "sx-info" }, d.lines.map((l, i) => h("div", { key: i }, l))),
      h("div", { className: "sx-dbtns" }, h("button", { className: "sx-btn pri", autoFocus: true, onClick: () => closeDialog(true) }, "\u597D"))
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
  function exportDialog({ scope, id, name }) {
    return secretDialog(
      `\u5BFC\u51FA\u300C${name}\u300D`,
      "\u53EF\u4EE5\u8BBE\u4E00\u4E2A\u53E3\u4EE4\u628A\u5BC6\u7801\u4E00\u8D77\u5BFC\u51FA(\u79C1\u94A5\u603B\u662F\u5185\u8054\u5728\u6587\u4EF6\u91CC,\u4E0D\u53D7\u53E3\u4EE4\u5F71\u54CD);\u7559\u7A7A\u5219\u5BFC\u51FA\u4E0D\u542B\u5BC6\u7801,\u4EA4\u7ED9\u5BF9\u9762\u91CD\u8F93\u3002",
      (passphrase) => {
        if (!passphrase) {
          window.open(url("export", { scope, id, passphrase: "" }), "_blank");
        } else {
          const form = document.createElement("form");
          form.method = "POST";
          form.action = url("export");
          form.target = "_blank";
          form.style.display = "none";
          const add = (n, v) => {
            const i = document.createElement("input");
            i.type = "hidden";
            i.name = n;
            i.value = v;
            form.append(i);
          };
          add("scope", scope);
          if (id) add("id", id);
          add("passphrase", passphrase);
          document.body.append(form);
          form.submit();
          form.remove();
        }
        toast("\u5DF2\u5F00\u59CB\u4E0B\u8F7D\u5BFC\u51FA\u6587\u4EF6", "success");
        return true;
      }
    );
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
    const path = await fileDialog("\u5BFC\u5165\u8FDE\u63A5\u6587\u4EF6\u2026", "\u4F8B\u5982 D:\\\u5907\u4EFD\\liteshell-backup.json", "\u652F\u6301 LiteShell \u5907\u4EFD(.json)\u3001FinalShell \u7684\u8FDE\u63A5\u914D\u7F6E(\u5355\u4E2A\u6587\u4EF6\u6216\u5BFC\u51FA\u76EE\u5F55)\u3002\u53EA\u8BFB\u53D6\u540D\u79F0\u3001\u5730\u5740\u548C\u7528\u6237,\u5BC6\u7801\u80FD\u89E3\u5F00\u7684\u624D\u4F1A\u5E26\u8FC7\u6765\u3002");
    if (!path) return;
    const r = await api("import/file", { path: expandPath(path), folderId: folderId || null });
    await reloadTree();
    return resultDialog("\u5BFC\u5165\u7ED3\u679C", r);
  }
  function ContextMenu() {
    const st = useStore();
    const m = st.menu;
    react_default.useEffect(() => {
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
        item("\u65B0\u5EFA\u8FDE\u63A5", async () => await editConnection(null, null) && reloadTree()),
        item("\u65B0\u5EFA\u6587\u4EF6\u5939", newFolder(null)),
        sep("s1"),
        item("\u5BFC\u5165\u8FDE\u63A5\u6587\u4EF6\u2026", () => importFromFile(null))
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
    react_default.useEffect(() => {
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
          st.drawer === "monitor" && st.sessions.length > 0 && h(MonitorDrawer)
        )
      ),
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
    id: "vyra-ssh-terminal",
    factory(require2) {
      setReact(require2("react"));
      return {
        inject: ["slots"],
        apply(ctx) {
          ctx.effect(() => {
            const style = document.createElement("style");
            style.textContent = style_default;
            document.head.append(style);
            return () => style.remove();
          }, "SSH terminal styles");
          ctx.effect(() => watchTheme(applyTheme), "SSH terminal theme");
          ctx.effect(() => () => disposeAll(), "SSH terminal sessions");
          for (const [slot, options, view] of [
            ["main", { key: "ssh-terminal", inject: () => ({}) }, App],
            ["sidebar.panellist", { id: "ssh-terminal", order: 12, label: "SSH" }, Icon]
          ]) ctx.slots.inject(slot, () => ctx.slots.register({ name: slot, ...options }, view));
        }
      };
    }
  });
})();
