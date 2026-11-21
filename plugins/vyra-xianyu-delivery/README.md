# 闲鱼自动客服

闲鱼虚拟商品的自动客服：实时监听买家消息，拍下即发卡密，并用 DSH 的 agent + 技能回答买家问题。免挂机：不需要手机、模拟器或浏览器常驻。

## 依赖

- **uv** — 插件通过 `uv run --with goofish-cli --with portalocker` 拉起自带的 worker
- **浏览器** — 扫码登录优先用系统 Edge；没有就退回 Playwright 自带的 Chromium

## 登录

点面板顶部的「扫码登录」，会弹出二维码：

- 面板里显示一份
- 同时右下角会打开一个浏览器窗口（闲鱼对 headless 指纹有风控，必须真实窗口）

用闲鱼 App 扫码并在手机上确认，登录态写入 `~/.goofish-cli/cookies.json`，浏览器窗口自动关闭，弹层 1 秒后关闭。面板顶部随即显示已登录账号。

也可以在终端登录：

```bash
uvx goofish-cli auth login --qr
uvx goofish-cli auth status --format json
```

`sold-list` / `confirm` 由插件自带的 `vendor/worker.py` 实现，不依赖上游 CLI 的版本。

## 令牌续期

`_m_h5_tk` 只有约十分钟有效期，需要浏览器活跃访问才会续。任何接口返回「令牌过期」时，插件会自动：

1. 用 Playwright（**无头**）打开闲鱼首页，点「快速进入」走免密记忆登录
2. 等 cookie 刷新并写回 `~/.goofish-cli/cookies.json`
3. 重试原请求

**不会反复弹浏览器**，有三层限制：

- **没登录（没有 cookie）时完全不尝试刷新**——否则每次轮询都会弹一个扫码窗口
- 刷新只走无头；无头失败说明 cookie 已救不回来，不再回退到有头窗口
- 刷新失败后进入 **15 分钟冷却**，期间直接返回错误，不再尝试

需要重新扫码时，用面板上的「扫码登录」手动发起。免密登录失效（cookie 被清空）只能重新扫码。

## 多账号与退出

- **扫码登录后自动归档**：每次登录成功，账号的 cookie 和昵称会存到 `~/.goofish-cli/accounts/<unb>.json`
- **账号下拉框**：面板顶部列出所有归档过的账号，选中即切换（覆盖 `cookies.json`、清掉 IM token、重启监听）
- **退出登录**：删除当前 `cookies.json` 与 IM token，停止监听；已归档的账号仍保留，随时可切回

切换账号后会清空面板里的会话与远程订单缓存，再按新账号重新拉取。

**数据按账号隔离**：卡券、订单、发货记录、商品技能绑定都带 `account_id`，切换后只看到当前账号的数据。升级前写入的旧记录 `account_id` 为空，作为共享历史对所有账号可见，不会被隐藏。

## 配置

`cordis.patch.yml`：

```yaml
- insert:
    - id: xianyu-delivery
      name: 'vyra-xianyu-delivery'
      config:
        pollSeconds: 60           # 订单轮询（发货）
        chatPollSeconds: 15       # 会话轮询（自动回复）
        mode: send_then_confirm   # 或 confirm_then_send
        blockRefund: true
        blockZeroAmount: true
        sendIntervalMs: 60000
        watchEnabled: false       # 常驻 IM 监听，会和 CLI 调用抢连接
```

## 卡券（自动发货发的内容）

卡券就是**发给买家的那串内容**，按商品绑定。三种模式：

| 模式 | 说明 | 适合 |
|---|---|---|
| `pool` 池型 | 多条库存，每单消耗一条 | 一次性卡密 |
| `reuse` 复用型 | 一条链接反复发，不消耗 | 固定网盘分享链接 |
| `generate` 生成型 | 每单调用网盘技能（默认夸克）现做一条新链接 | 7 天 / 单次有效的分享 |

面板卡券页会显示每种模式的 **总量 / 已用 / 剩余**（生成型显示「按需」）。

- 买家拍下 → 插件取该商品卡券的内容 → 按模板发出去 → 确认发货
- 一个商品只能绑定一张启用的卡券；0 张或多张都拒绝发货
- 支持多规格（按订单规格精确匹配，匹配不到用通用卡券）
- 生成型失败会明确记成 `blocked` + `generate_failed:<原因>`，不会假装发过

不配卡券，订单页仍能看到订单，但自动发货会跳过（`blocked` / `no_card`）。

卡券列表里每行都有「编辑 / 停用 / 删除」：编辑会载入表单，停用后该商品不再自动发货，删除直接移除。

**网盘商品示例**（内容里不要写「网盘」「微信」等敏感词）：

```
链接：https://pan.quark.cn/s/1cc79adb8f0e?pwd=xfrJ
提取码：xfrJ
有效期 7 天，过期联系我补。
```

多条库存这样分隔：

```
链接：https://pan.quark.cn/s/aaaa?pwd=1111
提取码：1111
---
链接：https://pan.quark.cn/s/bbbb?pwd=2222
提取码：2222
```

