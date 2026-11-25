# 文件管理插件优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `vyra-file-manager` 的右侧栏可默认打开文件管理页、HTML 类型可真正预览、文件可复制进系统剪贴板、资源管理器打开可用，并隐藏时间线里没有文件变更的轮次。

**Architecture:** 六项改动全部留在插件内，分三层落点——Host 路由层（新增剪贴板路由与 HTML 外链内联路由，修复 explorer 启动）、共享词表层（`lib/media-types.js` 与 `src/client/helpers.js` 的类型表同步）、客户端 UI 层（默认 tab 替换、筛选项与菜单、HTML 预览沙箱、时间线过滤）。Host 与客户端不共享代码，因此类型语义必须成对修改并有测试钉死。

**Tech Stack:** Node.js ESM（Host）、React 18 + esbuild 打包（客户端）、`node --test`（测试）、PowerShell/WPF（Windows 剪贴板）、`ctx.fs` 文件系统 seam、`connection.fetch.register`（路由注册）。

**Spec:** `docs/superpowers/specs/2026-11-25-vyra-file-manager-optimization-design.md`

## Global Constraints

- 插件 id 保持 `dsh-vyra-file-manager`；`/api/vyra-media/*` 既有 13 条路由的 path 与 methods **不得改动**（`test.mjs:515-529` 逐条断言）。
- 偏好键保持 `dsh-vyra-media-studio.prefs.v2`（升级不丢设置）。
- 客户端只改 `src/client/**`；改完必须 `pnpm run build:client` 重新生成 `client.js`，**不得手改 `client.js`**。
- 所有路径解析必须经 `fs.resolve` + `containsTarget` 校验，禁止把客户端传来的绝对路径直接交给文件系统或 shell。
- 剪贴板与 explorer 路由只接受工作区内路径。
- 所有新增 Host 代码不得 import `node:path` 的默认导出做路径拼接，统一走 `lib/paths.js` 的风格感知函数。
- 测试命令：`cd plugins/vyra-file-manager && pnpm test`；构建：`pnpm run build:client`。
- 版本：`package.json` 从 `0.4.0` 升到 `0.5.0`。
- 文案为简体中文，标点用全角。

## Review Focus

- **无产出轮次的边界**：某一轮 `files` 为 `undefined`（而非空数组）时不能抛错，也不能让整条时间线空白——应视为无产出并隐藏。
- **畸形/跨风格路径**：Windows 路径含混正斜杠、UNC 路径（`\\server\share`）、以及以 `..` 结尾的目录时，`dirnameOf` 与 explorer 启动参数必须仍然正确。
- **剪贴板被占用**：另一进程持有剪贴板时应重试并最终返回 `clipboard-busy`，绝不静默报告成功。
- **HTML 外链超限**：外链资源超过体积上限或超时，页面必须照常渲染（降级为不内联），不能整页失败。
- **默认 tab 与 cli-manager 共存**：装了 `vyra-agent-cli-manager` 时不能两个插件抢同一个 guide 页反复打开 tab。

---

### Task 1: 风格感知的路径函数与 explorer 启动修复

**Files:**
- Modify: `plugins/vyra-file-manager/lib/paths.js`（末尾追加 `dirnameOf`）
- Modify: `plugins/vyra-file-manager/lib/file-ops.js:101-146`（`run`/`launch`）、`:577-603`（`revealFile`/`openFileWithSystem`）
- Test: `plugins/vyra-file-manager/test.mjs`

**Interfaces:**
- Consumes: `isWindowsPath(value: string): boolean`、`pathContains(parentPath: string, childPath: string): boolean`（`lib/paths.js` 已有）
- Produces:
  - `dirnameOf(value: string): string` — 按路径风格选择 `win32.dirname` / `posix.dirname`
  - `revealFile({ path, fs, workspaceRoot, signal }): Promise<void>`
  - `openFileWithSystem({ path, fs, workspaceRoot, signal }): Promise<void>`
  - `launchDetached(command: string, args: string[], options?: { verbatim?: boolean }): void`（`file-ops.js` 内部，抛错而非吞错）

- [ ] **Step 1: 写失败的测试**

在 `test.mjs` 顶部 import 补 `dirnameOf`：

```js
import { containsTarget, dirnameOf, isWindowsPath, joinWorkspacePath, pathContains, targetPathOf } from './lib/paths.js'
```

追加测试：

```js
test('dirnameOf keeps the path flavour of its input', () => {
  assert.equal(dirnameOf('C:\\work\\project\\a.txt'), 'C:\\work\\project')
  assert.equal(dirnameOf('\\\\server\\share\\dir\\a.txt'), '\\\\server\\share\\dir')
  assert.equal(dirnameOf('/srv/work/a.txt'), '/srv/work')
  // A Windows path must never lose its separators to posix.dirname.
  assert.doesNotMatch(dirnameOf('C:\\work\\project\\a.txt'), /\//u)
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd plugins/vyra-file-manager && node --test --test-name-pattern="dirnameOf" test.mjs`
Expected: FAIL —— `dirnameOf is not a function`（或 import 报错）

- [ ] **Step 3: 在 `lib/paths.js` 实现 `dirnameOf`**

```js
/**
 * The parent of a path, using the path's own spelling.
 * @param {string} value - an absolute path in either accepted spelling.
 * @returns {string} the parent path.
 */
export function dirnameOf(value) {
  return pathApiFor(value).dirname(value)
}
```

在文件顶部 import 里把 `dirname` 加进 `{ posix, win32 }` 的解构（`import { posix, win32 } from 'node:path'` 改为 `import { dirname, posix, win32 }` 不需要——`pathApiFor` 返回的是 `win32`/`posix` 对象，直接用 `pathApiFor(value).dirname(value)` 即可，无需额外 import）。

- [ ] **Step 4: 运行测试确认通过**

Run: `cd plugins/vyra-file-manager && node --test --test-name-pattern="dirnameOf" test.mjs`
Expected: PASS

- [ ] **Step 5: 改 `revealFile` 与 `openFileWithSystem`，并让错误可见**

先写测试（用可注入的启动器避免真的弹窗）。在 `file-ops.js` 的 `revealFile`/`openFileWithSystem` 签名上加可选 `launch: (command, args) => void` 参数（默认用模块内 `launchDetached`），测试替换它来断言参数：

