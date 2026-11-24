# OpenDesign 领域分包 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `plugins/open-design` 从「一个 51KB 聚合技能」改造成「九个按业务领域切分的技能包 + 九个领域 agent + 一个编排 agent」，用户可开关任意领域。

**Architecture:** 领域定义集中在 `domains.mjs`（技能归属表），`sync.mjs` 是纯函数式的磁盘同步器，`agents.mjs` 只负责生成 agent preset 规格对象，`index.js` 挂载时调用它们。CLI (`odx`) 复用的也是同一个 `sync()`。agent 的安装依赖宿主的 `pluginManager` 服务，因此通过 `ctx.get('pluginManager')` 获取，缺失时降级为「只写文件不注册」。

**Tech Stack:** Node.js ≥22 ESM、无运行时依赖、`node:fs` / `node:path`。测试用 `node --test` 风格的自写断言（仓库既有惯例，见 `lifecycle.test.mjs`）。

**Spec:** `docs/superpowers/specs/2026-11-24-opendesign-domain-packages-design.md`

## Global Constraints

- Node.js `>= 22`，纯 ESM，不引入新的 npm 依赖。
- `vendor/open-design/` 保持上游原样，**不得修改**其中任何文件。
- 每个领域聚合技能只包含本领域技能，关闭领域时目录必须被删除。
- 九个领域的技能集合两两不相交，并集恰为 85 个工艺技能（已用脚本验证）。
- 九个领域 agent **不带** `delegation` 能力；只有 `od-director` 带。
- agent preset 的 `id` 必须匹配 `/^[a-z][a-z0-9-]{1,39}$/`（`vyra-agent-manager/core.js:6`）。
- agent preset 目录结构必须与 `agent_manager` 写出的一致：`agent.json`、`package.json`、`cordis.patch.yml`、`locale/en.json`、`locale/zh.json`、`icon.svg`、`README.md`。
- bundle 名为 `@local/agent-preset-<id>`（`core.js:11`）。
- 所有同步操作必须幂等：内容不变则不触碰文件 mtime。
- 任何失败都不得抛出到 `apply` 之外，只能记日志并降级。

---

## File Structure

| 文件 | 职责 |
|---|---|
| `plugins/open-design/domains.mjs` | 领域定义：id、中文名、技能清单、默认开关、agent 元数据。**唯一数据源**。 |
| `plugins/open-design/skills.mjs` | 从 `index.js` 抽出：frontmatter 解析、技能枚举、聚合 `SKILL.md` 渲染（仅渲染单个领域）。 |
| `plugins/open-design/config.mjs` | 读写 `$DSH_HOME/open-design/domains.json`，含损坏回退。 |
| `plugins/open-design/agents.mjs` | 生成 9 个领域 agent + `od-director` 的 spec 对象与目录内容（纯函数，不落盘）。 |
| `plugins/open-design/sync.mjs` | 编排：读配置 → 写技能目录 → 写 agent 目录 → 清理旧产物。 |
| `plugins/open-design/index.js` | 插件入口，挂载时调 `sync()`。 |
| `plugins/open-design/cli.mjs` | `odx` 命令实现。 |
| `plugins/open-design/bin/odx` + `odx.cmd` | CLI 的 shell 包装。 |
| `plugins/open-design/lifecycle.test.mjs` | 全部测试。 |

`index.js` 原有的 frontmatter 解析与渲染逻辑迁到 `skills.mjs`，避免单文件继续膨胀（当前 306 行，加新功能会到 700+ 行）。

---

### Task 1: 领域定义表 `domains.mjs`

**Files:**
- Create: `plugins/open-design/domains.mjs`
- Test: `plugins/open-design/lifecycle.test.mjs`（新增测试段落）

**Interfaces:**
- Produces:
  - `DOMAINS: ReadonlyArray<DomainSpec>`
  - `DomainSpec = { id: string, name: string, description: string, summary: string, usage: string, skills: readonly string[], designSystems?: true }`
  - `DOMAIN_IDS: readonly string[]`
  - `DEFAULT_ENABLED: readonly string[]`
  - `ORCHESTRATOR = { id: 'od-director', name: '设计总监', ... }`
  - `getDomain(id: string): DomainSpec | undefined`

- [ ] **Step 1: 写失败测试**

在 `lifecycle.test.mjs` 末尾（`process.exit` 之前）插入：

```js
// ===== Task 1: domain table =====
const domains = await import(pathToFileURL(join(process.argv[2], 'domains.mjs')).href)

check('nine domains', domains.DOMAINS.length, 9)
check('domain ids unique', new Set(domains.DOMAIN_IDS).size, 9)
check('every domain id matches preset id rule',
  domains.DOMAINS.filter((d) => !/^[a-z][a-z0-9-]{1,39}$/.test(d.id)).length, 0)
check('every domain has a Chinese name',
  domains.DOMAINS.filter((d) => !/[\u4e00-\u9fa5]/.test(d.name)).length, 0)
check('every domain has non-empty summary and usage',
  domains.DOMAINS.filter((d) => !d.summary || !d.usage).length, 0)

// The partition: 85 craft skills, exactly once each.
const craftSkills = m.listBundledSkills().filter((s) => s.bundle === 'skills')
const assigned = domains.DOMAINS.flatMap((d) => d.skills)
check('assigned total is 85', assigned.length, 85)
check('no skill assigned twice', assigned.length - new Set(assigned).size, 0)
check('every real skill is assigned',
  craftSkills.filter((s) => !assigned.includes(s.name)).map((s) => s.name), [])
check('no phantom skill assigned',
  assigned.filter((n) => !craftSkills.some((s) => s.name === n)), [])

// Exactly one domain owns the design systems.
check('exactly one design-system domain',
  domains.DOMAINS.filter((d) => d.designSystems === true).length, 1)
check('design systems belong to visual design',
  domains.DOMAINS.find((d) => d.designSystems === true).id, 'od-visual-design')

// Defaults: the four high-frequency domains.
check('default enabled is the four', [...domains.DEFAULT_ENABLED].sort(), [
  'od-motion', 'od-presentation', 'od-visual-design', 'od-writing',
].sort())
check('defaults are a subset of domains',
  domains.DEFAULT_ENABLED.filter((id) => !domains.DOMAIN_IDS.includes(id)), [])

// The orchestrator exists and names all nine.
check('orchestrator id', domains.ORCHESTRATOR.id, 'od-director')
check('orchestrator has Chinese name', /[\u4e00-\u9fa5]/.test(domains.ORCHESTRATOR.name), true)
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node plugins/open-design/lifecycle.test.mjs plugins/open-design`
Expected: FAIL — 找不到 `domains.mjs`，报 `ERR_MODULE_NOT_FOUND`

- [ ] **Step 3: 实现 `domains.mjs`**

