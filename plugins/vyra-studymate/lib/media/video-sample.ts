/* ─────────────────────────────────────────────────────────────────────────
   StudyMate · 媒体域 —— 第 1 课视频样片

   6 张幻灯片，覆盖 s1/s2：标题 → 三关 → 第一关 → 缺口 → 放到产品上 → 小结。
   画面是静态的；先用 code-video-showcase 的 Playwright + FFmpeg 管线出样片，
   后续再把关键页换成短动画。
   ───────────────────────────────────────────────────────────────────────── */

import { escText } from '../core/format.ts';
import type { LessonScript, LessonVisual } from './script.ts';

export interface VideoExample {
  label: string;
  text: string;
  tone: 'bad' | 'good';
}

export interface VideoSlide {
  id: string;
  eyebrow: string;
  title: string;
  narration: string;
  kind: 'title' | 'content' | 'examples' | 'quote';
  bullets?: string[];
  examples?: VideoExample[];
  svg?: string;
  quote?: string;
  note?: string;
  subtitle?: string;
  table?: { header: string[]; rows: string[][] };
  animation?: 'fade-title' | 'reveal-groups' | 'reveal-content';
  animationIntroMs?: number;
}

export interface VideoStoryboard {
  version: 1;
  kind: 'video-storyboard';
  lesson: string;
  node: string;
  title: string;
  slides: VideoSlide[];
}

function svgsOf(script: LessonScript): string[] {
  return script.scenes
    .flatMap((scene) => scene.visuals)
    .filter((visual) => visual.type === 'svg' && typeof visual.raw === 'string' && visual.raw.trim() !== '')
    .map((visual) => visual.raw as string);
}

