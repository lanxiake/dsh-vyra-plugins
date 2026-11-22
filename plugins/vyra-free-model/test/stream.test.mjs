import test from 'node:test'
import assert from 'node:assert/strict'
import { readChunks } from '../src/stream.js'

const collect = async (payloads, options) => {
  const out = []
  for await (const chunk of readChunks(payloads, options)) out.push(chunk)
  return out
}

test('text deltas become text-delta chunks in order', async () => {
  const chunks = await collect([
    '{"choices":[{"index":0,"delta":{"content":"你"}}]}',
    '{"choices":[{"index":0,"delta":{"content":"好"}}]}',
  ])
  const text = chunks.filter(c => c.type === 'text-delta').map(c => c.text).join('')
  assert.equal(text, '你好')
})

test('the reasoning field becomes reasoning-delta, not text', async () => {
  const chunks = await collect(['{"choices":[{"index":0,"delta":{"reasoning":"想一想"}}]}'])
  assert.equal(chunks.filter(c => c.type === 'reasoning-delta').length, 1)
  assert.equal(chunks.filter(c => c.type === 'text-delta').length, 0)
})

test('finish_reason produces one finish chunk', async () => {
  const chunks = await collect([
    '{"choices":[{"index":0,"delta":{"content":"x"},"finish_reason":"stop"}]}',
  ])
  const finishes = chunks.filter(c => c.type === 'finish')
  assert.equal(finishes.length, 1)
  assert.equal(finishes[0].reason.kind, 'stop')
})

test('length becomes max-tokens', async () => {
  const chunks = await collect(['{"choices":[{"index":0,"delta":{},"finish_reason":"length"}]}'])
  assert.equal(chunks.find(c => c.type === 'finish').reason.kind, 'max-tokens')
})

test('usage is emitted as a usage chunk', async () => {
  const chunks = await collect(['{"choices":[{"index":0,"delta":{}}],"usage":{"prompt_tokens":3,"completion_tokens":4}}'])
  const usage = chunks.find(c => c.type === 'usage')
  assert.deepEqual(usage.usage, { inputTokens: 3, outputTokens: 4, reasoningTokens: 0 })
})

test('malformed payloads are skipped without breaking the stream', async () => {
  const chunks = await collect(['not json', '{"choices":[{"index":0,"delta":{"content":"ok"}}]}'])
  assert.equal(chunks.filter(c => c.type === 'text-delta').length, 1)
})

test('an in-stream error envelope throws with its code', async () => {
  await assert.rejects(collect(['{"error":{"message":"boom","code":"rate_limit"}}']),
    err => err.code === 'RATE_LIMIT')
})

test('a new block announces itself once, before its first delta', async () => {
  const chunks = await collect([
    '{"choices":[{"index":0,"delta":{"content":"a"}}]}',
    '{"choices":[{"index":0,"delta":{"content":"b"}}]}',
  ])
  const starts = chunks.filter(c => c.type === 'block-start')
  assert.equal(starts.length, 1)
  assert.equal(starts[0].blockType, 'text')
  assert.equal(chunks[0].type, 'block-start')
  assert.equal(chunks.findIndex(c => c.type === 'text-delta') > chunks.findIndex(c => c.type === 'block-start'), true)
})

test('reasoning and text get different block indexes', async () => {
  const chunks = await collect([
    '{"choices":[{"index":0,"delta":{"reasoning":"想"}}]}',
    '{"choices":[{"index":0,"delta":{"content":"答"}}]}',
  ])
  const reasoning = chunks.find(c => c.type === 'block-start' && c.blockType === 'reasoning')
  const text = chunks.find(c => c.type === 'block-start' && c.blockType === 'text')
  assert.notEqual(reasoning.index, text.index)
})

test('every opened block is closed at the end of the stream', async () => {
  const chunks = await collect([
    '{"choices":[{"index":0,"delta":{"reasoning":"想"}}]}',
    '{"choices":[{"index":0,"delta":{"content":"答"}}]}',
    '{"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
  ])
  const started = chunks.filter(c => c.type === 'block-start').map(c => c.index).sort()
  const ended = chunks.filter(c => c.type === 'block-end').map(c => c.index).sort()
  assert.deepEqual(ended, started)
})

test('startIndex shifts every block index', async () => {
  const chunks = await collect(['{"choices":[{"index":0,"delta":{"content":"x"}}]}'], { startIndex: 5 })
  assert.equal(chunks.find(c => c.type === 'block-start').index, 5)
})

test('a block end carries the assembled text', async () => {
  const chunks = await collect([
    '{"choices":[{"index":0,"delta":{"content":"he"}}]}',
    '{"choices":[{"index":0,"delta":{"content":"llo"}}]}',
  ])
  const end = chunks.find(c => c.type === 'block-end' && c.block.type === 'text')
  assert.equal(end.block.text, 'hello')
})

test('a text block that already closed is not reopened by a late delta', async () => {
  const chunks = await collect([
    '{"choices":[{"index":0,"delta":{"content":"a"}}]}',
    '{"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
  ])
  assert.equal(chunks.filter(c => c.type === 'block-start' && c.blockType === 'text').length, 1)
  assert.equal(chunks.filter(c => c.type === 'block-end').length, 1)
})
