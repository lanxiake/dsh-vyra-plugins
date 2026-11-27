// The `dsh-im` command surface that an Agent drives.
//
// Two kinds of command live here:
//   * reads (accounts, targets, login-hint, settings get) answer from the
//     offline projection, so they work while DSH is not running;
//   * writes (send, send-file, target *, settings set) go over the Host's HTTP
//     delivery route, which owns the write queue and the validation.
//
// Nothing in this file re-implements a validation the Host already performs.

import { resolveAccount, resolveTarget } from '../../plugin-src/host/agent-api-resolve.mjs';

/** Options these commands accept, so a typo fails instead of being ignored. */
const OPTIONS = new Set([
  '--account', '--bot', '--target', '--text', '--format', '--file', '--image',
  '--idempotency-key', '--name', '--kind', '--route', '--key', '--value',
]);

const FLAGS = new Set(['--json', '--stdin', '--with-routes']);

const VALUE_ONLY = new Set(['send', 'send-file', 'target', 'settings']);

/**
 * Split argv into a command path and its options.
 * @param argv - `process.argv.slice(2)`.
 * @returns `{ path, options, flags }`; `options` keeps repeated keys as an array.
 */
export function parseArgs(argv) {
  const path = [];
  const options = {};
  const flags = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (FLAGS.has(token)) {
      flags.add(token);
      continue;
    }
    if (OPTIONS.has(token)) {
      const value = argv[index + 1];
      if (value === undefined) throw new Error(`${token} 需要一个值`);
      (options[token] ??= []).push(value);
      index += 1;
      continue;
    }
    if (token.startsWith('--')) throw new Error(`无法识别的参数：${token}`);
    path.push(token);
  }
  return { path, options, flags };
}

function single(options, name) {
  const values = options[name];
  if (!values || values.length === 0) return undefined;
  if (values.length > 1) throw new Error(`${name} 只能给一次`);
  return values[0];
}

/** Resolve the account flag; `--bot` is the documented alias of `--account`. */
function accountFlag(options) {
  const account = single(options, '--account');
  const bot = single(options, '--bot');
  if (account !== undefined && bot !== undefined && account !== bot) {
    throw new Error('--account 与 --bot 只给一个');
  }
  const value = account ?? bot;
  if (value === undefined) throw new Error('需要 --account <账号名或 botId>');
  return value;
}

function errorResult(error) {
  return {
    error: {
      code: typeof error?.code === 'string' ? error.code : 'failed',
      message: error?.message ?? String(error),
      ...(Array.isArray(error?.candidates)
        ? { candidates: error.candidates.map((entry) => ({ botId: entry.botId, targetId: entry.targetId })) }
        : {}),
    },
  };
}

function summary(command, value) {
  if (command === 'accounts') {
    if (value.accounts.length === 0) return '没有已配置的 IM 账号。';
    return value.accounts
      .map((account) => `${account.accountName}（${account.channel} · ${account.botId}）`)
      .join('\n');
  }
  if (command === 'targets') {
    if (value.targets.length === 0) {
      return `${value.accountName} 还没有投递目标，请在设置页添加，或用 dsh-im target create 新建。`;
    }
    return value.targets
      .map((target) => `${target.targetName ?? '(未命名)'} · ${target.kind} · ${target.targetId}`)
      .join('\n');
  }
  if (value?.sent) return '已提交发送。';
  return JSON.stringify(value);
}

