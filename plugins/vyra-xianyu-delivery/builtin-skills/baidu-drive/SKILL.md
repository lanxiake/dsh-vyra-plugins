---
name: baidu-drive
description: 百度网盘文件操作（上传、列出、分享、搜索）。登录凭证由用户自己配置，插件不保存任何令牌。
---

# 百度网盘

## 认证（用户自己完成）

插件不内置任何账号或令牌。第一次使用前，用户需要：

1. 安装 `bdpan` 命令行工具（按其官方文档）
2. 执行 `bdpan login`，在浏览器里完成授权
3. 用 `bdpan whoami` 确认已登录

命令直接读取本机的登录配置，不要读取、输出或转述配置文件内容。

## 常用操作

```bash
bdpan ls /apps/bdpan
bdpan upload <本地路径> /apps/bdpan/<目标>
bdpan share /apps/bdpan/<文件>
```

`share` 输出的链接和提取码就是发给买家的内容。

## 发给买家时

- 只发链接 + 提取码 + 有效期，不要出现「网盘」「云盘」「盘」这些词
- 链接失效或提取码错误：重新生成后补发，不要让买家自己去找

## 出错时

- `not logged in`：提醒用户在本机执行 `bdpan login`
- `permission denied`：确认目标路径在 `/apps/bdpan/` 下