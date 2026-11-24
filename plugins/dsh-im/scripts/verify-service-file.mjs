// Self-check for DeliveryService.sendFile.
//
// Run: node scripts/verify-service-file.mjs
// Covers path validation, image inference and the capability gate without a
// real bot or network.

import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DeliveryService } from '../plugin-src/host/delivery-service.mjs';

const received = [];
const baseAdapter = (sendFile) => ({
  channel: 'feishu',
  ownsBot: (botId) => botId === 'bot_a',
  listBots: () => ['bot_a'],
  listTargets: () => [{ targetId: 't1', kind: 'group', route: { chatId: 'oc_x' } }],
  listSuggestions: () => [],
  createTarget: () => ({}),
  updateTarget: () => ({}),
  deleteTarget: () => ({ deleted: true }),
  sendText: async () => ({ sent: true }),
  ...(sendFile ? {
    sendFile: async (botId, target, file, options) => {
      received.push({ botId, target, file, options });
      return { sent: true };
    },
  } : {}),
});

const dir = await mkdtemp(join(tmpdir(), 'dsh-im-file-'));
const pdf = join(dir, 'report.pdf');
const png = join(dir, 'chart.png');
const empty = join(dir, 'empty.txt');
await writeFile(pdf, Buffer.from('hello'));
await writeFile(png, Buffer.from('png!'));
await writeFile(empty, Buffer.alloc(0));

try {
  const service = new DeliveryService();
  service.registerAdapter(baseAdapter(true));

  const text = await service.sendFile('bot_a', 't1', { path: pdf });
  assert.deepEqual(text, { sent: true, fileName: 'report.pdf', size: 5, asImage: false });
  assert.equal(received.at(-1).file.bytes.toString(), 'hello');
  assert.equal(received.at(-1).target.targetId, 't1');

  const image = await service.sendFile('bot_a', 't1', { path: png });
  assert.equal(image.asImage, true);
  const forced = await service.sendFile('bot_a', 't1', { path: pdf, asImage: true });
  assert.equal(forced.asImage, true);

  await assert.rejects(
    () => service.sendFile('bot_a', 'gone', { path: pdf }),
    (error) => error.code === 'unknown-target',
  );
  await assert.rejects(
    () => service.sendFile('bot_a', 't1', { path: join(dir, 'missing.txt') }),
    (error) => error.code === 'bad-request',
  );
  await assert.rejects(
    () => service.sendFile('bot_a', 't1', { path: empty }),
    (error) => error.code === 'bad-request',
  );
  await assert.rejects(
    () => service.sendFile('bot_a', 't1', { path: dir }),
    (error) => error.code === 'bad-request',
  );

  const textOnly = new DeliveryService();
  textOnly.registerAdapter(baseAdapter(false));
  await assert.rejects(
    () => textOnly.sendFile('bot_a', 't1', { path: pdf }),
    (error) => error.code === 'capability-unavailable',
  );

  console.log('verify-service-file: ok');
} finally {
  await rm(dir, { recursive: true, force: true });
}