通过面板 RPC 或直接写库：

```bash
curl -X POST http://127.0.0.1:<port>/api/xianyu-delivery/rpc \
  -H 'content-type: application/json' \
  -d '{"op":"addCard","itemId":"<闲鱼商品ID>","name":"卡密","type":"data","content":"CARD-A\n---\nCARD-B"}'
```

可选参数：

| 参数 | 说明 |
|---|---|
| `specName` / `specValue` | 多规格商品按订单规格精确匹配；不填则为该商品的通用卡券 |
| `template` | 发送模板，支持 `{card}` `{order_no}` `{item_id}` `{buyer_nick}` `{spec}` `{quantity}` |

模板里的 `######` 会被拆成多条消息发送（每条间隔 `multiMessageDelayMs`，默认 500ms）。

一个商品只能匹配一张启用的卡券；0 张或多张都会拒绝发货（`no_card` / `ambiguous_card`）。

卡券条目之间用**单独一行 `---`** 分隔；条目内部可以多行（网盘链接 + 提取码）：

```text
链接：https://pan.quark.cn/s/xxxxxxxx?pwd=abcd
提取码：abcd
有效期 7 天，过期联系我补。
---
链接：https://pan.quark.cn/s/yyyyyyyy?pwd=efgh
提取码：efgh
有效期 7 天，过期联系我补。
```

## 状态

| state | 含义 |
|---|---|
| `completed` | 卡密已发，平台已确认发货 |
| `sent` | 卡密已发，确认接口尚未成功 |
| `confirm_failed` | 卡密已发，确认失败，定时重试确认 |
| `send_failed` | 卡密已消费但发送失败，需人工补发 |
| `partial` | 多数量订单只发出了一部分（卡密不够或中途失败），需人工补发剩余 |
| `blocked` | 未发货：无卡券 / 卡密耗尽 / 敏感词 / 退款 / 0 元 |

## 收消息与自动回复

**主路径是轮询**：每 `chatPollSeconds`（默认 15 秒）拉一次会话列表，有新消息的会话再拉历史，然后

1. 历史里有新订单号 → 立即发货
2. 最新一条是买家文本 → 交给客服 Agent 生成回复并发送

为什么不是长连接：闲鱼的 IM 是单连接，`send` / `history` 这类命令每次都会新开一条 IM 连接，会把正在收消息的常驻监听踢下线。轮询每次都是短连接，不存在互踢。

可选的 `watch` 仍保留（设置 `watchEnabled: true` 或点面板上的「实时」开关），延迟更低，但会和 CLI 调用抢连接，不建议同时高频开面板。

**会话商品**：会话本身带 `itemId`（从会话扩展里取），所以买家从聊天列表点进来也能定位商品；订单和商品卡片是兜底。

## 客服配置

客服是插件的轻量实体，**全局共享**（所有账号通用），一个客服可以覆盖多个商品：

| 字段 | 说明 |
|---|---|
| 名称 | DSH 会话标题的分组前缀 |
| 系统提示词 | 留空用内置客服 |
| 技能 | 商品资料写在技能里，回复时整段注入 |
| 模型 | 留空用 profile 默认 |
| 自动发货 | 关掉后该商品的订单不会自动发货 |
| 发货模板 | 可选，支持 {card} {order_no} {buyer_nick} |

流程：

1. 「客服」页新建/编辑客服
2. 「商品」页给商品「绑定客服」
3. 买家发文本消息 → 找商品绑定的客服 → 技能 + 最近对话 → Agent 生成 → 发送

**DSH 会话列表里的「闲鱼客服」分组**：自动回复创建的会话落在专用工作区 `~/.dsh/闲鱼客服`，DSH 侧栏按工作区分组，于是出现独立分组。**一个买家一个会话**（sessionId 固定为 `xianyu-<cid>`，第一次创建、之后续写），标题是 `[客服名] 商品简称-客户名`，点进去能看到完整的提问和 Agent 回复过程。

配置项（`cordis.patch.yml`）：

```yaml
ai:
  mode: dsh            # dsh = DSH agent；api = 直连 OpenAI 兼容接口
  provider: ''         # 留空用 profile 默认模型
  model: ''
  skillsDir: ''        # 默认 ~/.dsh/skills
  cooldownSeconds: 8
  maxRepliesPerChat: 8
```

技能扫描：`~/.dsh/skills`、`~/.dsh/market/skills`、`~/.agents/skills`、`~/.claude/skills`，以及插件自带的 `builtin-skills/`。

### 内置技能

插件随包带三个技能，新建客服时默认勾选：

| 技能 | 内容 |
|---|---|
| `xianyu-customer-service` | 客服完整流程与原则：先查再答、发货、议价、禁止项、常见问题 |
| `baidu-drive` | 百度网盘上传/分享；**不含任何账号或令牌**，用户自己安装 CLI 并登录 |
| `quarkclouddrive` | 夸克网盘上传/分享；同样不含账号或令牌 |

网盘技能里只写操作方式和认证步骤，实际凭证由用户在本机 CLI 里配置。

