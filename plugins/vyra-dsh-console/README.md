# DSH Console

让 Agent 操作 DeepSeek Harness 自身的控制台：查看与切换模型、读写设置、管理插件、调整主题与布局。

这个插件的重点不只是「能做什么」，更是「不能做什么」。Agent 可以改变 harness **长什么样、怎么配置**，但永远不能改变自己**握有多大的权限**——沙箱模式、权限预设、审批应答、凭据写入这四类动作在 `core.js` 的 `FORBIDDEN` 表里被永久拒绝，并附带给用户的操作替代方案。所有动作经由同一张 `ACTIONS` 注册表分派，因此边界只有一处定义、两个调用方（Agent 工具与客户端面板）共用。

## 安装

在会话中让 Agent 安装，或在插件面板里安装本目录：

```
plugin_manager install_bundle plugins/vyra-dsh-console
```

安装后重载界面；Host 侧改动需要重启 DSH。

## 结构

```
vyra-dsh-console/
├── package.json       # Bundle manifest
├── cordis.patch.yml   # Host 插件行
├── index.js           # Host 入口
├── core.js            # 动作注册表、权限边界与分派器
├── channel.js         # Host ↔ Client 请求/响应通道
├── client.js          # Client 半：主题、布局、语言
├── cli.mjs            # 只读 CLI：vyra-console
├── test/              # node --test：边界、通道、CLI 自检
└── assets/            # 交流群二维码
```

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
profile 目录解析与 `vyra-plugin-market` 一致：`$DSH_HOME`（默认 `~/.dsh`）下 `profiles/<name>`。

退出码：`0` 成功，`1` 真失败（profile 不存在、清单读不了），`2` 用法错误。
`--json` 只往 stdout 写一份合法 JSON（诊断信息走 stderr），字段每次相同，因此可以直接管道给 `jq`。

### 这里**没有** `--apply`，而且不会加上

变更一律走 `dsh_console` 工具，因为只有它用与 Web UI 相同的 profile 锁、激活与回滚路径。
CLI 直接改 `package.json` 或 `cordis.patch.yml` 会绕过这三样：与运行中的进程抢写、无法激活、
半截写入没有回滚。所以这个 CLI **只读是构造出来的**，不是约定：

- 它只 `import` `node:` 内建模块，`node:fs` 里只取 `existsSync` / `readFileSync` / `readdirSync` /
  `statSync`，连 `node:child_process` 都没有——没有写入函数可调，也无法转手让别的进程去写；
- 打一个**变更类动作名**当命令（如 `vyra-console plugin.remove`）会被拒绝，并打印该用的那一次
  `dsh_console` 调用。拒绝表由 `core.js` 的 `ACTIONS` 推导，新增变更动作会自动被拒。

`test/cli.test.mjs` 对临时 fixture profile 跑全部命令与全部输出模式，前后对整个目录树取哈希并断言
逐字节相同。

### doctor 的诚实边界

`doctor` 只读**真实文件**，并且对每个结论都注明出处。进程内才有的东西——Loader 的插件树、
正在生效的模型路由、MCP 连接状态——它看不到，于是显式打印 `unknown` 加原因，而不是省略或猜。
一个自信而错误的 `doctor` 比一个不完整的更糟：Agent 会照着它行动。运行状态请用 `dsh_console`
的 `plugin.list` / `model.list` / `mcp.list` / `appearance.state`。

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

## 交流群

有问题、想提功能、或者想看看别人怎么用，欢迎加 QQ 群（群号 1121362543）。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/qq-group.png" />
  <img alt="QQ 交流群二维码，群号 1121362543" src="./assets/qq-group.png" width="220" />
</picture>
