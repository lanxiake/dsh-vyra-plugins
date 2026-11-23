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

const PACKAGE_NAME = '@xmanrui/dsh-im';
const DEFAULT_SOURCE = 'github:xmanrui/dsh-im';
const LEGACY_PACKAGES = [
  '@xmanrui/dsh-feishu',
  '@xmanrui/dsh-weixin',
  '@xmanrui/dsh-dingtalk',
];

const ERROR_HINTS = Object.freeze({
  'unknown-bot': '先运行 dsh-im bots 获取当前机器人 ID',
  'unknown-target': '先运行 dsh-im targets --bot <botId>；目标要在设置页创建',
  'bot-not-connected': '机器人离线，恢复连接后再发；不要循环重试',
  'target-rejected': '平台拒绝了目标：检查机器人权限和目标 ID',
  'invalid-target': '目标类型和平台 ID 不匹配，回设置页重选',
  'capability-unavailable': '该渠道暂不支持主动发文件；目前只有飞书支持',
  unreachable: '确认 DSH 正在运行；也可以用 --url 指定地址',
  timeout: 'Host 没有在时限内响应；先 dsh-im endpoint 核对地址',
});

function usage() {
  console.log(`Usage:
  dsh-im install [--profile web] [--source <package-spec>]
  dsh-im uninstall [--profile web]
  dsh-im send --bot <botId> --target <targetId> (--text <text> | --stdin | --file <path>)
              [--format plain|markdown] [--image] [--idempotency-key <key>] [--url <origin>]
  dsh-im bots [--url <origin>]
  dsh-im targets --bot <botId> [--url <origin>]
  dsh-im endpoint

Examples:
  npx -y github:xmanrui/dsh-im install
  dsh-im send --bot bot_x --target release-alerts --text "构建已完成"
  echo "构建已完成" | dsh-im send --bot bot_x --target release-alerts --stdin
  dsh-im send --bot bot_x --target release-alerts --file ./report.pdf
  dsh-im targets --bot bot_x`);
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

async function readStdin() {
  if (process.stdin.isTTY) throw new Error('--stdin 需要从管道读取内容');
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
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
  } else if (['send', 'bots', 'targets', 'endpoint'].includes(command)) {
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
