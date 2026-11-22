// Phase 1.1 自检：provider 选择、单场音频组装、chapters / transcript / manifest、schema。
// 用假 provider 写 0.5s 静音 WAV；不联网、不调 edge-tts。真实 edge-tts 试听走 CLI。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
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
const { validateAgainstSchema } = await import('../../lib/core/schema.ts');

const PILOT = {
  workspace: 'C:/Users/Administrator/StudyMate',
  subject: 'self-media-product-launch',
  node: 'intro.why-content-works',
  title: '一条内容为什么会被看完',
};
const lessonsDir = path.join(PILOT.workspace, '.learning', 'subjects', PILOT.subject, 'lessons');
const lessonSource = fs.readFileSync(path.join(lessonsDir, '0001-intro.why-content-works.md'), 'utf8');
const quizSource = fs.readFileSync(path.join(lessonsDir, '0001-intro.why-content-works.quiz.json'), 'utf8');
const manifestSchema = JSON.parse(
  fs.readFileSync(path.join(pluginRoot, 'schemas', 'media-manifest.schema.json'), 'utf8'),
);

function silentWav(seconds = 0.5, sampleRate = 8000) {
  const samples = Math.round(seconds * sampleRate);
  const dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

const seenInstructions = [];
const fakeProvider = {
  name: 'fake',
  voice: 'test',
  rate: '1.0',
  extension: '.wav',
  warnings: [],
  async synthesize({ output, instruction }) {
    seenInstructions.push(instruction);
    const file = output.replace(/\.mp3$/, '.wav');
    fs.writeFileSync(file, silentWav(0.5));
    return { file, mime: 'audio/wav', durationMs: 500, warnings: [] };
  },
};

function buildScript() {
  const result = media.buildLessonScript({
    subject: PILOT.subject,
    node: PILOT.node,
    lessonSource,
    lessonFile: '0001-intro.why-content-works.md',
    quizSource,
    quizFile: '0001-intro.why-content-works.quiz.json',
    outlineTitle: PILOT.title,
  });
  assert.ok(result.script);
  assert.equal(result.errors.length, 0);
  return result.script;
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'studymate-tts-'));
try {
  // provider 选择
  const edge = media.createTtsProvider({ voice: 'zh-CN-XiaoxiaoNeural' });
  assert.equal(edge.name, 'edge-tts');
  assert.equal(edge.voice, 'zh-CN-XiaoxiaoNeural');
  assert.equal(edge.rate, '+20%');
  assert.equal(edge.extension, '.mp3');
  const native = media.createTtsProvider({ provider: 'native' });
  assert.ok(native.name.startsWith('native'), `native provider 名称应是 native-*，实际 ${native.name}`);
  assert.equal(native.extension, '.wav');
  assert.equal(native.rate, '+20%');
  const breeze = media.createTtsProvider({ provider: 'breeze' });
  assert.equal(breeze.name, 'breeze-api');
  assert.equal(breeze.extension, '.wav');
  assert.equal(breeze.rate, '+0%');
  assert.ok(breeze.warnings.some((warning) => warning.includes('非商业')));
  assert.throws(() => media.createTtsProvider({ provider: 'nope' }), /不支持的 TTS provider/);
  assert.ok(media.estimateSpeechSeconds('你好，这是一次试听。') >= 2);

  // 单场组装；给第一场一条语气指令，确认它被透传
  const script = buildScript();
  script.scenes[0].instruction = 'curious opening';
  const outDir = path.join(tmp, 'audio', 'n1');
  const result = await media.synthesizeScenes({
    script,
    outDir,
    provider: fakeProvider,
    sceneIds: ['s1'],
  });

  assert.ok(fs.existsSync(result.audioFile), '音频应存在');
  assert.equal(path.extname(result.audioFile), '.wav');
  assert.ok(fs.statSync(result.audioFile).size > 44, '音频不应为空');
  assert.equal(result.durationMs, 500);
  assert.equal(result.manifest.chapters?.length, 1);
  assert.deepEqual(result.manifest.chapters[0], {
    title: script.scenes[0].heading,
    startMs: 0,
    endMs: 500,
    sceneId: 's1',
  });
  assert.equal(result.manifest.files.length, 4);
  assert.deepEqual(
    result.manifest.files.map((file) => file.role).sort(),
    ['audio', 'chapters', 'player', 'transcript'],
  );
  assert.equal(result.manifest.provider.rate, '1.0');
  assert.ok(fs.existsSync(result.playerFile), '播放器应存在');
  const player = fs.readFileSync(result.playerFile, 'utf8');
  assert.ok(player.includes(script.scenes[0].heading), '播放器应包含章节标题');
  assert.ok(player.includes(path.basename(result.audioFile)), '播放器应指向音频文件');
  assert.ok(player.includes('相对倍速'), '播放器应有倍速控制');
  assert.ok(player.includes('15 秒'), '播放器应有倒退 15 秒');
  assert.equal(seenInstructions[0], 'curious opening', '语气指令应透传给 provider');

  const transcript = fs.readFileSync(result.transcriptFile, 'utf8');
  assert.ok(transcript.startsWith(`# ${script.title}`));
  assert.ok(transcript.includes(`## ${script.scenes[0].heading}`));
  assert.ok(transcript.includes(script.scenes[0].narration.slice(0, 20)));

  const problems = validateAgainstSchema(result.manifest, manifestSchema);
  assert.deepEqual(problems, [], `manifest 不符合 schema：${JSON.stringify(problems.slice(0, 3))}`);

  assert.equal(media.isStale(result.manifest, { lesson: lessonSource, quiz: quizSource }), false);
  assert.equal(media.isStale(result.manifest, { lesson: lessonSource, quiz: quizSource, narration: 'x' }), true);
  assert.equal(
    fs.readdirSync(outDir).filter((name) => name.endsWith('.tmp')).length,
    0,
    '不应留下临时文件',
  );

  const probed = media.probeDurationMs(result.audioFile);
  if (probed !== null) assert.ok(Math.abs(probed - 500) <= 60, `ffprobe 时长应接近 500ms，实际 ${probed}`);

  // Windows 上没有随机性：真的调一次系统语音，确认真能产出 WAV。
  if (process.platform === 'win32') {
    const nativeResult = await native.synthesize({
      text: '这是一次本地语音测试，用来确认系统语音可用。',
      output: path.join(tmp, 'native-smoke.wav'),
    });
    assert.ok(fs.existsSync(nativeResult.file), 'native 应产出 WAV');
    assert.equal(nativeResult.mime, 'audio/wav');
    assert.ok(nativeResult.durationMs > 0, 'native 应能读到时长');
  }

  // Breeze API：用本地假服务验证 PCM → WAV 包装与时长，不加载 7GB 模型。
  const fakePcm = Buffer.alloc(24_000); // 0.5s，24 kHz mono s16le
  let receivedBody = '';
  const fakeServer = http.createServer((request, response) => {
    if (request.url !== '/v1/audio/speech') {
      response.writeHead(404).end();
      return;
    }
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      receivedBody = Buffer.concat(chunks).toString('utf8');
      response.writeHead(200, {
        'content-type': 'audio/pcm',
        'x-sample-rate': '24000',
      });
      response.end(fakePcm);
    });
  });
  await new Promise((resolve) => fakeServer.listen(0, '127.0.0.1', resolve));
  try {
    const address = fakeServer.address();
    const breezeApi = media.createTtsProvider({
      provider: 'breeze',
      breezeApiUrl: `http://127.0.0.1:${address.port}`,
    });
    const breezeResult = await breezeApi.synthesize({
      text: '这是一次 Breeze API 测试。',
      instruction: 'warm and explanatory',
      output: path.join(tmp, 'breeze-smoke.wav'),
    });
    assert.ok(fs.existsSync(breezeResult.file), 'Breeze 应产出 WAV');
    assert.equal(breezeResult.mime, 'audio/wav');
    assert.ok(
      Math.abs(breezeResult.durationMs - 500) <= 60,
      `Breeze WAV 时长应接近 500ms，实际 ${breezeResult.durationMs}`,
    );
    assert.ok(receivedBody.includes('warm and explanatory'), 'Breeze 表单应带分节语气指令');
  } finally {
    await new Promise((resolve) => fakeServer.close(resolve));
  }

  console.log('ok · media tts phase 1.1');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}