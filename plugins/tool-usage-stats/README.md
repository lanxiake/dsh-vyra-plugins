# vyra-tool-usage-stats

按工具统计调用次数、失败次数与最后使用时间，数据来自 Session 日志本身。

## 装它做什么

回答三个用别的方式答不了的问题：

- **哪些工具从没用过** —— 可以清理的东西
- **哪些工具还在用** —— 和上一个问题**不是同一个问题**。只看累计总数会把"三个月前用过 181 次"读成"当前在用"，据此删掉正在使用的工具
- **哪些工具老失败** —— 工具本身有问题，或者模型不会用

## 数据从哪来

监听 `session/event`，折叠持久化的 `tool/call` 与 `tool/result` 记录。**没有独立的采集通道**，所以统计不可能和实际发生过的事不一致。

`tool/call` 带工具名，`tool/result` 带结果（含 `message.isError`），两者靠 `callId` 配对。

## 记什么

每个工具一条：

| 字段 | 含义 |
|---|---|
| `count` | 累计调用次数（含失败） |
| `errorCount` | 其中失败次数 |
| `lastUsedAt` | 最后一次调用的时间戳 |
| `lastUsedDay` | 最后一次调用的日期 |
| `daily` | 按天的调用次数，`YYYY-MM-DD` 为键 |

**累计数和按天两张表都要**——`count` 答"一共用过几次"，`daily` 答"最近还在用吗"。

## 配置

```yaml
- id: vyra-tool-usage-stats
  name: 'vyra-tool-usage-stats'
  config:
    retainDays: 90   # 每个工具保留多少天的日桶，默认 90
```

超过 `retainDays` 的日桶会被丢弃。**累计次数永不裁剪**——"这个工具到底用过没有"是历史事实，裁掉等于改写历史。

## 设计约束

**统计永不影响工具调用。** 每条计数都包在 try/catch 里，失败只记日志。一个坏掉的计数器应该让报表降级，而不是让 agent 卡住。

**未知调用跳过而不是归到占位名。** 恢复的会话里，早期的 `tool/result` 可能没有配对的 `tool/call`（那些调用发生在本进程启动之前）。这时计数被跳过——归到一个叫 `(unknown)` 的工具上会**凭空造出一个不存在的工具**。

## 用法

```sh
node scripts/build.mjs          # 产出 lib/index.js
node --test tests/counters.test.ts   # 单元测试
```

集成测试要在 `dsh-Veyra` checkout 里跑（那里能解析 `@deepseek-ai/cordis`）：

```sh
npx tsx <本目录>/tests/integration.ts
```

## 已知限制

- **计数只在内存里，重启即清零。** 持久化需要 `ctx.storageDomain`，见下节
- **只统计本进程观察到的会话。** 一个 Session 如果在本插件挂载前就结束了，它的事件不会被回放
- **没有 UI。** 数据在内存里，目前只能由同进程的插件通过 `ToolUsageStats` 读取；Web 端展示需要单独的客户端插件

## 后续

持久化走 `ctx.storageDomain`（`defineDomain` + `open`），后端路由由 `storage-domain` 行的 `backend` / `routes` 配置决定，插件自己不选后端。
