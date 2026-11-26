import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAudio, createLoop, particleLimit } from '../render.js'

/* ------------------------------------------------------------------ audio */

function fakeContext({ failOnCreate = false } = {}) {
  const created = []
  let starts = 0
  class FakeAudioContext {
    constructor() {
      if (failOnCreate) throw new Error('blocked by autoplay policy')
      this.state = 'running'
      this.currentTime = 0
      this.sampleRate = 44100
      this.destination = {}
      created.push(this)
    }
    createOscillator() {
      return {
        type: '',
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() { return this },
        start() { starts++ },
        stop() {},
      }
    }
    createGain() {
      return {
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() { return this },
      }
    }
    createBufferSource() {
      return { buffer: null, connect() { return this }, start() { starts++ }, stop() {} }
    }
    createBuffer(channels, length) {
      const data = new Float32Array(length)
      return { getChannelData: () => data }
    }
    createBiquadFilter() {
      return { type: 'lowpass', frequency: { setValueAtTime() {} }, connect() { return this } }
    }
    close() { this.state = 'closed' }
  }
  return { FakeAudioContext, created, starts: () => starts }
}

test('audio is muted by default and plays nothing until unmuted', () => {
  const { FakeAudioContext, created, starts } = fakeContext()
  const audio = createAudio({ AudioContextCtor: FakeAudioContext })
  assert.equal(audio.isMuted(), true)
  audio.play('thud')
  assert.equal(created.length, 0, 'no AudioContext before a user gesture')
  assert.equal(starts(), 0)
})

test('every named sound plays after unmuting', () => {
  const { FakeAudioContext, starts } = fakeContext()
  const audio = createAudio({ AudioContextCtor: FakeAudioContext })
  audio.setMuted(false)
  for (const sound of ['whoosh', 'thud', 'clink', 'boom', 'crash']) {
    assert.doesNotThrow(() => audio.play(sound))
  }
  assert.ok(starts() > 0, 'oscillators or buffers actually started')
})

test('unknown sound names are ignored', () => {
  const { FakeAudioContext } = fakeContext()
  const audio = createAudio({ AudioContextCtor: FakeAudioContext })
  audio.setMuted(false)
  assert.doesNotThrow(() => audio.play('nope'))
})

test('a throwing AudioContext degrades to silence instead of failing', () => {
  const { FakeAudioContext } = fakeContext({ failOnCreate: true })
  const audio = createAudio({ AudioContextCtor: FakeAudioContext })
  audio.setMuted(false)
  assert.equal(audio.available(), false)
  assert.doesNotThrow(() => audio.play('boom'))
})

test('no AudioContext in the environment is not an error', () => {
  const audio = createAudio({ AudioContextCtor: undefined })
  assert.equal(audio.available(), false)
  audio.setMuted(false)
  assert.doesNotThrow(() => audio.play('whoosh'))
})

/* ------------------------------------------------------------------- loop */

test('144Hz and 30Hz produce the same tick count for the same elapsed time', () => {
  const run = (frameMs) => {
    let total = 0
    let frameCount = 0
    while (frameCount * frameMs < 995) frameCount++
    const loop = createLoop({
      step: () => { total++ },
    })
    loop.ticks(frameCount, frameMs)
    return total
  }
  const fast = run(1000 / 144)
  const slow = run(1000 / 30)
  assert.ok(Math.abs(fast - slow) <= 2, `144Hz=${fast} 30Hz=${slow}`)
})

test('a throwing step is caught and stops the loop', () => {
  let errors = 0
  const loop = createLoop({
    step: () => { throw new Error('draw failed') },
    onError: () => { errors++ },
  })
  assert.doesNotThrow(() => loop.ticks(10, 16))
  assert.equal(errors, 1, 'reported once')
  assert.equal(loop.isRunning(), false)
})

test('a long stall cannot fast-forward more than five steps', () => {
  let total = 0
  createLoop({ step: () => { total++ } }).ticks(1, 5000)
  assert.ok(total <= 5, `caught up ${total} steps`)
})

test('particle limit is capped at 300', () => {
  assert.equal(particleLimit(), 300)
})

test('start and stop are safe to call repeatedly', () => {
  let scheduled = 0
  const loop = createLoop({
    raf: () => { scheduled++; return scheduled },
    cancelRaf: () => {},
    step: () => {},
  })
  assert.doesNotThrow(() => {
    loop.start()
    loop.start()
    loop.stop()
    loop.stop()
  })
  assert.equal(scheduled, 1, 'starting twice schedules once')
})