export function buildSampleStoryboard(script: LessonScript): VideoStoryboard {
  const svgs = svgsOf(script);
  const funnel = svgs[0] ?? '';
  const gap = svgs[1] ?? '';
  const slides: VideoSlide[] = [
    {
      id: 's1',
      kind: 'title',
      eyebrow: '第 1 课 · 自媒体内容制作',
      title: '一条内容为什么会被看完',
      narration: '先别急着介绍你的产品。想象一个读者，手指正在往上划。他停下来，通常不是因为你写得全，而是因为他认出了自己的处境。',
    },
    {
      id: 's2',
      kind: 'content',
      eyebrow: '第一关之前',
      title: '一条内容要过三关',
      bullets: ['被点开', '被读完', '被照着做'],
      svg: funnel,
      narration: '这一节只做一件事：把内容要过的三关分开。被点开、被读完、被照着做。三关失效的原因不同，要修的地方也不同。',
    },
    {
      id: 's3',
      kind: 'content',
      eyebrow: '第一关',
      title: '被点开：注意力有限',
      bullets: ['他在扫，不在读', '停下来需要两件事同时成立', '注意力有限，不是读者浮躁'],
      narration: '刷首页的人不是在阅读，是在扫。要让他的手指停一下，需要两件事同时成立。第一，注意力有限。第二，有一个刚好够大的信息缺口。',
    },
    {
      id: 's4',
      kind: 'content',
      eyebrow: '第一关',
      title: '缺口：太小不值钱，太大跟我无关',
      bullets: ['太小：答案看起来不值钱', '太大：读者觉得跟自己无关', '中间那一段才好用'],
      svg: gap,
      narration: '缺口太小，他觉得答案不值钱。缺口太大，他觉得跟自己无关。中间那一段才好用。',
    },
    {
      id: 's5',
      kind: 'examples',
      eyebrow: '第一关',
      title: '放到你的产品上',
      examples: [
        { label: '产品自述', text: '我做了个模板包，支持 12 种场景。', tone: 'bad' },
        { label: '读者处境', text: '每次做周报，你都要把数据一条条粘进表格里。', tone: 'good' },
      ],
      narration: '「我做了个模板包」，不构成缺口。读者不知道这跟他有什么关系。「每次做周报都要手动粘数据」，他才对上号。',
    },
    {
      id: 's6',
      kind: 'quote',
      eyebrow: '这一节的关键',
      title: '钩子要卡在「跟他有关」和「他还不知道」之间',
      quote: '钩子要卡在「跟他有关」和「他还不知道」之间。',
      note: '下一课：推荐机制与内容漏斗。',
      narration: '你可以暂停一下，想想你最近刷到的一条内容。这一节的关键是：钩子要卡在「跟他有关」和「他还不知道」之间。',
    },
  ];
  return {
    version: 1,
    kind: 'video-storyboard',
    lesson: script.source.lesson,
    node: script.node,
    title: script.title,
    slides,
  };
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[。！？!?；;])/u).map((part) => part.trim()).filter(Boolean);
}
function shortTitle(text: string): string {
  const first = splitSentences(text)[0] || text;
  return [...first.split(/[，,：:]/)[0].replace(/[。！？!?；;]$/u, '')].slice(0, 22).join('');
}
function shortBullet(text: string): string {
  const chars = [...text.replace(/[。！？!?；;：:，,]$/u, '')];
  return chars.slice(0, 42).join('') + (chars.length > 42 ? '…' : '');
}
function groupParagraphs(paragraphs: string[]): string[][] {
  const groups: string[][] = [];
  let current: string[] = [];
  for (const paragraph of paragraphs) {
    const nextLength = [...current.join('\n\n')].length + [...paragraph].length;
    if (current.length >= 2 || (current.length >= 1 && nextLength > 220)) {
      groups.push(current);
      current = [];
    }
    current.push(paragraph);
  }
  if (current.length > 0) groups.push(current);
  return groups;
}
function textSlide(
  scene: LessonScript['scenes'][number],
  group: string[],
  index: number,
): VideoSlide {
  const sentences = splitSentences(group.join(' '));
  const title = index === 0 ? scene.heading : (shortTitle(group[0]) || scene.heading);
  let bullets = (index === 0 ? sentences : sentences.slice(1)).slice(0, 3).map(shortBullet);
  if (bullets.length === 0) bullets = sentences.slice(0, 2).map(shortBullet);
  return {
    id: `${scene.id}-t${index + 1}`,
    kind: 'content',
    eyebrow: `第 1 课 · ${scene.heading}`,
    title,
    bullets,
    narration: group.join('\n\n'),
    animation: 'reveal-content',
    animationIntroMs: 2000,
  };
}
function specialSlide(
  scene: LessonScript['scenes'][number],
  visual: LessonVisual,
  suffix: number,
): VideoSlide | null {
  const eyebrow = `第 1 课 · ${scene.heading}`;
  if (visual.type === 'svg') {
    return {
      id: `${scene.id}-v${suffix}`, kind: 'content', eyebrow, title: scene.heading,
      bullets: [shortBullet(visual.caption || visual.alt || '看这张示意图')],
      svg: visual.raw, animation: 'reveal-groups', narration: '',
    };
  }
  if (visual.type === 'table') {
    return {
      id: `${scene.id}-v${suffix}`, kind: 'content', eyebrow, title: '看这张表',
      table: { header: visual.header, rows: visual.rows }, animation: 'reveal-content', narration: '',
    };
  }
  if (visual.type === 'practice') {
    const first = splitSentences(visual.body || '')[0] || '';
    return {
      id: `${scene.id}-v${suffix}`, kind: 'content', eyebrow,
      title: visual.title || '动手练习',
      bullets: first ? [shortBullet(first)] : [],
      animation: 'reveal-content', narration: '',
    };
  }
  if (visual.type === 'quiz') {
    return {
      id: `${scene.id}-v${suffix}`, kind: 'content', eyebrow, title: '想一想',
      bullets: [shortBullet(visual.text || '')].filter(Boolean),
      animation: 'reveal-content', narration: '',
    };
  }
  return null;
}
export function buildFullStoryboard(script: LessonScript): VideoStoryboard {
  const slides: VideoSlide[] = [{
    id: 'title', kind: 'title', eyebrow: '第 1 课', title: script.title,
    subtitle: '先让读者认出自己的处境，再谈你的产品。', animation: 'fade-title', narration: '',
  }];
  for (const scene of script.scenes) {
    const paragraphs = scene.narration
      .split(/\n\s*\n/)
      .map((part) => part.trim())
      .filter((part) => part !== '' && !part.startsWith('这一节有一道题'));
    if (paragraphs.length === 0) continue;
    const groups = groupParagraphs(paragraphs);
    const specials = scene.visuals.filter((visual) =>
      visual.type === 'svg' || visual.type === 'table' || visual.type === 'practice' || visual.type === 'quiz');
    const after = new Map<number, LessonVisual[]>();
    specials.forEach((visual, index) => {
      const position = Math.max(0, Math.min(groups.length, Math.ceil(((index + 1) * groups.length) / (specials.length + 1))));
      const list = after.get(position) || [];
      list.push(visual);
      after.set(position, list);
    });
    for (const visual of after.get(0) || []) {
      const slide = specialSlide(scene, visual, slides.length);
      if (slide) slides.push(slide);
    }
    groups.forEach((group, index) => {
      slides.push(textSlide(scene, group, index));
      for (const visual of after.get(index + 1) || []) {
        const slide = specialSlide(scene, visual, slides.length);
        if (slide) slides.push(slide);
      }
    });
  }
  return {
    version: 1,
    kind: 'video-storyboard',
    lesson: script.source.lesson,
    node: script.node,
    title: script.title,
    slides,
  };
}

