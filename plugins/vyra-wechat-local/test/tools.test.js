// Registration check: only whitelisted tools appear, and sidecar content is projected
// into DSH blocks (image base64 → attachment reference).
import assert from 'node:assert/strict'
import test from 'node:test'
import { createToolRegistrar } from '../lib/tools.js'

function harness(call, attachments) {
  const defs = []
  const ctx = { tools: { register: (definition) => (defs.push(definition), () => {}) } }
  const registrar = createToolRegistrar({ ctx, sidecar: { call }, getAttachments: () => attachments })
  return { defs, registrar }
}

test('only whitelisted tools are registered; the account field is advertised', () => {
  const { defs, registrar } = harness(async () => [])
  const schema = { type: 'object', properties: { talker: { type: 'string' } }, required: ['talker'] }
  registrar.registerFrom([
    { name: 'read_history', description: 'read', inputSchema: schema },
    { name: 'list_accounts', description: 'accounts', inputSchema: { type: 'object', properties: {} } },
    { name: 'kb_search', description: 'not whitelisted', inputSchema: schema },
  ])
  assert.deepEqual(defs.map((definition) => definition.name), ['read_history', 'list_accounts'])
  assert.equal(defs[0].parameters.properties.talker.type, 'string')
  assert.equal(defs[0].parameters.properties.account.type, 'string')
  assert.deepEqual(defs[0].parameters.required, ['talker'])
  // list_accounts takes no account: it is how the model discovers them.
  assert.equal(defs[1].parameters.properties.account, undefined)
})

test('text and image blocks become DSH content', async () => {
  const saved = []
  const attachments = {
    saveImage: async (input) => {
      saved.push(input)
      return { attachmentId: 'a1', mediaType: input.mediaType, bytes: 3, width: 1, height: 1 }
    },
  }
  const { defs, registrar } = harness(
    async () => [
      { type: 'image', data: Buffer.from('png').toString('base64'), mimeType: 'image/png' },
      { type: 'text', text: 'meta' },
    ],
    attachments,
  )
  registrar.registerFrom([{ name: 'read_image', description: 'img', inputSchema: { type: 'object', properties: {} } }])
  const value = await defs[0].execute({}, { signal: new AbortController().signal })
  assert.equal(value[0].type, 'image')
  assert.equal(value[0].attachment.attachmentId, 'a1')
  assert.deepEqual(value[1], { type: 'text', text: 'meta' })
  assert.equal(saved[0].mediaType, 'image/png')
})

test('empty sidecar content is not presented as a successful blank', async () => {
  const { defs, registrar } = harness(async () => [])
  registrar.registerFrom([{ name: 'list_sessions', description: 'x', inputSchema: { type: 'object', properties: {} } }])
  const value = await defs[0].execute({}, { signal: new AbortController().signal })
  assert.match(value[0].text, /没有返回内容/)
})