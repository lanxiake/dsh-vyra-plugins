# 闲鱼自动客服

闲鱼虚拟商品的自动客服：实时监听买家消息，拍下即发卡密，并用 DSH 的 agent + 技能回答买家问题。免挂机：不需要手机、模拟器或浏览器常驻。

```sh
dsh plugin --profile web add dsh-vyra-xianyu-delivery
```


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

`_m_h5_tk` 只有约十分钟有效期。**每次 mtop 请求结束后，插件会把 cookie jar 写回 `~/.goofish-cli/cookies.json`**——闲鱼在这条响应里轮换的新 token 因此不会丢，下一条命令用的就是最新的。令牌过期时会用刚写回的 token **原地重试一次**，不需要浏览器。

只有连重试都救不回来（session 层失效）才走浏览器：用 Playwright（**无头**）打开闲鱼首页，点「快速进入」走免密记忆登录，再重试原请求。

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
      name: 'dsh-vyra-xianyu-delivery'
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

插件常驻一个 `worker.py serve` 进程：**一条 IM 连接**同时负责收推送、拉历史、发消息。

```
serve 进程 ── 收推送 ──▶ handleImEvent ──▶ 发货 / 交给 Agent
          ── chats / history / send（同一条连接，不再起新进程）
```

这么做解决了两件事：

- **不再互踢**：以前每条 `send`/`history` 都会新开连接，把常驻监听踢下线；现在全走同一条
- **快**：以前每条命令要 `uv run` 起一个 Python（1~2 秒），现在同一进程内往返约 100~600ms

收到的每条消息：历史里有新订单号 → 发货；最近一条**带文本**的买家消息 → 交给客服 Agent 回复（下单卡片没有文本，会往前找到真正的提问）。

兜底轮询仍在（默认 15 秒）：进程重启、事件漏掉时补一轮。

面板「实时」开关只控制要不要处理推送事件，通道本身始终保留。

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

**DSH 会话列表里的「闲鱼客服」分组**：插件启动时用 DSH 的 `workspaceRegistry.create(目录, '闲鱼客服')` 注册一个工作区，每个会话创建后再 `attachSession` 挂进去——只设 `meta.cwd` 不注册工作区的话，会话会先出现在「未分组」再消失。

**一个买家一个会话**（sessionId 固定为 `xianyu-<cid>`，第一次创建、之后续写），标题通过 `sessionController.rename({ sessionId, title })` 设为 `[客服名] 商品简称-客户名`。

**技能与工具**：客服提示词和技能正文写进 Agent 的**系统提示段**（`systemPrompt.section`），续写时依然存在；允许的工具用 `tools.restrict({ allow })` 真正限制，而不只是写在 prompt 里。

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

**发图片**：回复里写 `![](图片URL)`，插件会拆成「文本 → 图片 → 文本」发出去。图片必须是公网可访问的 URL（例如 `xianyu_get_item` 返回的商品图），本地截图需要先上传到某个可访问地址。

**回复结构**：客服提示词按层写进 Agent 的系统提示——角色 → 规则 → 当前商品（标题/ID）→ 技能正文。工具不再是 prompt 里的一句清单，而是用 `tools.restrict` 真正限制。

注意：自己发的不回；同一会话 3 秒内的连发合并；回复失败只记日志。

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

插件在侧边栏加一个「闲鱼客服」入口，顶部显示**当前登录的闲鱼账号**，主页面七个标签页：

- **开始使用** — 准备情况清单（登录 / 客服 / 商品绑定 / 卡券 / 消息通道），以及「一键配置一个商品」：选商品、粘链接，自动建客服、建卡券、绑定

- **聊天** — 按最新消息排序的会话列表（头像、昵称、未读、时间）+ 聊天记录，可以直接回复买家；文本、系统提示、图片和卡片都会渲染
- **订单** — 闲鱼真实订单，按时间排序，点击任意一行查看订单详情（状态、商品、金额、买家、时间）
- **卡券** — 下拉选商品、粘贴卡券内容（网盘链接+提取码），多条用单独一行 --- 分隔
- **商品** — 在售商品卡片；点卡片看详情，点「绑定客服」选择客服配置
- **客服** — 新建/编辑/删除客服，勾选技能、设置自动发货与发货模板
- **发货记录** — **只显示插件自动发货发出的消息**；你在闲鱼 App 里手动发的消息不在其中

顶部「立即处理一轮」手动触发轮询，面板每 5 秒自动刷新一次。

## 调试与自检

**不打开面板也能看插件状态**（自动探测 DSH 的本地端口）：

```bash
node plugins/vyra-xianyu-delivery/scripts/dev-probe.mjs status
node plugins/vyra-xianyu-delivery/scripts/dev-probe.mjs events
node plugins/vyra-xianyu-delivery/scripts/dev-probe.mjs chats
node plugins/vyra-xianyu-delivery/scripts/dev-probe.mjs tick
```

**离线自检**（不需要 DSH）：

```bash
node test/self-check.mjs         # 发货状态机：幂等、卡密消耗、熔断、多规格、模板
node test/conversation-check.mjs # 历史解析：下单卡片、自己发言、启动前消息
node test/client-check.mjs       # 客户端组件
node test/render-smoke.mjs       # 11 个界面场景渲染
node test/boot-check.mjs         # 用假 ctx 真正 apply 插件并走一遍 RPC
node test/im-check.mjs           # 常驻 IM 通道：复用连接、往返耗时
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
