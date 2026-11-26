# DSH Console

让 Agent 操作 DeepSeek Harness 自身：读取整机清单、**打开设置页并切到某个插件的设置节**、
切换主面板与右栏、调用命令，也查看与切换模型、读写设置、管理插件、调整主题与布局。
也可以直接在侧栏打开**管理面板**，用点击完成同一批操作。

```sh
dsh plugin --profile web add dsh-vyra-dsh-console
```

> **0.1.2 是坏的，请不要使用。** 它的 `files` 漏了 `tool.js` 与 `domains/`，
> Host 半边在每次安装上都会 `ERR_MODULE_NOT_FOUND`：`dsh_console` 工具、RPC 端点、
> 面板全都不存在。0.2.0 是第一个能用的版本。

这个插件的重点不只是「能做什么」，更是「不能做什么」。Agent 可以改变 harness **长什么样、怎么配置**，但永远不能改变自己**握有多大的权限**——沙箱模式、权限预设、审批应答、凭据写入这四类动作在 `core.js` 的 `FORBIDDEN` 表里被永久拒绝，并附带给用户的操作替代方案。所有动作经由同一张 `ACTIONS` 注册表分派，因此边界只有一处定义、两个调用方（Agent 工具与客户端面板）共用。

**打开界面不等于绕过边界**：Agent 可以把你带到那个设置页，但不能替你按下页面里的权限开关。

## 安装

在会话中让 Agent 安装，或在插件面板里安装本目录：

```
plugin_manager install_bundle plugins/vyra-dsh-console
```

安装后重载界面；Host 侧改动需要重启 DSH。

## 让 Agent 操作界面

三件套各司其职：

```jsonc
dsh_console({ "action": "console.map" })   // Host：插件、插件包、MCP、技能、工具
dsh_console({ "action": "ui.list" })       // Client：设置页、主面板、右栏 tab、命令（含所属插件）
dsh_console({ "action": "console.actions" }) // 全部动作，以及被永久拒绝的那些
```

| 动作 | 做什么 |
|---|---|
| `ui.list` | 列出设置页（每行带 `registrant`，即贡献它的包名）、主面板、右栏 tab、命令 |
| `ui.state` | 当前开着哪个弹窗、停在哪个设置节、选中哪个主面板 |
| `ui.open` | `{target:'settings', section}` / `{target:'main', id}` / `{target:'rightbar', kind\|address}` |
| `ui.close` | 关闭设置弹窗 |
| `ui.invoke` | 触发一条命令（Web/Linux 可用；桌面端原生键盘接管，会返回键位让用户按） |
| `console.map` | 整机清单一次看全，读不到的服务写进 `caveats` 而不是让整张图失败 |

成功结果里**`verified: true` 才代表真的发生了**：每次打开都会回读界面确认
（弹窗存在、目标节的 `aria-current` 为真），拿不到就报 `error`，绝不默认成功。

三种失败含义不同：`unavailable`（界面没连、标签在后台、平台不支持）、
`error`（id 不存在 / 另一个弹窗开着，附带 `candidates` 供重试）、
`forbidden`（改自己的权限，永久拒绝）。

### 设置页为什么只能"点"

主面板和右栏有公开服务（`ctx.layout.selectPanel`、`ctx.sidebarRight.openTab`），
直接调用即可。设置弹窗没有公开服务——`openSection` 是发给 `settings.launcher`
这一格的私有 owner prop。所以 Agent 走的是真人同一条路：按快捷键标记找到触发器、
必要时先展开账户菜单再点其中的"设置"行、最后按 `order` 索引点导航项。
三条路径**每次都校验**，点不出结果就报错。

## 技能与 CLI

- **技能**随插件在运行时注册（`ctx.inject(['skills'])`），不往 `~/.dsh` 写文件；
  卸载即消失，`DSH_HOME` 只读也不受影响。
- **CLI 仍只读**：`doctor` / `map` / `state` / `services` / `events`，全部支持 `--json`。
  `map` 会明确标注哪些是浏览器状态（`unknown`）以及该用哪个工具去问，而不是猜。

## 管理面板

装好后侧栏会多一个入口，打开就是控制台面板，分六页：

