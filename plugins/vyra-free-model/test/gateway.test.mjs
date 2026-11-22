import test from 'node:test'
import assert from 'node:assert/strict'
import { startGateway } from '../src/gateway.js'

const models = [{ id: 'a:free', name: 'A', contextWindow: 1, maxOutput: 1, vision: false }]
const complete = async (_request, onChunk) => {
  onChunk({ text: 'hi' })
  return { usage: { inputTokens: 1, outputTokens: 1 } }
}

const withGateway = async (fn, overrides = {}) => {
  const gw = await startGateway({ port: 0, key: 'k', models, complete, ...overrides })
  try {
    await fn(gw)
  } finally {
    await gw.close()
  }
}

test('a request without Authorization is refused', async () => {
  await withGateway(async gw => {
    const res = await fetch(`http://127.0.0.1:${gw.port}/v1/models`)
    assert.equal(res.status, 401)
  })
})

test('a wrong key is refused', async () => {
  await withGateway(async gw => {
    const res = await fetch(`http://127.0.0.1:${gw.port}/v1/models`, { headers: { authorization: 'Bearer nope' } })
    assert.equal(res.status, 401)
  })
})

test('the right key lists models', async () => {
  await withGateway(async gw => {
    const res = await fetch(`http://127.0.0.1:${gw.port}/v1/models`, { headers: { authorization: 'Bearer k' } })
    assert.equal(res.status, 200)
    assert.equal((await res.json()).data[0].id, 'a:free')
  })
})

test('an unsupported method is rejected', async () => {
  await withGateway(async gw => {
    const res = await fetch(`http://127.0.0.1:${gw.port}/v1/chat/completions`, {
      method: 'PUT', headers: { authorization: 'Bearer k' },
    })
    assert.equal(res.status, 405)
  })
})

test('a non-streaming completion returns one JSON body', async () => {
  await withGateway(async gw => {
    const res = await fetch(`http://127.0.0.1:${gw.port}/v1/chat/completions`, {
      method: 'POST', headers: { authorization: 'Bearer k', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'a:free', messages: [{ role: 'user', content: 'hi' }] }),
    })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.choices[0].message.content, 'hi')
    assert.equal(body.object, 'chat.completion')
  })
})

test('a streaming completion yields SSE frames ending with [DONE]', async () => {
  await withGateway(async gw => {
    const res = await fetch(`http://127.0.0.1:${gw.port}/v1/chat/completions`, {
      method: 'POST', headers: { authorization: 'Bearer k', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'a:free', messages: [{ role: 'user', content: 'hi' }], stream: true }),
    })
    assert.equal(res.status, 200)
    const text = await res.text()
    assert.ok(text.includes('data: '))
    assert.ok(text.trimEnd().endsWith('data: [DONE]'))
    assert.ok(text.includes('"content":"hi"'))
  })
})

test('close() releases the port so the next bind succeeds', async () => {
  const a = await startGateway({ port: 0, key: 'k', models, complete })
  const port = a.port
  await a.close()
  const b = await startGateway({ port, key: 'k', models, complete })
  try {
    assert.equal(b.port, port)
  } finally {
    await b.close()
  }
})

test('an unknown path is 404', async () => {
  await withGateway(async gw => {
    const res = await fetch(`http://127.0.0.1:${gw.port}/v1/other`, { headers: { authorization: 'Bearer k' } })
    assert.equal(res.status, 404)
  })
})

