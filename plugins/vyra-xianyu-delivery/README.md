# 闲鱼虚拟商品自动发货

轮询闲鱼卖家的待发货订单，匹配卡密，发送内容并确认发货。免挂机：不需要手机、模拟器或浏览器常驻。

## 依赖

需要带 `order` 命令的 `goofish-cli`（上游 v0.4 尚未发布）：

```bash
# 本地 fork
uv run --directory /path/to/goofish-cli goofish auth login --qr
```

插件默认调用 `uvx goofish-cli`；指向本地 fork时改配置：

```yaml
cliCommand: uv
cliPrefix: ['run', '--directory', 'C:/path/to/goofish-cli', 'goofish']
```

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

## 加卡券

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

## 面板

插件在侧边栏加一个「闲鱼发货」入口，主页面三个标签页：

- **订单** — 订单号、商品、已发/总数、状态、失败原因
- **卡券** — 在线添加卡券（商品 ID、规格、内容）
- **发货记录** — 每张卡密的发送结果与时间

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
