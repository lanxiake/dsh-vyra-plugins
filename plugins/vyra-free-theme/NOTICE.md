# NOTICE

dsh-vyra-free-theme — 「自由主题」DSH 插件。

## 非官方声明

本插件是第三方作品，不是 DeepSeek 官方组件，也未获得深度求索公司的背书或认可。它通过
DeepSeek Harness 公开的插件接口工作；接口变化可能导致插件暂时不可用，请以 DSH 的发行说明
为准。

## 自带主题的壁纸

`themes/` 下随包分发的壁纸**全部由本仓库的代码生成**，不包含任何第三方图片、影片或字体
素材：

| 主题 | 生成方式 | 来源 |
| --- | --- | --- |
| `ink-landscape` | `ink-wash` 配方，2048×1280 PNG | `scripts/build-theme-art.mjs` |
| `magnet` | `magnet-field` 配方，2048×1280 PNG | 同上 |
| `aurora` | `aurora-blobs` 配方，8 秒无缝循环 MP4 | 同上 |
| `liquid` | `liquid-blob` 配方，8 秒无缝循环 MP4 | 同上 |
| `nebula` | `themes/nebula/art.js` 运行时代码绘制 | 随主题分发 |

因此这些壁纸可以按本插件的 MIT 许可自由使用与再分发。你自己放进 `themes/` 的图片、视频
或代码不受本许可约束，其版权与许可由你（或原始权利人）决定。

重算全部自带壁纸：

```bash
cd plugins/vyra-free-theme
node scripts/build-theme-art.mjs
```

输出是确定性的（相同配方、种子与尺寸得到逐字节相同的文件），所以这既是重建方式，也是
校验方式。

## 动效设计的来源说明

`src/shared/art-design.js` 与 `src/shared/art-recipes-premium.js` 里的构图与运动规则
（少量柔光色团、单一主导动作、单一强调色、不回弹的缓动、闭合的循环）来自对
[nexu-io/openmotion](https://github.com/nexu-io/openmotion)（Apache-2.0）技能文档的**阅读与
归纳**，是设计原则层面的参考，不包含该项目的代码、素材或提示词原文。

## 第三方依赖

运行时没有新增依赖。构建期依赖（`esbuild`、`eslint` 等）见 `package.json` 的
`devDependencies`，各自遵循其自身许可。

## 字体

界面字体由宿主 DSH 客户端提供，本插件不分发字体文件。

## 联系方式

问题、建议或版权疑虑请通过插件的 GitHub 仓库提 issue。