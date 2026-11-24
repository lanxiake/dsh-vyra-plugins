// Self-check for caller-supplied idempotency keys.
//
// Run: node scripts/verify-idempotency.mjs
// Proves duplicate sends collapse, failures release the key, and concurrent
// retries join the in-flight attempt.

import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DeliveryService } from '../plugin-src/host/delivery-service.mjs';

let textCalls = 0;
let fileCalls = 0;
let failNext = false;
let gateNext = false;
let release;
const gate = new Promise((resolve) => { release = resolve; });

const adapter = {
  channel: 'feishu',
  ownsBot: (botId) => botId === 'bot_a',
  listBots: () => ['bot_a'],
  listTargets: () => [
    { targetId: 't1', kind: 'group', route: { chatId: 'oc_1' } },
    { targetId: 't2', kind: 'group', route: { chatId: 'oc_2' } },
  ],
  listSuggestions: () => [],
  createTarget: () => ({}),
  updateTarget: () => ({}),
  deleteTarget: () => ({ deleted: true }),
  async sendText() {
    if (failNext) {
      failNext = false;
      const error = new Error('provider down');
      error.code = 'delivery-failed';
      throw error;
    }
    textCalls += 1;
    if (gateNext) {
      gateNext = false;
      await gate;
    }
    return { sent: true };
  },
  async sendFile() {
    fileCalls += 1;
    return { sent: true };
  },
};

const dir = await mkdtemp(join(tmpdir(), 'dsh-im-idem-'));
const file = join(dir, 'note.txt');
await writeFile(file, 'idempotent');

try {
  const service = new DeliveryService();
  service.registerAdapter(adapter);

  const first = await service.send('bot_a', 't1', 'hello', { idempotencyKey: 'evt-1' });
  assert.deepEqual(first, { sent: true });
  const second = await service.send('bot_a', 't1', 'hello', { idempotencyKey: 'evt-1' });
  assert.equal(second.duplicate, true);
  assert.equal(textCalls, 1, 'duplicate key must not call the provider twice');

  await service.send('bot_a', 't2', 'hello', { idempotencyKey: 'evt-1' });
  assert.equal(textCalls, 2, 'the same key is scoped per target');

  gateNext = true;
  const pending = [
    service.send('bot_a', 't1', 'parallel', { idempotencyKey: 'evt-2' }),
    service.send('bot_a', 't1', 'parallel', { idempotencyKey: 'evt-2' }),
  ];
  await new Promise((resolve) => setImmediate(resolve));
  release();
  const concurrent = await Promise.all(pending);
  assert.equal(textCalls, 3, 'one provider call for two concurrent retries');
  assert.equal(concurrent.filter((result) => result.duplicate === true).length, 1);

  failNext = true;
  await assert.rejects(
    () => service.send('bot_a', 't1', 'retry-me', { idempotencyKey: 'evt-3' }),
    (error) => error.code === 'delivery-failed',
  );
  const retried = await service.send('bot_a', 't1', 'retry-me', { idempotencyKey: 'evt-3' });
  assert.deepEqual(retried, { sent: true }, 'a failed attempt must release its key');

  await service.sendFile('bot_a', 't1', { path: file }, { idempotencyKey: 'file-1' });
  const fileDuplicate = await service.sendFile('bot_a', 't1', { path: file }, { idempotencyKey: 'file-1' });
  assert.equal(fileDuplicate.duplicate, true);
  assert.equal(fileCalls, 1, 'file delivery must dedupe too');

  await assert.rejects(
    () => service.send('bot_a', 't1', 'x', { idempotencyKey: 'bad key' }),
    (error) => error.code === 'bad-request',
  );

  console.log('verify-idempotency: ok');
} finally {
  await rm(dir, { recursive: true, force: true });
}
