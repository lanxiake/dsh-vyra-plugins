/**
 * Recorded UI walkthroughs: run a list of interface steps while the screen
 * recorder captures the window, then keep the video or throw it away.
 *
 * ## Why this is orchestration rather than a script
 *
 * The three things a good walkthrough needs — start capturing, drive the
 * interface, end capturing — live in three different places:
 *
 *   - capturing is `dsh-vyra-screen-recorder`, which works by a request file
 *     and a polled state file;
 *   - driving is this plugin's browser half, which can only act from inside
 *     the page;
 *   - ending early needs a route the recorder only recently gained.
 *
 * A shell script would have to sequence all three through sleeps, and the
 * recording would be running while the script was still deciding what to do.
 * This module keeps the whole sequence in one place: it starts the recording,
 * hands the steps to the page, and waits for the page to report how they went.
 *
 * ## Failure discards
 *
 * A walkthrough that went wrong is not worth keeping, and a folder of
 * half-finished takes is worse than none. Any failed step stops the recording
 * and tells the recorder to discard it, so a failed run leaves no file. The
 * only artifact is the error, which names the step.
 *
 * @module dsh-vyra-dsh-console/pipeline
 */

import { randomUUID } from 'node:crypto'

/** The recorder's route prefix, as `dsh-vyra-screen-recorder` registers it. */
const RECORDER_PREFIX = '/plugins/vyra-screen-recorder'

/** How long to wait for the recorder to report it is actually capturing. */
const START_TIMEOUT_MS = 15000
/** How long to wait for the encoder after stopping. */
const ENCODE_TIMEOUT_MS = 180000
/** The poll cadence while waiting on the recorder. */
const POLL_MS = 250

/** Actions a step may carry, in the order they are described. */
export const STEP_ACTIONS = Object.freeze([
  'open', 'close', 'act', 'invoke', 'wait', 'expect', 'snapshot', 'scroll',
])

/** Every action that changes the page; a step list must contain at least one. */
const MUTATING = new Set(['open', 'close', 'act', 'invoke', 'scroll'])

/**
 * Validate a step list without touching anything.
 *
 * Checked here rather than in the browser because a malformed list should fail
 * before a recording starts, not after: the recorder would otherwise capture a
 * few seconds of nothing while the page discovered the problem.
 *
 * @param steps - the caller's steps.
 * @returns `{ steps }` normalized, or `{ error }` naming what is wrong.
 */
