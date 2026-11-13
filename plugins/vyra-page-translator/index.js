// Host half of vyra-page-translator.
// Exposes POST /api/page-translator/rpc, wrapping ctx.translator (bing/google) and ctx.llm.
import { createTranslateService, LANGUAGES } from './translate-core.js'

export const name = 'vyra-page-translator'

const DEFAULTS = { source: 'auto', target: 'zh-Hans', provider: 'bing' }

export function apply(ctx) {
  const webServer = ctx.get('webServer')
  if (!webServer || typeof webServer.register !== 'function') return

  // Services may come up after this plugin applies, so resolve them per request and rebuild the
  // translate service (and its cache) only when the set of available services changes.
  let service = null
  let deps = null
  function getService() {
    const next = { translator: ctx.get('translator'), llm: ctx.get('llm'), agentDefaultModel: ctx.get('agentDefaultModel') }
    if (!service || next.translator !== deps.translator || next.llm !== deps.llm || next.agentDefaultModel !== deps.agentDefaultModel) {
      deps = next
      service = createTranslateService(next)
    }
    return service
  }

  // Diagnostic: the Client half pings on load, so `op:'status'` tells us whether the browser
  // module was actually fetched and applied.
  let lastClientPing = null
  const notes = []

  async function dispatch(body, signal) {
    const service = getService()
    switch (String(body.op || '')) {
      case 'ping':
        lastClientPing = new Date().toISOString()
        return { pong: true, at: lastClientPing }
      case 'note':
        notes.push(`${new Date().toISOString()} ${String(body.message || '')}`)
        if (notes.length > 40) notes.shift()
        return { noted: true }
      case 'status':
        return { clientSeen: lastClientPing !== null, lastClientPing, notes: [...notes] }
      case 'providers': {
        const providers = await service.providers()
        const first = providers.find((p) => p.id === DEFAULTS.provider) || providers[0]
        return {
          providers,
          languages: LANGUAGES,
          defaults: { ...DEFAULTS, provider: first ? first.id : DEFAULTS.provider },
        }
      }
      case 'translate': {
        if (!Array.isArray(body.texts) || !body.texts.every((t) => typeof t === 'string')) {
          throw new Error('texts must be an array of strings')
        }
        const texts = await service.translate(
          {
            texts: body.texts,
            target: String(body.target || DEFAULTS.target),
            source: String(body.source || DEFAULTS.source),
            provider: String(body.provider || DEFAULTS.provider),
          },
          signal,
        )
        return { texts }
      }
      default:
        throw new Error(`unknown op: ${body.op}`)
    }
  }

  ctx.effect(
    () =>
      webServer.register({
        kind: 'exact',
        path: '/api/page-translator/rpc',
        handler: async (req, res) => {
          const abort = new AbortController()
          res.on('close', () => {
            if (!res.writableEnded) abort.abort()
          })
          let payload
          try {
            const chunks = []
            for await (const chunk of req) chunks.push(chunk)
            const text = Buffer.concat(chunks).toString('utf8')
            const body = text ? JSON.parse(text) : {}
            payload = { ok: true, ...(await dispatch(body, abort.signal)) }
          } catch (error) {
            payload = { ok: false, error: String(error && error.message ? error.message : error) }
          }
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
          res.end(JSON.stringify(payload))
        },
      }),
    'page-translator.route',
  )
}
