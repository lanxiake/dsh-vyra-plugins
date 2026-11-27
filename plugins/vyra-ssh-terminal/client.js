"use strict";
(() => {
  // src/react.js
  var KEY = "__dshSshTerminalReact";
  function setReact(react) {
    globalThis[KEY] = react;
  }

  // src/jsx-shim.js
  var h = (...args) => globalThis.__dshSshTerminalReact.createElement(...args);
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
    const [, set] = globalThis.__dshSshTerminalReact.useState(0);
    globalThis.__dshSshTerminalReact.useEffect(() => subscribe(() => set((v) => v + 1)), []);
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
  var confirmBox = (message, detail = "", okText = "确定") => openDialog({ type: "confirm", message, detail, okText });
  var promptText = (title, value = "", placeholder = "") => openDialog({ type: "prompt", title, value, placeholder });
  var editConnection = (conn, folderId) => openDialog({ type: "connection", conn, folderId });
  var importConnections = () => openDialog({ type: "import" });
  var secretDialog = (title, note, confirm = "确定") => openDialog({ type: "secret-input", title, note, confirm });
  var fileDialog = (title, placeholder = "", note = "") => openDialog({ type: "file", title, placeholder, note });
  var infoDialog = (title, note, lines2 = [], buttons = null) => openDialog({ type: "info", title, note, lines: lines2, buttons });
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
      throw new ApiError(
        `服务端没有返回 JSON(HTTP ${res.status}),插件的后端可能没有加载,请重启 DSH 后再试`,
        res.status
      );
    }
    if (!res.ok) throw new ApiError(value.error || `请求失败(HTTP ${res.status})`, res.status, value.code);
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
  async function upload(query, file, onProgress) {
    if (!onProgress) return parse(await fetch(url("files/upload", query), { method: "POST", body: file }));
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url("files/upload", query));
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress({ loaded: e.loaded, total: e.total });
      };
      xhr.onload = () => {
        let value;
        try {
          value = JSON.parse(xhr.responseText);
        } catch {
          reject(new ApiError(`服务端没有返回 JSON(HTTP ${xhr.status})`, xhr.status));
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300) resolve(value);
        else reject(new ApiError(value.error || `上传失败(HTTP ${xhr.status})`, xhr.status, value.code));
      };
      xhr.onerror = () => reject(new ApiError("上传中断：连接被重置", 0));
      xhr.onabort = () => reject(new ApiError("已取消上传", 0, "aborted"));
      xhr.send(file);
    });
  }
  async function download(query, onProgress) {
    const res = await fetch(url("files/download", query), { cache: "no-store" });
    if (!res.ok) {
      let message = `下载失败(HTTP ${res.status})`;
      try {
        message = (await res.json()).error || message;
      } catch {
      }
      throw new ApiError(message, res.status);
    }
    const total = Number(res.headers.get("content-length")) || 0;
    let blob;
    if (onProgress && res.body && typeof res.body.getReader === "function") {
      const reader = res.body.getReader();
      const chunks = [];
      let loaded = 0;
      for (; ; ) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.length;
        onProgress({ loaded, total });
      }
      blob = new Blob(chunks);
    } else {
      blob = await res.blob();
    }
    const name = filenameOf(res.headers.get("content-disposition")) || String(query?.name || "download");
    saveBlob(blob, name);
    return { name, size: blob.size };
  }
  function filenameOf(header) {
    if (!header) return "";
    const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
    if (star) {
      try {
        return decodeURIComponent(star[1].trim());
      } catch {
        return star[1].trim();
      }
    }
    const plain = /filename="?([^";]+)"?/i.exec(header);
    return plain ? plain[1].trim() : "";
  }
  function saveBlob(blob, name) {
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    a.rel = "noopener";
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 6e4);
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
        s.onerror = () => rej(new Error("加载 " + src + " 失败"));
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
    const bg = rootColor("--sx-bg", "#ffffff");
    const fg = rootColor("--sx-fg", "#1f2328");
    const accent = rootColor("--sx-accent", "#3b82f6");
    return {
      background: css(bg),
      foreground: css(fg),
      cursor: css(accent),
      cursorAccent: css(bg),
      selectionBackground: css(accent, 0.35),
      // 调色板按背景亮度二选一：浅底配深色 ANSI，深底配亮色 ANSI
      ...luminance(bg) < 0.5 ? DARK : LIGHT
    };
  }
  function rootColor(name, fallback) {
    const root = document.querySelector(".sx-root");
    const raw = root ? getComputedStyle(root).getPropertyValue(name).trim() : "";
    if (!raw) return toRgb(fallback);
    const rgb = toRgb(raw);
    if (!rgb || rgb[0] === 0 && rgb[1] === 0 && rgb[2] === 0 && !/^#?0{3,8}$|black|rgb\(\s*0,\s*0,\s*0/i.test(raw)) {
      return toRgb(fallback);
    }
    return rgb;
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

  // src/commands.js
  var COMMON = [
    ["ls", "列目录"],
    ["cd", "切换目录"],
    ["cat", "查看文件"],
    ["tail", "看文件末尾，常用 -f 跟踪日志"],
    ["grep", "按内容搜索文本"],
    ["ps", "查看进程"],
    ["top", "实时进程与负载"],
    ["systemctl", "管理 systemd 服务"],
    ["journalctl", "查看 systemd 日志"],
    ["df", "磁盘使用率"],
    ["du", "目录占用统计"],
    ["free", "内存使用"],
    ["tar", "打包解包"],
    ["curl", "发 HTTP 请求"],
    ["docker", "容器管理"],
    ["git", "版本控制"],
    ["vim", "编辑文件"],
    ["less", "分页查看"],
    ["head", "看文件开头"],
    ["find", "按条件找文件"],
    ["sed", "流式替换文本"],
    ["awk", "按列处理文本"],
    ["sort", "排序"],
    ["uniq", "去重"],
    ["wc", "统计行数字数"],
    ["lsblk", "列出块设备"],
    ["lsof", "查看端口/文件占用"],
    ["ss", "查看网络连接"],
    ["netstat", "网络连接与端口"],
    ["ping", "测试连通性"],
    ["nvidia-smi", "查看 GPU 状态"],
    ["iptables", "防火墙规则"],
    ["chmod", "改权限"],
    ["chown", "改属主"],
    ["cp", "复制"],
    ["mv", "移动或改名"],
    ["rm", "删除"],
    ["mkdir", "新建目录"],
    ["touch", "新建空文件/更新时间"],
    ["ln", "建链接"],
    ["pwd", "当前路径"],
    ["echo", "输出文本"],
    ["export", "设置环境变量"],
    ["source", "在当前 shell 执行脚本"],
    ["env", "查看环境变量"],
    ["which", "命令的绝对路径"],
    ["whereis", "命令相关的文件"],
    ["man", "查看手册"],
    ["history", "历史命令"],
    ["crontab", "定时任务"],
    ["date", "当前时间"],
    ["uptime", "开机时长与负载"],
    ["who", "当前登录用户"],
    ["whoami", "当前用户名"],
    ["id", "用户与组信息"],
    ["uname", "内核信息"],
    ["hostname", "主机名"],
    ["kill", "按 PID 结束进程"],
    ["pkill", "按名字结束进程"],
    ["killall", "结束同名进程"],
    ["nohup", "后台常驻运行"],
    ["watch", "定时重复执行"],
    ["screen", "会话保持"],
    ["tmux", "终端复用"],
    ["crontab -l", "列出定时任务"],
    ["rsync", "增量同步文件"],
    ["scp", "远程复制"],
    ["ssh", "登录另一台机器"],
    ["ssh-keygen", "生成密钥对"],
    ["wget", "下载文件"],
    ["unzip", "解压 zip"],
    ["gzip", "压缩/解压 gz"],
    ["zip", "打包 zip"],
    ["uname -a", "完整系统信息"],
    ["lscpu", "CPU 信息"],
    ["lsusb", "USB 设备"],
    ["lspci", "PCI 设备"],
    ["dmesg", "内核日志"],
    ["vmstat", "系统整体状态"],
    ["iostat", "磁盘 IO 统计"],
    ["iptables -L", "列出防火墙规则"],
    ["redis-cli", "连接 Redis"],
    ["mysql", "连接 MySQL"],
    ["nginx", "Nginx 服务"],
    ["make", "编译构建"],
    ["gcc", "编译 C"],
    ["python3", "运行 Python"],
    ["node", "运行 Node"],
    ["npm", "Node 包管理"],
    ["pip", "Python 包管理"],
    ["java", "运行 Java"],
    ["mvn", "Maven 构建"],
    ["go", "Go 工具链"],
    ["kubectl", "Kubernetes 集群"],
    ["pm2", "Node 进程管理"],
    ["supervisorctl", "管理 supervisord 进程"],
    ["service", "服务管理（旧版）"],
    ["apt", "Debian 系包管理"],
    ["yum", "RedHat 系包管理"],
    ["dnf", "Fedora 系包管理"],
    ["firewall-cmd", "firewalld 规则"],
    ["sysctl", "内核参数"],
    ["mount", "挂载"],
    ["umount", "卸载"],
    ["blkid", "块设备 UUID"],
    ["fdisk", "磁盘分区"],
    ["reboot", "重启机器"],
    ["shutdown", "关机"],
    ["sudo", "以 root 执行"],
    ["su", "切换用户"],
    ["passwd", "改密码"],
    ["useradd", "新建用户"],
    ["diff", "比较两个文件"],
    ["md5sum", "算 MD5"],
    ["sha256sum", "算 SHA256"],
    ["base64", "base64 编解码"],
    ["tree", "树状列目录"],
    ["stat", "文件元信息"],
    ["file", "识别文件类型"],
    ["type", "命令是内建还是外部"],
    ["alias", "查看或定义别名"],
    ["history -c", "清空历史"]
  ];
  var SUBCOMMANDS = {
    systemctl: [
      ["status ", "看服务状态，服务名跟在后面"],
      ["restart ", "重启服务"],
      ["reload ", "只重读配置，不断开连接"],
      ["start ", "启动"],
      ["stop ", "停止"],
      ["enable --now ", "设为开机自启并立刻启动"],
      ["list-units --failed", "哪些服务起挂了"],
      ["status -l --no-pager ", "长输出不分页"],
      ["daemon-reload", "改完 unit 文件后重载"]
    ],
    journalctl: [
      ["-u nginx -f", "跟踪某个服务的日志"],
      ["-u nginx -n 200 --no-pager", "最近 200 行"],
      ["-xe --no-pager", "最近的错误及解释"],
      ["--since '1 hour ago'", "按时间范围看"],
      ["-b -p err", "本次启动以来的错误"],
      ["--disk-usage", "journal 占了多少磁盘"],
      ["--vacuum-time=7d", "只保留 7 天"]
    ],
    docker: [
      ["ps -a", "所有容器"],
      ["logs -f --tail 200 ", "跟踪容器日志（跟容器名）"],
      ["exec -it ", "进容器（跟容器名 sh）"],
      ["images", "本地镜像"],
      ["stats --no-stream", "一次资源占用快照"],
      ["inspect ", "容器详情 JSON"],
      ["system df", "镜像与卷各占多少"],
      ["compose ps", "compose 服务状态"],
      ["compose logs -f --tail 100", "跟踪 compose 全部日志"],
      ["compose up -d", "后台拉起 compose"],
      ["compose restart ", "重启某个服务"]
    ],
    kubectl: [
      ["get pods -A -o wide", "所有 Pod 及所在节点"],
      ["get pods -A --field-selector=status.phase!=Running", "不正常的 Pod"],
      ["get nodes -o wide", "节点状态与版本"],
      ["get events -A --sort-by=.lastTimestamp | tail -30", "最近的集群事件"],
      ["top pods -A", "Pod 资源占用"],
      ["logs -f deploy/app --tail=200", "跟应用日志（改 deploy/app）"],
      ["exec -it deploy/app -- sh", "进容器"],
      ["describe pod app-0", "Pod 详情，先看 Events"],
      ["rollout restart deploy/app", "滚动重启"],
      ["rollout status deploy/app", "滚动更新进度"],
      ["apply -f deploy.yaml", "应用清单"],
      ["delete pod app-0", "删 Pod 触发重建"]
    ],
    git: [
      ["status", "工作区状态"],
      ["diff", "未暂存的改动"],
      ["diff --staged", "已暂存的改动"],
      ["log --oneline --graph -20", "紧凑的历史图"],
      ["add -A", "暂存全部改动"],
      ["commit -m ''", "提交，引号里写说明"],
      ["push", "推到远端"],
      ["pull --rebase", "拉取并变基，历史更干净"],
      ["stash", "暂存当前改动"],
      ["stash pop", "把暂存的改回来"],
      ["switch -c feature/x", "新建并切到分支"],
      ["branch -a", "本地与远端分支"],
      ["remote -v", "远端地址"],
      ["restore .", "丢弃工作区改动"],
      ["reset --hard HEAD", "丢弃全部未提交改动"]
    ],
    apt: [
      ["update", "刷新包索引"],
      ["upgrade", "升级已安装的包"],
      ["install ", "安装，跟包名"],
      ["remove --purge ", "卸载并清掉配置"],
      ["list --upgradable", "可升级的包"],
      ["autoremove", "清理不再需要的依赖"],
      ["search ", "搜索包"],
      ["show ", "包的详情与依赖"]
    ],
    yum: [
      ["check-update", "可升级的包"],
      ["update", "升级"],
      ["install ", "安装，跟包名"],
      ["remove ", "卸载"],
      ["search ", "搜索包"],
      ["info ", "包的详情"],
      ["clean all", "清空缓存"]
    ],
    tar: [
      ["-czf backup.tar.gz ", "打包压缩，跟要打包的目录"],
      ["-xzf ", "解压 .tar.gz"],
      ["-tzf ", "只看压缩包里有啥，不解开"],
      ["-czf backup.tar.gz --exclude=.git .", "排除 .git 打包"],
      ["-xzf x.tar.gz -C /tmp", "解到指定目录"],
      ["-cJf backup.tar.xz ", "用 xz 压，体积最小"],
      ["-cjf backup.tar.bz2 ", "用 bzip2 压"]
    ],
    find: [
      ['. -type f -name "*.log"', "按名字找文件"],
      [". -type d -name node_modules", "按名字找目录"],
      [". -type f -mtime -1", "一天内改动过的"],
      [". -type f -size +100M", "大于 100MB 的文件"],
      ["/var -type f -mtime +30 -delete", "清理 30 天前的文件"],
      [". -perm -4000 -type f", "SUID 程序"],
      ['. -type f -exec grep -l "keyword" {} +', "在找到的文件里搜内容"]
    ],
    grep: [
      ["-rn 'keyword' .", "递归搜索并显示行号"],
      ["-i -n 'error' app.log", "忽略大小写"],
      ["-v '^#' nginx.conf", "反向匹配，去掉注释行"],
      ["-A 3 -B 3 'error' app.log", "带前后三行上下文"],
      ["-c 'error' app.log", "只数匹配行数"],
      ['-E "a|b" file', "扩展正则，用 | 并列"],
      ["-l 'keyword' *.log", "只列文件名"]
    ],
    sed: [
      ["-n '100,200p' app.log", "打印指定行区间"],
      ["-i.bak 's/old/new/g' file", "就地替换并留一份备份"],
      ["'/^$/d' file", "删掉空行"],
      ["'/^#/d' file", "删掉注释行"],
      ["'s/\\t/ /g' file", "把制表符换成空格"]
    ],
    awk: [
      ["'{print $1}' file", "打印第一列"],
      ["-F: '{print $1}' /etc/passwd", "指定分隔符"],
      ["'{print $NF}' file", "打印最后一列"],
      ["'$3 > 100 {print $0}' file", "按条件过滤"],
      ["'{sum+=$5} END {print sum}' file", "把第五列求和"],
      ["'NR==10' file", "只看第 10 行"]
    ],
    ps: [
      ["aux", "BSD 风格的全量进程"],
      ["-ef", "System V 风格的全量进程"],
      ["aux --sort=-%mem | head", "按内存排序"],
      ["-eo pid,ppid,etime,cmd", "只挑关心的列"],
      ["-ef | grep java", "按关键字找进程"]
    ],
    ls: [
      ["-alh", "长列表，大小好读"],
      ["-alh --time-style=long-iso", "时间格式规整的长列表"],
      ["-lt", "按修改时间排序"],
      ["-lhS", "按大小排序"],
      ["-alh /var/log", "看指定目录"]
    ],
    df: [
      ["-h", "人类可读的用量"],
      ["-hT", "带文件系统类型"],
      ["-i", "inode 用量，磁盘没满却写不进去时看它"],
      ["-h /var", "只看某个目录所在的分区"],
      ["--total", "末尾给一行总计"]
    ],
    du: [
      ["-sh *", "当前目录下每项的总占用"],
      ["-sh .", "当前目录总占用"],
      ["-h --max-depth=1", "只看一层"],
      ["-sh * | sort -rh | head", "占用排行前几"]
    ],
    ss: [
      ["-tunlp", "监听的端口与对应进程"],
      ["-s", "连接数总览"],
      ["-tnp", "已建立的连接与进程"],
      ["-tan state established | wc -l", "统计并发连接数"],
      ["-tunlp | grep :80", "谁占了 80 端口"]
    ],
    ip: [
      ["-br a", "所有网卡与地址，简洁"],
      ["-s link", "网卡收发与错误统计"],
      ["route", "路由表"],
      ["link", "链路层状态"],
      ["neigh", "ARP 邻居表"]
    ],
    curl: [
      ["-I ", "只看响应头"],
      ['-L -s -o /dev/null -w "%{http_code} %{time_total}s\\n" ', "测响应码与总耗时"],
      ["-X POST -H 'Content-Type: application/json' -d '{}' ", "发一个 JSON POST"],
      ["-k ", "跳过证书校验，自签证书调试用"],
      ["-O ", "下载到当前目录"],
      ["--resolve example.com:443:10.0.0.1 ", "不改 DNS，直接指定解析结果"]
    ],
    ssh: [
      ["-i ~/.ssh/id_rsa ", "指定私钥"],
      ["-p 2222 ", "指定端口"],
      ["-L 8080:127.0.0.1:80 ", "本地端口转发"],
      ["-N -f -L 3306:127.0.0.1:3306 ", "后台常驻转发"],
      ["-v ", "调试日志，连不上时看它"],
      ["-o ConnectTimeout=5 -o BatchMode=yes ", "非交互探测能不能连上"]
    ],
    scp: [
      ["-r ./dir user@host:/data/", "递归上传目录"],
      ["user@host:/data/file ./", "下载到当前目录"],
      ["-P 2222 ", "指定端口，注意是大写 P"],
      ["-C user@host:/big.tar.gz .", "传输时顺便压缩"]
    ],
    rsync: [
      ["-avz --progress ./ user@host:/data/", "增量同步并显示进度"],
      ["-avz --delete ./ user@host:/data/", "镜像同步，对端多余文件会删掉"],
      ["-avz --exclude=.git --exclude=node_modules ./ user@host:/data/", "排除目录同步"],
      ["-avz --dry-run ./ user@host:/data/", "先空跑一遍看会动哪些文件"],
      ["-avz --bwlimit=2m ./ user@host:/data/", "限速 2MB/s"]
    ],
    dig: [
      ["+short example.com", "只要解析结果"],
      ["@8.8.8.8 example.com", "指定 DNS 服务器"],
      ["+trace example.com", "跟着递归看每一跳"],
      ["-x 8.8.8.8", "反查 PTR"],
      ["ANY example.com", "要所有记录类型"]
    ],
    lsof: [
      ["-i:80", "谁占着 80 端口"],
      ["-i -P -n", "所有网络文件与进程"],
      ["-p $(pgrep -f java | head -1)", "某个进程打开了哪些文件"],
      ["+L1", "已删除但仍被占用的文件"],
      ["-u root", "某个用户打开的文件"],
      ["-c nginx", "某个进程名打开的文件"]
    ],
    tcpdump: [
      ["-i any -nn port 80 -c 20", "抓 20 个包"],
      ["-i eth0 -w cap.pcap", "存到文件里慢慢看"],
      ["-nn host 10.0.0.1", "只看某台主机"],
      ["-nn -A port 80", "按 ASCII 显示内容"],
      ["-i any -nn icmp", "只看 ICMP"]
    ],
    nginx: [
      ["-t", "检查配置语法"],
      ["-T", "打印生效的完整配置"],
      ["-s reload", "平滑重载"],
      ["-s stop", "停止"],
      ["-V", "编译参数，看装了哪些模块"]
    ],
    mysql: [
      ["-uroot -p", "用 root 连接，会提示输密码"],
      ["-uroot -p -e ", "直接执行一条语句"],
      ["-h 10.0.0.1 -uroot -p", "连远程实例"],
      ["-uroot -p db < backup.sql", "把备份导回库里，先建好库"],
      ['-uroot -p -e "show processlist"', "当前连接与正在执行的语句"],
      ["-uroot -p --default-character-set=utf8mb4", "指定字符集，避免中文乱码"]
    ],
    "redis-cli": [
      ["ping", "看还活着没"],
      ["info", "全部运行信息"],
      ["info memory", "内存占用与碎片率"],
      ["--bigkeys", "扫出大 key，别在高峰期跑"],
      ["dbsize", "当前库有多少 key"],
      ["-h 10.0.0.1 -p 6379", "连远程实例"],
      ["slowlog get 10", "最近 10 条慢查询"]
    ],
    npm: [
      ["run build", "跑构建脚本"],
      ["run dev", "起开发服务"],
      ["install", "按 package.json 装依赖"],
      ["ci", "严格按 lock 文件干净安装"],
      ["ls -g --depth=0", "全局装了什么"],
      ["view react version", "查远端的包版本"]
    ],
    pm2: [
      ["list", "进程清单与重启次数"],
      ["logs --lines 200 ", "看某个应用的日志"],
      ["restart all", "全量重启"],
      ["reload all", "零停机重载"],
      ["monit", "实时面板"],
      ["save", "存下进程列表，开机自启靠它"]
    ],
    supervisorctl: [
      ["status", "所有进程的状态"],
      ["restart all", "全量重启"],
      ["tail -f ", "跟踪某个进程的日志"],
      ["update", "重读配置并热加载"],
      ["reread", "只重读配置，不重启"]
    ],
    "firewall-cmd": [
      ["--list-all", "当前生效的规则"],
      ["--reload", "重载配置"],
      ["--add-port=8080/tcp --permanent", "永久放行端口，记得 reload"],
      ["--remove-port=8080/tcp --permanent", "撤掉放行"],
      ["--add-service=https --permanent", "放行预定义服务"]
    ]
  };
  function suggest(line, history2, limit) {
    const prefix = line.trimStart();
    if (!prefix || limit <= 0) return [];
    const out = [];
    const seen = /* @__PURE__ */ new Set([prefix]);
    for (const cmd of [...history2].reverse()) {
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

  // src/popup-pos.js
  function popupPosition({ x, y, width, height, viewWidth, viewHeight, gap = 2, margin = 4 }) {
    const maxLeft = viewWidth - margin - width;
    const left = Math.max(margin, Math.min(x, maxLeft));
    const below = y + gap;
    const above = below + height > viewHeight - margin;
    const top = Math.max(margin, above ? y - height - gap * 2 : below);
    return { left, top, above };
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
    } else if (data === "") {
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
      if (state.active === s.id && !state.monitorDismissed) state.drawer = "monitor";
      notify();
      if (state.active === s.id) focusSession(s);
    } catch (e) {
      if (e.code === "needs_secret" || e.code === "auth_failed") {
        const conn = state.tree.connections.find((c) => c.id === s.connId);
        const got = await askSecret(conn, e.message);
        if (got?.secret) return connectSession(s, got);
        s.error = "已取消输入";
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
  function reconnect(s) {
    if (s.termId) {
      byTerm.delete(s.termId);
      api("terminal/close", { id: s.termId }).catch(() => {
      });
      s.termId = null;
    }
    s.term.write("\r\n\x1B[33m[重新连接…]\x1B[0m\r\n");
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
  function cycleTab(step) {
    const list2 = state.sessions;
    if (!list2.length) return null;
    const at = list2.findIndex((s) => s.id === state.active);
    const base = at < 0 ? 0 : at;
    const next = ((base + step) % list2.length + list2.length) % list2.length;
    const target = list2[next];
    if (target) activate(target);
    return target;
  }
  function applyTheme() {
    const theme = termTheme();
    for (const s of state.sessions) s.term.options.theme = theme;
  }
  async function reloadTree() {
    try {
      state.tree = await api("tree");
      state.loaded = true;
    } catch (e) {
      toast("加载连接失败:" + e.message, "error");
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
    return d ? `${d} 天 ${hh} 小时` : hh ? `${hh} 小时 ${m} 分` : `${m} 分`;
  }

  // src/spark.js
  var POINTS = 60;
  var histories = /* @__PURE__ */ new Map();
  var push = (list2, value) => {
    list2.push(Number.isFinite(value) ? value : 0);
    if (list2.length > POINTS) list2.shift();
  };
  function historyFor(key) {
    let h0 = histories.get(key);
    if (!h0) {
      h0 = { cpu: [], mem: [], swap: [], down: [], up: [], diskRead: [], diskWrite: [], ifaces: /* @__PURE__ */ new Map() };
      histories.set(key, h0);
    }
    return h0;
  }
  function recordSample(key, m) {
    const hist = historyFor(key);
    push(hist.cpu, m.cpu);
    push(hist.mem, m.memTotal > 0 ? m.memUsed / m.memTotal * 100 : 0);
    push(hist.swap, m.swapTotal > 0 ? m.swapUsed / m.swapTotal * 100 : 0);
    push(hist.down, m.netDown);
    push(hist.up, m.netUp);
    push(hist.diskRead, m.diskRead);
    push(hist.diskWrite, m.diskWrite);
    const seen = /* @__PURE__ */ new Set();
    for (const n of m.net ?? []) {
      if (n.name === "lo") continue;
      seen.add(n.name);
      let list2 = hist.ifaces.get(n.name);
      if (!list2) {
        list2 = [];
        hist.ifaces.set(n.name, list2);
      }
      push(list2, n.rx + n.tx);
    }
    for (const name of [...hist.ifaces.keys()]) if (!seen.has(name)) hist.ifaces.delete(name);
    return hist;
  }
  function Spark({ values, max, height = 38, color }) {
    const ref = globalThis.__dshSshTerminalReact.useRef(null);
    const peak = max ?? Math.max(1, ...values.length ? values : [0]);
    globalThis.__dshSshTerminalReact.useEffect(() => {
      const canvas = ref.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth || 160;
      const hh = height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(hh * dpr);
      const g = canvas.getContext("2d");
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, hh);
      const stroke = color || getComputedStyle(canvas).getPropertyValue("--sx-accent").trim() || "#4aa3ff";
      const pts = values.length ? values : [0];
      const stepX = pts.length > 1 ? w / (pts.length - 1) : 0;
      const yOf = (v) => hh - 2 - Math.min(1, Math.max(0, v / peak)) * (hh - 4);
      const at = (i) => [pts.length === 1 ? w : i * stepX, yOf(pts[i])];
      const fill = g.createLinearGradient(0, 0, 0, hh);
      fill.addColorStop(0, `${withAlpha(stroke, 0.28)}`);
      fill.addColorStop(1, `${withAlpha(stroke, 0.02)}`);
      g.beginPath();
      g.moveTo(0, hh);
      for (let i = 0; i < pts.length; i++) g.lineTo(...at(i));
      g.lineTo(at(pts.length - 1)[0], hh);
      g.closePath();
      g.fillStyle = fill;
      g.fill();
      g.beginPath();
      for (let i = 0; i < pts.length; i++) g.lineTo(...at(i));
      g.strokeStyle = stroke;
      g.lineWidth = 1.5;
      g.lineJoin = "round";
      g.stroke();
      const [lx, ly] = at(pts.length - 1);
      g.beginPath();
      g.arc(lx - 1.5, ly, 2, 0, Math.PI * 2);
      g.fillStyle = stroke;
      g.fill();
    }, [values.join(","), peak, height, color]);
    return h("canvas", { ref, className: "sx-spark", style: { height } });
  }
  function withAlpha(color, alpha) {
    const c = String(color).trim();
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
    if (hex) {
      const v = hex[1].length === 3 ? hex[1].split("").map((x) => x + x).join("") : hex[1];
      const n = parseInt(v, 16);
      return `rgba(${n >> 16 & 255}, ${n >> 8 & 255}, ${n & 255}, ${alpha})`;
    }
    const rgb = /^rgba?\(([^)]+)\)$/i.exec(c);
    if (rgb) {
      const [r, g, b] = rgb[1].split(",").map((x) => x.trim());
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return c;
  }

  // src/alerts.js
  var RULES = [
    { id: "cpu", warn: 80, crit: 95 },
    { id: "mem", warn: 85, crit: 95 },
    { id: "swap", warn: 60, crit: 85 },
    { id: "disk", warn: 80, crit: 90 },
    { id: "gpuMem", warn: 85, crit: 95 },
    { id: "gpuTemp", warn: 75, crit: 88 },
    { id: "load", warn: 1.5, crit: 2.5 },
    { id: "latency", warn: 100, crit: 300 }
  ];
  var RULE = new Map(RULES.map((r) => [r.id, r]));
  function tone(id, value) {
    const rule = RULE.get(id);
    if (!rule || !Number.isFinite(value)) return 0;
    if (value >= rule.crit) return 2;
    if (value >= rule.warn) return 1;
    return 0;
  }
  function level(pct2) {
    return pct2 >= 90 ? "err" : pct2 >= 75 ? "warn" : "";
  }
  var fmtPct = (v) => `${Math.round(v)}%`;
  function alerts(m) {
    if (!m) return [];
    const out = [];
    const add = (id, value, text) => {
      const t = tone(id, value);
      if (t > 0) out.push({ id, level: t, text, value });
    };
    add("cpu", m.cpu, `CPU ${fmtPct(m.cpu)}`);
    const memPct = m.memTotal > 0 ? m.memUsed / m.memTotal * 100 : 0;
    add("mem", memPct, `内存 ${fmtPct(memPct)}`);
    if (m.swapTotal > 0) {
      const swapPct = m.swapUsed / m.swapTotal * 100;
      add("swap", swapPct, `Swap ${fmtPct(swapPct)}`);
    }
    for (const d of m.disk ?? []) {
      const p = d.size > 0 ? d.used / d.size * 100 : 0;
      add("disk", p, `${d.mount} 已用 ${fmtPct(p)}`);
    }
    for (const g of m.gpu ?? []) {
      const p = g.memTotal > 0 ? g.memUsed / g.memTotal * 100 : 0;
      add("gpuMem", p, `显存 ${fmtPct(p)}`);
      add("gpuTemp", g.temp, `GPU ${Math.round(g.temp)}℃`);
    }
    const cores = m.cpuCores > 0 ? m.cpuCores : 1;
    add("load", (m.load?.[0] ?? 0) / cores, `负载 ${(m.load?.[0] ?? 0).toFixed(2)}`);
    if (typeof m.latencyMs === "number") add("latency", m.latencyMs, `延迟 ${Math.round(m.latencyMs)} ms`);
    return out.sort((a, b) => b.level - a.level || b.value - a.value).map(({ value, ...rest }) => rest);
  }
  function verdict(list2) {
    if (!list2.length) return { level: 0, text: "CPU / 内存 / 磁盘 都正常" };
    const level3 = Math.max(...list2.map((a) => a.level));
    return { level: level3, text: list2.map((a) => a.text).join(" · ") };
  }

  // src/monitor-panel.jsx
  var REFRESH_MS = 2e3;
  var collapsed = /* @__PURE__ */ new Set();
  var pct = (a, b) => b > 0 ? Math.min(100, Math.round(a / b * 100)) : 0;
  function MeterCard({ title, value, sub, values, max, tone: tone2 = "" }) {
    return h(
      "div",
      { className: "sx-mcard" },
      h("div", { className: "sx-mcard-t" }, h("span", null, title), h("b", { className: tone2 }, value)),
      h(Spark, { values, max }),
      sub && h("div", { className: "sx-mcard-sub" }, sub)
    );
  }
  function Fold({ id, title, right, children }) {
    const open = !collapsed.has(id);
    return h(
      "div",
      { className: `sx-fold ${open ? "" : "closed"}` },
      h(
        "button",
        {
          type: "button",
          className: "sx-fold-h",
          "aria-expanded": open,
          onClick: () => {
            open ? collapsed.add(id) : collapsed.delete(id);
            notify();
          }
        },
        h("span", { className: "sx-caret" }, open ? "▾" : "▸"),
        h("span", null, title),
        right && h("span", { className: "sx-fold-r" }, right)
      ),
      open && h("div", { className: "sx-fold-b" }, children)
    );
  }
  function Alerts({ list: list2 }) {
    const v = verdict(list2);
    const cls = v.level === 2 ? "err" : v.level === 1 ? "warn" : "ok";
    return h(
      "div",
      { className: `sx-malert ${cls}`, role: "status" },
      list2.length ? list2.map((a, i) => h("span", { key: i, className: `sx-pill ${a.level === 2 ? "err" : "warn"}` }, a.text)) : h("span", null, v.text)
    );
  }
  function ProcRow({ p }) {
    return h(
      "div",
      { className: "sx-proc-row" },
      h(
        "div",
        { className: "sx-proc-l1" },
        h("span", { className: "sx-dim" }, p.pid),
        h("span", { className: "sx-proc-name", title: p.cmd }, p.name),
        h("span", { className: `sx-proc-metric ${level(p.cpu * 2)}` }, `${p.cpu.toFixed(1)}%`)
      ),
      h(
        "div",
        { className: "sx-proc-l2" },
        h("span", null, p.user),
        h("span", null, `${p.mem.toFixed(1)}% · ${bytes(p.rss)}`)
      ),
      h(
        "div",
        { className: "sx-proc-l3", title: p.cmd },
        h("span", null, p.path || p.cmd),
        (p.diskRead > 0 || p.diskWrite > 0) && h("span", { className: "sx-dim" }, ` R ${bytes(p.diskRead)} · W ${bytes(p.diskWrite)}`)
      )
    );
  }
  function MonitorDrawer({ open }) {
    const s = activeSession();
    const cid = s?.id ?? null;
    const connId = s?.connId ?? null;
    const [m, setM] = globalThis.__dshSshTerminalReact.useState(null);
    const [err, setErr] = globalThis.__dshSshTerminalReact.useState("");
    const [hist, setHist] = globalThis.__dshSshTerminalReact.useState(null);
    globalThis.__dshSshTerminalReact.useEffect(() => {
      if (!open || !connId) return;
      let stop = false;
      let timer = null;
      let busy = false;
      setM(null);
      setErr("");
      const tick = async () => {
        if (busy) return;
        busy = true;
        try {
          const r = await api("monitor", { connection: connId });
          if (stop) return;
          setM(r);
          setErr("");
          setHist({ ...recordSample(connId, r) });
        } catch (e) {
          if (!stop) setErr(e instanceof Error ? e.message : String(e));
        } finally {
          busy = false;
        }
        if (!stop) timer = setTimeout(tick, REFRESH_MS);
      };
      tick();
      return () => {
        stop = true;
        clearTimeout(timer);
      };
    }, [open, connId]);
    const histNow = hist ?? (connId ? historyFor(connId) : null);
    const ifaces = m ? m.net.filter((n) => n.name !== "lo").sort((a, b) => b.rx + b.tx - (a.rx + a.tx)).slice(0, 6) : [];
    const memPct = m ? pct(m.memUsed, m.memTotal) : 0;
    const swapPct = m && m.swapTotal > 0 ? pct(m.swapUsed, m.swapTotal) : 0;
    const netPeak = ifaces.length ? Math.max(1, ...ifaces.flatMap((n) => histNow?.ifaces?.get(n.name) ?? [])) : 1;
    const diskPeak = Math.max(1, ...histNow?.diskRead ?? [], ...histNow?.diskWrite ?? []);
    return h(
      "div",
      { className: "sx-drawer sx-monitor" },
      h(
        "div",
        { className: "sx-dhead" },
        h("span", { className: "sx-dtitle" }, m?.info?.hostname ? `监控 · ${m.info.hostname}` : "资源监控"),
        h(
          "span",
          { className: "sx-dhead-r" },
          typeof m?.latencyMs === "number" && h("span", { className: "sx-dim" }, `${Math.round(m.latencyMs)} ms`),
          h("button", {
            className: "sx-btn sm",
            title: "关闭监控",
            onClick: () => {
              state.monitorDismissed = true;
              state.drawer = null;
              notify();
            }
          }, "×")
        )
      ),
      h(
        "div",
        { className: "sx-dbody" },
        !m && h("div", { className: "sx-hint" }, err || "读取中…"),
        m && h(
          globalThis.__dshSshTerminalReact.Fragment,
          null,
          h(Alerts, { list: alerts(m) }),
          err && h("div", { className: "sx-malert err" }, err),
          // 主机信息：一眼看出这是哪台机器、什么系统、跑了多久。
          h(
            "div",
            { className: "sx-minfo" },
            [m.info.os || "—", m.info.kernel, m.info.arch].filter(Boolean).join(" · "),
            h("span", { className: "sx-dim" }, `已运行 ${uptime(m.uptime)}`)
          ),
          // 四张读数卡：两列，一屏看完不用下拉。
          h(
            "div",
            { className: "sx-mgrid" },
            h(MeterCard, {
              title: "CPU",
              value: `${m.cpu.toFixed(1)}%`,
              tone: level(m.cpu),
              values: histNow?.cpu ?? [m.cpu],
              max: 100,
              sub: `${m.cpuCores} 核 · 负载 ${m.load.map((x) => x.toFixed(2)).join(" / ")}`
            }),
            h(MeterCard, {
              title: "内存",
              value: `${memPct}%`,
              tone: level(memPct),
              values: histNow?.mem ?? [memPct],
              max: 100,
              sub: `${bytes(m.memUsed)} / ${bytes(m.memTotal)}`
            }),
            h(MeterCard, {
              title: "Swap",
              value: m.swapTotal > 0 ? `${swapPct}%` : "未启用",
              tone: level(swapPct),
              values: histNow?.swap ?? [swapPct],
              max: 100,
              sub: m.swapTotal > 0 ? `${bytes(m.swapUsed)} / ${bytes(m.swapTotal)}` : "·"
            }),
            h(MeterCard, {
              title: "网络",
              value: `↓ ${rate(m.netDown)}`,
              values: histNow?.down ?? [m.netDown],
              sub: `↑ ${rate(m.netUp)}`
            }),
            // 磁盘 I/O 进四张主卡：这两项以前完全看不到，是监控与 LiteShell 的主要差距。
            h(MeterCard, {
              title: "磁盘 I/O",
              value: `读 ${rate(m.diskRead)}`,
              values: histNow?.diskRead ?? [m.diskRead],
              sub: `写 ${rate(m.diskWrite)}`
            })
          ),
          m.gpu.length > 0 && h(
            Fold,
            { id: "gpu", title: "GPU", right: `${m.gpu.length} 张` },
            m.gpu.map(
              (g, i) => h(
                "div",
                { key: i, className: "sx-mblock" },
                h("div", { className: "sx-mcard-t" }, h("span", null, g.name), h("b", { className: level(g.util) }, `${g.util}%`)),
                h(Spark, { values: histNow?.gpu?.[i] ?? [g.util], max: 100, height: 30 }),
                h(
                  "div",
                  { className: "sx-mcard-sub" },
                  `显存 ${bytes(g.memUsed)} / ${bytes(g.memTotal)} · ${Math.round(g.temp)}℃`,
                  h("div", { className: "sx-bar sm" }, h("i", { className: level(pct(g.memUsed, g.memTotal)), style: { width: `${pct(g.memUsed, g.memTotal)}%` } }))
                )
              )
            )
          ),
          m.npu && m.npu.length > 0 && h(
            Fold,
            { id: "npu", title: "NPU", right: `${m.npu.length} 张` },
            m.npu.map(
              (n) => h(
                "div",
                { key: n.id, className: "sx-mblock" },
                h(
                  "div",
                  { className: "sx-mcard-t" },
                  h("span", null, `#${n.id} ${n.name}`),
                  h("b", { className: level(n.util) }, `${n.util}%`)
                ),
                h(
                  "div",
                  { className: "sx-mcard-sub" },
                  `${n.health} · ${Math.round(n.temp)}℃ · ${n.power}W`,
                  (n.hbmTotal > 0 || n.ddrTotal > 0) && h(
                    "div",
                    null,
                    n.hbmTotal > 0 ? `HBM ${bytes(n.hbmUsed)} / ${bytes(n.hbmTotal)}` : "",
                    n.ddrTotal > 0 ? ` · DDR ${bytes(n.ddrUsed)} / ${bytes(n.ddrTotal)}` : ""
                  )
                )
              )
            )
          ),
          m.disk.length > 0 && h(
            Fold,
            { id: "disk", title: "磁盘", right: `${m.disk.length} 个挂载点` },
            m.disk.slice(0, 12).map((d) => {
              const p = pct(d.used, d.size);
              const io = d.read || d.write ? ` · 读 ${rate(d.read)} 写 ${rate(d.write)}` : "";
              return h(
                "div",
                { key: d.mount, className: "sx-mblock" },
                h("div", { className: "sx-mcard-t" }, h("span", { title: d.fs }, d.mount), h("b", { className: level(p) }, `${p}%`)),
                h("div", { className: "sx-bar sm" }, h("i", { className: level(p), style: { width: `${p}%` } })),
                h("div", { className: "sx-mcard-sub" }, `${bytes(d.used)} / ${bytes(d.size)}${io}`)
              );
            })
          ),
          m.proc.length > 0 && h(
            Fold,
            { id: "proc", title: "进程（按 CPU）", right: `${m.proc.length} 个` },
            m.proc.slice(0, 10).map((p) => h(ProcRow, { key: p.pid, p }))
          ),
          ifaces.length > 0 && h(
            Fold,
            { id: "net", title: "网络", right: `↓ ${rate(m.netDown)} ↑ ${rate(m.netUp)}` },
            ifaces.map(
              (n) => h(
                "div",
                { key: n.name, className: "sx-mblock" },
                h("div", { className: "sx-mcard-t" }, h("span", null, n.name), h("span", { className: "sx-dim" }, `↓ ${rate(n.rx)} ↑ ${rate(n.tx)}`)),
                h(Spark, { values: histNow?.ifaces?.get(n.name) ?? [n.rx + n.tx], max: netPeak, height: 28 }),
                h(
                  "div",
                  { className: "sx-mcard-sub" },
                  `累计 ${(m.netTotals ?? []).find((t) => t.name === n.name) ? `↓ ${bytes(m.netTotals.find((t) => t.name === n.name).rxBytes)} ↑ ${bytes(m.netTotals.find((t) => t.name === n.name).txBytes)}` : "—"}`
                )
              )
            )
          ),
          // 磁盘 I/O：整机读写速率 + 每块盘的明细。读不到 diskstats（老内核、容器里
          // 没挂 /proc）时整块不出现，而不是给一排 0 让人以为磁盘不动。
          (m.diskIo?.length ?? 0) > 0 && h(
            Fold,
            { id: "diskio", title: "磁盘 I/O", right: `读 ${rate(m.diskRead)} 写 ${rate(m.diskWrite)}` },
            h(
              "div",
              { className: "sx-mblock" },
              h(
                "div",
                { className: "sx-mcard-t" },
                h("span", null, "整机"),
                h("span", { className: "sx-dim" }, `读 ${rate(m.diskRead)} · 写 ${rate(m.diskWrite)}`)
              ),
              // 两条曲线共用刻度，否则读写各自的峰值会把对方压平成一条直线。
              h(Spark, { values: histNow?.diskRead ?? [m.diskRead], max: diskPeak, height: 28 }),
              h(Spark, { values: histNow?.diskWrite ?? [m.diskWrite], max: diskPeak, height: 28 })
            ),
            m.diskIo.map(
              (d) => h(
                "div",
                { key: d.name, className: "sx-mblock" },
                h("div", { className: "sx-mcard-t" }, h("span", null, d.name), h("span", { className: "sx-dim" }, `读 ${rate(d.read)} 写 ${rate(d.write)}`))
              )
            )
          )
        )
      )
    );
  }

  // src/markdown.js
  var SAFE_HREF = /^(https?:\/\/|mailto:)/i;
  function inline(text, keyBase) {
    const out = [];
    let rest = String(text);
    let n = 0;
    const push2 = (node) => out.push(globalThis.__dshSshTerminalReact.createElement(Fragment, { key: `${keyBase}-${n++}` }, node));
    for (; ; ) {
      const m = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(\[[^\]]+\]\([^)\s]+\))/.exec(rest);
      if (!m) break;
      if (m.index > 0) push2(rest.slice(0, m.index));
      const token = m[0];
      const key = `${keyBase}-${n++}`;
      if (token.startsWith("`")) push2(h("code", { key, className: "sx-md-code" }, token.slice(1, -1)));
      else if (token.startsWith("**")) push2(h("strong", { key }, token.slice(2, -2)));
      else if (token.startsWith("*")) push2(h("em", { key }, token.slice(1, -1)));
      else {
        const [, label, href] = /\[([^\]]+)\]\(([^)\s]+)\)/.exec(token);
        push2(SAFE_HREF.test(href) ? h("a", { key, href, target: "_blank", rel: "noreferrer noopener" }, label) : h("span", { key }, `${label} (${href})`));
      }
      rest = rest.slice(m.index + token.length);
    }
    if (rest) push2(rest);
    return out;
  }
  function Markdown({ text }) {
    const source = String(text ?? "");
    if (!source.trim()) return null;
    const blocks = [];
    const lines2 = source.split("\n");
    let i = 0;
    let key = 0;
    while (i < lines2.length) {
      const line = lines2[i];
      if (line.startsWith("```")) {
        const lang = line.slice(3).trim();
        const body = [];
        i++;
        while (i < lines2.length && !lines2[i].startsWith("```")) body.push(lines2[i++]);
        i++;
        blocks.push(h("pre", { key: key++, className: "sx-md-pre" }, h("code", { "data-lang": lang || void 0 }, body.join("\n"))));
        continue;
      }
      const heading = /^(#{1,4})\s+(.*)$/.exec(line);
      if (heading) {
        const level3 = heading[1].length;
        blocks.push(h(`h${Math.min(level3 + 2, 6)}`, { key: key++, className: "sx-md-h" }, inline(heading[2], `h${key}`)));
        i++;
        continue;
      }
      if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
        const ordered = /^\s*\d+\.\s+/.test(line);
        const items = [];
        while (i < lines2.length && /^\s*([-*+]|\d+\.)\s+/.test(lines2[i])) {
          items.push(h("li", { key: items.length }, inline(lines2[i].replace(/^\s*([-*+]|\d+\.)\s+/, ""), `li${key}-${items.length}`)));
          i++;
        }
        blocks.push(h(ordered ? "ol" : "ul", { key: key++, className: "sx-md-list" }, items));
        continue;
      }
      if (!line.trim()) {
        i++;
        continue;
      }
      const para = [];
      while (i < lines2.length && lines2[i].trim() && !lines2[i].startsWith("```") && !/^(#{1,4})\s/.test(lines2[i]) && !/^\s*([-*+]|\d+\.)\s+/.test(lines2[i])) {
        para.push(lines2[i++]);
      }
      blocks.push(h("p", { key: key++, className: "sx-md-p" }, inline(para.join("\n"), `p${key}`)));
    }
    return h("div", { className: "sx-md" }, blocks);
  }

  // src/attachments.js
  var MAX_ATTACH_BYTES = 6 * 1024 * 1024;
  var TEXT_EXT = /* @__PURE__ */ new Set([
    "txt",
    "md",
    "log",
    "conf",
    "cfg",
    "ini",
    "yaml",
    "yml",
    "json",
    "toml",
    "xml",
    "csv",
    "sh",
    "bash",
    "zsh",
    "py",
    "js",
    "ts",
    "mjs",
    "cjs",
    "go",
    "rs",
    "java",
    "c",
    "h",
    "cpp",
    "sql",
    "service",
    "env",
    "properties",
    "pem",
    "pub"
  ]);
  var IMAGE_MIME = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif"
  };
  function extOf(name) {
    const m = /\.([A-Za-z0-9]{1,10})$/.exec(String(name ?? "").split(/[\\/]/).pop() ?? "");
    return m ? m[1].toLowerCase() : "";
  }
  function classifyAttachment(file) {
    const name = String(file?.name ?? "");
    const size = Number(file?.size ?? 0);
    if (!name) return { kind: "reject", reason: "没有文件名" };
    if (size > MAX_ATTACH_BYTES) {
      return { kind: "reject", reason: `${(size / 1048576).toFixed(1)} MB 超过上限 ${MAX_ATTACH_BYTES / 1048576} MB，请先在服务器上下载或裁剪` };
    }
    const ext = extOf(name);
    if (IMAGE_MIME[ext]) return { kind: "image", mime: IMAGE_MIME[ext] };
    if (TEXT_EXT.has(ext) || ext === "") return { kind: "text" };
    return { kind: "link-only" };
  }
  function attachmentBlocks(a) {
    if (a.kind === "image") {
      if (a.data) {
        return [
          { type: "text", text: `[附件图片] ${a.name}` },
          { type: "image", source: { type: "base64", media_type: a.mime || "image/png", data: a.data } }
        ];
      }
      return [{ type: "text", text: `[附件图片] ${a.name}（${a.mime || "未知类型"}；内容没能读取，请让用户重发或改用文件路径）` }];
    }
    if (a.kind === "text") {
      return [{ type: "text", text: `[附件] ${a.name}
\`\`\`
${String(a.text ?? "")}
\`\`\`` }];
    }
    return [{ type: "text", text: `[附件] ${a.path ?? a.name}（未展开内容；需要时用工具读取）` }];
  }
  var COMPACT_PROMPT = [
    "把下面这段对话压缩成一份工作交接摘要，供之后继续同一个任务时使用。",
    "必须保留：",
    "- 用户的要求与约束（原话里的关键限定词）；",
    "- 已经跑过的命令**原文**，以及它们的结论（成功/失败、关键输出里的数值）；",
    "- 已确认的路径、端口、服务名、配置项；",
    "- 被用户拒绝过的尝试（以及为什么被拒），不要重试它们；",
    "- 还没解决的问题、下一步该做什么。",
    "不要保留：寒暄、重复的解释、已经作废的方案。",
    "直接输出摘要正文，不要加标题或前言。"
  ].join("\n");

  // src/ai-panel.jsx
  var panel = {
    width: 520,
    dragging: false,
    steps: /* @__PURE__ */ new Map(),
    draft: "",
    models: null,
    selected: null,
    items: [],
    historyOpen: false,
    history: [],
    historyQuery: "",
    busy: false,
    error: "",
    /** 待发送的附件：{ name, size, kind, mime?, text?, path? } */
    files: []
  };
  var subs2 = /* @__PURE__ */ new Set();
  var notifyPanel = () => [...subs2].forEach((f) => f());
  function usePanel() {
    const [, set] = globalThis.__dshSshTerminalReact.useState(0);
    globalThis.__dshSshTerminalReact.useEffect(() => {
      const f = () => set((v) => v + 1);
      subs2.add(f);
      return () => subs2.delete(f);
    }, []);
    return panel;
  }
  var events = null;
  function ensureEvents2() {
    if (events) return;
    events = new EventSource("/api/ssh-terminal/ai/events");
    events.onmessage = (ev) => {
      let m;
      try {
        m = JSON.parse(ev.data);
      } catch {
        return;
      }
      apply(m);
    };
  }
  function apply(m) {
    const item = panel.items[panel.items.length - 1];
    switch (m.type) {
      case "text": {
        const cur = findLast((x) => x.kind === "answer" || x.kind === "interim");
        if (cur && cur.streaming) cur.text = m.text;
        else panel.items.push({ kind: m.interim ? "interim" : "answer", text: m.text, streaming: true });
        break;
      }
      case "tool-start":
        panel.items.push({ kind: "step", id: m.id, name: m.name, command: m.command, args: m.args, state: "running", at: Date.now() });
        panel.busy = true;
        break;
      case "approval": {
        let step = panel.items.find((x) => x.kind === "step" && x.id === m.id);
        if (!step) {
          step = { kind: "step", id: m.id, name: m.name, command: m.command, args: m.args, state: "asking", at: Date.now() };
          panel.items.push(step);
        }
        step.state = "asking";
        step.risk = m.risk;
        step.tone = m.tone;
        step.reason = m.reason;
        break;
      }
      case "tool-end": {
        const step = panel.items.find((x) => x.kind === "step" && x.id === m.id);
        if (step) {
          step.state = m.ok ? "ok" : "failed";
          step.output = m.output ?? "";
          step.ms = m.ms;
          step.handle = m.handle;
        }
        break;
      }
      case "step-done":
        break;
      case "reset":
        panel.busy = false;
        for (const it of panel.items) if (it.streaming) it.streaming = false;
        break;
      case "warning":
        panel.items.push({ kind: "interim", text: `⚠ ${m.text}` });
        break;
      case "done":
        panel.busy = false;
        for (const it of panel.items) if (it.streaming) it.streaming = false;
        if (m.error) panel.items.push({ kind: "interim", text: `出错：${m.error}` });
        if (m.finish === "aborted") panel.items.push({ kind: "interim", text: "已停止。" });
        break;
      case "approval-timeout": {
        const step = panel.items.find((x) => x.kind === "step" && x.id === m.id);
        if (step) step.state = "failed";
        break;
      }
      default:
        break;
    }
    void item;
    notifyPanel();
  }
  var findLast = (pred) => {
    for (let i = panel.items.length - 1; i >= 0; i--) if (pred(panel.items[i])) return panel.items[i];
    return null;
  };
  function StepCard({ step }) {
    const key = step.id;
    const open = panel.steps.has(key) ? panel.steps.get(key) : step.state !== "ok";
    const toggle = () => {
      panel.steps.set(key, !open);
      notifyPanel();
    };
    const lines2 = String(step.output ?? "").split("\n");
    const long = lines2.length > 8 || String(step.output ?? "").length > 600;
    const title = step.command || step.name;
    const badge = step.state === "asking" ? "待确认" : step.state === "running" ? "运行中…" : step.state === "failed" ? "失败" : "完成";
    return h(
      "div",
      { className: `sx-agent-step ${step.state} ${step.tone ?? ""}` },
      h(
        "button",
        { className: "sx-step-h", onClick: toggle, type: "button", "aria-expanded": open },
        h("span", { className: "sx-step-caret" }, open ? "▾" : "▸"),
        h("span", { className: "sx-step-tag" }, step.name),
        h("span", { className: "sx-step-title", title }, title),
        h("span", { className: "sx-step-badge" }, badge)
      ),
      open && h(
        "div",
        { className: "sx-step-b" },
        step.state === "asking" && h(ApprovalBody, { step }),
        step.reason && step.state === "asking" && h("div", { className: "sx-step-reason" }, step.reason),
        step.output && h(
          "pre",
          { className: `sx-step-out ${long ? "long" : ""}` },
          long ? `${lines2.slice(0, 40).join("\n")}
…（共 ${lines2.length} 行，只显示前 40 行）` : step.output
        ),
        step.ms != null && h("div", { className: "sx-step-foot" }, `exit=${step.state === "failed" ? "非 0" : "0"} · ${step.ms}ms`)
      )
    );
  }
  function ApprovalBody({ step }) {
    const [text, setText] = globalThis.__dshSshTerminalReact.useState(step.command);
    const connId = activeSession()?.connId;
    const reply = async (approved) => {
      step.state = approved ? "running" : "failed";
      if (!approved) step.output = "（用户拒绝了这一步）";
      notifyPanel();
      await api("ai/approve", { id: connId, step: step.id, approved }).catch(() => {
      });
    };
    return h(
      "div",
      { className: "sx-approve" },
      h("textarea", {
        className: "sx-input sx-approve-cmd",
        value: text,
        spellCheck: false,
        onChange: (e) => setText(e.target.value)
      }),
      h(
        "div",
        { className: "sx-approve-btns" },
        h("button", { className: "sx-btn sm", onClick: () => reply(false) }, "拒绝"),
        h("button", { className: "sx-btn sm pri", onClick: () => reply(true) }, "执行")
      )
    );
  }
  function HistoryPane() {
    const connId = activeSession()?.connId;
    const groups = /* @__PURE__ */ new Map();
    for (const it of panel.history) {
      const d = new Date(it.at);
      const today = /* @__PURE__ */ new Date();
      const label = d.toDateString() === today.toDateString() ? "今天" : d.toDateString();
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(it);
    }
    const q = panel.historyQuery.toLowerCase();
    const showHistory = (it) => {
      panel.items = (it.messages ?? []).filter((m) => m.role === "user" || m.role === "assistant").flatMap(
        (m) => (m.content ?? []).filter((b) => b.type === "text").map((b) => ({ kind: m.role === "assistant" ? "answer" : "user", text: b.text }))
      );
    };
    return h(
      "div",
      { className: "sx-ai-history" },
      h("input", {
        className: "sx-input sm",
        placeholder: "搜索历史…",
        value: panel.historyQuery,
        onInput: (e) => (panel.historyQuery = e.target.value, notifyPanel())
      }),
      h(
        "button",
        {
          className: "sx-btn sm",
          onClick: async () => {
            panel.items = [];
            panel.historyOpen = false;
            notifyPanel();
            await api("ai/new", { connection: connId }).catch(() => {
            });
          }
        },
        "＋ 新对话"
      ),
      [...groups.entries()].map(
        ([label, list2]) => h(
          "div",
          { key: label, className: "sx-ai-hgroup" },
          h("div", { className: "sx-ai-hlabel" }, label),
          list2.filter((it) => !q || String(it.title ?? "").toLowerCase().includes(q)).map(
            (it) => h(
              "div",
              {
                key: it.id,
                className: "sx-ai-hitem",
                title: `${new Date(it.at).toLocaleString()}${it.model ? ` · ${it.model.model}` : ""}`,
                onClick: async () => {
                  try {
                    await api("ai/restore", { connection: connId, id: it.id });
                    showHistory(it);
                    panel.historyOpen = false;
                    toast("已接上这段对话", "success");
                  } catch (e) {
                    toast(`恢复失败：${e.message}`, "error");
                  }
                  notifyPanel();
                }
              },
              h("span", { className: "sx-ai-htitle" }, it.title || "未命名"),
              h(
                "span",
                {
                  className: "sx-ai-hdel",
                  title: "删除这条历史",
                  onClick: async (e) => {
                    e.stopPropagation();
                    try {
                      await api("ai/delete", { connection: connId, id: it.id });
                      panel.history = panel.history.filter((x) => x.id !== it.id);
                      notifyPanel();
                    } catch (err) {
                      toast(`删除失败：${err.message}`, "error");
                    }
                  }
                },
                "×"
              )
            )
          )
        )
      )
    );
  }
  function ModelPicker() {
    if (!panel.models?.groups?.length) {
      return h("span", { className: "sx-dim" }, panel.selected ? `${panel.selected.provider} / ${panel.selected.model}` : "未选择模型");
    }
    const current = panel.selected;
    return h(
      "select",
      {
        className: "sx-input sm sx-ai-model",
        value: current ? `${current.provider}::${current.model}` : "",
        onChange: (e) => {
          const [provider, model] = e.target.value.split("::");
          panel.selected = { provider, model };
          notifyPanel();
        }
      },
      panel.models.groups.map(
        (g) => h(
          "optgroup",
          { key: g.id, label: g.name },
          g.models.map((m) => h("option", { key: m.id, value: `${g.id}::${m.id}` }, m.name))
        )
      )
    );
  }
  function AiPanel() {
    const p = usePanel();
    const connId = activeSession()?.connId;
    globalThis.__dshSshTerminalReact.useEffect(() => {
      ensureEvents2();
      if (!p.models) {
        api("ai/models").then((r) => {
          panel.models = r;
          panel.selected = r.current;
          notifyPanel();
        }).catch(() => {
        });
      }
    }, []);
    globalThis.__dshSshTerminalReact.useEffect(() => {
      if (!p.historyOpen || !connId) return;
      api("ai/history", void 0, { connection: connId }).then((r) => {
        panel.history = r.items ?? [];
        notifyPanel();
      }).catch(() => {
      });
    }, [p.historyOpen, connId]);
    const send = async () => {
      const text = panel.draft.trim();
      const files = panel.files;
      if (!text && !files.length || !connId) return;
      panel.draft = "";
      panel.files = [];
      panel.items.push({ kind: "user", text: text || `（${files.length} 个附件）` });
      panel.busy = true;
      notifyPanel();
      try {
        const blocks = [];
        for (const f of files) blocks.push(...attachmentBlocks(f));
        await api("ai/send", { connection: connId, text, blocks });
      } catch (e) {
        panel.items.push({ kind: "interim", text: `发送失败：${e.message}` });
        panel.busy = false;
        notifyPanel();
      }
    };
    const readImageData = (file) => new Promise((resolve) => {
      try {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result ?? "");
          const comma = result.indexOf(",");
          resolve(comma >= 0 ? result.slice(comma + 1) : "");
        };
        reader.onerror = () => resolve("");
        reader.readAsDataURL(file);
      } catch {
        resolve("");
      }
    });
    const addFiles = async (fileList) => {
      for (const f of fileList) {
        const kind = classifyAttachment({ name: f.name, size: f.size });
        if (kind.kind === "reject") {
          panel.items.push({ kind: "interim", text: `附件 ${f.name} 没有加上：${kind.reason}` });
          continue;
        }
        const entry = { name: f.name, size: f.size, kind: kind.kind, mime: kind.mime };
        if (kind.kind === "text") {
          try {
            entry.text = await f.text();
          } catch {
            entry.kind = "link-only";
          }
        }
        if (kind.kind === "image") {
          entry.data = await readImageData(f);
          if (!entry.data) panel.items.push({ kind: "interim", text: `附件 ${f.name} 读取失败，已跳过图片内容` });
        }
        panel.files.push(entry);
      }
      notifyPanel();
    };
    const stop = () => api("ai/stop", { id: connId }).catch(() => {
    });
    const startDrag = (e) => {
      e.preventDefault();
      panel.dragging = true;
      const move = (ev) => {
        panel.width = Math.max(320, Math.min(900, window.innerWidth - ev.clientX));
        notifyPanel();
      };
      const up = () => {
        panel.dragging = false;
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
      };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    };
    if (!connId) return null;
    return h(
      "div",
      { className: "sx-ai", style: { width: panel.width } },
      h("div", { className: "sx-ai-grip", onMouseDown: startDrag, title: "拖动调整宽度" }),
      h(
        "div",
        { className: "sx-dhead" },
        h("button", { className: "sx-btn sm", title: "历史对话", onClick: () => (panel.historyOpen = !panel.historyOpen, notifyPanel()) }, "☰"),
        h("span", { className: "sx-dtitle" }, "AI 助手"),
        h(ModelPicker),
        h("button", { className: "sx-btn sm", title: "占满整行", onClick: () => (panel.width = window.innerWidth - 40, notifyPanel()) }, "⤢"),
        h("button", { className: "sx-btn sm", title: "收起", onClick: () => (state.aiOpen = false, notify()) }, "×")
      ),
      p.historyOpen && h(HistoryPane),
      h(
        "div",
        {
          className: "sx-ai-body",
          onDragOver: (e) => {
            e.preventDefault();
            e.currentTarget.classList.add("drop");
          },
          onDragLeave: (e) => e.currentTarget.classList.remove("drop"),
          onDrop: (e) => {
            e.preventDefault();
            e.currentTarget.classList.remove("drop");
            if (e.dataTransfer?.files?.length) void addFiles([...e.dataTransfer.files]);
          }
        },
        p.items.map((it, i) => {
          if (it.kind === "user") return h("div", { key: i, className: "sx-ai-user" }, it.text);
          if (it.kind === "interim") return h("div", { key: i, className: "sx-ai-interim" }, it.text);
          if (it.kind === "step") return h(StepCard, { key: it.id ?? i, step: it });
          return h(
            "div",
            { key: i, className: `sx-ai-answer ${it.streaming ? "streaming" : ""}` },
            it.streaming ? h("div", { className: "sx-ai-dots" }, "▍") : h(Markdown, { text: it.text })
          );
        }),
        p.error && h("div", { className: "sx-ai-interim err" }, p.error)
      ),
      h(
        "div",
        { className: "sx-ai-input" },
        p.files.length > 0 && h(
          "div",
          { className: "sx-ai-files" },
          p.files.map(
            (f, i) => h(
              "span",
              { key: i, className: "sx-ai-file" },
              `${f.kind === "image" ? "🖼" : f.kind === "text" ? "📄" : "📎"} ${f.name}`,
              h(
                "button",
                {
                  className: "sx-ai-file-x",
                  title: "移除",
                  onClick: () => {
                    panel.files.splice(i, 1);
                    notifyPanel();
                  }
                },
                "×"
              )
            )
          )
        ),
        h("textarea", {
          className: "sx-input",
          placeholder: "让 AI 在这台服务器上做事…（Enter 发送，Shift+Enter 换行）",
          value: p.draft,
          rows: 2,
          onInput: (e) => (panel.draft = e.target.value, notifyPanel()),
          onKeyDown: (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }
        }),
        h(
          "div",
          { className: "sx-ai-actions" },
          p.busy ? h("button", { className: "sx-btn sm dng", onClick: stop }, "停止") : h("button", { className: "sx-btn sm pri", onClick: send, disabled: !p.draft.trim() && !p.files.length }, "发送")
        )
      )
    );
  }

  // src/palette.js
  var MAX_HINTS = 40;
  var PALETTE = [
    { group: "系统信息", items: [
      ["uname -a", "内核、架构、主机名"],
      ["cat /etc/os-release", "发行版版本"],
      ["uptime", "运行时长与平均负载"],
      ["hostnamectl", "主机名与虚拟化信息"],
      ["lscpu", "CPU 型号、核数、缓存"],
      ["free -h", "内存与 Swap"]
    ] },
    { group: "CPU / 负载", items: [
      ["top -b -n1 | head -20", "一次性看负载最高的进程"],
      ["ps -eo pid,ppid,pcpu,pmem,comm --sort=-pcpu | head -15", "按 CPU 排序的进程表"],
      ["mpstat -P ALL 1 3", "每核使用率（sysstat）"],
      ["pidstat -u 1 3", "每进程 CPU（sysstat）"]
    ] },
    { group: "磁盘 / IO", items: [
      ["df -hT", "挂载点、文件系统与使用率"],
      ["df -i", "inode 是否用完"],
      ["du -sh * | sort -hr | head -20", "当前目录谁最占空间"],
      ["iostat -dx 1 3", "每块盘的 IO（sysstat）"],
      ["lsblk -f", "块设备与文件系统"]
    ] },
    { group: "网络", items: [
      ["ss -lntp", "监听中的端口与进程"],
      ["ip -br a", "所有网卡地址一览"],
      ["ip route", "路由表"],
      ["curl -sS -I https://example.com", "看响应头（排查连通）"],
      ["dig +short example.com", "解析结果（dig）"],
      ["tcpdump -i any -n port 80 -c 20", "抓 20 个包"]
    ] },
    { group: "进程 / 服务", items: [
      ["systemctl list-units --failed", "失败的单元"],
      ["systemctl status nginx", "某服务状态"],
      ["journalctl -xe -n 100", "最近 100 条错误日志"],
      ['journalctl -u nginx --since "1 hour ago"', "某服务最近一小时"],
      ["ps aux --sort=-%mem | head", "最吃内存的进程"]
    ] },
    { group: "文件 / 文本", items: [
      ['find /var/log -name "*.log" -mtime -1', "一天内改过的日志"],
      ['grep -rn "ERROR" /var/log --include=*.log | tail -50', "最近 50 条报错"],
      ["tail -F /var/log/syslog", "跟踪日志"],
      ["tar -czf backup.tar.gz ./dirname", "打包成 tar.gz"],
      ["du -xhd1 / | sort -hr | head", "根目录一级谁最占"]
    ] },
    { group: "Docker", items: [
      ['docker ps -a --format "table {{.Names}}\\t{{.Status}}\\t{{.Image}}"', "容器一览"],
      ["docker logs -f --tail 200 $(docker ps -lq)", "看最新容器的日志"],
      ["docker stats --no-stream", "各容器资源占用"],
      ["docker system df", "镜像/容器/卷占多少磁盘"],
      ["docker compose up -d", "拉起编排"]
    ] },
    { group: "安全 / 审计", items: [
      ["last -n 20", "最近登录记录"],
      ["who", "当前在线用户"],
      ["ss -tnp state established", "已建立的连接"],
      ['sudo grep -i "Failed password" /var/log/auth.log | tail', "登录失败尝试"]
    ] }
  ];
  function searchPalette(query) {
    const words = String(query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
    const rows = [];
    for (const group of PALETTE) {
      for (const [cmd, hint] of group.items) {
        const hay = `${cmd} ${hint} ${group.group}`.toLowerCase();
        if (words.length && !words.every((w) => hay.includes(w))) continue;
        rows.push({ group: group.group, cmd, hint });
      }
    }
    return rows.slice(0, MAX_HINTS);
  }

  // src/shortcut-table.js
  var APP_KEYS = [
    ["Ctrl + T", "新建连接"],
    ["Ctrl + B", "收起 / 展开连接列表"],
    ["Ctrl + F", "搜索连接"],
    ["Ctrl + K", "命令面板"],
    ["Ctrl + /", "快捷键一览"],
    ["Ctrl + Tab / Ctrl + Shift + Tab", "切换标签"],
    ["Ctrl + 1 … 9", "跳到第 N 个标签"],
    ["Ctrl + Shift + W", "关闭当前标签"],
    ["Ctrl + Shift + F", "终端内查找"],
    ["Ctrl + Shift + B", "文件面板"],
    ["Ctrl + Shift + M", "资源监控"],
    ["Ctrl + Shift + A", "AI 助手"],
    ["Ctrl + Shift + H", "历史命令"],
    ["Ctrl + Shift + K", "清屏"],
    ["Ctrl + Shift + L", "日志"],
    ["Ctrl + S", "编辑器：存回服务器"],
    ["Esc", "关闭弹窗"]
  ];
  var SHELL_KEYS = [
    ["Tab", "补全命令或路径"],
    ["Ctrl + R", "搜索 shell 历史"],
    ["Ctrl + C", "中断当前命令（有选中内容时复制）"],
    ["Ctrl + D", "结束输入 / 退出登录"],
    ["Ctrl + L", "清屏（保留历史）"],
    ["Ctrl + A / Ctrl + E", "光标到行首 / 行尾"],
    ["Ctrl + U / Ctrl + K", "删到行首 / 行尾"],
    ["Ctrl + W", "删掉前一个词"],
    ["↑ / ↓", "shell 自己的历史"]
  ];

  // src/overlays.js
  var palette = false;
  var paletteQuery = "";
  var setPaletteOpen = (on) => {
    palette = Boolean(on);
    if (palette) paletteQuery = "";
    notify();
  };
  var logs = false;
  var lines = [];
  var logOpen = () => logs;
  var setLogOpen = (on) => {
    logs = Boolean(on);
    notify();
  };
  var logLines = () => lines;
  function clearLog() {
    lines.length = 0;
    notify();
  }
  function CommandPalette() {
    const [q, setQ] = globalThis.__dshSshTerminalReact.useState(paletteQuery);
    globalThis.__dshSshTerminalReact.useEffect(() => {
      if (palette) {
        setQ("");
        paletteQuery = "";
      }
    }, [palette]);
    if (!palette) return null;
    const rows = searchPalette(q);
    const fill = (cmd) => {
      const s = activeSession();
      if (!s || s.status !== "ready") return;
      s.term.paste(cmd);
      setPaletteOpen(false);
      s.term.focus();
    };
    return h(
      "div",
      { className: "sx-overlay", onMouseDown: (e) => e.target === e.currentTarget && setPaletteOpen(false) },
      h(
        "div",
        { className: "sx-dialog sx-palette" },
        h("input", {
          className: "sx-input",
          autoFocus: true,
          placeholder: "搜索命令（命令名 / 说明 / 分组都能搜）…",
          value: q,
          onInput: (e) => (setQ(e.target.value), paletteQuery = e.target.value),
          onKeyDown: (e) => {
            if (e.key === "Escape") setPaletteOpen(false);
            if (e.key === "Enter" && rows.length) fill(rows[0].cmd);
          }
        }),
        h(
          "div",
          { className: "sx-pal-list" },
          rows.length ? rows.map(
            (r, i) => h(
              "div",
              { key: `${r.group}-${i}`, className: "sx-pal-row", title: r.cmd, onClick: () => fill(r.cmd) },
              h("span", { className: "sx-pal-group" }, r.group),
              h("code", { className: "sx-pal-cmd" }, r.cmd),
              h("span", { className: "sx-pal-hint" }, r.hint)
            )
          ) : h("div", { className: "sx-hint" }, "没有匹配的命令")
        ),
        h("div", { className: "sx-pal-foot" }, "点击填入命令行（不执行）· Enter 填第一条 · Esc 关闭")
      )
    );
  }
  var history = false;
  var historyQuery = "";
  var setHistoryOpen = (on) => {
    history = Boolean(on);
    if (history) historyQuery = "";
    notify();
  };
  function LogPanel() {
    if (!logs) return null;
    const all = logLines();
    const s = activeSession();
    const mine = s ? all.filter((l) => l.connectionId === s.connId) : all;
    return h(
      "div",
      { className: "sx-overlay", onMouseDown: (e) => e.target === e.currentTarget && setLogOpen(false) },
      h(
        "div",
        { className: "sx-dialog wide" },
        h("div", { className: "sx-dtitle2" }, "日志"),
        h(
          "div",
          { className: "sx-log" },
          mine.length ? mine.map(
            (l, i) => h(
              "div",
              { key: i, className: `sx-log-row ${l.kind}` },
              h("span", { className: "sx-log-time" }, new Date(l.at).toLocaleTimeString()),
              h("span", { className: "sx-log-text" }, l.text)
            )
          ) : h("div", { className: "sx-hint" }, "还没有记录。连接、命令与错误都会记在这里。")
        ),
        h(
          "div",
          { className: "sx-dbtns" },
          h("button", { className: "sx-btn", onClick: clearLog }, "清空"),
          h("button", { className: "sx-btn", onClick: () => navigator.clipboard?.writeText(mine.map((l) => `${new Date(l.at).toISOString()} ${l.text}`).join("\n")) }, "复制"),
          h("button", { className: "sx-btn pri", onClick: () => setLogOpen(false) }, "关闭")
        )
      )
    );
  }
  function HistoryPanel() {
    const [q, setQ] = globalThis.__dshSshTerminalReact.useState(historyQuery);
    if (!history) return null;
    const s = activeSession();
    const all = s?.history ?? [];
    const rows = all.filter((c) => !q.trim() || String(c).includes(q.trim())).slice().reverse();
    const fill = (cmd) => {
      const cur = activeSession();
      if (!cur || cur.status !== "ready") return;
      cur.term.paste(cmd);
      setHistoryOpen(false);
      cur.term.focus();
    };
    return h(
      "div",
      { className: "sx-overlay", onMouseDown: (e) => e.target === e.currentTarget && setHistoryOpen(false) },
      h(
        "div",
        { className: "sx-dialog wide" },
        h("div", { className: "sx-dtitle2" }, "命令历史"),
        h("input", {
          className: "sx-input",
          autoFocus: true,
          placeholder: "过滤…",
          value: q,
          onInput: (e) => (historyQuery = e.target.value, setQ(e.target.value)),
          onKeyDown: (e) => {
            if (e.key === "Escape") setHistoryOpen(false);
            if (e.key === "Enter" && rows.length) fill(rows[0]);
          }
        }),
        h(
          "div",
          { className: "sx-log" },
          rows.length ? rows.slice(0, 500).map(
            (c, i) => h(
              "div",
              { key: i, className: "sx-log-row", title: c, style: { cursor: "pointer" }, onClick: () => fill(c) },
              h("code", { className: "sx-log-text" }, c)
            )
          ) : h("div", { className: "sx-hint" }, all.length ? "没有匹配的命令" : "这条连接还没有历史命令")
        ),
        h("div", { className: "sx-pal-foot" }, "点击填入命令行（不执行）· Enter 填第一条 · Esc 关闭")
      )
    );
  }
  var help = false;
  var setHelpOpen = (on) => {
    help = Boolean(on);
    notify();
  };
  var keyRow = (keys, what, i) => h(
    "div",
    { key: i, className: "sx-key-row" },
    h("span", { className: "sx-key-keys" }, ...String(keys).split(" / ").flatMap((one, j) => j ? [" / ", h("kbd", { key: j }, one)] : [h("kbd", { key: 0 }, one)])),
    h("span", { className: "sx-key-what" }, what)
  );
  function ShortcutsPanel() {
    if (!help) return null;
    return h(
      "div",
      { className: "sx-overlay", onMouseDown: (e) => e.target === e.currentTarget && setHelpOpen(false) },
      h(
        "div",
        { className: "sx-dialog wide" },
        h("div", { className: "sx-dtitle2" }, "快捷键"),
        h("div", { className: "sx-keys-title" }, "本插件"),
        h("div", { className: "sx-keys" }, APP_KEYS.map(([k, w], i) => keyRow(k, w, i))),
        h("div", { className: "sx-keys-title" }, "终端里交给远端 shell（本插件不拦）"),
        h("div", { className: "sx-keys" }, SHELL_KEYS.map(([k, w], i) => keyRow(k, w, i))),
        h("div", { className: "sx-dbtns" }, h("button", { className: "sx-btn pri", autoFocus: true, onClick: () => setHelpOpen(false) }, "知道了"))
      )
    );
  }
  function installShortcuts() {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const inTerm = !!document.activeElement?.closest?.(".xterm");
      const key = e.key.toLowerCase();
      if (e.shiftKey && key === "k") {
        e.preventDefault();
        activeSession()?.term?.clear?.();
        return;
      }
      if (e.shiftKey && key === "h") {
        e.preventDefault();
        setHistoryOpen(!history);
        return;
      }
      if (key === "/" || e.code === "Slash") {
        e.preventDefault();
        setHelpOpen(!help);
        return;
      }
      if (e.shiftKey && key === "a") {
        e.preventDefault();
        state.aiOpen = !state.aiOpen;
        notify();
        return;
      }
      if (e.shiftKey && key === "m") {
        e.preventDefault();
        state.drawer = state.drawer === "monitor" ? null : "monitor";
        notify();
        return;
      }
      if (e.shiftKey && key === "b") {
        e.preventDefault();
        state.drawer = state.drawer === "files" ? null : "files";
        notify();
        return;
      }
      if (e.shiftKey && key === "w") {
        e.preventDefault();
        const s = activeSession();
        if (s) closeSession(s);
        return;
      }
      if (key === "tab") {
        e.preventDefault();
        cycleTab(e.shiftKey ? -1 : 1);
        return;
      }
      if (/^[1-9]$/.test(e.key)) {
        e.preventDefault();
        const target = state.sessions[Number(e.key) - 1];
        if (target) activate(target);
        return;
      }
      if (key === "t") {
        e.preventDefault();
        void editConnection(null, null).then((ok2) => ok2 && reloadTree());
        return;
      }
      if (!e.shiftKey && key === "k") {
        e.preventDefault();
        setPaletteOpen(!palette);
        return;
      }
      if (e.shiftKey && key === "l") {
        e.preventDefault();
        setLogOpen(!logs);
        return;
      }
      if (!e.shiftKey && key === "r" && !inTerm) {
        e.preventDefault();
        setHistoryOpen(!history);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }

  // src/editor.js
  var editor = {
    open: false,
    connection: null,
    path: "",
    text: "",
    saved: "",
    mtime: null,
    busy: false,
    error: "",
    force: false
  };
  var subs3 = /* @__PURE__ */ new Set();
  var notifyEditor = () => [...subs3].forEach((f) => f());
  function useEditorState() {
    const [, set] = globalThis.__dshSshTerminalReact.useState(0);
    globalThis.__dshSshTerminalReact.useEffect(() => {
      const f = () => set((v) => v + 1);
      subs3.add(f);
      return () => subs3.delete(f);
    }, []);
    return editor;
  }
  async function openEditor(connectionId, path) {
    editor.open = true;
    editor.connection = connectionId;
    editor.path = path;
    editor.text = "";
    editor.saved = "";
    editor.mtime = null;
    editor.busy = true;
    editor.error = "";
    editor.force = false;
    notifyEditor();
    try {
      const r = await api("files/read", void 0, { connection: connectionId, path });
      editor.text = r.text;
      editor.saved = r.text;
      editor.mtime = r.mtime;
    } catch (e) {
      editor.error = e.message;
    }
    editor.busy = false;
    notifyEditor();
  }
  function closeEditor() {
    editor.open = false;
    notifyEditor();
  }
  async function saveEditor(force = false) {
    if (editor.busy) return;
    editor.busy = true;
    editor.error = "";
    notifyEditor();
    try {
      const r = await api("files/write", {
        connection: editor.connection,
        path: editor.path,
        text: editor.text,
        // 已经坚持要覆盖过一次，就不再带旧 mtime（否则会一直被挡）
        mtime: force || editor.force ? void 0 : editor.mtime
      });
      editor.saved = editor.text;
      editor.mtime = r.mtime;
      editor.force = false;
      toast("已保存到服务器", "success");
    } catch (e) {
      if (e.code === "mtime_changed") {
        editor.force = true;
        editor.error = "这个文件在你编辑期间被改过了。再按一次 Ctrl+S 就会覆盖。";
      } else {
        editor.error = e.message;
      }
    }
    editor.busy = false;
    notifyEditor();
  }
  function EditorPanel() {
    const st = useEditorState();
    if (!st.open) return null;
    const dirty = st.text !== st.saved;
    const cid = st.connection;
    globalThis.__dshSshTerminalReact.useEffect(() => {
      if (!st.open) return;
      const onKey = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
          e.preventDefault();
          if (dirty) void saveEditor(editor.force);
        } else if (e.key === "Escape") {
          e.preventDefault();
          closeEditor();
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [st.open, dirty]);
    const unreachable = () => cid ? openEditor(cid, st.path) : void 0;
    return h(
      "div",
      { className: "sx-overlay", onMouseDown: (e) => e.target === e.currentTarget && closeEditor() },
      h(
        "div",
        { className: "sx-dialog sx-editor" },
        h(
          "div",
          { className: "sx-editor-head" },
          h("span", { className: "sx-editor-path", title: st.path }, st.path),
          dirty && h("span", { className: "sx-editor-dirty" }, "未保存"),
          h("span", { className: "sx-editor-spacer" }),
          h("button", { className: "sx-btn sm pri", disabled: st.busy || !dirty, onClick: () => saveEditor(editor.force) }, "保存 (Ctrl+S)"),
          h("button", { className: "sx-btn sm", onClick: closeEditor }, "关闭")
        ),
        st.error && h(
          "div",
          { className: "sx-editor-error" },
          st.error,
          h("button", { className: "sx-btn sm", onClick: unreachable, style: { marginLeft: 8 } }, "重新读取")
        ),
        st.busy && !st.text ? h("div", { className: "sx-hint" }, "读取中…") : h("textarea", {
          className: "sx-editor-body",
          value: st.text,
          spellCheck: false,
          // 行号列不画：等宽 + 关闭折行更接近终端里的观感，行数多时也不卡
          wrap: "off",
          readOnly: st.busy,
          onInput: (e) => {
            editor.text = e.target.value;
            notifyEditor();
          },
          onKeyDown: (e) => {
            if (e.key === "Tab") {
              e.preventDefault();
              const el = e.currentTarget;
              const start = el.selectionStart;
              const value = `${el.value.slice(0, start)}  ${el.value.slice(el.selectionEnd)}`;
              editor.text = value;
              notifyEditor();
              requestAnimationFrame(() => {
                el.selectionStart = el.selectionEnd = start + 2;
              });
            }
          }
        })
      )
    );
  }

  // src/edit-gate.js
  var MAX_EDIT_BYTES = 2 * 1024 * 1024;
  var BLOCKED_EXT = /* @__PURE__ */ new Set([
    // 压缩包
    "zip",
    "gz",
    "tgz",
    "bz2",
    "xz",
    "zst",
    "7z",
    "rar",
    "tar",
    "jar",
    "war",
    "whl",
    "deb",
    "rpm",
    // 二进制 / 可执行
    "exe",
    "dll",
    "so",
    "dylib",
    "bin",
    "o",
    "a",
    "class",
    "pyc",
    "wasm",
    "ko",
    "img",
    "iso",
    // 数据库
    "db",
    "sqlite",
    "sqlite3",
    "mdb",
    "dat",
    // 文档
    "pdf",
    "doc",
    "docx",
    "xls",
    "xlsx",
    "ppt",
    "pptx",
    "odt",
    // 图片音视频
    "png",
    "jpg",
    "jpeg",
    "gif",
    "bmp",
    "webp",
    "ico",
    "svgz",
    "tiff",
    "mp3",
    "mp4",
    "avi",
    "mkv",
    "mov",
    "flac",
    "wav",
    "ogg",
    "webm",
    "m4a",
    // 字体
    "ttf",
    "otf",
    "woff",
    "woff2",
    "eot",
    // 密钥二进制
    "ppk",
    "p12",
    "pfx",
    "jks",
    "der"
  ]);
  function extensionOf(name) {
    const base = String(name ?? "").split(/[\\/]/).pop() ?? "";
    const m = /\.([A-Za-z0-9]{1,10})$/.exec(base);
    return m ? m[1].toLowerCase() : "";
  }
  function canEdit(file) {
    const name = file?.name ?? file?.path ?? "";
    const size = Number(file?.size ?? 0);
    if (size > MAX_EDIT_BYTES) {
      return { ok: false, reason: `文件有 ${(size / 1048576).toFixed(1)} MB，超过 2 MB 不在页面里编辑` };
    }
    const ext = extensionOf(name);
    if (ext && BLOCKED_EXT.has(ext)) {
      return { ok: false, reason: `.${ext} 属于二进制或归档格式，不适合当文本编辑` };
    }
    return { ok: true };
  }

  // src/transfer.js
  var KEEP = 30;
  var list = [];
  var seq2 = 0;
  var notifyFn = null;
  var onTransferChange = (fn) => {
    notifyFn = fn;
  };
  var emit = () => notifyFn?.();
  var transfers = () => list;
  function transferPct(t) {
    if (!t || !t.size) return 0;
    return Math.min(100, Math.max(0, Math.round(t.loaded / t.size * 100)));
  }
  function startTransfer(info) {
    const t = {
      id: `t${++seq2}`,
      name: String(info.name ?? ""),
      direction: info.direction,
      size: Number(info.size) || 0,
      loaded: 0,
      state: "running",
      from: String(info.from ?? ""),
      to: String(info.to ?? ""),
      startedAt: Date.now()
    };
    list.unshift(t);
    if (list.length > KEEP) list.length = KEEP;
    emit();
    return t;
  }
  function progressTransfer(t, loaded) {
    if (!t || t.state !== "running") return;
    t.loaded = Math.max(0, Number(loaded) || 0);
    emit();
  }
  function finishTransfer(t, error) {
    if (!t || t.state !== "running") return;
    if (error) {
      t.state = "failed";
      t.error = error instanceof Error ? error.message : String(error);
    } else {
      t.state = "done";
      if (!t.size) t.size = t.loaded;
      t.loaded = t.size;
    }
    emit();
  }
  function clearFinished() {
    for (let i = list.length - 1; i >= 0; i--) if (list[i].state !== "running") list.splice(i, 1);
    emit();
  }
  function formatBytes(n) {
    const v = Number(n) || 0;
    if (v < 1024) return `${v} B`;
    if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
    if (v < 1024 * 1024 * 1024) return `${(v / 1048576).toFixed(1)} MB`;
    return `${(v / 1073741824).toFixed(2)} GB`;
  }

  // src/style.css
  var style_default = ".sx-root{\n  /* 颜色全部走宿主令牌。兜底值是**浅色**的：DSH 默认浅色主题，若宿主某天没提供\n     某个变量，掉下来也必须还是浅灰，而不是把浅色界面砸出一块深色。\n     （上一版把 LiteShell 的深色写成了兜底，结果浅色主题下选中行变成纯黑。） */\n  --sx-bg:var(--dsw-alias-bg-base,var(--dsw-alias-bg-layer-1,#ffffff));\n  --sx-bg2:var(--dsw-alias-bg-layer-2,#f7f7f8);\n  --sx-side:var(--dsw-specific-sidebar-fill,var(--dsw-alias-bg-layer-2,#f7f7f8));\n  --sx-pop:var(--dsw-alias-bg-overlay,#ffffff);\n  --sx-b1:var(--dsw-alias-border-l1,#e5e5e8);\n  --sx-b2:var(--dsw-alias-border-l2,#d4d4d8);\n  --sx-fg:var(--dsw-alias-label-primary,#1f2328);\n  --sx-fg2:var(--dsw-alias-label-secondary,#6b7280);\n  /* 更淡的第三级文字：自己按当期前景色混出来，明暗主题都合适。 */\n  --sx-fg3:color-mix(in srgb,var(--sx-fg2) 78%,var(--sx-bg));\n  --sx-accent:var(--dsw-alias-brand-primary,#3b82f6);\n  --sx-accent-dim:color-mix(in srgb,var(--sx-accent) 60%,var(--sx-bg));\n  --sx-ok:var(--dsw-alias-state-success-primary,#16a34a);\n  --sx-warn:var(--dsw-alias-state-warn-primary,#d97706);\n  --sx-err:var(--dsw-alias-state-error-primary,#dc2626);\n  /* 悬停/选中一律是「前景色掺一点点底色」，不写死任何亮度：\n     浅色主题得到淡灰，深色主题得到略亮的灰，都不会出现反色块。 */\n  --sx-hover:color-mix(in srgb,var(--sx-fg) 6%,var(--sx-bg));\n  --sx-active:color-mix(in srgb,var(--sx-fg) 11%,var(--sx-bg));\n  --sx-sel:color-mix(in srgb,var(--sx-accent) 18%,transparent);\n  --sx-radius:5px;\n  display:flex;height:100%;width:100%;background:var(--sx-bg);color:var(--sx-fg);font-size:13px;overflow:hidden;position:relative}\n.sx-root *{box-sizing:border-box}\n.sx-root button{font:inherit;color:inherit}\n.sx-btn{padding:4px 10px;border:1px solid var(--sx-b2);border-radius:5px;background:transparent;cursor:pointer;font-size:12px;white-space:nowrap}\n.sx-btn:hover:not(:disabled){background:var(--sx-hover)}\n.sx-btn:disabled{opacity:.45;cursor:not-allowed}\n.sx-btn.pri{background:var(--sx-accent);border-color:transparent;color:#fff}\n.sx-btn.pri:hover:not(:disabled){filter:brightness(1.1);background:var(--sx-accent)}\n.sx-btn.dng{background:var(--sx-err);border-color:transparent;color:#fff}\n.sx-btn.sm{padding:2px 7px}\n.sx-input{width:100%;padding:6px 9px;border:1px solid var(--sx-b2);border-radius:5px;background:var(--sx-bg);color:var(--sx-fg);font:inherit}\n.sx-input:focus{outline:none;border-color:var(--sx-accent)}\n/* 左侧连接树 */\n/* 侧栏：不画右边框，靠底色(略深的面板色)和主区区分开——和宿主自己的侧栏一致。 */\n.sx-side{width:272px;flex-shrink:0;display:flex;flex-direction:column;background:var(--sx-side);transition:width .15s}\n.sx-side.collapsed{width:28px;align-items:center;padding-top:8px}\n/* 折叠连接栏：无边框图标按钮，悬停才浮出底色。 */\n.sx-collapse{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;border:0;border-radius:5px;background:transparent;color:var(--sx-fg3);cursor:pointer}\n.sx-collapse:hover{background:var(--sx-hover);color:var(--sx-fg)}\n.sx-side.collapsed .sx-collapse{width:100%;height:32px;border-radius:0}\n.sx-side-head{padding:10px;display:flex;flex-direction:column;gap:8px}\n.sx-side-top{display:flex;gap:6px;align-items:center}\n.sx-side-btns{display:flex;gap:6px}\n.sx-side-btns .sx-btn{flex:1}\n.sx-tree{flex:1;overflow-y:auto;padding:4px 0}\n.sx-tree.drop{background:var(--sx-sel)}\n.sx-row{display:flex;align-items:center;gap:6px;padding:5px 10px;cursor:pointer;user-select:none;min-width:0}\n.sx-row:hover{background:var(--sx-hover)}\n.sx-row.sel{background:var(--sx-sel)}\n.sx-row.drop{outline:1px dashed var(--sx-accent);outline-offset:-2px}\n.sx-chev{width:12px;color:var(--sx-fg2);font-size:10px;flex-shrink:0;text-align:center}\n.sx-dot{width:7px;height:7px;border-radius:50%;background:var(--sx-b2);flex-shrink:0}\n.sx-dot.ok{background:var(--sx-ok)}.sx-dot.warn{background:var(--sx-warn)}.sx-dot.err{background:var(--sx-err)}\n.sx-row-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0;max-width:60%}\n.sx-row-sub{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--sx-fg2);font-size:11px;min-width:0}\n.sx-row.folder .sx-row-name{font-weight:600;max-width:none;flex:1}\n.sx-count{color:var(--sx-fg2);font-size:11px}\n.sx-hint{padding:18px 14px;color:var(--sx-fg2);line-height:1.7;text-align:center}\n/* 右侧 */\n.sx-main{flex:1;min-width:0;display:flex;flex-direction:column}\n.sx-tabs{display:flex;gap:2px;padding:6px 8px 0;background:var(--sx-bg2);overflow-x:auto;min-height:34px}\n.sx-tab{display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:6px 6px 0 0;cursor:pointer;white-space:nowrap;color:var(--sx-fg2);max-width:220px}\n.sx-tab:hover{background:var(--sx-hover)}\n.sx-tab.on{background:var(--sx-bg);color:var(--sx-fg)}\n.sx-tab-name{overflow:hidden;text-overflow:ellipsis}\n.sx-tab-x{opacity:.55;font-size:15px;line-height:1;padding:0 2px;border-radius:3px}\n.sx-tab-x:hover{opacity:1;background:var(--sx-hover)}\n.sx-unread{width:6px;height:6px;border-radius:50%;background:var(--sx-accent)}\n/* 工具栏：无边框，只靠一点点留白和字色层次区分。 */\n.sx-toolbar{display:flex;align-items:center;gap:2px;padding:3px 8px;background:var(--sx-bg)}\n.sx-tbtn{padding:3px 9px;border:0;border-radius:5px;background:transparent;color:var(--sx-fg3);font:inherit;font-size:11px;cursor:pointer;white-space:nowrap;line-height:1.5}\n.sx-tbtn:hover:not(:disabled){background:var(--sx-hover);color:var(--sx-fg)}\n.sx-tbtn.on{background:var(--sx-active);color:var(--sx-accent)}\n.sx-tbtn:disabled{opacity:.4;cursor:not-allowed}\n.sx-tbtn-sep{width:1px;height:14px;margin:0 4px;background:var(--sx-b1);flex:none}\n.sx-tb-status{margin-left:auto;color:var(--sx-fg2);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.sx-body{flex:1;min-height:0;display:flex}\n.sx-termwrap{flex:1;min-width:0;position:relative;background:var(--sx-bg)}\n.sx-view{position:absolute;inset:0}\n.sx-view:not(.active){display:none}\n.sx-host{position:absolute;inset:0}\n.sx-termel{width:100%;height:100%;background:var(--sx-bg)}\n/* xterm 的宿主放在内层：xterm 会给 open() 的元素加 `.xterm` 类，外层保持面板底色。\n   xterm.css 里有两处写死的黑底，都必须盖掉，否则浅色主题下终端区域会发黑：\n     `.xterm{background-color:#000}`             —— 外层\n     `.xterm .xterm-viewport{background-color:#000}` —— 滚动视口（真正显色的那一层）\n   终端背景应当由 termTheme() 的 theme.background 决定，不是 #000。 */\n.sx-termel .sx-termhost{width:100%;height:100%}\n.sx-termel .xterm,\n.sx-termel .xterm .xterm-viewport,\n.sx-termel .xterm .xterm-screen{background-color:var(--sx-bg) !important}\n.sx-host .xterm{padding:6px 0 0 10px;height:100%}\n.sx-msg{position:absolute;inset:0;display:flex;flex-direction:column;gap:12px;align-items:center;justify-content:center;background:var(--sx-bg);color:var(--sx-fg2);text-align:center;padding:24px}\n.sx-msg.err{color:var(--sx-err)}\n.sx-closed{position:absolute;left:0;right:0;bottom:0;display:flex;gap:10px;align-items:center;justify-content:center;padding:8px;background:var(--sx-bg2);border-top:1px solid var(--sx-b1);color:var(--sx-warn)}\n.sx-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--sx-fg2)}\n.sx-searchbar{position:absolute;top:8px;right:16px;z-index:5;display:flex;gap:4px;align-items:center;padding:6px;background:var(--sx-pop);border:1px solid var(--sx-b2);border-radius:7px;box-shadow:0 4px 14px rgba(0,0,0,.3)}\n.sx-searchbar .sx-input{width:200px;padding:3px 8px}\n.sx-suggest{position:absolute;z-index:5;min-width:320px;max-width:min(640px,90%);background:var(--sx-pop);border:1px solid var(--sx-b2);border-radius:4px;padding:4px;box-shadow:0 4px 14px rgba(0,0,0,.3)}\n.sx-sug{display:flex;gap:14px;justify-content:space-between;padding:4px 9px;border-radius:4px;cursor:pointer}\n.sx-sug.on,.sx-sug:hover{background:var(--sx-sel)}\n.sx-sug-cmd{font-family:'JetBrains Mono','Cascadia Mono',Consolas,monospace;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.sx-sug-hint{color:var(--sx-fg2);font-size:11px;white-space:nowrap}\n.sx-sug-foot{padding:4px 9px 2px;color:var(--sx-fg2);font-size:11px;border-top:1px solid var(--sx-b1);margin-top:3px}\n/* 抽屉 */\n.sx-drawer{width:380px;flex-shrink:0;display:flex;flex-direction:column;background:var(--sx-bg2);min-width:0}\n.sx-dhead{display:flex;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid var(--sx-b1)}\n.sx-dtitle{font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.sx-dbody{flex:1;overflow-y:auto;min-height:0}\n.sx-path{display:flex;gap:4px;padding:8px 10px;border-bottom:1px solid var(--sx-b1)}\n.sx-frow{display:flex;align-items:center;gap:8px;padding:5px 10px;cursor:default}\n.sx-frow:hover{background:var(--sx-hover)}\n.sx-frow.dir{cursor:pointer}\n.sx-fname{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.sx-fmeta{color:var(--sx-fg2);font-size:11px;white-space:nowrap}\n.sx-fact{display:none;gap:3px}\n.sx-frow:hover .sx-fact{display:flex}\n.sx-frow:hover .sx-fmeta{display:none}\n.sx-dropzone{outline:2px dashed var(--sx-accent);outline-offset:-4px}\n.sx-sec{padding:10px 12px;border-bottom:1px solid var(--sx-b1)}\n.sx-sec-t{font-weight:600;margin-bottom:6px;display:flex;justify-content:space-between}\n.sx-kv{display:flex;justify-content:space-between;gap:10px;padding:2px 0;font-size:12px}\n.sx-kv span:first-child{color:var(--sx-fg2);flex-shrink:0}\n.sx-kv span:last-child{text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.sx-bar{height:6px;border-radius:3px;background:var(--sx-hover);overflow:hidden;margin:4px 0}\n.sx-bar i{display:block;height:100%;background:var(--sx-accent);transition:width .4s}\n.sx-bar i.warn{background:var(--sx-warn)}.sx-bar i.err{background:var(--sx-err)}.sx-bar i.ok{background:var(--sx-ok)}\n.sx-proc{display:grid;grid-template-columns:48px 1fr 46px 56px;gap:6px;font-size:11px;padding:2px 0}\n.sx-proc span:nth-child(n+3){text-align:right}\n.sx-proc span:nth-child(2){overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n/* ── 资源监控 ──────────────────────────────────────────────────────────────\n   版式：预警条 → 主机信息 → 四张读数卡（两列）→ 可折叠的 GPU/NPU/磁盘/进程/网卡。\n   所有颜色都走主题令牌，亮色主题自动跟随。 */\n.sx-monitor{width:420px}\n.sx-dhead-r{display:flex;align-items:center;gap:8px;flex-shrink:0}\n.sx-dim{color:var(--sx-fg2);font-size:11px}\n.sx-malert{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:8px 10px 0;padding:7px 10px;border-radius:6px;font-size:12px;line-height:1.5;background:var(--sx-hover);border-left:3px solid var(--sx-ok)}\n.sx-malert.warn{border-left-color:var(--sx-warn)}\n.sx-malert.err{border-left-color:var(--sx-err)}\n.sx-pill{display:inline-block;padding:1px 8px;border-radius:10px;font-size:11px;font-weight:600;background:color-mix(in srgb,var(--sx-warn) 22%,transparent);color:var(--sx-warn)}\n.sx-pill.err{background:color-mix(in srgb,var(--sx-err) 22%,transparent);color:var(--sx-err)}\n.sx-minfo{margin:8px 10px 0;color:var(--sx-fg2);font-size:11px;line-height:1.6;display:flex;flex-direction:column;gap:2px}\n.sx-mgrid{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px 10px 0}\n.sx-mcard,.sx-mblock{padding:8px 10px;border:1px solid var(--sx-b1);border-radius:7px;background:var(--sx-bg);min-width:0}\n.sx-mcard-t{display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-size:12px;color:var(--sx-fg2);margin-bottom:4px}\n.sx-mcard-t b{font-size:15px;font-weight:600;color:var(--sx-fg);font-variant-numeric:tabular-nums}\n.sx-mcard-t b.warn{color:var(--sx-warn)}\n.sx-mcard-t b.err{color:var(--sx-err)}\n.sx-mcard-sub{font-size:11px;color:var(--sx-fg2);margin-top:4px;line-height:1.5;overflow:hidden;text-overflow:ellipsis}\n.sx-spark{display:block;width:100%;min-width:0;color:var(--sx-accent)}\n.sx-bar.sm{height:4px;margin:5px 0 0}\n.sx-fold{margin:8px 10px 0;border:1px solid var(--sx-b1);border-radius:7px;overflow:hidden;background:var(--sx-bg)}\n.sx-fold-h{display:flex;align-items:center;gap:6px;width:100%;padding:7px 10px;border:0;background:var(--sx-hover);color:var(--sx-fg);font:inherit;font-size:12px;text-align:left;cursor:pointer}\n.sx-fold-h:hover{filter:brightness(1.15)}\n.sx-caret{color:var(--sx-fg2);width:10px;flex-shrink:0}\n.sx-fold-r{margin-left:auto;color:var(--sx-fg2);font-size:11px;font-variant-numeric:tabular-nums}\n.sx-fold-b{padding:8px 10px;display:flex;flex-direction:column;gap:8px}\n.sx-proc-row{padding:6px 0;border-bottom:1px solid var(--sx-b1);font-size:11px;line-height:1.5}\n.sx-proc-row:last-child{border-bottom:0;padding-bottom:0}\n.sx-proc-l1{display:flex;align-items:baseline;gap:8px}\n.sx-proc-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}\n.sx-proc-metric{font-variant-numeric:tabular-nums;font-weight:600;flex-shrink:0}\n.sx-proc-metric.warn{color:var(--sx-warn)}.sx-proc-metric.err{color:var(--sx-err)}\n.sx-proc-l2,.sx-proc-l3{display:flex;gap:8px;color:var(--sx-fg2);margin-top:2px}\n.sx-proc-l3{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block}\n.sx-monitor .sx-dbody{padding-bottom:12px}\n/* 窄面板时四张卡改成单列，读数不被压成省略号 */\n@media (max-width:520px){.sx-mgrid{grid-template-columns:1fr}}\n/* 对话框 */\n.sx-overlay{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5)}\n.sx-dialog{width:440px;max-width:92vw;max-height:88vh;display:flex;flex-direction:column;background:var(--sx-pop);color:var(--sx-fg);border:1px solid var(--sx-b2);border-radius:10px;box-shadow:0 10px 36px rgba(0,0,0,.45);padding:18px}\n.sx-dialog.wide{width:640px}\n.sx-dtitle2{font-size:15px;font-weight:600;margin-bottom:12px}\n.sx-dmsg{margin-bottom:6px;line-height:1.6;word-break:break-word}\n.sx-ddetail{color:var(--sx-fg2);font-size:12px;line-height:1.6;margin-bottom:6px}\n.sx-dbtns{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}\n.sx-form{display:flex;flex-direction:column;gap:10px;overflow-y:auto;padding:2px}\n.sx-field label{display:block;margin-bottom:3px;color:var(--sx-fg2);font-size:12px}\n.sx-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}\n.sx-two:has(> :only-child){grid-template-columns:1fr}\n.sx-check{display:flex;align-items:center;gap:6px;margin-top:8px;font-size:12px;color:var(--sx-fg2)}\n.sx-imp-tabs{display:flex;gap:6px;margin-bottom:10px}\n.sx-imp-list{overflow-y:auto;border:1px solid var(--sx-b1);border-radius:6px;min-height:120px;max-height:46vh}\n.sx-imp-row{display:flex;align-items:center;gap:8px;padding:5px 10px;border-bottom:1px solid var(--sx-b1)}\n.sx-imp-row.dup{opacity:.5}\n.sx-imp-row:last-child{border-bottom:0}\n/* 菜单与提示 */\n.sx-menu{position:fixed;z-index:1100;min-width:140px;padding:4px;background:var(--sx-pop);color:var(--sx-fg);border:1px solid var(--sx-b2);border-radius:7px;box-shadow:0 6px 20px rgba(0,0,0,.4)}\n.sx-mi{padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px}\n.sx-mi:hover{background:var(--sx-sel)}\n.sx-mi.dng{color:var(--sx-err)}\n.sx-msep{height:1px;background:var(--sx-b1);margin:4px 2px}\n.sx-input.sm{padding:3px 7px;font-size:12px;margin-bottom:2px}\n.sx-sub{color:var(--sx-fg2);font-size:11px}\n.sx-info{display:flex;flex-direction:column;gap:6px;overflow-y:auto;font-size:12px;line-height:1.6;color:var(--sx-fg2);word-break:break-all}\n.sx-toast{position:fixed;right:18px;bottom:18px;z-index:1200;max-width:380px;padding:10px 14px;background:var(--sx-pop);color:var(--sx-fg);border:1px solid var(--sx-b2);border-left:3px solid var(--sx-accent);border-radius:6px;box-shadow:0 4px 14px rgba(0,0,0,.35);word-break:break-word}\n.sx-toast.error{border-left-color:var(--sx-err)}.sx-toast.success{border-left-color:var(--sx-ok)}\n\n/* ── AI 面板 ─────────────────────────────────────────────────────────────\n   和监控抽屉并排：左边一条可拖的边，正文是一列「一步一折叠」的卡片。 */\n.sx-ai{display:flex;flex-direction:column;background:var(--sx-bg2);min-width:320px;position:relative;min-height:0}\n.sx-ai-grip{position:absolute;left:-2px;top:0;bottom:0;width:5px;cursor:col-resize;z-index:2}\n.sx-ai-grip:hover{background:var(--sx-accent)}\n.sx-ai-model{max-width:190px;padding:2px 6px;font-size:11px}\n.sx-ai-body{flex:1;overflow-y:auto;min-height:0;padding:10px;display:flex;flex-direction:column;gap:8px}\n.sx-ai-user{align-self:flex-end;max-width:88%;padding:7px 11px;border-radius:10px 10px 2px 10px;background:var(--sx-accent);color:#fff;font-size:12px;line-height:1.6;white-space:pre-wrap;word-break:break-word}\n.sx-ai-interim{align-self:flex-start;max-width:92%;color:var(--sx-fg2);font-size:11px;line-height:1.7;font-style:italic}\n.sx-ai-interim.err{color:var(--sx-err);font-style:normal}\n.sx-ai-answer{align-self:flex-start;max-width:96%;padding:8px 11px;border:1px solid var(--sx-b1);border-radius:10px 10px 10px 2px;background:var(--sx-bg);font-size:12px;line-height:1.7;word-break:break-word}\n.sx-ai-dots{color:var(--sx-accent);animation:sx-blink 1s steps(2) infinite}\n@keyframes sx-blink{50%{opacity:0}}\n/* 工具步骤卡片 */\n.sx-agent-step{border:1px solid var(--sx-b1);border-left-width:3px;border-left-color:var(--sx-b2);border-radius:7px;background:var(--sx-bg);overflow:hidden}\n.sx-agent-step.asking{border-left-color:var(--sx-warn)}\n.sx-agent-step.asking.err{border-left-color:var(--sx-err)}\n.sx-agent-step.failed{border-left-color:var(--sx-err)}\n.sx-agent-step.ok{border-left-color:var(--sx-ok)}\n.sx-step-h{display:flex;align-items:center;gap:6px;width:100%;padding:6px 9px;border:0;background:transparent;color:var(--sx-fg);font:inherit;font-size:11px;text-align:left;cursor:pointer}\n.sx-step-h:hover{background:var(--sx-hover)}\n.sx-step-caret{color:var(--sx-fg2);width:10px;flex-shrink:0}\n.sx-step-tag{flex-shrink:0;padding:0 5px;border-radius:4px;background:var(--sx-hover);color:var(--sx-fg2);font-size:10px;text-transform:uppercase;letter-spacing:.04em}\n.sx-step-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--sx-mono,ui-monospace,monospace)}\n.sx-step-badge{flex-shrink:0;color:var(--sx-fg2);font-size:10px}\n.sx-agent-step.failed .sx-step-badge,.sx-agent-step.asking .sx-step-badge{color:var(--sx-warn)}\n.sx-step-b{padding:0 9px 8px}\n.sx-step-reason{color:var(--sx-warn);font-size:11px;margin:4px 0}\n.sx-step-out{margin:0;padding:6px 8px;max-height:260px;overflow:auto;border-radius:5px;background:var(--sx-hover);font-family:var(--sx-mono,ui-monospace,monospace);font-size:11px;line-height:1.5;white-space:pre-wrap;word-break:break-all}\n.sx-step-foot{margin-top:4px;color:var(--sx-fg2);font-size:10px}\n/* 审批卡 */\n.sx-approve{display:flex;flex-direction:column;gap:6px;margin:4px 0}\n.sx-approve-cmd{min-height:52px;font-family:var(--sx-mono,ui-monospace,monospace);font-size:11px;resize:vertical}\n.sx-approve-btns{display:flex;gap:6px;justify-content:flex-end}\n/* 输入区 */\n.sx-ai-input{display:flex;flex-direction:column;gap:6px;padding:8px 10px;border-top:1px solid var(--sx-b1)}\n.sx-ai-input textarea{resize:vertical;min-height:44px;font-family:inherit}\n.sx-ai-actions{display:flex;justify-content:flex-end}\n/* 历史抽屉 */\n.sx-ai-history{position:absolute;inset:36px auto 0 0;width:230px;z-index:3;display:flex;flex-direction:column;gap:6px;padding:8px;overflow-y:auto;background:var(--sx-pop);border-right:1px solid var(--sx-b2)}\n.sx-ai-hgroup{display:flex;flex-direction:column;gap:2px}\n.sx-ai-hlabel{color:var(--sx-fg2);font-size:10px;margin-top:6px}\n.sx-ai-hitem{display:flex;align-items:center;gap:6px;padding:5px 7px;border-radius:5px;font-size:11px;cursor:pointer;overflow:hidden}\n.sx-ai-hitem:hover{background:var(--sx-sel)}\n.sx-ai-htitle{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n/* 删除按钮平时不显示：历史列表要能安静地读，悬停那一条才浮出操作。 */\n.sx-ai-hdel{flex:none;width:16px;text-align:center;color:var(--sx-fg3);opacity:0;border-radius:3px;font-size:14px;line-height:1}\n.sx-ai-hitem:hover .sx-ai-hdel{opacity:1}\n.sx-ai-hdel:hover{background:var(--sx-err);color:#fff}\n/* Markdown */\n.sx-md p{margin:0 0 6px}\n.sx-md p:last-child{margin-bottom:0}\n.sx-md-h{margin:8px 0 4px;font-size:13px;font-weight:600}\n.sx-md-list{margin:0 0 6px;padding-left:18px}\n.sx-md-code{padding:1px 4px;border-radius:3px;background:var(--sx-hover);font-family:var(--sx-mono,ui-monospace,monospace);font-size:11px}\n.sx-md-pre{margin:6px 0;padding:7px 9px;border-radius:5px;background:var(--sx-hover);overflow:auto}\n.sx-md-pre code{font-family:var(--sx-mono,ui-monospace,monospace);font-size:11px;line-height:1.5}\n.sx-md a{color:var(--sx-accent)}\n\n/* ── 命令面板 / 日志 ────────────────────────────────────────────────────── */\n.sx-palette{width:640px;height:70vh;display:flex;flex-direction:column;gap:8px}\n.sx-pal-list{flex:1;overflow-y:auto;border:1px solid var(--sx-b1);border-radius:6px;min-height:0}\n.sx-pal-row{display:flex;align-items:baseline;gap:8px;padding:6px 9px;border-bottom:1px solid var(--sx-b1);cursor:pointer;font-size:11px}\n.sx-pal-row:last-child{border-bottom:0}\n.sx-pal-row:hover{background:var(--sx-sel)}\n.sx-pal-group{flex-shrink:0;width:74px;color:var(--sx-fg2);font-size:10px}\n.sx-pal-cmd{flex-shrink:0;max-width:58%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--sx-mono,ui-monospace,monospace);color:var(--sx-fg)}\n.sx-pal-hint{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--sx-fg2);text-align:right}\n.sx-pal-foot{color:var(--sx-fg2);font-size:10px;text-align:center}\n.sx-log{flex:1;overflow-y:auto;min-height:0;border:1px solid var(--sx-b1);border-radius:6px;padding:6px;font-family:var(--sx-mono,ui-monospace,monospace);font-size:11px;line-height:1.6}\n.sx-log-row{display:flex;gap:8px;padding:1px 0}\n.sx-log-row.error{color:var(--sx-err)}\n.sx-log-row.auto{color:var(--sx-fg2)}\n.sx-log-time{flex-shrink:0;color:var(--sx-fg2)}\n.sx-log-text{min-width:0;word-break:break-all}\n\n/* ── 内置编辑器 ───────────────────────────────────────────────────────────\n   满宽的模态：等宽、不折行、Tab 插两个空格。 */\n.sx-editor{width:min(1100px,94vw);height:88vh;display:flex;flex-direction:column;gap:8px;padding:12px}\n.sx-editor-head{display:flex;align-items:center;gap:8px;min-width:0}\n.sx-editor-path{flex-shrink:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--sx-mono,ui-monospace,monospace);font-size:12px}\n.sx-editor-dirty{flex-shrink:0;color:var(--sx-warn);font-size:10px}\n.sx-editor-spacer{flex:1}\n.sx-editor-error{color:var(--sx-err);font-size:11px;line-height:1.6}\n.sx-editor-body{flex:1;min-height:0;width:100%;padding:10px;border:1px solid var(--sx-b2);border-radius:6px;background:var(--sx-bg);color:var(--sx-fg);font-family:var(--sx-mono,ui-monospace,monospace);font-size:12px;line-height:1.6;resize:none;white-space:pre;overflow:auto;tab-size:2}\n.sx-editor-body:focus{outline:none;border-color:var(--sx-accent)}\n\n/* AI 附件 */\n.sx-ai-files{display:flex;flex-wrap:wrap;gap:6px}\n.sx-ai-file{display:inline-flex;align-items:center;gap:4px;max-width:100%;padding:2px 6px;border:1px solid var(--sx-b1);border-radius:10px;background:var(--sx-hover);font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.sx-ai-file-x{border:0;background:transparent;color:var(--sx-fg2);cursor:pointer;font-size:11px;line-height:1;padding:0 2px}\n.sx-ai-file-x:hover{color:var(--sx-err)}\n.sx-ai-body.drop{outline:2px dashed var(--sx-accent);outline-offset:-4px;background:var(--sx-hover)}\n\n/* 快捷命令条 */\n/* 传输台账：文件面板底部。进行中看百分比，结束后留一行结果，失败把原因写在行上。 */\n.sx-xfers{flex:none;border-top:1px solid var(--sx-b1);background:var(--sx-bg2);padding:6px 10px;max-height:38%;overflow-y:auto}\n.sx-xfers-head{display:flex;align-items:center;justify-content:space-between;font-size:10px;color:var(--sx-fg2);margin-bottom:4px}\n.sx-xfer{padding:4px 0}\n.sx-xfer+.sx-xfer{border-top:1px solid var(--sx-b1)}\n.sx-xfer-head{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px}\n.sx-xfer-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--sx-fg)}\n.sx-xfer-pct{flex:none;color:var(--sx-fg2);font-variant-numeric:tabular-nums}\n.sx-xfer-pct.ok{color:var(--sx-ok)}\n.sx-xfer-pct.err{color:var(--sx-err)}\n.sx-xfer-sub{font-size:10px;color:var(--sx-fg2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n\n/* 快捷键一览：两栏（按键 / 说明），分组之间用标题隔开。 */\n.sx-keys-title{font-size:10px;color:var(--sx-fg2);letter-spacing:.04em;margin:10px 0 4px}\n.sx-keys{display:flex;flex-direction:column;gap:3px;max-height:34vh;overflow-y:auto}\n.sx-key-row{display:flex;align-items:baseline;gap:10px;font-size:11.5px;line-height:1.6}\n.sx-key-keys{flex:none;min-width:210px;color:var(--sx-fg2)}\n.sx-key-keys kbd{display:inline-block;padding:0 5px;border:1px solid var(--sx-b2);border-radius:3px;background:var(--sx-bg);font-family:inherit;font-size:10.5px;color:var(--sx-fg)}\n.sx-key-what{color:var(--sx-fg)}\n";

  // src/entry.jsx
  var fail = (e) => toast(e instanceof Error ? e.message : String(e), "error");
  var show = (c) => `${c.username || ""}@${c.host || ""}${c.port && c.port !== 22 ? ":" + c.port : ""}`;
  function copyText(text, what) {
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    else fallbackCopy(text);
    toast(`已复制 ${what}`, "success");
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
    r.imported ? `新增连接 ${r.imported} 个` : "",
    r.folders ? `新增文件夹 ${r.folders} 个` : "",
    r.skipped ? `跳过重名 ${r.skipped} 个` : "",
    r.missingKeys ? `有 ${r.missingKeys} 个连接的私钥没找到,需要重新指定` : "",
    r.needsPassword ? `有 ${r.needsPassword} 个连接的密码需要重新输入` : "",
    ...(r.warnings || []).map((w) => `⚠ ${w}`)
  ].filter(Boolean);
  function toggleSidebar() {
    setCollapsed(!state.collapsed);
    requestAnimationFrame(() => activeSession()?.fit?.fit());
  }
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
      const subs22 = st.tree.folders.filter((x) => x.parentId === f.id);
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
          h("span", { className: "sx-chev" }, isOpen ? "▼" : "▶"),
          h("span", { className: "sx-row-name" }, f.name),
          h("span", { className: "sx-count" }, `${kids.length}`)
        ),
        isOpen && subs22.map((x) => renderFolder(x, depth + 1)),
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
        !st.loaded ? h("div", { className: "sx-hint" }, "加载中…") : st.tree.connections.length === 0 && st.tree.folders.length === 0 ? h("div", { className: "sx-hint" }, "还没有连接", h("br"), "点上方“新建”或“导入”") : hits ? hits.length ? hits.map((c) => renderConn(c, 0)) : h("div", { className: "sx-hint" }, "没有匹配的连接") : h(Fragment, null, topFolders.map((f) => renderFolder(f, 0)), topConns.map((c) => renderConn(c, 0)))
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
          h("span", { className: "sx-tab-x", onClick: (e) => (e.stopPropagation(), closeSession(s)) }, "×")
        )
      )
    );
  }
  function Toolbar() {
    const st = useStore();
    const s = activeSession();
    const ok2 = s?.status === "ready";
    const drawer = (name) => (state.drawer = state.drawer === name ? null : name, notify());
    const btn = (label, opts = {}) => h(
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
        placeholder: "查找…",
        value: q,
        autoFocus: true,
        onInput: (e) => setQ(e.target.value),
        onKeyDown: (e) => {
          if (e.key === "Enter") find(e.shiftKey ? -1 : 1);
          else if (e.key === "Escape") close();
        }
      }),
      h("button", { className: "sx-btn sm", onClick: () => find(-1) }, "↑"),
      h("button", { className: "sx-btn sm", onClick: () => find(1) }, "↓"),
      h("button", { className: "sx-btn sm", onClick: close }, "×")
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
      h("div", { className: "sx-sug-foot" }, "Tab 补全 · ↑↓ 选择 · Esc 关闭")
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
          x.status === "connecting" && h("div", { className: "sx-msg" }, `正在连接 ${x.name}…`),
          x.status === "error" && h(
            "div",
            { className: "sx-msg err" },
            h("div", null, x.error || "连接失败"),
            h("button", { className: "sx-btn", onClick: () => reconnect(x) }, "重新连接")
          ),
          x.status === "closed" && h(
            "div",
            { className: "sx-closed" },
            h("span", null, "连接已断开"),
            h("button", { className: "sx-btn sm", onClick: () => reconnect(x) }, "重新连接")
          )
        )
      ),
      !s && h("div", { className: "sx-empty" }, "双击左侧的连接打开终端"),
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
          toast(`已上传 ${f.name}`, "success");
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
        toast(`已下载 ${name}`, "success");
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
        h("span", { className: "sx-dtitle" }, "文件"),
        h("button", { className: "sx-btn sm", onClick: async () => {
          const name = await promptText("新建文件夹");
          name && act(() => api("files/mkdir", { connection: cid, path: join(name) }));
        } }, "新建文件夹"),
        h("button", { className: "sx-btn sm", onClick: () => {
          const i = document.createElement("input");
          i.type = "file";
          i.multiple = true;
          i.onchange = () => send([...i.files]);
          i.click();
        } }, "上传"),
        h("button", { className: "sx-btn sm", onClick: () => (state.drawer = null, notify()) }, "×")
      ),
      h(
        "div",
        { className: "sx-path" },
        h("button", { className: "sx-btn sm", disabled: dir.path === "/" || !dir.path, onClick: up }, "↑"),
        h("span", { className: "sx-fname", title: dir.path, style: { alignSelf: "center" } }, dir.path || "…"),
        h("button", { className: "sx-btn sm", onClick: () => load2(dir.path) }, "刷新")
      ),
      h(
        "div",
        {
          className: `sx-dbody ${over ? "sx-dropzone" : ""}`,
          onDragOver: (e) => (e.preventDefault(), setOver(true)),
          onDragLeave: () => setOver(false),
          onDrop: (e) => (e.preventDefault(), setOver(false), e.dataTransfer.files.length && send([...e.dataTransfer.files]))
        },
        busy && !dir.entries.length ? h("div", { className: "sx-hint" }, "加载中…") : !dir.entries.length ? h("div", { className: "sx-hint" }, "空目录（可拖文件到这里上传）") : dir.entries.map(
          (f) => h(
            "div",
            {
              key: f.name,
              className: `sx-frow ${f.isDir ? "dir" : ""}`,
              // 单击目录进入；文件双击进编辑器（单击留给选中，免得误触）
              onClick: f.isDir ? () => load2(join(f.name)) : void 0,
              onDoubleClick: f.isDir ? void 0 : () => {
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
                const cur = typeof f.mode === "number" ? (f.mode & 4095).toString(8).padStart(3, "0") : "";
                const text = await promptText("权限", cur || "644");
                if (text === null || text === void 0) return;
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
    const list2 = transfers();
    if (!list2.length) return null;
    return h(
      "div",
      { className: "sx-xfers" },
      h(
        "div",
        { className: "sx-xfers-head" },
        h("span", null, `传输（${list2.filter((t) => t.state === "running").length} 进行中）`),
        h("button", { className: "sx-btn sm", onClick: () => clearFinished() }, "清除已结束")
      ),
      list2.map((t) => {
        const pct2 = transferPct(t);
        const failed = t.state === "failed";
        const done = t.state === "done";
        return h(
          "div",
          { key: t.id, className: "sx-xfer", title: t.error ? `${t.from} → ${t.to}
${t.error}` : `${t.from} → ${t.to}` },
          h(
            "div",
            { className: "sx-xfer-head" },
            h("span", { className: "sx-xfer-name" }, `${t.direction === "up" ? "↑" : "↓"} ${t.name}`),
            h("span", { className: `sx-xfer-pct ${failed ? "err" : done ? "ok" : ""}` }, failed ? "失败" : done ? "完成" : `${pct2}%`)
          ),
          h("div", { className: "sx-bar sm" }, h("i", { className: failed ? "err" : done ? "ok" : "", style: { width: `${failed || done ? 100 : pct2}%` } })),
          h("div", { className: "sx-xfer-sub" }, failed ? t.error || "失败" : `${formatBytes(t.loaded)} / ${t.size ? formatBytes(t.size) : "?"}`)
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
        h("button", { className: "sx-btn", onClick: () => closeDialog(false) }, "取消"),
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
        h("button", { className: "sx-btn", onClick: () => closeDialog(null) }, "取消"),
        h("button", { className: "sx-btn pri", onClick: ok2 }, "确定")
      )
    );
  }
  function SecretDialog({ d }) {
    const [v, setV] = globalThis.__dshSshTerminalReact.useState("");
    const [keep, setKeep] = globalThis.__dshSshTerminalReact.useState(false);
    const what = d.conn?.authType === "key" ? "私钥口令" : "密码";
    const ok2 = () => v && closeDialog({ secret: v, remember: keep });
    return h(
      Shell,
      { onClose: () => closeDialog(null) },
      h("div", { className: "sx-dtitle2" }, `连接 ${d.conn?.name || ""}`),
      h("div", { className: "sx-ddetail" }, d.message),
      h("input", {
        className: "sx-input",
        type: "password",
        value: v,
        placeholder: `输入${what}`,
        autoFocus: true,
        onInput: (e) => setV(e.target.value),
        onKeyDown: (e) => e.key === "Enter" ? ok2() : e.key === "Escape" && closeDialog(null)
      }),
      h("label", { className: "sx-check" }, h("input", { type: "checkbox", checked: keep, onChange: (e) => setKeep(e.target.checked) }), `连接成功后保存${what}(存入 DSH 凭据库,界面和 Agent 都看不到)`),
      h(
        "div",
        { className: "sx-dbtns" },
        h("button", { className: "sx-btn", onClick: () => closeDialog(null) }, "取消"),
        h("button", { className: "sx-btn pri", disabled: !v, onClick: ok2 }, "连接")
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
      if (!f.host.trim() || !f.username.trim()) return toast("主机和用户名不能为空", "error");
      if (f.authType === "key" && !f.privateKeyPath.trim()) return toast("请填写私钥文件路径", "error");
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
      h("div", { className: "sx-dtitle2" }, c ? "编辑连接" : "新建连接"),
      h(
        "div",
        { className: "sx-form" },
        field("名称(留空则用 用户@主机)", h("input", { className: "sx-input", value: f.name, onInput: set("name"), autoFocus: true })),
        field("主机", h("input", { className: "sx-input", value: f.host, onInput: set("host") })),
        two(
          ["端口", h("input", { className: "sx-input", value: f.port, onInput: set("port") })],
          ["用户名", h("input", { className: "sx-input", value: f.username, onInput: set("username") })]
        ),
        field("认证方式", h(
          "select",
          { className: "sx-input", value: f.authType, onChange: set("authType") },
          h("option", { value: "password" }, "密码"),
          h("option", { value: "key" }, "私钥文件"),
          h("option", { value: "agent" }, "SSH Agent")
        )),
        f.authType === "password" && field(
          c?.hasPassword ? "密码(已保存,留空则不改)" : "密码(可留空,连接时再输入)",
          h("input", { className: "sx-input", type: "password", value: f.password, onInput: set("password") })
        ),
        f.authType === "key" && field("私钥文件路径", h("input", { className: "sx-input", value: f.privateKeyPath, placeholder: "C:\\Users你\\.ssh\\id_ed25519", onInput: set("privateKeyPath") })),
        f.authType === "key" && field(
          c?.hasKeyPassphrase ? "私钥口令(已保存,留空则不改)" : "私钥口令(没有就留空)",
          h("input", { className: "sx-input", type: "password", value: f.keyPassphrase, onInput: set("keyPassphrase") })
        ),
        two(
          [
            "本机网卡(VPN 换地址后自动跟)",
            h(
              "select",
              { className: "sx-input", value: f.localIface, onChange: (e) => setF({ ...f, localIface: e.target.value, localAddress: "" }) },
              h("option", { value: "" }, "不指定"),
              ifaces.map((x, i) => h("option", { key: i, value: x.name }, `${x.name} (${x.address})`)),
              f.localIface && !ifaces.some((x) => x.name === f.localIface) && h("option", { value: f.localIface }, `${f.localIface}(当前不在线)`)
            )
          ],
          ["本机地址(固定,可覆盖)", h("input", { className: "sx-input", value: f.localAddress, placeholder: "留空自动", onInput: set("localAddress") })]
        )
      ),
      h(
        "div",
        { className: "sx-dbtns" },
        h("button", { className: "sx-btn", onClick: () => closeDialog(false) }, "取消"),
        h("button", { className: "sx-btn pri", disabled: busy, onClick: save2 }, "保存")
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
        toast(`已导入 ${r.imported} 个连接`, "success");
        closeDialog(true);
      } catch (e) {
        fail(e);
      }
    };
    return h(
      Shell,
      { wide: true, onClose: () => closeDialog(false) },
      h("div", { className: "sx-dtitle2" }, "导入连接"),
      h(
        "div",
        { className: "sx-imp-tabs" },
        h("button", { className: `sx-btn ${src === "ssh-config" ? "pri" : ""}`, onClick: () => setSrc("ssh-config") }, "~/.ssh/config"),
        h("button", { className: `sx-btn ${src === "liteshell" ? "pri" : ""}`, onClick: () => setSrc("liteshell") }, "LiteShell"),
        h("button", { className: "sx-btn", onClick: () => (closeDialog(false), importFromFile(null)) }, "备份 / FinalShell 文件…")
      ),
      h("div", { className: "sx-ddetail" }, "~/.ssh/config 和 LiteShell 只导入名称、地址、用户和私钥路径,不读取任何密码;需要密码的连接首次打开时会询问。"),
      h(
        "div",
        { className: "sx-imp-list" },
        items === null ? h("div", { className: "sx-hint" }, "读取中…") : err ? h("div", { className: "sx-hint" }, err) : !items.length ? h("div", { className: "sx-hint" }, "没有找到可导入的连接") : items.map((it, i) => h(
          "label",
          { key: i, className: `sx-imp-row ${it.exists ? "dup" : ""}` },
          h("input", { type: "checkbox", disabled: it.exists, checked: sel.has(it.name) && !it.exists, onChange: () => toggle(it.name) }),
          h("span", { className: "sx-fname" }, it.name),
          h("span", { className: "sx-fmeta" }, it.exists ? "已存在" : `${show(it)}${it.folder ? " · " + it.folder : ""}`)
        ))
      ),
      h(
        "div",
        { className: "sx-dbtns" },
        h("button", { className: "sx-btn", onClick: () => closeDialog(false) }, "取消"),
        h("button", { className: "sx-btn pri", disabled: !sel.size || !fresh.length, onClick: go }, `导入 ${[...sel].filter((n) => fresh.some((x) => x.name === n)).length} 个`)
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
        placeholder: custom ? "口令(留空则导出时不带密码)" : "口令",
        onInput: (e) => setV(e.target.value),
        onKeyDown: (e) => e.key === "Enter" ? ok2() : e.key === "Escape" && closeDialog(null)
      }),
      h(
        "div",
        { className: "sx-dbtns" },
        h("button", { className: "sx-btn", onClick: () => closeDialog(null) }, "取消"),
        h("button", { className: "sx-btn pri", onClick: ok2 }, custom ? "导出" : "确定")
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
        h("button", { className: "sx-btn", onClick: pick }, "选择文件…")
      ),
      h(
        "div",
        { className: "sx-dbtns" },
        h("button", { className: "sx-btn", onClick: () => closeDialog(null) }, "取消"),
        h("button", { className: "sx-btn pri", disabled: !v.trim(), onClick: () => closeDialog(v.trim()) }, "确定")
      )
    );
  }
  function InfoDialog({ d }) {
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
        buttons ? buttons.map(
          (b, i) => h(
            "button",
            { key: i, className: `sx-btn${b.primary ? " pri" : ""}`, autoFocus: i === 0, onClick: () => closeDialog(i) },
            b.label
          )
        ) : h("button", { className: "sx-btn pri", autoFocus: true, onClick: () => closeDialog(true) }, "好")
      )
    );
  }
  function ResultDialog({ d }) {
    const lines2 = importReport(d.result);
    return h(
      Shell,
      { onClose: () => closeDialog(true) },
      h("div", { className: "sx-dtitle2" }, d.title),
      lines2.length ? h("div", { className: "sx-info" }, lines2.map((l, i) => h("div", { key: i }, l))) : h("div", { className: "sx-ddetail" }, "没有新增任何连接。"),
      h("div", { className: "sx-dbtns" }, h("button", { className: "sx-btn pri", autoFocus: true, onClick: () => closeDialog(true) }, "好"))
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
  async function exportDialog({ scope, id, name }) {
    let preview = null;
    try {
      preview = await api("export/preview", void 0, { scope, ...id ? { id } : {} });
    } catch {
    }
    const lines2 = [
      preview ? `将导出 ${preview.connections} 条连接、${preview.folders} 个文件夹、${preview.keys} 个私钥` : "",
      preview?.passwords ? `其中 ${preview.passwords} 条连接带着已保存的密码` : "目前没有任何连接保存过密码"
    ].filter(Boolean);
    const passphrase = await secretDialog(
      `导出「${name}」`,
      `${lines2.join("；")}。可以设一个口令把密码一起导出（私钥总是内联在文件里，不受口令影响）；留空则导出不含密码，交给对面重输。`,
      "导出"
    );
    if (passphrase === void 0 || passphrase === null) return;
    const r = await api("export/save", { scope, id, passphrase: passphrase || "" });
    const reveal = async () => {
      const shown = await api("export/reveal", { path: r.path });
      if (shown.ok) toast("已在文件管理器中打开", "success");
      else toast(`目录：${r.dir}（自动打开失败：${shown.reason}）`, "info");
    };
    const report = [
      `已导出 ${r.connections} 条连接、${r.folders} 个文件夹${r.keys ? `、${r.keys} 个私钥` : ""}。`,
      r.passwords ? `其中 ${r.passwords} 条连接的密码已用口令加密写进文件。` : "文件里不含任何密码。",
      `保存位置：${r.path}`,
      r.missing ? `注意：有 ${r.missing} 条连接的私钥文件找不到，没有打包进去。` : ""
    ].filter(Boolean);
    const opened = await infoDialog("导出完成", "", report, [
      { label: "打开所在文件夹", primary: true },
      { label: "知道了" }
    ]);
    if (opened === 0) await reveal();
  }
  async function passwordlessFor(conn) {
    let secret;
    try {
      const r2 = await api("passwordless", { connection: conn.id });
      return infoDialog("免密登录已配置", r2.added ? "公钥已写入服务器的 authorized_keys。" : "服务器上原来就有这把公钥,没有重复写入。", [
        `本机终端里现在可以直接运行:ssh ${r2.alias}`,
        r2.keyPath && `私钥 ${r2.keyPath}`,
        r2.configPath && `配置 ${r2.configPath}`,
        "私钥没有口令,请像密码一样保管它。"
      ].filter(Boolean));
    } catch (e) {
      if (e.code !== "needs_secret") throw e;
      secret = await secretDialog(`配置「${conn.name}」免密登录`, "需要先用密码登录一次,才好在服务器上写入公钥。密码不会存到磁盘。");
      if (!secret) return;
    }
    const r = await api("passwordless", { connection: conn.id, secret });
    return infoDialog("免密登录已配置", r.added ? "公钥已写入服务器的 authorized_keys。" : "服务器上原来就有这把公钥,没有重复写入。", [
      `本机终端里现在可以直接运行:ssh ${r.alias}`,
      r.keyPath && `私钥 ${r.keyPath}`,
      r.configPath && `配置 ${r.configPath}`,
      "私钥没有口令,请像密码一样保管它。"
    ].filter(Boolean));
  }
  async function importFromFile(folderId) {
    const path = await fileDialog("导入连接文件…", "例如 D:备份\\liteshell-backup.json", "支持 LiteShell 备份(.json)、FinalShell 的连接配置(单个文件或导出目录)。只读取名称、地址和用户,密码能解开的才会带过来。");
    if (!path) return;
    const r = await api("import/file", { path: expandPath(path), folderId: folderId || null });
    await reloadTree();
    return resultDialog("导入结果", r);
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
      const name = await promptText("新建文件夹");
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
          }, `${c.name}  `, h("span", { className: "sx-sub" }, show(c)))) : [h("div", { key: "none", className: "sx-hint" }, "没有匹配的连接")]
        );
      } else {
        items.push(
          item("连接", () => openSession(conn)),
          item("编辑", async () => await editConnection(conn) && reloadTree()),
          item("重命名", async () => {
            const name = await promptText("重命名连接", conn.name);
            if (name && name !== conn.name) {
              await api("upsert", { connection: { ...conn, name } });
              await reloadTree();
            }
          }),
          item("复制 IP", () => copyText(conn.host, "IP")),
          item("配置本机免密登录…", () => passwordlessFor(conn)),
          item("导出…", () => exportDialog({ scope: "connection", id: conn.id, name: conn.name })),
          item("复制连接", async () => (await api("duplicate", { id: conn.id }), await reloadTree(), toast("连接已复制", "success"))),
          sep("s1"),
          item("删除", async () => {
            if (await confirmBox(`删除连接“${conn.name}”?`, "已保存的密码也会一起删除。", "删除")) {
              await api("delete", { id: conn.id });
              await reloadTree();
            }
          }, "dng")
        );
      }
    } else if (folder) {
      items.push(
        item("新建连接", async () => await editConnection(null, folder.id) && (setExpanded(folder.id, true), reloadTree())),
        item("新建子文件夹", newFolder(folder.id)),
        sep("s1"),
        item("导入连接文件…", () => importFromFile(folder.id)),
        item("导出此文件夹…", () => exportDialog({ scope: "folder", id: folder.id, name: folder.name })),
        sep("s2"),
        item("重命名", async () => {
          const name = await promptText("重命名文件夹", folder.name);
          if (name && name !== folder.name) {
            await api("folder/save", { id: folder.id, name, parentId: folder.parentId });
            await reloadTree();
          }
        }),
        item("删除", async () => {
          if (await confirmBox(`删除文件夹“${folder.name}”?`, "文件夹里的子文件夹和连接都会被一并删除。", "删除")) {
            await api("folder/delete", { id: folder.id });
            await reloadTree();
          }
        }, "dng")
      );
    } else {
      items.push(
        item("新建连接", async () => await editConnection(null, null) && reloadTree()),
        item("新建文件夹", newFolder(null)),
        sep("s1"),
        item("导入连接文件…", () => importFromFile(null)),
        // 整份导出以前在界面里根本没有入口：后端有 export?scope=all，但没有任何一个菜单
        // 会调它，用户只能导出单条连接或单个文件夹。
        item("导出全部连接…", () => exportDialog({ scope: "all", id: null, name: "全部连接" }))
      );
    }
    return h(
      "div",
      { className: "sx-menu", style: { left: Math.min(m.x, innerWidth - 190), top: Math.min(m.y, innerHeight - 300) } },
      conn && [
        h("input", {
          key: "q",
          className: "sx-input sm",
          placeholder: "搜索连接…",
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
            style.textContent = style_default;
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
})();
