/* ─────────────────────────────────────────────────────────────────────────
   StudyMate · 媒体域 —— 课件 → 讲解脚本

   这是三种产物共用的中间表示：音频读 narration，视频读 visuals + narration，
   游戏读 quizAnchors。它不读盘、不渲染、不调模型；调用方把源文件正文递进来。

   关键约定：
     · 场景按课件的 `##` 切；第一个 `##` 之前的段落并入第一场（开场）。
     · narration.md 有对应小节就覆盖自动旁白；没有就退回自动抽取。
     · 代码不逐字朗读，公式说「看这个公式」，题目只说「回到阅读端做」。
     · 任何格式错误都原样带回，不静默吞掉。
   ───────────────────────────────────────────────────────────────────────── */

import { FormatProblems } from '../core/format.ts';
import type { Block, FormatError, FormatNote, ListItem } from '../core/format.ts';
import { parseLesson, poolJsonError } from '../core/lesson.ts';
import type { NarrationParseResult, NarrationProblem } from './narration.ts';
import { parseNarration, validateNarration } from './narration.ts';
import { estimateSpeechSeconds, validateAudioOnly } from './audio-rules.ts';
import type { AudioProblem } from './audio-rules.ts';
import { hashText } from './paths.ts';

export type LessonVisualType =
  | 'title' | 'heading' | 'paragraph' | 'list' | 'code' | 'table'
  | 'figure' | 'svg' | 'card' | 'practice' | 'links' | 'quiz';

export interface LessonVisual {
  type: LessonVisualType;
  level?: number;
  text?: string;
  items?: string[];
  ordered?: boolean;
  lang?: string;
  header?: string[];
  rows?: string[][];
  src?: string;
  alt?: string;
  caption?: string;
  raw?: string;
  title?: string;
  variant?: 'tip' | 'warn' | 'note';
  body?: string;
}

export interface LessonScene {
  id: string;
  heading: string;
  narration: string;
  /** Breeze 等支持自然语言语气的 provider 用；edge / native 忽略。 */
  instruction?: string;
  visuals: LessonVisual[];
  quizAnchors: string[];
  estimatedSeconds: number;
}

export interface LessonScriptSource {
  lesson: string;
  quiz?: string;
  narration?: string;
  lessonSha256: string;
  quizSha256?: string;
  narrationSha256?: string;
}

export interface LessonScript {
  version: 1;
  kind: 'lesson-script';
  subject: string;
  node: string;
  title: string;
  goal: string;
  language: string;
  source: LessonScriptSource;
  scenes: LessonScene[];
}

export interface BuildLessonScriptOptions {
  subject: string;
  node: string;
  lessonSource: string;
  lessonFile: string;
  quizSource?: string;
  quizFile?: string;
  narrationSource?: string;
  narrationFile?: string;
  outlineTitle?: string;
  language?: string;
}

export interface BuildLessonScriptResult {
  script: LessonScript | null;
  errors: FormatError[];
  notes: FormatNote[];
  narrationProblems: NarrationProblem[];
  audioProblems: AudioProblem[];
}

const CJK_RE = /[　-〿㐀-䶿一-鿿豈-﫿＀-￯]/;