```js
test('revealFile opens the folder for a directory and selects a file', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vms-reveal-'))
  try {
    await mkdir(join(root, 'sub'))
    await writeFile(join(root, 'sub', 'a.txt'), 'x')
    const calls = []
    const launch = (command, args) => { calls.push({ command, args }) }
    const fs = makeTestFs(root)
    await revealFile({ path: 'sub', fs, workspaceRoot: root, launch })
    await revealFile({ path: 'sub/a.txt', fs, workspaceRoot: root, launch })
    assert.equal(calls.length, 2)
    if (process.platform === 'win32') {
      assert.equal(calls[0].command, 'explorer.exe')
      assert.deepEqual(calls[0].args, [join(root, 'sub')])
      assert.deepEqual(calls[1].args, [`/select,${join(root, 'sub', 'a.txt')}`])
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
```

`makeTestFs(root)` 是本任务要在 `test.mjs` 顶部新增的一个 helper（既有用例里内联的假 fs 不动）。它必须是 `async` 函数，因为 `test.mjs` 里 `fs.stat` 的实现是异步的：

```js
/**
 * The fake filesystem seam the route tests already inline, extracted so file-op
 * tests can share it. `stat` is async here just as it is in the Host.
 */
function makeTestFs(root) {
  return {
    async resolve(path, opts = {}) {
      const value = path.startsWith('/') || /^[A-Za-z]:[\\/]/u.test(path) ? path : join(opts.cwd ?? root, path)
      return { targetKey: value, displayPath: value }
    },
    contains(parent, child) {
      return child.displayPath === parent.displayPath
        || child.displayPath.startsWith(`${parent.displayPath}/`)
        || child.displayPath.startsWith(`${parent.displayPath}\\`)
    },
    processPath(target) { return target.displayPath },
    async stat(target) {
      const info = await stat(target.displayPath).catch(() => undefined)
      return info === undefined
        ? undefined
        : { type: info.isFile() ? 'file' : info.isDirectory() ? 'directory' : 'other', size: info.size, version: String(info.mtimeMs) }
    },
  }
}
```

> 注意 `type` 必须区分 `'directory'`——`revealFile` 依赖 `info.isDirectory()`，而 `file-ops.js` 的 `statPath` 用的是 Node 原生 `fs.stat`（带 `isDirectory()` 方法），不是这个 seam。实施时 `revealFile` 继续走原生 `statPath`，`makeTestFs` 只用于从工作区相对路径解析出绝对路径。

- [ ] **Step 6: 运行测试确认失败**

Run: `cd plugins/vyra-file-manager && node --test --test-name-pattern="revealFile" test.mjs`
Expected: FAIL —— `revealFile is not exported`（未导入）或参数不符

- [ ] **Step 7: 实现**

`lib/file-ops.js`：

- 把 `launch(command, args, options)` 改为不吞错：删掉 `child.on('error', () => {})`，改为在 `error` 事件里 `throw` 不可行（异步），因此保留 `try/catch` 的同步抛错，并**额外**让函数返回 `Promise<void>` 以捕获 spawn 失败：

```js
/**
 * Launch a detached process and report an immediate spawn failure.
 * @param {string} command - executable.
 * @param {string[]} args - arguments.
 * @param {{ verbatim?: boolean }} [options] - `windowsVerbatimArguments`.
 * @returns {Promise<void>} resolves once the process is detached.
 */
function launchDetached(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    let child
    try {
      child = spawn(command, args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        windowsVerbatimArguments: options.verbatim === true,
      })
    } catch (error) {
      reject(fail(500, 'spawn-failed', error?.message ?? String(error)))
      return
    }
    child.once('error', error => reject(fail(500, 'spawn-failed', error?.message ?? String(error))))
    child.once('spawn', () => { child.unref(); resolvePromise() })
  })
}
```

- `revealFile` 改为：

```js
export async function revealFile({ path, fs, workspaceRoot, signal, launch = launchDetached }) {
  const resolved = await resolveInside(fs, workspaceRoot, path, signal)
  const info = await statPath(resolved.processPath)
  const absolute = resolved.processPath
  if (process.platform === 'win32') {
    // A file is selected inside Explorer; a folder is opened itself.
    await launch('explorer.exe', [info.isDirectory() ? absolute : `/select,${absolute}`])
    return
  }
  const directory = info.isDirectory() ? absolute : dirnameOf(absolute)
  await launch(process.platform === 'darwin' ? 'open' : 'xdg-open', [directory])
}
```

- `openFileWithSystem` 改为 `await launch(...)`，Windows 分支不变（`explorer.exe [absolute]`），只是不再吞错。
- 文件顶部把 `dirname` 的使用替换为 `dirnameOf`（从 `./paths.js` import）。

- [ ] **Step 8: 跑全量测试**

Run: `cd plugins/vyra-file-manager && pnpm test`
Expected: 全部 PASS（既有用例不得回归）

- [ ] **Step 9: 提交**

```bash
git add plugins/vyra-file-manager/lib/paths.js plugins/vyra-file-manager/lib/file-ops.js plugins/vyra-file-manager/test.mjs
git commit -m "fix(file-manager): open the OS file manager with a flavour-aware path"
```

---

### Task 2: 系统剪贴板复制（Host）

**Files:**
- Create: `plugins/vyra-file-manager/lib/clipboard.js`
- Create: `plugins/vyra-file-manager/lib/clipboard.ps1`
- Modify: `plugins/vyra-file-manager/lib/routes.js`（新增 `CLIPBOARD_PATH` 与 `handleClipboard`）
- Modify: `plugins/vyra-file-manager/package.json`（`files` 增加 `lib/`，已含，无需改动；确认 `lib/` 覆盖新文件）
- Test: `plugins/vyra-file-manager/test.mjs`

**Interfaces:**
- Consumes: `resolveInside` 等价物（`file-ops.js` 内部不可导出，本任务在 `clipboard.js` 内用 `fs.resolve` + `containsTarget` + `targetPathOf` 自行解析，与 `file-ops.js` 保持同一约束）
- Produces:
  - `copyPathsToClipboard({ absolutePaths, spawn? }): Promise<void>` — 平台分发；抛带 `code` 的错误：`clipboard-busy`、`clipboard-unsupported`、`spawn-failed`
  - `resolveClipboardPaths({ paths, fs, workspaceRoot, signal }): Promise<string[]>` — 校验并返回绝对路径
  - `POST /api/vyra-media/clipboard`，请求体 `{ sessionId, paths: string[] }`，成功返回 `{ ok: true, count: number, paths: string[] }`

- [ ] **Step 1: 写失败的测试**

