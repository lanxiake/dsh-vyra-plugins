// Phase 0 自检：真实试点课件 → 讲解脚本；narration 对齐；manifest / stale；路径安全。
// 不联网、不调用 TTS、不写真实工作区（只读试点课件，产物写临时目录）。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(here, '../..');

// Node 22.19+ 用本包的 registerHooks 擦除；更老的 22.x 用 --experimental-strip-types。
const moduleApi = await import('node:module');
if (typeof moduleApi.registerHooks === 'function') {
  await import('../../bin/typescript-runtime.mjs');
}
const media = await import('../../lib/media/index.ts');
const { validateAgainstSchema } = await import('../../lib/core/schema.ts');

const PILOT = {
  workspace: 'C:/Users/Administrator/StudyMate',
  subject: 'self-media-product-launch',
  node: 'intro.why-content-works',
  title: '一条内容为什么会被看完',
};

const lessonsDir = path.join(
  PILOT.workspace, '.learning', 'subjects', PILOT.subject, 'lessons',
);
const lessonPath = path.join(lessonsDir, '0001-intro.why-content-works.md');
const quizPath = path.join(lessonsDir, '0001-intro.why-content-works.quiz.json');
const lessonSource = fs.readFileSync(lessonPath, 'utf8');
const quizSource = fs.readFileSync(quizPath, 'utf8');
const quizKeys = Object.keys(JSON.parse(quizSource)).sort();

const scriptSchema = JSON.parse(
  fs.readFileSync(path.join(pluginRoot, 'schemas', 'lesson-script.schema.json'), 'utf8'),
);
const manifestSchema = JSON.parse(
  fs.readFileSync(path.join(pluginRoot, 'schemas', 'media-manifest.schema.json'), 'utf8'),
);
const narrationSchema = JSON.parse(
  fs.readFileSync(path.join(pluginRoot, 'schemas', 'narration.schema.json'), 'utf8'),
);

function build(extra = {}) {
  return media.buildLessonScript({
    subject: PILOT.subject,
    node: PILOT.node,
    lessonSource,
    lessonFile: path.basename(lessonPath),
    quizSource,
    quizFile: path.basename(quizPath),
    outlineTitle: PILOT.title,
    ...extra,
  });
}

function assertSchema(value, schema, label) {
  const problems = validateAgainstSchema(value, schema);
  assert.deepEqual(problems, [], `${label} 不符合 schema：${JSON.stringify(problems.slice(0, 3))}`);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'studymate-media-'));