export function normalizeSteps(steps) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return { error: 'ui.record needs a non-empty steps array' }
  }
  if (steps.length > 200) {
    return { error: 'ui.record accepts at most 200 steps' }
  }
  const out = []
  let mutating = 0
  for (const [index, raw] of steps.entries()) {
    const where = `step ${index + 1}`
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      return { error: `${where} must be an object` }
    }
    const actions = STEP_ACTIONS.filter((name) => Object.hasOwn(raw, name))
    if (actions.length === 0) {
      return { error: `${where} needs one of: ${STEP_ACTIONS.join(', ')}` }
    }
    if (actions.length > 1) {
      return { error: `${where} carries ${actions.join(' and ')}; one action per step` }
    }
    const action = actions[0]
    const settle = raw.settle === undefined ? undefined : Number(raw.settle)
    if (settle !== undefined && (!Number.isFinite(settle) || settle < 0)) {
      return { error: `${where} has a settle that is not a non-negative number of milliseconds` }
    }
    if (action === 'wait') {
      const ms = Number(raw.wait)
      if (!Number.isFinite(ms) || ms < 0) {
        return { error: `${where}: wait needs a non-negative number of milliseconds` }
      }
      out.push({ index, action, wait: ms })
      continue
    }
    if (action === 'act') {
      const act = raw.act
      if (act === null || typeof act !== 'object' || Array.isArray(act)) {
        return { error: `${where}: act must be an object` }
      }
      if (typeof act.name !== 'string' || act.name === '') {
        // `wanted` (or `text`) resolves the element by its visible LABEL instead,
        // preferring the one inside an open dialog: a settings row and a plugin
        // that registers a nav entry under the same word are both "免费模型", and
        // "the one in the dialog" is what a walkthrough means by it.
        const label = typeof act.wanted === 'string' && act.wanted !== ''
          ? act.wanted
          : (typeof act.text === 'string' ? act.text : '')
        if (label !== '') {
          mutating += 1
          out.push({ index, action, act: { ...act, wanted: label }, settle })
          continue
        }
        return { error: `${where}: act needs a name (see ui.snapshot for the names a page offers)` }
      }
      if (!['click', 'type', 'select'].includes(String(act.action))) {
        return { error: `${where}: act.action must be click, type or select` }
      }
      mutating += 1
      out.push({ index, action, act, settle })
      continue
    }
    if (action === 'open') {
      const open = raw.open
      if (open === null || typeof open !== 'object' || Array.isArray(open)) {
        return { error: `${where}: open must be an object` }
      }
      mutating += 1
      out.push({ index, action, open, settle })
      continue
    }
    if (action === 'close') {
      mutating += 1
      out.push({ index, action, close: raw.close, settle })
      continue
    }
    if (action === 'invoke') {
      if (typeof raw.invoke !== 'string' || raw.invoke === '') {
        return { error: `${where}: invoke needs a command id` }
      }
      mutating += 1
      out.push({ index, action, invoke: raw.invoke, settle })
      continue
    }
    if (action === 'expect') {
      out.push({ index, action, expect: raw.expect, settle })
      continue
    }
    if (action === 'snapshot') {
      out.push({ index, action, snapshot: raw.snapshot ?? {}, settle })
      continue
    }
    if (action === 'scroll') {
      mutating += 1
      out.push({ index, action, scroll: raw.scroll, settle })
      continue
    }
  }
  if (mutating === 0) {
    // A recording of a page that never changes is a still frame nobody wants,
    // and it would look like the run succeeded.
    return { error: 'ui.record needs at least one step that changes the page (open, close, act, invoke or scroll)' }
  }
  return { steps: out }
}

/**
 * A fetch that talks to this host's own web server.
 *
 * The recorder registers its routes on `webServer`, so the pipeline reaches it
 * over the same origin the page uses. `base` is resolved per call because the
 * server binds its port during its own init.
 *
 * @param base - an absolute origin, e.g. `http://127.0.0.1:52407`.
 * @param path - the route suffix.
 * @param options - method and body.
 * @returns the parsed JSON body.
 */
async function recorderCall(base, path, options = {}) {
  const response = await fetch(`${base}${RECORDER_PREFIX}${path}`, {
    method: options.method ?? 'GET',
    headers: options.body === undefined ? undefined : { 'content-type': 'application/json' },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: 'no-store',
  })
  const text = await response.text()
  let data
  try {
    data = text === '' ? {} : JSON.parse(text)
  } catch {
    throw new Error(`the recorder answered ${String(response.status)} with non-JSON: ${text.slice(0, 120)}`)
  }
  if (response.ok !== true || data?.ok === false) {
    throw new Error(String(data?.error ?? `the recorder answered ${String(response.status)}`))
  }
  return data
}

/** Wait until `probe` answers something truthy, or fail at `timeoutMs`. */
async function until(probe, timeoutMs, what) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const answer = await probe()
    if (answer !== undefined && answer !== null && answer !== false) return answer
    if (Date.now() >= deadline) throw new Error(`timed out waiting for ${what}`)
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
  }
}

/**
 * Ask the recorder for its current job.
 *
 * @returns the job, or `null` when nothing is being recorded.
 */
async function recorderJob(base) {
  const data = await recorderCall(base, '/agent/status')
  return data.job ?? null
}

/**
 * What this installation is missing for a recording.
 *
 * Checked before anything starts, and every check names what to do about it.
 * The recorder is a separate plugin, so "is it installed" is a real question
 * with a real answer rather than an assumption.
 *
 * @param recorderBase - the origin of this host's web server.
 * @returns a list of problems; empty when a recording can proceed.
 */
export async function preflight(recorderBase) {
  const problems = []
  if (recorderBase === undefined || recorderBase === '') {
    problems.push('this host has no web server, so the recorder cannot be reached')
    return problems
  }
  try {
    const job = await recorderJob(recorderBase)
    if (job !== null) {
      problems.push(`a recording is already running (${String(job.id)}); stop it first`)
    }
  } catch (error) {
    problems.push(`dsh-vyra-screen-recorder is not reachable at ${recorderBase}: ${String(error.message ?? error)} — install or enable it, then retry`)
  }
  return problems
}