```js
test('resolveClipboardPaths confines every path to the workspace', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vms-clip-'))
  try {
    await writeFile(join(root, 'a.txt'), 'x')
    await mkdir(join(root, 'dir'))
    const fs = makeTestFs(root)
    const paths = await resolveClipboardPaths({ paths: ['a.txt', 'dir'], fs, workspaceRoot: root })
    assert.equal(paths.length, 2)
    await assert.rejects(
      resolveClipboardPaths({ paths: ['../escape.txt'], fs, workspaceRoot: root }),
      error => error.code === 'outside-workspace',
    )
    await assert.rejects(
      resolveClipboardPaths({ paths: [], fs, workspaceRoot: root }),
      error => error.code === 'bad-request',
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('copyPathsToClipboard reports unsupported platforms and refusals', async () => {
  const calls = []
  const spawn = (command, args) => {
    calls.push({ command, args })
    return { status: 0, stdout: 'OK', stderr: '' }
  }
  await copyPathsToClipboard({ absolutePaths: ['/tmp/a.txt'], platform: 'linux', spawn })
  assert.equal(calls[0].command, 'xclip')
  await assert.rejects(
    copyPathsToClipboard({ absolutePaths: ['/tmp/a.txt'], platform: 'aix', spawn }),
    error => error.code === 'clipboard-unsupported',
  )
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd plugins/vyra-file-manager && node --test --test-name-pattern="clipboard" test.mjs`
Expected: FAIL —— `resolveClipboardPaths is not a function`

- [ ] **Step 3: 创建 `lib/clipboard.ps1`**

从 `plugins/vyra-screen-recorder/lib/clipboard.ps1` 移植 `files` 分支，参数简化为只服务本插件：

```powershell
# 文件列表写进系统剪贴板：粘贴到资源管理器得到副本，粘贴到多数聊天框得到绝对路径。
# 子命令只有一个：-Kind files -Path "a|b|c"
param(
  [Parameter(Mandatory = $true)][ValidateSet('files')][string]$Kind,
  [Parameter(Mandatory = $true)][string]$Path
)
```

`files` 分支逻辑与 screen-recorder 保持一致：`System.Windows.Clipboard::SetFileDropList` + `Flush()`，占用时重试 5 次，成功后额外 `Set-Clipboard -Value (路径换行拼接)`，失败 `throw '剪贴板被其他程序占用，或当前系统不支持写入文件列表'`。

- [ ] **Step 4: 创建 `lib/clipboard.js`**

导出：

```js
export const MAX_CLIPBOARD_ITEMS = 100

export async function resolveClipboardPaths({ paths, fs, workspaceRoot, signal })
export async function copyPathsToClipboard({ absolutePaths, platform = process.platform, spawn = defaultSpawn })
```

`resolveClipboardPaths` 逐项：`fs.resolve(joinWorkspacePath(workspaceRoot, path))` → `containsTarget(fs, rootTarget, target)` → `fs.stat` 存在性 → 收 `targetPathOf(fs, target)`；越界抛 `outside-workspace`，空数组或超过 `MAX_CLIPBOARD_ITEMS` 抛 `bad-request`。

`copyPathsToClipboard` 平台分发：

| platform | 命令 |
|---|---|
| `win32` | `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File lib/clipboard.ps1 -Kind files -Path "<a|b|c>"`，ps1 路径用 `new URL('./clipboard.ps1', import.meta.url)` 求 `fileURLToPath` |
| `darwin` | `osascript -e 'set the clipboard to {«class furl»...}'` —— 用 `POSIX file` 别名数组写法，逐路径 `POSIX file "..."` |
| `linux` | `xclip -selection clipboard -t text/uri-list`，stdin 写入每行 `file://<urlencoded>` |
| 其他 | 抛 `clipboard-unsupported` |

`defaultSpawn` 用 `node:child_process` 的 `spawnSync`，退出码非 0 → 抛 `clipboard-busy`（stderr 含「占用」时）否则 `spawn-failed`。

- [ ] **Step 5: 在 `lib/routes.js` 注册路由**

- 常量 `const CLIPBOARD_PATH = '/api/vyra-media/clipboard'`
- 处理器（复用 `handleAction`）：

```js
async function handleClipboard(request, ctx) {
  return handleAction(request, ctx, async ({ body, fs, workspaceRoot, signal }) => {
    const paths = await resolveClipboardPaths({ paths: body?.paths, fs, workspaceRoot, signal })
    await copyPathsToClipboard({ absolutePaths: paths })
    return { count: paths.length, paths }
  })
}
```

- 在 `registerMediaRoutes` 的 POST 列表里**追加在末尾** `[CLIPBOARD_PATH, handleClipboard]`，并导出 `CLIPBOARD_PATH` 与 `handleClipboard`。

- [ ] **Step 6: 更新路由注册断言**

`test.mjs:515-529` 的 `assert.deepEqual` 数组末尾追加：

```js
['/api/vyra-media/clipboard', ['POST']],
```

- [ ] **Step 7: 加一条端到端路由用例（Windows 真跑，其他平台跳过）**

```js
test('POST /api/vyra-media/clipboard validates paths', { skip: process.platform !== 'win32' }, async () => {
  // 建临时工作区，注册 routes，调 clipboard 路由：
  // - 合法文件 → 200 且 count === 1
  // - '../escape' → 403 且 code === 'outside-workspace'
})
```

- [ ] **Step 8: 跑全量测试**

Run: `cd plugins/vyra-file-manager && pnpm test`
Expected: 全部 PASS

- [ ] **Step 9: 提交**

```bash
git add plugins/vyra-file-manager/lib/clipboard.js plugins/vyra-file-manager/lib/clipboard.ps1 plugins/vyra-file-manager/lib/routes.js plugins/vyra-file-manager/test.mjs
git commit -m "feat(file-manager): copy files into the system clipboard"
```

---

### Task 3: HTML 外链内联路由（Host）

**Files:**
- Create: `plugins/vyra-file-manager/lib/html-inline.js`
- Modify: `plugins/vyra-file-manager/lib/routes.js`（新增 `HTML_ASSET_PATH` 与 `handleHtmlAsset`）
- Test: `plugins/vyra-file-manager/test.mjs`