新建客服的默认值（可改）：

- 系统提示词：一份 **weflow 商品的真实客服配置**（商品信息、常见问题、规则），直接可改成自己的商品
- 发货模板：`{card}` + 有效期说明
- 技能：上面三个
- 工具：全部 `xianyu_*` 工具默认勾选，鼠标悬停可看工具用途
- 模型：下拉框，列出 DSH 里已配置的 provider/model；留空用 profile 默认

注意：只回**文本**消息；自己发的不回；同一会话 3 秒内的连发合并；回复失败只记日志。

聊天页底部「最近消息处理」会写明没回复的原因：

| action | 含义 |
|---|---|
| `replied` | 已生成并发送 |
| `no-reply:agent-unavailable` | DSH agents 服务不可用 |
| `no-reply:no-service` | 没有启用的客服 |
| `no-reply:no-item-context` | 会话没有商品上下文（买家需从商品页发起聊天） |
| `no-reply:cooldown` / `max-replies` | 触发冷却或条数上限 |
| `no-reply:agents-unavailable` | 创建 Agent 会话失败 |
| `no-reply:empty-reply` | Agent 没调用回复工具 |
| `no-reply:<其它错误>` | 具体的接口/模型错误 |
| `send-failed:<错误>` | Agent 生成成功但发送失败（闲鱼接口报错/限流） |
| `hint:new_msg` | 收到「有新消息」通知，但历史里最新一条不是买家文本 |
| `hint:card` | 收到卡片/系统提示，历史里既没有订单号也没有买家提问 |

闲鱼的推送经常只给一条「有新消息」通知（`new_msg`，不带正文）。插件收到这种通知会拉一次会话历史：历史里有新订单号就发货，最新一条是买家文本就交给客服，所以不依赖推送正文。

**自动回复仅支持从商品页发起的会话**：买家需点商品页的「联系卖家」才能触发自动回复。从聊天列表直接点进来的会话没有商品上下文，闲鱼 IM 协议限制无法建立新会话（诊断表会显示 `no-reply:no-item-context`）。虚拟商品场景下买家咨询都是从商品页发起的，这个限制不影响正常使用。

## Agent 工具

插件把闲鱼能力注册成主 Agent 可调用的工具：

| 类 | 工具 |
|---|---|
| 读 | `xianyu_list_chats` `xianyu_read_history` `xianyu_list_items` `xianyu_get_item` `xianyu_list_orders` `xianyu_order_detail` `xianyu_list_cards` |
| 写 | `xianyu_send_message` `xianyu_deliver` `xianyu_add_card` |
| 配置 | `xianyu_save_service`（建/改客服） `xianyu_bind_item`（商品绑客服，0=解绑） |

配置类工具让你在 DSH 里一句话完成初始化，比如：

> 新建一个客服叫「网盘客服」，提示词是……，技能用 quarkclouddrive；把商品 1095350203107 绑到它；卡券用这条夸克链接，复用型。

模型会依次调用 `xianyu_save_service` → `xianyu_list_cards`（拿 id）→ `xianyu_bind_item` → `xianyu_add_card`。

写操作直接作用在真实账号上（会真实发送/发货），工具描述里已写明。

## 面板

插件在侧边栏加一个「闲鱼客服」入口，顶部显示**当前登录的闲鱼账号**，主页面六个标签页：

- **聊天** — 按最新消息排序的会话列表（头像、昵称、未读、时间）+ 聊天记录，可以直接回复买家；文本、系统提示、图片和卡片都会渲染
- **订单** — 闲鱼真实订单，按时间排序，点击任意一行查看订单详情（状态、商品、金额、买家、时间）
- **卡券** — 下拉选商品、粘贴卡券内容（网盘链接+提取码），多条用单独一行 --- 分隔
- **商品** — 在售商品卡片；点卡片看详情，点「绑定客服」选择客服配置
- **客服** — 新建/编辑/删除客服，勾选技能、设置自动发货与发货模板
- **发货记录** — **只显示插件自动发货发出的消息**；你在闲鱼 App 里手动发的消息不在其中

顶部「立即处理一轮」手动触发轮询，面板每 5 秒自动刷新一次。

## 自检

```bash
node plugins/vyra-xianyu-delivery/test/self-check.mjs
node plugins/vyra-xianyu-delivery/test/client-check.mjs
```

覆盖：重复触发只发一次、卡密不重复消费、卡密耗尽、敏感词拦截、退款跳过、多数量、多规格、模板渲染、`######` 多条消息、连续失败熔断。

## 风险

使用非官方接口，违反闲鱼用户协议，存在账号被限制或封禁的风险。建议用小号，并自行评估平台规则变化。插件不做滑块破解、设备指纹伪造、账号矩阵。

## 交流群

有问题、想提功能、或者想看看别人怎么用，欢迎加 QQ 群（群号 1121362543）。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/qq-group.png" />
  <img alt="QQ 交流群二维码，群号 1121362543" src="./assets/qq-group.png" width="220" />
</picture>
