# DSH-IM Agent CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give DSH-IM an offline-readable CLI plus three skills so an Agent can find accounts and targets and send or configure through the existing Host, and register the default IM directory as the `DSH-IM` sidebar group.

**Architecture:** `plugin-src/host/agent-api.mjs` is an **offline read-only projection**: it reads `integrations/dsh-<channel>/config.json` (which bots exist and their `botName`) and `workspaces.json` (aliases, targets), never opens a connection and never reads credentials. Every write goes over the existing HTTP delivery route, so `BotWorkspaceStore`'s write queue and validation stay single-sourced. A new `session-group.mjs` registers `~/.dsh/im` through `harness.rpc('workspace.*')` and never releases it.

**Tech Stack:** Node 22.19+ ESM, Cordis plugin context, assertion scripts under `scripts/verify-*.mjs`, esbuild bundles via `pnpm build`.

**Spec:** `docs/superpowers/specs/2026-11-27-dsh-im-agent-cli-design.md`

## Global Constraints

- Package name stays `@lanxiake/dsh-im`; version becomes exactly `6.0.0`.
- HTTP delivery routes (`/api/dsh-im/delivery/{messages,files,query}`), `delivery-http.mjs` and the curl docs stay untouched. **Writes go through HTTP, never through the CLI process.**
- `agent-api.mjs` must not construct a Controller, read a credential, or open a socket. It only reads files.
- `ctx.dshIm` `contractVersion` becomes `2`; every v1 key keeps working unchanged (`vyra-xianyu-delivery` consumes it).
- Agent-reachable surface must NOT include: `accessPolicy` writes, credential binding, QR login, bot deletion. Those answer `{ ok: false, error: { code: 'user-only-action' } }`.
- `--account` order: exact `accountName`, then exact `botId`. No match → `unknown-account`; several → `ambiguous-account` with `candidates`.
- `--bot` is a deprecated alias of `--account` and must keep working.
- `--target` order: exact `targetId`, then exact `targetName`. No match → `unknown-target`; several → `ambiguous-target` with `candidates`. **`target create` does not resolve `--target`.**
- `accountName` order: `workspaces.json` `aliases[botId]` → `config.json` `bots[].botName` → channel label. `accountNameSource` reports which one won: `alias | botName | channel`.
- When a target's `targetName` equals its account's `accountName`, both `accounts` and `targets` return a `warnings` entry.
- All CLI commands accept `--json`; in that mode they print exactly one JSON document on stdout.
- Offline commands: `accounts`, `targets`, `login-hint`, `endpoint`. Host-required: `send`, `send-file`, `target *`, `settings *` — they report `unreachable` with the hint `发送与修改配置需要 DSH 正在运行`.
- Every write logs `[dsh-im:audit] actor=agent method=<m> bot=<botId> target=<targetId> result=ok|fail`; message bodies are never logged.
- Session group title default is exactly `DSH-IM`; `sessionGroup: off` disables it. The group is **never** released on unload.
- Comments in English, user-facing strings in Chinese, matching the surrounding files.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `plugin-src/host/channel-registry.mjs` (new) | Channel ids, labels, and `dsh-<channel>` data-dir names. |
| `plugin-src/host/agent-api.mjs` (new) | Offline projection: read `config.json` + `workspaces.json`, return accounts and targets. |
| `plugin-src/host/agent-api-resolve.mjs` (new) | Pure `--account` / `--target` resolution and public projections. |
| `src/cli/agent-client.mjs` (new) | argv → offline api or HTTP call; output formatting. |
| `bin/dsh-im.mjs` (modify) | Command tree. |
| `plugin-src/host/session-group.mjs` (new) | Register `~/.dsh/im` as a Harness workspace over `harness.rpc`. |
| `plugin-src/host/skills.mjs` (modify) | Mount every skill under `skills/`. |
| `plugin-src/host/index.mjs` (modify) | Start `session-group`; extend `ctx.dshIm`. |
| `skills/dsh-im-accounts/SKILL.md` (new) | Lookup chain, name ambiguity, rename advice. |
| `skills/dsh-im-manage/SKILL.md` (new) | CLI vs IM-command table, forbidden list. |
| `skills/dsh-im-delivery/SKILL.md` (modify) | Point at the local CLI. |
| `src/channels/shared/delivery-tools.mjs` (modify) | Correct file-capability and current-conversation wording. |
| `scripts/verify-agent-cli.mjs` (new) | Registry, resolution, offline projection, command dispatch. |
| `scripts/verify-session-group.mjs` (new) | Group registration and retention. |
| `scripts/fixtures/agent-cli/` (new) | Fixed `config.json` / `workspaces.json` samples. |
| `scripts/verify-agent-tools.mjs` (modify) | Skill mounting and wording. |
| `scripts/verify-package.mjs` (modify) | Version, `files`, `dshIm` v2, docs sync. |
| `README.md`, `README.en.md`, `docs/机器人命令.md`, `docs/preset-workspaces.md` (modify) | The four documents that currently say IM sessions stay ungrouped. |
| `docs/fork.md` (new) | Fork declaration. |
| `package.json` (modify) | Version, `files`, `scripts.verify`. |

---

## Review Focus

Ranked most-likely-to-bite first; each has a test in the task that owns the code.

1. **Target name equals account name.** The live Weixin config has account `我的微信` whose only target is also named `我的微信`. Without the warning, an Agent reads `account=我的微信, target=我的微信` and cannot tell what it is sending to.
2. **Reading only `workspaces.json`.** It has no bot list — `aliases` is keyed by `botId` but the set of bots lives in `config.json` `bots[]`. A projection built from one file returns an empty account list on a machine that has two working bots.
3. **`--target` given as a name.** Users and Agents type `--target 我的微信` far more naturally than the open-id string. Resolution must work, and a duplicate name must refuse rather than pick the first.
4. **Duplicate account names.** Two unnamed bots of one channel both fall back to the same label. A write must refuse with both bot ids named.
5. **Group registration racing a second Host.** Two Hosts register the same directory; the second must adopt the existing workspace and keep the user's renamed title instead of throwing or duplicating.