**Interfaces:**
- Consumes: `containsTarget`、`joinWorkspacePath`、`targetPathOf`（`lib/paths.js`）
- Produces:
  - `extractAssetRefs(html: string): Array<{ tag: 'link'|'script'|'img', url: string, raw: string }>`
  - `inlineAssets(html: string, resolve: (url: string) => Promise<string|undefined>): Promise<string>`
  - `readTextFile` 已有；`GET /api/vyra-media/html-asset?sessionId=&url=` 返回 `{ ok: true, dataUrl }` 或 `{ ok: false, reason }`
  - 常量：`MAX_ASSET_BYTES = 2 * 1024 * 1024`、`MAX_TOTAL_ASSET_BYTES = 8 * 1024 * 1024`、`ASSET_TIMEOUT_MS = 5000`

- [ ] **Step 1: 写失败的测试**

```js
test('inlineAssets rewrites local and remote references into data URLs', async () => {
  const html = '<link rel="stylesheet" href="a.css"><script src="b.js"></script><img src="https://x.test/c.png">'
  const seen = []
  const out = await inlineAssets(html, async url => {
    seen.push(url)
    return url === 'a.css' ? 'data:text/css;base64,YQ==' : undefined
  })
  assert.deepEqual(seen, ['a.css', 'b.js', 'https://x.test/c.png'])
  assert.match(out, /data:text\/css;base64,YQ==/)
  // Unresolved references keep their original URL so the page still renders.
  assert.match(out, /src="https:\/\/x\.test\/c\.png"/)
})

test('inlineAssets leaves untouched markup alone for oversized assets', async () => {
  const html = '<img src="big.png">'
  const out = await inlineAssets(html, async () => undefined)
  assert.equal(out, html)
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd plugins/vyra-file-manager && node --test --test-name-pattern="inlineAssets" test.mjs`
Expected: FAIL —— `inlineAssets is not a function`

- [ ] **Step 3: 实现 `lib/html-inline.js`**

- `extractAssetRefs`：用三条正则分别抓 `<link ... rel="stylesheet" ... href="X">`、`<script ... src="X">`、`<img ... src="X">`（属性顺序无关，`"` 与 `'` 均支持）。
- `inlineAssets`：按顺序对每个引用调 `resolve(url)`；返回字符串则把原 `href`/`src` 值替换成该 data URL，返回 `undefined` 则保留原值；累计长度超 `MAX_TOTAL_ASSET_BYTES` 后停止内联，剩余引用原样保留。
- 导出常量三个。

- [ ] **Step 4: 在 `lib/routes.js` 加处理器**

`handleHtmlAsset`（GET）：

- `sessionId` 缺失 → 400
- `url` 参数：若以 `http://` 或 `https://` 开头 → Host 侧 `fetch(url, { signal: AbortSignal.timeout(ASSET_TIMEOUT_MS) })`，**不转发 Cookie**（不传 `credentials`）；读 `arraybuffer`，超过 `MAX_ASSET_BYTES` → `{ ok: false, reason: 'too-large' }`
- 否则视作工作区相对路径：`readTextFile` 同款 `fs.resolve` + `containsTarget` + `fs.readByteRange` 读取 `MAX_ASSET_BYTES`，构造 `data:<mime>;base64,<...>`（mime 用 `mimeOf(extensionOf(url))`）
- 任何失败返回 `{ ok: false, reason }`，**HTTP 状态仍为 200**，便于客户端降级
- 注册为 GET 路由，列表追加在 `/api/vyra-media/text` 之后、POST 组之前

- [ ] **Step 5: 更新路由注册断言**

`test.mjs` 的 `assert.deepEqual` 中，在 `['/api/vyra-media/text', ['GET']],` 之后插入：

```js
['/api/vyra-media/html-asset', ['GET']],
```

- [ ] **Step 6: 加一条越界用例**

```js
test('html-asset refuses a path outside the workspace', async () => {
  // 注册 routes，请求 url=../secret.txt
  // 断言 body.ok === false 且 body.reason === 'outside-workspace'
})
```

- [ ] **Step 7: 跑全量测试**

Run: `cd plugins/vyra-file-manager && pnpm test`
Expected: 全部 PASS

- [ ] **Step 8: 提交**

```bash
git add plugins/vyra-file-manager/lib/html-inline.js plugins/vyra-file-manager/lib/routes.js plugins/vyra-file-manager/test.mjs
git commit -m "feat(file-manager): inline html preview assets through the host"
```

---

### Task 4: HTML 类型词表与链接移除

**Files:**
- Modify: `plugins/vyra-file-manager/lib/media-types.js:12`、`:32-40`、`:81-83`
- Modify: `plugins/vyra-file-manager/src/client/helpers.js:8-29`、`:157-177`、`:233-286`、`:289-332`、`:355-379`
- Modify: `plugins/vyra-file-manager/src/client/library.js`（链接相关全部移除）
- Modify: `plugins/vyra-file-manager/src/client/components.js`（`MediaOverlay` 的 `onRemoveLink`；`slideFor` 的 link 分支）
- Test: `plugins/vyra-file-manager/test.mjs`、`test-client.mjs`

**Interfaces:**
- Produces:
  - `kindOf('html') === 'html'`、`kindOf('htm') === 'html'`
  - 客户端 `TYPE_CHIPS` 不含 `'link'`、含 `'html'`；`TYPE_LABEL.html === 'HTML'`；`counts` 初始对象用 `html: 0` 取代 `link: 0`
  - `helpers.js` 不再导出 `detectLinkKind`、`makeLinkItem`、`readLinks`、`writeLinks`
  - `kindIcon('html', ext)` 返回 `'html'`，`icons.js` 的 `ICONS.html` 存在
  - `timeline.js` 的 `KIND_LABEL.html === 'HTML'`

- [ ] **Step 1: 写失败的测试**

`test.mjs`（词表）：

```js
test('html is its own kind and links are gone', () => {
  assert.equal(kindOf('html'), 'html')
  assert.equal(kindOf('htm'), 'html')
  assert.equal(kindOf('css'), 'code')
})
```

`test-client.mjs`（类型表与图标）：

```js
test('type chips replace link with html and html has an icon', async () => {
  const { TYPE_CHIPS, TYPE_LABEL, HTML_EXT } = await import('./src/client/helpers.js')
  const { kindIcon } = await import('./src/client/icons.js')
  assert.ok(TYPE_CHIPS.includes('html'))
  assert.ok(!TYPE_CHIPS.includes('link'))
  assert.equal(TYPE_LABEL.html, 'HTML')
  assert.equal(TYPE_LABEL.link, undefined)
  assert.ok(HTML_EXT.has('html') && HTML_EXT.has('htm'))
  // kindIcon falls back to the raw kind, which must be a real icon name.
  assert.equal(kindIcon('html', 'html'), 'html')
})
```

