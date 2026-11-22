// 生成音频产物（Phase 1.1：单场或指定场景，edge-tts）。
//
//   node --experimental-strip-types scripts/media-audio.mjs \
//     --workspace C:/Users/Administrator/StudyMate \
//     --subject self-media-product-launch \
//     --node intro.why-content-works --scene 1 \
//     --root C:/Users/Administrator/AppData/Local/Temp/studymate-preview
//
// 默认第 1 场；--scene 1,2 或 --all 生成多场。产物写媒体缓存，不写学习工作区。
import fs from 'node:fs';
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
if (args.help || !args.node || !args.subject) {
  console.log(`用法：node --experimental-strip-types scripts/media-audio.mjs --subject <slug> --node <节点id> [选项]
  --workspace <目录>   学习工作区；省略则读配置
  --root <目录>        媒体缓存根；省略则用默认缓存
  --scene <列表>       s1 或 1，逗号分隔；默认第 1 场
  --all                生成全部场景
  --voice <名称>       edge-tts 音色，默认 zh-CN-XiaoxiaoNeural
  --provider <名称>    edge | native | breeze；默认 edge
  --rate <百分比>      语速，默认 +20%（1.2×；breeze 用自然语速）
  --command <路径>     edge-tts 可执行文件；默认 PATH 上的 edge-tts
  --breeze-root <目录>  Breeze 根目录（默认 E:/ai/breeze-tts）
  --breeze-model <目录> Breeze 模型目录（默认 E:/ai/breeze-tts-2）
  --breeze-api <url>    Breeze FastAPI 地址（默认 http://127.0.0.1:7860）
  --breeze-instruction <文本>  Breeze 风格指令（英文效果更好）
  --breeze-ref-audio <文件>    克隆参考音频（可选）
  --breeze-ref-text <文本>     参考音频逐字稿（克隆时必填）
  --title <标题>       传给标题一致性检查
  --narration <文件>   临时 narration.md（试听用；不写学习工作区）`);
  process.exit(args.help ? 0 : 1);
}

const workspace = typeof args.workspace === 'string' ? args.workspace : resolveWorkspace();
if (!workspace) {
  console.error('找不到学习工作区：给 --workspace，或先跑安装写配置。');
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
  const plan = media.planLesson({
    workspace,
    subject: String(args.subject).trim(),
    node: String(args.node).trim(),
    ...(typeof args.root === 'string' && args.root.trim() !== '' ? { root: args.root } : {}),
    ...(typeof args.title === 'string' && args.title.trim() !== '' ? { outlineTitle: args.title } : {}),
    ...(narrationSource === undefined ? {} : { narrationSource, narrationFile }),
  });

  if (!plan.script) {
    console.error('没有生成脚本：');
    for (const error of plan.errors) console.error(`  ${error.file}:${error.line} ${error.message}`);
    process.exit(1);
  }
  if (plan.errors.length > 0 || plan.narrationProblems.length > 0) {
    console.error('脚本/旁白有问题，先修正再生成音频：');
    for (const error of plan.errors) console.error(`  课件 ${error.file}:${error.line} ${error.message}`);
    for (const problem of plan.narrationProblems) console.error(`  旁白 ${problem.file}:${problem.line} ${problem.message}`);
    process.exit(1);
  }
  for (const problem of plan.audioProblems) {
    console.warn(`  音频提醒：${problem.message}`);
  }

  const sceneIds = args.all
    ? undefined
    : (typeof args.scene === 'string' ? args.scene : '1')
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean)
      .map((token) => (/^\d+$/.test(token) ? `s${token}` : token));

  const provider = media.createTtsProvider({
    provider: typeof args.provider === 'string' && args.provider.trim() !== '' ? args.provider : 'edge',
    ...(typeof args.voice === 'string' && args.voice.trim() !== '' ? { voice: args.voice } : {}),
    ...(typeof args.rate === 'string' && args.rate.trim() !== '' ? { rate: args.rate } : {}),
    ...(typeof args.command === 'string' && args.command.trim() !== '' ? { command: args.command } : {}),
    ...(typeof args['breeze-root'] === 'string' && args['breeze-root'].trim() !== ''
      ? { breezeRoot: args['breeze-root'] } : {}),
    ...(typeof args['breeze-model'] === 'string' && args['breeze-model'].trim() !== ''
      ? { breezeModel: args['breeze-model'] } : {}),
    ...(typeof args['breeze-api'] === 'string' && args['breeze-api'].trim() !== ''
      ? { breezeApiUrl: args['breeze-api'] } : {}),
    ...(typeof args['breeze-instruction'] === 'string' && args['breeze-instruction'].trim() !== ''
      ? { breezeInstruction: args['breeze-instruction'] } : {}),
    ...(typeof args['breeze-ref-audio'] === 'string' && args['breeze-ref-audio'].trim() !== ''
      ? { breezeRefAudio: args['breeze-ref-audio'] } : {}),
    ...(typeof args['breeze-ref-text'] === 'string' && args['breeze-ref-text'].trim() !== ''
      ? { breezeRefText: args['breeze-ref-text'] } : {}),
  });

  const outDir = media.productDir({
    workspace,
    subject: String(args.subject).trim(),
    kind: 'audio',
    node: String(args.node).trim(),
    ...(typeof args.root === 'string' && args.root.trim() !== '' ? { root: args.root } : {}),
  });

  console.log(`音色：${provider.name} / ${provider.voice} · 场景：${sceneIds?.join(',') ?? '全部'} · 输出：${outDir}`);
  const result = await media.synthesizeScenes({
    script: plan.script,
    outDir,
    provider,
    ...(sceneIds === undefined ? {} : { sceneIds }),
  });

  console.log(`音频：${result.audioFile}`);
  console.log(`播放器：${result.playerFile}`);
  console.log(`文字稿：${result.transcriptFile}`);
  console.log(`清单：${result.manifestFile}`);
  console.log(`时长：${(result.durationMs / 1000).toFixed(1)}s · 章节 ${result.manifest.chapters?.length ?? 0}`);
  for (const warning of result.warnings) console.log(`  warning: ${warning}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
