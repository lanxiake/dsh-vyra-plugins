# dsh-vyra-plugin-market · 插件市场

**左侧栏里的插件市场，同时也是插件页的一个标签页。** 苹果式卡片、多源聚合、批量安装。

## 它解决什么问题

DSH 自带的 Discover 是一次一个市场源、一次装一个；社区市场插件（`dsh-plugin`）又另建了一套安装通道。

这个插件把**浏览**、**聚合**和**批量操作**合到一起：

- **三个入口**：设置菜单、左侧栏、插件页标签页；左侧栏和插件页可以在设置页里单独开关
- **多市场源**：Veyra 精选、dsh.so、dshmarket.com、DSH Open Market、DSH Go Market 开箱即用；源列表与「设置 → 插件 → 索引源」是同一份配置；「管理市场源」里每项可一键复制地址，拖动可调整顺序，顺序同步到源下拉框
- **跨源安装识别**：搜索时会按包名、scope 短名、仓库+目录、Git 安装 spec 匹配 profile 里已安装的 bundle；从别的市场装过的插件会直接显示“已安装”，不会再次给出安装按钮
- **跨源搜索**：搜索框旁的「跨源搜索」把所有已配置源并行查一遍，按包名去重，卡片上标出来源；每源取前 20/60 条
- **Agent 可用**：`vyra-market` CLI 提供跨源搜索、版本、下载、安装/更新/卸载计划；配套技能指导 Agent 优先使用宿主的 `plugin_market` / `plugin_manager` 工具
- **苹果式界面**：大标题、分段胶囊、圆角卡片、hover 抬升、骨架屏、亮暗主题自适应
- **热度指标**：卡片显示 `★ stars` 与 `↓ npm 下载量`（dsh.so 的悬浮提示还会给出近一周下载量）；format-1 源用 `metadata.sortKeys` 原生排序，第三方源用精简的 `stats.json` 覆盖层。索引不提供安装量/查看量，卡片不臆造这两个数字
- **卡片式预览**：图标、名称、版本、作者、发布时间、状态标签（已安装 / 可更新 / 客户端自带 / 版本不兼容 / 预览版）；没有图标的源用「首字 + 按名称生成的底色」圆角方块代替，便于区分；点卡片即开详情，不需要额外按钮
- **搜索与筛选**：全文搜索、状态（全部 / 仅市场已安装 / 仅可更新 / 未安装）和分类压缩在同一行工具栏、默认 / 相关度 / 发布时间 / 热度排序、分页。「仅市场已安装」只在市场索引内筛选，profile 里真正装了哪些插件看「已安装」标签页
- **懒加载与缓存**：首屏 40 条，按需「显示更多」；页面按源/查询缓存 5 分钟，切回刚看过的源瞬间恢复
- **后台安装队列**：安装/更新进入队列，一次跑一个；切到聊天或其他面板也继续。队列清空后弹出完成 toast，成功/失败/需重启一目了然；需要重启时给「立即重启」（客户端带重启桥时）或手动步骤
- **排队可收起**：进度条上的「队列还有 N 项」是一个开关；排队超过 3 项时默认收起，展开后列表最高 180px 独立滚动，不会把下方卡片挤出屏幕；勾选过多时批量条的已选清单同样可收起
- **真取消**：当前安装/更新调用宿主 `cancelInstall`，pnpm 退出并回滚 profile 文件；排队项可直接移除；`applying` 阶段可能返回 `too-late`，界面如实提示
- **已安装页**：不依赖市场源，直接列出宿主 `listBundles()` 的全部 bundle——手动装的、其他市场装的、客户端自带/可选的都在这里；支持卸载、启停、查看本地 README。页头摘要给出「N 个已安装 · 启用 · 停用」，标签页上不再重复挂数字
- **Agent 提示**：页头介绍下面有一行「在 AGENT 会话里直接调用插件市场」，点开给出说明和 4 个用例（搜索·安装 / 检查更新 / 卸载·停用 / 批量多装），点一下即复制可直接粘进任意会话的原话
- **批量操作**：勾选后一次**安装 / 更新、卸载、启用、停用**多个插件，操作前弹确认框逐条列出目标

## 内置聚合源

| 源 | 类型 | 数据 |
|---|---|---|
| Veyra 精选 | format-1，宿主读取 | 本仓库的插件与收录 |
| dsh.so 插件市场 | 客户端适配器 | 26,000+ 可安装条目，自带 star、npm 下载量、安全扫描与 L1–L5 验证等级 |
| dshmarket.com 目录 | format-1，宿主读取 | 6,000+ 条精选目录（`dsh-plugin-catalog`） |
| DSH Open Market | format-1，宿主读取 | 1,340 个社区插件（`dshopen.org`），官方 format-1 校验通过 |
| DSH Go Market | format-1，宿主读取 | 41 个精选插件，带缓存 worker（`go.dshtui.com`） |