> 注：`test-client.mjs` 已设置 `document`/`window` 桩；`helpers.js` 与 `icons.js` 是纯模块，可在文件顶部直接 import。

- [ ] **Step 2: 运行确认失败**

Run: `cd plugins/vyra-file-manager && node --test --test-name-pattern="html is its own kind|type chips replace link" test.mjs test-client.mjs`
Expected: FAIL —— `kindOf('html')` 返回 `'code'`；`TYPE_CHIPS` 含 `link`

> 注：`test-client.mjs` 需要设置 `document`/`window` 桩才能 import `helpers.js`（它是纯模块，不依赖 DOM，可直接 import）。

- [ ] **Step 3: 改 Host 词表**

`lib/media-types.js`：

- `CODE` 数组删掉 `'html', 'htm'`
- 新增 `const HTML = ['html', 'htm']`
- `FILE_KINDS` 增加 `...HTML.map(extension => [extension, 'html'])`
- 文件头 JSDoc 的 `FileKind` 联合类型加 `'html'`
- `TEXT_EXTENSIONS` **保留** `html`/`htm`（HTML 仍需按文本读取）

- [ ] **Step 4: 改客户端类型表、图标与时间线文案**

`src/client/helpers.js`：

- 新增 `export const HTML_EXT = new Set(['html', 'htm'])`
- `TYPE_LABEL`：删 `link: '链接'`，加 `html: 'HTML'`
- `TYPE_ORDER`：删 `link: 7`，加 `html: 7`
- `TYPE_CHIPS`：`'link'` → `'html'`
- 删除 `detectLinkKind`、`makeLinkItem`、`linksKey`、`readLinks`、`writeLinks`
- `slideFor` 删掉末尾 `kind === 'link'` 分支

`src/client/icons.js`：

- import 里 `FileCode` 保留，新增 `FileCode2`（lucide 已含）；把 import 列表里的 `Link2` 改为同时保留（`Link2` 仍被其他图标复用，检查后若无人使用则删除）
- `ICONS` 删 `link: Link2`，加 `html: FileCode2`

> 原因：`kindIcon` 对未知 kind 直接返回 kind 本身，`type chip` 也用 `h(Icon, { name: kind })`。没有 `ICONS.html` 时图标会静默退化成省略号。

`src/client/timeline.js`：

- `KIND_LABEL` 加 `html: 'HTML'`（`kindOfExtension` 对 `.html` 需返回 `['html', ext]`）

`src/client/tree.js`（若也有 kind 映射，同步加 `html`）。

- [ ] **Step 5: 清理 `library.js` 的链接入口**

- import 里移除 `detectLinkKind`、`makeLinkItem`、`readLinks`、`writeLinks`
- 删除 `AddLinkForm` 组件定义（`:71-92`）
- `menuActions`：删掉 `item.source === 'url' || item.kind === 'link'` 整个分支数组
- `MEDIA_KINDS` 删 `'link'`
- 删除 `const [links, setLinks] = useState([])`、`setLinks(readLinks(state.root))`、`const items = useMemo(() => [...state.items, ...links], …)`（改为直接用 `state.items`）
- 删除 `addLink`、`removeLink`
- `runAction`：删 `copyLink`、`removeLink`、`openLink` 三个分支
- `counts` 初始对象：`link: 0` → `html: 0`
- 头部工具条删除「链接」按钮（`:827`）与 `addOpen` 状态
- `:924` 的 `addOpen && h(AddLinkForm, …)` 删除
- `openResource` 里的 `item.source === 'url'` 分支删除
- `mediaOverlayItems` 的 `onRemoveLink: removeLink` 删除
- 搜索占位文案「搜索名称、路径、类型或链接…」→「搜索名称、路径或类型…」
- `filtered` 里 `item.source === 'url'` 的两处判断删除（`source` 恒为 `local`）
- `treeItems` 的 `item.source === 'url' ? … : item` 简化为 `filtered`
- `metaFor` 的 `item.source === 'url'` 分支删除

`src/client/components.js`：`MediaOverlay` 签名去掉 `onRemoveLink`；如内部使用，一并删除。

- [ ] **Step 6: 跑测试**

Run: `cd plugins/vyra-file-manager && pnpm test`
Expected: 全部 PASS

- [ ] **Step 7: 构建客户端并复测**

Run: `cd plugins/vyra-file-manager && pnpm run build:client && pnpm test`
Expected: 构建成功，测试 PASS

- [ ] **Step 8: 提交**

```bash
git add plugins/vyra-file-manager/lib/media-types.js plugins/vyra-file-manager/src/client/helpers.js plugins/vyra-file-manager/src/client/library.js plugins/vyra-file-manager/src/client/components.js plugins/vyra-file-manager/client.js plugins/vyra-file-manager/test.mjs plugins/vyra-file-manager/test-client.mjs
git commit -m "feat(file-manager)!: replace the link type with html and drop saved links"
```

---

### Task 5: HTML 预览沙箱与外链内联（客户端）

**Files:**
- Modify: `plugins/vyra-file-manager/src/client/preview.js:199-221`（`HtmlView`）
- Modify: `plugins/vyra-file-manager/src/client/styles.css`（新增 `.vms-html-note`）
- Test: `plugins/vyra-file-manager/test-client.mjs:156-172`

**Interfaces:**
- Consumes: `GET /api/vyra-media/html-asset?sessionId=&url=`（Task 3）
- Produces: `HtmlView({ text, sessionId, folder })` —— 新增 `sessionId` 与 `folder` 两个必传 props（`RichTextPreview` 传入）

- [ ] **Step 1: 改写失败的测试**

`test-client.mjs` 的 html 断言改为：

```js
const html = renderToString(React.createElement(HtmlView, {
  text: '<h1>Hello</h1><script>alert(1)</script>',
  sessionId: 's-1',
  folder: 'docs',
}))
assert.match(html, /sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads"/u)
assert.doesNotMatch(html, /allow-same-origin/u)
assert.match(html, /Content-Security-Policy/u)
assert.match(html, /沙箱/u)
```

- [ ] **Step 2: 运行确认失败**

Run: `cd plugins/vyra-file-manager && node --test --test-name-pattern="html" test-client.mjs`
Expected: FAIL —— 沙箱属性不匹配

- [ ] **Step 3: 改 `HtmlView`**

