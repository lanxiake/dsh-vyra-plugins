# 闲鱼自动客服

闲鱼虚拟商品的自动客服：实时监听买家消息，拍下即发卡密，并用 DSH 的 agent + 技能回答买家问题。免挂机：不需要手机、模拟器或浏览器常驻。

## 依赖

- **uv** — 插件通过 `uv run --with goofish-cli` 拉起自带的 worker
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

1. 用 Playwright 打开闲鱼首页，点「快速进入」走免密记忆登录
2. 等 cookie 刷新并写回 `~/.goofish-cli/cookies.json`
3. 重试原请求

刷新**优先用无头浏览器**，正常情况下不会弹窗；只有无头指纹被闲鱼拒绝时才回退到有头窗口（约 10 秒）。不需要重新扫码，只有免密登录也失效（cookie 被清空）时才需要重新扫码。

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
        pollSeconds: 60
        mode: send_then_confirm   # 或 confirm_then_send
        blockRefund: true
        blockZeroAmount: true
        sendIntervalMs: 60000
```

## 卡券（自动发货的卡密池）

卡券就是**发给买家的那串内容**，按商品绑定：

- 买家拍下 → 插件从该商品的卡券里取**一条** → 发给买家 → 确认发货
- `data` 类型是多行卡密池，每发一单消耗一条，发完订单进 `blocked`
- 一个商品只能绑定一张启用的卡券；0 张或多张都拒绝发货
- 支持多规格（按订单规格精确匹配，匹配不到用通用卡券）

不配卡券，订单页仍能看到订单，但自动发货会因为「无卡券」跳过。

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

## 实时监听

插件启动时会常驻 `message watch`。买家拍下的系统提示里带订单号，命中就直接发货，不用等下一轮轮询：

```
WS 事件（卡片/提示） → message history → 找 orderId → 立即发货
```

轮询仍然保留：WS 断线、事件漏掉时由 60 秒轮询兜底。幂等表保证同一订单只发一次。

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

DSH 会话列表没有原生分组，自动回复创建的会话标题是 `[客服名] 商品简称-客户名`，用前缀分组。

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

## Agent 工具

插件把闲鱼能力注册成主 Agent 可调用的工具：

| 类 | 工具 |
|---|---|
| 读 | `xianyu_list_chats` `xianyu_read_history` `xianyu_list_items` `xianyu_get_item` `xianyu_list_orders` `xianyu_order_detail` `xianyu_list_cards` |
| 写 | `xianyu_send_message` `xianyu_deliver` `xianyu_add_card` |

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