| 页 | 做什么 |
|---|---|
| 总览 | 当前模型、当前外观、插件包与 MCP 数量，以及权限边界的一句话说明 |
| 外观 | 主题（跟随系统 / 浅色 / 深色）、语言、侧栏与右栏 |
| 模型 | 列出已注册的服务商与当前默认，改新建会话用的默认选择 |
| 插件 | 插件包与插件行两层，各自启停；受保护的项按钮置灰 |
| MCP | 每个服务的连接状态，可探测或重启 |
| 动作与边界 | `console.actions` 的原样表格，**外加被永久拒绝的动作、原因与该由谁来做** |

### 面板和工具调用的是同一份实现

这是这个插件最重要的设计约束，也是面板存在的意义：

- **外观类**（主题、语言、侧栏、右栏）面板直接调用 `applyOp(services, op, args)` —— 就是 Host 经通道下发请求时走的那个函数。不是「同样的逻辑再写一遍」，是同一个函数。
- **Host 类**（模型、插件、MCP）面板 POST 到 `/api/vyra-console/rpc`，由 `core.js` 分派。这条路径和 `dsh_console` 工具完全相同。
- 面板**不带自己的动作清单**：动作、域、是否改动、是否不可逆、是否需要界面，全部读 `console.actions` 的返回。新增一个动作，面板自动多一行；删掉一个，面板自动少一行。

因此面板永远不会和 Agent 看到的不一致——它们看到的是同一份数据经过同一条路径。

### 被拒绝的动作是**可见的**，不是藏起来的

「动作与边界」页会列出 `FORBIDDEN` 里的每一个动作，并原样显示 `core.js` 写的 `reason`（为什么拒绝）和 `alternative`（该由用户在哪里做）。静默隐藏会让用户反复追问「为什么它就是不做」，把拒绝摊开来说才是这个边界的价值。

### 面板坏了也不会白屏

面板整体包在一个错误边界里：组件抛异常时显示错误和「重试」，侧栏其他入口照常可用。某个服务或 Host 端点不可用时，对应那一页显示原因横幅而不是空白。React 组件一旦抛出去，整个 `main` 插槽就是一片空白且毫无提示——这是必须避免的失败模式。

## 结构

```
dsh-vyra-dsh-console/
├── package.json       # Bundle manifest
├── cordis.patch.yml   # Host 插件行
├── index.js           # Host 入口
├── core.js            # 动作注册表、权限边界与分派器
├── channel.js         # Host ↔ Client 请求/响应通道
├── client.js          # Client 半：外观桥、面板注册、文案字典
├── panel.js           # 管理面板（React，纯浏览器模块）
├── cli.mjs            # 只读 CLI：vyra-console
├── locale/            # 面板文案 zh + en（由 client.js 生成，见下）
├── icon.svg           # 插件图标
├── test/              # node --test：边界、通道、面板、CLI 自检
└── assets/            # 交流群二维码
```

`locale/*.json` 是**生成物**，来源是 `client.js` 里 `i18n:zh` / `i18n:en` 标记之间那份字典。浏览器 bundle 不能 `import` 包内文件（`require` 在那个 realm 里解析的是 shell 交给它的东西），所以文案必须以字面量随 bundle 走；`locale/*.json` 是给市场卡片和插件详情页读的。两份用脚本生成，就不会各说各话：

```powershell
node plugins/vyra-dsh-console/scripts/build-locale.mjs
```

`test/client.test.mjs` 会断言两者的键集合完全一致，改了一边忘了另一边会直接失败。


## CLI（只读）

给 Agent 的**诊断路径**：想知道「这台机器现在什么配置」，不必烧 tool call。

```sh
node plugins/vyra-dsh-console/cli.mjs doctor            # 一次汇总
node plugins/vyra-dsh-console/cli.mjs doctor --json     # 机器可读
node plugins/vyra-dsh-console/cli.mjs state --profile=desktop
node plugins/vyra-dsh-console/cli.mjs services
node plugins/vyra-dsh-console/cli.mjs events
```

| 命令 | 输出 |
|---|---|
| `doctor` | 一次汇总：已装 bundle 及其版本与记录的启用状态、模型与 provider、外观类插件、MCP 声明 |
| `state` | 模型默认选择、patch 层记录的启用/禁用、bundle 数量 |
| `services` | 本插件各动作依赖的服务，以及该 profile 是否装了它（**只有声明证据，不是运行状态**） |
| `events` | 本机日志目录清单，逐个注明存在与否 |

