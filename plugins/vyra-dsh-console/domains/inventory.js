import { present, presentDeep } from '../core.js'

/**
 * The whole host inventory in one answer: which plugins and bundles this
 * profile runs, which MCP servers are configured, which skills the agent can
 * load, and which tools are registered.
 *
 * This is the Host half of "tell the agent what this installation has". The
 * Client half (`ui.list`) answers the complementary question — which surfaces
 * the interface offers and which plugin contributed each one — and neither can
 * answer the other's: the Loader entry list is process state, and the slot
 * ledger is browser state.
 *
 * Every inventory is read independently. A profile without `mcpManager`, a
 * loader that throws, a `tools` service with no schema listing — each becomes a
 * `caveats` entry naming what could not be read and why, and the rest of the map
 * still answers. A map that failed as a whole because one service was absent
 * would be useless on exactly the profiles that most need it.
 */
export async function inventoryDomain(ctx, { action }) {
  if (action !== 'console.map') {
    return { status: 'error', action, reason: `inventory domain has no action "${action}"` }
  }
  const caveats = []

  /**
   * Read one service, or record why it could not contribute.
   *
   * `key` is the service name — the thing the reader will actually need to fix
   * ("this profile has no mcpManager"), so it names the service rather than the
   * action that happened to need it.
   */
  function service(key) {
    const value = ctx.get(key)
    if (value === undefined || value === null) {
      caveats.push(`${key}: this profile has no ${key} service`)
      return undefined
    }
    return value
  }

  /** Run one read, converting a throw into a caveat rather than a failed map. */
  async function read(label, fn) {
    try {
      return await fn()
    } catch (error) {
      caveats.push(`${label}: ${String(error?.message || error)}`)
      return undefined
    }
  }

  const pluginManager = service('pluginManager')
  const plugins = pluginManager === undefined ? undefined : await read('pluginManager.listPlugins', async () =>
    (await pluginManager.listPlugins()).map((entry) => present({
      entryId: entry.entryId,
      moduleName: entry.moduleName,
      enabled: entry.enabled,
      fiberPhase: entry.fiberPhase,
      readOnlyReason: entry.readOnlyReason,
    })))
  const bundles = pluginManager === undefined ? undefined : await read('pluginManager.listBundles', async () =>
    (await pluginManager.listBundles()).map((entry) => present({
      name: entry.name,
      version: entry.version,
      enabled: entry.enabled,
      installed: entry.installed,
      removable: entry.removable,
      readOnlyReason: entry.readOnlyReason,
    })))

  const mcpManager = service('mcpManager')
  const mcp = mcpManager === undefined ? undefined : await read('mcpManager.list', () =>
    mcpManager.list().map((view) => present({
      name: view.name,
      configured: view.configured,
      // Only the fields the variant in force actually carries; the union's
      // members do not share their optional keys (see domains/catalog.js).
      state: view.status?.state,
      toolCount: view.status?.toolCount,
    })))

  const skills = service('skills')
  const skillRows = skills === undefined ? undefined : await read('skills.list', async () =>
    (await skills.list()).map((entry) => present({
      name: entry.name,
      description: entry.description,
      source: entry.source,
      provider: entry.provider,
    })))

  const tools = service('tools')
  let toolRows
  if (tools === undefined) {
    toolRows = undefined
  } else if (typeof tools.schemas !== 'function') {
    caveats.push('tools.schemas: this host exposes no schema listing')
  } else {
    toolRows = await read('tools.schemas', () =>
      tools.schemas().map((schema) => present({ name: schema.name, description: schema.description })))
  }

  return {
    status: 'ok',
    host: presentDeep({
      plugins,
      bundles,
      mcp,
      skills: skillRows,
      tools: toolRows,
      // Stated as data rather than left to be inferred from its absence: a
      // reader who sees no `client` key would have to guess whether the map
      // omitted it or the interface was merely not asked.
      client: { note: 'the live interface and its surfaces are reported by ui.list' },
    }),
    caveats,
  }
}
