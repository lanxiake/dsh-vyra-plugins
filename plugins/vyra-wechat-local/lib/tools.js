// 把 initialize 交出的工具按白名单注册进 DSH。schema 不硬编码——上游加字段我们自动跟上。
//
// 只注册白名单（DESIGN §3.4）：侧车会交出 30 个，模型面前只放 12 个。
export const TOOL_WHITELIST = [
  'list_sessions',
  'read_history',
  'search_messages',
  'poll_new',
  'list_unread',
  'read_image',
  'send_text',
  'send_file',
  'send_batch',
  'reply_to',
  'check_env',
  'export_chat',
]

/**
 * 侧车的 image 块是 MCP 形状（base64 + mimeType）；DSH 的 image 块要附件引用。
 * 其余块原样交文本。
 */
async function toDshContent(blocks, attachments) {
  const out = []
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue
    if (block.type === 'text') {
      out.push({ type: 'text', text: String(block.text ?? '') })
      continue
    }
    if (block.type === 'image') {
      if (!block.data) continue
      if (!attachments) {
        out.push({ type: 'text', text: '[图片：附件服务不可用，未能附加]' })
        continue
      }
      try {
        const attachment = await attachments.saveImage({
          data: Buffer.from(String(block.data), 'base64'),
          mediaType: block.mimeType || 'image/png',
          name: 'wechat-image',
        })
        out.push({ type: 'image', attachment })
      } catch (err) {
        out.push({ type: 'text', text: `[图片附加失败：${err?.message ?? err}]` })
      }
    }
  }
  // 侧车返回空列表时给一句明确的话，别让模型把"没内容"当成成功。
  return out.length > 0 ? out : [{ type: 'text', text: '（工具没有返回内容）' }]
}

/**
 * @param {object} options
 * @param {any} options.ctx
 * @param {{call: Function}} options.sidecar
 * @param {() => any} [options.getAttachments]
 * @param {string[]} [options.whitelist]
 * @param {(line: string) => void} [options.log]
 */
export function createToolRegistrar({ ctx, sidecar, getAttachments = () => undefined, whitelist = TOOL_WHITELIST, log = () => {} }) {
  const disposers = new Map()

  function registerFrom(tools) {
    for (const tool of tools ?? []) {
      if (!whitelist.includes(tool?.name) || disposers.has(tool.name)) continue
      const definition = {
        name: tool.name,
        description: tool.description || tool.name,
        parameters: tool.inputSchema ?? { type: 'object', properties: {} },
        output: {
          // 侧车已经把结果拼成 content 块；canonical value 就是这串块。
          schema: { type: 'array' },
          render(_args, value) {
            return Array.isArray(value) ? value : [{ type: 'text', text: JSON.stringify(value) }]
          },
        },
        async execute(args, exec) {
          const blocks = await sidecar.call(tool.name, args, exec.signal)
          return toDshContent(blocks, getAttachments())
        },
      }
      try {
        disposers.set(tool.name, ctx.tools.register(definition))
      } catch (err) {
        // 名字与已有工具冲突时不让一个失败拖垮其余工具。
        log(`register ${tool.name} failed: ${err?.message ?? err}`)
      }
    }
  }

  return {
    registerFrom,
    registered: () => [...disposers.keys()],
    dispose() {
      for (const dispose of disposers.values()) dispose()
      disposers.clear()
    },
  }
}