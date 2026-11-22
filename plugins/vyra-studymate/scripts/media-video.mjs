// 第 1 课视频样片：6 张幻灯片 + edge 旁白 + 字幕 + mp4 / video-web。
//
//   node --experimental-strip-types scripts/media-video.mjs \
//     --workspace C:/Users/Administrator/StudyMate \
//     --subject self-media-product-launch \
//     --node intro.why-content-works \
//     --root C:/Users/Administrator/AppData/Local/Temp/studymate-video
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
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
if (args.help || !args.subject || !args.node) {
  console.log(`用法：node --experimental-strip-types scripts/media-video.mjs --subject <slug> --node <节点id> [选项]
  --workspace <目录>   学习工作区；省略则读配置
  --root <目录>        媒体缓存根；省略则用默认缓存
  --voice <名称>       edge-tts 音色，默认 zh-CN-XiaoxiaoNeural
  --rate <百分比>      语速，默认 +20%
  --renderer <目录>    code-video-showcase 目录
  --no-motion          跳过静态停留段的缓慢推镜
  --no-mp4             只生成 video-web，不渲染 mp4`);
  process.exit(args.help ? 0 : 1);
}

const workspace = typeof args.workspace === 'string' ? args.workspace : resolveWorkspace();
if (!workspace) {
  console.error('找不到学习工作区：给 --workspace，或先跑安装写配置。');
  process.exit(1);
}
const subject = String(args.subject).trim();
const node = String(args.node).trim();
const remoteRoot = typeof args.root === 'string' && args.root.trim() !== '' ? args.root : undefined;
const renderer = typeof args.renderer === 'string' && args.renderer.trim() !== ''
  ? args.renderer
  : 'E:/testsoft/Lumii-data/skills/视频创作/code-video-showcase';
const rendererScript = path.join(renderer, 'templates', 'render-segment.mjs');

function ensure(file) {
  if (!fs.existsSync(file)) throw new Error(`找不到 ${file}`);
}
function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    encoding: 'utf8',
    timeout: options.timeout ?? 300_000,
    windowsHide: true,
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    ...(options.env === undefined ? {} : { env: options.env }),
  });
  if (result.error) throw new Error(`${command} 起不来：${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`${command} 退出码 ${result.status}：${String(result.stderr || result.stdout || '').slice(-1600)}`);
  }
  return result;
}

function concatLine(file) {
  return `file '${path.resolve(file).replace(/\\/g, '/').replace(/'/g, "'\\''")}'`;
}

function srtTime(ms) {
  const total = Math.max(0, Math.round(ms));
  const h = Math.floor(total / 3_600_000);
  const m = Math.floor((total % 3_600_000) / 60_000);
  const s = Math.floor((total % 60_000) / 1000);
  const x = total % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(x).padStart(3, '0')}`;
}

/** 静态停留段：默认做 1.0 → 1.03 的缓慢推镜；失败时回退纯静帧。 */
function encodeStill(still, durationMsValue, out, warnings) {
  const seconds = Math.max(0.1, durationMsValue / 1000);
  const frames = Math.max(1, Math.round(seconds * 24));
  if (!args['no-motion']) {
    const step = (0.03 / frames).toFixed(6);
    const filter = `zoompan=z='min(zoom+${step},1.03)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1920x1080:fps=24`;
    try {
      run('ffmpeg', [
        '-y', '-i', still, '-vf', filter, '-frames:v', String(frames),
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out,
      ]);
      return;
    } catch (error) {
      warnings.push(`缓慢推镜失败，回退静态停留：${error instanceof Error ? error.message : String(error)}`);
    }
  }
  run('ffmpeg', [
    '-y', '-loop', '1', '-i', still, '-t', seconds.toFixed(3),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
    '-pix_fmt', 'yuv420p', '-r', '24', '-movflags', '+faststart', out,
  ]);
}