---

## Task 1: Fork declaration and version bump

**Files:**
- Create: `plugins/dsh-im/docs/fork.md`
- Modify: `plugins/dsh-im/package.json` (version, `files`)
- Test: `plugins/dsh-im/scripts/verify-package.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `"version": "6.0.0"`; `scripts/verify-agent-cli.mjs`, `scripts/verify-session-group.mjs`, `scripts/fixtures/agent-cli/` and `docs/fork.md` listed in `files`.

- [ ] **Step 1: Write the failing test**

Append to `scripts/verify-package.mjs` beside the other manifest assertions:

```js
if (manifest.version !== '6.0.0') {
  throw new Error(`package version must be 6.0.0, found ${manifest.version}`);
}
for (const entry of [
  'scripts/verify-agent-cli.mjs',
  'scripts/verify-session-group.mjs',
  'docs/fork.md',
]) {
  if (!manifest.files.includes(entry)) throw new Error(`files must include ${entry}`);
}
if (!manifest.files.includes('scripts/fixtures/agent-cli/*')) {
  throw new Error('files must include the agent-cli fixtures');
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd plugins/dsh-im && node scripts/verify-package.mjs`
Expected: FAIL with `package version must be 6.0.0, found 5.13.0`.

- [ ] **Step 3: Implement**

Set the version, add the three entries plus `scripts/fixtures/agent-cli/*` to `files`, and create `docs/fork.md`. The document states, in Chinese then English, that this package no longer tracks `xmanrui/dsh-im` or upstream commits, that upstream fixes are cherry-picked by hand, and that the last synced upstream commit is `c0c8950`. Do **not** add the two verify scripts to `scripts.verify` yet — they do not exist until Task 5, and the chain would fail for the wrong reason. Task 11 adds them.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/verify-package.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add plugins/dsh-im/package.json plugins/dsh-im/docs/fork.md plugins/dsh-im/scripts/verify-package.mjs
git commit -m "feat(dsh-im): declare the fork and bump to 6.0.0"
```

---

## Task 2: Channel registry

**Files:**
- Create: `plugins/dsh-im/plugin-src/host/channel-registry.mjs`
- Test: `plugins/dsh-im/scripts/verify-agent-cli.mjs` (create with this block)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `CHANNELS: readonly string[]` — `['feishu','weixin','dingtalk','wecom','wecom-app','qq','slack','telegram','discord','whatsapp','imessage','email','matrix']` (`office` excluded).
  - `channelLabel(channel): string` — `飞书`, `微信`, `钉钉`, `企业微信`, `企业微信应用`, `QQ`, `Slack`, `Telegram`, `Discord`, `WhatsApp`, `iMessage`, `邮件`, `Matrix`.
  - `channelDataDir(channel): string` — `dsh-<channel>`; `wecom-app` → `dsh-wecom-app`.

- [ ] **Step 1: Write the failing test**

Create `scripts/verify-agent-cli.mjs`:

```js
import assert from 'node:assert/strict';
import { CHANNELS, channelDataDir, channelLabel } from '../plugin-src/host/channel-registry.mjs';

assert.equal(CHANNELS.length, 13);
assert.equal(CHANNELS.includes('office'), false);
assert.equal(CHANNELS.includes('wecom-app'), true);
assert.equal(channelLabel('weixin'), '微信');
assert.equal(channelLabel('wecom-app'), '企业微信应用');
assert.equal(channelLabel('matrix'), 'Matrix');
assert.equal(channelDataDir('wecom-app'), 'dsh-wecom-app');
assert.equal(channelDataDir('feishu'), 'dsh-feishu');
assert.throws(() => channelLabel('nope'), (error) => error instanceof TypeError);
console.log('verify-channel-registry: ok');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/verify-agent-cli.mjs`
Expected: FAIL with `Cannot find module '../plugin-src/host/channel-registry.mjs'`.

- [ ] **Step 3: Implement**

Export the three constants. Both functions throw `TypeError` naming the unknown channel rather than guessing a directory.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/verify-agent-cli.mjs`
Expected: PASS, prints `verify-channel-registry: ok`.

- [ ] **Step 5: Commit**

```bash
git add plugins/dsh-im/plugin-src/host/channel-registry.mjs plugins/dsh-im/scripts/verify-agent-cli.mjs
git commit -m "feat(dsh-im): share channel ids and labels with the CLI"
```

---

## Task 3: Account and target resolution

**Files:**
- Create: `plugins/dsh-im/plugin-src/host/agent-api-resolve.mjs`
- Test: `plugins/dsh-im/scripts/verify-agent-cli.mjs` (extend)

**Interfaces:**
- Consumes: `channelLabel` (Task 2).
- Produces:
  - `PublicAccount = { accountName, accountNameSource, channel, botId, connected, state }`
  - `PublicTarget = { targetId, targetName?, kind, route? }`
  - `accountNameOf({ alias, botName, channel }): { name: string, source: 'alias'|'botName'|'channel' }`
  - `resolveAccount(accounts: PublicAccount[], query: string): PublicAccount`
  - `resolveTarget(targets: PublicTarget[], query: string): PublicTarget`
  - `publicTarget(target, { withRoutes = false }): PublicTarget`
  - `accountWarnings(accounts): string[]` and `targetWarnings(account, targets): string[]`

- [ ] **Step 1: Write the failing test**

Append to `scripts/verify-agent-cli.mjs`:

```js
import {
  accountNameOf, accountWarnings, publicTarget, resolveAccount, resolveTarget, targetWarnings,
} from '../plugin-src/host/agent-api-resolve.mjs';

// accountName precedence, including the alias-shadows-botName case
assert.deepEqual(accountNameOf({ alias: ' 工作号 ', botName: 'zxsc-dsh', channel: 'weixin' }),
  { name: '工作号', source: 'alias' });
assert.deepEqual(accountNameOf({ alias: '', botName: 'zxsc-dsh', channel: 'feishu' }),
  { name: 'zxsc-dsh', source: 'botName' });
assert.deepEqual(accountNameOf({ alias: '  ', botName: '', channel: 'weixin' }),
  { name: '微信', source: 'channel' });

const accounts = [
  { accountName: '我的微信', accountNameSource: 'alias', channel: 'weixin', botId: 'wx_a', connected: null, state: 'unknown' },
  { accountName: '我的微信', accountNameSource: 'channel', channel: 'feishu', botId: 'fs_b', connected: null, state: 'unknown' },
  { accountName: 'bot_c', accountNameSource: 'botName', channel: 'qq', botId: 'bot_c', connected: null, state: 'unknown' },
];

assert.equal(resolveAccount(accounts, 'fs_b').botId, 'fs_b');
assert.equal(resolveAccount(accounts, 'bot_c').botId, 'bot_c');
assert.throws(() => resolveAccount(accounts, 'nope'), (e) => e.code === 'unknown-account');
assert.throws(() => resolveAccount(accounts, '我的微信'), (e) => (
  e.code === 'ambiguous-account' && e.candidates.map((c) => c.botId).join(',') === 'wx_a,fs_b'
));

const targets = [
  { targetId: 'o9cq801...@im.wechat', targetName: '我的微信', kind: 'user' },
  { targetId: 'oc_group_1', targetName: '发布群', kind: 'group' },
];

// id wins
assert.equal(resolveTarget(targets, 'oc_group_1').targetId, 'oc_group_1');
// name works — the natural thing a user or Agent types
assert.equal(resolveTarget(targets, '发布群').targetId, 'oc_group_1');
assert.throws(() => resolveTarget(targets, 'nope'), (e) => e.code === 'unknown-target');

const dupNames = [
  { targetId: 't1', targetName: '告警群', kind: 'group' },
  { targetId: 't2', targetName: '告警群', kind: 'group' },
];
assert.throws(() => resolveTarget(dupNames, '告警群'), (e) => (
  e.code === 'ambiguous-target' && e.candidates.map((c) => c.targetId).join(',') === 't1,t2'
));

// routes hidden by default
assert.deepEqual(publicTarget({ targetId: 't1', name: '发布群', kind: 'group', route: { chatId: 'oc_secret' } }),
  { targetId: 't1', targetName: '发布群', kind: 'group' });
assert.deepEqual(
  publicTarget({ targetId: 't1', name: '发布群', kind: 'group', route: { chatId: 'oc_secret' } }, { withRoutes: true }),
  { targetId: 't1', targetName: '发布群', kind: 'group', route: { chatId: 'oc_secret' } },
);

// the live-data collision: a target named exactly like its account
assert.equal(targetWarnings({ accountName: '我的微信' }, targets).length, 1);
assert.match(targetWarnings({ accountName: '我的微信' }, targets)[0], /目标名与账号名相同/);
assert.equal(targetWarnings({ accountName: '别的号' }, targets).length, 0);

// duplicate account names surface as a warning too
assert.match(accountWarnings(accounts)[0], /重名/);
console.log('verify-account-resolve: ok');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/verify-agent-cli.mjs`
Expected: FAIL with `Cannot find module '../plugin-src/host/agent-api-resolve.mjs'`.

- [ ] **Step 3: Implement**

`accountNameOf` trims each candidate and returns the first non-empty with its source tag. `resolveAccount` collects exact `accountName` matches first; exactly one wins even if a different bot's `botId` equals that string, because a user naming a bot intentionally outranks an internal id. Then it collects exact `botId` matches. Then throws. `resolveTarget` mirrors it on `targetId` then `targetName`. Both errors carry `candidates`. `targetWarnings` emits the `目标名与账号名相同（均为「X」）…` line once per colliding target; `accountWarnings` emits one `账号名重复（「X」同时对应 2 个账号），写操作请用 botId` line per duplicated name.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/verify-agent-cli.mjs`
Expected: PASS, prints both `ok` lines.

- [ ] **Step 5: Commit**

```bash
git add plugins/dsh-im/plugin-src/host/agent-api-resolve.mjs plugins/dsh-im/scripts/verify-agent-cli.mjs
git commit -m "feat(dsh-im): resolve accounts and targets by name or id"
```

---

## Task 4: Offline projection over config.json and workspaces.json

**Files:**
- Create: `plugins/dsh-im/plugin-src/host/agent-api.mjs`
- Create: `plugins/dsh-im/scripts/fixtures/agent-cli/dsh-weixin/config.json`
- Create: `plugins/dsh-im/scripts/fixtures/agent-cli/dsh-weixin/workspaces.json`
- Create: `plugins/dsh-im/scripts/fixtures/agent-cli/dsh-feishu/config.json`
- Test: `plugins/dsh-im/scripts/verify-agent-cli.mjs` (extend)

**Interfaces:**
- Consumes: `CHANNELS`, `channelDataDir` (Task 2); `accountNameOf`, `accountWarnings`, `publicTarget`, `targetWarnings` (Task 3).
- Produces `createAgentApi({ dshHome, readFile })` returning:
  - `accounts(): Promise<{ accounts: PublicAccount[], warnings: string[] }>`
  - `targets({ account, withRoutes }): Promise<{ accountName, channel, botId, targets: PublicTarget[], warnings: string[] }>`

  `readFile` defaults to `node:fs/promises` `readFile` and exists so tests can inject fixture paths without touching the real profile.

- [ ] **Step 1: Write the failing test**

Create the fixtures first. `scripts/fixtures/agent-cli/dsh-weixin/config.json`:

```json
{
  "version": 2,
  "bots": [{ "id": "wx_919f259577ca904002bbb196", "botName": "工作微信" }]
}
```

`scripts/fixtures/agent-cli/dsh-weixin/workspaces.json`:

```json
{
  "version": 2,
  "workspaces": { "wx_919f259577ca904002bbb196": "/home/u/.dsh/im" },
  "deliveryTargets": {
    "wx_919f259577ca904002bbb196": {
      "o9cq801LCaXHkMjBa_NBR82KYDPY@im.wechat": {
        "name": "工作微信",
        "kind": "user",
        "route": { "toUserId": "o9cq801LCaXHkMjBa_NBR82KYDPY@im.wechat" }
      }
    }
  }
}
```

`scripts/fixtures/agent-cli/dsh-feishu/config.json`:

```json
{
  "version": 2,
  "bots": [{ "id": "bot_2e012edcbb6b4e06ba4458bade69b179", "botName": "zxsc-dsh" }]
}
```

`scripts/verify-agent-cli.mjs` gets a `readFile` stub that maps a requested path to a fixture and rejects with `ENOENT` otherwise:

```js
import { createAgentApi } from '../plugin-src/host/agent-api.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const fixtures = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures', 'agent-cli');
const stubReadFile = async (path) => {
  const marker = path.replace(/\\/gu, '/').split('/integrations/')[1];
  if (!marker) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
  try {
    return readFileSync(join(fixtures, marker), 'utf8');
  } catch {
    throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
  }
};

const api = createAgentApi({ dshHome: '/does/not/matter', readFile: stubReadFile });

const listed = await api.accounts();
assert.deepEqual(listed.accounts.map((a) => [a.channel, a.botId, a.accountName, a.accountNameSource]), [
  ['feishu', 'bot_2e012edcbb6b4e06ba4458bade69b179', 'zxsc-dsh', 'botName'],
  ['weixin', 'wx_919f259577ca904002bbb196', '工作微信', 'botName'],
]);
assert.deepEqual(listed.warnings, []);

const targets = await api.targets({ account: '工作微信' });
assert.equal(targets.botId, 'wx_919f259577ca904002bbb196');
assert.deepEqual(targets.targets, [
  { targetId: 'o9cq801LCaXHkMjBa_NBR82KYDPY@im.wechat', targetName: '工作微信', kind: 'user' },
]);
// the fixture reproduces the live collision: target name == account name
assert.equal(targets.warnings.length, 1);

// routes only on request
assert.equal((await api.targets({ account: '工作微信', withRoutes: true })).targets[0].route.toUserId,
  'o9cq801LCaXHkMjBa_NBR82KYDPY@im.wechat');

// alias beats botName, and is read from workspaces.json
const aliased = createAgentApi({
  dshHome: '/does/not/matter',
  readFile: async (path) => {
    if (path.includes('dsh-weixin') && path.endsWith('workspaces.json')) {
      return JSON.stringify({ version: 2, workspaces: {}, aliases: { wx_919f259577ca904002bbb196: '私号' }, deliveryTargets: {} });
    }
    return stubReadFile(path);
  },
});
assert.equal((await aliased.accounts()).accounts.find((a) => a.channel === 'weixin').accountName, '私号');

// a channel with no data directory contributes nothing and never throws
const empty = createAgentApi({ dshHome: '/x', readFile: async () => { throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' }); } });
assert.deepEqual(await empty.accounts(), { accounts: [], warnings: [] });

// reading ONLY workspaces.json would find no bots — the guard against that regression
assert.equal((await empty.targets({ account: '工作微信' }).then(() => 'resolved', (e) => e.code)),
  'unknown-account');
console.log('verify-agent-api: ok');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/verify-agent-cli.mjs`
Expected: FAIL with `Cannot find module '../plugin-src/host/agent-api.mjs'`.

- [ ] **Step 3: Implement `plugins/dsh-im/plugin-src/host/agent-api.mjs`**

For each channel in `CHANNELS`, build `<dshHome>/integrations/<channelDataDir(channel)>`. Read `config.json`; a parse failure or `ENOENT` skips the channel with no warning surfaced to the caller (a channel the user never configured is normal). Read `workspaces.json` too; when absent treat it as `{ workspaces: {}, deliveryTargets: {}, aliases: {} }`.

For every entry of `config.json` `bots[]`, take `bot.id` as `botId` and `bot.botName` as `botName`, then build the account through `accountNameOf({ alias: aliases[botId], botName, channel })`. `connected` is `null` and `state` is `'unknown'` — this projection never talks to a platform. Sort accounts by `channel` then `botId` so output is stable.

`targets` resolves the account with `resolveAccount`, reads `workspaces.deliveryTargets[botId]`, and maps each `[targetId, stored]` entry through `publicTarget({ targetId, ...stored }, { withRoutes })`. An account with no targets returns `targets: []` and exit code 0 — never an error.

Return `warnings` from `accountWarnings` for `accounts` and `targetWarnings` for `targets`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/verify-agent-cli.mjs`
Expected: PASS, prints `verify-agent-api: ok`.

- [ ] **Step 5: Commit**

```bash
git add plugins/dsh-im/plugin-src/host/agent-api.mjs plugins/dsh-im/scripts/fixtures plugins/dsh-im/scripts/verify-agent-cli.mjs
git commit -m "feat(dsh-im): read accounts and targets offline from the channel config files"
```

---

## Task 5: CLI command tree

**Files:**
- Create: `plugins/dsh-im/src/cli/agent-client.mjs`
- Modify: `plugins/dsh-im/bin/dsh-im.mjs` (usage block, dispatch, `ERROR_HINTS`)
- Test: `plugins/dsh-im/scripts/verify-agent-cli.mjs` (extend)

**Interfaces:**
- Consumes: `createAgentApi` (Task 4).
- Produces `runAgentCommand(argv: string[], { api, postJson, stdout, stderr }): Promise<number>`; `postJson` is the existing HTTP helper injected so tests need no server.

- [ ] **Step 1: Write the failing test**

Append to `scripts/verify-agent-cli.mjs`:

```js
import { runAgentCommand } from '../src/cli/agent-client.mjs';

function capture() {
  const out = [];
  const err = [];
  return { out, err, stdout: (line) => out.push(line), stderr: (line) => err.push(line) };
}
const calls = [];
const postJson = async (path, payload) => { calls.push({ path, payload }); return { sent: true }; };

const sink = capture();
assert.equal(await runAgentCommand(['accounts', '--json'], { api, postJson, ...sink }), 0);
const printed = JSON.parse(sink.out.at(-1));
assert.equal(printed.accounts.length, 2);
assert.equal('warnings' in printed, true);

// --target by name reaches the HTTP route with the resolved id
const byName = capture();
assert.equal(await runAgentCommand(
  ['send', '--account', '工作微信', '--target', '工作微信', '--text', 'hi', '--json'],
  { api, postJson, ...byName },
), 0);
assert.equal(calls.at(-1).path, '/api/dsh-im/delivery/messages');
assert.equal(calls.at(-1).payload.targetId, 'o9cq801LCaXHkMjBa_NBR82KYDPY@im.wechat');
assert.equal(calls.at(-1).payload.botId, 'wx_919f259577ca904002bbb196');

// --bot stays a working alias
const legacy = capture();
assert.equal(await runAgentCommand(
  ['send', '--bot', 'wx_919f259577ca904002bbb196', '--target', '工作微信', '--text', 'x', '--json'],
  { api, postJson, ...legacy },
), 0);

// unknown account exits 1 with a machine-readable error
const missing = capture();
assert.equal(await runAgentCommand(['send', '--account', 'nope', '--target', 'x', '--text', 'y', '--json'], { api, postJson, ...missing }), 1);
assert.equal(JSON.parse(missing.err.at(-1)).error.code, 'unknown-account');

// offline commands never touch HTTP
const before = calls.length;
assert.equal(await runAgentCommand(['targets', '--account', '工作微信', '--json'], { api, postJson, ...capture() }), 0);
assert.equal(calls.length, before);

// login-hint is local and says where to act
const hint = capture();
assert.equal(await runAgentCommand(['login-hint'], { api, postJson, ...hint }), 0);
assert.match(hint.out.join('\n'), /设置/);
console.log('verify-agent-cli-commands: ok');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/verify-agent-cli.mjs`
Expected: FAIL with `Cannot find module '../src/cli/agent-client.mjs'`.

- [ ] **Step 3: Implement**

Parse `--flag value` pairs plus bare flags. Dispatch `accounts`, `targets`, `bots` (alias of `accounts`), `send`, `send-file`, `target create|update|delete`, `settings get|set`, `login-hint`, `sessions list`. Print pretty JSON when `--json` is present, one Chinese summary line otherwise. On error print `{ error: { code, message, candidates? } }` to stderr and return `1`.

`send` and `send-file` first call `api.targets` to resolve account and target, then `postJson('/api/dsh-im/delivery/messages' | '/files', …)`. Map `ENOENT`-driven failures and `fetch` connection errors to `unreachable` with the hint from Global Constraints. `settings get` reads the offline view; `settings set` posts to the management route.

In `bin/dsh-im.mjs` route the new commands into `runAgentCommand`, keep `install`/`uninstall`/`endpoint` as they are, and add `unknown-account`, `ambiguous-account`, `unknown-target`, `ambiguous-target`, `unreachable` to `ERROR_HINTS` (`先运行 dsh-im accounts 查看账号与 botId`).

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/verify-agent-cli.mjs`
Expected: PASS, prints `verify-agent-cli-commands: ok`.

- [ ] **Step 5: Commit**

```bash
git add plugins/dsh-im/src/cli/agent-client.mjs plugins/dsh-im/bin/dsh-im.mjs plugins/dsh-im/scripts/verify-agent-cli.mjs
git commit -m "feat(dsh-im): CLI over the offline projection, writes over HTTP"
```

---

## Task 6: Session group registration (retained)

**Files:**
- Create: `plugins/dsh-im/plugin-src/host/session-group.mjs`
- Modify: `plugins/dsh-im/plugin-src/host/index.mjs`
- Test: `plugins/dsh-im/scripts/verify-session-group.mjs` (new)

**Interfaces:**
- Consumes: `harness.rpc(endpoint, payload)` — already used by `preset-workspaces.mjs` as `workspace.list`, `workspace.create`, `workspace.rename`.
- Produces `installSessionGroup(harness, { dshHome, title, logger }): Promise<{ registered: boolean, path: string|null, reused: boolean }>`.

- [ ] **Step 1: Write the failing test**

Create `scripts/verify-session-group.mjs`:

```js
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installSessionGroup } from '../plugin-src/host/session-group.mjs';

function fakeHarness(existing = []) {
  const calls = [];
  return {
    calls,
    harness: {
      async rpc(endpoint, payload) {
        calls.push({ endpoint, payload });
        if (endpoint === 'workspace.list') return { items: existing };
        if (endpoint === 'workspace.create') return { workspace: { workspaceId: 'w-new', title: null, path: payload.path } };
        if (endpoint === 'workspace.rename') return { workspace: { workspaceId: payload.workspaceId, title: payload.title } };
        throw new Error(`unexpected ${endpoint}`);
      },
    },
  };
}

const home = await mkdtemp(join(tmpdir(), 'dsh-im-group-'));

// 1. first run creates then titles the workspace
const first = fakeHarness();
const result = await installSessionGroup(first.harness, { dshHome: home, title: 'DSH-IM', logger: { warn() {} } });
assert.equal(result.registered, true);
assert.equal(result.reused, false);
assert.deepEqual(first.calls.map((c) => c.endpoint), ['workspace.list', 'workspace.create', 'workspace.rename']);
assert.equal(first.calls[2].payload.title, 'DSH-IM');
assert.equal(first.calls[1].payload.path.endsWith('im'), true);

// 2. a second Host adopts it and keeps the user's renamed title
const second = fakeHarness([{ workspaceId: 'w1', path: first.calls[1].payload.path, title: '我自己改的名字' }]);
const again = await installSessionGroup(second.harness, { dshHome: home, title: 'DSH-IM', logger: { warn() {} } });
assert.equal(again.reused, true);
assert.equal(second.calls.some((c) => c.endpoint === 'workspace.rename'), false);
assert.equal(second.calls.some((c) => c.endpoint === 'workspace.create'), false);

// 3. off registers nothing
const off = fakeHarness();
assert.equal((await installSessionGroup(off.harness, { dshHome: home, title: 'off', logger: { warn() {} } })).registered, false);
assert.equal(off.calls.length, 0);

// 4. a failing rpc is a soft failure
const broken = { rpc: async () => { throw new Error('host down'); } };
const soft = await installSessionGroup(broken, { dshHome: home, title: 'DSH-IM', logger: { warn() {} } });
assert.equal(soft.registered, false);
console.log('verify-session-group: ok');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/verify-session-group.mjs`
Expected: FAIL with `Cannot find module '../plugin-src/host/session-group.mjs'`.

- [ ] **Step 3: Implement**

`mkdir -p` the directory, return `{ registered: false, path: null, reused: false }` for an empty or `off` title. Call `harness.rpc('workspace.list', {})`, compare paths with `sameWorkspacePath` from `src/channels/shared/default-workspace.mjs`; on a match return `{ registered: true, path, reused: true }` **without renaming**. Otherwise `workspace.create({ path })` then `workspace.rename({ workspaceId, title })`. Wrap every rpc in `try/catch`: log `logger.warn` and return `registered: false`. **No disposer, no `ctx.effect` cleanup** — the spec requires the group to survive unload (§7.1).

In `plugin-src/host/index.mjs` call it inside `activateChannels` after the harness peer is available, reading `config.sessionGroup ?? 'DSH-IM'`, and never blocking channel startup on its result.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/verify-session-group.mjs`
Expected: PASS, prints `verify-session-group: ok`.

- [ ] **Step 5: Commit**

```bash
git add plugins/dsh-im/plugin-src/host/session-group.mjs plugins/dsh-im/plugin-src/host/index.mjs plugins/dsh-im/scripts/verify-session-group.mjs
git commit -m "feat(dsh-im): register the DSH-IM sidebar group and keep it"
```

---

## Task 7: Mount every skill and write the three skills

**Files:**
- Modify: `plugins/dsh-im/plugin-src/host/skills.mjs`
- Create: `plugins/dsh-im/skills/dsh-im-accounts/SKILL.md`
- Create: `plugins/dsh-im/skills/dsh-im-manage/SKILL.md`
- Modify: `plugins/dsh-im/skills/dsh-im-delivery/SKILL.md`
- Test: `plugins/dsh-im/scripts/verify-agent-tools.mjs` (extend)

**Interfaces:**
- Consumes: nothing.
- Produces: `resolveSkillsRoot(start)` unchanged; `installDeliverySkill` passes `customSkillDirs: [skillsRoot]` with every sibling skill mounted.

- [ ] **Step 1: Write the failing test**

Replace the `installDeliverySkill` assertions in `scripts/verify-agent-tools.mjs` with:

```js
const skillNames = readdirSync(skillsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
assert.deepEqual(skillNames, ['dsh-im-accounts', 'dsh-im-delivery', 'dsh-im-manage']);

for (const name of skillNames) {
  const body = readFileSync(resolve(skillsRoot, name, 'SKILL.md'), 'utf8');
  assert.match(body, new RegExp(`name: ${name}`), `${name} front matter must match its directory`);
}

const accountsSkill = readFileSync(resolve(skillsRoot, 'dsh-im-accounts', 'SKILL.md'), 'utf8');
assert.match(accountsSkill, /dsh-im accounts/);
assert.match(accountsSkill, /ambiguous-account/);
assert.match(accountsSkill, /目标名与账号名相同/, 'must cover the target/account name collision');
assert.match(accountsSkill, /改名/, 'must tell the Agent to suggest a rename');

const manageSkill = readFileSync(resolve(skillsRoot, 'dsh-im-manage', 'SKILL.md'), 'utf8');
assert.match(manageSkill, /settings set/);
assert.match(manageSkill, /\/workspace/, 'must document the IM-command route');
assert.match(manageSkill, /user-only-action/);
assert.match(manageSkill, /只影响之后新建的 Session/, 'must state when a change takes effect');
```

Add `readdirSync` and `readFileSync` to the existing `node:fs` import.

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/verify-agent-tools.mjs`
Expected: FAIL with `expected [ 'dsh-im-delivery' ] to equal [...]`.

- [ ] **Step 3: Implement**

Drop `SKILL_NAME` from `skills.mjs`; `resolveSkillsRoot` looks for any directory containing `SKILL.md`, keeping the four-level walk.

`dsh-im-accounts` covers: the `accounts` → `targets` → `send` chain, name-vs-`botId` precedence, `--target` accepting an id **or** a name, refusing on `ambiguous-account`/`ambiguous-target`, `--with-routes` only for troubleshooting, and a short section on the collision: when a target is named like its account, tell the user to distinguish it in Settings, and mention doing this **when connecting a new account**.

`dsh-im-manage` carries the two-routes table from the spec (§5.3) plus: only `settings set` keys are writable, access policy / credentials / bot deletion answer `user-only-action` and the Agent must send the user to Settings, and **a CLI change only affects Sessions created afterwards**, while `/workspace` and `/model` in a chat have "current session vs bot default" semantics the user must choose.

`dsh-im-delivery` keeps its HTTP section and gains the local-CLI commands.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/verify-agent-tools.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add plugins/dsh-im/plugin-src/host/skills.mjs plugins/dsh-im/skills plugins/dsh-im/scripts/verify-agent-tools.mjs
git commit -m "feat(dsh-im): mount every skill and document the account, manage and command routes"
```

---

## Task 8: Extend `ctx.dshIm` to contract version 2

**Files:**
- Modify: `plugins/dsh-im/plugin-src/host/index.mjs` (`ctx.provide('dshIm', …)`)
- Test: `plugins/dsh-im/scripts/verify-package.mjs` (extend)

**Interfaces:**
- Consumes: `deliveryService.updateTarget`, `deliveryService.deleteTarget` — both already exist at `plugin-src/host/delivery-adapter.mjs:544-549`.
- Produces: `ctx.dshIm.updateTarget(botId, targetId, target)`, `ctx.dshIm.deleteTarget(botId, targetId)`; `contractVersion: 2`.

- [ ] **Step 1: Write the failing test**

Extend `verify-package.mjs` where the `dshIm` stub is captured:

```js
for (const method of ['updateTarget', 'deleteTarget', 'send', 'sendFile', 'listTargets', 'listBots', 'createTarget']) {
  if (typeof deliveryApi[method] !== 'function') throw new Error(`dshIm must expose ${method}`);
}
if (deliveryApi.contractVersion !== 2) throw new Error('dshIm contractVersion must be 2');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/verify-package.mjs`
Expected: FAIL with `dshIm must expose updateTarget`.

- [ ] **Step 3: Implement**

Add the two delegating methods to the frozen object and set `contractVersion: 2`. Keep every v1 key.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/verify-package.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add plugins/dsh-im/plugin-src/host/index.mjs plugins/dsh-im/scripts/verify-package.mjs
git commit -m "feat(dsh-im): expose target update and delete on the dshIm service"
```

---

## Task 9: Correct the tool descriptions

**Files:**
- Modify: `plugins/dsh-im/src/channels/shared/delivery-tools.mjs`
- Test: `plugins/dsh-im/scripts/verify-agent-tools.mjs` (extend)

**Interfaces:**
- Consumes: nothing.
- Produces: descriptions that stop claiming Feishu-only files and tell the model to check whether the current Session already is that chat.

- [ ] **Step 1: Write the failing test**

Add to `scripts/verify-agent-tools.mjs`:

```js
assert.equal(/currently Feishu/.test(fileTool.description), false);
assert.match(fileTool.description, /Feishu, Weixin, WeCom, DingTalk and QQ/);
assert.match(sendTool.description, /current Session/i);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/verify-agent-tools.mjs`
Expected: FAIL on the `currently Feishu` assertion.

- [ ] **Step 3: Implement**

Send-file becomes `Only channels with a proactive file path can do this: Feishu, Weixin, WeCom (bot and app), DingTalk and QQ; others answer capability-unavailable.` The send description gains `Before sending, check whether the current Session already belongs to that chat — answering the conversation you are in does not need this tool.`

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/verify-agent-tools.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add plugins/dsh-im/src/channels/shared/delivery-tools.mjs plugins/dsh-im/scripts/verify-agent-tools.mjs
git commit -m "fix(dsh-im): describe file delivery and current-conversation checks correctly"
```

---

## Task 10: Sync the four documents that claim IM sessions stay ungrouped

**Files:**
- Modify: `plugins/dsh-im/README.md` (§「默认目录与未分组会话」)
- Modify: `plugins/dsh-im/README.en.md` (same section)
- Modify: `plugins/dsh-im/docs/机器人命令.md` (`/sessions` wording)
- Modify: `plugins/dsh-im/docs/preset-workspaces.md` (precedence with `sessionGroup`)
- Test: `plugins/dsh-im/scripts/verify-package.mjs` (extend)

**Interfaces:**
- Consumes: nothing.
- Produces: no document asserts that the default IM directory has no workspace group.

- [ ] **Step 1: Write the failing test**

Add to `scripts/verify-package.mjs`:

```js
for (const file of ['README.md', 'README.en.md']) {
  const body = readFileSync(resolve(root, file), 'utf8');
  if (body.includes('插件不会为该目录创建工作区分组')) throw new Error(`${file} still claims no group is created`);
  if (/does not create a workspace group/iu.test(body)) throw new Error(`${file} still claims no group is created`);
  if (!body.includes('DSH-IM')) throw new Error(`${file} must mention the DSH-IM group`);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/verify-package.mjs`
Expected: FAIL with `README.md still claims no group is created`.

- [ ] **Step 3: Implement**

Rewrite that bullet in both READMEs: the default directory `$DSH_HOME/im` is registered as the `DSH-IM` sidebar group, new conversations land there, existing conversations are **not** migrated, `sessionGroup: off` restores the old behaviour, and bots with a custom workspace are unaffected. Adjust the `/sessions` sentence in `docs/机器人命令.md` and add the `sessionGroup` vs `groupByAgentPreset` precedence paragraph to `docs/preset-workspaces.md`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/verify-package.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add plugins/dsh-im/README.md plugins/dsh-im/README.en.md plugins/dsh-im/docs plugins/dsh-im/scripts/verify-package.mjs
git commit -m "docs(dsh-im): document the DSH-IM session group"
```

---

## Task 11: Build, reinstall and verify on this machine

**Files:**
- Modify: `plugins/dsh-im/lib/index.js`, `plugins/dsh-im/lib/client.js` (build output)
- Modify: `plugins/dsh-im/package.json` (`scripts.verify`)
- Test: manual against the live Host

**Interfaces:**
- Consumes: every earlier task.
- Produces: a Host running 6.0.0 from the workspace path, and an offline-capable CLI.

- [ ] **Step 1: Build**

Run: `cd plugins/dsh-im && pnpm build`
Expected: `lib/index.js` and `lib/client.js` rewritten.

- [ ] **Step 2: Run the offline verification group**

Run: `cd plugins/dsh-im && node scripts/verify-agent-cli.mjs && node scripts/verify-session-group.mjs && node scripts/verify-agent-tools.mjs && node scripts/verify-package.mjs && node scripts/verify-cli.mjs && node scripts/verify-service-file.mjs && node scripts/verify-idempotency.mjs`
Expected: each script prints its `ok` line, exit 0, no network and no Host required. If any script insists on a running Host, that is a test-design bug — fix the script, do not skip it.

- [ ] **Step 3: Wire the new scripts into `scripts.verify`**

Add `&& node scripts/verify-agent-cli.mjs && node scripts/verify-session-group.mjs` to the chain, then run `node scripts/verify-package.mjs` again.
Expected: PASS with the scripts present.

- [ ] **Step 4: Reinstall from the workspace path**

Run: `dsh plugin --profile desktop add -w "C:/myself/projects/my/open-source/dsh-vyra-plugins/plugins/dsh-im"`
Expected: `~/.dsh/profile*/node_modules/@lanxiake/dsh-im` resolves to the workspace directory.

- [ ] **Step 5: Check the offline CLI with the Host stopped**

Stop DSH, then run `node plugins/dsh-im/bin/dsh-im.mjs accounts --json`.
Expected: JSON listing the configured Weixin and Feishu accounts with `accountNameSource`, exit 0. This is the whole point of the offline projection — record the actual output.

- [ ] **Step 6: Check the CLI and the group with the Host running**

Start DSH, run `dsh-im accounts --json` again and confirm `state`/`connected` are now populated; then `dsh-im send --account <名> --target <目标名> --text 测试 --json`; finally inspect `~/.dsh/storages/workspace.json` for the `DSH-IM` title and start a new IM conversation.
Expected: the message arrives, the workspace entry exists, and the new conversation sits under `DSH-IM` rather than `未分组`.

- [ ] **Step 7: Commit**

```bash
git add plugins/dsh-im/lib plugins/dsh-im/package.json
git commit -m "build(dsh-im): rebuild the bundles for 6.0.0"
```

---

## Self-Review

**Spec coverage:** §4.1 exposure → Tasks 3, 4. §4.2 routes → Task 3. §4.3 offline sources → Task 4 (fixtures encode both files). §5.1 command tree → Task 5. §5.2 projection-only → Tasks 4, 5 (`postJson` for every write). §5.3 skills incl. the two-routes table → Task 7. §5.4 HTTP retained → Tasks 1, 5. §5.5 contract v2 → Task 8. §6 forbidden actions → Task 7 copy; enforcement stays in the HTTP route that already refuses them. §7 group → Task 6. §7.5 documents → Task 10. §8 optimisations → Task 9 (O1, O2), Task 7 (O3), Task 5 (O4). §9 fork → Task 1. §10 verification → Tasks 2–10 offline, Task 11 host group.

**Gap kept visible, not silently dropped:** the spec's `sessions list --group DSH-IM` read-only listing has **no task**. The group is already visible in the sidebar and `dsh-vyra-dsh-console` can open it; a second read path inside dsh-im would duplicate it. Task 5 keeps the dispatch slot so adding it later is a small change. Flagged for the user.

**Known limitation, stated rather than hidden:** §6's "the Agent cannot write `accessPolicy` / credentials / delete a bot" is enforced by the HTTP route and by the CLI simply not exposing those commands. It is **not** enforced by a token — anything that reaches the management RPC with browser credentials still can. The spec's audit line covers detection, not prevention. If hard prevention is wanted it needs an RPC-side actor flag, which this plan does not add.

**Type consistency:** `PublicAccount`/`PublicTarget` are defined once in Task 3 and consumed unchanged in Tasks 4 and 5. `runAgentCommand`'s signature is fixed in Task 5. `installSessionGroup(harness, …)` is fixed in Task 6 and used only there.

**Review Focus coverage:** (1) target name == account name → Task 3 `targetWarnings` test, plus the fixture in Task 4 reproducing the live collision; (2) reading one file only → Task 4's final assertion and the `unknown-account` expectation; (3) `--target` by name → Task 3 resolution tests and Task 5 end-to-end; (4) duplicate account names → Task 3 `ambiguous-account`; (5) group race → Task 6 scenarios 1–2.
