# 文件管理插件优化 —— 设计规格

- 日期：2026-11-25
- 插件：`plugins/vyra-file-manager`（`dsh-vyra-file-manager` 0.4.0 → 0.5.0）
- 状态：待用户审阅

## 1. 目标与范围

用户提出 5 项改进，外加 1 项缺陷修复，全部围绕右侧栏「文件管理」面板：

| # | 需求 | 类别 |
|---|---|---|
| R1 | 可设置「展开右侧栏时默认打开文件管理页」，默认开启 | 新能力 |
| R2 | 筛选面板的「链接」类型项移除，改为「HTML」 | 界面变更 |
| R3 | HTML 文件支持**可用**的预览（当前沙箱过严，等于不可用） | 缺陷修复 + 新能力 |
| R4 | 文件/文件夹可复制到**系统剪贴板**，粘贴到资源管理器得到真副本 | 新能力 |
| R5 | 修复「在资源管理器中打开」在 Windows 上无反应 | 缺陷修复 |
| R6 | 时间线中「无文件变更」的用户消息自动隐藏 | 行为变更 |

非目标（明确不做）：

- 不做服务端缩略图生成、拖拽上传、远程 SSH 写操作（沿用 README 现有边界）。
- 不改 DSH 宿主本体（全部变更留在插件内）。
- 不改动 `/api/vyra-media/*` 既有路由的语义（只新增路由）。
- 不迁移已存的链接卡片数据（直接不再展示，见 R2）。

## 2. 关键决策与理由

### D1 — 默认页实现方式：复用 `vyra-agent-cli-manager` 的已验证模式

同仓库 `plugins/vyra-agent-cli-manager/lib/client.js:1678-1703` 已实现「把侧栏唯一的 guide 页替换成指定 tab」：

```js
function replaceSoleGuide(sidebar, kinds) {
  const sessionId = sidebar.mounted.getSnapshot()
  if (sessionId === undefined || !sidebar.isExpanded()) return
  const [only, ...others] = sidebar.tabsIn(sessionId)
  if (only?.kind !== 'guide' || others.length > 0) return
  if (kinds.get(FILES_KIND) === undefined) return
  sidebar.openTab(FILES_KIND, { replaceTab: only.id })
}
```

本插件采用同一模式，但**让位规则**不同：

- 只在「当前会话只有一个 `guide` tab 且侧栏展开」时替换；
- 若 `sidebarRightTabs` 中**已注册** `files` 类型（即用户装了 `vyra-agent-cli-manager` 且其 `filesDefault` 开关开启），本插件**不替换**，避免两个插件争抢同一个 guide 页；
- 订阅 `sidebarRight.openTabs` 与 `sidebarRight.mounted`，用 `queueMicrotask` 延后执行，处理注册时序。
- 每次替换前检查是否已有本插件的 `media` tab，已存在则不重复打开。

### D2 — 设置项的存放：筛选面板勾选项 + `localStorage` 偏好

现有偏好集中在 `src/client/helpers.js` 的 `readPrefs`/`writePrefs`（键 `dsh-vyra-media-studio.prefs.v2`）。新增字段 `openFilesByDefault: boolean`，默认 `true`。

界面位置：筛选面板（`.vms-filter-panel`）末尾、与「显示隐藏文件」「包含依赖/构建目录」同组，加一个 `vms-check` 勾选框：

> ☑ 展开右侧栏时默认打开文件管理

理由：筛选面板已是本面板唯一的「选项集合」入口，新增独立设置区块对该插件而言过重；勾选项与既有勾选项风格一致，零新样式。

### D3 — HTML 类型项替换与链接移除

`src/client/helpers.js`：

- `TYPE_CHIPS` 移除 `'link'` 改为包含 `'html'`；
- `TYPE_LABEL` 移除 `link`，新增 `html: 'HTML'`；
- `TYPE_ORDER` 同步；
- 新增 `HTML_EXT = new Set(['html', 'htm'])`，并调整 `lib/media-types.js` 的 `kindOf`，使 `html`/`htm` 归类为 `html` 而非 `code`——**Host 与客户端必须同步**（设计文档 §0 已约定 `lib/media-types.js` 是双方共用语义的权威源）。

