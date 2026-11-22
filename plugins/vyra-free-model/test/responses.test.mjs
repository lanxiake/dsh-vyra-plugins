import test from 'node:test'
import assert from 'node:assert/strict'
import { readResponsesSse, toResponsesBody, responsesJson } from '../src/responses.js'

/** Collect `{ type, data }` frames from one SSE text blob. */
function frames(text) {
  return text
    .split('\n\n')
    .filter(block => block.trim() !== '')
    .map(block => {
      const event = /^event: (.+)$/m.exec(block)?.[1]
      const data = /^data: (.+)$/m.exec(block)?.[1]
      return { type: event, data: data === undefined ? undefined : JSON.parse(data) }
    })
}

test('the responses body is translated from the chat shape', () => {
  const body = toResponsesBody({
    model: 'kilo-auto/free',
    input: [
      { role: 'user', content: [{ type: 'input_text', text: 'hello' }] },
    ],
    instructions: 'be brief',
    max_output_tokens: 400,
  })
  assert.equal(body.model, 'kilo-auto/free')
  assert.equal(body.maxTokens, 400)
  assert.deepEqual(body.messages, [
    { role: 'system', content: [{ type: 'text', text: 'be brief' }] },
    { role: 'user', content: [{ type: 'text', text: 'hello' }] },
  ])
})

test('a plain string input becomes one user turn', () => {
  const body = toResponsesBody({ model: 'm', input: 'say pong' })
  assert.deepEqual(body.messages, [{ role: 'user', content: [{ type: 'text', text: 'say pong' }] }])
})

test('function_call items in the input become assistant tool calls', () => {
  const body = toResponsesBody({
    model: 'm',
    input: [
      { role: 'user', content: [{ type: 'input_text', text: 'time?' }] },
      { type: 'function_call', call_id: 'call-1', name: 'get_time', arguments: '{"city":"Beijing"}' },
      { type: 'function_call_output', call_id: 'call-1', output: '21:05' },
    ],
  })
  const assistant = body.messages.find(message => message.role === 'assistant')
  assert.ok(assistant !== undefined, 'the function call must become an assistant turn')
  assert.deepEqual(assistant.content, [{ type: 'tool-call', id: 'call-1', name: 'get_time', arguments: '{"city":"Beijing"}' }])
  const tool = body.messages.find(message => message.role === 'tool')
  assert.equal(tool.toolCallId, 'call-1')
})

test('the stream announces response.created first with a strictly increasing sequence', () => {
  const sse = readResponsesSse([{ type: 'text-delta', text: 'pong' }], { model: 'm', id: 'resp-1' })
  const list = frames(sse)
  assert.equal(list[0].type, 'response.created')
  const numbers = list.map(frame => frame.data.sequence_number)
  assert.deepEqual(numbers, numbers.map((_, index) => index), 'sequence_number must start at 0 and increase by one')
})

test('text arrives as an announced message item, then a delta, then done', () => {
  const sse = readResponsesSse([{ type: 'text-delta', text: 'pong' }], { model: 'm', id: 'resp-1' })
  const types = frames(sse).map(frame => frame.type)
  const added = types.indexOf('response.output_item.added')
  const delta = types.indexOf('response.output_text.delta')
  const done = types.indexOf('response.output_text.done')
  assert.ok(added !== -1 && delta !== -1 && done !== -1, `missing frames: ${types.join(',')}`)
  assert.ok(added < delta, 'the item must be announced before its delta')
  assert.ok(delta < done)
})

test('the delta carries the text and points at the announced item', () => {
  const list = frames(readResponsesSse([{ type: 'text-delta', text: 'pong' }], { model: 'm', id: 'resp-1' }))
  const added = list.find(frame => frame.type === 'response.output_item.added')
  const delta = list.find(frame => frame.type === 'response.output_text.delta')
  assert.equal(delta.data.delta, 'pong')
  assert.equal(delta.data.item_id, added.data.item.id)
  assert.equal(delta.data.output_index, added.data.output_index)
})

test('item ids are unique per response so a later turn cannot reuse them', () => {
  const first = frames(readResponsesSse([{ type: 'text-delta', text: 'a' }], { model: 'm', id: 'resp-aaa' }))
  const second = frames(readResponsesSse([{ type: 'text-delta', text: 'b' }], { model: 'm', id: 'resp-bbb' }))
  const idOf = list => list.find(frame => frame.type === 'response.output_item.added').data.item.id
  assert.notEqual(idOf(first), idOf(second))
  assert.ok(idOf(first).includes('aaa'), 'the id must be scoped to its own response')
})

