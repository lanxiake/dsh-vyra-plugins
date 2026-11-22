/* ─────────────────────────────────────────────────────────────────────────
   StudyMate · 媒体域 —— 离线音频播放器

   一个自包含 HTML：音频 + 章节 + 相对倍速 + 倒退 15 秒 + 续听 + 文字稿链接。
   不依赖任何外部资源；`file://` 直接打开。它不是阅读端，只是音频产物的播放壳。
   ───────────────────────────────────────────────────────────────────────── */

import path from 'node:path';

import { escAttr, escText } from '../core/format.ts';
import type { MediaManifest } from './manifest.ts';
import type { LessonScript } from './script.ts';
import { writeFileAtomic } from './paths.ts';

export const PLAYER_FILE = 'player.html';

export interface PlayerOptions {
  script: LessonScript;
  manifest: MediaManifest;
  audioFile: string;
  transcriptFile: string;
}

function rateLabel(rate: string): string {
  const match = /^([+-]?)(\d+)%$/.exec(rate);
  if (!match) return rate ? `已内置 ${rate}` : '';
  const sign = match[1] === '-' ? -1 : 1;
  const value = 1 + sign * (Number(match[2]) / 100);
  return `已内置 ${value.toFixed(1)}×`;
}

function formatMs(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function buildPlayerHtml(options: PlayerOptions): string {
  const { script, manifest, audioFile, transcriptFile } = options;
  const chapters = (manifest.chapters && manifest.chapters.length > 0)
    ? manifest.chapters
    : [{ title: script.title, startMs: 0, endMs: manifest.durationMs ?? 0, sceneId: 's1' }];

  const provider = (manifest.provider ?? {}) as Record<string, unknown>;
  const voice = typeof provider.voice === 'string' ? provider.voice : '';
  const rate = typeof provider.rate === 'string' ? provider.rate : '';
  const builtIn = rateLabel(rate);
  const meta = [
    voice,
    builtIn,
    `${formatMs(manifest.durationMs ?? 0)}`,
    `${chapters.length} 章`,
  ].filter(Boolean).join(' · ');

  const data = JSON.stringify({
    subject: script.subject,
    node: script.node,
    title: script.title,
    chapters: chapters.map((chapter) => ({
      title: chapter.title,
      startMs: chapter.startMs,
      sceneId: chapter.sceneId,
    })),
  }).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escText(script.title)} · 音频课</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f6f7f9; color: #1b1f27; font: 15px/1.7 system-ui, -apple-system, "Segoe UI", "Noto Sans SC", sans-serif; }
  @media (prefers-color-scheme: dark) { body { background: #121417; color: #e8eaee; } }
  main { max-width: 760px; margin: 0 auto; padding: 48px 20px 80px; }
  h1 { font-size: 24px; line-height: 1.35; margin: 0 0 8px; }
  .meta { color: #667085; font-size: 13px; margin-bottom: 20px; }
  audio { width: 100%; margin: 8px 0 16px; }
  .bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 20px; }
  button, a.button { appearance: none; border: 1px solid #d0d5dd; background: transparent; color: inherit; border-radius: 8px; padding: 7px 11px; font: inherit; font-size: 13px; cursor: pointer; text-decoration: none; }
  button:hover, a.button:hover { background: rgba(127,127,127,.12); }
  button[aria-pressed="true"] { background: #1b1f27; color: #fff; border-color: #1b1f27; }
  @media (prefers-color-scheme: dark) { button[aria-pressed="true"] { background: #e8eaee; color: #121417; border-color: #e8eaee; } }
  .chapters { display: grid; gap: 8px; margin-top: 8px; }
  .chapter { display: flex; gap: 12px; align-items: baseline; text-align: left; width: 100%; }
  .chapter .time { color: #667085; font-variant-numeric: tabular-nums; font-size: 12px; min-width: 44px; }
  .chapter[aria-current="true"] { border-color: #1b1f27; }
  @media (prefers-color-scheme: dark) { .chapter[aria-current="true"] { border-color: #e8eaee; } }
  .hint { color: #667085; font-size: 13px; margin-top: 24px; }
  .hidden { display: none; }
</style>
</head>
<body>
<main>
  <h1>${escText(script.title)}</h1>
  <div class="meta">${escText(meta)}</div>
  <audio id="audio" controls preload="metadata" src="${escAttr(path.basename(audioFile))}"></audio>
  <div class="bar">
    <button type="button" id="rewind" aria-label="倒退 15 秒">↺ 15 秒</button>
    <button type="button" id="resume" class="hidden">继续上次</button>
    <span id="speeds" class="bar" role="group" aria-label="相对倍速"></span>
  </div>
  <div class="chapters" id="chapters" aria-label="章节"></div>
  <p class="hint">章节按真实 TTS 时长生成。文字稿：<a href="${escAttr(path.basename(transcriptFile))}">${escText(path.basename(transcriptFile))}</a>。音频已内置的倍速见上方；播放器里的倍速是相对倍速。</p>
</main>
<script>
  const DATA = ${data};
  const audio = document.getElementById('audio');
  const chapterBox = document.getElementById('chapters');
  const speedBox = document.getElementById('speeds');
  const resumeButton = document.getElementById('resume');
  const KEY_RATE = 'studymate:rate:' + DATA.subject + ':' + DATA.node;
  const KEY_POS = 'studymate:pos:' + DATA.subject + ':' + DATA.node;
  const RATES = [0.8, 1, 1.2, 1.5];
  let activeChapter = -1;
  let lastSaved = 0;

  function format(ms) {
    const total = Math.max(0, Math.round(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  function setRate(rate) {
    audio.playbackRate = rate;
    for (const button of speedBox.querySelectorAll('button')) {
      button.setAttribute('aria-pressed', String(Number(button.dataset.rate) === rate));
    }
    localStorage.setItem(KEY_RATE, String(rate));
  }

  for (const rate of RATES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.rate = String(rate);
    button.textContent = rate.toFixed(1).replace(/\.0$/, '') + '×';
    button.setAttribute('aria-label', '相对倍速 ' + button.textContent);
    button.addEventListener('click', () => setRate(rate));
    speedBox.appendChild(button);
  }

  DATA.chapters.forEach((chapter, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chapter';
    button.dataset.index = String(index);
    const time = document.createElement('span');
    time.className = 'time';
    time.textContent = format(chapter.startMs);
    const title = document.createElement('span');
    title.textContent = chapter.title;
    button.append(time, title);
    button.addEventListener('click', () => {
      audio.currentTime = chapter.startMs / 1000;
      audio.play().catch(() => {});
    });
    chapterBox.appendChild(button);
  });

  function highlight() {
    const now = audio.currentTime * 1000;
    let index = 0;
    for (let i = 0; i < DATA.chapters.length; i += 1) {
      if (now >= DATA.chapters[i].startMs) index = i;
    }
    if (index === activeChapter) return;
    activeChapter = index;
    for (const button of chapterBox.querySelectorAll('button')) {
      button.setAttribute('aria-current', String(Number(button.dataset.index) === index));
    }
  }

  function restoreResume() {
    const saved = Number(localStorage.getItem(KEY_POS) || '0');
    if (!Number.isFinite(saved) || saved <= 5) return;
    if (Number.isFinite(audio.duration) && saved >= audio.duration - 5) return;
    resumeButton.classList.remove('hidden');
    resumeButton.textContent = '继续上次 ' + format(saved * 1000);
    resumeButton.addEventListener('click', () => {
      audio.currentTime = saved;
      audio.play().catch(() => {});
      resumeButton.classList.add('hidden');
    }, { once: true });
  }

  audio.addEventListener('loadedmetadata', restoreResume);
  audio.addEventListener('timeupdate', () => {
    highlight();
    if (Math.abs(audio.currentTime - lastSaved) >= 5) {
      lastSaved = audio.currentTime;
      localStorage.setItem(KEY_POS, String(audio.currentTime));
    }
  });
  audio.addEventListener('ended', () => localStorage.removeItem(KEY_POS));

  document.getElementById('rewind').addEventListener('click', () => {
    audio.currentTime = Math.max(0, audio.currentTime - 15);
  });

  document.addEventListener('keydown', (event) => {
    if (event.target && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (event.code === 'Space') { event.preventDefault(); audio.paused ? audio.play().catch(() => {}) : audio.pause(); }
    if (event.code === 'ArrowLeft') { event.preventDefault(); audio.currentTime = Math.max(0, audio.currentTime - 15); }
    if (event.code === 'ArrowRight') { event.preventDefault(); audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + 15); }
  });

  const savedRate = Number(localStorage.getItem(KEY_RATE) || '1');
  setRate(RATES.includes(savedRate) ? savedRate : 1);
</script>
</body>
</html>
`;
}

export function writePlayer(dir: string, options: PlayerOptions): string {
  const file = path.join(dir, PLAYER_FILE);
  writeFileAtomic(file, buildPlayerHtml(options));
  return file;
}
