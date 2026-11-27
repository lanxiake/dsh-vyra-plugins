/**
 * SkillNet category standard, shared by the panel RPC and the `vyra-skill` CLI.
 *
 * SkillNet (https://github.com/zjunlp/SkillNet) is the upstream taxonomy this
 * manager classifies by. Its search API exposes `category` as a free-text
 * filter with no published enum, so this table was reconstructed by sampling
 * real records from `http://api-skillnet.openkg.cn/v1/search`.
 *
 * Two consequences are deliberate and documented rather than worked around:
 *
 * 1. The upstream granularity is coarse. `pdf / docx / pptx / excel` all live
 *    under Productivity and `git / shell / api / docker / sql` all live under
 *    Development. Filtering stops at this level on purpose.
 * 2. An installed skill carries no category field at all, so classification is
 *    inferred from its name, description and `whenToUse`.
 *
 * @module dsh-vyra-skill-mcp-manager/classify
 */

/**
 * The ten categories, in resolution order.
 *
 * `domain: true` entries describe what a skill is FOR and win over the tool
 * words in `domain: false` entries, which describe how it happens to be built.
 * That ordering is what keeps a `pdf` skill in 效率办公 instead of letting the
 * `python` in its description drag it into 软件开发.
 */
export const CATEGORIES = [
  {
    id: 'development',
    label: '软件开发',
    skillnet: 'Development',
    domain: false,
    keywords: [
      'git', 'github', 'gitlab', 'code', 'coding', 'refactor', 'debug', 'lint', 'review',
      'api', 'sdk', 'cli', 'shell', 'bash', 'powershell', 'python', 'node', 'javascript',
      'typescript', 'react', 'docker', 'kubernetes', 'k8s', 'sql', 'database', 'backend',
      'frontend', 'server', 'deploy', 'ci', 'cd', 'build', 'compile', 'repository', 'commit',
      'pull request', 'pull-request', 'unit test', 'merge', 'branch', 'package', 'npm', 'pnpm',
      '开发', '代码', '编程', '重构', '调试', '接口', '部署', '构建', '仓库', '提交',
    ],
  },
  {
    id: 'testing',
    label: '测试质量',
    skillnet: 'Testing',
    domain: true,
    keywords: [
      'test', 'testing', 'pytest', 'jest', 'vitest', 'playwright', 'cypress', 'qa', 'coverage',
      'e2e', 'regression', 'assert', 'mock', 'snapshot', 'benchmark', 'selenium',
      '测试', '单元测试', '回归', '用例', '质量', '覆盖率', '断言',
    ],
  },
  {
    id: 'aigc',
    label: 'AI 与生成',
    skillnet: 'AIGC',
    domain: true,
    keywords: [
      'llm', 'prompt', 'agent', 'rag', 'embedding', 'embed', 'vector', 'finetune', 'fine-tune',
      'lora', 'diffusion', 'stable diffusion', 'image generat', 'text-to-image', 'text to image',
      'tts', 'text-to-speech', 'speech', 'transcri', 'whisper', 'openai', 'anthropic', 'deepseek',
      'claude', 'gpt', 'gemini', 'ollama', 'comfyui', 'midjourney',
      '提示词', '大模型', '生图', '绘画', '语音合成', '智能体', '模型',
    ],
  },
  {
    id: 'productivity',
    label: '效率办公',
    skillnet: 'Productivity',
    domain: true,
    keywords: [
      'pdf', 'docx', 'doc', 'xlsx', 'xls', 'excel', 'pptx', 'ppt', 'slides', 'spreadsheet',
      'office', 'word', 'markdown', 'note', 'notes', 'notion', 'obsidian', 'todo', 'task',
      'calendar', 'schedule', 'meeting', 'minutes', 'email', 'mail', 'inbox', 'slack', 'feishu',
      'lark', 'dingtalk', 'wecom', 'reminder', 'workflow', 'automat', 'shortcut', 'clipboard',
      'summar', 'translat', 'convert', 'merge',
      '文档', '表格', '幻灯片', '笔记', '日历', '会议', '邮件', '待办', '翻译', '摘要', '转换',
    ],
  },
  {
    id: 'business',
    label: '商业运营',
    skillnet: 'Business',
    domain: true,
    keywords: [
      'crm', 'marketing', 'seo', 'ads', 'advertis', 'campaign', 'sales', 'lead', 'customer',
      'ecommerce', 'e-commerce', 'shop', 'pricing', 'invoice', 'accounting', 'finance',
      'financial', 'revenue', 'budget', 'hr', 'recruit', 'resume', 'interview', 'legal',
      'contract', 'compliance', 'policy', 'xianyu', 'taobao', 'jd', 'shopify',
      '营销', '运营', '销售', '客户', '电商', '财务', '发票', '招聘', '简历', '合同', '法务',
    ],
  },
  {
    id: 'research',
    label: '学术研究',
    skillnet: 'Research',
    domain: true,
    keywords: [
      'research', 'paper', 'arxiv', 'survey', 'literature', 'citation', 'bibtex', 'thesis',
      'dataset', 'dataset search', 'experiment', 'peer review', 'journal', 'conference',
      '论文', '文献', '综述', '引用', '数据集', '学术', '检索',
    ],
  },
  {
    id: 'science',
    label: '科学计算',
    skillnet: 'Science',
    domain: true,
    keywords: [
      'chemistry', 'molecule', 'protein', 'bioinformatic', 'genomic', 'dna', 'rna',
      'physics', 'simulation', 'math', 'mathematic', 'statistic', 'algebra', 'calculus',
      'medical', 'clinical', 'drug', 'astronomy', 'climate', 'geospatial', 'gis',
      'lab', 'microscopy', 'material', 'quantum',
      '化学', '分子', '生物', '基因', '物理', '数学', '统计', '医学', '药物', '天文', '气象',
    ],
  },
  {
    id: 'security',
    label: '安全合规',
    skillnet: 'Security',
    domain: true,
    keywords: [
      'security', 'vulnerab', 'cve', 'pentest', 'penetration', 'exploit', 'malware',
      'encrypt', 'decrypt', 'cipher', 'hash', 'signature', 'credential', 'secret',
      'audit', 'privacy', 'gdpr', 'firewall', 'owasp', 'xss', 'injection', 'ssl', 'tls',
      '安全', '漏洞', '渗透', '加密', '解密', '审计', '隐私', '合规', '密钥',
    ],
  },
  {
    id: 'lifestyle',
    label: '生活娱乐',
    skillnet: 'Lifestyle',
    domain: true,
    keywords: [
      'travel', 'flight', 'hotel', 'trip', 'food', 'recipe', 'cook', 'restaurant', 'diet',
      'nutrition', 'fitness', 'workout', 'health', 'sleep', 'meditat', 'mood', 'habit',
      'music', 'playlist', 'spotify', 'movie', 'film', 'book', 'reading', 'game', 'gaming',
      'shopping', 'weather', 'pet', 'fashion', 'photo', 'podcast',
      '旅行', '机票', '酒店', '美食', '菜谱', '健身', '健康', '音乐', '电影', '读书',
      '游戏', '购物', '天气', '宠物', '生活',
    ],
  },
  {
    id: 'other',
    label: '其他',
    skillnet: 'Other',
    domain: false,
    keywords: [],
  },
]

