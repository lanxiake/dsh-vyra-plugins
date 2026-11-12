# vyra-tool-usage-stats

按工具统计调用次数、失败次数与最后使用时间，数据来自 Session 日志本身。Host 侧持久化，Web 端有设置页面板。

## 装它做什么

回答三个用别的方式答不了的问题：

- **哪些工具从没用过** —— 可以清理的东西
- **哪些工具还在用** —— 和上一个问题**不是同一个问题**。只看累计总数会把"三个月前用过 181 次"读成"当前在用"，据此删掉正在使用的工具
- **哪些工具老失败** —— 工具本身有问题，或者模型不会用

## 数据从哪来

监听 `session/event`，折叠持久化的 `tool/call` 与 `tool/result` 记录。**没有独立的采集通道**，所以统计不可能和实际发生过的事不一致。

配对靠 `callId`，但注意两个事件的字段位置不同：

| 事件 | 工具名 | 配对 id | 结果状态 |
|---|---|---|---|
| `tool/call` | `data.name` | `data.callId` | — |
| `tool/result` | — | `data.message.toolCallId` | `data.message.isError` |

`tool/result` 的 id 在 **message 里**，不在事件顶层——这个差异如果搞错，统计会静默地永远是 0。

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

## 两个视图

| 视图 | 位置 | 范围 |
|---|---|---|
| 全局 | 设置 → 工具用量 | 整台机器，跨所有会话 |
| 会话 | HTTP 端点 `sessions` 字段 | 当前 dsh 进程观察到的会话 |

全局数持久化到 `$DSH_HOME/storages/`；会话数不持久化——会话自己的日志已经是权威记录。

## 配置

```yaml
- id: vyra-tool-usage-stats
  name: 'vyra-tool-usage-stats'
  config:
    retainDays: 90                    # 每个工具保留多少天的日桶，默认 90
    endpoint: '/api/vyra/tool-usage'  # 客户端读取端点
```

超过 `retainDays` 的日桶会被丢弃。**累计次数永不裁剪**——"这个工具到底用过没有"是历史事实，裁掉等于改写历史。

`endpoint` **必须**在 `/api` 前缀下：路由注册表拒绝任何它无法表达为共享 API 通道端点的路径，而那个拒绝发生在延迟 fiber 里，抛错不会显示在控制台。

## 设计约束

**统计永不影响工具调用。** 每条计数都包在 try/catch 里，失败只记日志。一个坏掉的计数器应该让报表降级，而不是让 agent 卡住。

**未知调用跳过而不是归到占位名。** 恢复的会话里，早期的 `tool/result` 可能没有配对的 `tool/call`（那些调用发生在本进程启动之前）。这时计数被跳过——归到一个叫 `(unknown)` 的工具上会**凭空造出一个不存在的工具**。

**持久化写入不在工具调用路径上。** 每次调用都落盘会让一个会话写上千次；改为 15 秒定时刷，崩溃最多丢 15 秒。

**没有 storageDomain 时降级为纯内存。** 计数照记，重启清零。存储失败不阻止插件加载。

## 客户端

浏览器端注册到 `settings.section` 槽位，是**整机报表**——数字跨所有会话，放在单会话标签页里位置不对。表格四列可点排序（工具 / 调用数 / 失败率 / 最后使用），5 秒轮询刷新。

React 由页面 bundle 提供，客户端入口是 CJS，`react` 保持 external——打进 bundle 会得到第二份 React，而宿主自己渲染的组件会因此 hook 报错。

## 用法

```sh
node scripts/build.mjs        # 产出 lib/index.js (ESM) 和 lib/client.js (CJS)
node tests/check.ts           # 全部检查
```

`tests/check.ts` 先跑单元测试，再到 `dsh-Veyra` checkout 里跑三个 harness 检查（集成 / 存储 / 生产事件形状）。checkout 不在默认位置时设 `DSH_SOURCE`。

单独跑：

```sh
node --test tests/counters.test.ts        # 11 个单元测试，零框架
npx tsx <本目录>/tests/integration.ts     # 需在 dsh-Veyra 里跑
npx tsx <本目录>/tests/storage.ts
npx tsx <本目录>/tests/session-e2e.ts
```

## 已知限制

- **只统计本进程观察到的会话。** 一个 Session 如果在本插件挂载前就结束了，它的事件不会被回放
- **没有按会话筛选的 UI。** 端点返回 `sessions` 字段，但客户端目前只渲染全局视图
- **`daily` 桶在全局视图里不展示。** 数据已经采集，趋势图还没做
- **计数器不区分 agent。** 同一个工具被主 agent 和子 agent 调用，会合并到同一行
