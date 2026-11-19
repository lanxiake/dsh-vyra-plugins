# 闲鱼自动客服 DSH 插件 — 设计文档

> 状态：设计稿 · 2026-11-19
> 调研来源：`zhinianboke/xianyu-auto-reply`（发货链路逐行核对）、`fancyboi999/goofish-cli`（传输层）、`11273/goofish-client`（TS 备选）
> 本文所有接口、参数、签名、字段路径均标注了来源；标 **【需实测】** 的部分尚未在本机账号上验证。

---

## 1. 目标与约束

### 1.1 目标

在 DSH 里装一个插件，卖家把闲鱼账号接进来后：

1. 买家拍下虚拟商品 → 自动确认发货并发出卡密 / 网盘链接 / 提取码
2. 多数量订单按件数发对应数量的卡密
3. 断线重连、进程重启后不重复发货
4. 每一步都有可追溯的发货记录，失败可人工补发

**免挂机**：不依赖手机、模拟器、浏览器常驻，纯服务器进程。

### 1.2 硬约束

| 约束 | 说明 |
|---|---|
| 无官方 API | 闲鱼没有开放平台，全部走非官方 mtop 接口 |
| 协议会变 | 签名算法和接口名随时可能调整，传输层必须可替换 |
| 违反平台条款 | 自动化操作有封号风险，产品必须显式告知 |
| 网盘/虚拟商品是重点治理对象 | 外链、卡密、自动发货叠加，风控命中率最高 |

---

## 2. 选型结论

| 方案 | 结论 | 理由 |
|---|---|---|
| **goofish-cli**（Python / Apache-2.0） | **采用** | 登录态、WS 长连、发消息、限流熔断都现成；许可宽松 |
| goofish-client（TS / GPL-3.0） | 备选 | 纯 Node 直嵌，但 GPL 会传染整个插件 |
| 自研协议层 | 不采用 | 签名逆向是别人唯一的护城河，自研等于接手全部维护成本 |

**接入方式：插件 spawn `uvx goofish-cli` 子命令，不走 MCP 做后台发货。**

原因：MCP 是请求-响应，适合 Agent 主动调用；自动发货需要常驻监听事件，必须用 `message watch` 的 JSONL 输出。

---

## 3. 总体架构

```
┌──────────────── DSH 客户端 ────────────────┐
│  vyra-xianyu-delivery (cordis 插件, Node)   │
│                                             │
│  ┌──────────┐   ┌──────────┐   ┌─────────┐ │
│  │ Watcher  │──▶│ Dispatch │──▶│ Sender  │ │
│  │ (子进程) │   │  引擎    │   │         │ │
│  └────┬─────┘   └────┬─────┘   └────┬────┘ │
│       │              │              │      │
│       │ JSONL        │ 卡密/模板     │ IM   │
│       ▼              ▼              ▼      │
│  ┌──────────────────────────────────────┐  │
│  │  SQLite: orders / cards / deliveries │  │
│  └──────────────────────────────────────┘  │
└───────────────┬─────────────────────────────┘
                │ spawn / HTTP
      ┌─────────▼─────────┐      ┌──────────────────┐
      │  uvx goofish-cli  │      │  mtop 发货接口    │
      │  watch / send     │      │  consign.dummy   │
      └─────────┬─────────┘      │  sold.get        │
                │                │  order.detail    │
                ▼                └────────▲─────────┘
       闲鱼 WS (Goofish)                │
                                          │ 共用同一份 cookie
```

职责边界：

- **goofish-cli**：登录态、WS 收发、消息解码、限流、熔断
- **插件**：触发判定、订单号提取、卡密池、模板渲染、确认发货、幂等、审计
- **不放进插件**：签名算法、WS 协议细节（这些由传输层封装）

---

## 4. 传输层

### 4.1 登录态

`goofish-cli` 把登录态存在 `~/.goofish-cli/cookies.json`（加密），关键 cookie：

| Cookie | 用途 |
|---|---|
| `unb` | 用户 ID，缺失直接报 `AuthRequiredError` |
| `_m_h5_tk` | mtop 签名 token，取 `_` 前第一段 |
| `cookie2` | 会话凭证 |

插件不读这个文件（加密格式 + 跨进程成本）。插件的发货 HTTP 调用需要 cookie，两条路：

