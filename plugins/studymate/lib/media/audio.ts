/* ─────────────────────────────────────────────────────────────────────────
   StudyMate · 媒体域 —— 场景旁白 → 音频产物

   顺序固定：旁白文本 → 每场 TTS → 实际时长 → chapter / transcript / manifest。
   chapter 用 TTS 的真实时长，不用文本估算；读不到时长才退回估算并记 warning。
   多场拼接才需要 ffmpeg；单场试听不依赖 ffmpeg。
   ───────────────────────────────────────────────────────────────────────── */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { makeManifest, writeManifest } from './manifest.ts';
import type { MediaChapter, MediaFile, MediaManifest } from './manifest.ts';
import { writeFileAtomic } from './paths.ts';
import { PLAYER_FILE, writePlayer } from './player.ts';
import type { LessonScript } from './script.ts';
import type { TtsProvider } from './tts.ts';

export interface SynthesizeScenesOptions {
  script: LessonScript;
  outDir: string;
  provider: TtsProvider;
  /** 只合成这些场景（id，如 `s1`）；省略 = 全部。 */
  sceneIds?: string[];
}

export interface SynthesizeScenesResult {
  manifest: MediaManifest;
  manifestFile: string;
  audioFile: string;
  transcriptFile: string;
  chaptersFile: string;
  playerFile: string;
  durationMs: number;
  warnings: string[];
}

interface SynthesizedScene {
  scene: LessonScript['scenes'][number];
  file: string;
  mime: string;
  durationMs: number;
  warnings: string[];
}

function concatWithFfmpeg(items: SynthesizedScene[], outFile: string): string[] {
  const warnings: string[] = [];
  const listFile = path.join(path.dirname(outFile), 'concat.txt');
  const lines = items
    .map((item) => `file '${item.file.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`)
    .join('\n');
  fs.writeFileSync(listFile, lines + '\n');

  const baseArgs = ['-y', '-f', 'concat', '-safe', '0', '-i', listFile];
  const first = spawnSync(
    'ffmpeg',
    [...baseArgs, '-c', 'copy', outFile],
    { encoding: 'utf8', timeout: 300_000, windowsHide: true },
  );
  if (first.error) {
    fs.rmSync(listFile, { force: true });
    throw new Error(`找不到 ffmpeg：多场音频拼接需要它（单场试听不需要）。${first.error.message}`);
  }
  if (first.status === 0) {
    fs.rmSync(listFile, { force: true });
    return warnings;
  }

  warnings.push('音频直接拼接失败，改用重新编码');
  const retry = spawnSync(
    'ffmpeg',
    [...baseArgs, '-c:a', 'libmp3lame', '-q:a', '4', outFile],
    { encoding: 'utf8', timeout: 300_000, windowsHide: true },
  );
  fs.rmSync(listFile, { force: true });
  if (retry.error) throw new Error(`找不到 ffmpeg：${retry.error.message}`);
  if (retry.status !== 0) {
    throw new Error(`ffmpeg 音频拼接失败：${String(retry.stderr ?? '').slice(-2000)}`);
  }
  return warnings;
}

/**
 * 合成一组场景。`outDir` 下会得到：音频（lesson.<ext>）、transcript.md、
 * chapters.json、manifest.json。调用方负责把 outDir 选在媒体缓存或临时目录。
 */
export async function synthesizeScenes(
  options: SynthesizeScenesOptions,
): Promise<SynthesizeScenesResult> {
  const { script, outDir, provider } = options;
  const wanted = options.sceneIds === undefined ? null : new Set(options.sceneIds);
  if (wanted) {
    for (const id of wanted) {
      if (!script.scenes.some((scene) => scene.id === id)) {
        throw new Error(`脚本里没有场景 ${id}；可用的是 ${script.scenes.map((scene) => scene.id).join('、')}`);
      }
    }
  }
  const scenes = script.scenes.filter((scene) => wanted === null || wanted.has(scene.id));
  if (scenes.length === 0) throw new Error('没有选中任何场景');

  fs.mkdirSync(outDir, { recursive: true });
  const synthesized: SynthesizedScene[] = [];

  for (const scene of scenes) {
    const output = path.join(outDir, `${scene.id}${provider.extension}`);
    const result = await provider.synthesize({
      text: scene.narration,
      output,
      ...(scene.instruction === undefined ? {} : { instruction: scene.instruction }),
    });
    synthesized.push({
      scene,
      file: result.file,
      mime: result.mime,
      durationMs: result.durationMs,
      warnings: result.warnings,
    });
  }

  let audioFile: string;
  let audioMime: string;
  const warnings = synthesized.flatMap((item) => item.warnings);

  if (synthesized.length === 1) {
    const item = synthesized[0];
    const ext = path.extname(item.file) || '.mp3';
    audioFile = path.join(outDir, `lesson${ext}`);
    audioMime = item.mime;
    if (path.resolve(item.file) !== path.resolve(audioFile)) {
      fs.copyFileSync(item.file, audioFile);
      fs.rmSync(item.file, { force: true });
    }
  } else {
    audioFile = path.join(outDir, 'lesson.mp3');
    audioMime = 'audio/mpeg';
    warnings.push(...concatWithFfmpeg(synthesized, audioFile));
    for (const item of synthesized) fs.rmSync(item.file, { force: true });
  }

  let cursor = 0;
  const chapters: MediaChapter[] = synthesized.map((item) => {
    const chapter: MediaChapter = {
      title: item.scene.heading,
      startMs: cursor,
      endMs: cursor + item.durationMs,
      sceneId: item.scene.id,
    };
    cursor += item.durationMs;
    return chapter;
  });

  const transcriptParts = [`# ${script.title}`, ''];
  if (script.goal) transcriptParts.push(`> ${script.goal}`, '');
  for (const item of synthesized) {
    transcriptParts.push(`## ${item.scene.heading}`, '', item.scene.narration, '');
  }
  const transcriptFile = path.join(outDir, 'transcript.md');
  const chaptersFile = path.join(outDir, 'chapters.json');
  writeFileAtomic(transcriptFile, transcriptParts.join('\n').trimEnd() + '\n');
  writeFileAtomic(chaptersFile, JSON.stringify(chapters, null, 2) + '\n');

  const files: MediaFile[] = [
    {
      path: path.basename(audioFile),
      role: 'audio',
      bytes: fs.statSync(audioFile).size,
      mime: audioMime,
    },
    {
      path: path.basename(transcriptFile),
      role: 'transcript',
      bytes: fs.statSync(transcriptFile).size,
      mime: 'text/markdown',
    },
    {
      path: path.basename(chaptersFile),
      role: 'chapters',
      bytes: fs.statSync(chaptersFile).size,
      mime: 'application/json',
    },
  ];

  const manifest = makeManifest({
    kind: 'audio',
    subject: script.subject,
    node: script.node,
    source: script.source,
    files,
    chapters,
    durationMs: cursor,
    provider: { name: provider.name, voice: provider.voice, rate: provider.rate },
    warnings,
  });

  const playerFile = writePlayer(outDir, { script, manifest, audioFile, transcriptFile });
  manifest.files.push({
    path: PLAYER_FILE,
    role: 'player',
    bytes: fs.statSync(playerFile).size,
    mime: 'text/html',
  });
  const manifestFile = writeManifest(outDir, manifest);

  return {
    manifest,
    manifestFile,
    audioFile,
    transcriptFile,
    chaptersFile,
    playerFile,
    durationMs: cursor,
    warnings,
  };
}
