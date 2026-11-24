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
    summary:
      '给需求定视觉方向并产出高保真界面设计稿。能做：审美定调、排版配色体系、页面与组件布局、响应式与可访问性、从 152 套设计系统里选一套作为品牌契约。不能做：写业务逻辑或接后端接口（那是前端实现），也不做动效实现（那是动效设计）。',
    usage:
      '适合从零设计界面或改造现有界面的外观。\n\n示例：\n1. 「给面向财务团队的分析看板定视觉方向，出一版高保真 HTML 稿。」\n2. 「这个后台太丑，重做成沉静企业风，保留信息架构。」\n3. 「用 Stripe 那套设计系统做定价页。」',
    skills: [
      'frontend-design',
      'design-taste-frontend',
      'design-taste-frontend-v1',
      'minimalist-ui',
      'industrial-brutalist-ui',
      'high-end-visual-design',
      'redesign-existing-projects',
      'stitch-design-taste',
      'gpt-taste',
      'design-brief',
      'impeccable-design-polish',
      'emil-design-eng',
    ],
    designSystems: true,
  },
  {
    id: 'od-motion',
    name: '动效设计',
    description: '为界面与页面添加有节奏的动效：入场、滚动驱动、状态过渡、微交互，用 GSAP 体系实现并做性能把关。',
    summary:
      '给已有界面或视觉稿添加动效。能做：动效编排与节拍设计、GSAP 时间轴与 ScrollTrigger、React/Vue 集成、性能调优、动效代码审查、reduced-motion 降级。不能做：决定视觉方向（那是视觉设计），也不做视频渲染（那是视频制作）。',
    usage:
      '适合让静态页面动起来，或审查已有动效是否合格。\n\n示例：\n1. 「给这个落地页加滚动驱动的入场动效，要有节奏感但别浮夸。」\n2. 「审查现有页面的动效，指出卡顿和不合理的地方并修掉。」\n3. 「用 GSAP 做这个卡片的展开与收起过渡。」',
    skills: [
      'gsap-core',
      'gsap-timeline',
      'gsap-scrolltrigger',
      'gsap-react',
      'gsap-plugins',
      'gsap-performance',
      'gsap-utils',
      'gsap-frameworks',
      'animate',
      'ui-animation',
      'emilkowalski-motion',
      'motion-lab',
      'review-animations',
    ],
  },
  {
    id: 'od-video',
    name: '视频制作',
    description: '制作帧动画短片、片头片尾、视频模板与带时间轴的动效影片，输出可渲染的 HTML 或 mp4。',
    summary:
      '做视频与帧动画。能做：视频脚本与分镜、帧动画时间轴（Hyperframes / Remotion 路线）、片头片尾与转场、各类视频模板、艺术动画配方。不能做：活字排版长文（那是内容写作），也不做网页动效实现（那是动效设计）。',
    usage:
      '适合需要产出视频文件或逐帧动画的场合。\n\n示例：\n1. 「做一个 15 秒动效短片：散乱想法汇聚成一个清晰任务。」\n2. 「给产品发布会做片头，科技感，5 秒。」\n3. 「把这份年度阅读数据做成竖版回顾视频。」',
    skills: [
      'video-hyperframes',
      'motion-design',
      'huashu-art-motion',
      'oil-motion',
      'chat-motion-overlay',
      'frame-glitch-title',
      'frame-light-leak-cinema',
      'frame-liquid-bg-hero',
      'frame-logo-outro',
      'frame-macos-notification',
      'frame-data-chart-nyt',
      'frame-flowchart-sticky',
      'vfx-text-cursor',
      '8-bit-orbit-video-template',
      'after-hours-editorial-template',
      'swiss-user-research-video-template',
      'weread-year-in-review-video-template',
    ],
  },
  {
    id: 'od-presentation',
    name: '演示汇报',
    description: '制作幻灯片、Keynote 风格 deck、季度汇报与数据可视化报告页。',
    summary:
      '做演示与报告。能做：Keynote / 瑞士国际主义 / 编辑风等多种 deck 体系、幻灯片画布、数据可视化报告页、图表选型。不能做：社媒单图卡片（那是社媒图文），也不做视频（那是视频制作）。',
    usage:
      '适合需要一套成体系的演示或报告产物。\n\n示例：\n1. 「把这份季度数据做成一套瑞士风 10 页 deck。」\n2. 「把这个 CSV 变成带 KPI 卡和趋势图的可视化报告页。」\n3. 「帮我把产品方案整理成发布会用的幻灯片。」',
    skills: [
      'ppt-keynote',
      'deck-swiss-international',
      'deck-open-slide-canvas',
      'deck-guizang-editorial',
      'html-ppt-retro-quarterly-review',
      'swiss-creative-mode-template',
      'digits-fintech-swiss-template',
      'editorial-burgundy-principles-template',
      'field-notes-editorial-template',
      'data-report',
    ],
  },
  {
    id: 'od-social-content',
    name: '社媒图文',
    description: '制作社交媒体图文与分享卡片：小红书轮播、推文卡、海报、设备展示图。',
    summary:
      '做社媒与分享图。能做：小红书知识卡片、X/Reddit/Spotify 风格卡片、竖版海报与朋友圈图、3D 设备展示。不能做：完整长文（那是内容写作），也不做整套演示（那是演示汇报）。',
    usage:
      '适合以单张图或轮播形式在社交平台发布的内容。\n\n示例：\n1. 「把这篇要点做成一版小红书轮播图。」\n2. 「做一个竖版海报，朋友圈发布用。」\n3. 「生成一张 X 帖子卡，带互动数据样式。」',
    skills: [
      'card-twitter',
      'card-xiaohongshu',
      'social-x-post-card',
      'social-reddit-card',
      'social-spotify-card',
      'poster-hero',
      'mockup-device-3d',
    ],
  },
  {
    id: 'od-writing',
    name: '内容写作',
    description: '写长文与文档：杂志排版文章、发布说明、FAQ、简历、研究决策文档。',
    summary:
      '写字与排版文档。能做：长文结构与写作、杂志式 HTML 排版、FAQ 页、发布说明一页纸、简历、写作规范审查、研究笔记转决策文档。不能做：演示幻灯片（那是演示汇报），也不做单张社媒卡片（那是社媒图文）。',
    usage:
      '适合以文字为主的交付物。\n\n示例：\n1. 「把这次改版写成一篇发布稿。」\n2. 「把会议笔记整理成一篇杂志排版的 HTML 长文。」\n3. 「给新功能写 FAQ，覆盖安装和常见报错。」',
    skills: [
      'article-magazine',
      'doc-kami-parchment',
      'faq-page',
      'release-notes-one-pager',
      'resume-modern',
      'writing-guidelines',
      'research-decision-room',
      'full-output-enforcement',
    ],
  },
  {
    id: 'od-brand',
    name: '品牌资产',
    description: '建立与沉淀品牌视觉资产：品牌视觉板、配色与字体提取、设计契约、电商产品图。',
    summary:
      '做品牌资产与规范。能做：品牌视觉板与 logo 体系、从现有网站提取色板字体动效、把模糊需求固化为 DESIGN.md 契约、创意评审、资产库检索、电商产品图。不能做：具体页面设计（那是视觉设计），也不做质量审查（那是质检审核）。',
    usage:
      '适合需要先确立品牌规范，再做后续物料的场合。\n\n示例：\n1. 「从这个网站提取品牌色板和字体，做一张品牌视觉板。」\n2. 「我们品牌还没有设计规范，帮我定一份 DESIGN.md。」\n3. 「把这批产品实拍图做成电商主图。」',
    skills: [
      'brandkit',
      'brand-extract',
      'creative-director',
      'reference-design-contract',
      'library-curator',
      'ecommerce-image-workflow',
      'imagegen-frontend-web',
      'imagegen-frontend-mobile',
    ],
  },
  {
    id: 'od-frontend',
    name: '前端实现',
    description: '把设计落成可运行代码：复刻网站、图片转代码、登录流程、浏览器自动化验证。',
    summary:
      '做前端工程实现。能做：从设计图生成代码、网站复刻与交互逆向、登录注册流程实现、用浏览器自动化测试与验收、完整无占位输出。不能做：决定视觉方向（那是视觉设计），也不做质量门审查（那是质检审核）。',
    usage:
      '适合已经有设计稿或参考站点，需要落成可运行代码。\n\n示例：\n1. 「照这个网站复刻一版首页，换成我们的品牌色。」\n2. 「实现一套登录流程：注册、登录、找回密码。」\n3. 「用浏览器打开这个页面截图，检查布局有没有塌。」',
    skills: ['image-to-code', 'web-clone', 'login-flow', 'agent-browser', 'hatch-pet', 'od-next-media-inputs'],
  },
  {
    id: 'od-review',
    name: '质检审核',
    description: '交付前把关：设计规范合规、可访问性、导出链路、PR 反馈闭环。',
    summary:
      '做交付前质量审查。能做：Web 界面规范审查（布局/字体/颜色/动效/可访问性）、PPT 导出保真度核对、PR 评论与冲突处理、导出下载故障排查。不能做：直接重写产物（它只出问题清单），也不做创意评审（那是品牌资产）。',
    usage:
      '在产物交付或上线之前用它把关。\n\n示例：\n1. 「审查这版落地页的可访问性和规范合规，逐条列问题。」\n2. 「这个 PDF 导出跟网页对不上，帮我查原因。」\n3. 「把这批产物过一遍质量门，阻断级问题先修。」',
    skills: [
      'web-design-guidelines',
      'pptx-html-fidelity-audit',
      'pr-feedback-quality-gate',
      'export-download-debugging',
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

/** The coordinating agent that can delegate to every enabled domain agent. */
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