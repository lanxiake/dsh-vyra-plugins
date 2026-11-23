# vyra-free-theme P2（壁纸四通道 + 覆盖开关）实施计划与执行记录

> **状态**：已完成（2026-11-23），分两次提交：`d87a69f`（P2a）、`1b2b430`（P2b）。

**Goal:** 让 `theme.json` 能声明静态 / 视频 / 动图 / 代码四种壁纸，明暗成对；让外壳（侧栏/顶栏/右栏）可以选择铺壁纸；主题自带的图进入个性化面板成为可选资源。

**Architecture:** 静态与动图仍走 CSS 背景（`body::before`），视频与代码艺术走**元素层**（一个固定、点击穿透的容器），两者都从同一个投影产物 `backdrop` 出声：`imageLight/imageDark` 管 CSS 通道，`layers[]` 管元素通道。用户/目录选了图 → 图像通道覆盖，元素层自动让位。

**Spec:** `docs/superpowers/specs/2026-11-23-vyra-free-theme-design.md` §6

## 关键决策

| # | 决策 | 理由 |
| --- | --- | --- |
| P2-D1 | 资源契约从 `{url,mime}` 扩成 `{url,mime,darkUrl?,darkMime?}` | 一个壁纸 ref 就能带明暗两张，不必给面板加第二个图字段；内置皮肤零改动 |
| P2-D2 | 代码壁纸跑在不透明源（`sandbox="allow-scripts"`，无 `allow-same-origin`）+ `default-src 'none'` CSP | 它读不到宿主页面、Cookie、接口；唯一的出口是 `postMessage` |
| P2-D3 | 首帧看门狗 2s + `vft:error` 消息 + 资源 404 三种失败都落到"静默降级成渐变" | 坏 art.js 只死壁纸层，界面必须可继续用 |
| P2-D4 | 视频/代码层由一个容器统一挂，切主题/dispose 一次性回收（含 `AbortController`、`MutationObserver`、visibility 监听） | 元素层最容易泄漏的就是监听器和未完成的 fetch |
| P2-D5 | `coverage.shell=true` 只做一件事：不把外壳 fill 钉成实色 | 侧栏本来就是半透令牌，放开钳制即可透出固定壁纸；不改宿主布局 |
| P2-D6 | 主题资源路由只认主题目录内的普通文件 + 白名单扩展名 + `realpath` 逃逸检查 + 64MB 上限 | 主题目录是用户可写的，路由必须假设里面可能有任何东西 |

## 任务与证据

### Task 1: 主题资源路由

**Files:** `src/host/themes/assets.js`（新建）、`src/host/personalization-routes.js`（`GET /vyra-free-theme/theme/<id>/<path>`）、`src/host/themes/repository.js`（`assetDirFor`）

拒绝清单：绝对路径、盘符、`..`、空段、`.` 段、未知扩展名、目录、超过 64MB、`realpath` 逃逸。

**证据：** `tests/theme-assets.test.mjs` 5/5 —— 含 `../secret.webp`、`/etc/passwd`、`C:/windows/x.webp`、`assets//light.webp`、`./assets/light.webp` 全部返回 null；symlink 逃逸（有权限时）；`.js` 以 `text/plain` 下发（供沙箱内联）。

### Task 2: 明暗成对与动图通道

**Files:** `theme-model.js`（`builtinAssetsFromTheme`、`wallpaperLayersFromTheme`、壁纸校验）、`translucency.js`（`darkUrl`）、`client/index.js`（assetResolver 透传 `darkUrl`）

**证据：** `tests/theme-wallpaper.test.mjs` 10/10 —— 明暗对生成 `art.url` + `art.darkUrl`；只有亮态时无 `darkUrl`；图片主题的壁纸字段默认值是 `builtin:<id>:art`；动图只收 `.gif/.webp`；投影里 `imageDark` 用的是 `darkUrl`。

### Task 3: 覆盖开关接线

**Files:** `theme-model.js`（table 带 `coverage`）、`translucency.js`（投影输出 `coverage`）、`projector.js`（校验 + 透传）、`runtime.js`（`coverage.shell` → 不钉实色外壳）

**证据：** 同一测试文件：`coverage.shell=true` 时 `effects.coverage` 精确等于 `{shell:true, scopes:[...]}`；未声明时是 `{shell:false, scopes:["sidebar"]}`。

### Task 4: 元素层（视频 / 代码艺术）

**Files:** `src/client/wallpaper-art.js`（新建，纯函数）、`src/client/wallpaper-layer.js`（新建，DOM）、`runtime.js`（随皮肤事务挂载/回收）

代码壁纸文档内联了：CSP、canvas、`env`（只有 `width/height/dpr/mode/reducedMotion`）、`art.mount` 契约检查、`ready`/`error` 回报、`pagehide` 清理。

**证据：** `tests/wallpaper-art.test.mjs` 5/5 —— `export const art` / `export function art` / `export default` 三种写法都被改写为 `window.art`；源码里的 `</script>` 被转义、不会提前闭合宿主 script；CSP 五项齐全；`mode` 只接受 light/dark；缺 `mount` 会在帧内报错。

### Task 5: 随包主题的完整性门禁

**Files:** `tests/builtin-themes.test.mjs`（新建）

对 `themes/*` 逐个：`theme.json` 必须通过模型校验、目录名必须等于 `theme.id`、引用的每个资源必须真实存在且扩展名与 kind 匹配、代码艺术必须 ≤256KB、必须导出 `art`、必须不含 `import`（单文件约束）、元素层 URL 必须落在 `/vyra-free-theme/theme/<id>/`。

**证据：** 2/2 通过。

### Task 6: 把星云做成代码壁纸（端到端样例）

**Files:** `themes/nebula/art.js`（新建）、`themes/nebula/theme.json`（`wallpaper: {kind:"code", entry:"art.js"}`）

220 颗星、固定种子、对角光雾、`prefers-reduced-motion` 只画一帧、返回 `destroy`。**这样代码壁纸通道在下次重启后立刻有真实样例可看**，不必等 P6 出图。

## 汇总证据

- `node --test tests/*.test.mjs` → **60/60**
- `npm run build` → `lib/client.js` 368245 B、`lib/index.js` 75764 B
- 提交：`d87a69f`、`1b2b430`

## 偏差与遗留

1. 视频"≤60s / ≤50MB"目前只写在规格里，JSON 无法自证；实际校验放在 P5 的 `vft wallpaper add/video` 与 P6 的打包脚本。
2. `coverage.scopes` 已校验并透传，但只实现了 `shell` 整体开关；分区域（只让侧栏透、顶栏保持实色）需要知道宿主各区域的具体令牌名，留到 P3 与侧栏样式一起做。
3. 代码壁纸的 `postMessage` 只用于 ready/error 与明暗切换，未做帧率节流（契约写 30fps，由作者自律；宿主侧无法可靠限制 rAF）。
4. 面板尚未展示"这个是代码壁纸/视频壁纸"的标记与资源网格（P4/P5 面板工作时补）。

## 下一阶段入口

P3：侧栏样式（`sidebar` 规格 → CSS 编译、5 款内置包、图标/悬停/选中态）、按 locale 取品牌标题、`coverage.scopes` 分区域落地。
