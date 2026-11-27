# dsh-vyra-skill-mcp-manager · 技能与 MCP 管理

**技能和 MCP 的一体化管理界面**——浏览、搜索、安装，不必再手改 profile 的配置行。

```sh
dsh plugin --profile web add dsh-vyra-skill-mcp-manager
```


## 它解决什么问题

DSH 的技能和 MCP 服务器分别由不同插件管理，装一个技能要改 `cordis.yml`、装一个 MCP 要改另一个地方，还得自己找路径。这个插件把两件事收进一个界面：

- **技能**：列出已装的技能，看它的 `SKILL.md`，搜索磁盘上的其他技能目录
- **MCP**：列出已配置的服务器，看连接状态，新建/编辑配置
- **一体浏览**：一个列表里同时看两边的状态，缺什么一目了然

## 聚合市场

技能市场和 MCP 市场**不用再先选市场源**。一次搜索会并行查所有内置来源，结果按 `slug`
去重，卡片上标出来自哪几个源：

| 市场 | 内置来源 |
|---|---|
| 技能 | skills.sh、ClawHub、skillsmp、trusttools、browse.sh、SkillHub、ModelScope（SkillNet 可选，默认关闭） |
| MCP | MCP 官方注册表、Smithery、npm（`keywords:mcp-server`）、awesome-mcp-servers |

**每源每页只取 10 条**，各源并发查询；**单源超过 4 秒就记入「不可达」**，不再拖住整页。
实测同一台机器上：技能首屏 8.0s → 0.46s，翻页 13.8s → 2.3s，搜索 `pdf` 11.4s → 4.0s。
翻页时带上已渲染的 slug，跨页不会出现重复条目。

**删掉了两个永远没有数据的源。** LobeHub 无论作为技能源还是 MCP 源，每次都返回 0 条
（技能侧缺凭据、MCP 侧 CLI 直接失败），所以它从两处都移除了——留着只会让页头一直
显示「1 个源不可达」。

工具栏的来源 pill 现在只是**过滤**已经拿到的结果，不再决定去查哪个源。页头给出
「命中 N 条 · M 个来源」；某个源挂了会显示「N 个源不可达」并列出具体错误——
以前这种情况看起来和「没有找到」一模一样。

**SkillNet 默认关闭。** 它的公开接口在实测中约有一半请求返回 504，让它参与首屏搜索
会把市场拖慢或拖垮。在设置里（`settings.json` 的 `skillnet: true`）可以打开。

## 分类

「我的技能」「我的 MCP」和两个市场页都有分类侧栏，用的是 **SkillNet 的十个分类**，
中文名与上游原值一一对应：

| 中文名 | SkillNet 原值 |
|---|---|
| 软件开发 | Development |
| 测试质量 | Testing |
| AI 与生成 | AIGC |
| 效率办公 | Productivity |
| 商业运营 | Business |
| 学术研究 | Research |
| 科学计算 | Science |
| 安全合规 | Security |
| 生活娱乐 | Lifestyle |
| 其他 | Other |

判定顺序是**领域词优先于工具词**：先看用途（文档、研究、医疗、营销……），再看实现
（python、git、docker……），都没命中落「其他」。这样 `pdf` 归效率办公，而不会被描述里
的 `python` 拖进软件开发。`SKILL.md` frontmatter 里声明了 `category` 的技能以声明为准。

两条已知的粒度限制，写在这里免得当成 bug：

- **上游本来就粗。** `pdf / docx / pptx / excel` 都在效率办公，`git / shell / sql /
  docker` 都在软件开发。筛选到这一级为止。
- **已装技能没有分类字段。** 分类是关键词推断出来的，偶尔会偏。

关键词按词边界匹配——`@latest` 里的 `test` 不算测试词，否则一个生图服务器会被分到
「测试质量」。

## Agent 可用：`vyra-skill` CLI

包里附带 `cli.mjs`，安装后作为 `vyra-skill` 命令可用。**默认只读**，写操作要 `--apply`：

```sh
vyra-skill search "pdf" --json
vyra-skill search "视频" --category="AI 与生成" --json
vyra-skill info <slug> --json
vyra-skill list --json
vyra-skill categories --json
vyra-skill open-dir <slug>
vyra-skill install <slug|url> --json        # 出计划，不写盘
vyra-skill install <slug|url> --apply
vyra-skill uninstall <slug> --apply
vyra-skill enable|disable <slug> --apply
vyra-skill mcp search|list|install|uninstall|enable|disable|open-dir …
```

配套技能在 `skills/vyra-skill-market/SKILL.md`，说明 Agent 的推荐流程：优先用宿主的
`skill_market_*` / `mcp_market_*` 工具，跨源搜索和分类筛选用 CLI，先搜后装、说清来源。

**没有升级命令。** 技能和 MCP 都只有安装与卸载；用户要「升级」时，Agent 应当说明
这需要卸载后重装，而不是假装有原地升级。

## 用法

设置里打开「技能与 MCP」面板。面板直接读写 profile 下的技能目录和 MCP 配置，改完不需要重启。

## 面板位置

**主界面侧栏 → 技能与 MCP**

## 隐私与边界

- **完全本地**：只读写本机技能目录与 profile 配置
- 搜索技能时扫描的是你配置的技能目录，不联网
- 安装 MCP 服务器会执行你确认过的命令——**它会改你的 profile 配置**，改动前列出具体内容

## 安装

