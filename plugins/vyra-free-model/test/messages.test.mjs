import test from 'node:test'
import assert from 'node:assert/strict'
import { toChatMessages, toToolDefs, toUsage } from '../src/messages.js'

test('text turns become plain chat messages', () => {
  const out = toChatMessages([
    { role: 'user', content: [{ type: 'text', text: 'hi' }] },
  ], undefined, [])
  assert.deepEqual(out, [{ role: 'user', content: 'hi' }])
})

test('a tool result becomes role:tool keyed by the call id', () => {
  const out = toChatMessages([
    { role: 'tool', toolCallId: 'c1', content: [{ type: 'text', text: 'sunny' }] },
  ], undefined, [])
  assert.deepEqual(out, [{ role: 'tool', tool_call_id: 'c1', content: 'sunny' }])
})

test('an assistant tool-call becomes tool_calls with stringified arguments', () => {
  const out = toChatMessages([
    { role: 'assistant', content: [{ type: 'tool-call', id: 'c1', name: 'get_weather', arguments: '{"city":"北京"}' }] },
  ], undefined, [])
  assert.equal(out[0].tool_calls[0].id, 'c1')
  assert.equal(out[0].tool_calls[0].function.name, 'get_weather')
  assert.equal(out[0].tool_calls[0].function.arguments, '{"city":"北京"}')
})

test('an image block without a resolver is dropped and reported', () => {
  const warnings = []
  const out = toChatMessages([
    { role: 'user', content: [{ type: 'text', text: 'see' }, { type: 'image', attachment: { attachmentId: 'a1' } }] },
  ], undefined, warnings)
  assert.deepEqual(out, [{ role: 'user', content: 'see' }])
  assert.deepEqual(warnings, ['image-dropped'])
})

test('an image block with a resolver becomes a data URL part', () => {
  const out = toChatMessages([
    { role: 'user', content: [{ type: 'text', text: 'see' }, { type: 'image', attachment: { attachmentId: 'a1' } }] },
  ], () => 'data:image/png;base64,AAA', [])
  assert.equal(out[0].content[1].type, 'image_url')
  assert.equal(out[0].content[1].image_url.url, 'data:image/png;base64,AAA')
})

test('tools are shaped for the chat wire', () => {
  const out = toToolDefs([{ name: 'get_weather', description: 'w', parameters: { type: 'object' } }])
  assert.deepEqual(out, [{ type: 'function', function: { name: 'get_weather', description: 'w', parameters: { type: 'object' } } }])
})

test('usage maps the three counts and tolerates missing reasoning', () => {
  assert.deepEqual(toUsage({ prompt_tokens: 10, completion_tokens: 20, reasoning_tokens: 5 }),
    { inputTokens: 10, outputTokens: 20, reasoningTokens: 5 })
  assert.deepEqual(toUsage({ prompt_tokens: 1, completion_tokens: 2 }),
    { inputTokens: 1, outputTokens: 2, reasoningTokens: 0 })
})

test('reasoning blocks are not projected back as message content', () => {
  const out = toChatMessages([
    { role: 'assistant', content: [{ type: 'reasoning', text: '想到一半' }, { type: 'text', text: '答案' }] },
  ], undefined, [])
  assert.equal(out[0].content, '答案')
})

test('an empty assistant turn is skipped rather than sent as an empty string', () => {
  const out = toChatMessages([{ role: 'assistant', content: [] }], undefined, [])
  assert.deepEqual(out, [])
})

test('a user turn with only an image becomes an image part', () => {
  const out = toChatMessages([
    { role: 'user', content: [{ type: 'image', attachment: { attachmentId: 'a1' } }] },
  ], () => 'data:image/png;base64,AAA', [])
  assert.deepEqual(out[0].content, [{ type: 'image_url', image_url: { url: 'data:image/png;base64,AAA' } }])
})

test('tool definitions without parameters get an empty object schema', () => {
  const out = toToolDefs([{ name: 'noop', description: 'nothing' }])
  assert.deepEqual(out[0].function.parameters, { type: 'object', properties: {} })
})

test('non-array tools produce an empty list', () => {
  assert.deepEqual(toToolDefs(undefined), [])
})
