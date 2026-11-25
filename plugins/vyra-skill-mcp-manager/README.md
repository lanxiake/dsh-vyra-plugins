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
| `/api/dsh-market/rpc` | 面板读列表、搜索、安装的数据接口 |
| 12 个 `skill_market_*` / `mcp_market_*` 工具 | 让模型自己也能搜和装 |

本包自己的 `index.js` 提供面板其余 9 个路由（预览、导入 zip、用量统计、工具开关等）。

## 变更

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
