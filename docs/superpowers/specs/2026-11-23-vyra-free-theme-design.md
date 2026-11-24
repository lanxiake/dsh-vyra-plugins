# vyra-free-theme（自由主题）— 设计文档

- 日期：2026-11-23
- 状态：待审阅
- 替代关系：**取代** `vyra-theme-styles`（主题风格）与 `@iasiv5/dsh-skins`（主题皮肤）两个插件；两者随本插件发布后从市场索引下架、在 profile 内禁用，配置与个人图库一次性迁移（见 §10）

## 1. 要解决的问题

### 1.1 现状：两个插件抢同一块地

| | `vyra-theme-styles` | `@iasiv5/dsh-skins` 1.5.34 |
| --- | --- | --- |
| 机制 | `theme.overrideTokens()` 覆盖 `--dsw-alias-*` 别名令牌 | 每皮肤 `tokenOverrides` + 壁纸 + 品牌位 + 装饰 + 通透度管线 |
| 内容 | 2 套配色（暖感有机、macOS 毛玻璃） | 4 项（官方、OpenBMC、UEFI、美人志） |
| 入口 | 设置 → 通用 一行（`settings.general.item`） | 侧栏底部「皮肤切换」弹层 |
| 持久化 | localStorage（`dsh-theme-styles:active`） | 宿主配置 + 图库（`$DSH_HOME/dsh-skins/`） |
| 壁纸/图库 | 无 | 有（内置 + 上传，≤20MB） |

两个插件在本机 desktop profile 中**同时安装且都挂载了令牌层**，谁后画谁生效——同一套 `--dsw-alias-*` 有两个所有者，行为不可预测。这不是"整理一下"，是必须消解的结构冲突。

### 1.2 用户提的七点

1. 两个插件合并，分析保留 / 删除 / 完善
2. 壁纸目前只在会话区，左侧栏是实色；加开关让外壳（含左侧栏）也能铺壁纸
3. 改为「自由主题」，支持**动态壁纸**的上传与展示
4. 支持用**代码**或**生图**自定义壁纸皮肤
5. 把操作与说明做成 **skill + CLI** 暴露给 Agent，让 Agent 完成几乎人类所有操作
6. 左侧菜单样式可自定义并尽量与壁纸配套；按颜色搭配评估配色，内置几款
7. 先讨论需求并确认设计（本文档即产物）

## 2. 目标与非目标

### 目标

1. 一个插件、一个令牌所有者、一个面板：换主题、换壁纸、调侧栏、查配色，都在同一处
2. 主题是**文件**（`theme.json` + 资源），内置与自定义走同一条投影管线
3. 壁纸四通道：静态图 / 视频 / 动图 / 代码生成艺术，明暗各一套
4. 外壳覆盖可开关：默认维持现行为（会话区壁纸 + 实色外壳），打开后外壳透出壁纸
5. 侧栏样式 5 款内置包 + 细调，默认自动与壁纸主色配套
6. 配色有确定性评分（面板实时 + CLI 可复现），低于阈值不许当作成品交付
7. CLI `vft` 与技能 `vyra-free-theme` 覆盖面板的**全部**操作，且 `theme.json` 是唯一真相——CLI 挂了也能靠写文件完成工作

### 非目标（明确不做）

- **不做布局级**侧栏自定义：不改菜单项顺序、不做菜单项隐藏、不重构 DOM
- 不做多主题并行/混合（同一时刻只有一个主题生效）
- 不做云同步、不做主题商店内嵌（分发走现有市场索引）
- 不在面板里内置生图 UI：生成走 CLI → 本地 ComfyUI，面板只展示产物
- 不保留第三方商标素材：OpenBMC / UEFI 标志与字标不进入本插件

## 3. 决策记录

