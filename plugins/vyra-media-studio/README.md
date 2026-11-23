# vyra-media-studio

DSH 右侧栏的文件管理插件，同时保留音视频预览能力。当前阶段：**文件管理已实现，可直接从 Git/本地目录安装**。

## 能做什么

- 在右侧栏浏览当前工作区内的全部文件：图片、视频、音频、文档、压缩包、代码与其他类型
- ✅ 网格 / 列表两种视图；网格支持全局缩略图缩放（滑杆 + Ctrl 滚轮）
- ✅ 列表支持“简洁 / 详细”两档：简洁显示文件名、后缀与路径，详细再加修改日期、类型与大小
- ✅ 面包屑与文件夹弹层定位；显示隐藏文件、包含依赖/构建目录
- ✅ 网格、列表与预览中都可右键或点“更多”：引用到输入框、复制到文件夹、复制文件地址、重命名、打开所在位置、用系统应用打开、删除
- ✅ 文本类文档用真实内容缩略图；PDF/Office/压缩包/代码使用按类型配色的图标缩略图
- ✅ PDF 在面板内预览；文本/代码/Markdown 面板内文本预览；Office 等交给系统应用
- ✅ 视频/音频卡片内原地播放；点击卡片打开面板内灯箱；切换 tab 时音频继续播放
- ✅ 本地大文件通过支持 Range 的 Host 路由流式读取，可拖动进度
- 普通网页链接交给 Browser tab，直接媒体 URL 在本插件内播放

## 性能

- 扫描只收集文件名、扩展名与类型，**不逐文件 `stat`**
- 大小与修改时间由 `POST /api/vyra-media/stat` 按可见页批量读取（单批最多 200 条）
- 扫描结果在 Host 内存缓存 15 秒，手动刷新或任何写操作立即失效
- 默认跳过 `.git`、`node_modules`、`dist`、`build` 等目录；可在筛选面板选择包含
- 缩略图与文本片段只在进入视口时加载

## 复用成熟开源项目

不重复造轮子，重 UI 交给现成库，Host 侧交给成熟的基础包：

| 依赖 | 用途 |
|---|---|
| [`yet-another-react-lightbox`](https://github.com/igordanchenko/yet-another-react-lightbox) | 面板内灯箱、视频 slide、缩放、缩略图、计数、全屏（MIT） |
| [`lucide-react`](https://github.com/lucide-icons/lucide) | 图标（ISC） |
| [`fast-glob`](https://github.com/mrmlnc/fast-glob) | 工作区文件扫描（MIT） |
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

## 文件操作边界

- 重命名、复制、删除使用 Host 进程文件系统，因此面向**本地文件系统后端**；远程 SSH 后端暂不支持写操作（扫描同样为本地实现）。
- “复制”落地为**复制到工作区内的目标文件夹**（浏览器无法把文件写入系统剪贴板）；“复制文件地址”单独复制绝对路径。
- 删除默认走系统回收站：Windows PowerShell 回收站、macOS `~/.Trash`、Linux `gio trash`；失败时才提示永久删除。
- “引用到输入框”通过 `conversation.input.left` 的 composer bridge 插入 `@相对路径 ` 提及。

## 文档与原型

- [设计文档](docs/设计文档.md)
- [前端原型](prototype/index.html)（纯 HTML/CSS/JS，直接打开或用静态服务器）
- 原型说明与截图：[prototype/README.md](prototype/README.md)

## 当前边界

不包含服务端缩略图生成、PDF 首页渲染、Office 内容解析、拖拽上传、多选批量操作、远程 SSH 文件写入。

## 交流群

有问题、想提功能、或者想看看别人怎么用，欢迎加 QQ 群（群号 1121362543）。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/qq-group.png" />
  <img alt="QQ 交流群二维码，群号 1121362543" src="./assets/qq-group.png" width="220" />
</picture>
