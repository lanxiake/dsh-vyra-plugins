import { requireService } from '../core.js'

/**
 * Plugin inventory and enablement, over the Host's own pluginManager.
 *
 * Two different things are listed, and the distinction matters to a caller:
 * `plugins` are the running profile's Loader entries (`PluginInfo`: `entryId`,
 * `moduleName`, `enabled`, `fiberPhase`, an optional `readOnlyReason` — see
 * `@deepseek-ai/dsh-plugin-manager/src/types.ts`), while `bundles` are the
 * packages that contribute them (`BundleInfo`: `name`, `version`, `enabled`).
 * A bundle can be installed and disabled, and a plugin row inside an enabled
 * bundle can still be disabled on its own.
 */
export async function pluginDomain(ctx, { action, args }) {
  const { service, missing } = requireService(ctx, 'pluginManager', action)
  if (missing) return missing

  switch (action) {
    case 'plugin.list': {
      const [plugins, bundles] = await Promise.all([service.listPlugins(), service.listBundles()])
      return {
        status: 'ok',
        // Optional fields are spread conditionally, never assigned: an own key
        // holding `undefined` is not lossless JSON, and the tool pipeline
        // snapshots every successful value and rejects it (INVALID_TOOL_OUTPUT).
        plugins: plugins.map((p) => ({
          entryId: p.entryId,
          moduleName: p.moduleName,
          enabled: p.enabled,
          fiberPhase: p.fiberPhase,
          ...(p.diagnostic === undefined ? {} : { diagnostic: p.diagnostic }),
          ...(p.readOnlyReason === undefined ? {} : { readOnlyReason: p.readOnlyReason }),
        })),
        bundles: bundles.map((b) => ({
          name: b.name,
          enabled: b.enabled,
          installed: b.installed,
          available: b.availability,
          removable: b.removable,
          ...(b.version === undefined ? {} : { version: b.version }),
          ...(b.readOnlyReason === undefined ? {} : { readOnlyReason: b.readOnlyReason }),
        })),
      }
    }
    case 'plugin.setEnabled': {
      return {
        status: 'error',
        reason: 'plugin.setEnabled is implemented in Task 3',
      }
    }
    default:
      return { status: 'error', action, reason: `plugin domain has no action "${action}"` }
  }
}