| # | 决策 | 依据 |
| --- | --- | --- |
| D1 | 新建 `vyra-free-theme`，旧两插件退役并迁移 | dsh-skins 是 vendored 上游（MIT，`SOURCE.md`），改名 fork 允许；保留原包名会把大量自定义混进第三方身份 |
| D2 | 主题以 `theme.json` 为唯一真相，内置主题也用同一模型表达 | 避免"内置编译 / 用户数据"两套执行路径与两套降级逻辑 |
| D3 | 壁纸支持 image / video / animated / code 四通道 | 用户要动态壁纸与代码壁纸；动图体积小、解码轻，作为低成本动态选项保留 |
| D4 | 代码壁纸跑在同源沙箱 iframe，受控契约 + 自动降级 | 自由度和"Agent 不能一键搞崩界面"必须同时成立 |
| D5 | `coverage.shell` 默认 `false` | 默认行为不变；想要全覆盖的用户自己打开 |
| D6 | 侧栏只做 CSS/令牌级（配色、背景、圆角、密度、图标色、悬停/选中态） | 与宿主布局契约解耦，上游改版靠钩子测试先报警 |
| D7 | 配色评分确定性、可复现，CLI 与面板同一实现 | 面板给即时反馈，CLI 给 Agent 可判定的门禁 |
| D8 | 内置资源**全部随包**（含视频） | 用户明确选择；换离线可用与安装简单 |
| D9 | 内置 5 套主题：抽象流体/星云、东方水墨/山水、凡人修仙传、灵笼、牧神记 | 用户指定；三部动漫为第三方 IP，风险已当面说明并由用户明确接受（§13.4） |
| D10 | 面板形态：侧栏抽屉（可展开宽屏）+ 设置入口，同一面板 | 用户选择 |

## 4. 架构

### 4.1 组成

| 模块 | 位置 | 职责 |
| --- | --- | --- |
| 宿主端 | `src/host/` | 主题目录读写（原子写）、图库、资源路由、导入导出打包、迁移、CLI 的后端 API |
| 投影核 | `src/shared/personalization/` | `theme.json` → catalog → `project()` → 规范化 `SkinEffects`（沿用现有三层回退） |
| 客户端运行时 | `src/client/runtime.js` | 把 `SkinEffects` 落到 DOM：令牌层、壁纸层、外壳、侧栏 CSS、品牌位、装饰 |
| 面板 | `src/client/personalization/` | 主题列表、壁纸库、外观、侧栏、品牌、配色评分、导入导出 |
| CLI | `cli/vft.mjs` + 垫片 | 调宿主 API；`--json` 输出；退出码可判 |
| 技能 | `skill/SKILL.md` | 插件初始化写入 `~/.dsh/skills/vyra-free-theme/` |
| 内置主题 | `themes/<id>/` | 5 套，随包；构建期编译进 `lib/` |

### 4.2 数据流

```
themes/<id>/theme.json ──┐
library/*（个人图库）  ──┼─→ catalog 合并 ─→ project(values, assets) ─→ SkinEffects
内置主题（构建期编译）──┘         │                                        │
                                  └─ assetResolver                        ↓
                                                                    runtime 应用
                                                              （令牌/壁纸/侧栏/品牌）
```

沿用现有约定：`project()` 是纯函数，不碰 DOM；运行时是唯一执行者；三层回退 `none → defaults → failed`（失败即恢复上一份有效效果或回官方）。

### 4.3 目录

```
$DSH_HOME/vyra-free-theme-desktop/        # Web profile 为 vyra-free-theme/
  active.json                             # 当前主题 + 各主题个性化覆盖（只存 diff）
  themes/<id>/theme.json
  themes/<id>/assets/*
  themes/<id>/art.js                      # 可选：代码壁纸
  library/                                # 个人图库（全主题共用）
  backups/                                # 导入/覆盖前快照
```

## 5. 主题模型（`theme.json` v1）

### 5.1 字段

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `schema` | 是 | 固定 `1`；不认识的版本拒绝加载并回落 |
| `id` | 是 | `^[a-z][a-z0-9-]{1,39}$`，目录名一致 |
| `name` | 是 | `{ zh, en }`，**可随时改**（面板/CLI 都行） |
| `author` / `version` | 否 | 展示与分享用 |
| `brand` | 否 | `title{zh,en}`（替换 DeepSeek Harness 字标）、`mark`、`favicon{href,mime}`、`slogans{zh,en}` |
| `colors` | 是 | `{ light: {令牌:值}, dark: {…} }`，键为 `--dsw-alias-*`；吸收「主题风格」两套配色 |
| `shape` | 否 | 圆角/密度类令牌（如 `--dsw-alias-radius-lg`） |
| `wallpaper` | 否 | 见 §6 |
| `coverage` | 否 | `{ shell: bool, scopes: ["sidebar","topbar","rightpanel"] }`，默认 `{shell:false}` |
| `sidebar` | 否 | 见 §7 |
| `decorations` | 否 | 沿用现有装饰编译（badge/粒子/流式光标） |
| `translucency` | 否 | `{ web: 0-100, desktop: 0-100 }` 出厂值 |