选项只有 `--profile=<name>`（默认 `DSH_PROFILE` 或 `desktop`）、`--json`、`--help`。
profile 目录解析与 `dsh-vyra-plugin-market` 一致：`$DSH_HOME`（默认 `~/.dsh`）下 `profiles/<name>`。

退出码：`0` 成功，`1` 真失败（profile 不存在、清单读不了），`2` 用法错误。
`--json` 只往 stdout 写一份合法 JSON（诊断信息走 stderr），字段每次相同，因此可以直接管道给 `jq`。

### 这里**没有** `--apply`，而且不会加上

变更一律走 `dsh_console` 工具，因为只有它用与 Web UI 相同的 profile 锁、激活与回滚路径。
CLI 直接改 `package.json` 或 `cordis.patch.yml` 会绕过这三样：与运行中的进程抢写、无法激活、
半截写入没有回滚。所以这个 CLI **只读是构造出来的**，不是约定：

- 它只 `import` `node:` 内建模块，`node:fs` 里只取 `existsSync` / `readFileSync` / `statSync`，
  连 `node:child_process` 都没有——没有写入函数可调，也无法转手让别的进程去写；
- 打一个**变更类动作名**当命令（如 `vyra-console plugin.remove`）会被拒绝，并打印该用的那一次
  `dsh_console` 调用。拒绝表由 `core.js` 的 `ACTIONS` 推导，新增变更动作会自动被拒。

`test/cli.test.mjs` 对临时 fixture profile 跑全部命令与全部输出模式，前后对整个目录树取哈希并断言
逐字节相同。

### doctor 的诚实边界

`doctor` 只读**真实文件**，并且对每个结论都注明出处。进程内才有的东西——Loader 的插件树、
正在生效的模型路由、MCP 连接状态——它看不到，于是显式打印 `unknown` 加原因，而不是省略或猜。
一个自信而错误的 `doctor` 比一个不完整的更糟：Agent 会照着它行动。运行状态请用 `dsh_console`
的 `plugin.list` / `model.list` / `mcp.list` / `appearance.state`。

模型的默认选择有两处可能：**主源**是 profile 自己的 `cordis.patch.yml` 里 `agent-default-model`
条目的 `config.provider` / `config.model`（以及可选的 `config.reasoningEffort`），这是当前 DSH
实际写入的地方；**次源**是 `$DSH_HOME/settings.yaml`。后者已经**不再生效**——`dsh-settings`
启动时把它一次性导入各条目的 `config`，随后 `rename` 成 `settings.yaml.imported`，所以现在的
安装上它根本不存在。两处都没有时，`unknown` 的 `reason` 会把**两处都点名**，以免读者把
「我查的那一处是空的」误当成「这里没有配置」。

## 开发

```powershell
node --test plugins/vyra-dsh-console/test/core.test.mjs
node --test plugins/vyra-dsh-console/test/channel.test.mjs
node --test plugins/vyra-dsh-console/test/client.test.mjs
node --test plugins/vyra-dsh-console/test/host.test.mjs
node --test plugins/vyra-dsh-console/test/bridge.test.mjs
node --test plugins/vyra-dsh-console/test/cli.test.mjs
```

六个套件也可以一次跑完（`node --test <目录>` 在本机 Node 上不可用，所以显式列文件名）：

```powershell
node --test plugins/vyra-dsh-console/test/core.test.mjs plugins/vyra-dsh-console/test/channel.test.mjs plugins/vyra-dsh-console/test/client.test.mjs plugins/vyra-dsh-console/test/host.test.mjs plugins/vyra-dsh-console/test/bridge.test.mjs plugins/vyra-dsh-console/test/cli.test.mjs
```

改动 `icon.svg` 或新增插件后，重新生成市场清单里的内联图标：

```powershell
node scripts/sync-manifest-icons.mjs
node --test scripts/test/manifest-icons.test.mjs   # 校验生成器幂等且图标未被写坏
```

## 交流群

有问题、想提功能、或者想看看别人怎么用，欢迎加 QQ 群（群号 1121362543）。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/qq-group.png" />
  <img alt="QQ 交流群二维码，群号 1121362543" src="./assets/qq-group.png" width="220" />
</picture>