- **A（推荐）**：给 goofish-cli 提 PR / fork，加两个命令 `order sold-list` 和 `order confirm`，插件只 spawn。这些命令内部已有 `Session.load()` 和 `h5_token`，无需暴露 cookie。
- **B**：插件自己调 mtop，需要从 goofish-cli 拿 cookie —— 得复刻解密逻辑，不划算。

### 4.2 消息监听

```bash
uvx goofish-cli message watch
```

stdout 每行一个 JSON：

```json
{"event":"message","cid":"<会话ID>","content_type":1,
 "send_user_id":"<买家ID>","send_user_name":"<昵称>","send_message":"<文本>"}
```

注意：

- `cid` + `send_user_id` 正好是 `message send` 需要的 `cid` + `toid`
- **没有 `item_id`**——商品归属要靠订单号反查
- `/s/para`（对方正在输入）已被 CLI 内部过滤
- 元事件（`read` / `new_msg`）会以 `event` 字段单独输出

### 4.3 必须补的两个接口

`goofish-cli` 当前只有 `publish / item / search / message / auth / media / category / location`，**没有订单**。v0.4 才计划 `goofish order`。

必须补：

1. `order sold-list` → `mtop.taobao.idle.trade.merchant.sold.get`
2. `order confirm` → `mtop.taobao.idle.logistic.consign.dummy`

可选补：

3. `order detail` → `mtop.idle.web.trade.order.detail`
4. `order close` → `mtop.taobao.idle.trade.merchant.close.by.seller`

---

## 5. 接口规格

> 以下全部来自 `xianyu-auto-reply` 源码核对。

### 5.1 mtop 通用签名

```ts
import { createHash } from 'node:crypto'

function generateSign(token: string, t: string, dataVal: string, appKey = '34839810') {
  // md5(token & t & appKey & data)
  return createHash('md5')
    .update(`${token}&${t}&${appKey}&${dataVal}`)
    .digest('hex')
}
```

- `token` = cookie `_m_h5_tk` 按 `_` 切第一段
- `t` = 毫秒时间戳字符串
- `dataVal` = **将要放进请求体的原始 JSON 字符串**，签名和请求体必须字节级一致（这是最常见的失败原因）

通用 query 参数：

```
jsv=2.7.2
appKey=34839810
t=<毫秒时间戳>
sign=<签名>
v=1.0
type=originaljson          ← 关键，用 json 会 PERMISSION_EXCEPTION
accountSite=xianyu
dataType=json
timeout=20000
api=<接口名>
sessionOption=AutoLoginOnly
```

请求体：

```
data=<urlencode(dataVal)>
```

Content-Type: `application/x-www-form-urlencoded`

---

### 5.2 确认发货（虚拟商品）

**接口**：`mtop.taobao.idle.logistic.consign.dummy`

**URL**：`https://h5api.m.goofish.com/h5/mtop.taobao.idle.logistic.consign.dummy/1.0/`

**请求数据**：

```json
{"orderId":"<订单号>","tradeText":"<可选：无需邮寄凭证文本>","picList":[],"newUnconsign":true}
```

- `tradeText` 可以是卡密正文（"无需邮寄表单"模式）
- 普通模式传空串

**请求头**：

```
Cookie: <cookie 串>
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...
Content-Type: application/x-www-form-urlencoded
Referer: https://www.goofish.com/
```

**返回判定**：

```json
{"ret":["SUCCESS::调用成功"]}
```

- `SUCCESS::调用成功` → 成功
- 含 `ORDER_ALREADY_DELIVERY` 或 `已发货成功` → 视为成功（幂等）
- 其它 → 失败，最多重试 4 次

**重试策略**：4 次，指数退避；令牌过期（`TOKEN_EMPTY` / `PERMISSION_EXCEPTION`）时刷新 cookie 后重试一次。

---

### 5.3 卖家已售订单列表

**接口**：`mtop.taobao.idle.trade.merchant.sold.get`

**URL**：`https://h5api.m.goofish.com/h5/mtop.taobao.idle.trade.merchant.sold.get/1.0/`

**请求数据**：

```json
{"pageNumber":1,"orderIds":"","queryCode":"<状态码>","orderSearchParam":"{}"}
```

**请求头（与 5.2 不同，必须带卖家来源）**：

```
Cookie: <cookie 串>
origin: https://seller.goofish.com
referer: https://seller.goofish.com/
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0.0.0 Safari/537.36
Content-Type: application/x-www-form-urlencoded
```

> 缺 `Origin` 会被误报成 Session 过期 / 无权限。

