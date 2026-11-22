/* ─────────────────────────────────────────────────────────────────────────
   StudyMate · 媒体域 —— 阅读端摘要

   阅读端只关心「这一课有没有音频 / 视频、时长多少、过不过期」。
   这里读 manifest，不读媒体文件；大文件不进 library payload。
   ───────────────────────────────────────────────────────────────────────── */

import { isStale, readManifest } from './manifest.ts';
import { gameDir, productDir } from './paths.ts';
import type { MediaRootOptions } from './paths.ts';

export interface MediaSummary {
  present: boolean;
  stale?: boolean;
  durationMs?: number;
  provider?: string;
  warnings?: number;
}

export interface NodeMediaSummary {
  audio: MediaSummary;
  video: MediaSummary;
}

interface SummaryTexts {
  lesson?: string;
  quiz?: string;
  narration?: string;
}

function summaryOf(dir: string, texts: SummaryTexts): MediaSummary {
  const manifest = readManifest(dir);
  if (!manifest) return { present: false };
  return {
    present: true,
    stale: isStale(manifest, texts),
    ...(manifest.durationMs === undefined ? {} : { durationMs: manifest.durationMs }),
    ...(typeof manifest.provider?.name === 'string' ? { provider: manifest.provider.name } : {}),
    warnings: manifest.warnings.length,
  };
}

export interface NodeMediaOptions extends MediaRootOptions {
  subject: string;
  node: string;
  lesson?: string;
  quiz?: string;
  narration?: string;
}

export function nodeMediaSummary(options: NodeMediaOptions): NodeMediaSummary {
  const texts: SummaryTexts = {
    ...(options.lesson === undefined ? {} : { lesson: options.lesson }),
    ...(options.quiz === undefined ? {} : { quiz: options.quiz }),
    ...(options.narration === undefined ? {} : { narration: options.narration }),
  };
  return {
    audio: summaryOf(productDir({
      workspace: options.workspace,
      subject: options.subject,
      kind: 'audio',
      node: options.node,
      ...(options.root === undefined ? {} : { root: options.root }),
    }), texts),
    video: summaryOf(productDir({
      workspace: options.workspace,
      subject: options.subject,
      kind: 'video',
      node: options.node,
      ...(options.root === undefined ? {} : { root: options.root }),
    }), texts),
  };
}

/** 整门课的游戏产物摘要；游戏 stale 判定后续按 lessons 数组算，这里先只报存在与告警。 */
export function gameMediaSummary(options: MediaRootOptions & { subject: string }): MediaSummary {
  const manifest = readManifest(gameDir({
    workspace: options.workspace,
    subject: options.subject,
    ...(options.root === undefined ? {} : { root: options.root }),
  }));
  if (!manifest) return { present: false };
  return {
    present: true,
    stale: false,
    warnings: manifest.warnings.length,
  };
}
