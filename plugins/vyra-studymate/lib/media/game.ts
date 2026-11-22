/* ─────────────────────────────────────────────────────────────────────────
   StudyMate · 媒体域 —— 互动游戏关卡

   输入：curriculum.yaml + 每个节点的 .quiz.json + 作答版本号。
   输出：game.json（关卡 / 题目 / 解锁顺序 / attemptsVersion）+ 自包含 index.html。

   只收**已经有题库**的节点；没有题库的节点跳过并记 warning。题目仍归 practice-evaluator，
   这里只搬运，不改题面、不改答案。
   ───────────────────────────────────────────────────────────────────────── */

import fs from 'node:fs';
import path from 'node:path';

import { attemptsVersion } from '../attempts.ts';
import { parseYaml } from '../yaml.ts';
import { buildGameHtml } from './game-html.ts';
import { buildWorkshopHtml } from './workshop-html.ts';
import { makeManifest, writeManifest } from './manifest.ts';
import { gameDir, hashText, readTextIfPresent, writeFileAtomic } from './paths.ts';

export const GAME_DATA_FILE = 'game.json';
export const GAME_INDEX_FILE = 'index.html';
export const GAME_LIBRARY_ENDPOINT = '/api/studymate/library';
export const GAME_ATTEMPTS_ENDPOINT = '/api/studymate/attempts';

export type GameQuestionKind = '客观题' | '预测验证' | '开放题' | '交付物';

export interface GameQuestion {
  id: string;
  anchor: string;
  kind: GameQuestionKind;
  q: string;
  opts?: string[];
  ans?: number;
  why?: string;
  answer?: string;
  criteria?: string;
  predicted?: string;
  compare?: string;
  deliverable?: string;
  evidence?: string;
}

export interface GameLevel {
  id: string;
  title: string;
  number: string;
  kind: string;
  objective: string;
  prerequisites: string[];
  attemptsVersion: string;
  questions: GameQuestion[];
}

export interface GameSpec {
  version: 1;
  kind: 'game';
  subject: string;
  title: string;
  generatedAt: string;
  libraryEndpoint: string;
  attemptsEndpoint: string;
  /** 试点课的工作坊切片；以后由 lesson 下的 workshop 文件决定。 */
  workshop?: { title: string; file: string };
  levels: GameLevel[];
  warnings: string[];
}

export interface GameSource {
  node: string;
  lessonSha256: string;
  quizSha256: string;
}

export interface BuildGameResult {
  spec: GameSpec;
  sources: GameSource[];
  curriculumSha256: string;
  warnings: string[];
}

export interface BuildGameOptions {
  workspace: string;
  subject: string;
}

export interface WriteGameResult extends BuildGameResult {
  indexFile: string;
  dataFile: string;
  manifestFile: string;
  workshopFile?: string;
}