- 签名改为 `export function HtmlView({ text, sessionId, folder })`
- 新增 `const SANDBOX = 'allow-scripts allow-forms allow-popups allow-modals allow-downloads'`
- `document` 的 `useMemo` 改为异步内联：先用 `extractRefs` 本地正则找出 `<link rel=stylesheet href>` / `<script src>` / `<img src>`，相对路径经 `normalizeRelative(folder, url)` 解析成 workspace 相对路径，然后逐个 `fetch(apiUrl('api/vyra-media/html-asset', { sessionId, url: relativeOrRemote }))`，把返回的 `dataUrl` 替换回原属性值；失败的引用保留原值
- 用 `useState` 存内联结果，初始 `undefined` 时先渲染原文（避免白屏），完成后替换
- iframe `sandbox: SANDBOX`
- 抬头加一行说明：`h('div', { className: 'vms-html-note' }, '脚本在沙箱中运行：可以显示效果，但读不到本页数据；外链资源由本机代理加载。')`
- `RichTextPreview` 的 `HtmlView` 调用补 `sessionId`、`folder: folderOf(item)`

- [ ] **Step 4: 加样式**

`src/client/styles.css` 在 `.vms-html-frame` 附近追加：

```css
.vms-html-note { flex: none; padding: 6px 10px; border-bottom: 0.5px solid var(--vms-line); background: var(--vms-layer2); color: var(--vms-ink3); font-size: 9.5px; }
```

- [ ] **Step 5: 构建并跑测试**

Run: `cd plugins/vyra-file-manager && pnpm run build:client && pnpm test`
Expected: 构建成功，测试 PASS

- [ ] **Step 6: 提交**

```bash
git add plugins/vyra-file-manager/src/client/preview.js plugins/vyra-file-manager/src/client/styles.css plugins/vyra-file-manager/client.js plugins/vyra-file-manager/test-client.mjs
git commit -m "feat(file-manager): make html preview usable inside an opaque-origin sandbox"
```

---

### Task 6: 复制到系统剪贴板的客户端入口

**Files:**
- Modify: `plugins/vyra-file-manager/src/client/library.js`（菜单项、`runAction` 分支、批量工具条）
- Test: `plugins/vyra-file-manager/test-client.mjs`

**Interfaces:**
- Consumes: `POST /api/vyra-media/clipboard`（Task 2），经 `postJson('api/vyra-media/clipboard', { sessionId, paths })`
- Produces: 菜单键 `'copyFiles'`；工具条按钮「复制」（批量）

- [ ] **Step 1: 写失败的测试**

```js
test('the file menu offers a system-clipboard copy that is not the address copy', async () => {
  const html = renderToString(React.createElement(library, { sessionId: 's-1', useTabInfo, openBrowser() {} }))
  assert.doesNotMatch(html, /链接/u)
})
```

> 菜单项是运行时弹出的，静态渲染拿不到。因此本任务的断言改为对源文件的静态检查，与 `test-drag.mjs` 风格一致：读取 `src/client/library.js` 源码断言存在 `copyFiles` 菜单键与 clipboard 路由调用，且不再存在 `copyLink`。

先在 `test-client.mjs` 顶部补 import（现在没有）：

```js
import { readFile } from 'node:fs/promises'
```

```js
test('copying files uses the clipboard route, not the link menu', async () => {
  const source = await readFile(new URL('./src/client/library.js', import.meta.url), 'utf8')
  assert.match(source, /'copyFiles'/u)
  assert.match(source, /api\/vyra-media\/clipboard/u)
  assert.doesNotMatch(source, /copyLink/u)
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd plugins/vyra-file-manager && node --test --test-name-pattern="copying files uses" test-client.mjs`
Expected: FAIL —— 源码里没有 `copyFiles`

- [ ] **Step 3: 实现菜单项**

`menuActions(item)`：

- 文件夹分支：在 `moveTo` 之后插入 `{ key: 'copyFiles', label: '复制文件夹', icon: 'copy' }`
- 文件分支：在 `copyTo` 之后插入 `{ key: 'copyFiles', label: '复制文件', icon: 'copy' }`

`runAction` 新增分支：

```js
if (key === 'copyFiles') { await copyToSystemClipboard([item]); return }
```

新增函数：

```js
const copyToSystemClipboard = async (list) => {
  try {
    const result = await postJson('api/vyra-media/clipboard', {
      sessionId,
      paths: list.map(entry => entry.relativePath),
    })
    setNotice(`已复制 ${result.count} 项，可在资源管理器粘贴`)
  } catch (error) {
    setNotice(`复制失败：${error?.message ?? error}`)
  }
}
```

- [ ] **Step 4: 批量工具条加按钮**

在「复制到…」之后、 「复制地址」之前插入：

```js
h('button', { type: 'button', className: 'vms-ghost-btn', onClick: () => copyToSystemClipboard(selectedItems) }, h(Icon, { name: 'copy', size: 12 }), '复制'),
```

- [ ] **Step 5: 构建并跑测试**

Run: `cd plugins/vyra-file-manager && pnpm run build:client && pnpm test`
Expected: 构建成功，测试 PASS

- [ ] **Step 6: 提交**

```bash
git add plugins/vyra-file-manager/src/client/library.js plugins/vyra-file-manager/client.js plugins/vyra-file-manager/test-client.mjs
git commit -m "feat(file-manager): add copy-to-clipboard entries to the menus"
```

---

### Task 7: 右侧栏默认打开文件管理页

**Files:**
- Modify: `plugins/vyra-file-manager/src/client/helpers.js`（偏好字段）
- Modify: `plugins/vyra-file-manager/src/client/library.js`（筛选面板勾选项）
- Create: `plugins/vyra-file-manager/src/client/default-tab.js`
- Modify: `plugins/vyra-file-manager/src/client/entry.js`
- Test: `plugins/vyra-file-manager/test-client.mjs`

**Interfaces:**
- Produces:
  - `readPrefs().openFilesByDefault: boolean`（默认 `true`）、`writePrefs` 带上该字段
  - `replaceSoleGuide({ sidebar, kinds, libraryKind }): boolean` —— 执行替换时返回 `true`
  - `installDefaultTab({ sidebar, kinds, libraryKind }): () => void`
- Consumes（sidebar 契约，沿用 `vyra-agent-cli-manager`）：`sidebar.mounted.getSnapshot()`、`sidebar.isExpanded()`、`sidebar.tabsIn(sessionId)`、`sidebar.openTab(kind, { replaceTab })`、`sidebar.openTabs.subscribe()`、`sidebar.mounted.subscribe()`

- [ ] **Step 1: 写失败的测试**