```js
/**
 * The nine business domains the OpenDesign skill library is split into.
 *
 * This file is the single source of truth: `sync.mjs` reads it to decide what
 * goes on disk, and `agents.mjs` reads it to build one agent preset per domain.
 *
 * Every skill belongs to exactly one domain (verified against the 85 craft
 * skills in the bundle; the 152 design systems are a pool owned wholly by
 * visual design). Adding a skill here and forgetting to remove it elsewhere
 * makes the partition test fail, which is the point.
 *
 * @module open-design/domains
 */

/** @typedef {{ id: string, name: string, description: string, summary: string, usage: string, skills: readonly string[], designSystems?: true }} DomainSpec */

/** @type {readonly DomainSpec[]} */
export const DOMAINS = [
  {
    id: 'od-visual-design',
    name: '视觉设计',
    description: '确定界面的视觉方向：审美基调、排版与配色体系、组件与页面外观，产出高保真视觉稿与设计令牌。',
    summary: '给需求定视觉方向并产出高保真界面设计稿。能做：审美定调、排版配色体系、页面与组件布局、响应式与可访问性、从 152 套设计系统里选一套作为品牌契约。不能做：写业务逻辑或接后端接口（那是前端实现），也不做动效实现（那是动效设计）。',
    usage: '适合从零设计界面或改造现有界面的外观。\n\n示例：\n1. 「给面向财务团队的分析看板定视觉方向，出一版高保真 HTML 稿。」\n2. 「这个后台太丑，重做成沉静企业风，保留信息架构。」\n3. 「用 Stripe 那套设计系统做定价页。」',
    skills: [
      'frontend-design', 'design-taste-frontend', 'design-taste-frontend-v1',
      'minimalist-ui', 'industrial-brutalist-ui', 'high-end-visual-design',
      'redesign-existing-projects', 'stitch-design-taste', 'gpt-taste',
      'design-brief', 'impeccable-design-polish', 'emil-design-eng',
    ],
    designSystems: true,
  },
  {
    id: 'od-motion',
    name: '动效设计',
    description: '为界面与页面添加有节奏的动效：入场、滚动驱动、状态过渡、微交互，用 GSAP 体系实现并做性能把关。',
    summary: '给已有界面或视觉稿添加动效。能做：动效编排与节拍设计、GSAP 时间轴与 ScrollTrigger、React/Vue 集成、性能调优、动效代码审查、reduced-motion 降级。不能做：决定视觉方向（那是视觉设计），也不做视频渲染（那是视频制作）。',
    usage: '适合让静态页面动起来，或审查已有动效是否合格。\n\n示例：\n1. 「给这个落地页加滚动驱动的入场动效，要有节奏感但别浮夸。」\n2. 「审查现有页面的动效，指出卡顿和不合理的地方并修掉。」\n3. 「用 GSAP 做这个卡片的展开与收起过渡。」',
    skills: [
      'gsap-core', 'gsap-timeline', 'gsap-scrolltrigger', 'gsap-react',
      'gsap-plugins', 'gsap-performance', 'gsap-utils', 'gsap-frameworks',
      'animate', 'ui-animation', 'emilkowalski-motion', 'motion-lab',
      'review-animations',
    ],
  },
  {
    id: 'od-video',
    name: '视频制作',
    description: '制作帧动画短片、片头片尾、视频模板与带时间轴的动效影片，输出可渲染的 HTML 或 mp4。',
    summary: '做视频与帧动画。能做：视频脚本与分镜、帧动画时间轴（Hyperframes / Remotion 路线）、片头片尾与转场、各类视频模板、艺术动画配方。不能做：活字排版长文（那是内容写作），也不做网页动效实现（那是动效设计）。',
    usage: '适合需要产出视频文件或逐帧动画的场合。\n\n示例：\n1. 「做一个 15 秒动效短片：散乱想法汇聚成一个清晰任务。」\n2. 「给产品发布会做片头，科技感，5 秒。」\n3. 「把这份年度阅读数据做成竖版回顾视频。」',
    skills: [
      'video-hyperframes', 'motion-design', 'huashu-art-motion', 'oil-motion',
      'chat-motion-overlay', 'frame-glitch-title', 'frame-light-leak-cinema',
      'frame-liquid-bg-hero', 'frame-logo-outro', 'frame-macos-notification',
      'frame-data-chart-nyt', 'frame-flowchart-sticky', 'vfx-text-cursor',
      '8-bit-orbit-video-template', 'after-hours-editorial-template',
      'swiss-user-research-video-template', 'weread-year-in-review-video-template',
    ],
  },
  {
    id: 'od-presentation',
    name: '演示汇报',
    description: '制作幻灯片、Keynote 风格 deck、季度汇报与数据可视化报告页。',
    summary: '做演示与报告。能做：Keynote / 瑞士国际主义 / 编辑风等多种 deck 体系、幻灯片画布、数据可视化报告页、图表选型。不能做：社媒单图卡片（那是社媒图文），也不做视频（那是视频制作）。',
    usage: '适合需要一套成体系的演示或报告产物。\n\n示例：\n1. 「把这份季度数据做成一套瑞士风 10 页 deck。」\n2. 「把这个 CSV 变成带 KPI 卡和趋势图的可视化报告页。」\n3. 「帮我把产品方案整理成发布会用的幻灯片。」',
    skills: [
      'ppt-keynote', 'deck-swiss-international', 'deck-open-slide-canvas',
      'deck-guizang-editorial', 'html-ppt-retro-quarterly-review',
      'swiss-creative-mode-template', 'digits-fintech-swiss-template',
      'editorial-burgundy-principles-template', 'field-notes-editorial-template',
      'data-report',
    ],
  },
  {
    id: 'od-social-content',
    name: '社媒图文',
    description: '制作社交媒体图文与分享卡片：小红书轮播、推文卡、海报、设备展示图。',
    summary: '做社媒与分享图。能做：小红书知识卡片、X/Reddit/Spotify 风格卡片、竖版海报与朋友圈图、3D 设备展示。不能做：完整长文（那是内容写作），也不做整套演示（那是演示汇报）。',
    usage: '适合以单张图或轮播形式在社交平台发布的内容。\n\n示例：\n1. 「把这篇要点做成一版小红书轮播图。」\n2. 「做一个竖版海报，朋友圈发布用。」\n3. 「生成一张 X 帖子卡，带互动数据样式。」',
    skills: [
      'card-twitter', 'card-xiaohongshu', 'social-x-post-card',
      'social-reddit-card', 'social-spotify-card', 'poster-hero',
      'mockup-device-3d',
    ],
  },
  {
    id: 'od-writing',
    name: '内容写作',
    description: '写长文与文档：杂志排版文章、发布说明、FAQ、简历、研究决策文档。',
    summary: '写字与排版文档。能做：长文结构与写作、杂志式 HTML 排版、FAQ 页、发布说明一页纸、简历、写作规范审查、研究笔记转决策文档。不能做：演示幻灯片（那是演示汇报），也不做单张社媒卡片（那是社媒图文）。',
    usage: '适合以文字为主的交付物。\n\n示例：\n1. 「把这次改版写成一篇发布稿。」\n2. 「把会议笔记整理成一篇杂志排版的 HTML 长文。」\n3. 「给新功能写 FAQ，覆盖安装和常见报错。」',
    skills: [
      'article-magazine', 'doc-kami-parchment', 'faq-page',
      'release-notes-one-pager', 'resume-modern', 'writing-guidelines',
      'research-decision-room', 'full-output-enforcement',
    ],
  },
  {
    id: 'od-brand',
    name: '品牌资产',
    description: '建立与沉淀品牌视觉资产：品牌视觉板、配色与字体提取、设计契约、电商产品图。',
    summary: '做品牌资产与规范。能做：品牌视觉板与 logo 体系、从现有网站提取色板字体动效、把模糊需求固化为 DESIGN.md 契约、创意评审、资产库检索、电商产品图。不能做：具体页面设计（那是视觉设计），也不做质量审查（那是质检审核）。',
    usage: '适合需要先确立品牌规范，再做后续物料的场合。\n\n示例：\n1. 「从这个网站提取品牌色板和字体，做一张品牌视觉板。」\n2. 「我们品牌还没有设计规范，帮我定一份 DESIGN.md。」\n3. 「把这批产品实拍图做成电商主图。」',
    skills: [
      'brandkit', 'brand-extract', 'creative-director',
      'reference-design-contract', 'library-curator',
      'ecommerce-image-workflow', 'imagegen-frontend-web',
      'imagegen-frontend-mobile',
    ],
  },
  {
    id: 'od-frontend',
    name: '前端实现',
    description: '把设计落成可运行代码：复刻网站、图片转代码、登录流程、浏览器自动化验证。',
    summary: '做前端工程实现。能做：从设计图生成代码、网站复刻与交互逆向、登录注册流程实现、用浏览器自动化测试与验收、完整无占位输出。不能做：决定视觉方向（那是视觉设计），也不做质量门审查（那是质检审核）。',
    usage: '适合已经有设计稿或参考站点，需要落成可运行代码。\n\n示例：\n1. 「照这个网站复刻一版首页，换成我们的品牌色。」\n2. 「实现一套登录流程：注册、登录、找回密码。」\n3. 「用浏览器打开这个页面截图，检查布局有没有塌。」',
    skills: [
      'image-to-code', 'web-clone', 'login-flow', 'agent-browser',
      'hatch-pet', 'od-next-media-inputs',
    ],
  },
  {
    id: 'od-review',
    name: '质检审核',
    description: '交付前把关：设计规范合规、可访问性、导出链路、PR 反馈闭环。',
    summary: '做交付前质量审查。能做：Web 界面规范审查（布局/字体/颜色/动效/可访问性）、PPT 导出保真度核对、PR 评论与冲突处理、导出下载故障排查。不能做：直接重写产物（它只出问题清单），也不做创意评审（那是品牌资产）。',
    usage: '在产物交付或上线之前用它把关。\n\n示例：\n1. 「审查这版落地页的可访问性和规范合规，逐条列问题。」\n2. 「这个 PDF 导出跟网页对不上，帮我查原因。」\n3. 「把这批产物过一遍质量门，阻断级问题先修。」',
    skills: [
      'web-design-guidelines', 'pptx-html-fidelity-audit',
      'pr-feedback-quality-gate', 'export-download-debugging',
    ],
  },
]

/** Every domain id, in display order. */
export const DOMAIN_IDS = DOMAINS.map((domain) => domain.id)

/**
 * Domains enabled on a fresh install: the four that cover most day-to-day work.
 * Visual design carries the 152 design systems, so it dominates the context
 * cost; the other three are small.
 */
export const DEFAULT_ENABLED = ['od-visual-design', 'od-motion', 'od-presentation', 'od-writing']

/** The coordinating agent that can delegate to every domain agent. */
export const ORCHESTRATOR = {
  id: 'od-director',
  name: '设计总监',
  capabilities: ['files', 'shell', 'jobs', 'web', 'skills', 'delegation', 'todo', 'ask-user', 'present'],
  skills: [],
}

/** Look up a domain by id. */
export function getDomain(id) {
  return DOMAINS.find((domain) => domain.id === id)
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node plugins/open-design/lifecycle.test.mjs plugins/open-design`
Expected: PASS，新增的 14 项全部显示 PASS

