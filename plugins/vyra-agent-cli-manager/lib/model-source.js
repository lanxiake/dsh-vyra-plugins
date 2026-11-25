/**
 * Which model a CLI should run on, and the environment that tells it so.
 *
 * A CLI only knows the providers it was built for: Claude Code reads `ANTHROPIC_BASE_URL`,
 * `ANTHROPIC_AUTH_TOKEN` and `ANTHROPIC_MODEL`; Codex reads `OPENAI_*`. The harness knows its
 * own providers (a DeepSeek account, or any OpenAI-compatible endpoint a user configured), and
 * a CLI can only use one of those when this plugin translates the provider into the variables
 * that CLI understands. That translation is per-CLI configuration (`agents[].models`), never
 * guessed: a provider picked on the user's behalf could send their code, and the bill, to an
 * endpoint they never chose.
 *
 * The choice itself is made in the 设置 panel and belongs to the user, so it is stored in the
 * browser rather than in this file.
 * @module dsh-vyra-agent-cli-manager/model-source
 */

/** The browser records this choice per CLI; the host reads the same value from the panel. */
export const MODEL_SOURCE_DSH = 'dsh'
export const MODEL_SOURCE_CLI = 'cli'

/**
 * Whether a raw value is one of the two sources this plugin offers.
 * @param value - a value read from the browser or a request body.
 * @returns true for `dsh` and `cli`.
 */
export const isModelSource = (value) => value === MODEL_SOURCE_DSH || value === MODEL_SOURCE_CLI

const isText = (value) => typeof value === 'string' && value.trim() !== ''

/**
 * Check a configured model route. Only `provider` and `model` are required, because a CLI that
 * talks to its vendor's own endpoint needs nothing else; the rest is filled from the harness's
 * provider settings when it is left out.
 * @param route - one `agents[].models` entry, as read from the patch config.
 * @returns a bare copy, so a later mutation cannot write back into the configuration.
 */
function readRoute(route) {
  const envNames = Array.isArray(route.envNames)
    ? route.envNames.filter((name) => typeof name === 'string' && name !== '')
    : []
  return {
    provider: isText(route.provider) ? route.provider.trim() : '',
    model: isText(route.model) ? route.model.trim() : '',
    ...(isText(route.baseURL) ? { baseURL: route.baseURL.trim() } : {}),
    ...(isText(route.apiKeyEnv) ? { apiKeyEnv: route.apiKeyEnv.trim() } : {}),
    ...(isText(route.providerBaseURL) ? { providerBaseURL: route.providerBaseURL.trim() } : {}),
    ...(envNames.length === 0 ? {} : { apiKeyEnvs: envNames }),
  }
}

/**
 * Index the configured routes by CLI id.
 * @param agents - the `agents` list from the plugin config.
 * @returns one route per CLI that declares one; CLIs without one have no entry.
 */
export function readModelRoutes(agents) {
  const routes = new Map()
  for (const agent of Array.isArray(agents) ? agents : []) {
    if (!isText(agent?.id) || agent.models === undefined || agent.models === null) continue
    const route = readRoute(agent.models)
    // A route naming neither a provider nor a model is "follow the CLI", which is what an
    // absent route means too; keeping it would only make the settings page offer a switch that
    // does nothing.
    if (route.provider === '' || route.model === '') continue
    routes.set(agent.id.trim(), route)
  }
  return routes
}

/**
 * Fill a route's endpoint and credential name from what the harness configured for that
 * provider, so the patch file only has to name a provider and a model.
 *
 * Only routes that already name a provider are filled: `provider` is what the user chose, and
 * nothing here is allowed to pick one. A provider the harness does not know leaves the fields
 * empty, which the caller reports rather than guesses around, except for the one case where
 * there is nothing to guess: a vendor CLI (Claude Code) has to be pointed at the endpoint of the
 * provider it is told to run, so a declared provider with no address falls back to that
 * provider's published default. That default belongs to the provider, not to this plugin.
 * @param route - the configured route.
 * @param lookup - returns one entry of the harness's provider directory, when it offers one.
 * @returns the route with `baseURL` and `apiKeyEnv` filled in where they were left out.
 */
