// Offline CLI verification: channel registry, account/target resolution,
// the projection over real-shaped config files, and command dispatch.
// Needs no Host, no network and no credentials.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CHANNELS, channelDataDir, channelLabel } from '../plugin-src/host/channel-registry.mjs';

// --- Task 2: channel registry -------------------------------------------------

assert.equal(CHANNELS.length, 13);
assert.equal(CHANNELS.includes('office'), false, 'office has no bots or delivery targets');
assert.equal(CHANNELS.includes('wecom-app'), true);
assert.equal(channelLabel('weixin'), '微信');
assert.equal(channelLabel('wecom-app'), '企业微信应用');
assert.equal(channelLabel('matrix'), 'Matrix');
assert.equal(channelDataDir('wecom-app'), 'dsh-wecom-app');
assert.equal(channelDataDir('feishu'), 'dsh-feishu');
assert.throws(() => channelLabel('nope'), (error) => error instanceof TypeError);
assert.throws(() => channelDataDir('nope'), (error) => error instanceof TypeError);
console.log('verify-channel-registry: ok');

// --- Task 3: account and target resolution -----------------------------------

const {
  accountNameOf, accountWarnings, publicTarget, resolveAccount, resolveTarget, targetWarnings,
} = await import('../plugin-src/host/agent-api-resolve.mjs');

assert.deepEqual(
  accountNameOf({ alias: '工作号', botName: 'zxsc-dsh', channel: 'weixin' }),
  { name: '工作号', source: 'alias' },
);
assert.deepEqual(
  accountNameOf({ alias: '', botName: 'zxsc-dsh', channel: 'feishu' }),
  { name: 'zxsc-dsh', source: 'botName' },
);
assert.deepEqual(
  accountNameOf({ alias: '  ', botName: '', channel: 'weixin' }),
  { name: '微信', source: 'channel' },
);

const accounts = [
  { accountName: '我的微信', accountNameSource: 'alias', channel: 'weixin', botId: 'wx_a', connected: null, state: 'unknown' },
  { accountName: '我的微信', accountNameSource: 'channel', channel: 'feishu', botId: 'fs_b', connected: null, state: 'unknown' },
  { accountName: 'bot_c', accountNameSource: 'botName', channel: 'qq', botId: 'bot_c', connected: null, state: 'unknown' },
];

assert.equal(resolveAccount(accounts, 'fs_b').botId, 'fs_b', 'botId is accepted');
assert.equal(resolveAccount(accounts, 'bot_c').botId, 'bot_c', 'an unambiguous name wins');
assert.throws(() => resolveAccount(accounts, 'nope'), (error) => error.code === 'unknown-account');
assert.throws(() => resolveAccount(accounts, '我的微信'), (error) => (
  error.code === 'ambiguous-account'
  && error.candidates.map((entry) => entry.botId).join(',') === 'wx_a,fs_b'
), 'a duplicated name must refuse, never pick one');

const targets = [
  { targetId: 'o9cq801...@im.wechat', targetName: '我的微信', kind: 'user' },
  { targetId: 'oc_group_1', targetName: '发布群', kind: 'group' },
];
assert.equal(resolveTarget(targets, 'oc_group_1').targetId, 'oc_group_1', 'id wins');
assert.equal(resolveTarget(targets, '发布群').targetId, 'oc_group_1', 'names must resolve');
assert.throws(() => resolveTarget(targets, 'nope'), (error) => error.code === 'unknown-target');

const duplicateTargets = [
  { targetId: 't1', targetName: '告警群', kind: 'group' },
  { targetId: 't2', targetName: '告警群', kind: 'group' },
];
assert.throws(() => resolveTarget(duplicateTargets, '告警群'), (error) => (
  error.code === 'ambiguous-target'
  && error.candidates.map((entry) => entry.targetId).join(',') === 't1,t2'
));

assert.deepEqual(
  publicTarget({ targetId: 't1', name: '发布群', kind: 'group', route: { chatId: 'oc_secret' } }),
  { targetId: 't1', targetName: '发布群', kind: 'group' },
  'routes stay hidden by default',
);
assert.deepEqual(
  publicTarget({ targetId: 't1', name: '发布群', kind: 'group', route: { chatId: 'oc_secret' } }, { withRoutes: true }),
  { targetId: 't1', targetName: '发布群', kind: 'group', route: { chatId: 'oc_secret' } },
);

const collisions = targetWarnings({ accountName: '我的微信' }, targets);
assert.equal(collisions.length, 1, 'target named like its account must be reported');
assert.match(collisions[0], /目标名与账号名相同/u);
assert.equal(targetWarnings({ accountName: '别的号' }, targets).length, 0);
assert.match(accountWarnings(accounts)[0], /账号名重复/u);
console.log('verify-account-resolve: ok');

