// Phase 2：curriculum + quiz → 游戏关卡；自包含页面；manifest / library 摘要。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(here, '../..');

const moduleApi = await import('node:module');
if (typeof moduleApi.registerHooks === 'function') {
  await import('../../bin/typescript-runtime.mjs');
}
const media = await import('../../lib/media/index.ts');
const { readLibrary } = await import('../../lib/library.ts');
const { validateAgainstSchema } = await import('../../lib/core/schema.ts');

const PILOT = { workspace: 'C:/Users/Administrator/StudyMate', subject: 'self-media-product-launch' };
const gameSchema = JSON.parse(fs.readFileSync(path.join(pluginRoot, 'schemas', 'game.schema.json'), 'utf8'));
const manifestSchema = JSON.parse(fs.readFileSync(path.join(pluginRoot, 'schemas', 'media-manifest.schema.json'), 'utf8'));

function assertSchema(value, schema, label) {
  const problems = validateAgainstSchema(value, schema);
  assert.deepEqual(problems, [], `${label} 不符合 schema：${JSON.stringify(problems.slice(0, 3))}`);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'studymate-game-'));
const previousRoot = process.env.STUDYMATE_MEDIA_ROOT;
process.env.STUDYMATE_MEDIA_ROOT = tmp;

try {
  const built = media.buildGameSpec(PILOT);
  assert.ok(built.spec.levels.length > 0, '应生成至少一个关卡');
  assert.equal(built.spec.levels[0].id, 'intro.why-content-works');
  assert.ok(built.spec.levels.every((level) => level.questions.length > 0));
  assert.ok(built.warnings.length > 0, '没有题库的节点应进 warnings');

  const allQuestions = built.spec.levels.flatMap((level) => level.questions);
  const ids = allQuestions.map((question) => question.id);
  assert.equal(new Set(ids).size, ids.length, '题 id 不应重复');
  assert.ok(ids.every((id) => id.includes('#')));
  assert.ok(allQuestions.some((question) => question.kind === '客观题'));
  assert.ok(allQuestions.some((question) => question.kind === '开放题'));
  assert.ok(allQuestions.every((question) => question.q.trim() !== ''));

  const schemaProblems = validateAgainstSchema(built.spec, gameSchema);
  assert.deepEqual(schemaProblems, [], `game.json 不符合 schema：${JSON.stringify(schemaProblems.slice(0, 3))}`);

  const written = media.writeGame({ ...PILOT, root: tmp });
  assert.ok(fs.existsSync(written.indexFile));
  assert.ok(fs.existsSync(written.dataFile));
  assert.ok(fs.existsSync(written.manifestFile));
  assert.ok(written.workshopFile && fs.existsSync(written.workshopFile), '应生成第 1 课工作坊');
  assert.equal(written.spec.workshop.file, 'workshop.html');
  const workshopHtml = fs.readFileSync(written.workshopFile, 'utf8');
  assert.ok(workshopHtml.includes('谁在停下来'), '工作坊应包含标题');
  assert.ok(workshopHtml.includes('读者模式'), '工作坊应有读者模式');
  assertSchema(written.spec, gameSchema, 'game-with-workshop');

  const html = fs.readFileSync(written.indexFile, 'utf8');
  assert.ok(html.includes('const DATA ='), '游戏数据应内联');
  assert.ok(html.includes(built.spec.levels[0].title), '页面应包含关卡标题');
  assert.ok(html.includes('localStorage'), '页面应有本地存档');
  assert.ok(html.includes('/api/studymate/attempts'), '页面应知道 attempts 端点');
  assert.ok(!html.includes("fetch('game.json')") && !html.includes('fetch("game.json")'), '游戏数据不能运行时 fetch');

  const manifest = JSON.parse(fs.readFileSync(written.manifestFile, 'utf8'));
  assert.equal(manifest.kind, 'game');
  assert.equal(manifest.source.curriculumSha256.length, 64);
  assert.equal(manifest.source.lessons.length, built.sources.length);
  assert.ok(manifest.files.some((file) => file.role === 'workshop'), 'manifest 应包含工作坊文件');
  const manifestProblems = validateAgainstSchema(manifest, manifestSchema);
  assert.deepEqual(manifestProblems, [], `game manifest 不符合 schema：${JSON.stringify(manifestProblems.slice(0, 3))}`);

  const summary = media.gameMediaSummary(PILOT);
  assert.equal(summary.present, true);
  const library = readLibrary({ workspace: PILOT.workspace });
  const subject = library.subjects.find((item) => item.slug === PILOT.subject);
  assert.equal(subject.media.game.present, true);

  console.log('ok · media game');
} finally {
  if (previousRoot === undefined) delete process.env.STUDYMATE_MEDIA_ROOT;
  else process.env.STUDYMATE_MEDIA_ROOT = previousRoot;
  fs.rmSync(tmp, { recursive: true, force: true });
}