### 5.2 示例（节选）

```json
{
  "schema": 1,
  "id": "nebula",
  "name": { "zh": "星云", "en": "Nebula" },
  "brand": { "title": { "zh": "星云", "en": "Nebula" }, "mark": "assets/mark.svg" },
  "colors": {
    "light": { "--dsw-alias-bg-base": "#F7F5F2", "--dsw-alias-brand-primary": "#5B3FD9" },
    "dark":  { "--dsw-alias-bg-base": "#101016", "--dsw-alias-brand-primary": "#9B8CFF" }
  },
  "wallpaper": {
    "kind": "video",
    "light": { "src": "assets/nebula-light.mp4", "poster": "assets/nebula-light.webp", "overlay": "rgba(247,245,242,0.72)", "blur": 0 },
    "dark":  { "src": "assets/nebula-dark.mp4",  "poster": "assets/nebula-dark.webp",  "overlay": "rgba(10,10,16,0.66)",   "blur": 0 }
  },
  "coverage": { "shell": false, "scopes": ["sidebar"] },
  "sidebar": { "surface": "frost", "blur": 14, "density": "cozy" }
}
```

### 5.3 内置与自定义的统一

- 内置主题在构建期用代码声明（保留现有 `defineSkin` 能力：品牌位 JSX、装饰编译、玻璃家族），编译产物**也规范化成同一份 `SkinEffects`**；
- 用户/Agent 主题一律运行时读 `theme.json`，投影核同一份；
- 两者在 catalog 中合并为一张表，`id` 冲突时内置优先并报 issue（不允许用户主题静默覆盖内置同名）。

## 6. 壁纸

### 6.1 四通道

| kind | 允许格式 | 上限 | 备注 |
| --- | --- | --- | --- |
| `image` | webp / png / jpg | ≤20MB | 沿用现有魔数校验与尺寸探测 |
| `video` | mp4(h264) / webm(vp9) | ≤60s、≤50MB | 静音、`loop`、`playsinline`、`muted`；poster 必填 |
| `animated` | gif / 动图 webp | ≤12MP、≤20MB | 走图片通道，标记为动图 |
| `code` | `art.js`（见 §6.3） | 单文件 ≤256KB | 可选携带 `assets/` 内图片 |

明暗各一套（`light` / `dark` 对象）；缺一侧时按"亮态复制一份并加暗遮罩"降级，并在面板上标灰提示。

### 6.2 背景栈（固定顺序）

```
壁纸层（图 / video / animated / iframe）
  → overlay（theme 指定，0-100% 不透明度）
  → blur（0-24px，桌面端单独可调）
  → 文字纱地板（常驻，保证承载区文字可读）
```

外壳是否参与由 `coverage` 决定：

| `coverage.shell` | 效果 |
| --- | --- |
| `false`（默认） | 会话区铺壁纸；外壳（侧栏/顶栏/右栏）为实色皮肤底 —— **等于当前 Desktop 行为** |
| `true` | 外壳透出壁纸；`scopes` 指定参与区域（不给则三处全参与） |

> 与 §7 正交：`coverage` 管"外壳透不透"，`sidebar.surface` 管"侧栏自己画什么"。面板给四个组合预设，不让用户自己拼：
>
> | 预设 | `coverage.shell` | `sidebar.surface` | 观感 |
> | --- | --- | --- | --- |
> | 实色外壳（默认） | `false` | `solid` | 现状：会话区壁纸，外壳一块实色 |
> | 全透 | `true` | `wallpaper` | 整窗一张壁纸，侧栏只留文字纱地板 |
> | 玻璃侧栏 | `true` | `frost` | 壁纸透出来，侧栏浮一层毛玻璃 |
> | 半透外壳 | `true` | `solid` + `fill` 带透明度 | 壁纸隐约透出，仍以侧栏本色为主 |

### 6.3 代码壁纸契约

`theme.json` 里：

```json
"wallpaper": { "kind": "code", "entry": "art.js",
  "light": { "overlay": "rgba(255,255,255,0.10)" },
  "dark":  { "overlay": "rgba(0,0,0,0.20)" } }
```

`art.js`：