function sentencesOf(text) {
  return String(text)
    .split(/(?<=[。！？!?；;])/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

function writeSrt(slides, file) {
  const cues = [];
  for (const slide of slides) {
    const sentences = sentencesOf(slide.narration);
    const totalChars = sentences.reduce((sum, sentence) => sum + [...sentence].length, 0) || 1;
    let cursor = slide.startMs;
    for (const sentence of sentences) {
      const share = ([...sentence].length / totalChars) * (slide.endMs - slide.startMs);
      const end = Math.min(slide.endMs, cursor + Math.max(1000, share));
      cues.push({ start: Math.round(cursor), end: Math.round(end), text: sentence });
      cursor = end;
    }
  }
  const body = cues.map((cue, index) => `${index + 1}\n${srtTime(cue.start)} --> ${srtTime(cue.end)}\n${cue.text}\n`).join('\n');
  fs.writeFileSync(file, body, 'utf8');
}

try {
  ensure(rendererScript);
  const plan = media.planLesson({
    workspace,
    subject,
    node,
    ...(remoteRoot === undefined ? {} : { root: remoteRoot }),
  });
  if (!plan.script) {
    console.error('没有生成脚本：');
    for (const error of plan.errors) console.error(`  ${error.file}:${error.line} ${error.message}`);
    process.exit(1);
  }
  if (plan.errors.length > 0 || plan.narrationProblems.length > 0) {
    console.error('脚本/旁白有问题，先修正再生成视频：');
    for (const error of plan.errors) console.error(`  课件 ${error.file}:${error.line} ${error.message}`);
    for (const problem of plan.narrationProblems) console.error(`  旁白 ${problem.file}:${problem.line} ${problem.message}`);
    process.exit(1);
  }

  const outDir = media.productDir({
    workspace,
    subject,
    kind: 'video',
    node,
    ...(remoteRoot === undefined ? {} : { root: remoteRoot }),
  });
  const slidesDir = path.join(outDir, 'slides');
  const audioDir = path.join(outDir, 'audio');
  const rendersDir = path.join(outDir, 'renders');
  const segmentsDir = path.join(outDir, 'segments');
  for (const dir of [outDir, slidesDir, audioDir, rendersDir, segmentsDir]) fs.mkdirSync(dir, { recursive: true });

  const storyboard = media.buildFullStoryboard(plan.script);
  const provider = media.createTtsProvider({
    provider: 'edge',
    ...(typeof args.voice === 'string' && args.voice.trim() !== '' ? { voice: args.voice } : {}),
    ...(typeof args.rate === 'string' && args.rate.trim() !== '' ? { rate: args.rate } : {}),
  });
  console.log(`视频：${storyboard.slides.length} 张幻灯片 · ${provider.name} / ${provider.voice} · ${provider.rate}`);

  const timed = [];
  const audioFiles = [];
  for (let index = 0; index < storyboard.slides.length; index += 1) {
    const slide = storyboard.slides[index];
    const audioFile = path.join(audioDir, `${slide.id}.mp3`);
    let durationMs;
    if (slide.narration.trim() === '') {
      console.log(`  [${index + 1}/${storyboard.slides.length}] ${slide.id} 留白 2.5s`);
      run('ffmpeg', [
        '-y', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono',
        '-t', '2.5', '-c:a', 'libmp3lame', '-b:a', '48k', audioFile,
      ]);
      durationMs = 2500;
    } else {
      console.log(`  [${index + 1}/${storyboard.slides.length}] ${slide.id} 旁白…`);
      const result = await provider.synthesize({ text: slide.narration, output: audioFile });
      durationMs = result.durationMs;
    }
    audioFiles.push(audioFile);
    timed.push({ ...slide, startMs: 0, endMs: durationMs, durationMs, body: media.slideBodyHtml(slide) });
  }

  let cursor = 0;
  for (const slide of timed) {
    slide.startMs = cursor;
    slide.endMs = cursor + slide.durationMs;
    cursor = slide.endMs;
  }
  const durationMs = cursor;

  for (const slide of storyboard.slides) {
    const slidePage = path.join(slidesDir, `${slide.id}.html`);
    fs.writeFileSync(slidePage, media.slidePageHtml(slide), 'utf8');
  }

  const warnings = [];
  console.log('渲染幻灯片…');
  for (const slide of timed) {
    if (slide.animation) {
      const introMs = Math.min(slide.animationIntroMs ?? slide.durationMs, slide.durationMs);
      const animPage = path.join(slidesDir, `${slide.id}.anim.html`);
      fs.writeFileSync(animPage, media.animatedSlidePageHtml(slide, introMs), 'utf8');
      const relativePage = path.relative(outDir, animPage).replace(/\\/g, '/');
      const introSegment = path.join(segmentsDir, `${slide.id}-intro.mp4`);
      run('node', [
        rendererScript,
        '--page', relativePage,
        '--out', introSegment,
        '--duration', (introMs / 1000).toFixed(3),
        '--fps', '24',
        '--crf', '20',
        '--root', outDir,
      ], { cwd: renderer, timeout: 240_000 });
      if (!fs.existsSync(introSegment)) throw new Error(`渲染器没有产出 ${introSegment}`);
      const still = path.join(rendersDir, `${slide.id}.jpg`);
      const seek = Math.max(0.2, Math.min(2, introMs / 1000 - 0.1));
      run('ffmpeg', ['-y', '-ss', seek.toFixed(2), '-i', introSegment, '-frames:v', '1', still]);
      slide.still = still;

      const segment = path.join(segmentsDir, `${slide.id}.mp4`);
      if (introMs < slide.durationMs - 300) {
        const holdMs = slide.durationMs - introMs;
        const hold = path.join(segmentsDir, `${slide.id}-hold.mp4`);
        encodeStill(still, holdMs, hold, warnings);
        const list = path.join(segmentsDir, `${slide.id}-concat.txt`);
        fs.writeFileSync(list, [introSegment, hold].map(concatLine).join('\n') + '\n');
        try {
          run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', segment]);
        } catch (error) {
          run('ffmpeg', [
            '-y', '-f', 'concat', '-safe', '0', '-i', list,
            '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
            '-pix_fmt', 'yuv420p', '-r', '24', '-an', segment,
          ]);
        }
        fs.rmSync(introSegment, { force: true });
        fs.rmSync(hold, { force: true });
        fs.rmSync(list, { force: true });
      } else {
        fs.rmSync(segment, { force: true });
        fs.renameSync(introSegment, segment);
      }
      slide.segment = segment;
    } else {
      const relativePage = path.relative(outDir, path.join(slidesDir, `${slide.id}.html`)).replace(/\\/g, '/');
      const stillDir = path.join(rendersDir, slide.id);
      fs.mkdirSync(stillDir, { recursive: true });
      run('node', [
        rendererScript,
        '--page', relativePage,
        '--still', '0',
        '--outdir', stillDir,
        '--root', outDir,
      ], { cwd: renderer, timeout: 180_000 });
      const still = path.join(stillDir, 'still-0_00.jpg');
      if (!fs.existsSync(still)) throw new Error(`渲染器没有产出 ${still}`);
      slide.still = still;
      const segment = path.join(segmentsDir, `${slide.id}.mp4`);
      encodeStill(still, slide.durationMs, segment, warnings);
      slide.segment = segment;
    }
  }

  const audioList = path.join(outDir, 'audio-list.txt');
  fs.writeFileSync(audioList, audioFiles.map(concatLine).join('\n') + '\n');
  const audioFile = path.join(outDir, 'audio.mp3');
  run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', audioList, '-c', 'copy', audioFile]);

  const subtitleFile = path.join(outDir, 'subtitles.srt');
  writeSrt(timed, subtitleFile);

  const playerFile = path.join(outDir, 'player.html');
  fs.writeFileSync(playerFile, media.videoPlayerHtml({
    title: storyboard.title,
    audioFile: 'audio.mp3',
    slides: timed.map((slide) => ({
      id: slide.id, eyebrow: slide.eyebrow, title: slide.title, narration: slide.narration,
      kind: slide.kind, startMs: slide.startMs, endMs: slide.endMs, body: slide.body,
    })),
    durationMs,
  }), 'utf8');

  const coverFile = path.join(outDir, 'cover.jpg');
  fs.copyFileSync(timed[0].still, coverFile);

  const storyboardFile = path.join(outDir, 'storyboard.json');
  fs.writeFileSync(storyboardFile, JSON.stringify({
    version: 1,
    kind: 'video-storyboard',
    lesson: storyboard.lesson,
    node: storyboard.node,
    title: storyboard.title,
    durationMs,
    slides: timed.map((slide) => ({
      id: slide.id, title: slide.title, narration: slide.narration,
      startMs: slide.startMs, endMs: slide.endMs,
    })),
  }, null, 2) + '\n');

  let videoFile = null;
  if (!args['no-mp4']) {
    console.log('合成 mp4…');
    const segmentList = path.join(outDir, 'segments.txt');
    fs.writeFileSync(segmentList, timed.map((slide) => concatLine(slide.segment)).join('\n') + '\n');
    const silentVideo = path.join(outDir, 'video-silent.mp4');
    try {
      run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', segmentList, '-c', 'copy', silentVideo]);
    } catch (error) {
      warnings.push('分段直接拼接失败，改用重新编码');
      run('ffmpeg', [
        '-y', '-f', 'concat', '-safe', '0', '-i', segmentList,
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
        '-pix_fmt', 'yuv420p', '-r', '24', '-an', silentVideo,
      ]);
    }
    videoFile = path.join(outDir, 'video.mp4');
    const subbed = path.join(outDir, 'video-subtitled.mp4');
    try {
      run('ffmpeg', [
        '-y', '-i', silentVideo, '-i', audioFile, '-i', subtitleFile,
        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k',
        '-c:s', 'mov_text', '-metadata:s:s:0', 'language=chi',
        '-t', (durationMs / 1000).toFixed(3), '-movflags', '+faststart', subbed,
      ]);
      fs.rmSync(videoFile, { force: true });
      fs.renameSync(subbed, videoFile);
    } catch (error) {
      warnings.push(`字幕轨没有合进 mp4：${error instanceof Error ? error.message : String(error)}`);
      run('ffmpeg', [
        '-y', '-i', silentVideo, '-i', audioFile,
        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k',
        '-t', (durationMs / 1000).toFixed(3), '-movflags', '+faststart', videoFile,
      ]);
    }
    fs.rmSync(silentVideo, { force: true });
  } else {
    warnings.push('按 --no-mp4 只生成了 video-web');
  }

  const files = [];
  function addFile(file, role, mime) {
    if (fs.existsSync(file)) files.push({ path: path.basename(file), role, bytes: fs.statSync(file).size, mime });
  }
  addFile(videoFile, 'video', 'video/mp4');
  addFile(playerFile, 'player', 'text/html; charset=utf-8');
  addFile(audioFile, 'audio', 'audio/mpeg');
  addFile(subtitleFile, 'subtitles', 'application/x-subrip');
  addFile(coverFile, 'cover', 'image/jpeg');
  addFile(storyboardFile, 'storyboard', 'application/json; charset=utf-8');

  const manifest = media.makeManifest({
    kind: 'video',
    subject,
    node,
    source: plan.script.source,
    files,
    chapters: timed.map((slide) => ({
      title: slide.title,
      startMs: slide.startMs,
      endMs: slide.endMs,
      sceneId: slide.id,
    })),
    durationMs,
    provider: { name: provider.name, voice: provider.voice, rate: provider.rate },
    warnings,
  });
  const manifestFile = media.writeManifest(outDir, manifest);
  console.log(`播放器：${playerFile}`);
  if (videoFile) console.log(`视频：${videoFile}`);
  console.log(`字幕：${subtitleFile}`);
  console.log(`清单：${manifestFile}`);
  console.log(`时长：${(durationMs / 1000).toFixed(1)}s · ${timed.length} 张幻灯片`);
  for (const warning of warnings) console.log(`  warning: ${warning}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}