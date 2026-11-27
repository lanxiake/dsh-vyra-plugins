// The HTTP query route must accept every op the CLI sends.
//
// This is the layer that was missing: the CLI tests asserted what the client
// built, never that the Host route accepted it, so `settings` and `target
// update` shipped while always answering bad-request. Each op below is driven
// through the real handler, not through a stub of it.

import assert from 'node:assert/strict';

import { createDeliveryQueryHandler } from '../plugin-src/host/delivery-http.mjs';

function fakeService() {
  let targets = [
    { targetId: 'oc_group_1', name: '发布告警群', kind: 'group', route: { chatId: 'oc_group_1' } },
  ];
  const calls = [];
  return {
    calls,
    get targets() { return targets; },
    async listBots() { return [{ botId: 'wx_a', channel: 'weixin' }]; },
    async listTargets(botId) { return { botId, channel: 'weixin', targets }; },
    async createTarget(botId, target) {
      calls.push({ op: 'createTarget', botId, target });
      targets = [...targets, target];
      return target;
    },
    async updateTarget(botId, targetId, replacement) {
      calls.push({ op: 'updateTarget', botId, targetId, replacement });
      targets = targets.map((entry) => (entry.targetId === targetId ? { ...entry, ...replacement } : entry));
      return targets.find((entry) => entry.targetId === targetId);
    },
    async deleteTarget(botId, targetId) {
      calls.push({ op: 'deleteTarget', botId, targetId });
      targets = targets.filter((entry) => entry.targetId !== targetId);
      return { deleted: true };
    },
  };
}

function fakeSettings() {
  const alias = new Map();
  return {
    read(botId) {
      if (botId !== 'wx_a') throw Object.assign(new Error('unknown-bot'), { code: 'unknown-bot' });
      return { alias: alias.get(botId) ?? '', workspace: '/tmp/im', agentPreset: null, model: null, busyMessageMode: 'queue' };
    },
    async write(botId, key, value) {
      if (botId !== 'wx_a') throw Object.assign(new Error('unknown-bot'), { code: 'unknown-bot' });
      if (key !== 'alias') throw Object.assign(new Error('user-only-action'), { code: 'user-only-action' });
      alias.set(botId, String(value));
      return { key, value: alias.get(botId) };
    },
  };
}

/** Drive the handler with a JSON POST and return `{ status, body }`. */
async function post(handler, payload) {
  const result = {};
  const response = {
    destroyed: false,
    writableEnded: false,
    writeHead(status) { result.status = status; },
    end(body) { result.body = JSON.parse(body); this.writableEnded = true; },
    once() {},
    off() {},
  };
  const listeners = new Map();
  const request = {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    on() {},
    off() {},
    once() {},
    async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify(payload)); },
  };
  void listeners;
  await handler(request, response);
  return result;
}

const service = fakeService();
const settings = fakeSettings();
const audits = [];
const handler = createDeliveryQueryHandler(service, {
  logger: { info: (line) => audits.push(line) },
  settings,
});

// --- reads ------------------------------------------------------------------

let result = await post(handler, { op: 'bots' });
assert.equal(result.status, 200);
assert.equal(result.body.bots.length, 1);

result = await post(handler, { op: 'targets', botId: 'wx_a' });
assert.equal(result.status, 200);
assert.equal(result.body.targets[0].name, '发布告警群');

// --- settings (C-1) ---------------------------------------------------------

result = await post(handler, { op: 'settingsGet', botId: 'wx_a' });
assert.equal(result.status, 200, 'settingsGet must be accepted');
assert.equal(result.body.workspace, '/tmp/im');

result = await post(handler, { op: 'settingsSet', botId: 'wx_a', key: 'alias', value: '工作微信' });
assert.equal(result.status, 200, 'settingsSet must be accepted');
assert.equal(result.body.value, '工作微信');

// Access policy stays user-only, with its own code rather than bad-request.
result = await post(handler, { op: 'settingsSet', botId: 'wx_a', key: 'accessPolicy', value: '{}' });
assert.equal(result.status, 500);
assert.equal(result.body.error.code, 'user-only-action');

result = await post(handler, { op: 'settingsGet', botId: 'nope' });
assert.equal(result.body.error.code, 'unknown-bot');

// --- target CRUD (C-2) ------------------------------------------------------

result = await post(handler, {
  op: 'createTarget',
  botId: 'wx_a',
  target: { targetId: 't_new', name: '新目标', kind: 'user', route: { toUserId: 'u1' } },
});
assert.equal(result.status, 200, 'createTarget must be accepted');
assert.equal(result.body.targetId, 't_new');

// A rename alone must merge kind and route from the stored target.
result = await post(handler, {
  op: 'updateTarget', botId: 'wx_a', targetId: 'oc_group_1', patch: { name: '发布群' },
});
assert.equal(result.status, 200, 'updateTarget must be accepted');
assert.equal(result.body.name, '发布群');
const sentReplacement = service.calls.find((call) => call.op === 'updateTarget').replacement;
assert.equal(sentReplacement.kind, 'group', 'kind is merged from the stored target');
assert.deepEqual(sentReplacement.route, { chatId: 'oc_group_1' }, 'route is merged from the stored target');

result = await post(handler, { op: 'updateTarget', botId: 'wx_a', targetId: 'gone', patch: { name: 'x' } });
assert.equal(result.body.error.code, 'unknown-target');

result = await post(handler, { op: 'deleteTarget', botId: 'wx_a', targetId: 't_new' });
assert.equal(result.status, 200, 'deleteTarget must be accepted');
assert.equal(result.body.deleted, true);

// --- request shape is still strict ------------------------------------------

result = await post(handler, { op: 'bots', botId: 'wx_a' });
assert.equal(result.body.error.code, 'bad-request', 'an op must not accept fields it does not define');

result = await post(handler, { op: 'nope' });
assert.equal(result.body.error.code, 'bad-request');

result = await post(handler, { op: 'updateTarget', botId: 'wx_a', targetId: 'oc_group_1', patch: { targetId: 'x' } });
assert.equal(result.body.error.code, 'bad-request', 'a target id can never be patched');

// --- audit (the security story the spec claims) -----------------------------

const writes = audits.filter((line) => line.includes('ok') || line.includes('fail'));
assert.ok(writes.length >= 4, 'every state-changing call leaves an audit line');
assert.ok(writes.every((line) => line.startsWith('[dsh-im:audit]')), 'audit lines carry a stable prefix');
assert.ok(writes.some((line) => line.includes('method=settingsSet') && line.includes('result=ok')));
assert.ok(writes.some((line) => line.includes('result=fail')), 'failures are recorded too');
assert.ok(writes.every((line) => !line.includes('工作微信')), 'audit never records a value');
assert.equal(audits.some((line) => line.includes('method=bots')), false, 'reads are not audited');

console.log('verify-delivery-http: ok');