export function slideCss(): string {
  return `
  .slide, .slide * { box-sizing: border-box; }
  .slide { width:1920px; height:1080px; padding:110px 140px; display:flex; flex-direction:column; justify-content:center; background:#f2eee6; color:#1c1917; font-family: "Noto Sans SC", "Microsoft YaHei", system-ui, sans-serif; position:relative; overflow:hidden; }
  .slide::after { content:""; position:absolute; left:140px; right:140px; bottom:64px; height:2px; background:#1c1917; opacity:.16; }
  .slide .eyebrow { font-size:32px; letter-spacing:.08em; color:#b45309; font-weight:650; margin-bottom:28px; }
  .slide h1 { font-size:104px; line-height:1.12; margin:0; letter-spacing:-.04em; max-width:1500px; }
  .slide h2 { font-size:72px; line-height:1.18; margin:0 0 44px; letter-spacing:-.03em; max-width:1600px; }
  .slide .subtitle { font-size:38px; color:#57534e; margin-top:30px; max-width:1300px; }
  .slide .cols { display:grid; grid-template-columns: 1.05fr .95fr; gap:80px; align-items:center; }
  .slide ul { margin:0; padding-left:44px; }
  .slide li { font-size:42px; line-height:1.55; margin:14px 0; }
  .slide li::marker { color:#b45309; }
  .slide .figure { display:flex; align-items:center; justify-content:center; min-height:540px; }
  .slide .figure svg { width:100%; height:auto; max-height:560px; color:#1c1917; }
  .slide table { width:100%; border-collapse:collapse; font-size:28px; line-height:1.5; }
  .slide th, .slide td { border:1px solid #d6d3d1; padding:14px 18px; text-align:left; vertical-align:top; word-break:break-word; }
  .slide th { background:#e7e2d8; font-weight:700; }
  .slide .examples { display:grid; grid-template-columns:1fr 1fr; gap:44px; margin-top:20px; }
  .slide .example { border-radius:28px; padding:42px 44px; border:2px solid #d6d3d1; background:#faf9f7; min-height:300px; }
  .slide .example.bad { border-color:#e7b4a2; background:#fdf1ec; }
  .slide .example.good { border-color:#9fd4c5; background:#eefaf6; }
  .slide .example .label { font-size:28px; font-weight:700; letter-spacing:.06em; margin-bottom:22px; }
  .slide .example.bad .label { color:#b42318; }
  .slide .example.good .label { color:#067647; }
  .slide .example .text { font-size:40px; line-height:1.45; }
  .slide.quote-slide { justify-content:center; align-items:flex-start; }
  .slide.quote-slide .quote { font-size:88px; line-height:1.28; letter-spacing:-.04em; max-width:1580px; }
  .slide.quote-slide .note { margin-top:52px; font-size:32px; color:#57534e; }
  .slide .mark { position:absolute; right:140px; top:82px; font-size:26px; letter-spacing:.12em; color:#78716c; }
  `;
}