```js
export const art = {
  kind: "canvas",
  mount(canvas, env) {
    // env = { width, height, dpr, mode: "light"|"dark", reducedMotion: boolean }
    // 自行 requestAnimationFrame；返回 { destroy() {} } 用于切主题时清理
  }
};
```

沙箱与兜底：

- 运行在 `<iframe sandbox="allow-scripts" srcdoc=…>`（**不给** `allow-same-origin`，源不透明，拿不到宿主对象）
- iframe 内 CSP：`default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:` —— **禁止网络**
- 入参只通过 `postMessage` 传；`env` 之外不提供任何宿主能力
- 首帧看门狗 2s：未出帧或抛错 → 该主题自动降级为 `colors` 渐变兜底，面板显示"代码壁纸已禁用"并提供"停用此壁纸"按钮
- `prefers-reduced-motion: reduce` → 只渲一帧静态画面
- 帧率上限 30fps；标签页隐藏时暂停；`destroy()` 必须在切主题、关面板、卸载时调用

### 6.4 视频性能策略

| 场景 | 行为 |
| --- | --- |
| 标签页隐藏 / 窗口最小化 | 暂停播放，保留 poster |
| 窗口失焦 | 降帧（保留 1/2 帧率） |
| `prefers-reduced-motion` | 不自动播放，只显 poster |
| 首次进入 | 先显 poster，`canplay` 后再淡入，避免白闪 |
| 低端机（实测首帧 >2s 或掉帧 >30%） | 面板提示并建议换静态壁纸，不自动降级（避免"看着看着变了"） |

## 7. 侧栏（左侧菜单）样式

### 7.1 规格字段

| 字段 | 取值 | 作用 |
| --- | --- | --- |
| `surface` | `solid` / `frost` / `wallpaper` / `custom` | 侧栏背景模式 |
| `background` | `{light,dark}` 颜色 / `{gradient}` / `{asset}` | `surface=custom` 时生效 |
| `fill` | `{light,dark}` | 实色或半透底色 |
| `blur` | 0–24 | `frost` 模式毛玻璃半径 |
| `radius` | `{card, item}` | 面板卡 / 菜单项圆角（px） |
| `density` | `compact` / `cozy` / `comfortable` | 行高与内边距 |
| `icon` | `{light,dark}` | 图标色调 |
| `states` | `hover` / `active` / `selected`：`{bg,fg,indicator?}` | 悬停、按下、选中态 |
| `divider` | `{color, style}` | 分隔线 |

### 7.2 实现边界

- 只发 `body[data-<theme>]` 作用域的 CSS + 令牌覆盖，**不动 DOM 结构**
- 图标优先走令牌；令牌覆盖不到的（个别内联 SVG）用 `[class*="_sidebarCol"] svg { color: var(--vft-sidebar-icon) }` 补
- 依赖的 CSS-module 局部类名（`_sidebarCol` / `_frame` / `_root` 等）由 `verify-upstream-hooks.mjs` 钉桩；DSH 升级时先在这挂红灯，而不是等用户看见错位
- 密度通过 `--vft-*` 自有变量下发，不覆盖宿主布局 token

### 7.3 内置侧栏样式包（5 款）

| 包 | 气质 | 典型搭配 |
| --- | --- | --- |
| `inherit` 同色延展 | 从壁纸主色派生，最稳 | 任意主题默认 |
| `frost` 玻璃浮层 | 半透 + 模糊 | 深色/星空/流体壁纸 |
| `hairline` 极简描边 | 透明底 + 1px 细线 | 水墨、留白类 |
| `obsidian` 墨黑卡 | 深色实心卡 + 亮色强调 | 动漫、强对比壁纸 |
| `neon` 霓虹描边 | 发光边缘 + 强调色 | 赛博、夜景 |

默认规则：主题未指定 `sidebar` 时，取 `inherit`，并按壁纸主色自动生成 `fill/icon/states`。

## 8. 配色评估

### 8.1 五维打分（0–100，加权总分）

| 维度 | 判定 | 权重 |
| --- | --- | --- |
| 文字对比度 | 正文/次要文字 vs（壁纸 + overlay + 文字纱地板）合成色 ≥ 4.5:1（AA） | 30 |
| 品牌色可辨识 | 主按钮/强调色 vs 背景 ≥ 3:1 | 20 |
| 明度分布 | 合成直方图不得集中在单一明度带（防"糊成一片"） | 20 |
| 色相和谐 | 主色与强调色夹角落在允许区间（互补 150–210° / 类似 0–45° / 单色 0–15°） | 15 |
| 壁纸干扰度 | 高频细节与文字区重叠面积惩罚 | 15 |