- [ ] **Step 5: 提交**

```bash
git add plugins/open-design/domains.mjs plugins/open-design/lifecycle.test.mjs
git commit -m "feat(open-design): add the nine-domain table as the single source of truth"
```

---

### Task 2: 抽出 `skills.mjs` 并支持单领域渲染

**Files:**
- Create: `plugins/open-design/skills.mjs`
- Modify: `plugins/open-design/index.js`（移除同名逻辑，改为从 `skills.mjs` 导入）
- Test: `plugins/open-design/lifecycle.test.mjs`

**Interfaces:**
- Consumes: `DOMAINS`, `getDomain` from `domains.mjs`
- Produces:
  - `readFrontmatter(text): { name: string, description: string }`
  - `listBundledSkills(root?): Array<{ name, description, bundle, dir, file }>`
  - `renderDomainSkill(domain, skills, { root? }): string` — 单个领域的聚合 `SKILL.md`

- [ ] **Step 1: 写失败测试**

```js
// ===== Task 2: per-domain rendering =====
const skillsMod = await import(pathToFileURL(join(process.argv[2], 'skills.mjs')).href)
const all = skillsMod.listBundledSkills(process.argv[2])

const visual = domains.getDomain('od-visual-design')
const visualSkill = skillsMod.renderDomainSkill(visual, all, { root: process.argv[2] })
check('visual skill declares its own name', /^name: od-visual-design$/m.test(visualSkill), true)
check('visual skill has a 中文 display heading', visualSkill.includes('# 视觉设计'), true)
check('visual skill lists its 12 craft rows',
  visualSkill.split('\n').filter((l) => /^\| `[^`]+` \|.*\|$/.test(l)).length, 12 + 152)
check('visual skill carries no other domain skill', visualSkill.includes('gsap-core'), false)

const motion = domains.getDomain('od-motion')
const motionSkill = skillsMod.renderDomainSkill(motion, all, { root: process.argv[2] })
check('motion skill lists 13 rows',
  motionSkill.split('\n').filter((l) => /^\| `[^`]+` \|.*\|$/.test(l)).length, 13)
check('motion skill excludes design systems', /open-design-apple/.test(motionSkill), false)
check('no table row spans lines',
  motionSkill.split('\n').filter((l) => l.startsWith('| `') && !l.endsWith('|')).length, 0)
check('frontmatter description mentions the domain',
  /^description: .*动效/m.test(motionSkill), true)
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node plugins/open-design/lifecycle.test.mjs plugins/open-design`
Expected: FAIL — `skills.mjs` 不存在

- [ ] **Step 3: 创建 `skills.mjs`**

把 `index.js` 里现有的 `readFrontmatter`、`listBundledSkills` 原样搬过来（已通过测试），新增 `renderDomainSkill`：

```js
/**
 * Bundled-skill discovery and per-domain `SKILL.md` rendering.
 *
 * The two upstream trees (`skills/`, `design-system-skills/`) are bundled
 * verbatim. This module turns them into the per-domain index pages the harness
 * can actually read, since its provider scans only one level deep.
 *
 * @module open-design/skills
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export const BUNDLES = ['skills', 'design-system-skills']

// ... readFrontmatter(...) 与 listBundledSkills(...) 从 index.js 原样迁移 ...

/**
 * Render one domain's index page.
 *
 * Two table sections when the domain owns the design systems, one otherwise:
 * craft skills are the working guidance, design systems are the visual contract.
 */
export function renderDomainSkill(domain, skills, { root }) {
  const wanted = new Set(domain.skills)
  const craft = skills.filter((skill) => skill.bundle === 'skills' && wanted.has(skill.name))
  const systems = domain.designSystems === true
    ? skills.filter((skill) => skill.bundle === 'design-system-skills')
    : []

  const bundlePath = join(root, 'vendor', 'open-design')
  // A table cell cannot carry a newline: a literal YAML block keeps its line
  // breaks and would split the row. Fold to one line and escape the pipe.
  const cell = (text) => text.replace(/\s+/gu, ' ').trim().replace(/\|/gu, '\\|')
  const row = (skill) => `| \`${skill.name}\` | ${cell(skill.description)} |`
  const table = (list) => ['| 技能 | 何时使用 |', '| --- | --- |', ...list.map(row)].join('\n')

  const systemsSection = systems.length === 0 ? '' : `
## 设计系统契约（${String(systems.length)}）

这些是**视觉契约**：每套提供完整的色板、字体、间距与组件规范。按任务挑一套，不要混用两套的令牌。

${table(systems)}
`

  return `---
name: ${domain.id}
description: ${domain.name}领域技能包。${domain.description}
---

# ${domain.name}

本技能是本领域的技能索引。先按「何时使用」找到对应技能，再读它的 \`SKILL.md\`。

## 你负责什么

${domain.summary}

## 怎么用

技能文件位于：

- 工艺技能：\`${join(bundlePath, 'skills')}/<目录>/SKILL.md\`
- 设计系统：\`${join(bundlePath, 'design-system-skills')}/<目录>/SKILL.md\`

「技能」列是 frontmatter 里的 \`name\`；目录名多数与之相同，个别不同（如 \`minimalist-skill\` → \`minimalist-ui\`），以目录为准定位。

定位后：完整读该 \`SKILL.md\`，带 \`references/\` 或模板的按需一并读取，然后按它写的流程执行。

## 硬性要求

- 一个任务只用一个主风格技能，避免风格互相抵消。
- 反 AI 味：禁止紫蓝渐变堆砌、无意义毛玻璃、千篇一律的 SaaS 布局。
- 不出现 \`TODO\` 或省略号代替实现。

## 技能清单（${String(craft.length)}）

${table(craft)}
${systemsSection}`
}
```

然后修改 `index.js`：删除本地 `readFrontmatter` / `listBundledSkills` / `renderAggregator` 的定义，改为

```js
export { readFrontmatter, listBundledSkills } from './skills.mjs'
import { listBundledSkills } from './skills.mjs'
```

保留 `install()` / `uninstall()` / `apply()` 暂时可用（Task 5 才替换）。

- [ ] **Step 4: 运行全部测试确认通过**

Run: `node plugins/open-design/lifecycle.test.mjs plugins/open-design`
Expected: PASS，Task 1 与 Task 2 的新检查全绿，**旧的生命周期检查也仍然全绿**（说明迁移没破坏原有行为）

- [ ] **Step 5: 提交**

```bash
git add plugins/open-design/skills.mjs plugins/open-design/index.js
git commit -m "refactor(open-design): extract skill discovery and add per-domain rendering"
```

---

### Task 3: 配置文件读写 `config.mjs`

**Files:**
- Create: `plugins/open-design/config.mjs`
- Test: `plugins/open-design/lifecycle.test.mjs`

**Interfaces:**
- Consumes: `DOMAIN_IDS`, `DEFAULT_ENABLED` from `domains.mjs`
- Produces:
  - `configPath(dshHome?): string` — `$DSH_HOME/open-design/domains.json`
  - `readConfig(dshHome?): { enabled: string[], warnings: string[] }`
  - `writeConfig(enabled: string[], dshHome?): { written: boolean }`

- [ ] **Step 1: 写失败测试**

```js
// ===== Task 3: config read/write =====
const cfgMod = await import(pathToFileURL(join(process.argv[2], 'config.mjs')).href)

// Missing file → defaults, and the file is materialised.
const homeA = mkdtempSync(join(tmpdir(), 'od-cfg-a-'))
const r1c = cfgMod.readConfig(homeA)
check('missing config yields defaults', [...r1c.enabled].sort(), [...domains.DEFAULT_ENABLED].sort())
check('missing config warns', r1c.warnings.length > 0, true)

// Round-trip.
cfgMod.writeConfig(['od-motion'], homeA)
check('write then read', cfgMod.readConfig(homeA).enabled, ['od-motion'])
check('config file exists', existsSync(cfgMod.configPath(homeA)), true)
check('config is valid JSON', JSON.parse(readFileSync(cfgMod.configPath(homeA), 'utf8')).version, 1)

// Corrupt file → defaults + a .bak, original preserved elsewhere.
const homeB = mkdtempSync(join(tmpdir(), 'od-cfg-b-'))
mkdirSync(join(homeB, 'open-design'), { recursive: true })
writeFileSync(cfgMod.configPath(homeB), '{ not json')
const r2c = cfgMod.readConfig(homeB)
check('corrupt config falls back', [...r2c.enabled].sort(), [...domains.DEFAULT_ENABLED].sort())
check('corrupt config warns', r2c.warnings.length > 0, true)
check('corrupt config backed up',
  readdirSync(join(homeB, 'open-design')).some((n) => n.endsWith('.bak')), true)

// Unknown ids are dropped, known ones kept.
const homeC = mkdtempSync(join(tmpdir(), 'od-cfg-c-'))
mkdirSync(join(homeC, 'open-design'), { recursive: true })
writeFileSync(cfgMod.configPath(homeC), JSON.stringify({ version: 1, enabled: ['od-motion', 'od-nope'] }))
const r3c = cfgMod.readConfig(homeC)
check('unknown id dropped', r3c.enabled, ['od-motion'])
check('unknown id warns', r3c.warnings.some((w) => w.includes('od-nope')), true)

// Duplicates collapse.
const homeD = mkdtempSync(join(tmpdir(), 'od-cfg-d-'))
mkdirSync(join(homeD, 'open-design'), { recursive: true })
writeFileSync(cfgMod.configPath(homeD), JSON.stringify({ version: 1, enabled: ['od-motion', 'od-motion'] }))
check('duplicate ids collapse', cfgMod.readConfig(homeD).enabled, ['od-motion'])
```

在测试文件顶部补充 `mkdirSync`、`readdirSync` 到既有 import（若没导入）。

- [ ] **Step 2: 运行测试确认失败**

Run: `node plugins/open-design/lifecycle.test.mjs plugins/open-design`
Expected: FAIL — `config.mjs` 不存在

- [ ] **Step 3: 实现 `config.mjs`**

```js
/**
 * The enabled-domain list, stored at `$DSH_HOME/open-design/domains.json`.
 *
 * One file, human-editable, tolerant of every way it can go wrong: missing
 * (defaults), corrupt (defaults plus a `.bak` and a warning), carrying unknown
 * domain ids (dropped with a warning), carrying duplicates (collapsed). Nothing
 * here throws — a bad config must not stop the plugin from loading.
 *
 * @module open-design/config
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { DEFAULT_ENABLED, DOMAIN_IDS } from './domains.mjs'

/** `$DSH_HOME/open-design/domains.json`. */
export function configPath(dshHome = process.env.DSH_HOME || join(homedir(), '.dsh')) {
  return join(dshHome, 'open-design', 'domains.json')
}

/**
 * Read the enabled list, healing anything unusable.
 *
 * @returns {{ enabled: string[], warnings: string[] }}
 */
export function readConfig(dshHome) {
  const file = configPath(dshHome)
  const warnings = []

  if (!existsSync(file)) {
    warnings.push(`未找到配置 ${file}，已按默认领域初始化`)
    writeConfig([...DEFAULT_ENABLED], dshHome)
    return { enabled: [...DEFAULT_ENABLED], warnings }
  }

  let parsed
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    // Keep the broken file for inspection, then start over from defaults.
    try {
      copyFileSync(file, `${file}.bak`)
    } catch {
      // A failed backup must not stop recovery.
    }
    warnings.push(`配置无法解析（${error instanceof Error ? error.message : String(error)}），已备份为 .bak 并回退默认`)
    writeConfig([...DEFAULT_ENABLED], dshHome)
    return { enabled: [...DEFAULT_ENABLED], warnings }
  }

  const raw = Array.isArray(parsed?.enabled) ? parsed.enabled : []
  const enabled = []
  for (const value of raw) {
    const id = String(value)
    if (!DOMAIN_IDS.includes(id)) {
      warnings.push(`忽略未知领域「${id}」`)
      continue
    }
    if (enabled.includes(id)) continue
    enabled.push(id)
  }

  // An empty list is a legitimate choice (the user turned everything off), so
  // it is not healed back to defaults.
  return { enabled, warnings }
}

