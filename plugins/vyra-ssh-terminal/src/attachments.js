/**
 * AI 面板的两件「周边」能力：附件与上下文压缩。
 *
 * 两件事都不碰网络，所以可以单独测：
 *
 *  - **附件**：用户可以把本机文件拖进 AI 面板，或者让 AI 读服务器上的文件。协议只允许
 *    「有限大小、已知类型」的东西进上下文——一张 12MB 的图塞进请求里只会把整轮对话
 *    顶爆，而用户得到的是一句看不懂的 400。
 *  - **压缩**：对话占到上下文窗口的 90% 时，把早先那段交给同一个模型压成一份交接摘要，
 *    最近的部分原样留着。压缩点留在对话里一行，点开就是模型现在手里那份摘要。
 */

/** 一次最多带多少字节进上下文（图片与文本共享这个预算）。 */
export const MAX_ATTACH_BYTES = 6 * 1024 * 1024

/** 允许进上下文的文本扩展名——其余按二进制处理，不读内容只给路径。 */
const TEXT_EXT = new Set([
  'txt', 'md', 'log', 'conf', 'cfg', 'ini', 'yaml', 'yml', 'json', 'toml', 'xml', 'csv',
  'sh', 'bash', 'zsh', 'py', 'js', 'ts', 'mjs', 'cjs', 'go', 'rs', 'java', 'c', 'h', 'cpp',
  'sql', 'service', 'env', 'properties', 'pem', 'pub',
])

/** 认得出的图片类型（只有这些能当图片发出去）。 */
const IMAGE_MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
}

export function extOf(name) {
  const m = /\.([A-Za-z0-9]{1,10})$/.exec(String(name ?? '').split(/[\\/]/).pop() ?? '')
  return m ? m[1].toLowerCase() : ''
}

/**
 * 判定一个附件该怎么处理。
 *
 * @param {{name: string, size: number}} file
 * @returns {{kind: 'image' | 'text' | 'link-only', mime?: string} | {kind: 'reject', reason: string}}
 */
export function classifyAttachment(file) {
  const name = String(file?.name ?? '')
  const size = Number(file?.size ?? 0)
  if (!name) return { kind: 'reject', reason: '没有文件名' }
  if (size > MAX_ATTACH_BYTES) {
    return { kind: 'reject', reason: `${(size / 1048576).toFixed(1)} MB 超过上限 ${MAX_ATTACH_BYTES / 1048576} MB，请先在服务器上下载或裁剪` }
  }
  const ext = extOf(name)
  if (IMAGE_MIME[ext]) return { kind: 'image', mime: IMAGE_MIME[ext] }
  if (TEXT_EXT.has(ext) || ext === '') return { kind: 'text' }
  // 其余（pdf/zip/xlsx…）：不给内容，只把路径告诉模型，让它自己决定要不要用工具处理
  return { kind: 'link-only' }
}

/**
 * 附件在消息里的表示。
 *
 * 图片走 `image` 块（由宿主投影成可读的形式），文本与「只给路径」的都走文本块——
 * 后者必须**明确写成路径**，否则模型会以为内容已经在上下文里了。
 *
 * @param {{name: string, kind: 'image'|'text'|'link-only', mime?: string, text?: string, path?: string}} a
 * @returns {object[]} 可以直接拼进 user message 的 content 块
 */
export function attachmentBlocks(a) {
  if (a.kind === 'image') {
    // 图片必须带真实字节：宿主 LLM 协议认 `{type:'image', source:{type:'base64',…}}`，
    // 到了适配器那层会投影成各家自己的 image_url / inlineData。
    // 只发一句「[附件图片] name」的话，模型其实什么都没看到——用户拖一张报错截图
    // 进来问"这是什么"，只会得到一段无中生有的猜测。
    if (a.data) {
      return [
        { type: 'text', text: `[附件图片] ${a.name}` },
        { type: 'image', source: { type: 'base64', media_type: a.mime || 'image/png', data: a.data } },
      ]
    }
    // 拿不到字节时如实说明，不要假装图已经在上下文里。
    return [{ type: 'text', text: `[附件图片] ${a.name}（${a.mime || '未知类型'}；内容没能读取，请让用户重发或改用文件路径）` }]
  }
  if (a.kind === 'text') {
    return [{ type: 'text', text: `[附件] ${a.name}\n\`\`\`\n${String(a.text ?? '')}\n\`\`\`` }]
  }
  return [{ type: 'text', text: `[附件] ${a.path ?? a.name}（未展开内容；需要时用工具读取）` }]
}

/**
 * 该不该压缩了。
 *
 * @param {number} approxTokens 当前对话估算的 token 数
 * @param {number} contextWindow 模型声明的上下文窗口（未知时传 0）
 * @param {number} [ratio] 阈值，默认 0.9
 */
export function shouldCompact(approxTokens, contextWindow, ratio = 0.9) {
  if (!Number.isFinite(contextWindow) || contextWindow <= 0) return false
  return approxTokens >= contextWindow * ratio
}

/** 压缩后要保留的最近消息条数：约 20% 的窗口，至少 4 条。 */
export function keepRecent(messages, ratio = 0.2) {
  const list = Array.isArray(messages) ? messages : []
  const n = Math.max(4, Math.round(list.length * ratio))
  return list.slice(-n)
}

/**
 * 压缩请求的提示词。要的是一份「交接摘要」：下一个接手的人（还是同一个模型）看了之后
 * 能接着干，而不是一段文学概括。
 */
export const COMPACT_PROMPT = [
  '把下面这段对话压缩成一份工作交接摘要，供之后继续同一个任务时使用。',
  '必须保留：',
  '- 用户的要求与约束（原话里的关键限定词）；',
  '- 已经跑过的命令**原文**，以及它们的结论（成功/失败、关键输出里的数值）；',
  '- 已确认的路径、端口、服务名、配置项；',
  '- 被用户拒绝过的尝试（以及为什么被拒），不要重试它们；',
  '- 还没解决的问题、下一步该做什么。',
  '不要保留：寒暄、重复的解释、已经作废的方案。',
  '直接输出摘要正文，不要加标题或前言。',
].join('\n')

/** 把要丢弃的那段拼成一次压缩请求的正文。 */
export function compactInput(messages) {
  const lines = []
  for (const m of Array.isArray(messages) ? messages : []) {
    if (m.role === 'user') lines.push(`用户：${textOf(m)}`)
    else if (m.role === 'assistant') lines.push(`助手：${textOf(m)}`)
    else if (m.role === 'tool') lines.push(`工具结果：${textOf(m).slice(0, 2000)}`)
  }
  return lines.join('\n\n')
}

function textOf(m) {
  return (m.content ?? [])
    .map((b) => (b.type === 'text' ? b.text : b.type === 'tool-call' ? `(调用 ${b.name} ${b.arguments})` : ''))
    .filter(Boolean)
    .join('\n')
}