### 8.2 算法与输出

- 取主色：Node 侧 `sharp` 缩到 64×64 后中位切分，取前 3 色
- 候选配色：互补 / 类似 / 单色 × 明暗反转，逐个过五维打分，取最高
- 输出：`{ score, breakdown, failures: [{dimension, value, threshold, fix}], suggestions: [{type:"token"|"overlay"|"sidebar", ...}] }`
- 门禁：总分 < 70 时 `vft theme check` 退出码 2（可用 `--force` 越过，但面板会长期挂"未达标"角标）

### 8.3 内置配色预设（6 套）

暖感有机、macOS 毛玻璃、极简黑白、赛博霓虹、莫兰迪灰蓝、纸张暖黄。前两套来自 `vyra-theme-styles` 现有实现。

## 9. 面板与交互

- **入口**：侧栏底部「主题」按钮（原皮肤切换位置，折叠态为圆形调色盘）+ 设置 → 外观 一行；两者打开同一抽屉
- **形态**：左侧抽屉，可展开为宽屏（壁纸网格需要空间）
- **分区**：主题列表（内置 / 我的）· 壁纸库（内置 / 我的）· 外观（明暗、通透度、覆盖区域开关）· 侧栏样式（5 款 + 细调）· 品牌（名称/字标/图标/favicon）· 配色检查（评分卡）· 导入导出
- **交互**：hover 预览、点击应用、即改即存（停顿约 0.5s 自动写）、跨标签页同步（沿用）·「另存为我的主题」把当前覆盖固化成新目录并可改名 ·「恢复默认」先列受影响项再执行
- **两个"默认"别混**：「恢复默认」= 清掉**当前主题的个性化覆盖**（主题还在，回到该主题出厂值）；「回官方」= 整个界面换回 DeepSeek Harness 官方（面板顶部按钮 / `vft reset`）
- **深链**：保留 `?skin=<id>`（`?skin=official` 回官方），与现有行为一致
- **降级提示**：坏 `theme.json` / 坏 `art.js` / 缺资源，都在该主题卡片上标红并给一键"回退到上一个可用主题"

## 10. 存储与迁移

| 项 | 规则 |
| --- | --- |
| 数据目录 | Web：`$DSH_HOME/vyra-free-theme/`；Desktop：`$DSH_HOME/vyra-free-theme-desktop/` |
| 写入 | 原子写（临时文件 + rename），按字段合并，禁静默丢改动 |
| 备份 | 导入、覆盖、迁移前各存一份到 `backups/`（保留最近 10 份） |
| 迁移 | 首启检测旧目录（`dsh-skins` / `dsh-skins-desktop`）与 `dsh-theme-styles:active`：**复制不移动**，生成 `migrated-<时间戳>` 主题，个人图库并入，旧目录只读不动 |
| 恢复模式 | 配置损坏时只重建索引并隔离坏文件，绝不清图库 |

## 11. CLI `vft`

垫片：`~/.dsh/vyra-free-theme/bin/vft`（sh）与 `vft.cmd`（PowerShell/cmd），与 `vyra-screen-recorder` 的 `vsr` 同款做法。全部子命令支持 `--json`。

| 命令 | 作用 |
| --- | --- |
| `vft theme list \| show <id>` | 主题清单 / 详情 |
| `vft theme create --from <内置id\|preset> --name "…"` | 从内置或预设复制出新主题 |
| `vft theme rename <id> --name "…"` | 改名（同时可改 `name.en`） |
| `vft theme delete <id> [--force]` | 删除（默认进 `backups/`） |
| `vft theme apply <id>` / `vft reset` | 切换 / **回官方** |
| `vft theme reset <id>` | 清掉该主题的个性化覆盖（回到其出厂值，主题仍在） |
| `vft theme export <id> --out x.vft.zip` / `vft theme import <file>` | 导入导出（含资源与 `art.js`） |
| `vft wallpaper list \| add \| set` | 图库列表 / 添加（多文件）/ 指定明暗位 |
| `vft wallpaper gen <id> --prompt "…" [--preset 写实\|插画\|抽象\|风景]` | 走本地 ComfyUI 出静态壁纸 |
| `vft wallpaper video <id> --from <图> [--model …]` | 图生视频出动态壁纸 |
| `vft sidebar list \| set <id> <pack>` | 侧栏样式包 |
| `vft sidebar tune <id> --icon "#fff" --radius 12 --density cozy` | 侧栏细调 |
| `vft colors suggest <id> [--apply]` | 配色建议 |
| `vft brand set <id> --title "…" --mark <file> --favicon <file>` | 品牌替换 |
| `vft appearance set <id> --translucency 40 --coverage shell=on,rightpanel=off` | 外观与覆盖 |
| `vft theme check <id> [--screenshot out.png]` | 渲染自检 + 配色门禁 + 出图存证 |

