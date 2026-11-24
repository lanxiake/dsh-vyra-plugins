# NOTICE — 第三方来源与许可

本插件的 `index.js`、`cordis.patch.yml`、`package.json`、README 与图标由 dsh-vyra-plugins 编写，采用 MIT 许可（见 `LICENSE`）。

`vendor/open-design/` 下的技能内容**不适用**上述 MIT 许可，它们保留各自发布时的许可。

## 上游来源

| 路径 | 内容 | 上游 |
| --- | --- | --- |
| `vendor/open-design/skills/` | 85 个工艺技能 | https://github.com/nexu-io/open-design |
| `vendor/open-design/design-system-skills/` | 152 个设计系统契约 | https://github.com/nexu-io/open-design |

上游仓库以 Apache-2.0 发布。OpenDesign 自身说明：引用品牌的设计系统包属于**美学灵感**，并非官方品牌资产。

## 逐个技能的许可

以下技能目录内含自己的许可文件，优先级高于本文件的概括描述：

- Apache-2.0：`skills/frontend-design/LICENSE.txt`（改编自 Anthropic 官方 skills 仓库）
- MIT：`skills/animate`、`skills/brandkit`、`skills/brutalist-skill`、`skills/emil-design-eng`、`skills/gpt-tasteskill`、`skills/gsap-*`（GreenSock）等
- 其余技能：见各自目录下的 `LICENSE` / `LICENSE.txt` / `references/license.md`

各技能 `SKILL.md` 的 frontmatter 里若写有 `od.upstream` 或 `upstream:`，指向该技能的原始仓库。

## 未改编说明

`vendor/open-design/` 是上游内容的**原样副本**，未做修改。二次开发请在本仓库的插件层（`index.js`、`cordis.patch.yml`）进行；若确需修改技能正文，请在该技能的许可条款下进行并保留其许可文件与归属声明。

## 版本

本副本取自本机安装的上游内容快照，共 521 个文件（技能正文、示例、参考文件与许可文件）。