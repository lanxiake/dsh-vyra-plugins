import { present, presentDeep, requireService } from '../core.js'

/**
 * Read and write the profile's settings namespaces.
 *
 * `settings` (see `@deepseek-ai/dsh-settings/src/index.ts`) is the schema-derived
 * configuration service: `describe()` returns one live `SettingsDescriptor` per
 * active Loader entry that declares a form, and `update(ns, patch)` merges
 * `patch` into that entry's config section.
 *
 * A `SettingsDescriptor` carries exactly `ns`, `autoGenerate`, `schema`,
 * `value`, `revision`, `applies: 'live'`, and optionally `base`, `user` and
 * `secrets`. It has no `title` and no display name of any kind — the Client
 * panel resolves those from its own locales — so `settings.list` maps the real
 * fields only.
 */
export async function settingsDomain(ctx, { action, args }) {
  // Argument validation comes first, so a malformed call is reported as a bad
  // request even on a profile that has no settings service at all. Resolving the
  // service first would report it as `unavailable` and hide the caller's error.
  if (action === 'settings.set' || action === 'settings.get') {
    if (typeof args.ns !== 'string' || args.ns === '') {
      return { status: 'error', action, reason: `${action} needs a non-empty namespace string in ns` }
    }
  }
  if (action === 'settings.set' && (args.patch === null || typeof args.patch !== 'object' || Array.isArray(args.patch))) {
    return { status: 'error', action, reason: 'settings.set needs patch to be a plain object' }
  }

  const { service, missing } = requireService(ctx, 'settings', action)
  if (missing) return missing

  switch (action) {
    case 'settings.list': {
      return {
        status: 'ok',
        // The optional descriptor fields go through present(): a `base`/`user`
        // holding undefined would abort the tool pipeline's whole snapshot.
        namespaces: service.describe().map((d) => present({
          ns: d.ns,
          autoGenerate: d.autoGenerate,
          revision: d.revision,
          applies: d.applies,
          base: d.base,
          user: d.user,
        })),
      }
    }
    case 'settings.get': {
      const found = service.describe().find((d) => d.ns === args.ns)
      if (!found) {
        return { status: 'error', action, reason: `no settings namespace "${args.ns}"` }
      }
      // The whole descriptor is returned, but rebuilt rather than forwarded: the
      // lossless-JSON rule is this plugin's own contract, so it cannot depend on
      // the service having omitted its optional fields. `value`, `base`, `user`
      // and `schema` are arbitrary user configuration, so the cleaning is deep.
      return { status: 'ok', namespace: presentDeep(found) }
    }
    case 'settings.set': {
      // Refuse a namespace that does not exist, so a typo cannot silently
      // create an unreachable config section.
      if (!service.describe().some((d) => d.ns === args.ns)) {
        return { status: 'error', action, reason: `no settings namespace "${args.ns}"` }
      }
      await service.update(args.ns, args.patch)
      return { status: 'ok', ns: args.ns }
    }
    default:
      return { status: 'error', action, reason: `settings domain has no action "${action}"` }
  }
}