退出码：`0` 成功 · `2` 校验失败（含配色未达标）· `3` 需要人工确认（删除/覆盖）· `1` 运行错误。

### 面板 ↔ CLI 映射（保证"人类能做的 Agent 都能做"）

| 面板动作 | CLI |
| --- | --- |
| 切换主题 | `theme apply` |
| 新建 / 改名 / 删除 | `theme create / rename / delete` |
| 上传壁纸 | `wallpaper add` |
| 选内置壁纸 | `wallpaper set` |
| 侧栏样式 / 细调 | `sidebar set / tune` |
| 品牌替换 | `brand set` |
| 通透度 / 覆盖开关 | `appearance set` |
| 配色检查 | `colors suggest` / `theme check` |
| 导入导出 | `theme import / export` |
| 恢复默认（复位当前主题） | `theme reset <id>` |
| 回官方 | `reset` |

## 12. 技能 `vyra-free-theme`

插件初始化时写入 `~/.dsh/skills/vyra-free-theme/SKILL.md`。内容：

1. **何时用**：换主题、做壁纸、配侧栏、配色诊断、导入导出
2. **命令表** + `--json` 输出形状 + 退出码语义
3. **三条工作流**
   - ① 一张图造主题：`theme create` → `wallpaper add` → `colors suggest --apply` → `theme check`
   - ② ComfyUI 出一套壁纸：选预设 → `wallpaper gen`（多张）→（可选）`wallpaper video` → `theme check --screenshot`
   - ③ 导出 / 分享 / 回滚：`export` → 远端导入 `import` → 不满意 `theme apply <旧的>`
4. **铁律**：先 `theme check` 再交付；不许改宿主 DOM；删主题要确认；代码壁纸必须自带兜底；第三方 IP 角色图只允许出现在标记为 `ip` 分组的主题里，且卡片必须带"非官方 · 版权归原作者"角标（见 §13.4）
5. **兜底路径**：CLI 不可用时直接写 `themes/<id>/theme.json` + 跑 `vft theme check` 校验（文件是唯一真相）

## 13. 内置主题

### 13.1 清单

| id | 名称 | 类型 | 壁纸 | 默认侧栏包 | IP |
| --- | --- | --- | --- | --- | --- |
| `nebula` | 星云 | 原创 · 抽象流体 | 6 静 + 2 动 | `frost` | — |
| `ink` | 山水 | 原创 · 水墨 | 6 静 + 1 动 | `hairline` | — |
| `fanren` | 凡人修仙传 | 动漫 | 6 静 + 2 动 | `obsidian` | 第三方 |
| `linglong` | 灵笼 | 动漫 | 6 静 + 2 动 | `neon` | 第三方 |
| `mushenji` | 牧神记 | 动漫 | 6 静 + 2 动 | `inherit` | 第三方 |

`fanren` 优先复用仓库内已有 `plugins/dsh-skins/assets/meirenzhi/*.webp`（6 张 AI 生成粉丝画作），其余按需补生成。

### 13.2 生成链路

`scripts/gen-theme-assets.mjs` → 本地 ComfyUI HTTP API（`COMFYUI_URL` + Basic 认证，实测 `http://127.0.0.1:8188`）：

1. 静态图：`comfyui/workflows/txt2img-1024x1536.json`，每主题按提示词矩阵出 8–12 张，人工/Agent 挑 6 张
2. 动态壁纸：`comfyui/workflows/img2video-720p.json`（图生视频，3–5s 可循环），出 2 段
3. 后处理：webp q80（≤600KB/张）、mp4 h264 + faststart（≤50MB/段）、生成 poster 首帧
4. 产物入 `themes/<id>/assets/`，随包发布