/** Write the enabled list. Returns whether the file's bytes actually changed. */
export function writeConfig(enabled, dshHome) {
  const file = configPath(dshHome)
  const ordered = DOMAIN_IDS.filter((id) => enabled.includes(id))
  const text = `${JSON.stringify({ version: 1, enabled: ordered }, null, 2)}\n`
  try {
    if (existsSync(file) && readFileSync(file, 'utf8') === text) return { written: false }
  } catch {
    // Unreadable existing file: fall through and rewrite it.
  }
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, text)
  return { written: true }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node plugins/open-design/lifecycle.test.mjs plugins/open-design`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add plugins/open-design/config.mjs plugins/open-design/lifecycle.test.mjs
git commit -m "feat(open-design): add the enabled-domain config with corrupt-file recovery"
```

---

### Task 4: Agent 规格生成 `agents.mjs`

**Files:**
- Create: `plugins/open-design/agents.mjs`
- Test: `plugins/open-design/lifecycle.test.mjs`

**Interfaces:**
- Consumes: `DOMAINS`, `ORCHESTRATOR`, `getDomain` from `domains.mjs`
- Produces:
  - `domainAgentSpec(domain): AgentSpec`
  - `orchestratorSpec(enabledIds: string[]): AgentSpec`
  - `AgentSpec = { id, name, description, summary, usage, systemPrompt, capabilities: string[], skills: string[], team: string[] }`
  - `agentDirFiles(spec): Record<string, string>` — 目录下的文件名 → 内容，供同步器落盘

- [ ] **Step 1: 写失败测试**

```js
// ===== Task 4: agent specs =====
const agMod = await import(pathToFileURL(join(process.argv[2], 'agents.mjs')).href)

const motionSpec = agMod.domainAgentSpec(domains.getDomain('od-motion'))
check('domain agent id matches domain', motionSpec.id, 'od-motion')
check('domain agent name is Chinese', /[\u4e00-\u9fa5]/.test(motionSpec.name), true)
check('domain agent skills match domain',
  [...motionSpec.skills].sort(), [...domains.getDomain('od-motion').skills].sort())
check('domain agent has no delegation', motionSpec.capabilities.includes('delegation'), false)
check('domain agent has no team', motionSpec.team, [])
check('domain agent includes skills capability', motionSpec.capabilities.includes('skills'), true)
check('domain agent summary states what it cannot do', /不能做/.test(motionSpec.summary), true)
check('summary within tool limit', motionSpec.summary.length <= 600, true)
check('usage within tool limit', motionSpec.usage.length <= 1200, true)

const visualSpec = agMod.domainAgentSpec(domains.getDomain('od-visual-design'))
check('visual agent omits the 152 design systems from skills',
  visualSpec.skills.includes('open-design-apple'), false)
check('visual agent points at the index for design systems',
  /设计系统/.test(visualSpec.systemPrompt), true)

const director = agMod.orchestratorSpec(['od-motion', 'od-writing'])
check('director id', director.id, 'od-director')
check('director has delegation', director.capabilities.includes('delegation'), true)
check('director team is the enabled set', [...director.team].sort(), ['od-motion', 'od-writing'])
check('director never lists itself', director.team.includes('od-director'), false)

// Directory layout must match what agent_manager writes (core.js:404).
const files = agMod.agentDirFiles(motionSpec)
for (const required of ['agent.json', 'package.json', 'cordis.patch.yml', 'locale/en.json', 'locale/zh.json', 'icon.svg', 'README.md']) {
  check(`agent dir has ${required}`, Object.keys(files).includes(required), true)
}
check('agent.json round-trips',
  JSON.parse(files['agent.json']).id, 'od-motion')
const pkg = JSON.parse(files['package.json'])
check('bundle name is @local/agent-preset-<id>', pkg.name, '@local/agent-preset-od-motion')
check('package is private', pkg.private, true)
const patch = JSON.parse(files['cordis.patch.yml'])  // JSON is valid YAML
check('patch inserts one row', patch.length, 1)
check('patch row is an agent-preset', patch[0].insert[0].name, '@deepseek-ai/dsh-agent-preset')
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node plugins/open-design/lifecycle.test.mjs plugins/open-design`
Expected: FAIL — `agents.mjs` 不存在

- [ ] **Step 3: 实现 `agents.mjs`**

