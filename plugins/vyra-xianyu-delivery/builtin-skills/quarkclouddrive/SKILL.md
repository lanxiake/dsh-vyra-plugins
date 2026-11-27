---
name: quarkclouddrive
description: 夸克网盘文件操作（列出、分享、校验）。发货内容由闲鱼插件的确定性脚本生成，这里只说明规则与排错，不要让模型自己拼链接。
---

# 夸克网盘

## 谁在生成发货链接

**不是 Agent。** 闲鱼插件的 `lib/netdisk/quark.js` 会：

1. 按「商品 → 网盘路径」配置逐级目录直查，拿到文件 fid；
2. 调 `share` 创建分享（复用已有链接或每单新建）；
3. 实际访问一次链接做校验；
4. 过内容闸门（拒绝占位词、厂商广告、缺提取码）。

Agent 的职责只有：回答买家问题、解释规则。**不要自己调用网盘命令生成链接发给买家**，
也不要读这份文档里的示例去拼 URL——那样会绕过闸门，重演 2026-11-27 的事故
（把「暂无法生成（分享链接生成工具未就绪）」当成发货内容发给买家）。

## 真实 CLI

夸克网盘 Skill 自带 `scripts/quark-drive.cjs`，用系统 node 运行：

```bash
node <quarkcd>/scripts/quark-drive.cjs login --token <授权码> --session-id xianyu-delivery
node <quarkcd>/scripts/quark-drive.cjs browse --parent-fid <fid|0> --page-size 200
node <quarkcd>/scripts/quark-drive.cjs share <fid> --title <标题> --url-type 2 --expired-type 3
```

- `browse` 的结构化结果写在**当前目录**的 `browse/*.jsonl`，stdout 只有摘要 —— 读文件，不要解析 stdout。
- `share` 的 stdout 末尾一行是 JSON：`{"code":0,"data":{"share_url":"…","passcode":"…"}}`。
- `--expired-type`：1=永久 2=1天 3=7天 4=30天 5=60天 6=100天 7=180天。
- 运行环境需要 `DSH_HOME`；缺了会报「无法识别当前 Agent 环境」。插件会自动注入。

## 路径解析规则

用目录逐级直查（`browse --parent-fid`），**不要用关键词搜索**：

- `search --keyword` 的结果会带「搜索结果基于关键词返回，结果可能不完整 / 开通 SVIP+ 可享智能搜索」
  这类广告文案，曾经被原样发给买家；
- 关键词搜索还可能命中同名的旧版本、他人的同名分享。

找不到时一律报 `path_not_found:<段>`，让订单停在待人工，而不是猜一个文件发出去。

## 失败对照

| 现象 | 含义 | 处理 |
|---|---|---|
| `path_not_found:<段>` | 网盘里没有这一段路径 | 到「网盘」页核对商品路径 |
| `share_failed` | 平台拒绝创建分享（配额/风控） | 稍后重试或改复用已有链接 |
| `netdisk_timeout` | CLI 超时 | 检查网络与夸克登录态 |
| `verify_failed` | 生成的链接打不开 | 重新生成，不要发给买家 |
| 未授权 | 授权码过期 | 设置页重新粘贴授权码 |

## 给买家看的内容

只有三行：链接、提取码、有效期。不要出现「网盘 / 云盘 / 盘」这类字眼，
不要附带厂商广告或「去升级」链接。模板由插件渲染，Agent 不参与。
