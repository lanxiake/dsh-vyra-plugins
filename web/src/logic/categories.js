/**
 * 分类体系。
 *
 * 主表沿用 `scripts/market-manifest.ts` 已经声明并在 `docs/index.json`
 * 的 metadata.categories 里下发的分类（双语标题），不再另造一套。
 * 外部索引源（market / hub 等）的分类键在 ALIAS 里映射进来。
 */
export const CATEGORY_ORDER = [
  'appearance',
  'agent-runtime',
  'integration',
  'media',
  'content',
  'observability',
  'input-output',
  'browser',
  'model',
  'market',
  'fun',
  'other',
]

export const CATEGORY_LABELS = {
  appearance: { zh: '界面外观', en: 'Appearance' },
  'agent-runtime': { zh: '智能体运行时', en: 'Agent runtime' },
  integration: { zh: '外部集成', en: 'Integrations' },
  media: { zh: '媒体处理', en: 'Media' },
  content: { zh: '内容创作', en: 'Content creation' },
  observability: { zh: '可观测性', en: 'Observability' },
  'input-output': { zh: '输入与输出', en: 'Input and output' },
  browser: { zh: '浏览器与桌面', en: 'Browser and desktop' },
  model: { zh: '模型接入', en: 'Model access' },
  market: { zh: '市场与发现', en: 'Market & Discovery' },
  fun: { zh: '趣味与个性', en: 'Fun & Personality' },
  other: { zh: '其他', en: 'Other' },
}

/** 外部源的分类键 → 本站分类键 */
const ALIAS = {
  // 两套旧体系
  ui: 'appearance',
  interface: 'appearance',
  theme: 'appearance',
  comm: 'integration',
  integrations: 'integration',
  communication: 'integration',
  remote: 'integration',
  notify: 'integration',
  git: 'integration',
  skills: 'agent-runtime',
  skill: 'agent-runtime',
  agi: 'agent-runtime',
  session: 'agent-runtime',
  memory: 'agent-runtime',
  workflow: 'agent-runtime',
  agent: 'agent-runtime',
  auth: 'browser',
  security: 'browser',
  identity: 'browser',
  wsl: 'browser',
  dev: 'observability',
  development: 'observability',
  usage: 'observability',
  tools: 'input-output',
  vision: 'input-output',
  voice: 'input-output',
  docs: 'content',
  knowledge: 'content',
  productivity: 'content',
  providers: 'model',
}

export function normalizeCategory(key) {
  if (typeof key !== 'string' || key === '') return 'other'
  if (Object.hasOwn(CATEGORY_LABELS, key)) return key
  return ALIAS[key] ?? 'other'
}

export function categoryLabel(key, lang) {
  return CATEGORY_LABELS[key]?.[lang] ?? CATEGORY_LABELS[key]?.en ?? key
}