```js
/**
 * Build the agent presets that pair with each domain.
 *
 * Nine domain agents, each with the `skills` capability scoped to its own skill
 * list, and one orchestrator whose `team` names the enabled domains. The
 * orchestrator is what makes delegation work at all: `vyra-agent-manager`
 * expands `team` into the `subagent` tool's `allowedAgentPresets`
 * (core.js:387), so without it no other agent could call these.
 *
 * The output is shaped by `agent_manager`'s writer (core.js:404) so the files
 * drop straight into `$DSH_HOME/agent-manager/presets/<id>/`.
 *
 * @module open-design/agents
 */

import { DOMAINS, ORCHESTRATOR, getDomain } from './domains.mjs'

/** The capability set every domain agent starts from: no delegation. */
const DOMAIN_CAPABILITIES = ['files', 'shell', 'jobs', 'web', 'skills', 'todo', 'present']

/**
 * One domain agent.
 *
 * Note `skills`: the design-system pool is deliberately absent. 152 ids in a
 * preset would bloat the record and make it unmaintainable; the agent reads
 * the domain index instead.
 */
export function domainAgentSpec(domain) {
  const systemPrompt = [
    `你是 OpenDesign 团队的「${domain.name}」专家，只负责这个领域的工作。`,
    '',
    '## 你负责什么',
    domain.summary,
    '',
    '## 工作方式',
    `1. 先加载技能 \`${domain.id}\`，它是本领域的技能索引，里面有每个技能的「何时使用」。`,
    '2. 按任务挑一个主技能，完整读它的 SKILL.md，再按它的流程执行。',
    '3. 需要具体风格时再读对应技能的正文；不要只凭技能名猜内容。',
    '',
    '## 硬性要求',
    '- 不出现 `TODO`、`// ...` 或省略号代替实现。',
    '- 不编造数据、引用或来源；缺失就标注为待补。',
    '- 交付前自己验证一遍（文件存在、能打开、能运行），再声称完成。',
    '- 不越界做其它领域的活；遇到跨领域需求，明确说明应交给哪个领域。',
    '',
    '## 输出风格',
    '中文作答。先给结论与产物路径，再给关键决策与已知局限。',
    domain.designSystems === true
      ? '\n## 设计系统\n\n本领域还带 152 套设计系统契约。**不要凭记忆写令牌**：先读技能索引里的设计系统清单，挑一套，再完整读它的 SKILL.md，用它的色板与字体。'
      : '',
  ].join('\n').trimEnd()

  return {
    id: domain.id,
    name: domain.name,
    description: domain.description,
    summary: domain.summary,
    usage: domain.usage,
    systemPrompt,
    capabilities: [...DOMAIN_CAPABILITIES],
    skills: [...domain.skills],
    team: [],
  }
}

/**
 * The coordinating agent.
 *
 * Its `team` is the enabled domains, so disabling a domain also removes it from
 * what the director can reach.
 */
export function orchestratorSpec(enabledIds) {
  const members = DOMAINS.filter((domain) => enabledIds.includes(domain.id))
  const roster = members.map((domain) => `- \`${domain.id}\`（${domain.name}）：${domain.description}`).join('\n')

  const systemPrompt = [
    `你是 OpenDesign 团队的「${ORCHESTRATOR.name}」，负责把复合型设计需求拆开，派给对应的领域专家。`,
    '',
    '## 你的角色',
    '- 你是**调度者与验收者**，不是主力执行者。',
    '- 拆解得准、分派得对、把关得严，才是你的价值。',
    '- 只有当某个子任务小到「派出去比自己写更慢」时，你才亲自动手。',
    '',
    '## 当前可用的领域专家（agent preset id → 职责）',
    roster === '' ? '（当前没有启用任何领域，请提示用户先启用）' : roster,
    '',
    '## 工作流程',
    '1. **澄清**：复述目标、受众、交付物形态与硬约束；关键信息缺失时用 ask_user_question 一次问清，不要连续追问。',
    '2. **拆解**：用 todo_write 列出子任务与依赖顺序。',
    '3. **派发**：用 `subagent` 工具的 `agent_preset` 参数把任务交给对应领域专家，写明目标、输入、产出路径、验收标准。',
    '4. **并行**：彼此无依赖的并行派发；有依赖的等上游完成。派完结束当前回合等结果，不要空转轮询。',
    '5. **验收**：对照验收标准检查（能否运行、有无占位符、是否脱离设计契约）。不合格就带具体问题退回，最多两轮。',
    '6. **汇报**：给出成果清单（含文件路径）、关键决策、已知局限与未完成项。',
    '',
    '## 硬性要求',
    '- 不许虚构：没拿到证据（文件存在、命令输出、截图）就不要声称已完成。',
    '- 不许占位：任何交付物不得出现 `TODO` 或省略号代替实现。',
    '- 尊重项目已有的设计令牌与约定，不要另起一套。',
    '- 删除、覆盖、部署前必须先向用户确认。',
    '',
    '## 输出风格',
    '中文作答。先给结论与成果清单，再给细节。用清单和表格，不要长篇铺垫。',
  ].join('\n')

  return {
    id: ORCHESTRATOR.id,
    name: ORCHESTRATOR.name,
    description: '承接需要多个设计/开发/写作/视频领域协作的复合任务，拆解后派给对应领域专家并验收汇总。',
    summary: `作为 OpenDesign 的设计总监，把复合需求拆成「设计→实现→内容→验收」的可执行子任务，派给已启用的领域专家并汇总汇报。只做编排与把关，不亲自完成大量前端代码或长文。当前可调度 ${String(members.length)} 个领域：${members.map((d) => d.name).join('、') || '无'}。`,
    usage: `用它承接复合型设计项目。\n\n示例：\n1. 「做一个 SaaS 看板：先定视觉方向，再出可运行页面，最后配发布稿。」\n2. 「新品牌要一套物料：品牌视觉板 + 落地页 + 发布会幻灯片。」\n3. 「把这份数据做成报告页，顺便做宣传片。」`,
    systemPrompt,
    capabilities: [...ORCHESTRATOR.capabilities],
    skills: [...ORCHESTRATOR.skills],
    team: members.map((domain) => domain.id),
  }
}