/** 把正文里的行内标记剥成可朗读的文字；代码与公式不念原文。 */
export function plainText(markdown: string): string {
  return String(markdown)
    .replace(/\$\$[\s\S]*?\$\$/g, '公式')
    .replace(/\$[^$\n]+\$/g, '公式')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\^([^^]+)\^/g, '$1')
    .replace(/~([^~]+)~/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function joinSpeech(parts: string[]): string {
  return parts.map((part) => part.trim()).filter(Boolean).join('\n');
}

function listTexts(items: ListItem[]): string[] {
  const out: string[] = [];
  for (const item of items) {
    out.push(item.text);
    if (item.children) {
      if (item.children.kind === 'ul' || item.children.kind === 'ol') {
        out.push(...listTexts(item.children.items));
      }
    }
  }
  return out;
}

function bodyText(blocks: Block[]): string {
  const parts: string[] = [];
  for (const block of blocks) {
    if (block.kind === 'p') parts.push(plainText(block.text));
    else if (block.kind === 'ul' || block.kind === 'ol') {
      parts.push(...listTexts(block.items).map(plainText));
    }
  }
  return joinSpeech(parts);
}

interface BlockSpeech {
  visuals: LessonVisual[];
  narration: string[];
  quizAnchors: string[];
}

function blockSpeech(block: Block): BlockSpeech {
  switch (block.kind) {
    case 'h2':
      return {
        visuals: [{ type: 'heading', level: 2, text: block.text }],
        narration: [plainText(block.text)],
        quizAnchors: [],
      };
    case 'h3':
      return {
        visuals: [{ type: 'heading', level: 3, text: block.text }],
        narration: [plainText(block.text)],
        quizAnchors: [],
      };
    case 'p':
      return {
        visuals: [{ type: 'paragraph', text: block.text }],
        narration: [plainText(block.text)],
        quizAnchors: [],
      };
    case 'code':
      return {
        visuals: [{ type: 'code', lang: block.lang, text: block.text }],
        narration: ['看这段代码。'],
        quizAnchors: [],
      };
    case 'table':
      return {
        visuals: [{ type: 'table', header: block.header, rows: block.rows }],
        narration: ['看这张表。'],
        quizAnchors: [],
      };
    case 'ul':
    case 'ol': {
      const items = listTexts(block.items);
      return {
        visuals: [{ type: 'list', ordered: block.kind === 'ol', items }],
        narration: items.map(plainText),
        quizAnchors: [],
      };
    }
    case 'directive':
      switch (block.name) {
        case 'quiz':
          return {
            visuals: [{ type: 'quiz', text: block.anchor }],
            narration: [],
            quizAnchors: [block.anchor],
          };
        case 'figure':
          return {
            visuals: [{
              type: 'figure', src: block.src, alt: block.alt, caption: block.caption,
            }],
            narration: [block.caption || block.alt || '看这张图。'],
            quizAnchors: [],
          };
        case 'svg':
          return {
            visuals: [{
              type: 'svg', raw: block.raw, alt: block.alt, caption: block.caption,
            }],
            narration: [block.caption || block.alt || '看这张示意图。'],
            quizAnchors: [],
          };
        case 'code':
          return {
            visuals: [{
              type: 'code', lang: block.lang, text: block.text,
              ...(block.alt ? { alt: block.alt } : {}),
              ...(block.caption ? { caption: block.caption } : {}),
            }],
            narration: ['看这段代码。'],
            quizAnchors: [],
          };
        case 'practice': {
          const body = bodyText(block.body);
          return {
            visuals: [{
              type: 'practice', title: block.title, body,
            }],
            narration: [`这一节有一个动手练习：${block.title}。`, body],
            quizAnchors: [],
          };
        }
        case 'tip':
        case 'warn':
        case 'note': {
          const body = bodyText(block.body);
          return {
            visuals: [{
              type: 'card', variant: block.name, title: block.title, body,
            }],
            narration: [block.title, body],
            quizAnchors: [],
          };
        }
        case 'resources':
        case 'related':
          return {
            visuals: [{ type: 'links', items: block.items.map((item) => item.title) }],
            narration: ['这一节附了资料清单。'],
            quizAnchors: [],
          };
        default:
          return { visuals: [], narration: [], quizAnchors: [] };
      }
    default:
      return { visuals: [], narration: [], quizAnchors: [] };
  }
}

interface SceneDraft {
  heading: string;
  line: number;
  blocks: Block[];
}

function splitScenes(blocks: Block[], title: string): SceneDraft[] {
  const drafts: SceneDraft[] = [];
  const preamble: Block[] = [];
  let current: SceneDraft | null = null;

  for (const block of blocks) {
    if (block.kind === 'h2') {
      current = { heading: block.text, line: block.line, blocks: [] };
      drafts.push(current);
      continue;
    }
    if (!current) {
      preamble.push(block);
      continue;
    }
    current.blocks.push(block);
  }

  if (drafts.length === 0) return [{ heading: title, line: 1, blocks: preamble }];
  if (preamble.length > 0) drafts[0].blocks = [...preamble, ...drafts[0].blocks];
  return drafts;
}

function narrationFor(
  heading: string,
  deterministic: string,
  anchors: string[],
  narration: NarrationParseResult | null,
): { text: string; instruction?: string } {
  const override = narration?.sections.find((section) => section.heading === heading);
  let text = override ? override.text : deterministic;
  if (text.trim() === '') text = `${heading}。`;
  if (anchors.length > 0) text = `${text}\n\n这一节有一道题，回到阅读端做一下。`;
  const instruction = (override?.instruction ?? narration?.instruction ?? '').trim();
  return {
    text: text.trim(),
    ...(instruction === '' ? {} : { instruction }),
  };
}

export function buildLessonScript(
  options: BuildLessonScriptOptions,
): BuildLessonScriptResult {
  const problems = new FormatProblems();

  // 题库先解析：坏 JSON 是确定性错误，不能假装「还没出题」。
  let quiz: Record<string, unknown[]> | null = null;
  if (options.quizSource !== undefined) {
    try {
      const parsed: unknown = JSON.parse(options.quizSource);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('题库结构应为 {"锚点文本": [题, …]}（最外层是对象）');
      }
      quiz = parsed as Record<string, unknown[]>;
    } catch (error) {
      poolJsonError(options.quizSource, error, options.quizFile ?? '题库', problems);
      return {
        script: null,
        errors: problems.errors,
        notes: problems.notes,
        narrationProblems: [],
        audioProblems: [],
      };
    }
  }

  const parsedLesson = parseLesson(options.lessonSource, options.lessonFile, {
    pool: quiz,
    poolFile: options.quizFile,
    poolPresent: options.quizSource !== undefined,
    poolRaw: options.quizSource,
    // title 与大纲一致由调用方给；这里只做能做的部分。
    outlineTitle: options.outlineTitle,
  });

  const lessonTitle = parsedLesson.frontMatter?.title
    ?? options.outlineTitle
    ?? options.node;

  const narration = options.narrationSource === undefined
    ? null
    : parseNarration(options.narrationSource, options.narrationFile ?? 'narration.md');

  const lessonHeadings = parsedLesson.blocks
    .filter((block): block is Extract<Block, { kind: 'h2' }> => block.kind === 'h2')
    .map((block) => block.text);

  const narrationProblems: NarrationProblem[] = narration
    ? validateNarration(narration, {
      lessonHeadings,
      lessonTitle,
      file: options.narrationFile ?? 'narration.md',
    })
    : [];

  const drafts = splitScenes(parsedLesson.blocks, lessonTitle);
  const scenes: LessonScene[] = drafts.map((draft, index) => {
    const visuals: LessonVisual[] = [];
    const narrationParts: string[] = [];
    const anchors: string[] = [];

    if (index === 0) visuals.push({ type: 'title', text: lessonTitle });
    visuals.push({ type: 'heading', level: 2, text: draft.heading });

    for (const block of draft.blocks) {
      const speech = blockSpeech(block);
      visuals.push(...speech.visuals);
      narrationParts.push(...speech.narration);
      anchors.push(...speech.quizAnchors);
    }

    const deterministic = joinSpeech(narrationParts);
    const speech = narrationFor(draft.heading, deterministic, anchors, narration);
    return {
      id: `s${index + 1}`,
      heading: draft.heading,
      narration: speech.text,
      ...(speech.instruction === undefined ? {} : { instruction: speech.instruction }),
      visuals,
      quizAnchors: anchors,
      estimatedSeconds: estimateSpeechSeconds(speech.text),
    };
  });

  const script: LessonScript = {
    version: 1,
    kind: 'lesson-script',
    subject: options.subject,
    node: options.node,
    title: lessonTitle,
    goal: parsedLesson.frontMatter?.goal ?? '',
    language: options.language ?? 'zh-CN',
    source: {
      lesson: options.lessonFile,
      ...(options.quizFile === undefined ? {} : { quiz: options.quizFile }),
      ...(options.narrationFile === undefined ? {} : { narration: options.narrationFile }),
      lessonSha256: hashText(options.lessonSource),
      ...(options.quizSource === undefined ? {} : { quizSha256: hashText(options.quizSource) }),
      ...(options.narrationSource === undefined
        ? {}
        : { narrationSha256: hashText(options.narrationSource) }),
    },
    scenes,
  };

  const audioProblems = validateAudioOnly(scenes, {
    file: options.narrationFile ?? options.lessonFile,
  });

  return {
    script,
    errors: parsedLesson.errors,
    notes: parsedLesson.notes,
    narrationProblems,
    audioProblems,
  };
}
