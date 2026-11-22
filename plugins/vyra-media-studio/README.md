# vyra-media-studio

DSH 右侧栏的媒体库与音视频预览插件。当前阶段：**P0 已实现，可直接从 Git/本地目录安装**。

## 能做什么

- 在右侧栏浏览当前工作区的视频、图片、音频与在线直链
- 网格 / 列表两种视图，按名称、类型、文件夹、时间、大小多条件筛选与排序
- 视频/音频卡片内原地播放；点击卡片打开面板内灯箱
- 视频/音频预览 tab：文件树里的 `mp4` / `mp3` 等直接打开，切换 tab 时音频继续播放
- 图片灯箱缩放/平移；复杂查看仍可交给 DSH 原生图片预览
- 普通网页链接交给 Browser tab，直接媒体 URL 在本插件内播放
- 本地大文件通过支持 Range 的 Host 路由流式读取，可拖动进度

## 复用成熟开源项目

不重复造轮子，重 UI 交给现成库，Host 侧交给成熟的基础包：

| 依赖 | 用途 |
|---|---|
| [`yet-another-react-lightbox`](https://github.com/igordanchenko/yet-another-react-lightbox) | 面板内灯箱、视频 slide、缩放、缩略图、计数、全屏（MIT） |
| [`lucide-react`](https://github.com/lucide-icons/lucide) | 图标（ISC） |
| [`fast-glob`](https://github.com/mrmlnc/fast-glob) | 工作区媒体扫描（MIT） |
| [`mime-types`](https://github.com/jshttp/mime-types) | 响应媒体类型（MIT） |
| [`range-parser`](https://github.com/jshttp/range-parser) | HTTP Range 解析（MIT） |

播放控制使用浏览器原生 `<video>` / `<audio controls>`，不另写一套播放器。完整许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 安装

插件尚未进入本仓库的市场清单，可先从 Git 或本地目录安装：

```sh
dsh plugin add git+https://github.com/lanxiake/dsh-vyra-plugins.git#path:/plugins/vyra-media-studio
```

本地开发时在 profile 的 `package.json` 中把依赖指向本目录：

```json
"vyra-media-studio": "link:E:/my-project/dsh-vyra-plugins/plugins/vyra-media-studio"
```

安装后在 profile 的 bundles 中启用 `vyra-media-studio`，重启 DSH。

## 开发

```sh
# 安装依赖
pnpm install

# 重建浏览器 bundle（修改 src/client 后必须执行）
pnpm run build:client

# Host 路由 + 客户端注册测试
pnpm test
```

`client.js` 是 `src/client/` 经 esbuild 打包后的产物；不要直接手改。

## 文档与原型

- [设计文档](docs/设计文档.md)
- [前端原型](prototype/index.html)（纯 HTML/CSS/JS，直接打开或用静态服务器）
- 原型说明与截图：[prototype/README.md](prototype/README.md)

## P0 边界

不包含转码、资源嗅探、网页 OG 抓取、SSH/远程媒体、字幕、波形、拖入本地文件（P1）、服务端缩略图（P2）。

## 交流群

有问题、想提功能、或者想看看别人怎么用，欢迎加 QQ 群（群号 1121362543）。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/qq-group.png" />
  <img alt="QQ 交流群二维码，群号 1121362543" src="./assets/qq-group.png" width="220" />
</picture>
