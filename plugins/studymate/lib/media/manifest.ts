/* ─────────────────────────────────────────────────────────────────────────
   StudyMate · 媒体域 —— 产物清单

   manifest 是「这份产物从哪来、里面有什么、还新不新鲜」的唯一记录。
   源文件哈希是 stale 判定的全部依据：不比较时间戳，避免「刚打开就算新」的假象。
   ───────────────────────────────────────────────────────────────────────── */

import path from 'node:path';

import { hashText, readJsonIfPresent, writeFileAtomic } from './paths.ts';

export const MEDIA_MANIFEST_FILE = 'manifest.json';
export const MEDIA_GENERATOR = 'studymate/media-0.1';

export type MediaKind = 'audio' | 'video' | 'game';

export interface MediaSource {
  lesson?: string;
  quiz?: string;
  narration?: string;
  lessonSha256?: string;
  quizSha256?: string;
  narrationSha256?: string;
  curriculumSha256?: string;
  lessons?: { node: string; lessonSha256: string; quizSha256?: string }[];
}

export interface MediaFile {
  path: string;
  role: string;
  bytes: number;
  mime: string;
}

export interface MediaChapter {
  title: string;
  startMs: number;
  endMs: number;
  sceneId: string;
}

export interface MediaManifest {
  version: 1;
  kind: MediaKind;
  subject: string;
  node?: string;
  createdAt: string;
  generator: string;
  source: MediaSource;
  files: MediaFile[];
  chapters?: MediaChapter[];
  durationMs?: number;
  provider?: Record<string, unknown>;
  warnings: string[];
}

export interface SourceTexts {
  lesson?: string;
  quiz?: string;
  narration?: string;
}

/** 从源文件正文算哈希；只有给了正文的那几项才出现在结果里。 */
export function sourceHashes(texts: SourceTexts): Pick<
  MediaSource, 'lessonSha256' | 'quizSha256' | 'narrationSha256'
> {
  return {
    ...(texts.lesson === undefined ? {} : { lessonSha256: hashText(texts.lesson) }),
    ...(texts.quiz === undefined ? {} : { quizSha256: hashText(texts.quiz) }),
    ...(texts.narration === undefined ? {} : { narrationSha256: hashText(texts.narration) }),
  };
}

/**
 * 产物是否过期。
 * - 当前源文件给了正文：哈希不同即 stale。
 * - 当前源文件没了：manifest 里记着的那一项哈希还在，也判 stale（源被删了）。
 * - manifest 没记某一项哈希、当前却提供了那一项：也判 stale（清单不完整）。
 */
export function isStale(manifest: MediaManifest, texts: SourceTexts): boolean {
  const pairs: [keyof SourceTexts, keyof MediaSource][] = [
    ['lesson', 'lessonSha256'],
    ['quiz', 'quizSha256'],
    ['narration', 'narrationSha256'],
  ];
  for (const [textKey, hashKey] of pairs) {
    const text = texts[textKey];
    const recorded = manifest.source[hashKey];
    if (text === undefined) {
      if (typeof recorded === 'string') return true;
      continue;
    }
    if (typeof recorded !== 'string') return true;
    if (hashText(text) !== recorded) return true;
  }
  return false;
}

export function manifestPath(dir: string): string {
  return path.join(dir, MEDIA_MANIFEST_FILE);
}

export function readManifest(dir: string): MediaManifest | null {
  return readJsonIfPresent<MediaManifest>(manifestPath(dir));
}

export function writeManifest(dir: string, manifest: MediaManifest): string {
  const file = manifestPath(dir);
  writeFileAtomic(file, JSON.stringify(manifest, null, 2) + '\n');
  return file;
}

export interface ManifestInit {
  kind: MediaKind;
  subject: string;
  node?: string;
  source: MediaSource;
  files: MediaFile[];
  chapters?: MediaChapter[];
  durationMs?: number;
  provider?: Record<string, unknown>;
  warnings?: string[];
}

export function makeManifest(init: ManifestInit): MediaManifest {
  return {
    version: 1,
    kind: init.kind,
    subject: init.subject,
    ...(init.node === undefined ? {} : { node: init.node }),
    createdAt: new Date().toISOString(),
    generator: MEDIA_GENERATOR,
    source: init.source,
    files: init.files,
    ...(init.chapters === undefined ? {} : { chapters: init.chapters }),
    ...(init.durationMs === undefined ? {} : { durationMs: init.durationMs }),
    ...(init.provider === undefined ? {} : { provider: init.provider }),
    warnings: init.warnings ?? [],
  };
}
