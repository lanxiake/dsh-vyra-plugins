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

import { postKiloStreamed } from './kilo.js'
import { toChatMessages, toToolDefs } from './messages.js'
import { readChunks } from './stream.js'
import { effortsFor, defaultEffortFor } from './effort.js'

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

/**
 * Resolve image blocks to data URLs for the wire.
 *
 * Returns `undefined` outright when the plugin has no resolver — the harness
 * either provides one or it does not, and pretending lets the projection drop
 * the picture silently instead of reporting it.
 */
function imageResolver(resolveImage, messages) {
  if (typeof resolveImage !== 'function') return undefined
  const cache = new Map()
  return block => {
    const key = block?.attachment?.attachmentId ?? ''
    if (key !== '' && cache.has(key)) return cache.get(key)
    let url
    try {
      url = resolveImage(block)
    } catch {
      url = undefined
    }
    if (key !== '') cache.set(key, url)
    return url
  }
}

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
   * Stream one turn.
   *
   * A refusal is reported as an `error` finish rather than thrown: the harness
   * turns a finish into the turn's outcome, while a throw out of the generator
   * surfaces as an unhandled fault. Only a genuinely broken adapter may throw.
   *
   * @param {object} options - GenerateOptions
   * @param {object|null} [pinned] - the catalog row `prepareCall` froze
   * @param {object} [snapshot] - the state generation `prepareCall` froze
   * @returns {AsyncIterable<object>}
   */
  async * stream(options, pinned, snapshot) {
    const state = snapshot ?? this.deps.state()
    const entry = pinned ?? state.catalog.find(candidate => candidate.id === options.model) ?? null
    const model = options.model

    if (options.signal?.aborted === true) {
      yield { type: 'finish', reason: { kind: 'aborted', failure: { message: 'request aborted', code: 'ABORTED' } } }
      return
    }

    const warnings = []
    const body = {
      model,
      messages: toChatMessages(options.messages, imageResolver(this.deps.resolveImage, options.messages), warnings),
      stream: true,
    }
    const tools = toToolDefs(options.tools)
    if (tools.length > 0) body.tools = tools
    if (Number.isFinite(options.maxTokens) && options.maxTokens > 0) body.max_tokens = Math.floor(options.maxTokens)
    if (Number.isFinite(options.temperature)) body.temperature = options.temperature
    if (Array.isArray(options.stop) && options.stop.length > 0) body.stop = options.stop

    // Only a rung the model itself declared may go on the wire: the gateway
    // validates the field and rejects anything outside the declared set.
    const effort = options.reasoningEffort
    if (typeof effort === 'string' && Array.isArray(entry?.efforts) && entry.efforts.includes(effort)) {
      body.reasoning_effort = effort
    }

    const payloads = []
    let done = false
    let failure
    const controller = new AbortController()
    const onAbort = () => controller.abort()
    options.signal?.addEventListener('abort', onAbort, { once: true })

    try {
      await postKiloStreamed({
        body,
        signal: options.signal === undefined ? controller.signal : AbortSignal.any([options.signal, controller.signal]),
        fetchImpl: this.deps.fetchImpl,
        onPayload: payload => { payloads.push(payload) },
      })
      done = true
    } catch (error) {
      failure = error
    } finally {
      options.signal?.removeEventListener('abort', onAbort)
    }

    if (failure !== undefined) {
      const code = typeof failure.code === 'string' ? failure.code : 'SERVER'
      if (code === 'ABORTED') {
        yield { type: 'finish', reason: { kind: 'aborted', failure: { message: String(failure.message ?? 'aborted'), code } } }
        return
      }
      yield {
        type: 'finish',
        reason: { kind: 'error', failure: { message: String(failure.message ?? 'upstream error'), code, ...(Number.isFinite(failure.status) ? { status: failure.status } : {}) } },
      }
      return
    }

    if (done) {
      try {
        for await (const chunk of readChunks(payloads)) {
          // Accounting rides the same stream the caller sees: one place counts a
          // turn, so a cancelled or failed turn cannot be billed twice.
          if (chunk.type === 'usage') this.deps.onUsage?.({ model, usage: chunk.usage })
          yield chunk
        }
      } catch (error) {
        // An in-stream error envelope is still this turn's outcome.
        const code = typeof error.code === 'string' ? error.code : 'SERVER'
        yield { type: 'finish', reason: { kind: 'error', failure: { message: String(error.message ?? 'upstream error'), code } } }
      }
    }
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
 * Kept as a local alias so `resolveModel` reads in the adapter's own vocabulary;
 * the rule itself lives in `effort.js`.
 */
function menuFor(entry) {
  return effortsFor(entry)
}
