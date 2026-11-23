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
 *
 * ## Why `settings.set` is not a way around `FORBIDDEN`
 *
 * A namespace IS a Loader entry id, and `update()` writes that entry's `config`.
 * On the real desktop profile one such entry is
 *
 *     - id: permission
 *       name: '@deepseek-ai/dsh-permission-presets'
 *       config: { presets: {…}, defaultPreset: danger-full-access }
 *
 * so `settings.set { ns: 'permission', patch: { defaultPreset: … } }` reaches
 * this session's own sandbox and approval policy — the outcome `FORBIDDEN`
 * refuses `permission.setPreset` for. The same holds for the other refused
 * actions: any entry whose config carries a sandbox mode, an approval policy, an
 * approval answer or a credential is reachable by writing that entry's config.
 *
 * `settings.set` therefore stands aside from those namespaces BEFORE calling the
 * service, and reports the same shape as a `FORBIDDEN` entry so a caller and the
 * panel treat the two identically.
 *
 * ## What the guard can and cannot prove
 *
 * This is a denylist of consequence, not a proof of safety. It refuses a write
 * when the target entry is one whose config is known to carry authority, and
 * when the target's owning package cannot be established at all. It does NOT
 * claim that every other namespace is harmless: a plugin could expose the same
 * knobs under a differently-named entry, and this plugin cannot enumerate the
 * meaning of arbitrary configuration. What it does guarantee is that the
 * specific entries that carry the withheld authority are named here explicitly,
 * so adding one is a visible, reviewable edit rather than an accident.
 *
 * The decision keys on the entry's PACKAGE rather than on a namespace string.
 * `describe()` cannot supply the package — no descriptor field names it — but
 * the namespace is an entry id, and `pluginManager.listPlugins()` maps every
 * `entryId` to its `moduleName`, which is the package. A renamed entry is
 * therefore still covered, which a hard-coded namespace would not be.
 */

/**
 * Packages whose Loader config carries authority this plugin withholds from the
 * agent. Adding to this list is the one place the boundary is widened or
 * narrowed, and each entry names the `FORBIDDEN` action it corresponds to.
 */
const AUTHORITY_PACKAGES = Object.freeze({
  '@deepseek-ai/dsh-permission-presets': {
    because: 'permission.setPreset',
    reason: 'That namespace configures this session\'s own sandbox and approval policy.',
    alternative: 'Ask the user to change it in Settings → Permissions, or via /permission.',
  },
})

/**
 * The refusal used when the target belongs to an entry whose owning package
 * cannot be established: an unjudgeable namespace is not a safe one.
 */
const UNJUDGEABLE = Object.freeze({
  reason: 'That namespace belongs to an entry this profile does not report, so it cannot be checked against the authority boundary.',
  alternative: 'Ask the user to change it in Settings, or use the owning plugin\'s own settings form.',
})

/**
 * The descriptors the authority guard decides on.
 *
 * `redactSecrets: true` is REQUIRED here, and a bare `describe()` cannot be used
 * instead: the host attaches the `secrets` field only when that option is passed
 * (`@deepseek-ai/dsh-settings`, `...options?.redactSecrets ? { secrets:
 * redacted.secrets } : {}`). Without it no descriptor ever carries `secrets`, so
 * the credential branch below would be unreachable — present in the code and
 * dead at runtime, which is the worst of both: it reads as a protection that is
 * not there.
 *
 * `dsh-workflow-lite` calls it the same way (`lib/index.mjs`, `describe({
 * redactSecrets: true })`), and it reads `value`/`base` off the result as normal
 * values, so the option redacts the `secrets` field rather than the
 * configuration beside it.
 *
 * A SEPARATE call from the ones `settings.list`/`settings.get` make. Those hand
 * configuration back to a caller, and this guard has no business changing what
 * they see; redaction is asked for only where the `secrets` field is the thing
 * being read. A read path that never needed the option keeps its behaviour
 * exactly.
 */
function guardDescriptors(service) {
  return service.describe({ redactSecrets: true })
}

/**
 * Decide whether `ns` may be written, and say why not when it may not.
 *
 * Exported as one function rather than an inline condition in the `switch`, so
 * there is exactly one place this decision is made and it can be tested
 * directly.
 *
 * @param ctx the dispatcher's context, used to reach `pluginManager`.
 * @param ns the namespace being written; also the Loader entry id.
 * @param descriptor the live `SettingsDescriptor` for `ns`, taken from
 *   {@link guardDescriptors} so that its `secrets` field is actually present.
 * @returns `null` when the write may proceed, otherwise the refusal body.
 */
export async function refuseAuthorityNamespace(ctx, ns, descriptor) {
  // The credential outcome, and the one signal a descriptor carries on its own:
  // `secrets` marks fields holding secret material, which is what
  // `credentials.set` is refused for. Checked before the package lookup because
  // it needs no entry information.
  if (descriptor !== undefined && descriptor.secrets !== undefined) {
    return {
      reason: 'That namespace holds credential material, which is reserved for the user.',
      alternative: 'Ask the user to enter it in Settings.',
    }
  }

  const pluginManager = ctx.get('pluginManager')
  if (!pluginManager || typeof pluginManager.listPlugins !== 'function') {
    return UNJUDGEABLE
  }

  let entries
  try {
    entries = await pluginManager.listPlugins()
  } catch {
    // A loader that cannot answer is not evidence that the namespace is safe.
    return UNJUDGEABLE
  }

  const entry = Array.isArray(entries) ? entries.find((candidate) => candidate?.entryId === ns) : undefined
  // An entry the manager does not list is one whose package cannot be checked;
  // the namespace passed `describe()`, so it exists — refusing is the safe read.
  if (!entry) return UNJUDGEABLE

  // A listed entry with no usable package name is the SAME situation as an
  // unlisted one: the owning package cannot be established, so the namespace
  // cannot be checked. Refusing only the unlisted case while letting this one
  // through would fail closed in one direction and open in the other for the
  // same reason, which is not a boundary anyone can reason about. `undefined`
  // and `''` are both "no name"; `null` is not a string either.
  //
  // Unreachable through the shipped host — a nameless entry throws on import and
  // never gets a fiber, so it can never own a settings namespace — but that is
  // exactly the region where this guard's guarantee is claimed, so it is pinned
  // rather than left to hold by accident.
  if (typeof entry.moduleName !== 'string' || entry.moduleName === '') return UNJUDGEABLE

  const known = AUTHORITY_PACKAGES[entry.moduleName]
  if (known === undefined) return null

  // `because` names the FORBIDDEN action this namespace would otherwise reach.
  // It rides in the refusal so the correspondence is visible to whoever reads
  // the result, not only to whoever reads this file.
  return {
    reason: `${known.reason} (reaches the same authority as the refused action "${known.because}")`,
    alternative: known.alternative,
  }
}

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
      const descriptor = guardDescriptors(service).find((d) => d.ns === args.ns)
      if (!descriptor) {
        return { status: 'error', action, reason: `no settings namespace "${args.ns}"` }
      }
      // Checked BEFORE `update()`, never after: this is a refusal to perform the
      // write, not a report on one that already happened.
      const refusal = await refuseAuthorityNamespace(ctx, args.ns, descriptor)
      if (refusal) {
        // The same envelope a FORBIDDEN action produces, so both callers and the
        // panel read the authority boundary as one thing.
        return { status: 'forbidden', action, ...refusal }
      }
      await service.update(args.ns, args.patch)
      return { status: 'ok', ns: args.ns }
    }
    default:
      return { status: 'error', action, reason: `settings domain has no action "${action}"` }
  }
}