export function resolveRoute(route, lookup) {
  const entry = lookup(route.provider)
  const fallback = isText(entry?.baseURL) ? entry.baseURL : isText(route.providerBaseURL) ? route.providerBaseURL : undefined
  return {
    ...route,
    ...(route.baseURL === undefined && fallback !== undefined ? { baseURL: fallback } : {}),
    ...(route.apiKeyEnv === undefined && isText(entry?.apiKeyEnv) ? { apiKeyEnv: entry.apiKeyEnv } : {}),
  }
}

/**
 * The raw `agents[].models` entry for one CLI, times defaults kept exactly as written.
 *
 * `readModelRoutes` drops a route that names no provider, which is right for the settings page —
 * there is nothing to follow — but the variable names are read separately, and a route with no
 * names is what tells the caller it cannot be applied at all.
 * @param agents - the `agents` list from the plugin config.
 * @param id - the CLI id.
 * @returns the entry, with empty strings for what the user left out.
 */
export function modelRoutesOf(agents, id) {
  for (const agent of Array.isArray(agents) ? agents : []) {
    if (agent?.id !== id || agent.models === undefined || agent.models === null) continue
    const models = agent.models
    const text = (value) => (isText(value) ? value.trim() : '')
    return {
      baseURLEnv: text(models.baseURLEnv),
      apiKeyEnv: text(models.apiKeyEnv),
      apiKeyEnvs: Array.isArray(models.apiKeyEnvs) ? models.apiKeyEnvs.filter(isText).map((name) => name.trim()) : [],
      modelEnv: text(models.modelEnv),
      defaultModel: text(models.defaultModel),
    }
  }
  return undefined
}

/**
 * The environment that points one CLI at a provider.
 *
 * `model` is the CLI's own idea of "default": `vendor/id`, the form every CLI writes down for a
 * model served by an OpenAI-compatible endpoint. Any other id is passed through unchanged, so a
 * row the CLI itself reported still selects exactly that row.
 * @param route - the resolved route.
 * @param modelId - the model id the harness selected, or the CLI's `default`.
 * @param apiKey - the credential's value, or undefined when it could not be resolved.
 * @param variables - the CLI's own environment variable names.
 * @returns the variables to add to the CLI's environment; empty when the route cannot be used.
 */
export function modelEnvironment(route, modelId, apiKey, variables) {
  const { baseURL, apiKeyEnvs, modelEnv, defaultModel } = variables
  if (!isText(baseURL?.name) || !isText(modelEnv?.name) || route.baseURL === undefined) return {}
  const env = { [baseURL.name]: route.baseURL, [modelEnv.name]: modelId === 'default' ? (defaultModel ?? route.model) : modelId }
  if (apiKey === undefined || apiKey === '') return env
  const names = apiKeyEnvs === undefined || apiKeyEnvs.length === 0 ? [variables.apiKeyEnv?.name] : apiKeyEnvs.map((entry) => entry.name)
  // The same secret under every name the CLI might read, so a CLI that accepts either the
  // token or the key form is covered without a second setting.
  for (const name of names) {
    if (isText(name)) env[name] = apiKey
  }
  return env
}

/**
 * A one-line description of what a CLI will run on, for the settings page. Never includes the
 * credential: the panel shows where a model comes from, not what unlocks it.
 * @param route - the configured route, resolved or not.
 * @param source - the source the user picked.
 * @param baseURLFromProvider - whether the endpoint came from the harness rather than the route.
 * @returns the label and a hint line.
 */
export function describeRoute(route, source, baseURLFromProvider = false) {
  if (source !== MODEL_SOURCE_DSH) {
    return { title: '使用 CLI 自己的配置', hint: '按这个 CLI 自己的设置和登录状态运行。' }
  }
  const endpoint = `${route.provider} · ${route.model}`
  const from = baseURLFromProvider ? 'DSH 配置里的接口地址' : '插件配置里的接口地址'
  const missing = route.baseURL === undefined ? '（未配置接口地址，调用会失败）' : ''
  return {
    title: `跟随 DSH：${endpoint}`,
    hint: `通过${from}${missing} 调用，使用 DSH 里配置的凭据。`,
  }
}

/**
 * The default source for a CLI: `dsh` when the patch config declared a route for it, otherwise
 * the CLI's own configuration. A CLI nobody declared a route for has nothing to follow, and the
 * settings page does not offer it a switch at all.
 * @param routes - routes by CLI id.
 * @param id - the CLI id.
 * @returns the source the panel starts the row on.
 */
export function defaultSourceFor(routes, id) {
  return routes.has(id) ? MODEL_SOURCE_DSH : MODEL_SOURCE_CLI
}