/**
 * The window a walkthrough is filming, when the caller did not name one.
 *
 * A walkthrough is OF this app, so "the DSH window" is the only sensible default
 * and the caller should not have to find a handle. The recorder enumerates every
 * visible window, and the biggest one is NOT necessarily ours — a terminal or an
 * editor is routinely larger — so the choice is made on the PROCESS NAME and the
 * size only breaks ties.
 *
 * @param base - the host's own origin.
 * @returns `{ type: 'window', hwnd, title }`, or undefined when the app's own
 *   window is not among them (a headless composition has none, and the
 *   recorder's configured default then applies).
 */
async function defaultSource(base) {
  try {
    const data = await recorderCall(base, '/sources')
    const windows = Array.isArray(data?.windows) ? data.windows : []
    const ours = windows.filter((win) => Number.isSafeInteger(win?.hwnd) && win.hwnd > 0
      && /deepseek\s*harness/iu.test(String(win.process ?? '')))
    if (ours.length === 0) return undefined
    let best = ours[0]
    for (const win of ours) {
      if ((win.w ?? 0) * (win.h ?? 0) > (best.w ?? 0) * (best.h ?? 0)) best = win
    }
    return { type: 'window', hwnd: best.hwnd, title: String(best.title ?? '') }
  } catch {
    // Enumerating is best-effort: the recorder's configured default still works.
    return undefined
  }
}

/**
 * Read one recording's outcome, or undefined while it is still being written.
 *
 * The recorder keeps `state-<id>.json` beside the request queue. `done` means
 * the video was written; `error` means it was discarded. Both clear the job,
 * which is why the job's absence proves nothing.
 *
 * @param base - the host's own origin.
 * @param id - the recording id handed to `/agent/start`.
 * @returns `{ status, file? , error? }`, or undefined when there is no verdict yet.
 */
async function recorderOutcome(base, id) {
  const data = await recorderCall(base, `/agent/outcome?id=${encodeURIComponent(id)}`).catch(() => undefined)
  if (data === undefined || typeof data.status !== 'string') return undefined
  if (data.status === 'done') return { status: 'done', file: data.file, bytes: data.bytes }
  if (data.status === 'error') return { status: 'error', error: data.error }
  return undefined
}

/**
 * Run one recorded walkthrough.
 *
 * The steps are executed by the PAGE, not here: only the browser can see and
 * click the interface, and running them in-process would need one round trip
 * per step. So this function's job is the recording: start it, hand the steps
 * over through the console channel, wait, and keep or discard the file.
 *
 * @param deps.recorderBase - origin of this host's web server.
 * @param deps.channel - the Host half of the console channel.
 * @param deps.console - the console, so the page is driven by `ui.pipeline`.
 * @param request - `{ out, fps, maxSeconds, steps }`.
 * @returns the recorder's saved file, or a failure that names the step.
 */
