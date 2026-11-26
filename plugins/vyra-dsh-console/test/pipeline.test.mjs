// The recorded-walkthrough pipeline: step validation, and the recording
// lifecycle around the steps.
//
//   node --test plugins/vyra-dsh-console/test/pipeline.test.mjs
//
// The recorder is stubbed at the HTTP boundary, because the contract that
// matters here is "what does this plugin send, and what does it do with each
// answer" — not the recorder's own internals.
import { strict as assert } from 'node:assert'
import test from 'node:test'

import { normalizeSteps, preflight, runRecordedWalkthrough, STEP_ACTIONS } from '../domains/pipeline.js'

// ---------------------------------------------------------------------------
// Step validation.
// ---------------------------------------------------------------------------

test('every supported action normalizes', () => {
  const cases = {
    open: { open: { target: 'settings', section: 'dsh-vyra-free-model' } },
    close: { close: true },
    act: { act: { name: '模型', action: 'click' } },
    invoke: { invoke: 'settings.open' },
    wait: { wait: 500 },
    expect: { expect: { modal: 'settings' } },
    snapshot: { snapshot: {} },
    scroll: { scroll: { name: '账号', dy: 200 } },
  }
  for (const [action, body] of Object.entries(cases)) {
    const result = normalizeSteps([{ ...body }, { act: { name: 'x', action: 'click' } }])
    assert.equal(result.error, undefined, `${action} must normalize: ${result.error}`)
    assert.equal(result.steps.length, 2)
  }
  assert.deepEqual([...STEP_ACTIONS].sort(), Object.keys(cases).sort())
})

test('an empty or missing step list is refused', () => {
  assert.match(normalizeSteps([]).error, /non-empty/u)
  assert.match(normalizeSteps(undefined).error, /non-empty/u)
  assert.match(normalizeSteps('nope').error, /non-empty/u)
})

test('a step list that changes nothing is refused', () => {
  // A recording of a page that never changes is a still frame, and it would
  // look like the run succeeded.
  const result = normalizeSteps([{ wait: 100 }, { expect: { modal: null } }])
  assert.match(result.error, /at least one step that changes the page/u)
})

test('a step carrying two actions is refused', () => {
  const result = normalizeSteps([{ act: { name: 'a', action: 'click' }, wait: 10 }])
  assert.match(result.error, /one action per step/u)
})

test('a step carrying no action is refused', () => {
  const result = normalizeSteps([{ settle: 100 }])
  assert.match(result.error, /needs one of/u)
})

test('act requires a name and a known action', () => {
  assert.match(normalizeSteps([{ act: { action: 'click' } }]).error, /needs a name/u)
  assert.match(normalizeSteps([{ act: { name: 'a', action: 'explode' } }]).error, /must be click, type or select/u)
})

test('a negative or non-numeric settle is refused', () => {
  assert.match(normalizeSteps([{ act: { name: 'a', action: 'click' }, settle: -1 }]).error, /non-negative/u)
  assert.match(normalizeSteps([{ act: { name: 'a', action: 'click' }, settle: 'soon' }]).error, /non-negative/u)
})

test('invoke requires an id, wait requires a duration', () => {
  assert.match(normalizeSteps([{ invoke: '' }]).error, /command id/u)
  assert.match(normalizeSteps([{ wait: -5 }]).error, /non-negative/u)
})

test('the step limit is enforced', () => {
  const many = Array.from({ length: 201 }, () => ({ act: { name: 'a', action: 'click' } }))
  assert.match(normalizeSteps(many).error, /at most 200/u)
})

// ---------------------------------------------------------------------------
// The recording lifecycle, with the recorder stubbed.
// ---------------------------------------------------------------------------

/**
 * A fetch stub standing in for the recorder's routes.
 *
 * `job` is the mutable job state the stub reports; `calls` records every request
 * so a test can assert the ORDER of start/stop/discard, which is the part a
 * pipeline gets wrong.
 */
function recorderStub({ startFails = false, stopFails = false, encodeHangs = false } = {}) {
  const calls = []
  let job = null
  const fetch = async (url, options = {}) => {
    const path = new URL(url).pathname.replace('/plugins/vyra-screen-recorder', '')
    const method = options.method ?? 'GET'
    calls.push(`${method} ${path.split('?')[0]}`)
    const json = (status, body) => ({
      ok: status < 400,
      status,
      text: async () => JSON.stringify(body),
    })
    if (path.startsWith('/agent/status')) {
      return json(200, { ok: true, job })
    }
    if (path.startsWith('/agent/start')) {
      if (startFails) return json(500, { ok: false, error: 'no display' })
      job = { id: JSON.parse(options.body).id, status: 'recording', startedAt: Date.now() }
      return json(200, { ok: true, id: job.id })
    }
    if (path.startsWith('/agent/stop')) {
      if (stopFails) return json(500, { ok: false, error: 'stop failed' })
      if (job !== null) job.status = 'encoding'
      return json(200, { ok: true, stopped: true })
    }
    if (path.startsWith('/record/discard')) {
      job = null
      return json(200, { ok: true })
    }
    return json(404, { ok: false, error: 'unknown route' })
  }
  // The encode completes once the job has entered `encoding`. Polled rather than
  // scheduled because the transition happens inside another async call: a
  // self-rescheduling `setImmediate` would spin a timer for the whole test run
  // and hold the process open.
  if (!encodeHangs) {
    const timer = setInterval(() => {
      if (job !== null && job.status === 'encoding') {
        job = null
        clearInterval(timer)
      }
    }, 5)
    timer.unref?.()
  }
  return { fetch, calls, state: () => ({ job }), setJob: (next) => { job = next } }
}

