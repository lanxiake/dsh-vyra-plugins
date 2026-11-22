/* ─────────────────────────────────────────────────────────────────────────
   StudyMate · 媒体域 —— 阅读端取媒体产物的路由

   GET /api/studymate/media?subject=&kind=audio|video|game&node=&file=
   只读；路径全部走 productDir / gameDir + safeJoin，越界一律 400。
   浏览器拿到的就是产物目录里的原文件（player.html / lesson.mp3 / assets/…）。
   ───────────────────────────────────────────────────────────────────────── */

import fs from 'node:fs';
import path from 'node:path';

import { resolveWorkspace } from '../workspace.ts';
import { gameDir, productDir, safeJoin } from './paths.ts';

export const MEDIA_PATH = '/api/studymate/media';

export const MEDIA_MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.srt': 'application/x-subrip; charset=utf-8',
  '.vtt': 'text/vtt; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

export interface MediaFileOptions {
  workspace: string;
  subject: string;
  kind: string;
  node?: string;
  file?: string;
  root?: string;
}

/** 解析请求要的文件；纯路径函数，测试可直接断言。 */
export function resolveMediaFile(options: MediaFileOptions): string {
  const kind = options.kind;
  if (kind !== 'audio' && kind !== 'video' && kind !== 'game') {
    throw new Error(`kind 只能是 audio / video / game，收到 ${JSON.stringify(kind)}`);
  }
  const file = options.file?.trim()
    || (kind === 'game' ? 'index.html' : 'player.html');
  const dir = kind === 'game'
    ? gameDir({
      workspace: options.workspace,
      subject: options.subject,
      ...(options.root === undefined ? {} : { root: options.root }),
    })
    : productDir({
      workspace: options.workspace,
      subject: options.subject,
      kind,
      node: options.node ?? '',
      ...(options.root === undefined ? {} : { root: options.root }),
    });
  return safeJoin(dir, file);
}

export function mimeOf(file: string): string {
  return MEDIA_MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
}

interface FetchRegistry {
  register(route: {
    path: string;
    methods: string[];
    requestBody: 'buffered';
    fetch: (request: Request) => Promise<Response> | Response;
  }): unknown;
}

interface ConnectionContext {
  connection?: { fetch?: FetchRegistry };
  effect?: (fn: () => unknown, description?: string) => unknown;
}

interface RouteContext {
  inject?: (names: string[], handler: (ctx: ConnectionContext) => unknown) => unknown;
}

export async function mediaFileResponse(request: Request): Promise<Response> {
  const workspace = resolveWorkspace();
  if (!workspace) {
    return new Response('没有学习工作区：先跑安装写配置', { status: 500 });
  }
  const url = new URL(request.url);
  const subject = url.searchParams.get('subject') ?? '';
  const kind = url.searchParams.get('kind') ?? 'audio';
  const node = url.searchParams.get('node') ?? '';
  const file = url.searchParams.get('file') ?? '';
  try {
    const target = resolveMediaFile({ workspace, subject, kind, node, file });
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
      return new Response('not found', { status: 404 });
    }
    return new Response(await fs.promises.readFile(target), {
      headers: { 'content-type': mimeOf(target), 'cache-control': 'no-store' },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : String(error), { status: 400 });
  }
}

export function registerMediaRoute(ctx: RouteContext): void {
  if (typeof ctx.inject !== 'function') return;
  ctx.inject(['connection'], (connectionCtx) => {
    const connection = Reflect.get(connectionCtx, 'connection') as ConnectionContext['connection'];
    if (!connection?.fetch?.register || typeof connectionCtx.effect !== 'function') return;
    connectionCtx.effect(() => connection.fetch!.register({
      path: MEDIA_PATH,
      methods: ['GET'],
      requestBody: 'buffered',
      fetch: mediaFileResponse,
    }), 'studymate: 媒体产物路由');
  });
}