**链接卡片彻底不再展示**（用户确认「没有纯链接这种情况」）：

- `readLinks` 在 `LibraryBody` 初始化时不再把链接合并进 `items`；
- 添加链接的入口（`AddLinkForm`、「链接」按钮、`detectLinkKind`/`makeLinkItem`/`slideFor` 的 link 分支）一并移除；
- 已存的 `localStorage` 链接数据**不主动清除**（避免破坏性操作），只是不再读取；
- `MEDIA_KINDS` 移除 `'link'`；`mediaOverlayItems` 不再涉及链接。

> 迁移影响：已保存的链接卡片会「消失」。这是用户明确同意的取舍。

### D4 — HTML 预览的沙箱模型

现状 `src/client/preview.js:214-220`：

```js
h('iframe', { className: 'vms-html-frame', sandbox: '', srcDoc: document, ... })
```

`sandbox=""` 意味着禁脚本、禁表单、禁一切子资源请求——页面基本是静态残骸。

改为：

```js
sandbox: 'allow-scripts allow-forms allow-popups allow-modals allow-downloads'
```

**不加 `allow-same-origin`**。这带来一条关键安全性质：iframe 处于唯一的 opaque origin，因此无法：

- 访问 `parent` / `window.top` 的 DOM 或 `postMessage` 到可信 origin；
- 读取 `localStorage` / `sessionStorage` / IndexedDB；
- 携带 DSH 的 Cookie 或 token 发起同源 `fetch`。

仍保留 CSP 注入（`default-src 'none'` 等）作为第二道闸。

**外链资源内联**：仅靠 CSP 的话，`<link rel=stylesheet>`、`<script src>`、`<img src>` 都会被拦。采用 B 方案——Host 侧预取并内联到 `srcDoc`：

- 只解析 `<link rel="stylesheet" href>`、`<script src>`、`<img src>` 三种；
- 本地相对路径 → 经插件自有路由读取（工作区内、无 `..` 越界）；
- 远程 `https://` → Host 侧 `fetch` 后内联；**有体积上限（单文件 2 MB，总计 8 MB）与超时（5 s）**，超出则保留原 URL 并记录为「未内联」；
- 内联失败不影响预览，页面降级显示。

> 该内联代理只服务「HTML 预览」这一个入口，不暴露为通用代理路由，避免成为 SSRF 跳板（详见 §5 安全边界）。

### D5 — 系统剪贴板：FileDrop，粘贴得到真副本

**结论：能做，且是本仓库已有的成熟做法**——`plugins/vyra-screen-recorder/lib/clipboard.ps1` 的 `files` 分支已用 WPF `Clipboard::SetFileDropList` + `Flush()` 实现（必须在写入后 `Flush`，否则进程退出后剪贴板内容消失）。

新增 `POST /api/vyra-media/clipboard`，入参 `{ sessionId, paths: string[] }`：

- 路径在 Host 侧 `resolveInside` + `containsTarget` 校验，**只接受工作区内路径**；
- 逐个 `stat` 确认存在，返回实际绝对路径列表；
- Windows：调用移植的 `lib/clipboard.ps1 -Kind files`（WPF `SetFileDropList` + `Flush`，占用时重试 5 次），**同时**把绝对路径以 `Text` 格式附带写入，兼顾聊天框粘贴场景；
- macOS：`osascript` 写入 `NSPasteboardGeneralPasteboard` 的 `filenames`；
- Linux：`xclip -selection clipboard -t text/uri-list`；
- 平台无可用实现时**明确报错**（`clipboard-unsupported`），不假装成功；
- 剪贴板被占用 → `clipboard-busy`；路径超限 → `bad-request`（单次上限 100 项）。

客户端入口：

- 文件右键菜单新增「复制文件」（文件夹为「复制文件夹」）；
- 批量选择工具条新增「复制」，与现有「复制到…」并列区分（「复制到…」是工作区内复制，「复制」是进系统剪贴板）；
- 成功提示「已复制 N 项，可在资源管理器粘贴」。

### D6 — 「在资源管理器中打开」缺陷根因与修复

