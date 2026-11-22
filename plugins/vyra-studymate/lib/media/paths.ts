/* ─────────────────────────────────────────────────────────────────────────
   StudyMate · 媒体域 —— 产物路径与安全落盘

   产物是派生物：默认放**工作区外**的缓存目录，避免音视频把纯文本学习数据撑大。
   优先级：调用方显式 root > STUDYMATE_MEDIA_ROOT > 配置 media.root > 默认缓存。

   所有路径都过 safeJoin / assertSafeSegment：媒体路由、工具、测试共用同一份判据。
   ───────────────────────────────────────────────────────────────────────── */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { dshHome, readConfigObject } from '../workspace.ts';

export const CACHE_DIR_NAME = 'media-cache';

export class MediaPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MediaPathError';
  }
}

export type MediaProductKind = 'audio' | 'video';

export function hashText(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

export function hashBuffer(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function workspaceKey(workspace: string): string {
  return hashText(path.resolve(workspace)).slice(0, 16);
}

export interface MediaRootOptions {
  workspace: string;
  /** 显式覆盖（工具与测试用）；空串等于不覆盖。 */
  root?: string;
}

/** 产物根目录。默认 `~/.dsh/studymate/media-cache/<workspace-hash>/`。 */
export function resolveMediaRoot(options: MediaRootOptions): string {
  const explicit = options.root;
  if (typeof explicit === 'string' && explicit.trim() !== '') return path.resolve(explicit);

  const env = process.env.STUDYMATE_MEDIA_ROOT;
  if (typeof env === 'string' && env.trim() !== '') return path.resolve(env);

  const config = readConfigObject();
  const media = config?.media;
  if (media && typeof media === 'object' && !Array.isArray(media)) {
    const configured = (media as Record<string, unknown>).root;
    if (typeof configured === 'string' && configured.trim() !== '') return path.resolve(configured);
  }

  return path.join(dshHome(), 'studymate', CACHE_DIR_NAME, workspaceKey(options.workspace));
}

/** 单个科目/产物的目录名。subject 与 node 都会过安全段检查。 */
export function subjectDir(options: MediaRootOptions & { subject: string }): string {
  return safeJoin(resolveMediaRoot(options), assertSafeSegment(options.subject, 'subject'));
}

export function productDir(options: MediaRootOptions & {
  subject: string;
  kind: MediaProductKind;
  node: string;
}): string {
  return safeJoin(
    subjectDir(options),
    options.kind,
    assertSafeSegment(options.node, 'node'),
  );
}

export function gameDir(options: MediaRootOptions & { subject: string }): string {
  return safeJoin(subjectDir(options), 'game');
}

export function scriptDir(options: MediaRootOptions & { subject: string }): string {
  return safeJoin(subjectDir(options), 'script');
}

/**
 * 只接受单个路径段：拒绝空串、`.`、`..`、斜杠/反斜杠、NUL 与盘符。
 * 科目 slug 与节点 id 都允许点号（`intro.why-content-works`），所以不能按「像文件名」判。
 */
export function assertSafeSegment(value: string, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new MediaPathError(`${label} 不能为空`);
  }
  if (value !== value.trim()) {
    throw new MediaPathError(`${label} 首尾不能有空白：${JSON.stringify(value)}`);
  }
  if (value === '.' || value === '..' || value.includes('/') || value.includes('\\')) {
    throw new MediaPathError(`${label} 必须是单个路径段：${JSON.stringify(value)}`);
  }
  if (value.includes('\0') || /^[A-Za-z]:/.test(value)) {
    throw new MediaPathError(`${label} 不能是绝对路径：${JSON.stringify(value)}`);
  }
  return value;
}

/** 把若干段拼到 root 下，并保证结果不逃出 root。 */
export function safeJoin(root: string, ...segments: string[]): string {
  const base = path.resolve(root);
  const target = path.resolve(base, ...segments);
  if (target !== base && !target.startsWith(base + path.sep)) {
    throw new MediaPathError(`路径越界：${target} 不在 ${base} 下`);
  }
  return target;
}

/**
 * 原子写：先写同目录临时文件，再 rename。
 * Windows 上目标已存在时 rename 可能失败，退一步先删目标再 rename——只用于派生物，
 * 丢一次旧产物比留下半份 manifest 更安全。
 */
export function writeFileAtomic(file: string, content: string | Buffer): void {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(
    dir,
    `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`,
  );
  fs.writeFileSync(tmp, content);
  try {
    fs.renameSync(tmp, file);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'EEXIST' && code !== 'EPERM' && code !== 'EACCES') throw error;
    fs.rmSync(file, { force: true });
    fs.renameSync(tmp, file);
  }
}

/** 读 JSON；文件不存在返回 null，内容坏了抛错（调用方决定报不报）。 */
export function readJsonIfPresent<T>(file: string): T | null {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
  return JSON.parse(text) as T;
}

export function readTextIfPresent(file: string): string | null {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

export function fileSize(file: string): number {
  return fs.statSync(file).size;
}

/** 测试与诊断用：当前平台是否为 Windows。 */
export function isWindows(): boolean {
  return os.platform() === 'win32';
}