async function readStdin() {
  if (process.stdin.isTTY) throw new Error('--stdin 需要从管道读取内容');
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function textInput(options, flags) {
  const text = single(options, '--text');
  if (flags.has('--stdin')) {
    if (text !== undefined) throw new Error('--text 与 --stdin 只给一个');
    return { text: await readStdin() };
  }
  if (text === undefined) throw new Error('需要 --text 或 --stdin');
  return { text };
}

/**
 * Run one command.
 * @param argv - arguments after the program name.
 * @param deps.api - offline projection (`createAgentApi`).
 * @param deps.postJson - HTTP transport; injected so tests need no server.
 * @param deps.stdout - line writer.
 * @param deps.stderr - line writer.
 * @returns the process exit code.
 */
export async function runAgentCommand(argv, {
  api, postJson, stdout = console.log, stderr = console.error,
}) {
  let json = false;
  try {
    const { path, options, flags } = parseArgs(argv);
    json = flags.has('--json');
    const [command, action] = path;
    if (!command) throw new Error('缺少命令');

    if (command === 'accounts' || command === 'bots') {
      const value = await api.accounts();
      stdout(json ? JSON.stringify(value, null, 2) : summary('accounts', value));
      return 0;
    }

    if (command === 'targets') {
      const value = await api.targets({
        account: accountFlag(options),
        withRoutes: flags.has('--with-routes'),
      });
      if (json) stdout(JSON.stringify(value, null, 2));
      else {
        stdout(summary('targets', value));
        for (const warning of value.warnings) stderr(`注意：${warning}`);
      }
      return 0;
    }

    if (command === 'send' || command === 'send-file') {
      const account = accountFlag(options);
      const targetId = single(options, '--target');
      if (targetId === undefined) throw new Error('需要 --target <targetId 或目标名>');
      const idempotencyKey = single(options, '--idempotency-key');
      const filePath = single(options, '--file');
      // Validate inputs before resolving, so a bad call reports the real problem
      // rather than an unrelated "unknown target".
      if (command === 'send-file' && filePath === undefined) throw new Error('send-file 需要 --file <路径>');
      if (command === 'send' && filePath !== undefined) throw new Error('发文件请用 dsh-im send-file');
      const body = command === 'send' ? await textInput(options, flags) : null;
      // Resolve against the offline projection first: a name becomes the
      // registered id here, and an ambiguous or unknown target never reaches
      // the network.
      const { botId, targets } = await api.targets({ account });
      const resolved = resolveTarget(targets, targetId);

      const payload = command === 'send'
        ? {
          botId,
          targetId: resolved.targetId,
          ...body,
          format: single(options, '--format') ?? 'plain',
        }
        : {
          botId,
          targetId: resolved.targetId,
          path: filePath,
          ...(flags.has('--image') ? { asImage: true } : {}),
        };
      if (idempotencyKey !== undefined) payload.idempotencyKey = idempotencyKey;
      const route = command === 'send' ? '/api/dsh-im/delivery/messages' : '/api/dsh-im/delivery/files';
      const value = await postJson(route, payload);
      stdout(json ? JSON.stringify(value, null, 2) : summary(command, value));
      return 0;
    }

    if (command === 'target') {
      if (!['create', 'update', 'delete'].includes(action)) {
        throw new Error('target 只支持 create / update / delete');
      }
      if (action === 'create') {
        // A create names the id itself; it must never be resolved by name.
        const targetId = single(options, '--target');
        if (targetId === undefined) throw new Error('target create 需要 --target <新 targetId>');
        const name = single(options, '--name');
        const kind = single(options, '--kind');
        if (name === undefined) throw new Error('target create 需要 --name <显示名>');
        if (kind === undefined) throw new Error('target create 需要 --kind <目标类型>');
        const route = parseRoute(single(options, '--route'));
        const botId = (await api.targets({ account: accountFlag(options) })).botId;
        const value = await postJson('/api/dsh-im/delivery/query', {
          op: 'createTarget', botId, target: { targetId, name, kind, route },
        });
        stdout(json ? JSON.stringify(value, null, 2) : `已创建目标 ${targetId}。`);
        return 0;
      }

      const account = accountFlag(options);
      const targetId = single(options, '--target');
      if (targetId === undefined) throw new Error(`target ${action} 需要 --target <targetId 或目标名>`);
      const { botId, targets } = await api.targets({ account });
      const resolved = resolveTarget(targets, targetId);
      let payload;
      if (action === 'update') {
        // The Host merges a patch over the stored target, so a rename need not
        // resend kind and route.
        const name = single(options, '--name');
        const route = parseRoute(single(options, '--route'));
        const kind = single(options, '--kind');
        if (name === undefined && route === undefined && kind === undefined) {
          throw new Error('target update 需要 --name、--route 或 --kind');
        }
        payload = {
          op: 'updateTarget',
          botId,
          targetId: resolved.targetId,
          patch: {
            ...(name === undefined ? {} : { name }),
            ...(route === undefined ? {} : { route }),
            ...(kind === undefined ? {} : { kind }),
          },
        };
      } else {
        payload = { op: 'deleteTarget', botId, targetId: resolved.targetId };
      }
      const value = await postJson('/api/dsh-im/delivery/query', payload);
      stdout(json ? JSON.stringify(value, null, 2) : `已${action === 'update' ? '更新' : '删除'}目标 ${resolved.targetId}。`);
      return 0;
    }

    if (command === 'settings') {
      const account = accountFlag(options);
      if (action === 'get') {
        // Same resolution rule as every other command: duplicates must refuse
        // rather than silently pick the first account.
        const { accounts } = await api.accounts();
        const resolved = resolveAccount(accounts, account);
        const value = await postJson('/api/dsh-im/delivery/query', { op: 'settingsGet', botId: resolved.botId });
        const body = JSON.stringify(value, null, 2);
        stdout(body);
        return 0;
      }
      if (action !== 'set') throw new Error('settings 只支持 get / set');
      const botId = (await api.targets({ account })).botId;
      const key = single(options, '--key');
      const settingValue = single(options, '--value');
      if (key === undefined) throw new Error('settings set 需要 --key');
      if (settingValue === undefined) throw new Error('settings set 需要 --value');
      const value = await postJson('/api/dsh-im/delivery/query', {
        op: 'settingsSet', botId, key, value: settingValue,
      });
      stdout(json ? JSON.stringify(value, null, 2) : '已保存。');
      return 0;
    }

    if (command === 'login-hint') {
      stdout('扫码登录与凭据绑定需要在 DSH 设置页完成：设置 → IM机器人 → 选择渠道 → 连接。');
      stdout('本命令不会自动连接，也不会读取任何凭据。');
      return 0;
    }

    throw new Error(`无法识别的命令：${command}`);
  } catch (error) {
    const result = errorResult(error);
    stderr(json ? JSON.stringify(result, null, 2) : `dsh-im: ${result.error.message}`);
    return 1;
  }
}

function parseRoute(value) {
  if (value === undefined) return undefined;
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('--route 需要是 JSON 对象，例如 \'{"chatId":"oc_xxx"}\'');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('--route 需要是 JSON 对象');
  }
  return parsed;
}
