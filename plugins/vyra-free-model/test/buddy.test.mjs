import test from 'node:test'
import assert from 'node:assert/strict'
import { toBuddyMessages, sanitize, buddyExpired, buddyHeaders, fetchBuddyModels, buddyCatalog, streamBuddyTurn } from '../src/buddy.js'
import { PRODUCTS } from '../src/buddy-login.js'

test('every system prompt is replaced with the neutral one', () => {
  const wire = toBuddyMessages([
    { role: 'system', content: [{ type: 'text', text: 'You are an AI agent powered by DeepSeek Harness.' }] },
    { role: 'user', content: [{ type: 'text', text: 'hi' }] },
  ])
  assert.equal(wire[0].role, 'system')
  assert.equal(wire[0].content.includes('DeepSeek Harness'), false)
  assert.equal(wire[1].content, 'hi')
})

test('a trigger sentence in assistant history is washed out too', () => {
  const text = 'Tokens prefixed with @ are paths the user explicitly referenced.'
  const wire = toBuddyMessages([
    { role: 'assistant', content: [{ type: 'text', text }] },
    { role: 'user', content: [{ type: 'text', text: 'again' }] },
  ])
  const assistant = wire.find(message => message.role === 'assistant')
  assert.ok(assistant !== undefined)
  assert.equal(String(assistant.content).includes('explicitly referenced'), false)
})

test('an image without a resolver is a visible placeholder, not silence', () => {
  const wire = toBuddyMessages([
    { role: 'user', content: [{ type: 'image', attachment: { attachmentId: 'x' } }] },
  ])
  assert.equal(JSON.stringify(wire).includes('[image unavailable]'), true)
})

test('a tool-call turn keeps its calls and their sanitized arguments', () => {
  const wire = toBuddyMessages([
    {
      role: 'assistant',
      content: [{ type: 'tool-call', id: 'c1', name: 'read', arguments: '{"path":"a"}' }],
    },
  ])
  const assistant = wire.find(message => message.role === 'assistant')
  assert.equal(assistant.tool_calls[0].id, 'c1')
})

test('sanitize leaves ordinary text untouched', () => {
  assert.equal(sanitize('hello'), 'hello')
})

test('an expired or missing credential is reported expired', () => {
  assert.equal(buddyExpired(undefined), true)
  assert.equal(buddyExpired({ expires_at: '1' }), true)
  assert.equal(buddyExpired({ expires_at: String(Date.now() + 600_000) }), false)
})

test('a header carries the product and the token', () => {
  const headers = buddyHeaders(PRODUCTS.buddy, { access_token: 't', user_id: 'u' })
  assert.equal(headers.Authorization, 'Bearer t')
  assert.equal(headers['X-Product-Code'], 'codebuddy')
  assert.equal(headers['X-User-Id'], 'u')
})

test('the remote catalog is parsed with its window and modality', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({
    code: 0,
    data: {
      models: [
        { id: 'hy4flash', name: 'Hy4 flash', supportsToolCall: true, maxInputTokens: 1_000_000, supportsImage: true },
        { id: 'codewise', name: 'completion only', supportsToolCall: false },
      ],
    },
  }), { status: 200 })
  const rows = await fetchBuddyModels(PRODUCTS.buddy, { access_token: 't' }, { fetchImpl })
  assert.deepEqual(rows.map(row => row.id), ['hy4flash'])
  assert.equal(rows[0].contextWindow, 1_000_000)
  assert.equal(rows[0].vision, true)
})

test('a fallback catalog exists for CodeBuddy but not for WorkBuddy', () => {
  assert.ok(buddyCatalog(PRODUCTS.buddy, []).length > 0)
  assert.deepEqual(buddyCatalog(PRODUCTS.workbuddy, []), [])
})

test('a buddy turn streams chunks and finishes', async () => {
  const sse = [
    'data: {"model":"hy4flash","choices":[{"delta":{"content":"你"}}]}',
    '',
    'data: {"choices":[{"delta":{"content":"好"},"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":2}}',
    '',
    'data: [DONE]',
    '',
  ].join('\n')
  const fetchImpl = async (url, init) => {
    assert.equal(url, 'https://copilot.tencent.com/v2/chat/completions')
    assert.equal(init.headers.Authorization, 'Bearer t')
    const body = JSON.parse(init.body)
    assert.equal(body.model, 'hy4flash')
    return new Response(sse, { status: 200, headers: { 'content-type': 'text/event-stream' } })
  }
  const chunks = []
  for await (const chunk of streamBuddyTurn({
    product: PRODUCTS.buddy,
    credential: { access_token: 't' },
    options: {
      model: 'hy4flash',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
      fetchImpl,
    },
  })) chunks.push(chunk)
  assert.equal(chunks.filter(chunk => chunk.type === 'text-delta').map(chunk => chunk.text).join(''), '你好')
  assert.equal(chunks.find(chunk => chunk.type === 'finish').reason.kind, 'stop')
})