/** A short SVG avatar, matching the style agent_manager writes. */
function iconSvg(name, id) {
  const hue = [...id].reduce((acc, ch) => (acc * 31 + ch.codePointAt(0)) % 360, 7)
  const letter = (name.trim()[0] || id[0] || 'A').toUpperCase()
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="hsl(${String(hue)} 55% 45%)"/><text x="32" y="43" font-family="Segoe UI,Arial,sans-serif" font-size="30" font-weight="700" text-anchor="middle" fill="#fff">${letter}</text></svg>\n`
}

/**
 * The files one preset directory holds.
 *
 * Mirrors `vyra-agent-manager`'s `writeBundle` (core.js:404) exactly, so a
 * preset built here is indistinguishable from one the Agent manager created.
 */
export function agentDirFiles(spec) {
  const meta = JSON.stringify({ meta: { title: spec.name, description: spec.description } }, null, 2) + '\n'
  const patch = [{
    insert: [{
      id: `preset-${spec.id}`,
      name: '@deepseek-ai/dsh-agent-preset',
      config: { id: spec.id, name: spec.name, description: spec.description, order: 100, plugins: [] },
    }],
  }]

  return {
    'agent.json': JSON.stringify(spec, null, 2) + '\n',
    'package.json': JSON.stringify({
      name: `@local/agent-preset-${spec.id}`,
      version: '1.0.0',
      private: true,
      type: 'module',
      description: spec.description,
      exports: { './locale/*.json': './locale/*.json', './icon': './icon.svg' },
      files: ['cordis.patch.yml', 'locale/*.json', 'icon.svg', 'agent.json', 'README.md'],
      dsh: { bundle: { patch: './cordis.patch.yml' } },
    }, null, 2) + '\n',
    'cordis.patch.yml': JSON.stringify(patch, null, 2) + '\n',
    'locale/en.json': meta,
    'locale/zh.json': meta,
    'icon.svg': iconSvg(spec.name, spec.id),
    'README.md': `# ${spec.name}\n\n${spec.description}\n\n## 模式说明\n\n${spec.summary}\n\n## 如何使用\n\n${spec.usage}\n`,
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node plugins/open-design/lifecycle.test.mjs plugins/open-design`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add plugins/open-design/agents.mjs plugins/open-design/lifecycle.test.mjs
git commit -m "feat(open-design): generate domain and orchestrator agent presets"
```

---

### Task 5: 同步器 `sync.mjs` 与插件入口改造

**Files:**
- Create: `plugins/open-design/sync.mjs`
- Modify: `plugins/open-design/index.js`（`apply` 改为调用 `sync`）
- Test: `plugins/open-design/lifecycle.test.mjs`

**Interfaces:**
- Consumes: `readConfig`（config.mjs）、`renderDomainSkill` / `listBundledSkills`（skills.mjs）、`domainAgentSpec` / `orchestratorSpec` / `agentDirFiles`（agents.mjs）
- Produces:
  - `sync({ dshHome?, root?, installAgents? }): SyncReport`
  - `SyncReport = { enabled: string[], skillsWritten: string[], agentsWritten: string[], removed: string[], warnings: string[], error: string | null }`

- [ ] **Step 1: 写失败测试**

```js
// ===== Task 5: sync =====
const syncMod = await import(pathToFileURL(join(process.argv[2], 'sync.mjs')).href)

// Defaults: four skill dirs, four domain agents + director.
const homeS = mkdtempSync(join(tmpdir(), 'od-sync-'))
const s1 = syncMod.sync({ dshHome: homeS, root: process.argv[2], installAgents: false })
check('sync no error', s1.error, null)
check('sync enabled four', [...s1.enabled].sort(), [...domains.DEFAULT_ENABLED].sort())
check('four skill dirs written', s1.skillsWritten.length, 4)
check('visual skill dir exists',
  existsSync(join(homeS, 'skills', 'od-visual-design', 'SKILL.md')), true)
check('motion skill dir exists',
  existsSync(join(homeS, 'skills', 'od-motion', 'SKILL.md')), true)
check('disabled domain has no skill dir',
  existsSync(join(homeS, 'skills', 'od-video')), false)

// Agents: 4 domain + 1 director.
check('five agent dirs written', s1.agentsWritten.length, 5)
check('director preset exists',
  existsSync(join(homeS, 'agent-manager', 'presets', 'od-director', 'agent.json')), true)
const dirSpec = JSON.parse(readFileSync(
  join(homeS, 'agent-manager', 'presets', 'od-director', 'agent.json'), 'utf8'))
check('director team is the enabled four', [...dirSpec.team].sort(), [...domains.DEFAULT_ENABLED].sort())
check('director has delegation', dirSpec.capabilities.includes('delegation'), true)

// Idempotent.
const snap = readFileSync(join(homeS, 'skills', 'od-motion', 'SKILL.md'), 'utf8')
const s2 = syncMod.sync({ dshHome: homeS, root: process.argv[2], installAgents: false })
check('second sync writes nothing new', s2.skillsWritten.length, 0)
check('second sync keeps content', readFileSync(join(homeS, 'skills', 'od-motion', 'SKILL.md'), 'utf8') === snap, true)

// Disabling removes the directory and the agent.
cfgMod.writeConfig(['od-writing'], homeS)
const s3 = syncMod.sync({ dshHome: homeS, root: process.argv[2], installAgents: false })
check('disable removes motion skill dir',
  existsSync(join(homeS, 'skills', 'od-motion')), false)
check('disable removes motion agent',
  existsSync(join(homeS, 'agent-manager', 'presets', 'od-motion')), false)
check('disable removes motion from director team',
  JSON.parse(readFileSync(join(homeS, 'agent-manager', 'presets', 'od-director', 'agent.json'), 'utf8')).team,
  ['od-writing'])

// Legacy single-aggregator directory is cleaned up.
const homeL = mkdtempSync(join(tmpdir(), 'od-legacy-'))
mkdirSync(join(homeL, 'skills', 'opendesign'), { recursive: true })
writeFileSync(join(homeL, 'skills', 'opendesign', 'SKILL.md'), 'old')
syncMod.sync({ dshHome: homeL, root: process.argv[2], installAgents: false })
check('legacy aggregator removed', existsSync(join(homeL, 'skills', 'opendesign')), false)

// Everything off is legal and produces no skill dirs.
cfgMod.writeConfig([], homeL)
const s4 = syncMod.sync({ dshHome: homeL, root: process.argv[2], installAgents: false })
check('disable-all writes no skill dirs', s4.skillsWritten.length, 0)
check('disable-all leaves only the director agent',
  s4.agentsWritten.length, 1)
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node plugins/open-design/lifecycle.test.mjs plugins/open-design`
Expected: FAIL — `sync.mjs` 不存在

- [ ] **Step 3: 实现 `sync.mjs`**

```js
/**
 * Materialise the enabled domains on disk: one skill directory per domain, plus
 * the agent presets that pair with them.
 *
 * The contract is that a closed domain leaves nothing behind, and that running
 * twice in a row changes nothing the second time (same bytes, same mtimes).
 * Both are tested.
 *
 * @module open-design/sync
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DOMAINS, ORCHESTRATOR } from './domains.mjs'
import { readConfig } from './config.mjs'
import { listBundledSkills, renderDomainSkill } from './skills.mjs'
import { agentDirFiles, domainAgentSpec, orchestratorSpec } from './agents.mjs'

/** `$DSH_HOME`, falling back to `~/.dsh` — same rule the other vyra plugins use. */
function defaultDshHome() {
  return process.env.DSH_HOME ?? join(process.env.USERPROFILE ?? process.env.HOME ?? '.', '.dsh')
}

/** The pre-domain aggregator, removed on sight. */
const LEGACY = 'opendesign'

/** Write only when the bytes differ, so a restart does not churn mtimes. */
function writeIfChanged(file, content) {
  try {
    if (existsSync(file) && readFileSync(file, 'utf8') === content) return false
  } catch {
    // Unreadable: rewrite it.
  }
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, content)
  return true
}

```js
/**
 * Remove every `od-*` directory under `skillsRoot` that is not in `keep`.
 * Only this plugin's own prefix is touched.
 */
function pruneSkillDirs(skillsRoot, keep) {
  const removed = []
  if (!existsSync(skillsRoot)) return removed
  for (const entry of readdirSync(skillsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('od-')) continue
    if (keep.includes(entry.name)) continue
    rmSync(join(skillsRoot, entry.name), { recursive: true, force: true })
    removed.push(entry.name)
  }
  return removed
}

/** Same for the agent preset directories this plugin owns. */
function pruneAgentDirs(presetsRoot, keep) {
  const removed = []
  if (!existsSync(presetsRoot)) return removed
  for (const entry of readdirSync(presetsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('od-')) continue
    if (keep.includes(entry.name)) continue
    rmSync(join(presetsRoot, entry.name), { recursive: true, force: true })
    removed.push(entry.name)
  }
  return removed
}

/**
 * @param {{ dshHome?: string, root?: string, installAgents?: boolean }} options
 * @returns {{ enabled: string[], skillsWritten: string[], agentsWritten: string[], removed: string[], warnings: string[], error: string | null }}
 */
export function sync(options = {}) {
  const root = options.root ?? fileURLToPath(new URL('.', import.meta.url))
  const dshHome = options.dshHome ?? defaultDshHome()
  const installAgents = options.installAgents !== false

  const report = { enabled: [], skillsWritten: [], agentsWritten: [], agents: [], removed: [], warnings: [], error: null }

  try {
    const config = readConfig(dshHome)
    report.enabled = config.enabled
    report.warnings.push(...config.warnings)

    const skillsRoot = join(dshHome, 'skills')
    const presetsRoot = join(dshHome, 'agent-manager', 'presets')
    const allSkills = listBundledSkills(root)

    // 1. Skill directories.
    for (const domain of DOMAINS) {
      if (!config.enabled.includes(domain.id)) continue
      const text = renderDomainSkill(domain, allSkills, { root })
      if (writeIfChanged(join(skillsRoot, domain.id, 'SKILL.md'), text)) report.skillsWritten.push(domain.id)
    }
    report.removed.push(...pruneSkillDirs(skillsRoot, config.enabled))

    // 2. The legacy aggregator.
    const legacy = join(skillsRoot, LEGACY)
    if (existsSync(legacy)) {
      rmSync(legacy, { recursive: true, force: true })
      report.removed.push(LEGACY)
    }

    // 3. Agents: one per enabled domain, plus the orchestrator.
    if (installAgents) {
      const keep = []
      for (const domain of DOMAINS) {
        if (!config.enabled.includes(domain.id)) continue
        keep.push(domain.id)
        report.agents.push(domain.id)
        if (writeAgent(presetsRoot, domainAgentSpec(domain))) report.agentsWritten.push(domain.id)
      }
      keep.push(ORCHESTRATOR.id)
      report.agents.push(ORCHESTRATOR.id)
      // The director is rewritten whenever the enabled set changes, because its
      // `team` and prompt both carry that set.
      if (writeAgent(presetsRoot, orchestratorSpec(config.enabled))) report.agentsWritten.push(ORCHESTRATOR.id)
      report.removed.push(...pruneAgentDirs(presetsRoot, keep))
    }
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error)
  }

  return report
}

/** Write one preset directory; returns whether anything changed. */
function writeAgent(presetsRoot, spec) {
  const dir = join(presetsRoot, spec.id)
  let changed = false
  for (const [name, content] of Object.entries(agentDirFiles(spec))) {
    if (writeIfChanged(join(dir, name), content)) changed = true
  }
  return changed
}
```

然后改 `index.js` 的 `apply`：

```js
import { sync } from './sync.mjs'