三个宿主目录在首次打开时自动加入；删掉后不会再次自动加回。dsh.so 是客户端内置的虚拟源，不写进 profile 的索引源列表。

> 另外测试过 dshbase、LivXue Plugin Shop、dsh.market：前者是自定义 schema，后两者插件数据分别约 28MB / 72MB，作为内置源会明显拖慢首屏，因此本轮没有收录。

## 用法

点左侧栏「插件市场」，或在插件页切到「插件市场」标签页。

勾选若干卡片后，上方出现批量条；「安装 / 更新」与「卸载」会先弹确认框列出将要改动的每一项。

## 在 AGENT 会话里使用插件市场

页头介绍下面有一行「在 AGENT 会话里直接调用插件市场」，点开是说明和一排用例；点用例即把原话复制到剪贴板，粘进任意会话就能用。

不需要记工具名：**你只说要什么，Agent 自己选通道**。

| 用例 | 复制出来的一句话 | 实际发生什么 |
|---|---|---|
| 搜索 · 安装 | 帮我在 DSH 插件市场里搜一个能录屏的插件，挑评分高的装上 | Agent 用宿主的 `plugin_manager`（`list_bundles` / `install_bundle`）安装；需要跨源找同名的用 `vyra-market search` |
| 检查更新 | 看下我装的 DSH 插件有哪些能更新，列出来再帮我全部更新 | `plugin_manager list_bundles` 里带 `update` 的逐项 `install_bundle`；未直接应用的会返回 `nextStep` |
| 卸载 · 停用 | 把我不再用的 DSH 插件卸掉，太占地方的先停用不卸载 | `remove_bundle` / `set_bundle`（`enabled: false`） |
| 批量多装 | 一次性装好 SSH 终端、OCR 取字和音乐面板这三个插件，装完告诉我哪些需要重启 | 依次 `install_bundle`；只读类任务可让 Agent 先用 `vyra-market install --json` 出安装计划给你确认 |

要点：

- `plugin_manager` 的每次写操作都需要 `danger-full-access` 或该次调用的批准，批准不会改会话权限模式。
- 装完需要重启的会带 `restart-required`，Agent 会明确告诉你要重启客户端。
- 只想查不装，用 `vyra-market search|info|download --json`，默认全程只读。

## 后台安装队列

- 安装/更新进入 FIFO 队列，一次只跑一个；正在跑时再点安装会追加到队尾，不覆盖当前项。
- 队列属于插件模块，不属于页面组件：切到聊天或其他面板、关闭插件页都不会停止。
- 进度条显示当前项、队列位置、宿主阶段（安装 / 取消 / 应用）和已用时；可展开查看 pnpm 日志。
- 「队列还有 N 项」是队列开关：排队超过 3 项时默认收起，只占一行；展开后最多 180px 高、独立滚动，再点一次收起。这样一次装几十个也不会把下面的卡片挤出屏幕。
- 「取消」会：
  - 移除还没开始的排队项；
  - 对当前安装/更新调用 `cancelInstall(requestId)`，宿主中止进程并回滚 `package.json` / `pnpm-lock.yaml`；
  - 进入 `applying` 后返回 `too-late`，界面提示“已进入应用阶段，无法中止”。
- 队列清空后弹出应用内 toast：成功、失败、需重启；有 `layout` 服务时可一键打开侧边栏市场面板。
- 需要重启时 toast 不再自动消失，并给出「立即重启」按钮——前提是桌面客户端提供了重启桥（见下）。没有桥就换成一整句手动步骤，不会画一个按下去没反应的按钮。

**重启按钮的边界**：重启 DSH 是 Electron 主进程的事（`app.relaunch()`），插件市场跑在渲染进程，自己停不了也起不来 Host。所以界面探测 `window.dshDesktop.restartApp()`：存在才显示按钮，「已安装」页的启用/停用/卸载提示条同理。当前官方桌面客户端还没有这个桥，因此看到的是手动指引；装到带桥的客户端后，同一处自动变成可点的按钮，市场这边不用再改。系统托盘不归插件管，加不了重启入口。

**边界**：队列只保证同一客户端会话内切页面继续。刷新/关闭客户端后，内存队列丢失；宿主可能仍在跑完那次 pnpm，但客户端无法重连一个已丢失的 requestId。

## 已安装页

市场页顶部有「市场 / 已安装」分段：