### 13.3 分组与剥离

主题按 `group` 标记：`core`（`nebula` / `ink`）与 `ip`（三部动漫）。构建脚本支持 `--no-ip`，产出只含原创的分发变体；市场侧若要求下架，一条命令切换，不返工。

### 13.4 版权声明（用户明确接受风险后执行）

- 包内 `NOTICE.md` 与 README 声明：`fanren` / `linglong` / `mushenji` 为**非官方衍生作品**，角色形象与名称版权归原作者/版权方所有，与版权方无关联、未获授权；分发者自行承担分发风险
- 面板内这三套主题的卡片带"非官方 · 版权归原作者"角标
- 该声明的存在不改变侵权性质，仅为如实披露

## 14. 退役与发布

1. 新包 `vyra-free-theme@0.1.0`，`package.json` 的 `dsh.client.inject` 沿用 dsh-skins 的注入面
2. `docs/index.json` / `index-github.json`：下架 `vyra-theme-styles` 与 `@iasiv5/dsh-skins`，上架新插件
3. 旧两插件 README 顶部加迁移指引（指向新插件与自动迁移说明）
4. profile：禁用旧两插件（`cordis.patch.yml` 增加 `disabled: true` 条目），确保不再双令牌冲突

## 15. 测试与门禁

| 门禁 | 内容 |
| --- | --- |
| smoke | 5 套内置主题 × 明暗两态逐个投影 + 面板渲染，无异常 |
| 对比度 | `verify-contrast`：每套内置主题两态 ≥ AA；侧栏文字/图标同样计入 |
| 上游钩子 | `verify-upstream-hooks`：侧栏/顶栏/右栏钩子字面量钉桩，DSH 升级先红 |
| 配色 | `vft theme check`：内置主题总分 ≥ 70 |
| 壁纸性能 | 视频首帧 ≤2s、隐藏暂停、内存无增长（连续切 20 次不涨） |
| 回滚 | 坏 `theme.json`、坏 `art.js`、缺资源三种情形下界面可用且能一键回退 |
| CLI | 全部子命令 `--json` 输出可解析；退出码符合 §11 |
| 迁移 | 用真机 `$DSH_HOME/dsh-skins-desktop` 副本跑迁移，图库 100% 保留 |

## 16. 已知边界

- 侧栏样式依赖宿主 CSS-module 局部类名，DSH 大版本升级可能需要更新钩子
- 视频壁纸在无硬件解码的老机器上 CPU 占用明显，只提示不强制降级
- 代码壁纸在沙箱里执行，**无法**读取宿主主题变量（只拿 `env`），复杂联动需要主题自己在 `env.mode` 上分支
- 导入的主题会执行 `art.js`：面板在首次启用代码壁纸时明确提示"这是本地代码"
- 外壳覆盖开启后，Desktop 的窗口按钮区与顶栏需要单独确认可读性（P3 阶段截图验收）

## 17. 实施阶段（供 writing-plans 展开）

| 阶段 | 内容 | 完成判据 |
| --- | --- | --- |
| P0 | 新建 `plugins/vyra-free-theme`（fork dsh-skins 源码 + 改名 + 去品牌），构建与 smoke 跑通 | 装上后行为与现状一致，无双令牌冲突 |
| P1 | `theme.json` 模型 + 投影核统一 + 内置 2 套原创改写成 JSON | 两种来源产出同一份 `SkinEffects` |
| P2 | 壁纸四通道 + `coverage` 开关 | 视频/动图/代码壁纸均可应用且能降级 |
| P3 | 侧栏 spec + CSS 编译 + 5 款包 + 钩子桩 | 5 款包逐个截图验收 |
| P4 | 配色评分 + 面板评分卡 + 6 套配色预设 | 内置主题全部 ≥70；CLI 可复现 |
| P5 | CLI `vft` + 技能写入 + 面板↔CLI 对照自测 | 面板每个动作都有 CLI 等价路径 |
| P6 | 内置 5 套主题出图出视频、打包、门禁 | 5 套 × 2 态全绿；`--no-ip` 变体可构建 |
| P7 | 迁移 / 退役 / 发布 | 真机迁移通过；索引与 profile 更新 |