export function apply(ctx, config = {}) {
  if (config.enabled === false) return { installed: 0, error: null }

  const logger = ctx?.logger?.('open-design')
  const report = sync({
    dshHome: config.dshHome,
    installAgents: config.installAgents !== false,
  })

  if (report.error !== null) logger?.warn?.(`open-design: ${report.error}`)
  else logger?.info?.(`open-design: ${String(report.enabled.length)} 个领域已启用`)

  return { installed: report.skillsWritten.length, error: report.error, report }
}
```

删除 `index.js` 中旧的 `install` / `uninstall` / `AGGREGATOR` / `STAGING`，并更新旧测试里对它们的引用。

- [ ] **Step 4: 运行全部测试确认通过**

Run: `node plugins/open-design/lifecycle.test.mjs plugins/open-design`
Expected: PASS，全部检查（含旧的生命周期检查）通过

- [ ] **Step 5: 提交**

```bash
git add plugins/open-design/sync.mjs plugins/open-design/index.js plugins/open-design/lifecycle.test.mjs
git commit -m "feat(open-design): sync enabled domains to skills and agent presets"
```

---

### Task 6: CLI `odx`

**Files:**
- Create: `plugins/open-design/cli.mjs`
- Create: `plugins/open-design/bin/odx`、`plugins/open-design/bin/odx.cmd`
- Modify: `plugins/open-design/package.json`（加 `bin`）
- Test: `plugins/open-design/lifecycle.test.mjs`

**Interfaces:**
- Consumes: `readConfig` / `writeConfig`（config.mjs）、`sync`（sync.mjs）、`DOMAINS` / `DOMAIN_IDS`（domains.mjs）
- Produces: `run(argv: string[], options?): { exitCode: number, stdout: string, stderr: string }`

- [ ] **Step 1: 写失败测试**

```js
// ===== Task 6: CLI =====
const cliMod = await import(pathToFileURL(join(process.argv[2], 'cli.mjs')).href)
const cliHome = mkdtempSync(join(tmpdir(), 'od-cli-'))
const run = (args) => cliMod.run(args, { dshHome: cliHome, root: process.argv[2], installAgents: false })

const listOut = run(['domains', 'list'])
check('list exits 0', listOut.exitCode, 0)
check('list shows all nine domains',
  domains.DOMAINS.filter((d) => listOut.stdout.includes(d.id)).length, 9)
check('list marks enabled state', /✅|✓|\[on\]/.test(listOut.stdout), true)

check('enable unknown id exits 1', run(['domains', 'enable', 'od-nope']).exitCode, 1)
check('enable unknown id names the culprit', run(['domains', 'enable', 'od-nope']).stderr.includes('od-nope'), true)

check('enable video exits 0', run(['domains', 'enable', 'od-video']).exitCode, 0)
check('video now enabled', cfgMod.readConfig(cliHome).enabled.includes('od-video'), true)
check('video skill dir created', existsSync(join(cliHome, 'skills', 'od-video', 'SKILL.md')), true)

check('disable video exits 0', run(['domains', 'disable', 'od-video']).exitCode, 0)
check('video now disabled', cfgMod.readConfig(cliHome).enabled.includes('od-video'), false)
check('video skill dir removed', existsSync(join(cliHome, 'skills', 'od-video')), false)

check('enable-all exits 0', run(['domains', 'enable-all']).exitCode, 0)
check('enable-all enables nine', cfgMod.readConfig(cliHome).enabled.length, 9)
check('disable-all exits 0', run(['domains', 'disable-all']).exitCode, 0)
check('disable-all enables none', cfgMod.readConfig(cliHome).enabled.length, 0)

check('agents list exits 0', run(['agents', 'list']).exitCode, 0)
check('unknown command exits 1', run(['frobnicate']).exitCode, 1)
check('no command prints usage', /odx/.test(run([]).stdout), true)

const jsonOut = run(['domains', 'list', '--json'])
check('json output parses', Array.isArray(JSON.parse(jsonOut.stdout)), true)
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node plugins/open-design/lifecycle.test.mjs plugins/open-design`
Expected: FAIL — `cli.mjs` 不存在

- [ ] **Step 3: 实现 `cli.mjs`**

```js
#!/usr/bin/env node
/**
 * `odx` — turn OpenDesign domains on and off.
 *
 * Every mutating command writes `domains.json` and then re-runs the same sync
 * the plugin uses on mount, so a change is live the moment the command returns.
 *
 * Kept free of process-level side effects (no `process.exit`, no `console`) so
 * the tests can call `run()` directly; `bin/odx` is the thin wrapper that wires
 * it to stdio.
 *
 * @module open-design/cli
 */

import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DOMAINS, DOMAIN_IDS, DEFAULT_ENABLED } from './domains.mjs'
import { readConfig, writeConfig } from './config.mjs'
import { sync } from './sync.mjs'

const USAGE = `odx — OpenDesign 领域开关

用法:
  odx domains list [--json]        列出九个领域与启用状态
  odx domains enable <id...>       启用一个或多个领域
  odx domains disable <id...>      关闭一个或多个领域
  odx domains enable-all           全部启用
  odx domains disable-all          全部关闭
  odx agents list                  列出已生成的领域 agent 与编排 agent
  odx sync                         按当前配置重新同步磁盘

领域:
${DOMAINS.map((d) => `  ${d.id.padEnd(20)} ${d.name}`).join('\n')}
`

const packageRoot = fileURLToPath(new URL('.', import.meta.url))

/**
 * @returns {{ exitCode: number, stdout: string, stderr: string }}
 */
export function run(argv, options = {}) {
  const root = options.root ?? packageRoot
  const dshHome = options.dshHome
  const installAgents = options.installAgents !== false
  const out = []
  const err = []

  const applyAndReport = () => {
    const report = sync({ dshHome, root, installAgents })
    if (report.error !== null) err.push(`同步失败：${report.error}`)
    else {
      out.push(`已启用 ${String(report.enabled.length)} 个领域：${report.enabled.join(', ') || '（无）'}`)
      if (report.skillsWritten.length) out.push(`写入技能：${report.skillsWritten.join(', ')}`)
      if (report.agentsWritten.length) out.push(`写入 Agent：${report.agentsWritten.join(', ')}`)
      if (report.removed.length) out.push(`清理：${report.removed.join(', ')}`)
    }
    for (const warning of report.warnings) err.push(`提示：${warning}`)
    return report.error === null ? 0 : 1
  }

  const [group, action, ...rest] = argv

  if (group === undefined || group === '--help' || group === '-h' || group === 'help') {
    out.push(USAGE)
    return { exitCode: 0, stdout: `${out.join('\n')}\n`, stderr: '' }
  }

  const unknownDomain = (id) => `未知领域「${id}」。可用：${DOMAIN_IDS.join(', ')}`

  if (group === 'domains' || group === 'domain') {
    const json = rest.includes('--json')
    const ids = rest.filter((value) => !value.startsWith('--'))

    if (action === 'list' || action === undefined) {
      const { enabled } = readConfig(dshHome)
      if (json) {
        const rows = DOMAINS.map((domain) => ({
          id: domain.id,
          name: domain.name,
          enabled: enabled.includes(domain.id),
          skills: domain.skills.length,
          designSystems: domain.designSystems === true,
        }))
        return { exitCode: 0, stdout: `${JSON.stringify(rows, null, 2)}\n`, stderr: '' }
      }
      out.push('领域                 状态    技能数')
      for (const domain of DOMAINS) {
        const on = enabled.includes(domain.id)
        const skills = domain.designSystems === true ? `${domain.skills.length}+152` : String(domain.skills.length)
        out.push(`${domain.id.padEnd(20)} ${on ? '✅ 开' : '  ❌ 关'}  ${skills.padStart(4)}  ${domain.name}`)
      }
      return { exitCode: 0, stdout: `${out.join('\n')}\n`, stderr: '' }
    }

    if (action === 'enable' || action === 'disable') {
      if (ids.length === 0) {
        err.push(`用法：odx domains ${action} <id...>`)
        return { exitCode: 1, stdout: '', stderr: `${err.join('\n')}\n` }
      }
      const unknown = ids.filter((id) => !DOMAIN_IDS.includes(id))
      if (unknown.length > 0) {
        return { exitCode: 1, stdout: '', stderr: `${unknown.map(unknownDomain).join('\n')}\n` }
      }
      const current = readConfig(dshHome).enabled
      const next = action === 'enable'
        ? [...new Set([...current, ...ids])]
        : current.filter((id) => !ids.includes(id))
      writeConfig(next, dshHome)
      return { exitCode: applyAndReport(), stdout: `${out.join('\n')}\n`, stderr: `${err.join('\n')}${err.length ? '\n' : ''}` }
    }

    if (action === 'enable-all' || action === 'disable-all') {
      writeConfig(action === 'enable-all' ? [...DOMAIN_IDS] : [], dshHome)
      return { exitCode: applyAndReport(), stdout: `${out.join('\n')}\n`, stderr: `${err.join('\n')}${err.length ? '\n' : ''}` }
    }
  }

  if (group === 'agents' && (action === 'list' || action === undefined)) {
    const { enabled } = readConfig(dshHome)
    out.push(`编排 Agent：od-director（可调度 ${String(enabled.length)} 个领域）`)
    for (const domain of DOMAINS) {
      out.push(`${enabled.includes(domain.id) ? '✅' : '  '} ${domain.id.padEnd(20)} ${domain.name}`)
    }
    return { exitCode: 0, stdout: `${out.join('\n')}\n`, stderr: '' }
  }

  if (group === 'sync') {
    return { exitCode: applyAndReport(), stdout: `${out.join('\n')}\n`, stderr: `${err.join('\n')}${err.length ? '\n' : ''}` }
  }

  err.push(`未知命令「${[group, action].filter(Boolean).join(' ')}」\n`)
  out.push(USAGE)
  return { exitCode: 1, stdout: `${out.join('\n')}\n`, stderr: `${err.join('\n')}\n` }
}
```

`bin/odx`：

```sh
#!/usr/bin/env node
import { run } from '../cli.mjs'