```js
test('replaceSoleGuide swaps a lone guide tab for the file manager', async () => {
  const { replaceSoleGuide } = await import('./src/client/default-tab.js')
  const opened = []
  const tabs = [{ id: 't1', kind: 'guide' }]
  const sidebar = {
    mounted: { getSnapshot: () => 's-1', subscribe: () => () => {} },
    isExpanded: () => true,
    tabsIn: () => tabs,
    openTab: (kind, options) => { opened.push({ kind, options }) },
  }
  assert.equal(replaceSoleGuide({ sidebar, kinds: new Map(), libraryKind: 'media' }), true)
  assert.deepEqual(opened, [{ kind: 'media', options: { replaceTab: 't1' } }])
})

test('replaceSoleGuide yields to the workspace-files tab from another plugin', async () => {
  const { replaceSoleGuide } = await import('./src/client/default-tab.js')
  const opened = []
  const sidebar = {
    mounted: { getSnapshot: () => 's-1', subscribe: () => () => {} },
    isExpanded: () => true,
    tabsIn: () => [{ id: 't1', kind: 'guide' }],
    openTab: (kind) => { opened.push(kind) },
  }
  assert.equal(replaceSoleGuide({ sidebar, kinds: new Map([['files', {}]]), libraryKind: 'media' }), false)
  assert.equal(opened.length, 0)
})

test('replaceSoleGuide does nothing when the session already has other tabs', async () => {
  const { replaceSoleGuide } = await import('./src/client/default-tab.js')
  const sidebar = {
    mounted: { getSnapshot: () => 's-1', subscribe: () => () => {} },
    isExpanded: () => true,
    tabsIn: () => [{ id: 't1', kind: 'guide' }, { id: 't2', kind: 'media' }],
    openTab: () => { throw new Error('must not open') },
  }
  assert.equal(replaceSoleGuide({ sidebar, kinds: new Map(), libraryKind: 'media' }), false)
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd plugins/vyra-file-manager && node --test --test-name-pattern="replaceSoleGuide" test-client.mjs`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现 `src/client/default-tab.js`**

```js
/**
 * Open the file manager in a right Sidebar that would otherwise show only the
 * "guide" page. The `vyra-agent-cli-manager` plugin owns that same slot for its
 * workspace-files tab, so this yields whenever that tab type is registered.
 */
const GUIDE_KIND = 'guide'
const RIVAL_KIND = 'files'

export function replaceSoleGuide({ sidebar, kinds, libraryKind }) { /* 见测试断言 */ }

export function installDefaultTab({ sidebar, kinds, libraryKind, enabled }) { /* 订阅两个 store，queueMicrotask 后调用 replaceSoleGuide */ }
```

`replaceSoleGuide` 规则：`sessionId` 未定义 → `false`；侧栏未展开 → `false`；`tabsIn` 长度不为 1 → `false`；唯一 tab `kind !== 'guide'` → `false`；`kinds.get(RIVAL_KIND)` 存在 → `false`；`kinds.get(libraryKind)` 不存在 → `false`；否则 `openTab(libraryKind, { replaceTab: only.id })` 返回 `true`。

`installDefaultTab`：`enabled()` 为假时直接返回 no-op；否则订阅 `sidebar.openTabs` 与 `sidebar.mounted`，回调里 `queueMicrotask(() => { if (enabled()) replaceSoleGuide(...) })`。

- [ ] **Step 4: 加偏好字段**

`helpers.js` 的 `PREF_DEFAULTS` 加 `openFilesByDefault: true`；`readPrefs` 加 `openFilesByDefault: merged.openFilesByDefault !== false`；`library.js` 的 `writePrefs` 调用补该字段。

- [ ] **Step 5: 筛选面板加勾选项**

`library.js` 筛选面板里、`显示隐藏文件` 之前插入：

```js
h('label', { className: 'vms-check' }, h('input', { type: 'checkbox', checked: openFilesByDefault, onChange: event => setOpenFilesByDefault(event.target.checked) }), '展开右侧栏时默认打开文件管理'),
```

新增 `const [openFilesByDefault, setOpenFilesByDefault] = useState(INITIAL_PREFS.openFilesByDefault)`，并加入 `writePrefs` 依赖。

- [ ] **Step 6: 在 `entry.js` 接线**

```js
ctx.effect(() => {
  const sidebar = ctx.sidebarRight
  const tabs = ctx.sidebarRightTabs
  if (typeof sidebar?.openTabs?.subscribe !== 'function') return undefined
  return installDefaultTab({
    sidebar,
    kinds: tabs,
    libraryKind: LIBRARY_KIND,
    enabled: () => readPrefs().openFilesByDefault,
  })
}, 'dsh-vyra-file-manager: files by default')
```

`kinds` 直接用 `ctx.sidebarRightTabs`（它的 `register` 返回值之外还需要一个「是否已注册」查询）——若契约里没有 `get`，则改为在本插件里维护一个 `Map`，由 `register` 时自行填充并额外探测 `tabs.get?.('files')`。实施时以运行时真实契约为准，测试只钉 `Map` 语义。

- [ ] **Step 7: 构建并跑测试**

Run: `cd plugins/vyra-file-manager && pnpm run build:client && pnpm test`
Expected: 构建成功，测试 PASS

- [ ] **Step 8: 提交**

```bash
git add plugins/vyra-file-manager/src/client/default-tab.js plugins/vyra-file-manager/src/client/helpers.js plugins/vyra-file-manager/src/client/library.js plugins/vyra-file-manager/src/client/entry.js plugins/vyra-file-manager/client.js plugins/vyra-file-manager/test-client.mjs
git commit -m "feat(file-manager): open the file manager in a fresh right sidebar"
```

---

### Task 8: 时间线隐藏无产出轮次

**Files:**
- Modify: `plugins/vyra-file-manager/src/client/timeline.js:121-158`、`:181-217`
- Test: `plugins/vyra-file-manager/test-client.mjs`

**Interfaces:**
- Produces: `filterNodesWithFiles(nodes: Array<object>): Array<object>` —— 导出以便单测
- `SessionTimeline` 渲染时使用过滤后的节点

- [ ] **Step 1: 写失败的测试**