**额外参数**：`valueType=string`、`spm_cnt=a21107h.42826273.0.0`

**用途**：兜底轮询。WS 消息丢失时，按待发货状态拉列表补发。

---

### 5.4 订单详情

**接口**：`mtop.idle.web.trade.order.detail`

**URL**：`https://h5api.m.goofish.com/h5/mtop.idle.web.trade.order.detail/1.0/`

**请求数据**：

```json
{"tid":"<订单号>"}
```

**请求头**：

```
origin: https://www.goofish.com
referer: https://www.goofish.com/
```

**用途**：

- 拿 `spec_name` / `spec_value` 匹配多规格卡券
- 拿 `quantity` 判断发几张卡密
- 确认订单金额（0 元订单可配置为不发货）

---

### 5.5 关闭订单 / 退款列表

| 接口 | 数据 |
|---|---|
| `mtop.taobao.idle.trade.merchant.close.by.seller` | 关闭订单（禁止发货前的兜底） |
| `mtop.taobao.idle.merchant.refund.list` | 退款中订单，发货前排除 |
| `mtop.taobao.idle.rate.create` | 自动评价 |
| `mtop.taobao.idlemessage.red.flower` | 求小红花 |

第一版可只做「退款中订单不发货」，不做自动关闭。

---

### 5.6 发送消息

用 `goofish-cli`：

```bash
uvx goofish-cli message send --cid <cid> --toid <buyer_id> --text "<content>"
```

CLI 的 `ok` 只代表**服务端已接受请求**（发送 ack `code=200`），不代表对方已收到。要确认落库得用 `message history` 回读。

多条内容用 `######` 分隔，插件负责拆成多条发送、每条间隔 0.5s（来自参考实现的实测值）。

---

## 6. 数据模型

SQLite（`<DSH data dir>/xianyu-delivery.sqlite`）。

### 6.1 cards

```sql
CREATE TABLE cards (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id    TEXT NOT NULL,          -- 哪个闲鱼账号
  item_id       TEXT,                   -- 关联商品；NULL = 账号级默认
  spec_name     TEXT,                   -- 多规格
  spec_value    TEXT,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL,          -- data | text | image | api
  content       TEXT,                   -- text: 模板；data: 多行卡密
  image_url     TEXT,
  api_config    TEXT,                   -- type=api 时的 JSON
  delay_seconds INTEGER DEFAULT 0,
  enabled       INTEGER DEFAULT 1,
  created_at    TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX ux_cards_item ON cards(account_id, item_id, spec_name, spec_value) WHERE enabled=1;
```

### 6.2 orders（幂等表，核心）

```sql
CREATE TABLE orders (
  order_no      TEXT PRIMARY KEY,       -- 幂等键
  account_id    TEXT NOT NULL,
  item_id       TEXT,
  buyer_id      TEXT,
  chat_id       TEXT,
  quantity      INTEGER DEFAULT 1,
  amount        INTEGER,                -- 分
  spec_name     TEXT,
  spec_value    TEXT,
  state         TEXT NOT NULL,          -- 见第 8 节状态机
  card_id       INTEGER,
  confirm_state TEXT,                   -- none | ok | already | failed
  confirm_retry INTEGER DEFAULT 0,
  fail_reason   TEXT,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);
CREATE INDEX ix_orders_state ON orders(account_id, state);
```

### 6.3 deliveries（发货流水）

```sql
CREATE TABLE deliveries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no    TEXT NOT NULL,
  card_id     INTEGER,
  seq         INTEGER,                  -- 第几张（多数量）
  content     TEXT NOT NULL,            -- 实际发出的内容（脱敏后落库）
  send_state  TEXT NOT NULL,            -- success | failed | unknown
  error       TEXT,
  raw_event   TEXT,                     -- 触发此单的原始消息 JSON
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX ix_deliveries_order ON deliveries(order_no, id);
```

> `content` 落库用于补发和审计。若担心卡密二次泄露，落库存**哈希 + 末四位**，明文只在发送瞬间存在。

---

## 7. 核心流程

### 7.1 触发条件

**只有非纯文本消息触发自动发货。**

参考实现的判定（`_handle_auto_delivery_from_message`）：

```python
if parsed_message.get("is_plain_text", False):
    return  # 普通文本不触发
```

即：卡片消息、系统通知卡片才触发。买家打字说"我拍了"不会触发（那是给客服回复用的）。

触发卡片里提取订单号优先走：