/** Run the pipeline against a stub with a step player that always succeeds. */
async function run(stub, { played = { status: 'ok', completed: 3 }, steps } = {}) {
  const realFetch = globalThis.fetch
  globalThis.fetch = stub.fetch
  try {
    return await runRecordedWalkthrough(
      {
        recorderBase: 'http://127.0.0.1:9999',
        channel: { request: async () => played },
      },
      { out: 'demo.mp4', maxSeconds: 30, steps: steps ?? [
        { act: { name: '模型', action: 'click' } },
        { act: { name: '账号', action: 'click' } },
        { act: { name: '重新检测', action: 'click' } },
      ] },
    )
  } finally {
    globalThis.fetch = realFetch
  }
}

test('a successful walkthrough starts, plays, stops and keeps the file', async () => {
  const stub = recorderStub()
  const result = await run(stub)
  assert.equal(result.status, 'ok', JSON.stringify(result))
  assert.equal(result.verified, true)
  assert.equal(result.out, 'demo.mp4')
  assert.equal(result.steps, 3)
  assert.deepEqual(
    stub.calls.filter((call) => !call.includes('status')),
    ['POST /agent/start', 'POST /agent/stop'],
    'start before playing and stop after, with no discard',
  )
})

test('a failed step stops and discards, leaving no file', async () => {
  // The rule the user asked for: a take that went wrong is not worth keeping.
  const stub = recorderStub()
  const result = await run(stub, {
    played: {
      status: 'error',
      reason: 'no element named "重新检测" is on the page',
      failed: { index: 2, step: {}, reason: 'no element named "重新检测" is on the page', code: 'not_found' },
      completed: 2,
    },
  })
  assert.equal(result.status, 'error')
  assert.match(result.reason, /step 3 failed/u, 'the error names the step by its 1-based number')
  assert.equal(result.failed.code, 'not_found')
  assert.equal(result.completed, 2)
  assert.ok(stub.calls.includes('POST /record/discard'), 'the recording must be thrown away')
  assert.equal(stub.state().job, null)
})

test('a refused start never reaches the page', async () => {
  const stub = recorderStub({ startFails: true })
  let played = 0
  const realFetch = globalThis.fetch
  globalThis.fetch = stub.fetch
  try {
    const result = await runRecordedWalkthrough(
      { recorderBase: 'http://127.0.0.1:9999', channel: { request: async () => { played += 1; return { status: 'ok' } } } },
      { out: 'demo.mp4', steps: [{ act: { name: 'a', action: 'click' } }] },
    )
    assert.equal(result.status, 'error')
    assert.match(result.reason, /refused to start/u)
    assert.equal(played, 0, 'steps must not run when nothing is recording')
  } finally {
    globalThis.fetch = realFetch
  }
})

test('a failed stop discards rather than leaving a running recording', async () => {
  const stub = recorderStub({ stopFails: true })
  const result = await run(stub)
  assert.equal(result.status, 'error')
  assert.match(result.reason, /could not stop/u)
  assert.ok(stub.calls.includes('POST /record/discard'))
})

test('a malformed step list is refused before anything starts', async () => {
  const stub = recorderStub()
  const result = await run(stub, { steps: [] })
  assert.equal(result.status, 'error')
  assert.match(result.reason, /non-empty/u)
  assert.deepEqual(stub.calls, [], 'nothing may be touched for an invalid request')
})

test('a recording already running is refused', async () => {
  const stub = recorderStub()
  stub.setJob({ id: 'other', status: 'recording' })
  const realFetch = globalThis.fetch
  globalThis.fetch = stub.fetch
  try {
    const problems = await preflight('http://127.0.0.1:9999')
    assert.ok(problems.some((problem) => /already running/u.test(problem)), JSON.stringify(problems))
  } finally {
    globalThis.fetch = realFetch
  }
})

test('a missing recorder is named, with what to do about it', async () => {
  const realFetch = globalThis.fetch
  globalThis.fetch = async () => {
    throw new Error('ECONNREFUSED')
  }
  try {
    const problems = await preflight('http://127.0.0.1:9999')
    assert.equal(problems.length, 1)
    assert.match(problems[0], /dsh-vyra-screen-recorder/u)
    assert.match(problems[0], /install or enable/u, 'the message must say what to do')
  } finally {
    globalThis.fetch = realFetch
  }
})

test('no web server is reported as such', async () => {
  const problems = await preflight(undefined)
  assert.match(problems[0], /no web server/u)
})
