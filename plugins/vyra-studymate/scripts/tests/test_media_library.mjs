// Phase 1.2：library payload 的媒体摘要（存在 / 时长 / stale），不加载媒体文件。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const moduleApi = await import('node:module');
if (typeof moduleApi.registerHooks === 'function') {
  await import('../../bin/typescript-runtime.mjs');
}
const media = await import('../../lib/media/index.ts');
const { readLibrary } = await import('../../lib/library.ts');

const PILOT = {
  workspace: 'C:/Users/Administrator/StudyMate',
  subject: 'self-media-product-launch',
  node: 'intro.why-content-works',
};
const lessonsDir = path.join(PILOT.workspace, '.learning', 'subjects', PILOT.subject, 'lessons');
const lessonSource = fs.readFileSync(path.join(lessonsDir, '0001-intro.why-content-works.md'), 'utf8');
const quizSource = fs.readFileSync(path.join(lessonsDir, '0001-intro.why-content-works.quiz.json'), 'utf8');
const narrationPath = path.join(lessonsDir, '0001-intro.why-content-works.narration.md');
const narrationSource = fs.existsSync(narrationPath) ? fs.readFileSync(narrationPath, 'utf8') : undefined;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'studymate-lib-'));
const previousRoot = process.env.STUDYMATE_MEDIA_ROOT;
process.env.STUDYMATE_MEDIA_ROOT = tmp;

try {
  const dir = media.productDir({
    workspace: PILOT.workspace,
    subject: PILOT.subject,
    kind: 'audio',
    node: PILOT.node,
  });
  const manifest = media.makeManifest({
    kind: 'audio',
    subject: PILOT.subject,
    node: PILOT.node,
    source: {
      lesson: '0001-intro.why-content-works.md',
      quiz: '0001-intro.why-content-works.quiz.json',
      ...(narrationSource === undefined
        ? {}
        : { narration: '0001-intro.why-content-works.narration.md' }),
      ...media.sourceHashes({
        lesson: lessonSource,
        quiz: quizSource,
        ...(narrationSource === undefined ? {} : { narration: narrationSource }),
      }),
    },
    files: [{ path: 'lesson.mp3', role: 'audio', bytes: 3, mime: 'audio/mpeg' }],
    durationMs: 1234,
    provider: { name: 'edge-tts', voice: 'zh-CN-XiaoxiaoNeural', rate: '+20%' },
  });
  media.writeManifest(dir, manifest);

  const library = readLibrary({ workspace: PILOT.workspace });
  const subject = library.subjects.find((item) => item.slug === PILOT.subject);
  assert.ok(subject, '应找到试点科目');
  const node = subject.nodes.find((item) => item.id === PILOT.node);
  assert.ok(node, '应找到试点节点');
  assert.equal(node.media.audio.present, true);
  assert.equal(node.media.audio.stale, false);
  assert.equal(node.media.audio.durationMs, 1234);
  assert.equal(node.media.audio.provider, 'edge-tts');
  assert.equal(node.media.video.present, false);
  assert.equal(subject.media.game.present, false);

  media.writeManifest(dir, {
    ...manifest,
    source: { ...manifest.source, lessonSha256: '0'.repeat(64) },
  });
  const staleLibrary = readLibrary({ workspace: PILOT.workspace });
  const staleNode = staleLibrary.subjects
    .find((item) => item.slug === PILOT.subject)
    .nodes.find((item) => item.id === PILOT.node);
  assert.equal(staleNode.media.audio.stale, true, '源哈希变了应标记 stale');

  console.log('ok · media library summary');
} finally {
  if (previousRoot === undefined) delete process.env.STUDYMATE_MEDIA_ROOT;
  else process.env.STUDYMATE_MEDIA_ROOT = previousRoot;
  fs.rmSync(tmp, { recursive: true, force: true });
}