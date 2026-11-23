// Self-check for the CLI client against the real delivery HTTP handlers.
//
// Run: node scripts/verify-cli.mjs
// No Host or bot is needed: the plugin's own handlers run on a throwaway local
// server with a fake DeliveryService.

import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import {
  DeliveryCliError,
  queryDelivery,
  resolveBaseUrl,
  sendFile,
  sendMessage,
} from '../src/cli/delivery-client.mjs';
import {
  DELIVERY_FILE_HTTP_PATH,
  DELIVERY_HTTP_PATH,
  DELIVERY_QUERY_HTTP_PATH,
  createDeliveryFileHandler,
  createDeliveryHttpHandler,
  createDeliveryQueryHandler,
} from '../plugin-src/host/delivery-http.mjs';

const sent = [];
const service = {
  async send(botId, targetId, text, options) {
    if (targetId !== 't1') {
      const error = new Error('unknown-target');
      error.code = 'unknown-target';
      throw error;
    }
    sent.push({ botId, targetId, text, options });
    return { sent: true };
  },
  async sendFile(botId, targetId, file, options) {
    if (file.path.endsWith('unsupported.bin')) {
      const error = new Error('capability-unavailable');
      error.code = 'capability-unavailable';
      throw error;
    }
    sent.push({ kind: 'file', botId, targetId, file, options });
    return { sent: true, fileName: 'a.txt', size: 5, asImage: file.asImage === true };
  },
  async listBots() {
    return [{ botId: 'bot_a', channel: 'feishu' }];
  },
  async listTargets(botId) {
    if (botId !== 'bot_a') {
      const error = new Error('unknown-bot');
      error.code = 'unknown-bot';
      throw error;
    }
    return {
      botId,
      channel: 'feishu',
      targets: [{
        targetId: 't1',
        name: '发布告警群',
        kind: 'group',
        route: { chatId: 'oc_secret' },
        sessionSync: { enabled: false, state: 'off' },
      }],
    };
  },
  async listSuggestions() { return { suggestions: [] }; },
  async createTarget() { return {}; },
  async updateTarget() { return {}; },
  async deleteTarget() { return { deleted: true }; },
};

const routes = {
  [DELIVERY_HTTP_PATH]: createDeliveryHttpHandler(service),
  [DELIVERY_QUERY_HTTP_PATH]: createDeliveryQueryHandler(service),
  [DELIVERY_FILE_HTTP_PATH]: createDeliveryFileHandler(service),
};
const server = createServer((request, response) => {
  const handler = routes[request.url];
  if (!handler) {
    response.statusCode = 404;
    response.end('{}');
    return;
  }
  handler(request, response);
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;

try {
  assert.deepEqual(await sendMessage(baseUrl, { botId: 'bot_a', targetId: 't1', text: 'hi' }), { sent: true });
  assert.equal(sent.at(-1).options.format, undefined);
  assert.deepEqual(await sendMessage(baseUrl, {
    botId: 'bot_a', targetId: 't1', text: '# hi', format: 'markdown',
  }), { sent: true });
  assert.equal(sent.at(-1).options.format, 'markdown');

  await sendMessage(baseUrl, {
    botId: 'bot_a', targetId: 't1', text: 'once', idempotencyKey: 'evt-1',
  });
  assert.equal(sent.at(-1).options.idempotencyKey, 'evt-1');
  const badKey = await fetch(`${baseUrl}${DELIVERY_HTTP_PATH}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ botId: 'bot_a', targetId: 't1', text: 'x', idempotencyKey: 'bad key' }),
  });
  assert.equal(badKey.status, 400);

  await assert.rejects(
    () => sendMessage(baseUrl, { botId: 'bot_a', targetId: 'gone', text: 'x' }),
    (error) => error instanceof DeliveryCliError && error.code === 'unknown-target' && error.status === 404,
  );

  assert.deepEqual(await sendFile(baseUrl, {
    botId: 'bot_a', targetId: 't1', path: '/tmp/report.pdf',
  }), { sent: true, fileName: 'a.txt', size: 5, asImage: false });
  assert.equal(sent.at(-1).file.path, '/tmp/report.pdf');
  await sendFile(baseUrl, { botId: 'bot_a', targetId: 't1', path: '/tmp/pic.png', asImage: true });
  assert.equal(sent.at(-1).file.asImage, true);
  await sendFile(baseUrl, {
    botId: 'bot_a', targetId: 't1', path: '/tmp/a.txt', idempotencyKey: 'file-1',
  });
  assert.equal(sent.at(-1).options.idempotencyKey, 'file-1');
  await assert.rejects(
    () => sendFile(baseUrl, { botId: 'bot_a', targetId: 't1', path: '/tmp/unsupported.bin' }),
    (error) => error instanceof DeliveryCliError && error.code === 'capability-unavailable' && error.status === 501,
  );
  const extraFileField = await fetch(`${baseUrl}${DELIVERY_FILE_HTTP_PATH}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ botId: 'bot_a', targetId: 't1', path: '/tmp/a.txt', extra: 1 }),
  });
  assert.equal(extraFileField.status, 400);

  assert.deepEqual(await queryDelivery(baseUrl, { op: 'bots' }), {
    bots: [{ botId: 'bot_a', channel: 'feishu' }],
  });
  const listed = await queryDelivery(baseUrl, { op: 'targets', botId: 'bot_a' });
  assert.deepEqual(listed, {
    botId: 'bot_a',
    channel: 'feishu',
    targets: [{ targetId: 't1', name: '发布告警群', kind: 'group' }],
  });
  assert.equal(JSON.stringify(listed).includes('oc_secret'), false, 'platform route must not leak');
  await assert.rejects(
    () => queryDelivery(baseUrl, { op: 'targets', botId: 'bot_missing' }),
    (error) => error instanceof DeliveryCliError && error.code === 'unknown-bot' && error.status === 404,
  );

  const plain = await fetch(`${baseUrl}${DELIVERY_QUERY_HTTP_PATH}`, {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: '{}',
  });
  assert.equal(plain.status, 415);
  const wrongMethod = await fetch(`${baseUrl}${DELIVERY_QUERY_HTTP_PATH}`);
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.get('allow'), 'POST');
  const extraField = await fetch(`${baseUrl}${DELIVERY_QUERY_HTTP_PATH}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ op: 'bots', extra: true }),
  });
  assert.equal(extraField.status, 400);

  assert.equal(await resolveBaseUrl('127.0.0.1:9000/'), 'http://127.0.0.1:9000');
  assert.equal(await resolveBaseUrl(undefined, {
    dshHome: '/unused',
    readFile: async () => JSON.stringify({ url: 'http://127.0.0.1:9123/' }),
  }), 'http://127.0.0.1:9123');
  assert.equal(await resolveBaseUrl(undefined, {
    dshHome: '/unused',
    readFile: async () => { throw Object.assign(new Error('missing'), { code: 'ENOENT' }); },
  }), 'http://127.0.0.1:3080');
} finally {
  server.close();
}

console.log('verify-cli: ok');
