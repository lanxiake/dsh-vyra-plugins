/* ─────────────────────────────────────────────────────────────────────────
   StudyMate · 媒体域 —— 目录出口

   Phase 0 只做「课件 → 讲解脚本」这一段：不生成音频、不渲染视频、不改阅读端。
   入口 planLesson 读一节课的三份源文件，写 `<mediaRoot>/<subject>/script/<node>.json`，
   返回解析错误与旁白对齐问题，供调用方决定是否阻断。
   ───────────────────────────────────────────────────────────────────────── */

import fs from 'node:fs';
import path from 'node:path';

import { buildLessonScript } from './script.ts';
import type {
  BuildLessonScriptResult, LessonScript, LessonScene, LessonVisual, LessonVisualType,
} from './script.ts';
import type { FormatError, FormatNote } from '../core/format.ts';
import type { NarrationProblem } from './narration.ts';
import { readTextIfPresent, scriptDir, writeFileAtomic } from './paths.ts';

export * from './paths.ts';
export * from './manifest.ts';
export * from './narration.ts';
export * from './script.ts';
export * from './tts.ts';
export * from './audio.ts';
export * from './audio-rules.ts';
export * from './player.ts';
export * from './summary.ts';
export * from './game.ts';
export * from './game-html.ts';
export * from './video-sample.ts';
export type {
  BuildLessonScriptResult, LessonScript, LessonScene, LessonVisual, LessonVisualType,
  FormatError, FormatNote, NarrationProblem,
};

export interface LessonFiles {
  lessonName: string;
  quizName: string;
  narrationName: string;
  lessonPath: string;
  quizPath: string;
  narrationPath: string;
  lessonSource: string;
  quizSource?: string;
  narrationSource?: string;
}

/** 课件名是 <序号>-<节点id>.md；narration 是 .narration.md，不能混进主课件列表。 */
export function findLessonFiles(lessonsDir: string, node: string): LessonFiles | null {
  let names: string[];
  try {
    names = fs.readdirSync(lessonsDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && !entry.name.endsWith('.narration.md'))
      .map((entry) => entry.name)
      .sort();
  } catch {
    return null;
  }
  const lessonName = names.find((name) => name.slice(0, -3).endsWith(`-${node}`));
  if (lessonName === undefined) return null;

  const lessonPath = path.join(lessonsDir, lessonName);
  const lessonSource = readTextIfPresent(lessonPath);
  if (lessonSource === null) return null;

  const quizName = lessonName.replace(/\.md$/, '.quiz.json');
  const narrationName = lessonName.replace(/\.md$/, '.narration.md');
  const quizPath = path.join(lessonsDir, quizName);
  const narrationPath = path.join(lessonsDir, narrationName);
  const quizSource = readTextIfPresent(quizPath);
  const narrationSource = readTextIfPresent(narrationPath);

  return {
    lessonName,
    quizName,
    narrationName,
    lessonPath,
    quizPath,
    narrationPath,
    lessonSource,
    ...(quizSource === null ? {} : { quizSource }),
    ...(narrationSource === null ? {} : { narrationSource }),
  };
}

export interface PlanLessonOptions {
  workspace: string;
  subject: string;
  node: string;
  /** 默认 `<workspace>/.learning/subjects/<subject>/lessons`。 */
  lessonsDir?: string;
  /** 显式媒体根（测试用）；省略时按配置 / 环境 / 默认缓存。 */
  root?: string;
  language?: string;
  outlineTitle?: string;
  /** 临时旁白覆盖（试听 / 预览用）；省略时读 lessons/ 下同名 .narration.md。 */
  narrationSource?: string;
  narrationFile?: string;
}

export interface PlanLessonResult extends BuildLessonScriptResult {
  /** 写出的脚本文件；题库坏 JSON 等情况下为空串。 */
  outputFile: string;
}

/** 只规划：读源文件、生成脚本、写 JSON。不调 TTS、不渲染。 */
export function planLesson(options: PlanLessonOptions): PlanLessonResult {
  const lessonsDir = options.lessonsDir ?? path.join(
    options.workspace, '.learning', 'subjects', options.subject, 'lessons',
  );
  const files = findLessonFiles(lessonsDir, options.node);
  if (!files) {
    throw new Error(`找不到节点 ${options.node} 的课件：${lessonsDir}`);
  }

  const narrationSource = options.narrationSource ?? files.narrationSource;
  const narrationFile = options.narrationSource === undefined
    ? files.narrationName
    : options.narrationFile ?? path.basename(options.narrationSource);
  const result = buildLessonScript({
    subject: options.subject,
    node: options.node,
    lessonSource: files.lessonSource,
    lessonFile: files.lessonName,
    ...(files.quizSource === undefined
      ? {}
      : { quizSource: files.quizSource, quizFile: files.quizName }),
    ...(narrationSource === undefined
      ? {}
      : { narrationSource, narrationFile }),
    ...(options.outlineTitle === undefined ? {} : { outlineTitle: options.outlineTitle }),
    ...(options.language === undefined ? {} : { language: options.language }),
  });

  if (!result.script) return { ...result, outputFile: '' };

  const dir = scriptDir({ workspace: options.workspace, subject: options.subject, root: options.root });
  const outputFile = path.join(dir, `${options.node}.json`);
  writeFileAtomic(outputFile, JSON.stringify(result.script, null, 2) + '\n');
  return { ...result, outputFile };
}

/** 读回已生成的脚本（诊断 / 后续产物共用）。 */
export function readLessonScript(
  options: { workspace: string; subject: string; node: string; root?: string },
): LessonScript | null {
  const file = path.join(
    scriptDir({ workspace: options.workspace, subject: options.subject, root: options.root }),
    `${options.node}.json`,
  );
  const text = readTextIfPresent(file);
  if (text === null) return null;
  return JSON.parse(text) as LessonScript;
}
