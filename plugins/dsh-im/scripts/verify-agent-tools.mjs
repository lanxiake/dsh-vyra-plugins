// Self-check for the Agent-facing delivery tools.
//
// Run: node scripts/verify-agent-tools.mjs
// Fails if a tool definition drifts from the contract the skill documents, or
// if the target projection starts leaking the platform route.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DELIVERY_TARGETS_TOOL,
  SEND_FILE_TOOL,
  SEND_MESSAGE_TOOL,
  createDeliveryTools,
  installDeliveryTools,
} from '../src/channels/shared/delivery-tools.mjs';
import { installDeliverySkill, resolveSkillsRoot } from '../plugin-src/host/skills.mjs';

const calls = [];

const service = {
  async send(botId, targetId, text, options) {
    if (targetId !== 'release-alerts') {
      const error = new Error('Unknown target');
      error.code = 'unknown-target';
      throw error;
    }
    calls.push({ botId, targetId, text, options });
    return { sent: true };
  },
  async sendFile(botId, targetId, file) {
    calls.push({ kind: 'file', botId, targetId, file });
    return { sent: true, fileName: 'report.pdf', size: 12, asImage: file.asImage === true };
  },
  async listBots() {
    return [{ botId: 'bot_a', channel: 'feishu' }];
  },
  async listTargets(botId) {
    if (botId !== 'bot_a') {
      const error = new Error('Unknown bot');
      error.code = 'unknown-bot';
      throw error;
    }
    return {
      botId,
      channel: 'feishu',
      targets: [{
        targetId: 'release-alerts',
        name: '发布告警群',
        kind: 'group',
        route: { chatId: 'oc_secret' },
        sessionSync: { enabled: false, state: 'off' },
      }],
    };
  },
};

const [sendTool, fileTool, targetsTool] = createDeliveryTools(service);

assert.equal(sendTool.name, SEND_MESSAGE_TOOL);
assert.equal(fileTool.name, SEND_FILE_TOOL);
assert.equal(targetsTool.name, DELIVERY_TARGETS_TOOL);
assert.deepEqual(sendTool.parameters.required, ['botId', 'targetId', 'text']);
assert.equal(sendTool.parameters.additionalProperties, false);
assert.deepEqual(sendTool.parameters.properties.format.enum, ['plain', 'markdown']);

// Descriptions must match reality: six channels send files, and a model needs
// to be told to check whether it is already in the destination chat.
assert.equal(/currently Feishu/u.test(fileTool.description), false, 'files are not Feishu-only');
assert.match(fileTool.description, /Feishu, Weixin, WeCom \(bot and app\), DingTalk and QQ/u);
assert.match(sendTool.description, /current Session/iu, 'must warn about answering the current chat');

assert.deepEqual(await sendTool.execute({ botId: 'bot_a', targetId: 'release-alerts', text: 'hi' }), { sent: true });
assert.equal(calls[0].options.format, 'plain');
await sendTool.execute({ botId: 'bot_a', targetId: 'release-alerts', text: '# hi', format: 'markdown' });
assert.equal(calls[1].options.format, 'markdown');

await assert.rejects(
  () => sendTool.execute({ botId: 'bot_a', targetId: 'gone', text: 'x' }),
  (error) => error instanceof Error && error.message.startsWith('unknown-target'),
);

const exec = { agent: { session: { header: { cwd: '/workspace' } } } };
assert.equal((await fileTool.execute(
  { botId: 'bot_a', targetId: 'release-alerts', path: '/tmp/report.pdf' },
  exec,
)).sent, true);
assert.equal(calls.at(-1).file.path, '/tmp/report.pdf');

await fileTool.execute({ botId: 'bot_a', targetId: 'release-alerts', path: 'report.png', asImage: true }, exec);
assert.equal(calls.at(-1).file.path, resolve('/workspace', 'report.png'));
assert.equal(calls.at(-1).file.asImage, true);

assert.deepEqual(await targetsTool.execute({}), { bots: [{ botId: 'bot_a', channel: 'feishu' }] });
const listed = await targetsTool.execute({ botId: 'bot_a' });
assert.deepEqual(listed, {
  botId: 'bot_a',
  channel: 'feishu',
  targets: [{ targetId: 'release-alerts', name: '发布告警群', kind: 'group' }],
});
assert.equal(JSON.stringify(listed).includes('oc_secret'), false, 'platform route must not leak');

await assert.rejects(
  () => targetsTool.execute({ botId: 'bot_missing' }),
  (error) => error instanceof Error && error.message.startsWith('unknown-bot'),
);

const registered = [];
assert.equal(installDeliveryTools({ tools: { register: (tool) => registered.push(tool) } }, service), true);
assert.equal(registered.length, 3);
assert.equal(installDeliveryTools({}, service), false);

const libDir = fileURLToPath(new URL('../lib', import.meta.url));
const skillsRoot = resolveSkillsRoot(libDir);
assert.ok(skillsRoot, 'skills root is discoverable from the bundle directory');
assert.ok(skillsRoot.endsWith('skills'));

let mounted;
const skillCtx = {
  plugin: (module, config) => { mounted = { module, config }; },
};
assert.equal(await installDeliverySkill(skillCtx, {
  root: skillsRoot,
  load: async () => ({ name: 'fake-skill-filesystem' }),
}), true);
assert.equal(mounted.module.name, 'fake-skill-filesystem');
assert.equal(mounted.config.providerName, 'dsh-im');
assert.equal(mounted.config.includeDefaultRoots, false);
assert.deepEqual(mounted.config.customSkillDirs, [skillsRoot]);
assert.equal(mounted.config.watch, false);
assert.equal(await installDeliverySkill({}, { root: skillsRoot }), false);

// Every skill under the root ships; the provider discovers them from one dir.
const skillNames = readdirSync(skillsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
assert.deepEqual(skillNames, ['dsh-im-accounts', 'dsh-im-delivery', 'dsh-im-manage']);

for (const name of skillNames) {
  const body = readFileSync(resolve(skillsRoot, name, 'SKILL.md'), 'utf8');
  assert.match(body, new RegExp(`name: ${name}`, 'u'), `${name} front matter must match its directory`);
  assert.match(body, /^description: \S/mu, `${name} needs a description`);
}

const accountsSkill = readFileSync(resolve(skillsRoot, 'dsh-im-accounts', 'SKILL.md'), 'utf8');
assert.match(accountsSkill, /dsh-im accounts/u);
assert.match(accountsSkill, /ambiguous-account/u);
assert.match(accountsSkill, /目标名与账号名相同/u, 'must cover the target/account name collision');
assert.match(accountsSkill, /改名/u, 'must tell the Agent to suggest a rename');

const manageSkill = readFileSync(resolve(skillsRoot, 'dsh-im-manage', 'SKILL.md'), 'utf8');
assert.match(manageSkill, /settings set/u);
assert.match(manageSkill, /\/workspace/u, 'must document the IM-command route');
assert.match(manageSkill, /user-only-action/u);
assert.match(manageSkill, /只影响之后新建的 Session/u, 'must state when a change takes effect');

// A write-capable skill must never present sending as its own job.
assert.equal(/dsh_im_send_message/u.test(manageSkill), false);

console.log('verify-agent-tools: ok');
