# vyra-free-theme P3（侧栏样式 + 覆盖分区域）实施计划与执行记录

> **状态**：已完成（2026-11-23），提交 `4772a17`。

**Goal:** 让主题能定义左侧菜单的观感（背景模式、圆角、密度、图标色调、悬停/选中态、分隔线），内置 5 款可搭配壁纸的样式包；`coverage.scopes` 细化到"只让侧栏透壁纸"。

**Architecture:** 侧栏样式**不猜宿主 css-module 类名**。运行时给侧栏里可交互的元素打 `data-vft-sb-item` 标签（按角色选 `a/button/[role]/[tabindex]`），CSS 全部键在这些标签 + 包内已钉住的三个结构钩子（`[class*="_sidebarCol"]`、`[class*="_root"]`、`[class*="_scrollFade"]`）上。上游重新构建把类名全换掉，样式依然命中。

**Spec:** `docs/superpowers/specs/2026-11-23-vyra-free-theme-design.md` §6.2、§7

## 关键决策

| # | 决策 | 理由 |
| --- | --- | --- |
| P3-D1 | 元素标记而非类名匹配 | 宿主每次构建都重散列类名；角色选择器的前提（"侧栏里有链接/按钮/可聚焦行"）稳定得多 |
| P3-D2 | 标记只在侧栏子树内做，先观察 body 直到侧栏出现，随后只观察侧栏 | 避免聊天流式输出时反复全页 querySelectorAll |
| P3-D3 | 样式包给**值**，主题给**覆盖**；缺省值全部从主题自身调色板推导 | 默认"配套"不是一句口号：图标色取 `label-secondary`、选中底取品牌色 14% alpha |
| P3-D4 | 密度只改条目自身的 `padding/min-height/gap`，不碰宿主布局间距 | 改布局会在上游升级后变成错位 |
| P3-D5 | 选中指示条用 `::before` 伪元素 | 不插入任何 DOM，也不改宿主结构 |
| P3-D6 | `coverage.shell=true` 且 `scopes` 含 `sidebar` 才放开侧栏实色 | 分区域从今天开始真实生效；顶栏/右栏仍按整体处理（见遗留） |

## 任务与证据

### Task 1: 样式包与规格解析

**Files:** `src/shared/personalization/sidebar-presets.js`（新建）

5 款包：`inherit`（同色延展）、`frost`（玻璃浮层）、`hairline`（极简描边）、`obsidian`（墨黑卡）、`neon`（霓虹描边）。`resolveSidebar(theme)` 按 pack → 显式字段 → 调色板推导三级合并。

**证据：** `tests/sidebar.test.mjs` 9/9：
- 无 `sidebar` 块的主题推导出 `inherit/cozy/14/8`、图标 `#5B5273`、选中底 `rgba(109, 74, 255, 0.14)`、指示条 `#6D4AFF`
- 5 款包逐个可解析
- 字段级覆盖：`pack:frost + blur:6` → `surface` 仍取 frost、`blur` 取 6；`radius:{item:2}` → card 保留包值 16

### Task 2: 校验

`normalizeTheme` 现在校验 `sidebar`：未知字段、未知 pack/surface/density、blur 越界（0–24）、radius 越界（0–32）、`icon` 必须是 `{light,dark}`、`states` 只认 hover/active/selected 且只认 7 个颜色字段、`divider.style` 三值、`background` 明暗成对。

**证据：** 同文件"sidebar validation rejects malformed blocks"用例覆盖 10 种坏输入，全部 `ok:false`。

### Task 3: CSS 编译

`sidebarCss(spec, bodyAttribute)` 产出全部以 `body[data-<theme>]` 作用域的规则：列背景透明、根卡圆角、玻璃模糊 + scroll-fade 中和、实色/自定义背景（含 dark 覆盖）、条目圆角/密度/过渡、图标色（明暗各一条）、hover/active、选中底 + 左侧 3px 指示条、分隔线。

**证据：** 同文件断言了作用域前缀、`backdrop-filter:blur(14px)`、`padding-top:6px`（cozy）、`color:#5B5273`、`:hover{background:`、`width:3px`、暗色图标规则 `body[data-vftNebula][data-ds-dark-theme] [data-vft-sb-item] svg{color:#B9AEDA}`；solid 用 `var(--dsw-specific-sidebar-fill)` 且无 blur；custom 明暗两条；hairline 无 blur 且 `border-radius:0px`。

### Task 4: 运行时接线

**Files:** `src/client/sidebar-theme.js`（新建，标记器）、`runtime.js`（随皮肤事务挂载 + 回收）、`projector.js`（`sidebar` 校验透传）、`translucency.js`（投影输出 `sidebar`）

**证据：** 投影测试断言 `effects.sidebar.pack === "neon"`、`surface === "frost"`、`blur >= 18`；无侧栏规格的皮肤投影出 `sidebar: null`（不写任何侧栏 CSS）。

### Task 5: 覆盖分区域

`runtime` 从 `coverage.shell && scopes.includes("sidebar")` 才放开侧栏实色，否则维持实色外壳。

### Task 6: 内置主题套用样式包

- `nebula`（星云）：`pack: frost` + `coverage.shell: true` —— **这是第 2 点需求的可见样例：代码壁纸会透到左侧菜单**
- `ink-landscape`（山水）：`pack: hairline`，外壳保持实色

**证据：** `tests/builtin-themes.test.mjs` 仍然 2/2（校验经 `normalizeTheme`，侧栏块不合法会直接失败）。

## 汇总证据

- `node --test tests/*.test.mjs` → **69/69**
- `npm run build` → `lib/client.js` 378794 B、`lib/index.js` 80923 B
- 提交：`4772a17`

## 偏差与遗留

1. **踩坑记录**：用 PowerShell `Set-Content -NoNewline` 改带中文的 JSON 会把文件写成非 UTF-8，导致 `JSON.parse` 崩。之后所有含中文的文件只用 write 工具整份重写。已修复两套主题。
2. `coverage.scopes` 目前只实现了 `sidebar` 一个区域；`topbar` / `rightpanel` 需要各自的具体令牌名，暂按"整体跟 shell"处理（未验证，下次重启后按实际观感再定）。
3. 侧栏标记器依赖"可交互元素"这一结构前提，未在本机做过 DOM 实测（需要重启 + 人工看一眼）；若某个会话条目不是链接/按钮/可聚焦行，它不会被标记，也就没有 hover/选中效果。
4. 品牌标题仍取 `brand.title.zh`（品牌字标通常单语，未做按 locale 切换）。
5. 面板尚无侧栏样式选择器 UI（P4/P5 接面板时补），当前只能通过 `theme.json` 或（P5）CLI 设置。

## 下一阶段入口

P4：配色评估（五维打分）—— 需要用 `sharp` 采样壁纸主色、实现对比度/明度/色相/干扰度计算、`colors suggest` 与面板评分卡、6 套内置配色预设。