```
content.dxCard.item.main.exContent.button.targetUrl  →  orderId=(\d+)
content.dxCard.item.main.targetUrl                   →  order_detail?id=(\d+)
```

**正则兜底**（对整条原始消息字符串）：

```
orderId[=:](\d{10,})
order_detail\?id=(\d{10,})
bizOrderId[=:](\d{10,})
```

> 这些路径来自源码，但具体业务卡片的形态会随版本变化，**【需实测】**：抓真实付款通知，把 JSON 存下来再确认。

### 7.2 发货主流程

```
1. 收到非纯文本消息
2. 提取 order_no；没有 → 结束
3. 查 orders：已 success → 结束（幂等）
4. 取本地订单锁（内存）+ SQLite 写 state=processing
5. 拉订单详情：quantity / specs / amount / 买家
   - amount == 0 且配置禁止 → 结束
   - 退款中 → 结束
6. 匹配卡券：account+item+spec，必须唯一命中；多条 → 报错不发货
7. 渲染内容（变量替换）
8. 按 quantity 循环取卡：
   for i in 1..quantity:
     content = consumeCard(cardId)   // CAS 原子消费
     发送 content
     写 deliveries
9. 确认发货（consign.dummy）
   - 成功 / already → confirm_state
   - 失败 → 保留卡密已发但确认失败，进入重试队列
10. orders.state = success
11. 释放锁
```

**顺序策略可配置**：

| 模式 | 行为 | 适用 |
|---|---|---|
| `confirm_then_send`（默认） | 先确认发货，再发卡密 | 平台发货状态为准 |
| `send_then_confirm` | 卡密发送成功后再确认 | 卡密发送失败时不占用平台发货 |
| `send_only` | 只发卡密，不调确认接口 | 平台状态自己维护，风险高 |

### 7.3 卡密消费（并发安全）

参考实现用 **CAS 乐观锁**：先读当前 `data_content`，用 `UPDATE ... WHERE data_content = <旧值>` 原子替换，`rowcount=1` 才算成功，否则重读重试（最多 50 次）。

**与参考实现的差异**：参考实现按**行**拆分条目，网盘场景（链接 + 提取码 + 说明）会被切碎——实测确认，只发出了第一行。插件改为按**单独一行 `---`** 分隔条目，条目内部可多行：

```text
链接：https://pan.quark.cn/s/xxxxxxxx?pwd=abcd
提取码：abcd
有效期 7 天，过期联系我补。
---
链接：https://pan.quark.cn/s/yyyyyyyy?pwd=efgh
...
```

SQLite 版本用事务 + 条件更新：

```ts
db.transaction(() => {
  const row = db.prepare('SELECT content FROM cards WHERE id=?').get(cardId)
  const lines = row.content.split('\n').map(s => s.trim()).filter(Boolean)
  if (!lines.length) throw new Error('卡密已用完')
  const [first, ...rest] = lines
  const info = db.prepare(
    'UPDATE cards SET content=? WHERE id=? AND content=?'
  ).run(rest.join('\n'), cardId, row.content)
  if (info.changes !== 1) throw new RetryConflict()
  return first
})()
```

关键点：**不能用「读一行 → 删一行」两步**，并发下会重复派发。

### 7.4 多数量发货

- 订单详情 `quantity > 1` → 循环取 N 张
- 每次取卡后立即落 `deliveries(seq)`
- 中途失败不整单回滚，记录已发数量，人工补发剩余

> 参考实现有坑：`text` / `image` 类型卡券循环 N 次只是重复发同一段话，只有 `data` / `api` 类型支持多数量。插件应在卡券配置里直接禁止非 data/api 类型开启多数量。

### 7.5 发货模板

```text
{order_no} {item_title} {buyer_nick} {spec_value} {quantity}

{cards}
```

`{cards}` 是本次消费的卡密拼成的块（多张换行）。网盘场景示例：

```text
网盘链接：https://pan.xxx/s/abc123
提取码：{card}
有效期 7 天，过期联系我补。
```

**网盘专用约束**：

- 链接与外链词是风控重点，默认把长链接拆成独立一条消息发送
- 不在图片里放二维码
- 敏感词表（来自参考实现）：`微信|微信号|加微信|插件|外挂|破解|永久|100%|零风险|群发|加粉|获客|引流|监控|二维码`
- 命中敏感词直接拒绝发送并记录 `fail_reason`，不改写

---

## 8. 状态机

