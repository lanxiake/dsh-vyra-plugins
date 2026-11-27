# dsh-vyra-ssh-terminal · SSH 终端

**把 SSH 终端搬进 DSH**——连接档案、SFTP、资源监控、**和 AI 一起操作同一台机器**。密码只进 DSH 的凭据服务，档案文件里没有任何秘密。

```sh
dsh plugin --profile web add dsh-vyra-ssh-terminal
```

## 它解决什么问题

在 DSH 里操作远程机器，通常要切出去开一个终端窗口，再把结果贴回来。这个插件让模型和你在同一个界面上完成：

| 能力 | 说明 |
|---|---|
| **连接档案** | 主机、用户名、认证方式；可按网卡指定本机出口地址（VPN 换租约也跟得上） |
| **跳板** | 经中转主机连接内网机器 |
| **SFTP** | 浏览、上传（带实时进度）、下载、改权限 |
| **端口转发** | 本地/远程转发 |
| **主机密钥固定** | 首次连接记下指纹，之后变更会告警 |
| **导入** | 从 `~/.ssh/config`、FinalShell 等既有配置批量导入 |
| **资源监控** | CPU/内存/Swap/网络/磁盘 I/O + GPU/NPU/磁盘/进程/延迟 |
| **AI 助手** | 用 DSH 的模型，命令打在你能看见的终端里 |
| **导出** | Host 直接写盘，报告保存路径并可一键打开所在文件夹 |

## AI 助手

默认用你在 DSH「设置 → 模型」里选好的提供商，不用另配 key。

关键设计是 **AI 和你在同一台机器上**：它的命令经 `terminals.runInShell` 打进**你眼前那个终端**，所以 `cd` 出来的目录、导出的环境变量，人和模型共用一份；你也能实时看着它跑。

- **要商量的步骤会停下**：删除、覆盖类命令弹审批卡，你点了才动
- **定级只看命令文本**：提示词里说"这是安全的"绕不过去
- **超长输出落盘**：只给首尾，完整内容按需 `read_output`
- **对话自动保存**：每轮落盘，`☰` 里能翻回去**真正接着聊**（恢复上下文，不只是重画文字）
- **门禁三档**：宽松（默认）/ 普通 / 严格

## 凭据怎么存

**密码和私钥口令只写进 DSH 的 credentials 服务，连接档案（`$DSH_HOME/ssh-terminal/connections.json`）里只有主机名和用户名。** 面板上也只显示"有没有设过密码"，不回显。

## 用法

侧栏「SSH」打开面板。新建连接 → 填主机和用户名 → 输密码（存进凭据服务）→ 连接。

连上后工具栏有：文件 / 监控 / AI / 历史 / 查找 / 日志 / 清屏 / 断开。`Ctrl+/` 看全部快捷键。

## 面板位置

**侧栏 → SSH**

## 安全边界

- **档案无秘密**：密码/口令与主机信息分开存放
- **命令定级只看文本**：危险命令按 `gate.js` 的规则拦截，模型无法自我豁免
- **输出净化**：剥掉控制序列后才进入模型上下文
- **审计**：连接与命令记入审计日志
- **本插件能连任意可达主机**——按你的凭据权限来，装之前请确认这是你要的

## 安装

在客户端「设置 → 插件 → 索引源」加入：

```
https://lanxiake.github.io/dsh-vyra-plugins/index.json
```

然后搜索「SSH 终端」安装。

## 已知限制

- 终端前端基于 xterm（vendor 内置，不联网加载）
- Windows 下的本机出口绑定依赖网卡名，部分虚拟网卡不支持
- AI 的「停止」中止模型请求，但已在跑的 SFTP 传输不会被打断
- 依赖 `ssh2` 与 `ssh-config`，安装时需要装依赖（首次安装会提示确认）

## 开发

```
src/            浏览器端源码（client.js 由 scripts/build.mjs 打包产出）
test/           纯 node 测试，node test/run.mjs 跑全部
scripts/        构建与自检脚本
index.js        宿主端装配
routes.js       HTTP 接口（每个接口一条 exact 路由）
```

自检脚本（都需要本机有 Chromium）：

```sh
node scripts/build.mjs             # 打包 client.js
node scripts/headless-check.mjs    # 产物能在浏览器里加载并注册插槽
node scripts/render-check.mjs      # 用真实 React 渲染，能抓白屏
node scripts/render-check-data.mjs # 有数据时的监控/AI 面板
node scripts/check-theme.mjs       # 防"写死主题色"（浅色主题下变黑块）
node scripts/check-import-ext.mjs  # 防 import 指错扩展名
```

**改完 UI 请务必在真实 DSH 里看一遍**——单元测试全绿而界面白屏，在这个插件上真实发生过两次（React 注入被打包器改名、xterm 自带 `#000` 背景）。

## 交流群

有问题、想提功能、或者想看看别人怎么用，欢迎加 QQ 群（群号 1121362543）。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/qq-group.png" />
  <img alt="QQ 交流群二维码，群号 1121362543" src="./assets/qq-group.png" width="220" />
</picture>