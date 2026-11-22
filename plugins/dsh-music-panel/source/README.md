<div align="center">

<img src="https://raw.githubusercontent.com/Aliboder/dsh-music-panel/main/icon.svg" alt="dsh-music-panel" width="96" height="96" />

# dsh-music-panel

**在 DeepSeek Harness 里，把本地曲库、在线音乐和自建服务器装进一台播放器。**

本地音乐 · 网易云 · QQ 音乐 · 酷狗 · 波点 · 汽水 · Navidrome / Subsonic  
歌词 · Folia 歌词舞台 · 在线歌单 · 播放统计 · 音量均衡 · 均衡器

[![npm](https://img.shields.io/npm/v/dsh-music-panel.svg?color=%235686fe)](https://www.npmjs.com/package/dsh-music-panel)
[![release](https://img.shields.io/badge/release-0.43.0-5686fe)](https://github.com/Aliboder/dsh-music-panel/releases)
[![CI](https://github.com/Aliboder/dsh-music-panel/actions/workflows/ci.yml/badge.svg)](https://github.com/Aliboder/dsh-music-panel/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/dsh-music-panel.svg)](LICENSE)

[安装](#安装) · [功能](#功能) · [截图](#截图) · [隐私](#隐私与边界) · [English](#english)

<img src="https://raw.githubusercontent.com/Aliboder/dsh-music-panel/main/docs/screenshots/library-grid.webp" alt="dsh-music-panel library" width="100%" />

</div>

---

## 为什么是它

大多数音乐插件只做到“能播”。dsh-music-panel 想做的是一台**真正属于 DSH 的播放器**：本地曲库、在线平台、歌词舞台、缓存和播放统计共享同一套界面与队列，不用在应用之间来回切换。

- **一个队列，所有来源**：硬盘、网易云、QQ、酷狗、波点、汽水、Navidrome 的歌可以排在一起，切来源不会清空正在播放的队列。
- **像播放器，不像文件列表**：专辑网格、可拖拽队列、断点续播、播放统计、深浅色宿主主题、键盘快捷键。
- **歌词不只是滚动**：14 种可选的 Folia 歌词舞台，逐字时间线、翻译 / 罗马音、封面取色主题和动态背景；默认「莫奈」。
- **在线歌单像本地一样顺**：扫码登录后浏览云端歌单、喜欢、最近播放、推荐和云盘；歌单缓存、预取、后台刷新都在。
- **曲库能自己维护**：在线匹配标签和封面、校准歌词、检测重复、删除进回收站，不需要打开第三方工具。
- **数据留在本机**：Cookie、缓存和播放记录由 Host 保存在本地，浏览器端不直连外部域名。

> 歌词舞台、背景、歌词解析与部分在线架构大量参考并移植自 **[Folia](https://github.com/chthollyphile/folia-major)**。完整归属见 [Credits](#credits)。

## 功能

| 模块 | 你能做什么 |
| :--- | :--- |
| **本地音乐** | 多目录扫描、歌曲 / 专辑 / 歌手 / 文件夹 / 喜欢 / 统计、续播、回收站、右键查看详细信息。 |
| **在线音乐** | 网易云、QQ、酷狗、波点、汽水；扫码登录、云端歌单、推荐、云盘、VIP 识别。 |
| **Navidrome** | 连接自建 Navidrome / Subsonic，搜索、播放、歌词、封面、收藏与歌单。 |
| **歌词** | LRC / KRC / QRC / YRC / TTML / VTT、逐字高亮、翻译、罗马音、偏移与字号。 |
| **Folia 舞台** | 14 种歌词样式、封面取色、动态背景、逐字时钟，支持随机轮换。 |
| **播放体验** | 10 段均衡器、AutoEQ、EBU R128 音量均衡、智能过渡、音频焦点避让。 |
| **整理** | 在线补全标签、替换封面、匹配歌词、重复检测、批量收藏 / 歌单。 |
| **DSH 原生** | 侧栏入口、输入框上方歌词条、会话内播放、宿主主题与设置页。 |

## 安装

**要求：DSH Web / Desktop。** 插件需要浏览器载体播放音频，并依赖 DSH 提供的网络与存储。

### 插件市场（推荐）

在 DSH **插件市场**搜索 **dsh-music-panel**，或让 Agent 执行：

```text
plugin_manager install_bundle dsh-music-panel
```

### npm

在 DSH profile 目录下：

```bash
pnpm add dsh-music-panel
```

安装后**完整退出并重启 DSH**。npm 包：<https://www.npmjs.com/package/dsh-music-panel>

## 快速开始

**本地音乐**：左侧栏打开音乐 → 设置 → 音乐库 → 添加文件夹 → 扫描 → 双击播放。

**在线音乐**：顶栏切到网易云 / QQ / 酷狗 / 波点 / 汽水 → 设置 → 在线 → 扫码登录。未登录也可以播放平台免费曲目。

**Navidrome**：设置 → 在线 → Navidrome → 填写服务器地址与账号 → 连接。  
需要完整曲库时勾选「保存密码，启用完整曲库」；默认使用随机采样的全部歌曲。

## 截图

| 本地曲库 | 播放页 |
| :---: | :---: |
| <img src="https://raw.githubusercontent.com/Aliboder/dsh-music-panel/main/docs/screenshots/library-grid.webp" alt="Local library" /> | <img src="https://raw.githubusercontent.com/Aliboder/dsh-music-panel/main/docs/screenshots/now-playing-lyrics.webp" alt="Now playing" /> |

| 播放队列 | Folia 歌词舞台 |
| :---: | :---: |
| <img src="https://raw.githubusercontent.com/Aliboder/dsh-music-panel/main/docs/screenshots/queue.webp" alt="Queue" /> | <img src="https://raw.githubusercontent.com/Aliboder/dsh-music-panel/main/docs/screenshots/folia-stage.webp" alt="Folia stage" /> |

## 隐私与边界

- Cookie、token、缓存和播放记录保存在 ~/.dsh/music/；在线请求由 Host 代理。
- Navidrome 默认只保存盐化 token；勾选「保存密码，启用完整曲库」会把密码额外写入本机，请只在可信设备上使用。
- 在线平台使用非官方接口，可能失效、限流或改版；失败会在界面提示，不影响本地播放。
- Folia 的 Automix（节拍 / 分轨）引擎尚未移植，目前只有 crossfade 模式。
- 平台图标仅用于平台识别，商标归各平台所有。

## 开发

```bash
npm test
npm run check
node scripts/build-client.mjs
node scripts/build-client.mjs --check
```

Host 在 index.js + src/host/**；客户端由 src/client/** 分片构建成单文件 client.js；src/folia/** 是 Folia 的移植层。

更多： [主题与组件规范](A_other/docs/主题与组件开发规范.md) · [踩坑记录](A_other/docs/踩坑记录.md) · [发布流程](A_other/docs/发布手册.md)

## Credits

本项目**大量参考并移植了 [Folia](https://github.com/chthollyphile/folia-major)**（folia-major-main，AGPL-3.0-only）的代码：

- src/folia/**：歌词舞台、背景、逐字歌词渲染；
- src/client/utils/lyrics/**：歌词解析、staff / 副歌 / 行过滤、icu-folia 分词；
- 在线层的能力位、注册表、统一门面和失败分类参考了 Folia 的架构；
- 移植只改宿主边界（React props、播放时钟、主题、音频带、存储 / worker shim），渲染与解析尽量保持上游原样。

平台接口、AutoEQ 数据和其他第三方来源见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

## License

[AGPL-3.0-only](LICENSE) © Aliboder。  
因为包含 Folia 的 AGPL 移植代码，本项目整体保持 AGPL-3.0-only。

---

## English

**A real music player for DeepSeek Harness — local files, online providers, and your own Navidrome / Subsonic server in one queue.**

- Local library, NetEase, QQ Music, KuGou, Bodian, Qishui, Navidrome / Subsonic.
- 14 Folia lyric stages, word-level timing, translations, cover-derived themes, and dynamic backgrounds.
- Cloud playlists, recommendations, cloud drive, cache, EQ, ReplayGain-style leveling, and smart transitions.
- Private by design: cookies, cache, and history stay on your machine.

**Install:** search **dsh-music-panel** in the DSH plugin marketplace, or run **pnpm add dsh-music-panel** inside your DSH profile. Fully restart DSH afterwards.

**Credits:** the lyric stages, backgrounds, and lyric pipeline are largely ported from [Folia](https://github.com/chthollyphile/folia-major) (AGPL-3.0-only). See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

**License:** [AGPL-3.0-only](LICENSE).