```js
test('only turns that touched files reach the timeline', async () => {
  const { filterNodesWithFiles } = await import('./src/client/timeline.js')
  const nodes = [
    { seq: 1, time: 1_700_000_000_000, prompt: 'a', files: [{ path: 'x.txt', display: 'x.txt' }] },
    { seq: 2, time: 1_700_000_100_000, prompt: 'b', files: [] },
    { seq: 3, time: 1_700_000_200_000, prompt: 'c' },
    { seq: 4, time: 1_700_000_300_000, prompt: 'd', files: undefined },
  ]
  assert.deepEqual(filterNodesWithFiles(nodes).map(node => node.seq), [1])
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd plugins/vyra-file-manager && node --test --test-name-pattern="only turns that touched" test-client.mjs`
Expected: FAIL —— `filterNodesWithFiles is not a function`

- [ ] **Step 3: 实现**

`timeline.js` 新增并导出：

```js
/**
 * Drop turns that produced no file change: with the newest-first axis, an empty
 * turn is only noise. A turn whose `files` is missing counts as empty.
 */
export function filterNodesWithFiles(nodes) {
  return (Array.isArray(nodes) ? nodes : []).filter(node => Array.isArray(node.files) && node.files.length > 0)
}
```

`SessionTimeline` 的 `sections` 改为：

```js
const sections = useMemo(() => {
  const usable = filterNodesWithFiles(nodes).filter(node => typeof node.time === 'number')
  ...
}, [nodes])
```

- [ ] **Step 4: 删死代码与改文案**

- `TimelineNode` 里 `files.length === 0 ? '无产出' : ...` 改为直接 `${files.length} 个文件`
- `TimelineNode` 里 `open && files.length > 0 && (...)` 的外层判断保留（防御性），去掉 `=== 0` 分支
- 空态文案「这条会话还没有消息」改为「这条会话还没有产出文件」；hint「发送一条消息后，这里会按时间列出每次对话及其产出的文件。」保持不变

- [ ] **Step 5: 构建并跑测试**

Run: `cd plugins/vyra-file-manager && pnpm run build:client && pnpm test`
Expected: 构建成功，测试 PASS

- [ ] **Step 6: 提交**

```bash
git add plugins/vyra-file-manager/src/client/timeline.js plugins/vyra-file-manager/client.js plugins/vyra-file-manager/test-client.mjs
git commit -m "feat(file-manager): hide timeline turns that changed no files"
```

---

### Task 9: 文档、版本与收尾验证

**Files:**
- Modify: `plugins/vyra-file-manager/README.md:11-29`、`:86-93`
- Modify: `plugins/vyra-file-manager/package.json:2`（version）、`:5`（description）
- Modify: `plugins/vyra-file-manager/docs/设计文档.md`（新增一节 0.9）
- Modify: `scripts/market-manifest.ts`（`dsh-vyra-file-manager` 条目版本与说明）

**Interfaces:**
- Consumes: 前 8 个任务的产物
- Produces: 无代码接口；只更新文档与版本号

- [ ] **Step 1: 更新 README「能做什么」**

删除「链接」相关行；新增：

- ✅ 展开右侧栏时默认打开文件管理（可在筛选面板关闭）
- ✅ 类型筛选含「HTML」，HTML 文件在本面板内沙箱渲染，外链资源由本机代理加载
- ✅ 右键「复制文件 / 复制文件夹」把文件放进**系统剪贴板**，可直接在资源管理器粘贴
- ✅ 「在资源管理器中打开」会在 Windows 中选中该文件

- [ ] **Step 2: 重写 README「文件操作边界」**

把「浏览器无法把文件写入系统剪贴板」一句替换为：

> - 「复制文件」通过 Host 侧的 `clipboard.ps1`（WPF `SetFileDropList`）把文件列表写成 `FileDrop`，粘贴到资源管理器即得到副本；同时写入纯文本路径，便于粘贴到聊天框。macOS 走 `osascript`，Linux 走 `xclip`（`text/uri-list`），其余平台明确报错。
> - 剪贴板与「在资源管理器中打开」只接受工作区内路径。

并把 HTML 预览那行改为：

> - HTML 预览在 opaque-origin 沙箱（`allow-scripts` 但**不含** `allow-same-origin`）中运行，可执行脚本但拿不到本页数据；`<link>`/`<script src>`/`<img>` 外链由 `html-asset` 路由代理内联，单资源上限 2 MB、总上限 8 MB、超时 5 s。

- [ ] **Step 3: 版本与包描述**

`package.json`：`"version": "0.5.0"`；`description` 去掉「链接」，加入「HTML 预览与系统剪贴板」。

- [ ] **Step 4: 设计文档加一节**

`docs/设计文档.md` 末尾追加「### 0.9 0.5.0 默认页、HTML 类型、系统剪贴板」小节，记录本规格 §2 的六个决策要点（D1–D7 摘要）。

- [ ] **Step 5: 市场清单**

`scripts/market-manifest.ts` 中 `dsh-vyra-file-manager` 条目的版本与更新说明同步到 0.5.0，说明里写明「移除链接类型，新增 HTML 类型与系统剪贴板复制」。

- [ ] **Step 6: 全量构建与测试**

Run: `cd plugins/vyra-file-manager && pnpm run build:client && pnpm test`
Expected: 构建成功；所有测试 PASS

- [ ] **Step 7: 仓库级安装性检查**

Run: `cd C:\myself\projects\my\open-source\dsh-vyra-plugins && node scripts/check-installable.mjs`
Expected: 退出码 0

- [ ] **Step 8: 提交**

```bash
git add plugins/vyra-file-manager/README.md plugins/vyra-file-manager/package.json plugins/vyra-file-manager/docs/设计文档.md scripts/market-manifest.ts
git commit -m "docs(file-manager): document 0.5.0 behaviour and bump the version"
```

---

## 手工验收清单（执行完 Task 9 后逐条走一遍）

1. 新建会话 → 展开右侧栏 → 直接看到文件管理页；在筛选面板取消勾选 → 关掉侧栏再开 → 回到「开始」引导页。
2. 装了 `vyra-agent-cli-manager` 时 → 展开侧栏 → 出现的是它的工作区文件页，本插件不抢。
3. 类型筛选行里只有「HTML」，没有「链接」；之前存过的链接卡片不再出现。
4. 打开一个带外部 CSS 与 `<script>` 的 HTML → 样式与交互生效；抬头有沙箱说明；点链接不会跳出面板。
5. 右键一个文件 →「复制文件」→ 打开资源管理器 Ctrl+V → 得到副本；右键文件夹同理。
6. 右键文件 →「在资源管理器中打开」→ 资源管理器打开并选中该文件；右键文件夹 → 直接打开该文件夹。
7. 时间线里纯问答的一轮消失，改过文件的一轮保留，日期分节的「N 轮」计数与实际显示一致。
