import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeBaseUrl, endpointModelId, parseEndpointModelId, sanitizeEndpoints,
  fetchEndpointModels, isCallableBaseUrl,
} from '../src/endpoints.js'

test('a pasted chat URL is reduced to the base', () => {
  assert.equal(normalizeBaseUrl('https://ark.cn-beijing.volces.com/api/v3/chat/completions'),
    'https://ark.cn-beijing.volces.com/api/v3')
  assert.equal(normalizeBaseUrl('https://api.moonshot.cn/v1/'), 'https://api.moonshot.cn/v1')
  assert.equal(normalizeBaseUrl('api.deepseek.com/v1'), 'https://api.deepseek.com/v1')
  assert.equal(normalizeBaseUrl(''), '')
})

test('only http(s) URLs without embedded credentials can be called', () => {
  assert.equal(isCallableBaseUrl('https://example.com/v1'), true)
  assert.equal(isCallableBaseUrl('http://127.0.0.1:8000/v1'), true)
  assert.equal(isCallableBaseUrl('file:///etc/passwd'), false)
  assert.equal(isCallableBaseUrl('https://user:pass@example.com'), false)
})

test('a composite model id round-trips even when the model contains a slash', () => {
  const id = endpointModelId('e12ab', 'vendor/model')
  assert.equal(id, 'ep:e12ab/vendor/model')
  assert.deepEqual(parseEndpointModelId(id), { endpointId: 'e12ab', modelId: 'vendor/model' })
  assert.equal(parseEndpointModelId('kilo-auto/free'), undefined)
})

test('stored endpoints are filtered and normalized', () => {
  const rows = sanitizeEndpoints([
    { id: 'abc', name: 'Ark', baseUrl: 'https://ark.example/v3/', apiKey: 'k', models: [] },
    { id: 'bad id', baseUrl: 'https://x' },
    { id: 'file', baseUrl: 'file:///x' },
    null,
  ])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].baseUrl, 'https://ark.example/v3')
  assert.equal(rows[0].enabled, true)
})

test('the model list is read from an OpenAI-shaped answer', async () => {
  const fetchImpl = async (url, init) => {
    assert.equal(url, 'https://ark.example/v3/models')
    assert.equal(init.headers.authorization, 'Bearer k')
    return new Response(JSON.stringify({
      data: [
        { id: 'doubao-x', name: 'Doubao X', context_length: 256000, supports_vision: true },
        'plain-id',
      ],
    }), { status: 200 })
  }
  const rows = await fetchEndpointModels({ baseUrl: 'https://ark.example/v3', apiKey: 'k' }, { fetchImpl })
  assert.deepEqual(rows.map(row => row.id), ['doubao-x', 'plain-id'])
  assert.equal(rows[0].contextWindow, 256000)
  assert.equal(rows[0].vision, true)
})