test('a completed response lists exactly the items it announced', () => {
  const list = frames(readResponsesSse([{ type: 'text-delta', text: 'pong' }], { model: 'm', id: 'resp-1' }))
  const completed = list.find(frame => frame.type === 'response.completed')
  assert.equal(completed.data.response.status, 'completed')
  assert.equal(completed.data.response.output.length, 1)
  assert.equal(completed.data.response.output[0].content[0].text, 'pong')
})

test('reasoning becomes its own item so the client can fold it', () => {
  const list = frames(readResponsesSse([
    { type: 'reasoning-delta', text: 'thinking' },
    { type: 'text-delta', text: 'answer' },
  ], { model: 'm', id: 'resp-1' }))
  const added = list.filter(frame => frame.type === 'response.output_item.added')
  assert.equal(added.length, 2, 'reasoning and the message are separate items')
  assert.ok(added.some(frame => frame.data.item.type === 'reasoning'))
  assert.ok(added.some(frame => frame.data.item.type === 'message'))
  const completed = list.find(frame => frame.type === 'response.completed')
  assert.equal(completed.data.response.output.length, 2)
})

test('a tool call becomes a function_call item with its arguments', () => {
  const list = frames(readResponsesSse([
    { type: 'tool-call', id: 'call-1', name: 'get_time', arguments: '{"city":"Beijing"}' },
  ], { model: 'm', id: 'resp-1' }))
  const done = list.find(frame => frame.type === 'response.output_item.done'
    && frame.data.item.type === 'function_call')
  assert.ok(done !== undefined, 'the function call item must be closed')
  assert.equal(done.data.item.name, 'get_time')
  assert.equal(done.data.item.arguments, '{"city":"Beijing"}')
  assert.equal(done.data.item.call_id, 'call-1')
})

test('output_index values are distinct and follow announcement order', () => {
  const list = frames(readResponsesSse([
    { type: 'reasoning-delta', text: 'think' },
    { type: 'text-delta', text: 'answer' },
    { type: 'tool-call', id: 'c1', name: 'go', arguments: '{}' },
  ], { model: 'm', id: 'resp-1' }))
  const indexes = list
    .filter(frame => frame.type === 'response.output_item.added')
    .map(frame => frame.data.output_index)
  assert.deepEqual(indexes, [0, 1, 2], 'announcement order must take consecutive indexes')
})

test('usage is reported on the completed response', () => {
  const list = frames(readResponsesSse([
    { type: 'text-delta', text: 'x' },
    { type: 'usage', usage: { inputTokens: 11, outputTokens: 22 } },
  ], { model: 'm', id: 'resp-1' }))
  const completed = list.find(frame => frame.type === 'response.completed')
  assert.equal(completed.data.response.usage.input_tokens, 11)
  assert.equal(completed.data.response.usage.output_tokens, 22)
})

test('an empty turn still produces a well-formed response', () => {
  const list = frames(readResponsesSse([], { model: 'm', id: 'resp-1' }))
  const completed = list.find(frame => frame.type === 'response.completed')
  assert.ok(completed !== undefined)
  assert.equal(completed.data.response.status, 'completed')
  assert.deepEqual(completed.data.response.output, [])
})

test('the non-streaming body mirrors the streamed result', () => {
  const body = responsesJson([{ type: 'text-delta', text: 'pong' }], { model: 'm', id: 'resp-1', created: 123 })
  assert.equal(body.object, 'response')
  assert.equal(body.status, 'completed')
  assert.equal(body.output[0].content[0].text, 'pong')
  assert.equal(body.created_at, 123)
})

test('a failure is reported as an error event, not a silent empty answer', () => {
  const list = frames(readResponsesSse([], { model: 'm', id: 'resp-1', failure: { message: 'upstream down', code: 'SERVER' } }))
  const failed = list.find(frame => frame.type === 'response.failed')
  assert.ok(failed !== undefined, `expected response.failed, got ${list.map(f => f.type).join(',')}`)
  assert.ok(failed.data.response.error.message.includes('upstream down'))
})
