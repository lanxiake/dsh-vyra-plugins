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
  accountNameOf({ alias: ' 工作号 ', botName: 'zxsc-dsh', channel: 'weixin' }),
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
      accountName: '工作微信',
      accountNameSource: 'botName',
      channel: 'weixin',
      botId: 'wx_919f259577ca904002bbb196',
      connected: null,
      state: 'unknown',
    },
  ],
  warnings: [],
});

const listed = await api.targets({ account: '工作微信' });
assert.equal(listed.botId, 'wx_919f259577ca904002bbb196');
assert.equal(listed.channel, 'weixin');
assert.deepEqual(listed.targets, [
  { targetId: 'o9cq801LCaXHkMjBa_NBR82KYDPY@im.wechat', targetName: '工作微信', kind: 'user' },
  { targetId: 'oc_group_release_1', targetName: '发布告警群', kind: 'group' },
]);
assert.equal(listed.warnings.length, 1, 'the fixture reproduces the live name collision');
assert.match(listed.warnings[0], /目标名与账号名相同/u);

assert.equal(
  (await api.targets({ account: '工作微信', withRoutes: true })).targets[0].route.toUserId,
  'o9cq801LCaXHkMjBa_NBR82KYDPY@im.wechat',
);

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
const missing = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
const empty = createAgentApi({ dshHome: '/nowhere', readFile: async () => { throw missing; } });
assert.deepEqual(await empty.accounts(), { accounts: [], warnings: [] });
assert.equal(
  await empty.targets({ account: '工作微信' }).then(() => 'resolved', (error) => error.code),
  'unknown-account',
  'an empty projection must not invent an account',
);

// Accounts come from config.json bots[]; workspaces.json alone has no bot list.
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
assert.deepEqual((await noTargets.targets({ account: '工作微信' })).targets, []);
console.log('verify-agent-api: ok');
