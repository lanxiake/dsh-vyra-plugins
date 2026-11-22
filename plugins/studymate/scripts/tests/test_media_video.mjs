// 视频样片：分镜、幻灯片页面、video-web 数据内联。真实渲染与 ffmpeg 由 media-video.mjs 跑。
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

const PILOT = {
  workspace: 'C:/Users/Administrator/StudyMate',
  subject: 'self-media-product-launch',
  node: 'intro.why-content-works',
};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'studymate-video-'));
try {
  const plan = media.planLesson({ ...PILOT, root: tmp });
  assert.ok(plan.script, '应生成脚本');
  assert.equal(plan.errors.length, 0);

  const storyboard = media.buildFullStoryboard(plan.script);
  assert.ok(storyboard.slides.length > 10, '整课应生成多张幻灯片');
  assert.equal(storyboard.slides[0].kind, 'title');
  assert.ok(storyboard.slides.some((slide) => typeof slide.svg === 'string' && slide.svg.includes('<svg')));
  assert.ok(storyboard.slides.some((slide) => slide.table !== undefined), '应有表格页');
  assert.ok(storyboard.slides.some((slide) => slide.title === '想一想'), '应有题目页');
  assert.ok(storyboard.slides.some((slide) => slide.kind === 'content' && slide.narration === ''), '应有短暂停页');
  assert.ok(storyboard.slides.filter((slide) => slide.narration !== '').length > 5);
  assert.ok(storyboard.slides.some((slide) => slide.animation === 'fade-title'), '标题页应带动画');
  assert.ok(storyboard.slides.some((slide) => slide.animation === 'reveal-groups'), '示意图页应带动画');
  const contentSlide = storyboard.slides.find((slide) => slide.animation === 'reveal-content');
  assert.ok(contentSlide, '内容页应带动画');
  assert.equal(contentSlide.animationIntroMs, 2000);
  const animatedPage = media.animatedSlidePageHtml(storyboard.slides[0], 2500);
  assert.ok(animatedPage.includes('window.renderFrame'));
  assert.ok(animatedPage.includes('fade-title'));
  const contentPage = media.animatedSlidePageHtml(contentSlide, 2000);
  assert.ok(contentPage.includes('reveal-content'));
  assert.ok(contentPage.includes('window.DURATION=2'));

  const firstPage = media.slidePageHtml(storyboard.slides[0]);
  assert.ok(firstPage.includes('window.__ready=true'), '渲染器需要 __ready');
  assert.ok(firstPage.includes('一条内容为什么会被看完'));
  assert.ok(firstPage.includes('slideCss') === false && firstPage.includes('.slide'), '页面应带幻灯片样式');

  const timed = storyboard.slides.map((slide, index) => ({
    ...slide,
    startMs: index * 8000,
    endMs: (index + 1) * 8000,
    body: media.slideBodyHtml(slide),
  }));
  const player = media.videoPlayerHtml({
    title: storyboard.title,
    audioFile: 'audio.mp3',
    slides: timed,
    durationMs: timed.length * 8000,
  });
  assert.ok(player.includes('const DATA ='), '播放器应内联分镜数据');
  assert.ok(player.includes('audio.mp3'));
  assert.ok(player.includes(storyboard.slides[0].title));
  assert.ok(player.includes('字幕开'));

  console.log('ok · media video');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}