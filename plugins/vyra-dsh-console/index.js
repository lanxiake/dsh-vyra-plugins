import { createConsole } from './core.js'
import { createConsoleTool } from './tool.js'
import { consoleDomain } from './domains/console.js'
import { pluginDomain } from './domains/plugin.js'
import { modelDomain } from './domains/model.js'
import { settingsDomain } from './domains/settings.js'
import { catalogDomain } from './domains/catalog.js'

export const name = 'vyra-dsh-console'
export const inject = ['tools']

/**
 * Resolve the schemastery module that builds `Config`.
 *
 * A *static* `import '@deepseek-ai/schemastery'` cannot be used here. This
 * plugin is plain ESM with no build step and no `node_modules` of its own, and
 * the host's copy lives inside the packaged application rather than beside this
 * file, so the specifier does not resolve from the repo's paths at all: the
 * import would throw `ERR_MODULE_NOT_FOUND`, taking the whole plugin — and the
 * test suite that imports it — down with it. That is the same constraint
 * `dsh-expert-orchestrator/lib/host-settings.js` documents, and this follows the
 * resolution order it established: the scoped host package first, then the bare
 * name, which a profile that hoists another plugin's dependency may provide.
 *
 * The scoped-then-bare order matters because both are `schemastery`; only the
 * scoped one is the host's own build.
 */
const SCHEMASTERY_SPECIFIERS = ['@deepseek-ai/schemastery', 'schemastery']

async function loadSchemastery() {
  for (const specifier of SCHEMASTERY_SPECIFIERS) {
    try {
      return await import(specifier)
    } catch {
      // A resolution miss is the expected outcome on a bare checkout, and the
      // next specifier is the whole point of the loop.
    }
  }
  return null
}

/**
 * Build the plugin's `Config` schema, or `undefined` when schemastery is
 * unavailable.
 *
 * `undefined` is a supported answer rather than a failure: the Loader reads an
 * absent `Config` as "this entry has no settings page" and starts the plugin
 * normally (`@deepseek-ai/cordis` `Plugin.Runtime` / `resolveConfig`, which
 * returns the raw config unchanged when there is no schema). The alternative —
 * a hand-rolled stand-in — would misdeclare the Loader's validation protocol,
 * which is why `vyra-smart-compaction` declines to fake one for the same
 * reason. Degrading loses the settings form; it must not lose the plugin.
 *
 * `confirmDestructive` is the only option, and it is `false` by default so an
 * existing profile's behaviour is unchanged until someone opts in.
 *
 * Exported so the schema it builds can be tested directly. The top-level
 * `Config` export is `undefined` on any checkout where schemastery cannot be
 * resolved — which includes this repo's own test run — so a test that only
 * inspected `Config` would pass without ever executing this function.
 */
export async function buildConfigSchema(load = loadSchemastery) {
  const mod = await load()
  const Schema = mod?.default ?? mod
  if (typeof Schema?.object !== 'function' || typeof Schema?.boolean !== 'function') return undefined
  try {
    return Schema.object({
      confirmDestructive: Schema.boolean()
        .default(false)
        .description(
          'Require confirm: true on irreversible actions such as plugin.remove '
          + '(需要 confirm: true 才能执行 plugin.remove 等不可逆操作)',
        ),
    })
  } catch {
    // A decoration the host's schemastery build does not support must not stop
    // the plugin from loading; no settings page is the acceptable loss.
    return undefined
  }
}

/**
 * The plugin's top-level `Config` export.
 *
 * It is a promise-resolved value because schemastery can only be reached
 * asynchronously; Cordis awaits a module namespace before reading `Config` off
 * it, so awaiting here is the supported shape.
 */
export const Config = await buildConfigSchema()

/**
 * Read `confirmDestructive` off the config the Loader supplied.
 *
 * Deliberately a strict `=== true` rather than a truthy test or a default
 * merge. Two cases have to give the same answer:
 *   - `Config` resolved, so Cordis validated the raw config and applied the
 *     schema's `.default(false)` before calling `apply` (`fiber.ts`:
 *     `resolveConfig` → `runtime.callback(ctx, config)`);
 *   - `Config` is `undefined` here, so Cordis returned the raw config
 *     unchanged and nothing filled in a default.
 * Strict equality is correct in both, and it also refuses to read a
 * neighbouring key or a truthy non-boolean as consent for an irreversible
 * action — the only failure mode with real consequences.
 */
function confirmDestructiveFrom(config) {
  return config?.confirmDestructive === true
}

export function apply(ctx, config) {
  // Every domain that backs a registered action must be wired here: the
  // dispatcher reports `no handler for domain "x"` for a registered action
  // whose domain is absent, which reads as a broken action rather than as a
  // missing service.
  //
  // These imports are static and stay that way: a domain file that is missing
  // or misspelled has to fail the load loudly. Only schemastery above is
  // allowed to degrade, because only it is an optional host package rather
  // than a part of this plugin.
  const console_ = createConsole(
    ctx,
    {
      console: consoleDomain,
      plugin: pluginDomain,
      model: modelDomain,
      settings: settingsDomain,
      catalog: catalogDomain,
    },
    { confirmDestructive: confirmDestructiveFrom(config) },
  )
  ctx.tools.register(createConsoleTool(console_))
  ctx.logger?.info?.(`vyra-dsh-console: ${console_.listActions().length} actions`)
}
