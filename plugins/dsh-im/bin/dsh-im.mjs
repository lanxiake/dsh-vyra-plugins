#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  DeliveryCliError,
  queryDelivery,
  resolveBaseUrl,
  sendFile,
  sendMessage,
} from '../src/cli/delivery-client.mjs';
import { readStdin, runAgentCommand } from '../src/cli/agent-client.mjs';
import { createAgentApi } from '../plugin-src/host/agent-api.mjs';

const PACKAGE_NAME = '@lanxiake/dsh-im';
const DEFAULT_SOURCE = 'github:lanxiake/dsh-vyra-plugins#path:/plugins/dsh-im';
const LEGACY_PACKAGES = [
  '@xmanrui/dsh-im',
  '@xmanrui/dsh-feishu',
  '@xmanrui/dsh-weixin',
  '@xmanrui/dsh-dingtalk',
];

const AGENT_COMMANDS = new Set([
  'accounts', 'bots', 'targets', 'send', 'send-file', 'target', 'settings', 'login-hint',
]);

const ERROR_HINTS = Object.freeze({
  'unknown-bot': '先运行 dsh-im accounts 获取当前账号与 botId',
  'unknown-account': '先运行 dsh-im accounts 查看账号名与 botId',
  'ambiguous-account': '账号名重复，改用 botId：dsh-im accounts --json',
  'unknown-target': '先运行 dsh-im targets --account <账号>；目标要在设置页创建',
  'ambiguous-target': '目标名重复，改用 targetId：dsh-im targets --account <账号> --json',
  'user-only-action': '改访问策略、凭据或删除机器人请在设置页操作',
  'bot-not-connected': '机器人离线，恢复连接后再发；不要循环重试',
  'target-rejected': '平台拒绝了目标：检查机器人权限和目标 ID',
  'invalid-target': '目标类型和平台 ID 不匹配，回设置页重选',
  'capability-unavailable': '该渠道暂不支持主动发文件：飞书、微信、企业微信（机器人/应用）、钉钉、QQ 支持',
  unreachable: '发送与修改配置需要 DSH 正在运行；也可以用 --url 指定地址',
  timeout: 'Host 没有在时限内响应；先 dsh-im endpoint 核对地址',
});

function usage() {
  console.log(`Usage:
  dsh-im install [--profile web] [--source <package-spec>]
  dsh-im uninstall [--profile web]

  读取（DSH 未运行也可用）
  dsh-im accounts [--json]
  dsh-im targets  --account <账号名|botId> [--with-routes] [--json]
  dsh-im login-hint
  dsh-im endpoint

  写入（需要 DSH 正在运行）
  dsh-im send      --account <账号名|botId> --target <targetId|目标名>
                   (--text <text> | --stdin) [--format plain|markdown] [--idempotency-key <key>]
  dsh-im send-file --account <账号名|botId> --target <targetId|目标名> --file <path> [--image]
  dsh-im target create --account <账号名|botId> --target <targetId> --name <显示名> --kind <kind> [--route <json>]
  dsh-im target update --account <账号名|botId> --target <targetId|目标名> [--name <显示名>] [--route <json>]
  dsh-im target delete --account <账号名|botId> --target <targetId|目标名>
  dsh-im settings get --account <账号名|botId>
  dsh-im settings set --account <账号名|botId> --key <key> --value <value>

  --bot <botId> 是 --account 的兼容别名。所有命令都接受 --json。

Examples:
  dsh plugin --profile desktop add -w "github:lanxiake/dsh-vyra-plugins#path:/plugins/dsh-im"
  dsh-im accounts
  dsh-im targets --account 我的微信
  dsh-im send --account 我的微信 --target 发布告警群 --text "构建已完成"
  echo "构建已完成" | dsh-im send --account 我的微信 --target 发布告警群 --stdin
  dsh-im send-file --account 我的微信 --target 发布告警群 --file ./report.pdf`);
}

function takeOption(args, name, fallback) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  args.splice(index, 2);
  return value;
}

function takeFlag(args, name) {
  const index = args.indexOf(name);
  if (index < 0) return false;
  args.splice(index, 1);
  return true;
}

function runDsh(args) {
  const result = spawnSync('dsh', args, {
    cwd: tmpdir(),
    stdio: 'inherit',
    shell: false,
  });
  if (result.error?.code === 'ENOENT') {
    throw new Error('找不到 dsh，请先安装 DeepSeek Harness 并确保 dsh 在 PATH 中。');
  }
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`dsh 退出，状态码 ${result.status ?? 1}`);
}

