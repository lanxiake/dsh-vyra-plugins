/**
 * The Kilo lane adapter.
 *
 * One route (`vyra-free`) serves the whole free pool. The harness groups the
 * model picker strictly by provider route and offers no other grouping field, so
 * a single route is what makes the picker show one clean "免费模型" group.
 *
 * The adapter satisfies the harness contract structurally — `registerAdapter`
 * validates by calling the methods, not by an `instanceof` test.
 *
 * @module src/adapter.js
 */

/** The one provider route this plugin publishes. */
export const ROUTE = 'vyra-free'

/** What the picker shows as the group heading. Nothing else may be here. */
const ROUTE_LABEL = '免费模型'

/**
 * A catalog row.
 *
 * `efforts`/`defaultEffort` are part of the shape from the start even when the
 * upstream declares no menu: the settings page and `resolveModel` both read
 * them unconditionally, and a shape that gains a key later would break every
 * consumer that already compares whole rows.
 *
 * @typedef {object} CatalogEntry
 * @property {string} id
 * @property {string} name
 * @property {number} contextWindow
 * @property {number} maxOutput
 * @property {boolean} vision
 * @property {readonly string[] | undefined} efforts
 * @property {string | undefined} defaultEffort
 */

/** Default ceiling for one reply when the model does not name its own. */
const DEFAULT_MAX_TOKENS = 32768

export class KiloAdapter {
  /**
   * @param {object} dependencies
   * @param {() => { catalog: CatalogEntry[], settings: object }} dependencies.state
   * @param {(block: object) => Promise<string | undefined>} [dependencies.resolveImage]
   */
  constructor(dependencies) {
    this.deps = dependencies
  }

  providerInfo(provider) {
    return { id: provider, name: ROUTE_LABEL }
  }

  /**
   * A fully resolved policy, not a configuration fragment: the backoff scheduler
   * reads the delay fields off the top level, and a nested object turns every
   * scheduled delay into NaN.
   *
   * `RATE_LIMIT` is deliberately absent — the free pool answers 429 with a
   * model-level window, so retrying only lengthens the wait.
   */
  providerRetryPolicy() {
    return Object.freeze({
      mode: 'normal',
      maxRetries: 1,
      retryableCodes: Object.freeze(['SERVER', 'TIMEOUT', 'TRANSPORT']),
      initialDelayMs: 700,
      maxDelayMs: 6000,
      jitterRatio: 0.2,
    })
  }

  /** Models this route advertises right now. */
  async listModels(provider) {
    const state = this.deps.state()
    // The master switch takes the group out of the picker without unloading the
    // plugin: a route with no models is dropped by the client.
    if (state.settings?.enabled === false) return []
    return state.catalog.map(entry => ({
      provider,
      id: entry.id,
      name: entry.name,
      inputModalities: entry.vision ? ['text', 'image'] : ['text'],
    }))
  }

  async resolveModel(provider, model) {
    const state = this.deps.state()
    const entry = state.catalog.find(candidate => candidate.id === model)
    if (entry === undefined) {
      return {
        provider,
        id: model,
        name: model,
        context: { contextWindow: 131072 },
        defaultMaxTokens: DEFAULT_MAX_TOKENS,
      }
    }
    const efforts = menuFor(entry)
    return {
      provider,
      id: entry.id,
      name: entry.name,
      inputModalities: entry.vision ? ['text', 'image'] : ['text'],
      context: { contextWindow: entry.contextWindow },
      defaultMaxTokens: Math.min(entry.maxOutput, DEFAULT_MAX_TOKENS),
      ...efforts === undefined ? {} : { reasoning: { efforts, defaultEffort: defaultEffortFor(entry) } },
    }
  }

  /**
   * Bind model metadata and the dispatch closure to one state snapshot, so a
   * catalog refresh arriving mid-turn cannot mix one generation's capacities with
   * another's endpoint table.
   */
  async prepareCall(provider, model) {
    const snapshot = this.deps.state()
    const entry = snapshot.catalog.find(candidate => candidate.id === model) ?? null
    return {
      model: await this.resolveModel(provider, model),
      stream: options => this.stream(options, entry, snapshot),
    }
  }

  /**
   * Stream one turn. Implemented in Task 3.
   *
   * @returns {AsyncIterable<object>}
   */
  stream() {
    throw new Error('NOT_IMPLEMENTED: the kilo lane is wired in Task 3')
  }

  /** Bound the image projection so one photo cannot blow the request size. */
  imageRequestTarget(_provider, _model, image) {
    const maxPixels = 640000
    const width = Number(image?.width) || 0
    const height = Number(image?.height) || 0
    if (width <= 0 || height <= 0) return { width: 1024, height: 1024, maxBytes: 2 * 1024 * 1024 }
    if (width * height <= maxPixels) {
      return { width: Math.floor(width), height: Math.floor(height), maxBytes: 2 * 1024 * 1024 }
    }
    const scale = Math.sqrt(maxPixels / (width * height))
    return {
      width: Math.max(1, Math.floor(width * scale)),
      height: Math.max(1, Math.floor(height * scale)),
      maxBytes: 2 * 1024 * 1024,
    }
  }
}

/**
 * The declared effort menu, or `undefined` when there is nothing to choose.
 *
 * A single rung is not a menu: showing a one-item control promises a choice the
 * model does not offer.
 */
function menuFor(entry) {
  const values = entry?.efforts
  if (!Array.isArray(values) || values.length < 2) return undefined
  return values.map(id => ({ id, name: labelFor(id) }))
}

/** `xhigh` -> `XHigh`, `none` -> `None`. */
function labelFor(id) {
  const text = String(id)
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** The rung a fresh turn starts on. */
function defaultEffortFor(entry) {
  const values = entry?.efforts
  if (!Array.isArray(values) || values.length < 2) return undefined
  if (typeof entry.defaultEffort === 'string' && values.includes(entry.defaultEffort)) return entry.defaultEffort
  return values[Math.floor(values.length / 2)]
}
