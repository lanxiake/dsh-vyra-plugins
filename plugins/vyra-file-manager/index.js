/**
 * Host half: authenticated media routes.
 *
 * `/api/vyra-media/file` streams one workspace file with Range support;
 * `/api/vyra-media/list` walks the Session workspace for files.
 *
 * Both are exact Fetch routes on the Host connection bridge, so they inherit
 * the browser token, Desktop private cookie, and source checks.
 *
 * Cordis service access note: only services named in {@link inject} may be read
 * as properties (`ctx.fs`, `ctx.workspaceFiles`); reading any other service by
 * property throws "cannot get property ... without inject". Everything the
 * handlers probe at request time therefore goes through
 * `ctx.get(name, false)`, which returns undefined instead of throwing.
 */
import { registerMediaRoutes } from './lib/routes.js'

export const name = 'dsh-vyra-file-manager'

/** The routes need the filesystem seam and the Session workspace resolver. */
export const inject = ['fs', 'workspaceFiles']

/**
 * Register the routes when the Host connection service is available.
 * @param {object} ctx - Host plugin context.
 */
export function apply(ctx) {
  ctx.inject(['connection'], (scoped) => {
    try {
      // Pass the root context, not the connection-scoped one: the handlers
      // probe sibling services through `ctx.get`, and a scoped context does not
      // necessarily expose them.
      registerMediaRoutes(ctx, scoped.connection)
    } catch (error) {
      const message = `[dsh-vyra-file-manager] cannot register media routes: ${error?.message ?? error}`
      let logger
      try { logger = scoped.get?.('logger', false) } catch { logger = undefined }
      if (typeof logger?.warn === 'function') logger.warn(message)
      else console.warn(message)
    }
  })
}