const OTHER = CATEGORIES[CATEGORIES.length - 1]

/** Match a declared category (label, SkillNet value or id) case-insensitively. */
export function categoryId(input) {
  const needle = String(input ?? '').trim().toLowerCase()
  if (needle === '') return null
  return CATEGORIES.find(
    (entry) =>
      entry.label === String(input).trim()
      || entry.skillnet.toLowerCase() === needle
      || entry.id === needle,
  ) ?? null
}

/** Longest keyword first, so a specific phrase wins over a prefix of it. */
function byKeywordLength(left, right) {
  return right.length - left.length
}

const SORTED = CATEGORIES.map((entry) => ({
  entry,
  keywords: [...entry.keywords].sort(byKeywordLength),
}))

function haystackOf(fields) {
  const args = Array.isArray(fields.args) ? fields.args.join(' ') : String(fields.args ?? '')
  return [fields.name, fields.description, fields.whenToUse, fields.command, args]
    .filter((value) => typeof value === 'string' && value !== '')
    .join(' ')
    .toLowerCase()
}

function firstHit(haystack, domain) {
  for (const row of SORTED) {
    if (row.entry.domain !== domain || row.keywords.length === 0) continue
    if (row.keywords.some((word) => haystack.includes(word))) return row.entry
  }
  return null
}

/**
 * Classify one skill or MCP server.
 *
 * A category declared in `SKILL.md` frontmatter wins. Otherwise domain words
 * are tried before tool words, and a miss falls through to 其他.
 */
export function classify(fields = {}) {
  const declared = categoryId(fields.category)
  if (declared !== null) {
    return { id: declared.id, label: declared.label, matched: 'declared' }
  }
  const haystack = haystackOf(fields)
  if (haystack === '') return { id: OTHER.id, label: OTHER.label, matched: 'fallback' }
  const domainHit = firstHit(haystack, true)
  if (domainHit !== null) return { id: domainHit.id, label: domainHit.label, matched: 'domain' }
  const toolHit = firstHit(haystack, false)
  if (toolHit !== null) return { id: toolHit.id, label: toolHit.label, matched: 'tool' }
  return { id: OTHER.id, label: OTHER.label, matched: 'fallback' }
}