在客户端「设置 → 插件 → 索引源」加入：

```
https://lanxiake.github.io/dsh-vyra-plugins/index.json
```

然后搜索「技能与 MCP」安装。

## 已知限制

- 面板展示的是**配置状态**，不替代对技能本身内容的编写
- MCP 服务器的实际连接由 DSH 的 MCP 插件负责，这里只管理配置

## 数据从哪来

安装一个插件就够——**数据层已内联在本包里**（`vendor/dsh-skill-mcp-market`），不需要另外装
`dsh-skill-mcp-market`。

内联的是 [dsh-skill-mcp-market](https://github.com/kuailexiaozixin/dsh-skill-mcp-market) 的宿主端
（MIT，`vendor/dsh-skill-mcp-market/LICENSE`）。它负责：

| 组件 | 作用 |
|---|---|
| 技能提供者 | 挂载 `skills` provider，让已装技能真正出现在模型面前 |
| `/api/dsh-market/rpc` | 面板读列表、搜索、安装的数据接口（含聚合通道 `skills.aggregate`） |
| 10 个 `skill_market_*` / `mcp_market_*` 工具 | 让模型自己也能搜和装 |

本包自己的 `index.js` 提供面板其余 9 个路由（预览、导入 zip、用量统计、工具开关等），
`lib/` 提供面板与 CLI 共用的分类与聚合逻辑（`classify.mjs`、`aggregate.mjs`、
`skillnet.mjs`），`cli.mjs` 是 Agent 用的 `vyra-skill`。

## 变更

### 1.4.1

**分页提速 + MCP 换成 4 个能用的源。**

- 每源每页 10 条、并发查询，单源 4 秒预算，超时的源记入「不可达」而不拖住整页。
  翻页带上已渲染 slug，跨页不重复。技能首屏 8.0s → 0.46s。
- MCP 源换成 MCP 官方注册表、Smithery、npm、awesome-mcp-servers，均已实测可用，
  每源每页 10 条，合计 40 条/页。
- 移除 LobeHub（技能侧与 MCP 侧都返回 0 条）。

### 1.4.0

**市场改成聚合并加上分类。**

- 技能市场与 MCP 市场默认走聚合通道，用户不再需要先点一个来源。来源 pill 改为过滤
  已拿到的结果，页头显示命中数、来源数与不可达来源的明细。
- 新增 SkillNet 作为可选第九个技能源，默认关闭。
- 「我的技能」「我的 MCP」和两个市场页都有 SkillNet 十类的中文分类侧栏；卡片显示
  分类标签，多来源显示 `+N`。
- 技能卡片上的「打开目录」改为「目录」。
- 新增 `vyra-skill` CLI 与配套技能 `skills/vyra-skill-market`，覆盖搜索、安装、卸载、
  启停、打开目录；不提供升级。

顺带修掉一个分类误判：关键词原先用裸子串匹配，`comfyui-mcp@latest` 因为
`latest` 里含 `test` 被分到「测试质量」。ASCII 关键词现在按词边界匹配。

### 1.2.0

**改成自包含。** 1.1.0 及更早的版本只是一个界面外壳，数据全靠外部的 `dsh-skill-mcp-market`
提供。少了那个插件，面板就是空的、市场请求全 404——而且**报错信息看不出缺了什么**。数据层
现已内联。

**同时修掉一个会打死 host 的缺陷。** 上游的 `await mcp.init()` 没有保护：

```js
await mcp.init();     // 任何一个 MCP 配置有问题就抛
```

它为每个已装的 MCP 服务器挂一个 `dsh-mcp-client` 实例，所以单个服务器解析不到客户端就抛错；
而这个 Promise 无人接管，异常逃出 `apply` 成为**进程级未捕获异常**，DSH 会判为致命：

```
dsh: fatal uncaught exception
```

后果是技能提供者、12 个工具、`/api/dsh-market/rpc` 全部没注册——面板空、市场 404。
现在失败降级为警告，面板照常可用，出错的服务器只是暂时不在列表里。

### 1.1.0

**修掉一个会让整个 DSH 起不来的缺陷。** 恢复工具开关时读了 `ctx.agents`：

```js
const direct = ctx.agents && typeof ctx.agents.list === 'function' ? ctx.agents : null
```

在 cordis 里，读一个没写进 `inject` 的服务名，抛错发生在**求值操作数**的时候
（`vendor/cordis/src/reflect.ts`），所以 `typeof` 守卫根本来不及生效。这段代码又是从
顶层 Promise 和 `agent/created` 监听器里调用的，抛错绕过了文件里所有 try/catch，
直接把 host 拉崩：

```
dsh: fatal load failure: Error: cannot get property "agents" without inject
```

改成只走 `ctx.get('agents')`（该方法在 Context 类上，属性读取不会触发反射守卫）。

## 开发

`index.js` 是面板那一半（9 个路由 + 工具开关）；`vendor/dsh-skill-mcp-market/` 是数据那一半
（技能提供者 + RPC + 12 个工具），**按上游原样保留**，只在 `market-host.js` 里改了 `mcp.init()`
的错误处理，改动处有 `VENDORED PATCH (vyra)` 注释标明。

## 交流群

有问题、想提功能、或者想看看别人怎么用，欢迎加 QQ 群（群号 1121362543）。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/qq-group.png" />
  <img alt="QQ 交流群二维码，群号 1121362543" src="./assets/qq-group.png" width="220" />
</picture>