// --- Task 4: offline projection ----------------------------------------------

const { createAgentApi } = await import('../plugin-src/host/agent-api.mjs');

const fixtureRoot = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures', 'agent-cli');

/** Resolve `<anywhere>/integrations/<dir>/<file>` against the fixture tree. */
async function fixtureReadFile(path) {
  const marker = path.replace(/\\/gu, '/').split('/integrations/')[1];
  if (!marker) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
  try {
    return readFileSync(join(fixtureRoot, marker), 'utf8');
  } catch {
    throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
  }
}

const missing = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
const api = createAgentApi({ dshHome: '/unused', readFile: fixtureReadFile });

assert.deepEqual(await api.accounts(), {
  accounts: [
    {
      accountName: 'zxsc-dsh',
      accountNameSource: 'botName',
      channel: 'feishu',
      botId: 'bot_2e012edcbb6b4e06ba4458bade69b179',
      connected: null,
      state: 'unknown',
    },
    {
      // Weixin stores accounts under `accounts[]` with a `botId` field and
      // records no name (QR login returns none), so the label is the fallback.
      accountName: '微信',
      accountNameSource: 'channel',
      channel: 'weixin',
      botId: 'wx_919f259577ca904002bbb196',
      connected: null,
      state: 'unknown',
    },
  ],
  warnings: [],
});

const listed = await api.targets({ account: '微信' });
assert.equal(listed.botId, 'wx_919f259577ca904002bbb196');
assert.equal(listed.channel, 'weixin');
assert.deepEqual(listed.targets, [
  { targetId: 'o9cq801LCaXHkMjBa_NBR82KYDPY@im.wechat', targetName: '工作微信', kind: 'user' },
  { targetId: 'oc_group_release_1', targetName: '发布告警群', kind: 'group' },
]);
assert.equal(listed.warnings.length, 0, 'the account label differs from every target name here');

assert.equal(
  (await api.targets({ account: '微信', withRoutes: true })).targets[0].route.toUserId,
  'o9cq801LCaXHkMjBa_NBR82KYDPY@im.wechat',
);

// The collision case still has to fire when an alias is what collides.
const colliding = createAgentApi({
  dshHome: '/unused',
  readFile: async (path) => {
    if (path.replace(/\\/gu, '/').includes('dsh-weixin/workspaces.json')) {
      return JSON.stringify({
        version: 2,
        workspaces: {},
        aliases: { wx_919f259577ca904002bbb196: '工作微信' },
        deliveryTargets: {
          wx_919f259577ca904002bbb196: {
            'o9cq801LCaXHkMjBa_NBR82KYDPY@im.wechat': { name: '工作微信', kind: 'user' },
          },
        },
      });
    }
    return fixtureReadFile(path);
  },
});
const collidingView = await colliding.targets({ account: '工作微信' });
assert.equal(collidingView.warnings.length, 1, 'target named like its account must warn');
assert.match(collidingView.warnings[0], /目标名与账号名相同/u);

// An alias overrides the stored bot name and is read from workspaces.json.
const aliased = createAgentApi({
  dshHome: '/unused',
  readFile: async (path) => {
    if (path.replace(/\\/gu, '/').includes('dsh-weixin/workspaces.json')) {
      return JSON.stringify({
        version: 2,
        workspaces: {},
        aliases: { wx_919f259577ca904002bbb196: '私号' },
        deliveryTargets: {},
      });
    }
    return fixtureReadFile(path);
  },
});
assert.equal(
  (await aliased.accounts()).accounts.find((account) => account.channel === 'weixin').accountName,
  '私号',
);

// A channel with no data directory contributes nothing and never throws.
const empty = createAgentApi({ dshHome: '/nowhere', readFile: async () => { throw missing; } });
assert.deepEqual(await empty.accounts(), { accounts: [], warnings: [] });
assert.equal(
  await empty.targets({ account: '微信' }).then(() => 'resolved', (error) => error.code),
  'unknown-account',
  'an empty projection must not invent an account',
);

// Accounts come from config.json; workspaces.json alone has no bot list.
const workspacesOnly = createAgentApi({
  dshHome: '/unused',
  readFile: async (path) => (path.replace(/\\/gu, '/').endsWith('config.json')
    ? Promise.reject(missing)
    : fixtureReadFile(path)),
});
assert.deepEqual(
  (await workspacesOnly.accounts()).accounts,
  [],
  'reading only workspaces.json must not fabricate accounts',
);

