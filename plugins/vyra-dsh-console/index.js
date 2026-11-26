import { readFileSync } from 'node:fs'

import { createConsole, present } from './core.js'
import { createChannel } from './channel.js'
import { createConsoleTool } from './tool.js'
import { consoleDomain } from './domains/console.js'
import { inventoryDomain } from './domains/inventory.js'
import { pluginDomain } from './domains/plugin.js'
import { modelDomain } from './domains/model.js'
import { settingsDomain } from './domains/settings.js'
import { uiDomain } from './domains/ui.js'
import { catalogDomain } from './domains/catalog.js'
import { appearanceDomain } from './domains/appearance.js'

export const name = 'dsh-vyra-dsh-console'
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

/**
 * How long an appearance action waits for the browser half before reporting
 * `unavailable`, when the config says nothing.
 *
 * Declared ABOVE `buildConfigSchema`, which reads it: that function runs at
 * module load (`export const Config = await buildConfigSchema()`), and a `const`
 * declared below this point would still be in its temporal dead zone, throwing
 * `Cannot access 'DEFAULT_CLIENT_TIMEOUT_MS' before initialization`. The
 * surrounding `try/catch` would then swallow it and degrade `Config` to
 * `undefined` on exactly the hosts that DO ship schemastery — silently losing the
 * settings page on every real installation while this repo's own checkout (where
 * schemastery is unresolvable and the function returns early) stayed green.
 */
const DEFAULT_CLIENT_TIMEOUT_MS = 5000

/**
 * The one endpoint both halves agree on.
 *
 * Declared once and shared on this side, so the route path and any other Host
 * reference to it cannot drift apart into two literals that merely look the
 * same. The Client half cannot import this — it is a browser bundle loaded
 * through its own module loader, with no access to this module — so the path is
 * necessarily spelled a second time there, and `client.test.mjs` asserts the
 * two spellings match rather than trusting them to.
 */
const RPC_PATH = '/api/vyra-console/rpc'

/**
 * How long a `GET` parks waiting for a request to hand the browser, when the
 * queue is empty on arrival.
 *
 * This is the long-poll's bound, and it is deliberately NOT `clientTimeoutMs`:
 * that setting is how long an *action* waits for its answer, and the two are
 * independent budgets. The bound only decides how long an idle poll is held
 * open before it answers `[]` and the Client asks again; the Client re-polls
 * immediately, so a shorter bound costs only extra empty round trips and a
 * longer one costs latency on the first action after the Client attaches.
 *
 * Declared HERE, above `buildConfigSchema`, for the reason
 * `DEFAULT_CLIENT_TIMEOUT_MS` documents: that function runs at module load
 * (`export const Config = await buildConfigSchema()`) and the schema below reads
 * this binding. Declared after it, the read would hit the temporal dead zone,
 * the surrounding `try/catch` would swallow the `ReferenceError`, and `Config`
 * would silently degrade to `undefined` on exactly the hosts that DO ship
 * schemastery. Measured: it did, and the suite's own TDZ test caught it.
 */
