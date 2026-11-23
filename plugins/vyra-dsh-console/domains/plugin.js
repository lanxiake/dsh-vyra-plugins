import { present, presentDeep, requireService } from '../core.js'

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
 *
 * The two levels have two different setters, keyed by two different
 * identifiers, and mixing them up silently changes the wrong thing:
 * `setPluginEnabled(id: PluginEntryId, enabled)` takes a Loader `entryId`,
 * while `setBundleEnabled(name: string, enabled)` takes a bundle package
 * `name` (`@deepseek-ai/dsh-plugin-manager/src/index.ts`). `plugin.setEnabled`
 * therefore dispatches on which identifier the caller supplied: `id` selects
 * the entry, `name` the bundle.
 */

/**
 * Project a `ChangeResult` onto the fields worth returning.
 *
 * `change()` (`@deepseek-ai/dsh-plugin-manager/src/index.ts`) always populates
 * `changed`, `application`, `stage` and `target`; everything else is optional.
 * The optional fields go through `present()` so an unset one is omitted rather
 * than emitted as an `undefined` key, which the tool pipeline's lossless-JSON
 * snapshot would reject for the whole value.
 *
 * Every field is named here rather than spread in from the service, so this can
 * never contribute a `status` key. Callers still set `status` *after* spreading
 * the summary, so even a future field named `status` could not replace the
 * status token — every action result carries one, and it is what the plugin's
 * contract is read by.
 */
function changeSummary(change) {
  return present({
    changed: change.changed,
    application: change.application,
    stage: change.stage,
    target: change.target,
    enabled: change.enabled,
    restartReason: change.restartReason,
    warnings: change.warnings,
    bundle: change.bundle,
    version: change.version,
    // `packageResult` is the raw pnpm run record and `error` the manager's own
    // error object; both come from the service and may carry `undefined`
    // wherever the snapshot walk would see it, so they are cleaned deeply.
    packageResult: change.packageResult === undefined ? undefined : presentDeep(change.packageResult),
    error: change.error === undefined ? undefined : presentDeep(change.error),
  })
}

export async function pluginDomain(ctx, { action, args }) {
  const { service, missing } = requireService(ctx, 'pluginManager', action)
  if (missing) return missing

  switch (action) {
    case 'plugin.list': {
      const [plugins, bundles] = await Promise.all([service.listPlugins(), service.listBundles()])
      return {
        status: 'ok',
        // present() omits an optional field the service left unset instead of
        // emitting it as `undefined`, which the tool pipeline's lossless-JSON
        // snapshot rejects for the whole value (INVALID_TOOL_OUTPUT).
        plugins: plugins.map((p) => present({
          entryId: p.entryId,
          moduleName: p.moduleName,
          enabled: p.enabled,
          fiberPhase: p.fiberPhase,
          diagnostic: p.diagnostic,
          readOnlyReason: p.readOnlyReason,
        })),
        bundles: bundles.map((b) => present({
          name: b.name,
          enabled: b.enabled,
          installed: b.installed,
          available: b.availability,
          removable: b.removable,
          version: b.version,
          readOnlyReason: b.readOnlyReason,
        })),
      }
    }
    case 'plugin.setEnabled': {
      if (typeof args.enabled !== 'boolean') {
        return { status: 'error', action, reason: 'plugin.setEnabled needs a boolean enabled' }
      }
      // An entryId selects the Loader entry; a package name selects the bundle
      // layer. They are different identifiers on different methods, so a caller
      // that sent both does not know which it means — say so rather than
      // silently picking one and changing the wrong thing.
      const hasId = typeof args.id === 'string' && args.id !== ''
      const hasName = typeof args.name === 'string' && args.name !== ''
      if (hasId && hasName) {
        return {
          status: 'error',
          action,
          reason: 'plugin.setEnabled is ambiguous: pass either a Loader entryId in id or a bundle package name in name, not both',
        }
      }
      if (hasId) {
        if (typeof service.setPluginEnabled !== 'function') {
          return {
            status: 'error',
            action,
            reason: 'this pluginManager has no setPluginEnabled; pass a bundle package name in name instead',
          }
        }
        const change = await service.setPluginEnabled(args.id, args.enabled)
        return { ...changeSummary(change), status: 'ok' }
      }
      if (hasName) {
        if (typeof service.setBundleEnabled !== 'function') {
          return {
            status: 'error',
            action,
            reason: 'this pluginManager has no setBundleEnabled; pass a Loader entryId in id instead',
          }
        }
        const change = await service.setBundleEnabled(args.name, args.enabled)
        return { ...changeSummary(change), status: 'ok' }
      }
      return {
        status: 'error',
        action,
        reason: 'plugin.setEnabled needs either a Loader entryId in id or a bundle package name in name',
      }
    }
    case 'plugin.install': {
      if (typeof args.spec !== 'string' || args.spec === '') {
        return { status: 'error', action, reason: 'plugin.install needs a package spec string in spec' }
      }
      const change = await service.installBundle(args.spec)
      return { ...changeSummary(change), status: 'ok' }
    }
    case 'plugin.remove': {
      if (typeof args.name !== 'string' || args.name === '') {
        return { status: 'error', action, reason: 'plugin.remove needs a bundle package name in name' }
      }
      const change = await service.removeBundle(args.name)
      return { ...changeSummary(change), status: 'ok' }
    }
    default:
      return { status: 'error', action, reason: `plugin domain has no action "${action}"` }
  }
}