- 「已安装」不依赖任何市场源，直接读 `pluginManager.listBundles()`。
- 数量不再挂在标签页上：页头摘要显示「N 个已安装 · 启用 · 停用」，标签页只写「已安装」。市场工具栏的筛选叫「仅市场已安装」，它只在当前市场索引里筛，不等于 profile 的全部已安装插件。
- 因此手动 `dsh plugin add`、其他市场安装、客户端自带、可选组件都会出现，并打上对应标签。
- 每张卡支持：**详情、卸载、启用/停用**；不可卸载或只读时按钮隐藏/禁用并说明原因。
- 详情优先调用 `readBundleDetail(name, lang)` 读已安装包的本地 README；老宿主没有这个方法时回退到 manifest 描述。
- 操作完成后由 `plugin-manager/changed` 事件刷新列表，不需要手动重进页面。

本轮不包含“非市场已安装插件检查更新/更新”，避免把发现、安装、更新三条通道混在一起。

## 显示位置

设置菜单里的插件市场始终保留。在设置页的市场顶部有「显示位置」开关：

- **左侧菜单栏**：控制 `sidebar.panellist` 那一行；关闭后侧边栏不再显示行，但 `main` 面板仍保留，完成 toast 的「查看」仍可打开。
- **插件页面**：控制插件页里的「插件市场」标签页。

两个开关都关闭时，仍可从设置菜单进入，不会把市场入口全部关死。开关存在浏览器 localStorage。

## 网络线路

设置页里有「网络线路」：

- **自动**：打开市场时探测国内（npmmirror / GitCode）与海外（npmjs / GitHub）的延迟；国内线路可达时优先国内，只有海外快 1.5 倍以上才切海外。结果缓存 24 小时。
- **国内**：Veyra 索引用 `docs/index.json`，插件从 GitCode 安装。
- **国外**：Veyra 索引用 `docs/index-github.json`，插件从 GitHub 安装。
- 「重新检测」立即重新探测；市场源加载失败时，错误页会直接给出「切换到国内/海外线路」按钮。
- 该切换作用于 Veyra 这一个逻辑源；第三方源的安装来源由它们自己的索引声明，不做改写。

## 加载与缓存

- 首屏 40 条，之后每次「显示更多」再加 40 条。
- 页面按 `源 + 查询 + 分类 + 排序 + 偏移` 缓存 5 分钟；切回刚看过的源/查询直接恢复，不再等宿主机往返。
- 宿主索引本身有约 10 分钟的缓存；dsh.so 的解析数据在会话内缓存 6 小时。
- 刷新按钮会同时清掉客户端页面缓存并让宿主绕过索引缓存。
- `plugin-manager/changed` 会清空页面缓存，避免安装状态过期。

## 跨源搜索

搜索框旁有「跨源搜索」按钮，源菜单里也有「全部市场源」：

- 并行查询每个已配置源（Veyra、dsh.so、dshmarket.com、DSH Open Market、DSH Go Market 和自定义源）。
- 卡片按包名去重；同一插件多个源都有时，优先已安装/可更新、再取较新版本。
- 卡片标签显示来源；重复来源最多显示两个，其余用 `+N`。
- 有文本时每源取前 60 条，无文本浏览时每源取前 20 条；跨源模式不做无限分页。
- 某个源失败不影响其他源，页面上会提示失败数量；全部失败才进入错误态。
- 普通单源浏览仍然保留完整分页和该源的分类/热度排序。

## Agent CLI 与技能

插件包内附带 `cli.mjs`，安装后也可作为 `vyra-market` 命令使用。默认只读：

```sh
node plugins/vyra-plugin-market/cli.mjs search "context" --limit 10 --json
node plugins/vyra-plugin-market/cli.mjs info <package-name> --json
node plugins/vyra-plugin-market/cli.mjs list --profile desktop --json
node plugins/vyra-plugin-market/cli.mjs download <package-name> --dest ./vendor --json
node plugins/vyra-plugin-market/cli.mjs install <package-name> --json   # 输出安装计划
node plugins/vyra-plugin-market/cli.mjs update <package-name> --json    # 输出 remove+add 计划
node plugins/vyra-plugin-market/cli.mjs uninstall <package-name> --json # 输出卸载计划
```

- `--source=veyra|dshmarket|dshopen|dshgo|URL` 限制源；默认全部内置源。
- `--region=domestic|overseas` 选择 Veyra 索引版本。
- `--apply` 才会运行官方 `dsh plugin --profile <p> add/remove`；需要 `--dsh`、`DSH_BIN` 或 PATH 里有 `dsh`。
- 不 `--apply` 时输出 `installSpec` 和等价的 `plugin_manager` 工具调用，Agent 可以走宿主工具。
- CLI 使用 10 分钟索引缓存和 `~/.dsh/market-downloads` 下载目录。

