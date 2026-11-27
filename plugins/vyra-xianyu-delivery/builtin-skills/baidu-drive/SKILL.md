---
name: baidu-drive
description: 百度网盘。当前闲鱼插件尚未接入，仅保留占位；需要时再实现脚本层与授权页。
---

# 百度网盘（未接入）

闲鱼插件目前只接入了夸克网盘。百度网盘在「网盘」页显示为占位状态，
`createNetdisk({ provider: 'baidu' })` 会返回 `unsupported: true`，发货时不出链接。

**不要**为了让订单发出去而用任何临时脚本拼百度分享链接——那会绕过内容闸门。

接入时需要补齐（与 `lib/netdisk/quark.js` 同样的接口）：

- `probe()` 工具是否可用
- `authState()` / `login()` 授权态
- `resolve(path)` 路径 → fid，逐级目录直查
- `share({ fid, expireDays })` → `{ share_url, passcode }`
- `verify({ shareUrl })` 可访问性

百度分享链接形如 `https://pan.baidu.com/s/<id>?pwd=<4位>`，
`lib/validate.js` 已内置对应正则，接入后闸门无需改动。