export function slidePageBaseCss(): string {
  return `
  html, body { margin:0; padding:0; }
  body { background:#f2eee6; color:#1c1917; font-family: "Noto Sans SC", "Microsoft YaHei", system-ui, sans-serif; }
  `;
}

export function slideBodyHtml(slide: VideoSlide): string {
  const eyebrow = `<div class="eyebrow">${escText(slide.eyebrow)}</div>`;
  if (slide.kind === 'title') {
    return `<div class="slide slide--title"><div class="mark">STUDYMATE</div>${eyebrow}<h1>${escText(slide.title)}</h1><div class="subtitle">${escText(slide.subtitle || '先让读者认出自己的处境，再谈你的产品。')}</div></div>`;
  }
  if (slide.table) {
    const head = slide.table.header.map((cell) => `<th>${escText(cell)}</th>`).join('');
    const rows = slide.table.rows.map((row) => `<tr>${row.map((cell) => `<td>${escText(cell)}</td>`).join('')}</tr>`).join('');
    return `<div class="slide">${eyebrow}<h2>${escText(slide.title)}</h2><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  if (slide.kind === 'quote') {
    return `<div class="slide quote-slide"><div class="mark">STUDYMATE</div>${eyebrow}<div class="quote">${escText(slide.quote || slide.title)}</div>${slide.note ? `<div class="note">${escText(slide.note)}</div>` : ''}</div>`;
  }
  if (slide.kind === 'examples') {
    const cards = (slide.examples || []).map((example) => `<div class="example ${example.tone}"><div class="label">${escText(example.label)}</div><div class="text">${escText(example.text)}</div></div>`).join('');
    return `<div class="slide">${eyebrow}<h2>${escText(slide.title)}</h2><div class="examples">${cards}</div></div>`;
  }
  const bullets = (slide.bullets || []).map((item) => `<li>${escText(item)}</li>`).join('');
  const text = bullets ? `<ul>${bullets}</ul>` : '';
  const figure = slide.svg ? `<div class="figure">${slide.svg}</div>` : '';
  return `<div class="slide">${eyebrow}<h2>${escText(slide.title)}</h2><div class="cols"><div>${text}</div>${figure}</div></div>`;
}

export function slidePageHtml(slide: VideoSlide): string {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<style>${slidePageBaseCss()}${slideCss()}</style></head><body>${slideBodyHtml(slide)}
<script>window.DURATION=1;window.__ready=true;window.__bootError=null;window.renderFrame=function(){};</script>
</body></html>`;
}

export function animatedSlidePageHtml(slide: VideoSlide, durationMs: number): string {
  const duration = Math.max(0.5, durationMs / 1000);
  const mode = slide.animation ?? '';
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<style>${slidePageBaseCss()}${slideCss()}</style></head><body>${slideBodyHtml(slide)}
<script>
window.DURATION=${duration};
window.__ready=true;
window.__bootError=null;
window.renderFrame=function(t){
  var mode=${JSON.stringify(mode)};
  if (mode==='fade-title') {
    var h1=document.querySelector('.slide h1');
    var sub=document.querySelector('.slide .subtitle');
    if (h1) { var p=Math.min(1,Math.max(0,t/1.1)); var e=1-Math.pow(1-p,3); h1.style.opacity=String(e); h1.style.transform='translateY('+((1-e)*48)+'px)'; }
    if (sub) { var q=Math.min(1,Math.max(0,(t-0.5)/1.0)); sub.style.opacity=String(q); }
  }
  if (mode==='reveal-groups') {
    var svg=document.querySelector('.slide .figure svg');
    if (svg) {
      var groups=Array.prototype.slice.call(svg.children).filter(function(el){return el.tagName && el.tagName.toLowerCase()==='g';});
      groups.forEach(function(g,i){
        var start=0.2+i*0.3;
        var p=Math.min(1,Math.max(0,(t-start)/0.7));
        g.style.opacity=String(p);
        g.style.transform='translateY('+((1-p)*10)+'px)';
        g.style.transformOrigin='center';
      });
    }
  }
  if (mode==='reveal-content') {
    var show=function(el,start,dur,dy){
      if(!el) return;
      var p=Math.min(1,Math.max(0,(t-start)/dur));
      el.style.opacity=String(p);
      el.style.transform='translateY('+((1-p)*(dy||8))+'px)';
    };
    show(document.querySelector('.slide .eyebrow'),0,0.35,4);
    show(document.querySelector('.slide h2'),0.1,0.45,16);
    Array.prototype.forEach.call(document.querySelectorAll('.slide li'),function(el,i){ show(el,0.45+i*0.15,0.35,8); });
    Array.prototype.forEach.call(document.querySelectorAll('.slide .example'),function(el,i){ show(el,0.4+i*0.2,0.4,10); });
    Array.prototype.forEach.call(document.querySelectorAll('.slide table tr'),function(el,i){ show(el,0.35+i*0.12,0.3,6); });
    show(document.querySelector('.slide .quote'),0.15,0.5,16);
  }
};
</script>
</body></html>`;
}

function jsonForScript(value: unknown): string {
  const lineSeparator = String.fromCharCode(0x2028);
  const paragraphSeparator = String.fromCharCode(0x2029);
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .split(lineSeparator).join('\\u2028')
    .split(paragraphSeparator).join('\\u2029');
}

export interface TimedSlide extends VideoSlide {
  startMs: number;
  endMs: number;
  body: string;
}

export function videoPlayerHtml(options: {
  title: string;
  audioFile: string;
  slides: TimedSlide[];
  durationMs: number;
}): string {
  const data = jsonForScript({
    title: options.title,
    audioFile: options.audioFile,
    durationMs: options.durationMs,
    slides: options.slides,
  });
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escText(options.title)} · 视频课</title>
<style>
  :root { color-scheme: dark; }
  ${slideCss()}
  * { box-sizing: border-box; }
  body { margin:0; background:#0f1115; color:#e8eaee; font:15px/1.7 system-ui,"Noto Sans SC",sans-serif; }
  main { max-width:1180px; margin:0 auto; padding:36px 20px 70px; }
  h1 { font-size:22px; margin:0 0 6px; }
  .muted { color:#98a2b3; font-size:13px; }
  .stagewrap { position:relative; width:100%; margin:18px 0 14px; border-radius:14px; overflow:hidden; background:#f2eee6; }
  .stage { width:1920px; height:1080px; transform-origin:top left; position:absolute; left:0; top:0; }
  .stage .slide { width:1920px; height:1080px; animation: smb-slide-in .45s ease-out, smb-zoom 24s linear forwards; }
  @keyframes smb-slide-in { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:none; } }
  @keyframes smb-zoom { from { scale:1; } to { scale:1.03; } }
  @keyframes smb-item-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
  .stage .slide .eyebrow, .stage .slide h2, .stage .slide li, .stage .slide .example, .stage .slide .quote { animation: smb-item-in .35s ease-out both; }
  .stage .slide h2 { animation-delay: .08s; }
  .stage .slide li:nth-child(2) { animation-delay: .16s; }
  .stage .slide li:nth-child(3) { animation-delay: .24s; }
  .stage .slide li:nth-child(4) { animation-delay: .32s; }
  .stage .slide .example:nth-child(2) { animation-delay: .16s; }
  audio { width:100%; margin:8px 0 14px; }
  .bar { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin:10px 0; }
  button { appearance:none; border:1px solid #2a2f36; background:#1a1d21; color:#e8eaee; border-radius:8px; padding:7px 11px; font:inherit; font-size:13px; cursor:pointer; }
  button[aria-pressed="true"] { background:#e8eaee; color:#0f1115; }
  .list { display:grid; gap:8px; margin-top:14px; }
  .list button { text-align:left; display:flex; gap:12px; align-items:baseline; }
  .list .time { color:#98a2b3; font-variant-numeric:tabular-nums; min-width:44px; }
  .list button[aria-current="true"] { border-color:#e8eaee; }
  .caption { min-height:26px; margin-top:10px; padding:10px 12px; border-radius:10px; background:#161a1f; color:#d0d5dd; font-size:13px; line-height:1.65; white-space:pre-wrap; }
</style>
</head>
<body>
<main>
  <h1>${escText(options.title)}</h1>
  <div class="muted">第 1 课视频样片 · edge-tts 旁白 · 1.2× · 静态幻灯片 + 字幕</div>
  <div class="stagewrap" id="stagewrap"><div class="stage" id="stage"></div></div>
  <audio id="audio" controls preload="metadata" src="${options.audioFile}"></audio>
  <div class="bar">
    <button type="button" id="captions" aria-pressed="true">字幕开</button>
    <span class="muted" id="position"></span>
  </div>
  <div class="caption" id="caption"></div>
  <div class="list" id="list"></div>
</main>
<script>
  const DATA = ${data};
  const stage = document.getElementById('stage');
  const stagewrap = document.getElementById('stagewrap');
  const audio = document.getElementById('audio');
  const caption = document.getElementById('caption');
  const position = document.getElementById('position');
  const captionsButton = document.getElementById('captions');
  const list = document.getElementById('list');
  let active = -1;
  let captionsOn = true;

  function format(ms) {
    const total = Math.max(0, Math.round(ms / 1000));
    return Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0');
  }
  function fit() { const scale = stagewrap.clientWidth / 1920; stage.style.transform = 'scale(' + scale + ')'; stagewrap.style.height = (1080 * scale) + 'px'; }
  function show(index) {
    if (index === active) return;
    active = index;
    const slide = DATA.slides[index];
    if (!slide) return;
    stage.innerHTML = slide.body;
    caption.textContent = captionsOn ? slide.narration : '';
    for (const button of list.querySelectorAll('button')) button.setAttribute('aria-current', String(Number(button.dataset.index) === index));
  }
  function tick() {
    const now = audio.currentTime * 1000;
    let index = 0;
    for (let i = 0; i < DATA.slides.length; i += 1) if (now >= DATA.slides[i].startMs) index = i;
    show(index);
    position.textContent = format(now) + ' / ' + format(DATA.durationMs);
  }
  DATA.slides.forEach((slide, index) => {
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.index = String(index);
    const time = document.createElement('span'); time.className = 'time'; time.textContent = format(slide.startMs);
    const title = document.createElement('span'); title.textContent = slide.title;
    button.append(time, title);
    button.addEventListener('click', () => { audio.currentTime = slide.startMs / 1000; audio.play().catch(() => {}); });
    list.appendChild(button);
  });
  captionsButton.addEventListener('click', () => {
    captionsOn = !captionsOn;
    captionsButton.setAttribute('aria-pressed', String(captionsOn));
    captionsButton.textContent = captionsOn ? '字幕开' : '字幕关';
    tick();
    if (!captionsOn) caption.textContent = '';
  });
  window.addEventListener('resize', fit);
  audio.addEventListener('timeupdate', tick);
  fit(); show(0); tick();
</script>
</body>
</html>`;
}