test('a client that disconnects mid-stream aborts the upstream call', async () => {
  let aborted = false
  const slow = async (request, onChunk) => {
    onChunk({ text: 'first' })
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 5000)
      request.signal.addEventListener('abort', () => {
        aborted = true
        clearTimeout(timer)
        reject(new Error('aborted'))
      }, { once: true })
    })
    return { usage: { inputTokens: 0, outputTokens: 0 } }
  }
  const gw = await startGateway({ port: 0, key: 'k', models, complete: slow })
  const controller = new AbortController()
  try {
    const res = await fetch(`http://127.0.0.1:${gw.port}/v1/chat/completions`, {
      method: 'POST', headers: { authorization: 'Bearer k', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'a:free', messages: [], stream: true }),
      signal: controller.signal,
    })
    const reader = res.body.getReader()
    await reader.read()
    controller.abort()
    await new Promise(resolve => setTimeout(resolve, 150))
    assert.equal(aborted, true)
  } finally {
    await gw.close()
  }
})

test('a malformed body is refused rather than crashing the server', async () => {
  await withGateway(async gw => {
    const res = await fetch(`http://127.0.0.1:${gw.port}/v1/chat/completions`, {
      method: 'POST', headers: { authorization: 'Bearer k', 'content-type': 'application/json' },
      body: '{not json',
    })
    assert.equal(res.status, 400)
  })
})

test('an error thrown by the completion becomes a 502 with a message', async () => {
  await withGateway(async gw => {
    const res = await fetch(`http://127.0.0.1:${gw.port}/v1/chat/completions`, {
      method: 'POST', headers: { authorization: 'Bearer k', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'a:free', messages: [] }),
    })
    assert.equal(res.status, 502)
  }, { complete: async () => { throw new Error('boom') } })
})

test('/v1/responses streams the typed event sequence Codex reads', async () => {
  await withGateway(async gw => {
    const res = await fetch(`http://127.0.0.1:${gw.port}/v1/responses`, {
      method: 'POST', headers: { authorization: 'Bearer k', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'a:free', input: 'hi', stream: true }),
    })
    assert.equal(res.status, 200)
    const text = await res.text()
    const types = [...text.matchAll(/^event: (\S+)$/gm)].map(m => m[1])
    assert.equal(types[0], 'response.created')
    assert.ok(types.includes('response.output_text.delta'))
    assert.ok(types.includes('response.completed'))
    assert.ok(text.includes('"delta":"hi"'))

    // The contract the client checks on every frame.
    const numbers = [...text.matchAll(/"sequence_number":(\d+)/g)].map(m => Number(m[1]))
    assert.deepEqual(numbers, numbers.map((_, index) => index))
  })
})

test('/v1/responses answers a non-streaming call with one JSON body', async () => {
  await withGateway(async gw => {
    const res = await fetch(`http://127.0.0.1:${gw.port}/v1/responses`, {
      method: 'POST', headers: { authorization: 'Bearer k', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'a:free', input: 'hi' }),
    })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.object, 'response')
    assert.equal(body.status, 'completed')
    assert.equal(body.output[0].content[0].text, 'hi')
  })
})

test('/v1/responses carries instructions as a system turn', async () => {
  const seen = []
  await withGateway(async gw => {
    await fetch(`http://127.0.0.1:${gw.port}/v1/responses`, {
      method: 'POST', headers: { authorization: 'Bearer k', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'a:free', input: 'hi', instructions: 'be brief' }),
    })
  }, { complete: async (request, onChunk) => { seen.push(request.messages); onChunk({ text: 'x' }); return {} } })
  assert.equal(seen[0][0].role, 'system')
  assert.equal(seen[0][0].content[0].text, 'be brief')
})

test('/v1/responses refuses an unknown model like the chat endpoint does', async () => {
  await withGateway(async gw => {
    const res = await fetch(`http://127.0.0.1:${gw.port}/v1/responses`, {
      method: 'POST', headers: { authorization: 'Bearer k', 'content-type': 'application/json' },
      body: JSON.stringify({ model: '', input: 'hi' }),
    })
    assert.equal(res.status, 400)
  })
})

test('/v1/responses still requires the bearer key', async () => {
  await withGateway(async gw => {
    const res = await fetch(`http://127.0.0.1:${gw.port}/v1/responses`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'a:free', input: 'hi' }),
    })
    assert.equal(res.status, 401)
  })
})