function readYamlObject(file: string): Record<string, unknown> {
  const text = readTextIfPresent(file);
  if (text === null) return {};
  try {
    const parsed = parseYaml(text, { file });
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function findLessonName(lessonsDir: string, node: string): string | null {
  let names: string[];
  try {
    names = fs.readdirSync(lessonsDir)
      .filter((name) => name.endsWith('.md') && !name.endsWith('.narration.md'))
      .sort();
  } catch {
    return null;
  }
  return names.find((name) => name.slice(0, -3).endsWith(`-${node}`)) ?? null;
}

function inferKind(item: Record<string, unknown>): GameQuestionKind | null {
  const declared = item.kind;
  if (declared === '客观题' || declared === '预测验证' || declared === '开放题' || declared === '交付物') {
    return declared;
  }
  if (Array.isArray(item.opts) && Number.isInteger(item.ans)) return '客观题';
  if (typeof item.answer === 'string' || typeof item.criteria === 'string') return '开放题';
  if (typeof item.交付物 === 'string' || typeof item.证据 === 'string') return '交付物';
  if (typeof item.预测 === 'string' || typeof item.比对 === 'string') return '预测验证';
  return null;
}

function textOf(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeQuestion(
  item: unknown,
  anchor: string,
  index: number,
): GameQuestion | null {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const record = item as Record<string, unknown>;
  const q = textOf(record.q);
  if (q === '') return null;
  const kind = inferKind(record);
  if (kind === null) return null;
  const id = `${anchor}#${index}`;
  const common = {
    id, anchor, kind, q,
    ...(textOf(record.criteria) === '' ? {} : { criteria: textOf(record.criteria) }),
  };

  if (kind === '客观题') {
    const opts = Array.isArray(record.opts)
      ? record.opts.map((opt) => textOf(opt)).filter(Boolean)
      : [];
    const ans = record.ans;
    if (opts.length < 2 || !Number.isInteger(ans) || (ans as number) < 0 || (ans as number) >= opts.length) {
      return null;
    }
    return {
      ...common,
      opts,
      ans: ans as number,
      ...(textOf(record.why) === '' ? {} : { why: textOf(record.why) }),
    };
  }

  if (kind === '开放题') {
    const answer = textOf(record.answer);
    if (answer === '' && common.criteria === undefined) return null;
    return { ...common, ...(answer === '' ? {} : { answer }) };
  }

  if (kind === '交付物') {
    const deliverable = textOf(record.交付物);
    const evidence = textOf(record.证据);
    if (deliverable === '' && evidence === '') return null;
    return {
      ...common,
      ...(deliverable === '' ? {} : { deliverable }),
      ...(evidence === '' ? {} : { evidence }),
    };
  }

  const predicted = textOf(record.预测);
  const compare = textOf(record.比对);
  if (predicted === '' && compare === '') return null;
  return {
    ...common,
    ...(predicted === '' ? {} : { predicted }),
    ...(compare === '' ? {} : { compare }),
  };
}

export function buildGameSpec(options: BuildGameOptions): BuildGameResult {
  const subjectDir = path.join(options.workspace, '.learning', 'subjects', options.subject);
  const lessonsDir = path.join(subjectDir, 'lessons');
  const subjectYaml = readYamlObject(path.join(subjectDir, 'subject.yaml'));
  const curriculumFile = path.join(subjectDir, 'curriculum.yaml');
  const curriculumRaw = readTextIfPresent(curriculumFile) ?? '';
  const curriculum = readYamlObject(curriculumFile);
  const nodes = Array.isArray(curriculum.nodes) ? curriculum.nodes : [];
  const warnings: string[] = [];
  const sources: GameSource[] = [];
  const levels: GameLevel[] = [];

  for (const rawNode of nodes) {
    if (!rawNode || typeof rawNode !== 'object' || Array.isArray(rawNode)) continue;
    const node = rawNode as Record<string, unknown>;
    const nodeId = textOf(node.id);
    if (nodeId === '') continue;
    const lessonName = findLessonName(lessonsDir, nodeId);
    if (lessonName === null) {
      warnings.push(`节点 ${nodeId} 没有课件，跳过`);
      continue;
    }
    const quizName = lessonName.replace(/\.md$/, '.quiz.json');
    const quizPath = path.join(lessonsDir, quizName);
    const quizRaw = readTextIfPresent(quizPath);
    if (quizRaw === null) {
      warnings.push(`节点 ${nodeId} 没有题库，跳过`);
      continue;
    }

    let quiz: Record<string, unknown[]>;
    try {
      const parsed: unknown = JSON.parse(quizRaw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('题库顶层不是对象');
      quiz = parsed as Record<string, unknown[]>;
    } catch (error) {
      warnings.push(`节点 ${nodeId} 的题库 JSON 读不了：${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    const questions: GameQuestion[] = [];
    for (const anchor of Object.keys(quiz)) {
      const items = quiz[anchor];
      if (!Array.isArray(items)) continue;
      items.forEach((item, index) => {
        const normalized = normalizeQuestion(item, anchor, index);
        if (normalized) questions.push(normalized);
        else warnings.push(`节点 ${nodeId} 的题「${anchor}#${index}」题型/字段不完整，跳过`);
      });
    }
    if (questions.length === 0) {
      warnings.push(`节点 ${nodeId} 没有可用题目，跳过`);
      continue;
    }

    const lessonText = readTextIfPresent(path.join(lessonsDir, lessonName)) ?? '';
    const numberMatch = /^(\d+)/.exec(lessonName);
    levels.push({
      id: nodeId,
      title: textOf(node.title) || nodeId,
      number: numberMatch ? numberMatch[1] : '',
      kind: textOf(node.kind) || '概念',
      objective: textOf(node.objective),
      prerequisites: Array.isArray(node.prerequisites)
        ? node.prerequisites.map((item) => textOf(item)).filter(Boolean)
        : [],
      attemptsVersion: attemptsVersion({ workspace: options.workspace, subject: options.subject, node: nodeId }),
      questions,
    });
    sources.push({
      node: nodeId,
      lessonSha256: hashText(lessonText),
      quizSha256: hashText(quizRaw),
    });
  }

  return {
    spec: {
      version: 1,
      kind: 'game',
      subject: options.subject,
      title: textOf(subjectYaml.name) || options.subject,
      generatedAt: new Date().toISOString(),
      libraryEndpoint: GAME_LIBRARY_ENDPOINT,
      attemptsEndpoint: GAME_ATTEMPTS_ENDPOINT,
      levels,
      warnings,
    },
    sources,
    curriculumSha256: hashText(curriculumRaw),
    warnings,
  };
}

export function writeGame(options: BuildGameOptions & { root?: string }): WriteGameResult {
  const built = buildGameSpec(options);
  const dir = gameDir({
    workspace: options.workspace,
    subject: options.subject,
    ...(options.root === undefined ? {} : { root: options.root }),
  });
  fs.mkdirSync(dir, { recursive: true });

  const dataFile = path.join(dir, GAME_DATA_FILE);
  const indexFile = path.join(dir, GAME_INDEX_FILE);

  // MVP：第 1 课的工作坊先写死在这里；以后改成 lesson 下的 workshop 文件。
  let workshopFile: string | undefined;
  if (built.spec.levels.some((level) => level.id === 'intro.why-content-works')) {
    workshopFile = path.join(dir, 'workshop.html');
    writeFileAtomic(workshopFile, buildWorkshopHtml());
    built.spec.workshop = { title: '第 1 课工作坊：谁在停下来？', file: 'workshop.html' };
  }

  writeFileAtomic(dataFile, JSON.stringify(built.spec, null, 2) + '\n');
  writeFileAtomic(indexFile, buildGameHtml(built.spec));

  const files = [
    { path: GAME_INDEX_FILE, role: 'game', bytes: fs.statSync(indexFile).size, mime: 'text/html; charset=utf-8' },
    { path: GAME_DATA_FILE, role: 'data', bytes: fs.statSync(dataFile).size, mime: 'application/json; charset=utf-8' },
  ];
  if (workshopFile !== undefined) {
    files.push({
      path: 'workshop.html',
      role: 'workshop',
      bytes: fs.statSync(workshopFile).size,
      mime: 'text/html; charset=utf-8',
    });
  }

  const manifest = makeManifest({
    kind: 'game',
    subject: options.subject,
    source: {
      curriculumSha256: built.curriculumSha256,
      lessons: built.sources,
    },
    files,
    warnings: built.warnings,
  });
  const manifestFile = writeManifest(dir, manifest);

  return { ...built, indexFile, dataFile, manifestFile, ...(workshopFile === undefined ? {} : { workshopFile }) };
}