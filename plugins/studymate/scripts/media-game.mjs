// 生成互动游戏：curriculum + quiz → game.json + 自包含 index.html。
//
//   node --experimental-strip-types scripts/media-game.mjs \
//     --workspace C:/Users/Administrator/StudyMate \
//     --subject self-media-product-launch \
//     --root C:/Users/Administrator/AppData/Local/Temp/studymate-game
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

const moduleApi = await import('node:module');
if (typeof moduleApi.registerHooks === 'function') {
  await import('../bin/typescript-runtime.mjs');
}
const media = await import('../lib/media/index.ts');
const { resolveWorkspace } = await import('../lib/workspace.ts');

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith('--')) args[key] = true;
    else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (args.help || !args.subject) {
  console.log(`用法：node --experimental-strip-types scripts/media-game.mjs --subject <slug> [选项]
  --workspace <目录>   学习工作区；省略则读配置
  --root <目录>        媒体缓存根；省略则用默认缓存`);
  process.exit(args.help ? 0 : 1);
}

const workspace = typeof args.workspace === 'string' ? args.workspace : resolveWorkspace();
if (!workspace) {
  console.error('找不到学习工作区：给 --workspace，或先跑安装写配置。');
  process.exit(1);
}

try {
  const result = media.writeGame({
    workspace,
    subject: String(args.subject).trim(),
    ...(typeof args.root === 'string' && args.root.trim() !== '' ? { root: args.root } : {}),
  });
  console.log(`科目：${result.spec.title}`);
  console.log(`关卡：${result.spec.levels.length} · 题目：${result.spec.levels.reduce((n, level) => n + level.questions.length, 0)}`);
  for (const level of result.spec.levels) {
    console.log(`  ${level.number || '?'} ${level.title} · ${level.questions.length} 题 · ${level.kind}`);
  }
  console.log(`页面：${result.indexFile}`);
  if (result.workshopFile) console.log(`工作坊：${result.workshopFile}`);
  console.log(`数据：${result.dataFile}`);
  console.log(`清单：${result.manifestFile}`);
  for (const warning of result.warnings) console.log(`  warning: ${warning}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}