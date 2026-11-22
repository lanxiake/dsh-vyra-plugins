// 手动规划一节课的讲解脚本（Phase 0 诊断入口）。
//
//   node --experimental-strip-types scripts/media-plan.mjs \
//     --workspace C:/Users/Administrator/StudyMate \
//     --subject self-media-product-launch \
//     --node intro.why-content-works
//
// 产物写到媒体缓存：<root>/<subject>/script/<node>.json。
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

const moduleApi = await import('node:module');
if (typeof moduleApi.registerHooks === 'function') {
  await import('../bin/typescript-runtime.mjs');
}
const { planLesson } = await import('../lib/media/index.ts');
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
if (args.help || !args.node) {
  console.log(`用法：node --experimental-strip-types scripts/media-plan.mjs --node <节点id> [选项]
  --workspace <目录>   学习工作区；省略则读 ~/.dsh/studymate-config.yaml
  --subject <slug>     科目 slug（必填）
  --node <节点id>      大纲节点 id（必填）
  --root <目录>        媒体缓存根；省略则用配置 / STUDYMATE_MEDIA_ROOT / ~/.dsh/studymate/media-cache
  --title <标题>       传给标题一致性检查；省略则用课件 front matter
  --narration <文件>   临时 narration.md（试听用；不写学习工作区）
  --json               打印完整脚本`);
  process.exit(args.help ? 0 : 1);
}

const workspace = typeof args.workspace === 'string'
  ? args.workspace
  : resolveWorkspace();
if (!workspace) {
  console.error('找不到学习工作区：给 --workspace，或先跑安装写配置。');
  process.exit(1);
}
if (typeof args.subject !== 'string' || args.subject.trim() === '') {
  console.error('缺 --subject。');
  process.exit(1);
}

let narrationSource;
let narrationFile;
if (typeof args.narration === 'string') {
  try {
    narrationSource = fs.readFileSync(args.narration, 'utf8');
    narrationFile = path.basename(args.narration);
  } catch (error) {
    console.error(`读不到 narration 文件：${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

try {
  const result = planLesson({
    workspace,
    subject: args.subject.trim(),
    node: String(args.node).trim(),
    ...(typeof args.root === 'string' && args.root.trim() !== '' ? { root: args.root } : {}),
    ...(typeof args.title === 'string' && args.title.trim() !== '' ? { outlineTitle: args.title } : {}),
    ...(narrationSource === undefined ? {} : { narrationSource, narrationFile }),
  });

  if (!result.script) {
    console.error('没有生成脚本：');
    for (const error of result.errors) console.error(`  ${error.file}:${error.line} ${error.message}`);
    process.exit(1);
  }

  const total = result.script.scenes.reduce((sum, scene) => sum + scene.estimatedSeconds, 0);
  console.log(`脚本：${result.outputFile}`);
  console.log(`  ${result.script.title} · ${result.script.scenes.length} 场 · 约 ${Math.round(total / 60)} 分钟`);
  for (const scene of result.script.scenes) {
    console.log(`  ${scene.id} ${scene.heading} · ${scene.estimatedSeconds}s · ${scene.visuals.length} 画面 · ${scene.quizAnchors.length} 题`);
  }
  if (result.errors.length > 0) {
    console.error('课件格式错误：');
    for (const error of result.errors) console.error(`  ${error.file}:${error.line} ${error.message}`);
  }
  for (const problem of result.narrationProblems) {
    console.error(`旁白：${problem.file}:${problem.line} ${problem.message}`);
  }
  for (const problem of result.audioProblems) {
    console.warn(`音频${problem.severity === 'blocking' ? '阻断' : '提醒'}：${problem.file}:${problem.line} ${problem.message}`);
  }
  if (args.json) console.log(JSON.stringify(result.script, null, 2));
  process.exit(result.errors.length > 0 || result.narrationProblems.length > 0 ? 1 : 0);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