配套技能在 `skills/dsh-vyra-plugin-market/SKILL.md`，说明 Agent 的推荐流程：

- 搜索/版本：CLI 跨源搜索 + `plugin_market` 工具。
- 安装/卸载/启停：优先宿主的 `plugin_manager` 工具（同一个 profile 锁、激活与回滚）。
- 更新：市场 UI 的更新保留 Git 来源；CLI 的 update 是 remove+add，可能重置配置，需确认。
- 安装第三方代码和构建脚本前先确认来源与信任。

## 它凭什么能装插件

**它不自己装插件。** 所有读取与改动都走客户端自己的 Remote 接口：

| 做什么 | 走哪条 |
|---|---|
| 读市场源、搜索、分页 | `remote.pluginMarket` |
| 安装、更新、卸载、启用、停用 | `remote.pluginManager` |

因此：

- **索引源配置只有一份**。这里切源改的就是「设置 → 插件 → 索引源」，不是另存一份
- **安装结果与官方一致**。走的是同一个插件管理器，同一个 profile 锁，同一条 pnpm 通道
- **format-1 索引仍由宿主拉取解析**（所以索引源即使没开 CORS 也能读）；只有 dsh.so 适配器和 `stats.json` 覆盖层由客户端直连，两者都带 `Access-Control-Allow-Origin: *`，失败时静默降级

## 边界

- **索引是第三方内容**：标题、图标、安装来源都由索引自己声明，客户端只校验格式。只添加你信任的源
- **更新只对 Git 安装的插件生效**：`updateBundle` 只接受宿主标记 `update: true` 的版本（即同一仓库目录的另一个提交）；npm 装的插件在客户端里没有原地升级的通道，需要先卸载再安装
- **客户端自带（provided）的插件不会出现在卸载按钮上**——它不是这个 profile 装的，不该由这里删

## 安装

**从 npm 安装（推荐）**——包已发布到 npm，不依赖本仓库的 git 提交：

```sh
dsh plugin --profile <profile> add dsh-vyra-plugin-market
```

或让 Agent 用宿主的 `plugin_manager` 安装（`install_bundle`，`target` 传 `dsh-vyra-plugin-market`）。也可以直接 `npm i dsh-vyra-plugin-market` 装 `vyra-market` 这个 CLI。

> 首次发布后版本会有一段 **Validating**（npm 自动审核）时间，期间 `npm install` 可能取不到新版本 —— 在 npmjs.com 包页的「Version History」看到状态是 **Published** 才表示可装。

**从市场索引安装**——在客户端「设置 → 插件 → 索引源」加入：

```
https://lanxiake.github.io/dsh-vyra-plugins/index.json
```

然后搜索「插件市场」安装。

> 「市场 → 已安装」里的**原地更新只对 git 安装的插件生效**（宿主按同一仓库目录的另一个提交标注 `update`）。npm 安装的版本更新时，先卸载再安装，或用上面的 `dsh plugin add` 覆盖安装。

## 为什么没有宿主端

format-1 索引的获取、解析、搜索、分页、安装状态标注都在宿主侧的 `pluginMarket` 里，插件改动也在 `pluginManager` 里。dsh.so 的索引格式不是 format-1，所以由客户端适配器读取、过滤和分页；它最终仍然把安装 spec 交给 `pluginManager`。索引源配置、profile 锁和安装通道都没有第二套。

## 开发

```sh
pnpm run test:market        # 纯逻辑自检 + 用桩 React/Remote 渲染一遍
pnpm run build:stats        # 重新生成 docs/stats.json（需要访问 awesome-dsh-plugin.com）
pnpm run build:index        # 重新生成 docs/index.json（会读取 stats.json 写 sortKeys）
```

`test.mjs` 覆盖卡片状态、批量计划、队列追加/取消、requestId、dsh.so 适配、统计匹配和已安装标签；`render-check.mjs` 用桩把标签页真正渲染一次，验证注册进 `plugins.tab`、`sidebar.panellist`、`main`，空源时自动加源，卡片的 Install 走 `installBundle`，以及「已安装」页对非市场 bundle 的详情、启停、卸载。

## 交流群

有问题、想提功能、或者想看看别人怎么用，欢迎加 QQ 群（群号 1121362543）。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/qq-group.png" />
  <img alt="QQ 交流群二维码，群号 1121362543" src="./assets/qq-group.png" width="220" />
</picture>
