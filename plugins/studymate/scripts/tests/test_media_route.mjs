// 媒体路由的纯路径与 MIME 自检；不启动 HTTP 服务、不依赖 DSH 配置。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const moduleApi = await import('node:module');
if (typeof moduleApi.registerHooks === 'function') {
  await import('../../bin/typescript-runtime.mjs');
}
const route = await import('../../lib/media/route.ts');

const PILOT = {
  workspace: 'C:/Users/Administrator/StudyMate',
  subject: 'self-media-product-launch',
  node: 'intro.why-content-works',
};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'studymate-route-'));
try {
  const audio = route.resolveMediaFile({
    workspace: PILOT.workspace,
    subject: PILOT.subject,
    kind: 'audio',
    node: PILOT.node,
    root: tmp,
  });
  assert.equal(audio, path.join(tmp, PILOT.subject, 'audio', PILOT.node, 'player.html'));

  const explicit = route.resolveMediaFile({
    workspace: PILOT.workspace,
    subject: PILOT.subject,
    kind: 'audio',
    node: PILOT.node,
    file: 'lesson.mp3',
    root: tmp,
  });
  assert.equal(explicit, path.join(tmp, PILOT.subject, 'audio', PILOT.node, 'lesson.mp3'));

  const game = route.resolveMediaFile({
    workspace: PILOT.workspace,
    subject: PILOT.subject,
    kind: 'game',
    root: tmp,
  });
  assert.equal(game, path.join(tmp, PILOT.subject, 'game', 'index.html'));

  assert.throws(() => route.resolveMediaFile({
    workspace: PILOT.workspace,
    subject: PILOT.subject,
    kind: 'audio',
    node: PILOT.node,
    file: '../escape.html',
    root: tmp,
  }), /越界/);
  assert.throws(() => route.resolveMediaFile({
    workspace: PILOT.workspace,
    subject: PILOT.subject,
    kind: 'audio',
    node: PILOT.node,
    file: 'C:/Windows/win.ini',
    root: tmp,
  }), /越界/);
  assert.throws(() => route.resolveMediaFile({
    workspace: PILOT.workspace,
    subject: PILOT.subject,
    kind: 'nope',
    node: PILOT.node,
    root: tmp,
  }), /kind/);

  assert.equal(route.mimeOf('a.mp3'), 'audio/mpeg');
  assert.equal(route.mimeOf('a.wav'), 'audio/wav');
  assert.equal(route.mimeOf('a.html'), 'text/html; charset=utf-8');
  assert.equal(route.mimeOf('a.srt'), 'application/x-subrip; charset=utf-8');
  assert.equal(route.MEDIA_PATH, '/api/studymate/media');

  console.log('ok · media route');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}