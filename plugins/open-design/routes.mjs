/**
 * The settings page's HTTP surface.
 *
 * Two endpoints under `/open-design`:
 *
 *   GET    /open-design/config   what the panel renders
 *   PATCH  /open-design/config   change the enabled set, then sync
 *   POST   /open-design/agents   rebuild the agent presets only
 *
 * The handler is a pure function of (method, body, options) so it can be tested
 * without a server. `mountRoutes` wires it to the host's web server when one is
 * present; a profile without that service keeps the CLI and loses only the
 * panel, never the plugin.
 *
 * @module open-design/routes
 */

import { describe, applyToggle, regenerateAgents, skillCounts } from './state.mjs'

/** JSON response helper matching the shape the other vyra plugins send. */
function sendJson(response, status, body) {
  const text = JSON.stringify(body)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(text),
  })
  response.end(text)
}

async function readJsonBody(request, limit = 64 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > limit) throw new Error('请求体过大')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

/**
 * Answer one API call.
 *
 * @param {string} route 'config' | 'agents'
 * @param {string} method
 * @param {unknown} body
 * @param {{ dshHome?: string, root?: string }} options
 * @returns {{ status: number, body: unknown }}
 */
export function handle(route, method, body, options = {}) {
  if (route === 'config') {
    if (method === 'GET') {
      return { status: 200, body: { ...describe(options), counts: skillCounts(options.root) } }
    }
    if (method === 'PATCH') {
      const result = applyToggle({
        enabled: body?.enabled,
        dshHome: options.dshHome,
        root: options.root,
      })
      if (!result.ok) return { status: 400, body: { error: result.error, unknown: result.unknown } }
      const report = result.report
      return {
        status: 200,
        body: {
          // The panel refreshes from this rather than a second round trip.
          ...describe(options),
          counts: skillCounts(options.root),
          applied: {
            skillsWritten: report.skillsWritten,
            agentsWritten: report.agentsWritten,
            removed: report.removed,
            warnings: report.warnings,
          },
        },
      }
    }
    return { status: 405, body: { error: `不支持的方法 ${method}` } }
  }

  if (route === 'agents') {
    if (method !== 'POST') return { status: 405, body: { error: `不支持的方法 ${method}` } }
    const result = regenerateAgents({ dshHome: options.dshHome, root: options.root })
    if (!result.ok) return { status: 500, body: { error: result.error } }
    return {
      status: 200,
      body: {
        ...describe(options),
        counts: skillCounts(options.root),
        applied: { agentsWritten: result.report.agentsWritten },
      },
    }
  }

  return { status: 404, body: { error: '未知接口' } }
}

/**
 * Register the routes on the host's web server.
 *
 * @param {{ register: Function }} webServer
 * @param {{ dshHome?: string, root?: string }} options
 * @returns {Array<Function>} disposers
 */
export function mountRoutes(webServer, options = {}) {
  if (webServer === undefined || typeof webServer.register !== 'function') return []

  const disposers = []
  const install = (route, methods) => {
    const dispose = webServer.register({
      kind: 'exact',
      path: `/open-design/${route}`,
      handler: async (request, response) => {
        if (!methods.includes(request.method)) {
          // PATCH and POST carry a body; still answer 405 without reading it.
          return sendJson(response, 405, { error: `不支持的方法 ${request.method}` })
        }
        let body
        try {
          body = request.method === 'GET' ? undefined : await readJsonBody(request)
        } catch (error) {
          return sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
        }
        try {
          const answer = handle(route, request.method, body, options)
          return sendJson(response, answer.status, answer.body)
        } catch (error) {
          return sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    })
    if (typeof dispose === 'function') disposers.push(dispose)
  }

  install('config', ['GET', 'PATCH'])
  install('agents', ['POST'])
  return disposers
}