export async function runRecordedWalkthrough(deps, request) {
  const normalized = normalizeSteps(request.steps)
  if (normalized.error !== undefined) {
    return { status: 'error', reason: normalized.error, expects: { steps: STEP_ACTIONS.join(' | ') } }
  }

  const problems = await preflight(deps.recorderBase)
  if (problems.length > 0) {
    return { status: 'error', reason: problems.join('; '), problems }
  }

  // The recorder writes its request file and picks it up on its next tick; the
  // page must already know the id so it can act the moment recording begins.
  const id = request.id ?? `wf-${randomUUID()}`
  const startedAt = Date.now()
  const maxSeconds = Number.isFinite(request.maxSeconds) && request.maxSeconds > 0
    ? Math.min(Math.round(request.maxSeconds), 600)
    : 120

  try {
    await recorderCall(deps.recorderBase, '/agent/start', {
      method: 'POST',
      body: {
        id,
        out: request.out,
        fps: request.fps,
        maxSeconds,
        format: request.format,
        // A walkthrough is meant to be shown, and the recorder's own "Agent is
        // recording" pill is drawn in the page — so on a screen-reading capture
        // it lands in the video. Silent asks the recorder not to draw it.
        silent: request.silent !== false,
        // A window source is what a walkthrough wants: a desktop capture puts
        // whatever else is open into the video. When the caller names no window,
        // the main one is used — a walkthrough is of this app, so asking the
        // caller to find a handle would be asking them to restate that.
        source: request.source ?? await defaultSource(deps.recorderBase),
      },
    })
  } catch (error) {
    // The recorder answers a bad request with its own `{ ok: false, error }`,
    // and that sentence is the only thing that says WHAT was wrong — dropping it
    // in favour of "answered 400" leaves the caller guessing at its own message.
    return { status: 'error', reason: `the recorder refused to start: ${String(error.message ?? error)}` }
  }

  try {
    await until(async () => {
      const job = await recorderJob(deps.recorderBase)
      return job?.id === id && job.status === 'recording'
    }, START_TIMEOUT_MS, 'the recording to begin')
  } catch (error) {
    await discard(deps.recorderBase).catch(() => {})
    return { status: 'error', reason: String(error.message ?? error) }
  }

  // The page executes the steps and reports how each went. It is reached through
  // the console channel, which is the same transport every ui.* action uses.
  const played = await deps.channel.request('ui.pipeline', {
    steps: normalized.steps,
    stopOnError: true,
  })

  if (played?.status !== 'ok') {
    // A walkthrough that went wrong is not worth keeping: stop and discard, so a
    // failed run leaves no file behind.
    await recorderCall(deps.recorderBase, `/agent/stop?id=${encodeURIComponent(id)}`, { method: 'POST' }).catch(() => {})
    await discard(deps.recorderBase).catch(() => {})
    const failed = played?.failed
    return {
      status: 'error',
      reason: failed === undefined
        ? `the walkthrough did not run: ${String(played?.reason ?? 'no answer from the interface')}`
        : `step ${String(failed.index + 1)} failed: ${String(failed.reason)}`,
      failed,
      completed: played?.completed,
    }
  }

  try {
    await recorderCall(deps.recorderBase, `/agent/stop?id=${encodeURIComponent(id)}`, { method: 'POST' })
  } catch (error) {
    await discard(deps.recorderBase).catch(() => {})
    return { status: 'error', reason: `could not stop the recording: ${String(error.message ?? error)}` }
  }

  // Waiting for the file.
  //
  // Stopping moves the job to `encoding`; the PAGE encodes and POSTs the
  // result back, and `handleAgentSave` writes the file and marks the run
  // `done`, while `handleAgentError` marks it `error`. A failed encode ALSO
  // clears the job, so "no job" cannot tell success from failure — an earlier
  // version of this waited on exactly that and reported discarded takes as
  // saved. The outcome lives in the recorder's state file, which is what is
  // read here.
  const outcome = await until(
    () => recorderOutcome(deps.recorderBase, id),
    ENCODE_TIMEOUT_MS,
    'the recording to be encoded and saved',
  ).catch((error) => ({ status: 'timeout', reason: String(error.message ?? error) }))

  if (outcome.status !== 'done') {
    return {
      status: 'error',
      reason: outcome.status === 'error'
        ? `the recording was discarded: ${String(outcome.error ?? 'the encoder failed')}`
        : `the recording was stopped but never saved: ${String(outcome.reason ?? 'no outcome was reported')}`,
      // The steps themselves succeeded; only the encode did not. Saying which
      // half failed is what tells the caller whether to re-shoot the walkthrough.
      steps: normalized.steps.length,
      completed: played.completed ?? normalized.steps.length,
    }
  }
  return {
    status: 'ok',
    target: 'recording',
    // The receipt a caller needs to talk about the take: which run it was, when
    // it ran, and how long it actually captured. Without these, two recordings
    // of the same walkthrough are indistinguishable in a report.
    recordingId: id,
    out: request.out,
    startedAt,
    stoppedAt: Date.now(),
    durationMs: Date.now() - startedAt,
    steps: normalized.steps.length,
    completed: played.completed ?? normalized.steps.length,
    verified: true,
  }
}

/** Ask the recorder to throw away whatever it is holding. */
async function discard(base) {
  await recorderCall(base, '/record/discard', { method: 'POST' })
}