// An account with no targets answers an empty list, not an error.
const noTargets = createAgentApi({
  dshHome: '/unused',
  readFile: async (path) => (path.replace(/\\/gu, '/').includes('dsh-weixin/workspaces.json')
    ? JSON.stringify({ version: 2, workspaces: {}, deliveryTargets: {} })
    : fixtureReadFile(path)),
});
assert.deepEqual((await noTargets.targets({ account: '微信' })).targets, []);
console.log('verify-agent-api: ok');

// --- Task 5: command dispatch ------------------------------------------------

const { runAgentCommand } = await import('../src/cli/agent-client.mjs');

function capture() {
  const out = [];
  const err = [];
  return { out, err, stdout: (line) => out.push(line), stderr: (line) => err.push(line) };
}

const calls = [];
const postJson = async (path, payload) => {
  calls.push({ path, payload });
  return { sent: true };
};

const listedAccounts = capture();
assert.equal(await runAgentCommand(['accounts', '--json'], { api, postJson, ...listedAccounts }), 0);
const printedAccounts = JSON.parse(listedAccounts.out.at(-1));
assert.equal(printedAccounts.accounts.length, 2);
assert.deepEqual(printedAccounts.warnings, []);
assert.equal(calls.length, 0, 'accounts must stay offline');

// --target by name reaches the HTTP route with the resolved id
const byName = capture();
assert.equal(await runAgentCommand(
  ['send', '--account', '微信', '--target', '发布告警群', '--text', 'hi', '--json'],
  { api, postJson, ...byName },
), 0);
assert.equal(calls.at(-1).path, '/api/dsh-im/delivery/messages');
assert.equal(calls.at(-1).payload.botId, 'wx_919f259577ca904002bbb196');
assert.equal(calls.at(-1).payload.targetId, 'oc_group_release_1');
assert.equal(calls.at(-1).payload.text, 'hi');

// --bot stays a working alias for --account, by name or by id
const botAlias = capture();
assert.equal(await runAgentCommand(
  ['send', '--bot', 'wx_919f259577ca904002bbb196', '--target', '工作微信', '--text', 'y', '--json'],
  { api, postJson, ...botAlias },
), 0);
assert.equal(calls.at(-1).payload.botId, 'wx_919f259577ca904002bbb196');
assert.equal(calls.at(-1).payload.targetId, 'o9cq801LCaXHkMjBa_NBR82KYDPY@im.wechat');

// an unknown account exits 1 with a machine-readable error and sends nothing
const beforeUnknown = calls.length;
const unknown = capture();
assert.equal(await runAgentCommand(
  ['send', '--account', 'nope', '--target', 'x', '--text', 'y', '--json'],
  { api, postJson, ...unknown },
), 1);
assert.equal(JSON.parse(unknown.err.at(-1)).error.code, 'unknown-account');
assert.equal(calls.length, beforeUnknown, 'a failed resolution must not send');

// an unknown target refuses too
const badTarget = capture();
assert.equal(await runAgentCommand(
  ['send', '--account', '微信', '--target', '不存在的目标', '--text', 'z', '--json'],
  { api, postJson, ...badTarget },
), 1);
assert.equal(JSON.parse(badTarget.err.at(-1)).error.code, 'unknown-target');

// offline commands never touch HTTP
const beforeOffline = calls.length;
assert.equal(await runAgentCommand(['targets', '--account', '微信', '--json'], { api, postJson, ...capture() }), 0);
assert.equal(await runAgentCommand(['bots', '--json'], { api, postJson, ...capture() }), 0, 'bots is an accounts alias');
assert.equal(calls.length, beforeOffline);

// --with-routes is forwarded to the projection, not to HTTP
const withRoutes = capture();
assert.equal(await runAgentCommand(
  ['targets', '--account', '微信', '--with-routes', '--json'],
  { api, postJson, ...withRoutes },
), 0);
assert.equal(JSON.parse(withRoutes.out.at(-1)).targets[0].route.toUserId,
  'o9cq801LCaXHkMjBa_NBR82KYDPY@im.wechat');

// login-hint is local and names where the user must act
const hint = capture();
assert.equal(await runAgentCommand(['login-hint'], { api, postJson, ...hint }), 0);
assert.match(hint.out.join('\n'), /设置/u);

// an unknown option is an error rather than a silent no-op
const badOption = capture();
assert.equal(await runAgentCommand(['accounts', '--nope', 'x'], { api, postJson, ...badOption }), 1);
assert.match(badOption.err.join('\n'), /无法识别的参数/u);
console.log('verify-agent-cli-commands: ok');
