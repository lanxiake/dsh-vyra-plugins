/**
 * Host half: authenticated media routes.
 *
 * `/api/vyra-media/file` streams one workspace file with Range support;
 * `/api/vyra-media/list` walks the Session workspace for media metadata.
 * Both are exact Fetch routes on the Host connection bridge, so they inherit
 * the browser token, Desktop private cookie, and source checks.
 */
import { registerMediaRoutes } from './lib/routes.js'

export const name = 'vyra-media-studio'

/** The routes need the filesystem seam and the Session workspace resolver. */
export const inject = ['fs', 'workspaceFiles']

/**
 * Register the routes when the Host connection service is available.
 * @param {object} ctx - Host plugin context.
 */
export function apply(ctx) {
  ctx.inject(['connection'], (scoped) => {
    try {
      registerMediaRoutes(scoped, scoped.connection)
    } catch (error) {
      const message = `[vyra-media-studio] cannot register media routes: ${error?.message ?? error}`
      if (typeof scoped.logger?.warn === 'function') scoped.logger.warn(message)
      else console.warn(message)
    }
  })
}