```
                 ┌──────────┐
  收到卡片消息 ──▶│ received │
                 └────┬─────┘
                      │ 提取 order_no + 加锁
                 ┌────▼──────┐
                 │ processing│
                 └────┬──────┘
          ┌───────────┼──────────────┐
          ▼           ▼              ▼
    ┌──────────┐ ┌─────────┐  ┌─────────────┐
    │ delivered│ │ blocked │  │ confirm_failed│
    │(卡密已发)│ │(风控/   │  │(卡密已发，   │
    └────┬─────┘ │ 无卡券) │  │ 确认接口失败) │
         │       └─────────┘  └──────┬───────┘
         ▼                            │ 定时重试
    ┌──────────┐                      │
    │ completed│◀─────────────────────┘
    │(已确认)  │
    └──────────┘
```

- `received` / `processing` 是进程内态，重启后扫描 `state=processing` 且超时的记录转 `unknown`
- `unknown` 人工确认：查平台订单状态，已发货则补 state，否则重发

**幂等键**：`orders.order_no` 主键。任何入口（WS 触发、轮询兜底、人工补发）都先读这张表。

---

## 9. 幂等与并发

参考实现用了四层，插件保留三层就够：

| 层 | 参考实现 | 插件做法 |
|---|---|---|
| 订单级锁 | Redis 分布式锁 `order:<order_no>` | SQLite `BEGIN IMMEDIATE` + `state` 检查 |
| 时间冷却 | `last_delivery_time` 内存 | 不需要，主键幂等已覆盖 |
| 已确认集合 | `confirmed_orders` | `orders.confirm_state` |
| 卡密原子性 | CAS UPDATE | 同左 |

**重启安全**：进程启动时执行

```sql
UPDATE orders SET state='unknown'
WHERE state='processing' AND updated_at < datetime('now','-10 minutes');
```

`unknown` 不自动重发，等轮询兜底或人工处理。

---

## 10. 风控与合规

插件必须内置、不可关闭：

1. **发送限频**：同一账号每分钟最多 1 条经营类消息（参考 goofish-cli 的「经营 1 次/分钟、媒体 9 次/分钟」）
2. **熔断**：连续 3 次 `PERMISSION_EXCEPTION` / `RGV587` → 暂停该账号 30 分钟
3. **敏感词**：发送前扫描，命中直接拒绝
4. **金额校验**：0 元订单默认不发货
5. **退款排除**：退款中订单不发货
6. **审计**：每条发货写 `deliveries`，保留原始触发消息

**产品层面必须明示**（安装页 / README）：

> 本插件使用非官方接口，违反闲鱼用户协议，存在账号被限制或封禁的风险。建议使用小号，并自行评估平台规则变化。

不做的事（明确写进文档，避免后续被要求加）：

- 不破解滑块验证
- 不伪造设备指纹
- 不做账号矩阵 / 批量养号

---

## 11. DSH 插件形态

```
plugins/vyra-xianyu-delivery/
├── package.json
├── cordis.patch.yml        # insert 一个插件实例
├── index.js                # host: 注册 RPC / 调度
├── client.js               # 市场页：账号、卡券、订单、日志
├── lib/
│   ├── watcher.js          # spawn message watch，解析 JSONL
│   ├── order.js            # sold-list / confirm / detail 的 CLI 封装
│   ├── dispatch.js         # 触发→匹配→发卡→确认
│   ├── cards.js            # 卡密 CAS 消费
│   ├── db.js               # SQLite schema + migrations
│   └── guard.js            # 限频、熔断、敏感词
├── locale/zh.json, en.json
└── assets/icon.svg
```

`cordis.patch.yml`：

```yaml
- insert:
    - id: xianyu-delivery
      name: 'vyra-xianyu-delivery'
      config:
        accounts: []          # 由 UI 写入
        pollFallbackSeconds: 300
        sendRatePerMinute: 1
```

依赖：`better-sqlite3`（同步事务，适合这个量级）、`nanoid`（消息 UUID 可选）。不要引入 ORM。

### 11.1 账号接入流程

1. 用户在插件页点「添加账号」→ 插件执行 `uvx goofish-cli auth login --qr`（或让用户导入 cookies.json）
2. `uvx goofish-cli auth status` 验证
3. 插件启动 `message watch` 子进程，按 `account_id` 分组
4. 子进程退出 → 指数退避重启，最多 10 次后标记账号异常

### 11.2 子进程管理注意