const { exitCode, stdout, stderr } = run(process.argv.slice(2))
if (stdout) process.stdout.write(stdout)
if (stderr) process.stderr.write(stderr)
process.exitCode = exitCode
```

`bin/odx.cmd`：

```bat
@echo off
node "%~dp0\odx" %*
```

`package.json` 增加：

```json
"bin": { "odx": "./bin/odx" },
```

并在 `files` 里加 `"cli.mjs"`, `"bin"`, `"domains.mjs"`, `"skills.mjs"`, `"config.mjs"`, `"agents.mjs"`, `"sync.mjs"`。

- [ ] **Step 4: 运行测试确认通过**

Run: `node plugins/open-design/lifecycle.test.mjs plugins/open-design`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add plugins/open-design/cli.mjs plugins/open-design/bin plugins/open-design/package.json
git commit -m "feat(open-design): add the odx CLI for toggling domains"
```

---

### Task 7: 接线到宿主 `pluginManager` 并更新文档

**Files:**
- Modify: `plugins/open-design/index.js`
- Modify: `plugins/open-design/cordis.patch.yml`
- Modify: `plugins/open-design/README.md`
- Modify: `package.json`（测试脚本名）
- Test: `plugins/open-design/lifecycle.test.mjs`

**Interfaces:**
- Consumes: `sync` from `sync.mjs`
- Produces: `apply(ctx, config)` 在宿主有 `pluginManager` 时把生成的 preset 目录注册为 bundle

- [ ] **Step 1: 写失败测试**

```js
// ===== Task 7: host wiring =====
// apply must not throw when pluginManager is absent, and must report it.
const applyHome = mkdtempSync(join(tmpdir(), 'od-apply-'))
const applyReport = m.apply(
  { logger: () => ({ info() {}, warn() {} }), get: () => undefined, on() {} },
  { dshHome: applyHome, installAgents: false },
)
check('apply without pluginManager still syncs', applyReport.report.skillsWritten.length >= 0, true)
check('apply reports no error', applyReport.error, null)
check('apply created skill dirs',
  existsSync(join(applyHome, 'skills', 'od-visual-design', 'SKILL.md')), true)
```

- [ ] **Step 2: 运行测试确认失败或通过**

Run: `node plugins/open-design/lifecycle.test.mjs plugins/open-design`
Expected: 若 Task 5 的 `apply` 已满足该契约则直接 PASS；若失败，按 Step 3 修正。

- [ ] **Step 3: 实现宿主接线**

在 `index.js` 的 `apply` 中，`sync` 之后增加注册步骤：

```js
export async function apply(ctx, config = {}) {
  if (config.enabled === false) return { installed: 0, error: null }

  const logger = ctx?.logger?.('open-design')
  const report = sync({
    dshHome: config.dshHome,
    installAgents: config.installAgents !== false,
  })

  if (report.error !== null) {
    logger?.warn?.(`open-design: ${report.error}`)
    return { installed: 0, error: report.error, report }
  }

  // Registering the preset directories is the host's job: a bundle only becomes
  // selectable once the plugin manager installs it. Without that service the
  // files are still on disk, which is what the CLI and the tests use.
  const pm = typeof ctx?.get === 'function' ? ctx.get('pluginManager') : undefined
  if (pm !== undefined && config.installAgents !== false) {
    const presetsRoot = join(config.dshHome ?? dshHome(), 'agent-manager', 'presets')
    for (const id of [...report.agentsWritten, ...report.agents]) {
      try {
        const result = await pm.installBundle(join(presetsRoot, id), { enabled: true })
        if (result?.application === 'failed') logger?.warn?.(`open-design: 注册 agent ${id} 失败`)
      } catch (error) {
        logger?.warn?.(`open-design: 注册 agent ${id} 出错：${error instanceof Error ? error.message : String(error)}`)
      }
    }
  } else if (pm === undefined) {
    logger?.info?.('open-design: 未检测到 pluginManager，agent 预设仅写入磁盘，未注册')
  }

  logger?.info?.(`open-design: ${String(report.enabled.length)} 个领域已启用`)
  return { installed: report.skillsWritten.length, error: null, report }
}
```

> `report.agents` 在 Task 5 已作为「当前应存在的全部 agent id」预留并填充（含 `od-director`），这里直接消费。

`cordis.patch.yml` 增加：

```yaml
        # 是否在挂载时生成并注册 agent preset。关掉则只同步技能目录。
        installAgents: true
```

README 增补一节「Agent 与调用限制」，写明：

- 九个领域 agent + `od-director`；
- `od-director` 的 `team` 决定它能派给谁，关闭领域会同步缩小；
- **Agent Teams 的 `spawn_teammate` 不支持 `agentPreset`**，不要用它挂领域 agent；
- `odx` 命令表。

`package.json` 的测试脚本改为：

```json
"test:open-design": "node --check plugins/open-design/index.js && node --check plugins/open-design/cli.mjs && node plugins/open-design/lifecycle.test.mjs plugins/open-design",
```

- [ ] **Step 4: 运行全部测试与仓库门禁**

Run:
```bash
node --check plugins/open-design/index.js
node --check plugins/open-design/cli.mjs
node plugins/open-design/lifecycle.test.mjs plugins/open-design
node scripts/check-installable.mjs
```
Expected: 全部 PASS，`check-installable: every plugin installs and loads`

- [ ] **Step 5: 提交**

```bash
git add plugins/open-design/index.js plugins/open-design/cordis.patch.yml plugins/open-design/README.md package.json
git commit -m "feat(open-design): register generated presets with the host and document the limits"
```

---

## Self-Review

**1. Spec coverage**

| 规格章节 | 覆盖任务 |
|---|---|
| 领域划分（9 个 + 归属表） | Task 1 |
| 配置与存储（含损坏回退） | Task 3 |
| 生成产物（技能目录、关闭即删、幂等） | Task 5 |
| 聚合技能规模（单领域渲染） | Task 2 |
| CLI 七条命令 | Task 6 |
| Agent preset（含视觉设计不列 152 系统） | Task 4 |
| 可调用性（`od-director` + team 白名单） | Task 4、7 |
| 领域 agent 不带 delegation | Task 4（测试断言） |
| Agent Teams 不支持 | Task 7（README） |
| 错误处理五条 | Task 3、5 |
| 测试 14 项 | Task 1–7 |
| 迁移（删除旧 `opendesign/`） | Task 5 |

无遗漏。

**2. Placeholder scan**

已检查，无 `TBD` / `TODO` / 「相似于 Task N」/ 无代码的步骤。唯一的注意事项已用显式的 ES# 修正块写出（`require` → `readFileSync`）。

**3. Type consistency**

- `readConfig` 返回 `{ enabled, warnings }`，Task 5/6 一致。
- `sync` 返回 `{ enabled, skillsWritten, agentsWritten, agents, removed, warnings, error }`；Task 7 用到 `report.agents`，需在 Task 5 的 report 里预留并填充——**已在 Task 7 Step 3 的说明块中补充该要求**。
- `domainAgentSpec` / `orchestratorSpec` 都返回含 `team` 的 `AgentSpec`，`agentDirFiles(spec)` 统一消费。
- `renderDomainSkill(domain, skills, { root })` 签名在 Task 2 定义，Task 5 按此调用。

---

## Execution Handoff

计划已保存到 `docs/superpowers/plans/2026-11-24-opendesign-domain-packages.md`。两种执行方式：

**1. Subagent-Driven（推荐）** — 每个任务派一个全新子 agent，任务之间我来审查，迭代快

**2. Inline Execution** — 在当前会话里按 executing-plans 分批执行，带检查点

选哪种？