const LONG_POLL_MS = 25000

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
 * which is why `dsh-vyra-smart-compaction` declines to fake one for the same
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
      clientTimeoutMs: Schema.number()
        .default(DEFAULT_CLIENT_TIMEOUT_MS)
        .description(
          'How long an appearance action waits for the browser half before reporting '
          + 'unavailable (界面操作等待浏览器应答的毫秒数，超时后报告 unavailable)',
        ),
      longPollMs: Schema.number()
        .default(LONG_POLL_MS)
        .description(
          'How long an idle poll for queued appearance requests is held open before '
          + 'answering empty (界面轮询等待新请求的毫秒数，超时后返回空列表)',
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

/**
 * Read `clientTimeoutMs` off the config the Loader supplied.
 *
 * Same two-case reasoning as `confirmDestructiveFrom`: with a resolved schema
 * the `.default(5000)` has already been applied, and on a checkout without
 * schemastery the raw config is all there is. Unlike the confirmation gate there
 * is no safety asymmetry between the two readings — a wrong timeout costs a
 * slower or earlier `unavailable`, never an unauthorized action — so a
 * malformed value falls back to the default instead of being treated as an
 * answer. `Number.isFinite(0)` is true, so an explicit immediate-timeout config
 * is honoured rather than silently replaced.
 */
function clientTimeoutMsFrom(config) {
  const value = config?.clientTimeoutMs
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : DEFAULT_CLIENT_TIMEOUT_MS
}

/**
 * Read the long-poll bound off the config the Loader supplied.
 *
 * A separate key from `clientTimeoutMs`, not a second meaning for it: one is how
 * long an ACTION waits for its answer, the other is how long an idle POLL is held
 * open. Folding them into one number would silently tie the poll's cadence to
 * whatever an operator set for action latency.
 *
 * It exists so the bound is drivable in tests — the shipped 25s is far too long
 * to sit out, and a test cannot otherwise exercise "the poll gives up and answers
 * empty" without waiting it in full. Same reading discipline as
 * `clientTimeoutMsFrom`: a malformed value falls back to the default rather than
 * being treated as an answer, but `0` is honoured as a real immediate bound.
 */
function longPollMsFrom(config) {
  const value = config?.longPollMs
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : LONG_POLL_MS
}

/**
 * An error body for the wire.
 *
 * `present` rather than a literal, because the literal `{ ok: false, error }`
 * writes a real own key holding `undefined` whenever `error` is absent — the
 * Task 5 Critical, and this file writes these envelopes on the wire.
 *
 * The route's own parse-failure path cannot currently reach the absent case:
 * `String(err?.message || err)` yields the STRING "undefined" for a thrown
 * `undefined`, never the value `undefined`, so a message is always present
 * there. The guard is therefore not load-bearing for today's single caller —
 * and that is exactly why it is written down and exported: the next caller that
 * builds a refusal without a message would otherwise write a hole, and the
 * lossless-JSON rule is this plugin's contract rather than one call site's
 * accident. `host.test.mjs` drives it directly, since no route input can.
 *
 * @param error the message to report; when absent, the key is OMITTED.
 */
export function failure(error) {
  return present({ ok: false, error })
}

/**
 * Read a JSON request body from an async-iterable Node request.
 *
 * A body that is not JSON is a bad request, and the caller turns that into a
 * refusal rather than letting it escape the route as an unhandled rejection —
 * an exception here would reach the browser as a broken connection with no
 * explanation of what was wrong.
 */
async function readJson(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  const text = Buffer.concat(chunks).toString('utf8')
  if (text === '') return {}
  return JSON.parse(text)
}

/**
 * Write one JSON response. Never carries a `content-length`, because the value
 * has already been serialized once and a second computation is a second chance
 * to disagree with the body actually sent.
 */
function send(res, status, payload) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(payload))
}

/**
 * The two body shapes one `POST` can carry, told apart by their own fields.
 *
 * The endpoint serves both halves of this plugin, and they post different
 * things:
 *
 *   - the CLIENT half answers a drained appearance request with
 *     `{ id, ok, value | error }` — the channel's reply contract;
 *   - the PANEL dispatches a console action with `{ action, args }` — the same
 *     shape `dsh_console` takes, so a click and a tool call reach the identical
 *     `dispatch`.
 *
 * Discriminating on `id` rather than on `action` is deliberate: an entry id is
 * what the channel keys its pending map by, and `{ id }` alone is a malformed
 * reply the channel must still be allowed to refuse. A body carrying NEITHER
 * is neither shape, and is reported as a bad request rather than guessed at.
 */
function bodyShape(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return 'invalid'
  if (Object.hasOwn(body, 'id')) return 'reply'
  if (Object.hasOwn(body, 'action')) return 'action'
  return 'invalid'
}

/**
 * The same fence `client-connection` puts in front of `/api`, restated here.
 *
 * This route is registered as `exact`, and `WebServer.match` consults the exact
 * table before the prefix table — so a POST to this path NEVER reaches the
 * `/api` prefix handler and never passes `connection.admit()`. Without this
 * check, any process that can reach the loopback listener could POST
 * `plugin.install` or invent an appearance answer, and a page on another origin
 * could do it through a DNS-rebound name.
 *
 * The rules are the ones `isTrustedApiRequest` applies
 * (`packages/client/connection/src/api-request-trust.ts`), narrowed to the
 * facts an exact handler can see: the Host authority must be loopback, the
 * listener's own bind address, or an explicitly trusted authority; a browser
 * that labels the request `cross-site` is refused; and an `Origin` that is
 * present must name the same authority as the `Host`.
 *
 * @param req - the incoming request, read for `headers` only.
 * @param options.bindHost - the listener's bind address, when known.
 * @param options.trustedHosts - extra `host` or `host:port` authorities.
 * @returns a reason to refuse, or `undefined` to proceed.
 */