async function directProfilePackages(profile) {
  const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh');
  const profilePackage = join(dshHome, 'profiles', profile, 'package.json');
  try {
    const manifest = JSON.parse(await readFile(profilePackage, 'utf8'));
    const bundles = new Set(manifest.dsh?.profile?.bundles ?? []);
    const dependencies = manifest.dependencies ?? {};
    return new Set(LEGACY_PACKAGES.filter((name) => dependencies[name] || bundles.has(name)));
  } catch (error) {
    if (error?.code === 'ENOENT') return new Set();
    throw new Error(`无法读取 Harness 配置 ${profilePackage}：${error.message}`);
  }
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

async function runDelivery(command, args) {
  const explicitUrl = takeOption(args, '--url', undefined);
  const baseUrl = await resolveBaseUrl(explicitUrl);

  if (command === 'endpoint') {
    console.log(baseUrl);
    return;
  }

  if (command === 'bots') {
    printJson(await queryDelivery(baseUrl, { op: 'bots' }));
    return;
  }

  if (command === 'targets') {
    const botId = takeOption(args, '--bot', undefined);
    if (!botId) throw new Error('targets 需要 --bot <botId>');
    printJson(await queryDelivery(baseUrl, { op: 'targets', botId }));
    return;
  }

  const botId = takeOption(args, '--bot', undefined);
  const targetId = takeOption(args, '--target', undefined);
  const format = takeOption(args, '--format', 'plain');
  const filePath = takeOption(args, '--file', undefined);
  const idempotencyKey = takeOption(args, '--idempotency-key', undefined);
  const asImage = takeFlag(args, '--image');
  const fromStdin = takeFlag(args, '--stdin');
  const text = fromStdin ? await readStdin() : takeOption(args, '--text', undefined);
  if (!botId) throw new Error('send 需要 --bot <botId>');
  if (!targetId) throw new Error('send 需要 --target <targetId>');
  if (filePath !== undefined) {
    if (text !== undefined) throw new Error('--file 不能和 --text/--stdin 同时使用');
    printJson(await sendFile(baseUrl, {
      botId,
      targetId,
      path: resolve(process.cwd(), filePath),
      ...(asImage ? { asImage: true } : {}),
      ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
    }));
    return;
  }
  if (asImage) throw new Error('--image 只能和 --file 一起使用');
  if (text === undefined) throw new Error('send 需要 --text、--stdin 或 --file');
  if (format !== 'plain' && format !== 'markdown') throw new Error('--format 只接受 plain 或 markdown');
  printJson(await sendMessage(baseUrl, {
    botId,
    targetId,
    text,
    format,
    ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
  }));
}

const args = process.argv.slice(2);
const command = args.shift();

if (!command || command === '--help' || command === '-h') {
  usage();
  process.exit(0);
}

try {
  if (command === 'install' || command === 'uninstall') {
    const profile = takeOption(args, '--profile', 'web');
    if (command === 'install') {
      const requested = takeOption(args, '--source', DEFAULT_SOURCE);
      const source = requested === '.' || requested === '..'
        || requested.startsWith('./') || requested.startsWith('../')
        ? resolve(process.cwd(), requested)
        : (isAbsolute(requested) ? requested : requested);
      if (args.length > 0) throw new Error(`无法识别的参数：${args.join(' ')}`);

      const legacy = await directProfilePackages(profile);
      runDsh(['plugin', '--profile', profile, 'add', '--save-exact', source]);
      for (const packageName of legacy) {
        runDsh(['plugin', '--profile', profile, 'remove', packageName]);
      }
      console.log('\nIM 机器人插件已安装。请重启 dsh web、刷新浏览器，然后打开「设置 → IM机器人」。');
      console.log('安装后会自动挂载 dsh-im-delivery 技能；Agent 可直接使用 dsh_im_send_message。');
      if (legacy.size > 0) {
        console.log('已用 dsh-im 替换独立飞书/微信/钉钉插件；原有凭据和扫码绑定保持不变。');
      }
    } else {
      if (args.length > 0) throw new Error(`无法识别的参数：${args.join(' ')}`);
      runDsh(['plugin', '--profile', profile, 'remove', PACKAGE_NAME]);
      console.log('\nIM 机器人插件已卸载。请重启 dsh web。');
    }
  } else if (AGENT_COMMANDS.has(command)) {
    // Reads come from the offline projection; writes go over the Host's HTTP
    // route. `--url` still overrides the origin for the write half, and it is
    // only resolved here so the offline reads never depend on it.
    const explicitUrl = takeOption(args, '--url', undefined);
    const baseUrl = await resolveBaseUrl(explicitUrl);
    const api = createAgentApi({ dshHome: process.env.DSH_HOME || join(homedir(), '.dsh') });
    const transport = async (path, payload) => {
      if (path === '/api/dsh-im/delivery/query') return queryDelivery(baseUrl, payload);
      if (path === '/api/dsh-im/delivery/messages') return sendMessage(baseUrl, payload);
      if (path === '/api/dsh-im/delivery/files') {
        // The Host reads the file; a relative path means "relative to me".
        return sendFile(baseUrl, { ...payload, path: resolve(process.cwd(), payload.path) });
      }
      throw new Error(`未知的投递路由：${path}`);
    };
    process.exitCode = await runAgentCommand([command, ...args], {
      api,
      postJson: transport,
      stdout: (line) => console.log(line),
      stderr: (line) => console.error(line),
    });
  } else if (command === 'endpoint') {
    await runDelivery(command, args);
  } else {
    throw new Error(`无法识别的命令：${command}`);
  }
} catch (error) {
  if (error instanceof DeliveryCliError) {
    const hint = ERROR_HINTS[error.code];
    console.error(`dsh-im: ${error.code}${hint ? ` — ${hint}` : ''}`);
  } else {
    console.error(`dsh-im: ${error.message}`);
  }
  process.exit(1);
}
