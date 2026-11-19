// Timing rules of the per-peer batcher, on a manual clock.
import assert from 'node:assert/strict'
import test from 'node:test'
import { createBatchScheduler } from '../lib/batch.js'

function manualClock() {
  let time = 0
  let nextId = 0
  const timers = new Map()
  return {
    now: () => time,
    setTimer(fn, ms) {
      const id = (nextId += 1)
      timers.set(id, { at: time + ms, fn })
      return id
    },
    clearTimer(id) {
      timers.delete(id)
    },
    advance(ms) {
      time += ms
      let fired = true
      while (fired) {
        fired = false
        for (const [id, timer] of [...timers]) {
          if (timer.at <= time) {
            timers.delete(id)
            timer.fn()
            fired = true
          }
        }
      }
    },
  }
}

function scheduler() {
  const clock = manualClock()
  const batches = []
  const batcher = createBatchScheduler({
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    mergeWindowMs: 20_000,
    replyTimeoutMs: 120_000,
    onFlush: (key, messages) => batches.push({ key, messages }),
  })
  return { clock, batcher, batches }
}

test('the merge window covers a burst and is extended by each message', () => {
  const { clock, batcher, batches } = scheduler()
  batcher.push('peer', { text: '一' }, { mode: 'auto', cooldownMs: 60_000 })
  clock.advance(10_000)
  batcher.push('peer', { text: '二' }, { mode: 'auto', cooldownMs: 60_000 })
  clock.advance(10_000)
  assert.equal(batches.length, 0, 'the second message must extend the window')
  clock.advance(10_000)
  assert.equal(batches.length, 1)
  assert.deepEqual(batches[0].messages, [{ text: '一' }, { text: '二' }])
})

test('messages during the cooldown are merged and delivered when it ends', () => {
  const { clock, batcher, batches } = scheduler()
  batcher.push('peer', { text: '一' }, { mode: 'auto', cooldownMs: 60_000 })
  clock.advance(20_000)
  assert.equal(batches.length, 1)
  batcher.reply('peer', 60_000)
  batcher.push('peer', { text: '二' }, { mode: 'auto', cooldownMs: 60_000 })
  clock.advance(59_000)
  assert.equal(batches.length, 1, 'still cooling down')
  clock.advance(1_000)
  assert.equal(batches.length, 2)
  assert.deepEqual(batches[1].messages, [{ text: '二' }])
})

test('nothing is delivered while the agent has not answered the previous batch', () => {
  const { clock, batcher, batches } = scheduler()
  batcher.push('peer', { text: '一' }, { mode: 'draft', cooldownMs: 0 })
  clock.advance(20_000)
  assert.equal(batches.length, 1)
  batcher.push('peer', { text: '二' }, { mode: 'draft', cooldownMs: 0 })
  clock.advance(30_000)
  assert.equal(batches.length, 1, 'the next batch waits for a reply or the reply timeout')
  batcher.reply('peer', 0)
  assert.equal(batches.length, 2, 'a reply with no cooldown releases the accumulated batch')
})

test('the user replying from their phone clears the queue', () => {
  const { clock, batcher, batches } = scheduler()
  batcher.push('peer', { text: '一' }, { mode: 'auto', cooldownMs: 60_000 })
  clock.advance(10_000)
  batcher.userSpoke('peer')
  clock.advance(30_000)
  assert.equal(batches.length, 0)
})

test('a restored batch is rescheduled from the persisted timestamps', () => {
  const { clock, batcher, batches } = scheduler()
  batcher.restore([{
    key: 'peer',
    messages: [{ text: '一' }],
    mode: 'auto',
    cooldownMs: 60_000,
    cooldownUntil: 0,
    awaitingUntil: 0,
  }])
  clock.advance(20_000)
  assert.equal(batches.length, 1)
})