export function fenceProblem(req, { bindHost, trustedHosts = [] } = {}) {
  const headers = req?.headers ?? {}
  const host = headers.host
  if (typeof host !== 'string' || host === '') return 'missing host header'
  const authority = parseAuthority(host)
  if (authority === undefined) return `unparseable host "${host}"`
  const trusted = authority.source === authority.hostname
    || (authority.port !== undefined && authority.source === `${authority.hostname}:${authority.port}`)
  const admitted = isLoopbackHostname(authority.hostname)
    || authority.hostname === bindHost
    || trustedHosts.some((entry) => trusted && entry === authority.source)
    || trustedHosts.some((entry) => entry === authority.hostname)
  if (!admitted) return `host "${host}" is neither loopback nor an admitted authority`

  if (headers['sec-fetch-site'] === 'cross-site') return 'cross-site request'
  const origin = headers.origin
  if (typeof origin === 'string' && origin !== '') {
    const parsed = parseAuthority(origin)
    // A present Origin must name the SAME authority the browser addressed: the
    // page's own origin is what a same-origin fetch sends, and a mismatched one
    // is precisely the cross-origin request this fence exists to stop.
    if (parsed === undefined || parsed.host !== authority.host) {
      return `origin "${origin}" does not match host "${host}"`
    }
  }
  return undefined
}

