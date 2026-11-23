# DSH Console

让 Agent 操作 DeepSeek Harness 自身的控制台：查看与切换模型、读写设置、管理插件、调整主题与布局。

这个插件的重点不只是「能做什么」，更是「不能做什么」。Agent 可以改变 harness **长什么样、怎么配置**，但永远不能改变自己**握有多大的权限**——沙箱模式、权限预设、审批应答、凭据写入这四类动作在 `core.js` 的 `FORBIDDEN` 表里被永久拒绝，并附带给用户的操作替代方案。所有动作经由同一张 `ACTIONS` 注册表分派，因此边界只有一处定义、两个调用方（Agent 工具与客户端面板）共用。

## 安装

在会话中让 Agent 安装，或在插件面板里安装本目录：

```
plugin_manager install_bundle plugins/vyra-dsh-console
```

安装后重载界面；Host 侧改动需要重启 DSH。

## 结构

```
vyra-dsh-console/
├── package.json       # Bundle manifest
├── cordis.patch.yml   # Host 插件行
├── index.js           # Host 入口
├── core.js            # 动作注册表、权限边界与分派器
├── test/              # node --test：边界与分派自检
└── assets/            # 交流群二维码
```

## 开发

```powershell
node --test plugins/vyra-dsh-console/test/core.test.mjs
```

## 交流群

有问题、想提功能、或者想看看别人怎么用，欢迎加 QQ 群（群号 1121362543）。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/qq-group.png" />
  <img alt="QQ 交流群二维码，群号 1121362543" src="./assets/qq-group.png" width="220" />
</picture>
