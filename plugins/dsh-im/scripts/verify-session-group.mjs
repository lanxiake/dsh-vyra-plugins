// The shared IM directory must become a sidebar group, and must stay one.
//
// Runs against a fake workspace port: no Host, no filesystem beyond a temp dir.

import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { installSessionGroup } from '../plugin-src/host/session-group.mjs';

function fakePort(existing = []) {
  const calls = [];
  return {
    calls,
    port: {
      async list() {
        calls.push({ op: 'list' });
        return existing;
      },
      async create(path) {
        calls.push({ op: 'create', path });
        return { workspaceId: 'w-new', path, title: null };
      },
    },
  };
}

const quiet = { warn() {} };
const home = await mkdtemp(join(tmpdir(), 'dsh-im-group-'));
const groupPath = join(home, 'im');

// 1. A first run creates the group and titles it.
const first = fakePort();
const renamed = [];
const created = await installSessionGroup(first.port, {
  dshHome: home,
  title: 'DSH-IM',
  logger: quiet,
  rename: async (workspaceId, title) => { renamed.push({ workspaceId, title }); },
});
assert.deepEqual(created, { registered: true, path: groupPath, reused: false });
assert.deepEqual(first.calls.map((call) => call.op), ['list', 'create']);
assert.deepEqual(renamed, [{ workspaceId: 'w-new', title: 'DSH-IM' }]);

// 2. A second Host adopts the existing group and keeps the user's title.
const second = fakePort([{ workspaceId: 'w1', path: groupPath, title: '我自己改的名字' }]);
const renamedAgain = [];
const adopted = await installSessionGroup(second.port, {
  dshHome: home,
  title: 'DSH-IM',
  logger: quiet,
  rename: async (id, title) => { renamedAgain.push(title); },
});
assert.deepEqual(adopted, { registered: true, path: groupPath, reused: true });
assert.equal(second.calls.some((call) => call.op === 'create'), false, 'must not create a duplicate');
assert.deepEqual(renamedAgain, [], 'a title the user changed must never be overwritten');

// 3. `off` registers nothing and never talks to the Host.
const off = fakePort();
assert.deepEqual(await installSessionGroup(off.port, { dshHome: home, title: 'off', logger: quiet }), {
  registered: false, path: null, reused: false,
});
assert.equal(off.calls.length, 0);

// 4. One more wording of the same switch.
assert.equal((await installSessionGroup(fakePort().port, { dshHome: home, title: ' OFF ', logger: quiet })).registered, false);

// 5. A failing port is a soft failure, never an exception.
const broken = { list: async () => { throw new Error('host down'); }, create: async () => ({}) };
assert.equal((await installSessionGroup(broken, { dshHome: home, title: 'DSH-IM', logger: quiet })).registered, false);

// 6. A Host without the port keeps working, unregistered.
assert.equal((await installSessionGroup({}, { dshHome: home, title: 'DSH-IM', logger: quiet })).registered, false);

// 7. A custom title is used verbatim, trimmed.
const custom = fakePort();
const customRenamed = [];
await installSessionGroup(custom.port, {
  dshHome: home,
  title: ' 工作 IM ',
  logger: quiet,
  rename: async (id, title) => { customRenamed.push(title); },
});
assert.deepEqual(customRenamed, ['工作 IM']);

console.log('verify-session-group: ok');