- Windows 下 `spawn('uvx', ...)` 需要 `shell: false` + 绝对路径，或走 `cmd /c`
- 子进程 stderr 单独收集，用于账号掉线判定
- 插件卸载 / 账号停用时必须 `kill` 子进程，否则会残留

---

## 12. 配置项

| 项 | 默认 | 说明 |
|---|---|---|
| `mode` | `confirm_then_send` | 发货顺序 |
| `pollFallbackSeconds` | 300 | 订单轮询兜底间隔，0 关闭 |
| `sendRatePerMinute` | 1 | 经营消息限频 |
| `maxConfirmRetry` | 4 | 确认发货重试次数 |
| `blockZeroAmount` | true | 0 元订单不发货 |
| `blockRefund` | true | 退款中不发货 |
| `sensitiveWords` | 内置表 | 发送前扫描 |
| `maskCardInLog` | true | 发货流水脱敏 |
| `onlySendCard` | false | 只发卡券不确认（高风险，默认关） |

---

## 13. 分期

### P0 — 能发货（1 周）

- [ ] 给 goofish-cli 补 `order confirm` / `order sold-list`（或先 fork 本地补）
- [ ] `watcher` + 订单号提取 + 单卡券发货
- [ ] orders/deliveries 表 + 幂等
- [ ] 卡密 CAS 消费
- [ ] 手工测试：真账号拍一单 → 收到卡密

### P1 — 能长期跑（1 周）

- [x] 多数量（仅 `data` 类型）、多规格（`specName`/`specValue`，精确优先、回退通用）
- [x] 确认失败重试（`confirm_failed` → 定时重试确认，不重发卡密）
- [x] 轮询兜底（P0 即轮询）
- [x] 限频 / 熔断 / 敏感词（连续 3 次失败暂停 30 分钟）
- [x] 发货模板（`{card}` `{order_no}` `{buyer_nick}` `{spec}`）与 `######` 多条消息
- [x] 发货记录 UI（侧边栏入口 + 订单/卡券/发货记录三个标签页，手动触发一轮）

### P2 — 能卖（后续）

- [ ] 多账号
- [ ] 网盘模板与拆分发送
- [ ] 补发入口
- [ ] 通知（企微/飞书）

---

## 14. 验收标准

1. 同一订单重复触发 10 次，只发 1 次卡密
2. 并发 5 个订单抢 3 张卡密，恰好发出 3 张、2 单进 `blocked`
3. 进程在「卡密已发、确认未发」时被 kill，重启后进入 `confirm_failed` 并重试，不重发卡密
4. 买家消息里没有订单号（纯文本），不触发任何发货
5. 卡密池耗尽时，订单进 `blocked` 且 `fail_reason` 可读
6. 账号掉线，子进程自动重连；30 分钟不恢复则标记异常并在 UI 提示

---

## 15. 风险清单

| 风险 | 影响 | 缓解 |
|---|---|---|
| 签名算法变更 | 全部发货接口失效 | 传输层边界隔离；监控 `ret` 异常自动报警 |
| 卡片消息结构变更 | 订单号提取失败 | 保留正则兜底 + 轮询路径双保险 |
| 网盘外链被判定违规 | 消息被拦截 / 限流 | 拆分发送、不发二维码、敏感词前置 |
| 多账号同 IP | 关联封禁 | 不做账号矩阵，单实例少量账号 |
| 插件被 DSH 用户当「破解工具」传播 | 合规风险 | README 与安装页显式免责，只做自动发货 |

---

## 附录 A：参考实现里值得直接照抄的细节

1. `type=originaljson` —— 用 `json` 会被判非卖家端请求
2. `sold.get` 必须带 `origin: https://seller.goofish.com`
3. 签名用**未编码**的 data 原文，请求体用 `encodeURIComponent`
4. 确认发货返回 `ORDER_ALREADY_DELIVERY` 当成功处理
5. 卡密 CAS 用 `UPDATE ... WHERE content=<旧值>`，不要两步操作
6. 多条消息用 `######` 分隔、间隔 0.5s
7. 令牌过期用响应里的新 cookie 重试一次，并回写本地登录态

## 附录 B：不建议照抄的部分

- 返佣 / 对接 / 分销体系（财务模型复杂，与自动发货无关）
- 自动评价 / 求小红花 / 擦亮（风控噪音源，第一版不做）
- 多级代理与卡券对接结算
- 关闭订单后补卡券（容易造成卖家双重损失）