try {
  // 1) 真实课件 → 脚本
  const result = build();
  assert.ok(result.script, '应当生成脚本');
  assert.equal(result.errors.length, 0, `课件不应有格式错误：${JSON.stringify(result.errors.slice(0, 3))}`);
  assert.equal(result.narrationProblems.length, 0, '没有 narration.md 时不应有对齐问题');
  assert.equal(result.script.scenes.length, 7, '试点课件有 7 个 ## 场景');
  assert.equal(result.script.scenes[0].heading, '一条内容要过的三关');
  assert.ok(result.script.scenes.every((scene) => scene.narration.trim() !== ''), '每场都要有可朗读旁白');
  assert.ok(result.script.scenes.every((scene) => scene.visuals.length > 0), '每场都要有画面');

  const anchors = [...new Set(result.script.scenes.flatMap((scene) => scene.quizAnchors))].sort();
  assert.deepEqual(anchors, quizKeys, '题目锚点应与题库键逐字一致');

  const visualTypes = new Set(
    result.script.scenes.flatMap((scene) => scene.visuals.map((visual) => visual.type)),
  );
  for (const type of ['title', 'heading', 'paragraph', 'list', 'table', 'svg', 'practice', 'links', 'quiz']) {
    assert.ok(visualTypes.has(type), `应包含 ${type} 画面`);
  }
  assertSchema(result.script, scriptSchema, 'lesson-script');
  assert.ok(Array.isArray(result.audioProblems), '应返回纯音频提醒');
  assert.ok(
    result.audioProblems.some((problem) => problem.code === 'audio-visual-deixis'),
    '自动旁白里的「看这张表」应被标记为视觉指代',
  );

  // 纯音频规则：视觉指代 / 空间指代 / 长句 / 无小结
  const audioProblems = media.validateAudioOnly([
    {
      heading: '测试节',
      narration: '如图所示，这个按钮在左边。这是一句故意写得非常非常长的话，用来确认超过长度上限时会被提醒，而且提醒里会带出前面的片段方便定位问题。',
    },
  ], { file: 'x.narration.md' });
  for (const code of ['audio-visual-deixis', 'audio-spatial-deixis', 'audio-long-sentence', 'audio-no-summary']) {
    assert.ok(audioProblems.some((problem) => problem.code === code), `应包含 ${code}`);
  }
  const cleanAudio = media.validateAudioOnly([
    { heading: '小结', narration: '这一节的关键是：先看读者的处境，再看你的产品。' },
  ], { file: 'clean.narration.md' });
  assert.equal(cleanAudio.some((problem) => problem.code === 'audio-visual-deixis'), false);

  // 2) narration.md 覆盖 + 缺节回退
  const narrationSource = [
    '---',
    `title: ${PILOT.title}`,
    '---',
    '',
    '## 一条内容要过的三关',
    '',
    '这是第一段口播。',
    '',
    '## 第一关：被点开',
    '',
    '这是第二段口播。',
    '',
  ].join('\n');
  const overridden = build({
    narrationSource,
    narrationFile: '0001-intro.why-content-works.narration.md',
  });
  assert.equal(overridden.narrationProblems.length, 0, '对齐的 narration 不应报错');
  assert.ok(overridden.script.scenes[0].narration.startsWith('这是第一段口播。'));
  assert.ok(overridden.script.scenes[1].narration.startsWith('这是第二段口播。'));
  assert.ok(overridden.script.scenes[2].narration.trim() !== '', '缺节应回退到自动旁白');

  const parsedNarration = media.parseNarration(narrationSource, 'x.narration.md');
  assert.equal(parsedNarration.problems.length, 0);
  assertSchema({
    version: parsedNarration.version,
    title: parsedNarration.title,
    instruction: parsedNarration.instruction,
    sections: parsedNarration.sections.map(({ heading, text, paragraphs, instruction }) => ({
      heading, text, paragraphs,
      ...(instruction === undefined ? {} : { instruction }),
    })),
  }, narrationSchema, 'narration');

  // 2b) 全局语气 + 分节语气；分节覆盖全局，且不得进正文
  const instructedSource = [
    '---',
    `title: ${PILOT.title}`,
    'instruction: warm teacher, moderate pace',
    '---',
    '',
    '## 一条内容要过的三关',
    '@instruction: curious and engaging, slightly brisk',
    '',
    '这是第一段口播。',
    '',
    '## 第一关：被点开',
    '',
    '这是第二段口播。',
    '',
  ].join('\n');
  const instructedNarration = media.parseNarration(instructedSource, 'instructed.narration.md');
  assert.equal(instructedNarration.problems.length, 0, '语气指令语法应通过');
  assert.equal(instructedNarration.instruction, 'warm teacher, moderate pace');
  assert.equal(instructedNarration.sections[0].instruction, 'curious and engaging, slightly brisk');
  assert.ok(!instructedNarration.sections[0].text.includes('@instruction'), '指令不能进正文');
  assertSchema({
    version: instructedNarration.version,
    title: instructedNarration.title,
    instruction: instructedNarration.instruction,
    sections: instructedNarration.sections.map(({ heading, text, paragraphs, instruction }) => ({
      heading, text, paragraphs,
      ...(instruction === undefined ? {} : { instruction }),
    })),
  }, narrationSchema, 'narration-instruction');

  const instructed = build({
    narrationSource: instructedSource,
    narrationFile: 'instructed.narration.md',
  });
  assert.equal(instructed.narrationProblems.length, 0);
  assert.equal(instructed.script.scenes[0].instruction, 'curious and engaging, slightly brisk');
  assert.equal(instructed.script.scenes[1].instruction, 'warm teacher, moderate pace');
  assertSchema(instructed.script, scriptSchema, 'lesson-script-instruction');

  // 3) 未知标题必须报错
  const unknown = build({
    narrationSource: '## 课件里没有的标题\n\n这段话挂不上去。\n',
    narrationFile: 'bad.narration.md',
  });
  assert.ok(
    unknown.narrationProblems.some((problem) => problem.code === 'narration-unknown-heading'),
    '未知标题应报 narration-unknown-heading',
  );

  // 4) 路径安全
  assert.throws(() => media.safeJoin(tmp, '..', 'escape'), /越界/);
  assert.throws(() => media.assertSafeSegment('..', 'node'), /单个路径段/);
  assert.throws(() => media.assertSafeSegment('a/b', 'node'), /单个路径段/);
  assert.equal(media.assertSafeSegment('intro.why-content-works', 'node'), 'intro.why-content-works');

  // 5) manifest / stale / 原子写
  const productDir = path.join(tmp, 'audio', 'n1');
  const texts = { lesson: 'lesson-source', quiz: 'quiz-source' };
  const manifest = media.makeManifest({
    kind: 'audio',
    subject: PILOT.subject,
    node: PILOT.node,
    source: {
      lesson: 'lesson.md',
      quiz: 'lesson.quiz.json',
      ...media.sourceHashes(texts),
    },
    files: [{ path: 'lesson.wav', role: 'audio', bytes: 3, mime: 'audio/wav' }],
    durationMs: 100,
    provider: { name: 'test', voice: 'zh-CN' },
  });
  media.writeManifest(productDir, manifest);
  const read = media.readManifest(productDir);
  assert.ok(read);
  assert.equal(read.kind, 'audio');
  assert.equal(media.isStale(read, texts), false);
  assert.equal(media.isStale(read, { lesson: 'lesson-source', quiz: 'changed' }), true);
  assert.equal(media.isStale(read, { lesson: 'lesson-source' }), true, '源文件消失也算 stale');
  assert.equal(
    fs.readdirSync(productDir).filter((name) => name.endsWith('.tmp')).length,
    0,
    '原子写不应留下临时文件',
  );
  assertSchema(read, manifestSchema, 'media-manifest');

  // 6) planLesson 读真实课件、写临时产物根
  const files = media.findLessonFiles(lessonsDir, PILOT.node);
  assert.ok(files);
  assert.equal(files.lessonName, '0001-intro.why-content-works.md');
  assert.equal(files.quizName, '0001-intro.why-content-works.quiz.json');

  const plan = media.planLesson({
    workspace: PILOT.workspace,
    subject: PILOT.subject,
    node: PILOT.node,
    root: tmp,
    outlineTitle: PILOT.title,
  });
  assert.ok(plan.script);
  assert.ok(plan.outputFile.startsWith(tmp), '脚本应写到临时根');
  assert.ok(fs.existsSync(plan.outputFile), '脚本文件应存在');
  const cached = JSON.parse(fs.readFileSync(plan.outputFile, 'utf8'));
  assert.equal(cached.scenes.length, 7);
  assert.equal(media.readLessonScript({
    workspace: PILOT.workspace, subject: PILOT.subject, node: PILOT.node, root: tmp,
  })?.scenes.length, 7);

  console.log('ok · media phase 0');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