根因（实测确认）：`lib/file-ops.js` 直接用 `node:path` 的 `dirname`/`join`，而工作区相对路径在 `lib/paths.js` 中被定义成「按根路径风格选择 `win32`/`posix`」。Windows 下当路径经过 `posix.join` 拼接时，会出现反斜杠被吞、正斜杠混入的畸形路径：

```
posix.join('C:\\...\\plugins', 'vyra-file-manager/src') => C:\\...\\plugins/vyra-file-manager/src
```

`explorer.exe` 收到畸形路径后**静默忽略**，表现为「点了没反应、不报错」。此外 `launch()` 用 `child.on('error', () => {})` 吞掉了所有错误，路由恒返回 `ok:true`。

修复：

1. 在 `lib/paths.js` 新增 `dirnameOf(dirPath)`，按 `isWindowsPath()` 选择 `win32.dirname` / `posix.dirname`；
2. `lib/file-ops.js` 中所有对 `processPath` 的 `dirname`/`join` 改为风格感知版本；
3. Windows 上**文件**用 `explorer.exe /select,"<abs>"`（在资源管理器中选中），**目录**直接 `explorer.exe "<abs>"`；
4. `launch()` 不再吞错：spawn 失败向上抛；路由在调用前 `stat` 目标存在性，**失败返回明确错误码**，面板 toast 展示原因而非静默。

### D7 — 时间线隐藏无产出轮次

现状：`lib/timeline.js` 的 `buildTimeline` 已算出每轮 `files`（可能为空），但 `src/client/timeline.js:147` 仍渲染 `'无产出'` 行。

修复：在 `SessionTimeline` 的 `sections` 计算中，**在按日期分组之前**过滤 `node.files?.length > 0`：

```js
const usable = (Array.isArray(nodes) ? nodes : []).filter(
  node => typeof node.time === 'number' && Array.isArray(node.files) && node.files.length > 0,
)
```

连带效果：

- 日期分节标题的「N 轮」计数自动变准（不再把空轮算进去）；
- 全部轮次都为空时落入既有空态框，文案改为「这条会话还没有产出文件」；
- `TimelineNode` 中 `'无产出'` 分支成为死代码，删除。

已知行为（来自 Host 的窗口归轮逻辑 `lib/timeline.js:218-228`）：某轮只要在「本次提问 → 下次提问」窗口内工作区有文件改动就会显示；纯问答、未改文件的消息会消失。最后一条消息只有在真的改了文件后才会出现。**这是用户要的效果**（用户确认「直接隐藏」）。

## 3. 架构与文件改动

```
plugins/vyra-file-manager/
├── index.js                     （不变）
├── lib/
│   ├── paths.js                 + dirnameOf()
│   ├── file-ops.js              修复 reveal/open 的路径风格与错误可见
│   ├── routes.js                + CLIPBOARD_PATH / + HTML_ASSET_PATH
│   ├── clipboard.js             新增：平台分发 + 调用 clipboard.ps1
│   ├── clipboard.ps1            新增：从 screen-recorder 移植（files/text 分支）
│   ├── html-inline.js           新增：HTML 外链资源解析与内联
│   ├── media-types.js           + html kind
│   └── serve.js                 （不变）
├── src/client/
│   ├── entry.js                 + 默认 tab 替换（D1）
│   ├── helpers.js               类型表、偏好字段、链接相关清理（D2/D3）
│   ├── library.js               筛选面板勾选项、菜单项、批量复制、链接入口移除
│   ├── preview.js               HtmlView 沙箱与内联（D4）
│   ├── timeline.js              无产出过滤（D7）
│   ├── components.js            菜单渲染（若需新增菜单项样式）
│   └── styles.css               + HTML 预览抬头说明、勾选项
├── client.js                    （构建产物，不手改）
├── test*.mjs                    见 §6
└── README.md                    「文件操作边界」段落重写
```

## 4. 数据流

### 4.1 复制到系统剪贴板

```
用户在菜单点「复制文件」
  → POST /api/vyra-media/clipboard { sessionId, paths: ['a.txt','dir/'] }
  → handleAction：解析 workspaceRoot
  → clipboard.js: 逐路径 resolveInside + stat → 绝对路径数组
  → win32: spawn powershell -File lib/clipboard.ps1 -Kind files -Path "a|b"
      → WPF SetFileDropList(paths) + Flush()
      → 附带 Set-Clipboard -Value (多行绝对路径)
  → { ok: true, count: 2 }
  → 面板 toast「已复制 2 项，可在资源管理器粘贴」
```