/** Split `host:port` or a full origin URL into its authority parts. */
function parseAuthority(value) {
  const text = String(value)
  const url = (() => {
    try {
      return new URL(/^[a-z][a-z0-9+.-]*:\/\//iu.test(text) ? text : `http://${text}`)
    } catch {
      return undefined
    }
  })()
  if (url === undefined) return undefined
  const hostname = url.hostname.replace(/^\[|\]$/gu, '')
  return { hostname, host: url.host, port: url.port === '' ? undefined : url.port, source: url.host }
}

/** Whether an authority names the local machine. */
function isLoopbackHostname(hostname) {
  return hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname === '127.0.0.1'
    || hostname === '::1'
    || /^127\.\d+\.\d+\.\d+$/u.test(hostname)
}

/**
 * Build the endpoint that carries queued requests to the browser and answers
 * back — the one transport between the two halves of this plugin, and the one
 * route the panel uses to reach every Host action.
 *
 * The queue is a plain array the channel's listener pushes onto, and the waiters
 * are the parked `GET`s' resolvers. Both live in this closure rather than on the
 * context: the route is the only thing that touches them, and the channel is the
 * only thing that feeds them.
 *
 * @param channel the Host half of the Host↔Client channel.
 * @param longPollMs how long an idle `GET` parks before answering `[]`.
 * @param console_ the console, so a panel-shaped `POST` dispatches through the
 *   SAME `dispatch` the `dsh_console` tool calls. Optional: a composition with
 *   no console still serves the bridge, and a panel-shaped body is then reported
 *   as unserviceable rather than crashing the route.
 * @param fence options passed to {@link fenceProblem}; omitted in unit tests
 *   that drive the handler directly, in which case only the loopback and
 *   same-origin rules apply.
 */
function createEndpoint(channel, longPollMs = LONG_POLL_MS, console_ = null, fence = {}) {
  /** Requests drained from the channel and not yet handed to a `GET`. */
  const queue = []
  /**
   * The resolvers of every parked `GET`, oldest first.
   *
   * A QUEUE, not a single slot, and that is load-bearing rather than decorative.
   * The Client half keeps one poll in flight at a time, so in the happy path
   * this never holds more than one entry — but a single slot would be
   * silently WRONG the moment two GETs overlap, which is reachable without any
   * misbehaviour from the Client: a browser retry, a second tab, or a
   * development double-mount all issue one. With a slot, the second GET
   * overwrites the first, and the orphan then sleeps out its entire bound while
   * a request sits in the queue — a UI that simply stops responding, with no
   * error anywhere. (Found by this task's own concurrency test, which is why it
   * is a queue.)
   *
   * Entries are removed by whoever consumes them, so a resolver is never called
   * twice and one whose bound already expired is never called at all.
   */
  const waiters = []

  /**
   * Hand the arrival to one parked GET, if any.
   *
   * One waiter per arrival, and only one: `drain()` re-checks the queue after
   * waking, so a waiter woken without work simply parks again, and the request
   * stays queued for whichever GET actually takes it. Waking every waiter would
   * hand the same single request to several responses at once.
   *
   * `shift()` before the call is what makes the resolver single-use — the same
   * delete-before-resolve ordering `channel.js`'s `settle()` uses.
   */
  function wake() {
    const resolve = waiters.shift()
    if (resolve) resolve()
  }

  channel.onRequest((request) => {
    queue.push(request)
    wake()
  })

  /**
   * Answer one `GET` with everything queued, waiting briefly if there is
   * nothing yet.
   *
   * The wait is bounded, and the timer is cleared on EVERY exit — including the
   * one where work arrives first. That path matters: without the `clearTimeout`,
   * a woken GET would still leave a ref'd timer armed for the rest of the bound,
   * holding the process (and the event loop) open for no reason. The waiter is
   * de-registered in the same `finally`, so a GET that gave up and a GET that was
   * woken both leave nothing behind for a later arrival to call.
   */
  async function drain() {
    if (queue.length === 0) {
      let timer
      let resolveWait
      const signal = new Promise((resolve) => { resolveWait = resolve })
      const entry = () => resolveWait()
      waiters.push(entry)
      try {
        timer = setTimeout(resolveWait, longPollMs)
        await signal
      } finally {
        clearTimeout(timer)
        // Index lookup rather than `filter`: this removes exactly this caller's
        // entry and leaves every other parked GET untouched.
        const index = waiters.indexOf(entry)
        if (index !== -1) waiters.splice(index, 1)
      }
    }
    // Spliced out in one go, so a request is handed to exactly one response. The
    // batch is copied out rather than exposing the live array, so a caller that
    // kept the reference cannot watch it change underneath.
    return { ok: true, requests: queue.splice(0, queue.length) }
  }

  /**
   * The route handler: `GET` hands requests out, `POST` takes either an answer
   * in or an action to dispatch.
   *
   * `op` is deliberately relayed untouched. It is untrusted input from the
   * browser, and `applyOp` refuses a non-string op precisely so that a coerced
   * value cannot reach a handler — a route that "helpfully" stringified it
   * would silently disarm that guard. The same discipline applies to `action`
   * below: it goes to `dispatch` exactly as it arrived, because `dispatch` is
   * what decides whether an action exists and whether it is forbidden.
   */
  return async function handler(req, res) {
    // Before anything else, including the long-poll: an untrusted request must
    // not be allowed to park a GET or drain the queue. Answered as a plain
    // status with no body detail beyond the reason, because a refused caller has
    // no business learning the console's shape.
    const refused = fenceProblem(req, fence)
    if (refused !== undefined) {
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
      res.end(refused)
      return
    }
    try {
      if (req.method === 'GET') {
        send(res, 200, await drain())
        return
      }
      const body = await readJson(req)
      switch (bodyShape(body)) {
        case 'reply':
          // The channel's own reply contract, unchanged since Task 7: the
          // boolean says whether a live request was settled, and `false` is a
          // legitimate answer for a reply that arrived after its timeout.
          send(res, 200, { ok: channel.respond(body) === true })
          return
        case 'action': {
          if (console_ === null) {
            send(res, 200, failure('this composition has no console to dispatch against'))
            return
          }
          // `action` is relayed untouched, exactly as `op` is above. `dispatch`
          // checks `FORBIDDEN` before anything else, so a refused action comes
          // back as DATA — `{ status: 'forbidden', reason, alternative }` — which
          // is what the panel renders. It never throws for a bad input; it
          // answers with a status for every one.
          const result = await console_.dispatch(body.action, body.args ?? {})
          send(res, 200, result === null || typeof result !== 'object' ? failure('the console returned no result') : result)
          return
        }
        default:
          // Neither shape. Reported rather than guessed at: picking one would
          // mean a malformed reply settles nothing AND reports success, or an
          // action with a typo'd key silently dispatches an empty action.
          send(res, 200, failure('a POST body must carry either an id (a channel reply) or an action'))
      }
    } catch (err) {
      send(res, 200, failure(String(err?.message || err)))
    }
  }
}

/**
 * Read the bundled skill document, once, or `undefined` when it is unavailable.
 *
 * `node:fs` is already the only non-local dependency this file has, and reading
 * one file at load is cheaper than shipping a second copy of the same prose as a
 * string literal — a copy that would drift from `skills/SKILL.md` the first time
 * somebody edited one and not the other.
 *
 * A missing or unreadable file is a LOST SKILL, never a lost plugin: the tools
 * are the product, the document explains them.
 */
function skillBody() {
  try {
    return readFileSync(new URL('./skills/SKILL.md', import.meta.url), 'utf8')
  } catch {
    return undefined
  }
}

export function apply(ctx, config) {
  // The Host side of the Host↔Client channel, mounted before the console is
  // built so the appearance domain has something to read on its very first call.
  //
  // It rides on the context as a namespaced own property rather than a Cordis
  // service. A service would be the idiomatic carrier, but providing one means
  // declaring a name in the host's service table, and this channel is
  // process-local state shared by the two halves of this one plugin — not an
  // extension point anything else should resolve. The domain reads it per call
  // (`channelOf`), so the reference is never captured: Task 7's endpoint and the
  // Client half can attach and detach without re-applying the plugin.
  //
  // With no Client attached yet, every appearance action resolves to
  // `unavailable` after the timeout. That is the intended state at boot and in
  // every test in this repo; it is deliberately NOT an error, because the model
  // is expected to try again once the user opens the interface.
  const channel = createChannel({ timeoutMs: clientTimeoutMsFrom(config) })
  ctx.__consoleChannel = channel

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
      inventory: inventoryDomain,
      plugin: pluginDomain,
      model: modelDomain,
      settings: settingsDomain,
      catalog: catalogDomain,
      appearance: appearanceDomain,
      ui: uiDomain,
    },
    { confirmDestructive: confirmDestructiveFrom(config) },
  )
  ctx.tools.register(createConsoleTool(console_))
  ctx.logger?.info?.(`dsh-vyra-dsh-console: ${console_.listActions().length} actions`)

  // The agent skill, contributed at runtime rather than dropped into the user's
  // DSH home. It lives exactly as long as this plugin, so uninstalling leaves
  // nothing behind — and a read-only `DSH_HOME` costs nothing, which is the
  // failure a write-on-boot installer has. `dsh-vyra-agent-manager` established
  // this pattern (`skills.register`, not a file).
  //
  // Optional by construction: a composition without the skills registry still
  // gets every tool, and only the documentation is absent.
  const skill = skillBody()
  if (skill !== undefined && typeof ctx.inject === 'function') {
    ctx.inject(['skills'], (owner) => {
      owner.effect(() => owner.skills.register({
        name: 'vyra-dsh-console',
        description: 'Operate this DSH installation: read the whole inventory, open settings pages, main panels and right-drawer tabs, and switch theme, layout or language. Use when asked to change or inspect the harness itself.',
        content: skill,
      }), 'dsh-vyra-dsh-console: console skill')
    })
  }

  // The HTTP endpoint that finally connects the two halves: the browser polls
  // `GET` for queued appearance requests and posts each answer back with `POST`.
  //
  // Registered through `inject`, never through a one-shot `ctx.get`. `webServer`
  // binds its port during its own init, so at this moment it may not exist yet —
  // asking `ctx.get('webServer')` here answered `undefined` in the real web
  // composition, the route was never registered, and the panel's every call fell
  // through to the Connection prefix route and came back as "not found" instead
  // of JSON. `inject` is Cordis' "run this once these services exist": the
  // callback pends while the service is absent or merely not provided yet, and
  // re-runs if it is replaced. That pending is the entire point, and it is the
  // same pattern `dsh-vyra-agent-manager`, `dsh-im`, `dsh-skins` and
  // `dsh-our-free-model` each arrived at independently.
  //
  // No `webServer` at all is a supported composition, not a failure: the tool
  // and every non-appearance action keep working, and only the bridge is absent —
  // which the appearance domain already reports as `unavailable`.
  //
  // `inject` itself is guarded, because it is not guaranteed either. Only a
  // Cordis context has one; the bare contexts this plugin's own tests and any
  // minimal embedding build have no `inject` at all, and calling it there threw
  // `ctx.inject is not a function` straight out of `apply()` — taking the tool
  // and every other action down with it, for want of an HTTP server they never
  // needed. A context with no `inject` cannot be waiting on a service, so there
  // is nothing to defer and nothing lost by skipping the registration.
  if (typeof ctx.inject !== 'function') return

  ctx.inject(['webServer'], (owner) => {
    // `owner`, not `ctx`: the service is reached through the context that has it
    // in scope, and the effect is owned by that context so the route is
    // unregistered when the server (or this plugin) goes away.
    owner.effect(
      () => owner.webServer.register({
        kind: 'exact',
        path: RPC_PATH,
        // The listener's own bind address is admitted by the fence even when it
        // is not loopback — a profile bound to a LAN address is reachable only
        // by that address, so refusing it would make the endpoint unusable there
        // while admitting it is exactly as safe as `/api`. Read when the route
        // registers, which is after the listener bound its port.
        handler: createEndpoint(channel, longPollMsFrom(config), console_, {
          bindHost: typeof owner.webServer.host === 'string' ? owner.webServer.host : undefined,
        }),
      }),
      'dsh-vyra-dsh-console: appearance endpoint',
    )
  })
}