### 4.2 HTML 预览

```
打开 a.html
  → GET /api/vyra-media/text?path=a.html （既有）
  → HtmlView: useMemo 解析 <link>/<script>/<img>
      → 对每个外链: GET /api/vyra-media/html-asset?sessionId&path=<相对或远程 URL>
         → Host: 工作区相对路径走 fs 读取；http(s) 走 fetch（限流+超时）
         → 返回 { ok, dataUrl } 或 { ok:false, reason }
  → 组装 srcDoc：CSP + 内联后的文档
  → iframe sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads"
  → 抬头显示「脚本在沙箱中运行，无法访问本页数据」
```

## 5. 安全边界

| 面 | 约束 |
|---|---|
| 剪贴板路由 | 仅工作区内路径；单次 ≤100 项；不接受绝对路径作为入参（"path 为空或越界即 403"） |
| HTML 内联 | 仅服务 HTML 预览；工作区相对路径必须通过 `containsTarget`；远程 URL 仅 http(s)；单资源 ≤2 MB、总 ≤8 MB、超时 5 s；不转发 Cookie |
| iframe 沙箱 | 不加 `allow-same-origin`，故 opaque origin；CSP 注入保留 |
| explorer 启动 | 目标路径 `stat` 校验存在；路径经风格感知规范化；不拼接用户可控的 shell 字符串（`/select,` 参数走参数数组而非 `cmd /c`） |

## 6. 测试策略

沿用插件现有测试框架（`node --test`）。

| 文件 | 新增/修改 |
|---|---|
| `test.mjs` | ① `revealFile` 对文件/目录的启动参数（mock spawn）② `dirnameOf` 的跨风格用例 ③ `/api/vyra-media/clipboard` 路由：越界拒绝、超限拒绝、Windows 上真跑（无 Windows 则 skip）④ `html-inline` 纯函数：解析、内联、体积上限 |
| `test-client.mjs` | ① `HtmlView` 断言更新为新 sandbox 值（现固定要求 `sandbox=` 与 `Content-Security-Policy`，需同步）② 类型表不含 `link`、含 `html` ③ 时间线过滤：3 轮其中 1 轮无产出 → 渲染 2 轮 |
| `test-cordis.mjs` | 新增路由注册数量断言 |
| 新增 `test-clipboard.mjs` | `clipboard.js` 平台分发与错误码（mock spawn，跨平台可跑） |

验证命令：`pnpm run build:client && pnpm test`。

界面手测清单（见计划任务）：

1. 新会话打开右侧栏 → 直接是文件管理页；关掉勾选项后再开 → 回到 guide。
2. 类型筛选里有「HTML」，没有「链接」；已存链接卡片不出现。
3. 打开一个带外链 CSS/JS 的 HTML → 有样式与脚本效果；抬头有沙箱说明。
4. 右键文件 →「复制文件」→ 资源管理器粘贴 → 得到副本；右键文件夹同理。
5. 右键文件/文件夹 →「在资源管理器中打开」→ Windows 弹出并（文件）选中。
6. 时间线里纯问答轮消失，改过文件的轮保留。

## 7. 风险

| 风险 | 缓解 |
|---|---|
| 默认 tab 替换与 `vyra-agent-cli-manager` 抢 guide 页 | 检测到其 `files` 类型已注册则让位（D1） |
| HTML 内联被当作 SSRF 跳板 | 独立只读路由 + 体积/超时上限 + 仅 http(s)（§5） |
| `SetFileDropList` 在某些环境需 STA 线程 | 沿用 screen-recorder 已验证的 PowerShell 宿主模型；失败返回明确错误码 |
| 类型语义改动影响 Host 扫描分类 | `lib/media-types.js` 与客户端 `helpers.js` 同步改，并加测试钉死 |
| 版本语义 | 破坏性变更（链接移除）→ major/minor 升级到 0.5.0，README 写明迁移影响 |
