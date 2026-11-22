/* ─────────────────────────────────────────────────────────────────────────
   StudyMate · 媒体域 —— 互动游戏页面

   自包含 HTML：数据内联、无外部资源、`file://` 可玩。运行时只做三件事：
   地图解锁、关卡判分 / 自评、localStorage 存档。在 DSH 里额外 best-effort 写 attempts。
   ───────────────────────────────────────────────────────────────────────── */

import { escText } from '../core/format.ts';
import type { GameSpec } from './game.ts';

function jsonForScript(value: unknown): string {
  const lineSeparator = String.fromCharCode(0x2028);
  const paragraphSeparator = String.fromCharCode(0x2029);
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .split(lineSeparator).join('\\u2028')
    .split(paragraphSeparator).join('\\u2029');
}

export function buildGameHtml(spec: GameSpec): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escText(spec.title)} · 闯关</title>
<style>
  :root { color-scheme: light dark; --bg:#f6f7f9; --panel:#fff; --ink:#1b1f27; --muted:#667085; --line:#e4e7ec; --brand:#1b1f27; --good:#067647; --bad:#b42318; --accent:#175cd3; }
  @media (prefers-color-scheme: dark) { :root { --bg:#121417; --panel:#1a1d21; --ink:#e8eaee; --muted:#98a2b3; --line:#2a2f36; --brand:#e8eaee; --good:#75e0a7; --bad:#fda29b; --accent:#84adff; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.7 system-ui,-apple-system,"Segoe UI","Noto Sans SC",sans-serif; }
  header { max-width:900px; margin:0 auto; padding:28px 20px 8px; }
  h1 { font-size:22px; line-height:1.35; margin:0 0 6px; }
  .muted { color:var(--muted); font-size:13px; }
  main { max-width:900px; margin:0 auto; padding:12px 20px 80px; }
  .row { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
  .spacer { flex:1; }
  button { appearance:none; border:1px solid var(--line); background:var(--panel); color:var(--ink); border-radius:10px; padding:9px 13px; font:inherit; font-size:14px; cursor:pointer; }
  button:hover:not(:disabled) { border-color:var(--muted); }
  button:disabled { opacity:.45; cursor:not-allowed; }
  button.primary { background:var(--brand); color:var(--bg); border-color:var(--brand); }
  .workshop-banner { display:block; margin:14px 0 0; padding:12px 14px; border:1px solid color-mix(in srgb,var(--accent) 45%,var(--line)); border-radius:12px; text-decoration:none; color:inherit; background:color-mix(in srgb,var(--panel) 80%,var(--bg)); }
  .map { display:grid; gap:12px; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); margin-top:14px; }
  .card { text-align:left; padding:14px; border-radius:14px; background:var(--panel); border:1px solid var(--line); display:flex; flex-direction:column; gap:6px; min-height:132px; }
  .card.locked { opacity:.55; }
  .card .num { font-size:12px; color:var(--muted); letter-spacing:.04em; }
  .card .title { font-weight:650; line-height:1.35; }
  .card .meta { font-size:12px; color:var(--muted); }
  .card .best { margin-top:auto; font-size:12px; color:var(--good); }
  .levelhead { display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin:4px 0 14px; }
  .levelhead h2 { font-size:19px; margin:0; }
  .qcard { background:var(--panel); border:1px solid var(--line); border-radius:16px; padding:20px; }
  .qtext { font-size:16px; line-height:1.75; white-space:pre-wrap; margin:0 0 14px; }
  .opts { display:grid; gap:8px; }
  .opt { text-align:left; white-space:pre-wrap; }
  .opt.correct { border-color:var(--good); color:var(--good); }
  .opt.wrong { border-color:var(--bad); color:var(--bad); }
  .feedback { margin-top:14px; padding:12px 14px; border-radius:12px; border:1px solid var(--line); background:color-mix(in srgb,var(--panel) 85%,var(--bg)); white-space:pre-wrap; }
  .feedback.good { border-color:color-mix(in srgb,var(--good) 45%,var(--line)); }
  .feedback.bad { border-color:color-mix(in srgb,var(--bad) 45%,var(--line)); }
  .ref { margin-top:12px; padding:12px 14px; border:1px dashed var(--line); border-radius:12px; white-space:pre-wrap; }
  textarea { width:100%; min-height:96px; padding:10px 12px; border-radius:10px; border:1px solid var(--line); background:var(--bg); color:var(--ink); font:inherit; resize:vertical; }
  .bar { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-top:14px; }
  .result { background:var(--panel); border:1px solid var(--line); border-radius:16px; padding:24px; text-align:center; }
  .result .score { font-size:40px; font-weight:750; margin:8px 0; }
  .sync { font-size:12px; color:var(--muted); }
  .warn { margin-top:14px; padding:10px 12px; border-radius:10px; border:1px solid color-mix(in srgb,var(--accent) 35%,var(--line)); color:var(--muted); font-size:12px; }
  @media (max-width:600px) { header,main { padding-left:14px; padding-right:14px; } .qcard { padding:16px; } }
</style>
</head>
<body>
<header>
  <h1>${escText(spec.title)} · 闯关</h1>
  <div class="row"><span class="muted" id="meta"></span><span class="spacer"></span><span class="sync" id="sync"></span></div>
</header>
<main id="app"></main>
<script>
  const DATA = ${jsonForScript(spec)};
  const app = document.getElementById('app');
  const meta = document.getElementById('meta');
  const syncBadge = document.getElementById('sync');
  const KEY = 'studymate:game:' + DATA.subject;
  const hasHttp = location.protocol === 'http:' || location.protocol === 'https:';

  function loadProgress() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
      return { completed: raw.completed || {}, best: raw.best || {} };
    } catch (error) {
      return { completed: {}, best: {} };
    }
  }
  function saveProgress() {
    try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch (error) { /* 隐私模式：只保留内存进度 */ }
  }

  function el(tag, props) {
    const node = document.createElement(tag);
    if (props) {
      for (const key of Object.keys(props)) {
        const value = props[key];
        if (value === undefined || value === null) continue;
        if (key === 'class') node.className = value;
        else if (key === 'text') node.textContent = value;
        else if (key === 'on') {
          for (const event of Object.keys(value)) node.addEventListener(event, value[event]);
        } else if (key.startsWith('on') && typeof value === 'function') {
          node.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (key === 'dataset') Object.assign(node.dataset, value);
        else if (key in node && typeof value !== 'string') node[key] = value;
        else node.setAttribute(key, value);
      }
    }
    for (let i = 2; i < arguments.length; i += 1) {
      const child = arguments[i];
      if (child === undefined || child === null) continue;
      if (Array.isArray(child)) {
        for (const item of child) if (item !== undefined && item !== null) node.append(item.nodeType ? item : document.createTextNode(String(item)));
      } else {
        node.append(child.nodeType ? child : document.createTextNode(String(child)));
      }
    }
    return node;
  }

  function levelIndex(id) {
    return DATA.levels.findIndex(function (level) { return level.id === id; });
  }
  function unlocked(index) {
    if (index === 0) return true;
    return DATA.levels.slice(0, index).every(function (level) { return !!progress.completed[level.id]; });
  }
  function prereqText(ids) {
    return (ids || []).map(function (id) {
      const level = DATA.levels.find(function (item) { return item.id === id; });
      return level ? level.title : id;
    }).join('、');
  }
  function qLabel(question, index) {
    return '第 ' + (index + 1) + ' / ' + state.level.questions.length + ' 题';
  }
  function syncStatus(text) {
    state.sync = text;
    syncBadge.textContent = text;
  }
  function operationId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return 'g-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  async function refreshVersions() {
    if (!hasHttp) return;
    try {
      const response = await fetch(DATA.libraryEndpoint);
      if (!response.ok) return;
      const library = await response.json();
      const subject = (library.subjects || []).find(function (item) { return item.slug === DATA.subject; });
      if (!subject) return;
      for (const level of DATA.levels) {
        const node = (subject.nodes || []).find(function (item) { return item.id === level.id; });
        if (node && node.attempts && node.attempts.version) level.attemptsVersion = node.attempts.version;
      }
    } catch (error) { /* 离线或 API 不可用：保持构建时的版本 */ }
  }

  async function syncAttempt(level, question, patch) {
    if (!hasHttp) { syncStatus('离线：进度仅存本地'); return; }
    try {
      const body = {
        subject: DATA.subject,
        node: level.id,
        questions: {},
        operationId: operationId(),
        expectedVersion: level.attemptsVersion,
      };
      body.questions[question.id] = patch;
      const response = await fetch(DATA.attemptsEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const reply = await response.json().catch(function () { return null; });
      if (response.ok && reply && reply.version) {
        level.attemptsVersion = reply.version;
        syncStatus('已同步');
        return;
      }
      if (response.status === 409) {
        syncStatus('版本冲突：本地进度保留');
        await refreshVersions();
        return;
      }
      syncStatus('未同步：本地进度保留');
    } catch (error) {
      syncStatus('离线：进度仅存本地');
    }
  }

  const progress = loadProgress();
  const state = {
    view: 'map', level: null, index: 0, lives: 3, score: 0, streak: 0,
    correct: 0, total: 0, answers: {}, drafts: {}, review: [], mode: 'play',
    feedback: null, revealed: false, sync: '',
  };
  let syncQueue = Promise.resolve();
  function enqueueSync(level, question, patch) {
    syncQueue = syncQueue.then(function () {
      return syncAttempt(level, question, patch);
    }).catch(function () { /* 单次同步失败不阻塞下一题 */ });
  }

  function renderMeta() {
    const done = Object.keys(progress.completed).length;
    meta.textContent = DATA.levels.length + ' 关 · 已完成 ' + done + ' / ' + DATA.levels.length;
  }

  function renderMap() {
    renderMeta();
    const wrap = el('div');
    if (DATA.workshop) {
      wrap.append(el('a', { class: 'workshop-banner', href: DATA.workshop.file }, DATA.workshop.title + ' →'));
    }
    wrap.append(el('div', { class: 'map' }, DATA.levels.map(function (level, index) {
      const open = unlocked(index) || !!progress.completed[level.id];
      const best = progress.best[level.id];
      const done = !!progress.completed[level.id];
      return el('button', {
        class: 'card' + (open ? '' : ' locked'),
        disabled: !open,
        onClick: function () { if (open) startLevel(level); },
        title: open ? '开始这一关' : '完成上一关后解锁',
      },
        el('div', { class: 'num', text: (level.number ? '第 ' + level.number + ' 关' : '第 ' + (index + 1) + ' 关') + ' · ' + level.kind }),
        el('div', { class: 'title', text: level.title }),
        el('div', { class: 'meta', text: level.questions.length + ' 题' + (level.prerequisites.length ? ' · 前置：' + prereqText(level.prerequisites) : '') }),
        done ? el('div', { class: 'best', text: '已通关 · 最高 ' + (best || 0) + ' 分' }) : (open ? el('div', { class: 'meta', text: '可以开始' }) : el('div', { class: 'meta', text: '未解锁' }))
      );
    })));
    const warnings = DATA.warnings || [];
    const missing = warnings.filter(function (warning) { return warning.indexOf('没有课件') >= 0; }).length;
    const other = warnings.filter(function (warning) { return warning.indexOf('没有课件') < 0; });
    const notes = [];
    if (missing) notes.push('还有 ' + missing + ' 个节点没有课件，暂未成关');
    if (other.length) notes.push(other.slice(0, 3).join('；') + (other.length > 3 ? '……' : ''));
    if (notes.length) wrap.append(el('div', { class: 'warn', text: notes.join('。') }));
    wrap.append(el('div', { class: 'bar' },
      el('button', { onClick: function () {
        if (confirm('清空本地闯关进度？不会动作答数据与题库。')) {
          progress.completed = {};
          progress.best = {};
          localStorage.removeItem(KEY);
          render();
        }
      } }, '清空本地进度')));
    app.replaceChildren(wrap);
  }

  function startLevel(level) {
    state.view = 'level';
    state.level = level;
    state.index = 0;
    state.lives = 3;
    state.score = 0;
    state.streak = 0;
    state.correct = 0;
    state.total = 0;
    state.answers = {};
    state.drafts = {};
    state.review = [];
    state.mode = 'play';
    state.feedback = null;
    state.revealed = false;
    state.sync = '';
    render();
  }

  function currentQuestion() {
    if (state.mode === 'review') return state.review[0] || null;
    return state.level.questions[state.index] || null;
  }

  function advance() {
    state.feedback = null;
    state.revealed = false;
    if (state.mode === 'review') {
      const wrong = state.feedback && !state.feedback.correct;
      if (wrong) state.review.push(state.review.shift());
      else state.review.shift();
      if (state.review.length === 0) finishLevel();
      else render();
      return;
    }
    state.index += 1;
    if (state.index >= state.level.questions.length) {
      if (state.review.length > 0) { state.mode = 'review'; render(); }
      else finishLevel();
    } else {
      render();
    }
  }

  function choose(optionIndex) {
    if (state.feedback) return;
    const question = currentQuestion();
    if (!question) return;
    const correct = optionIndex === question.ans;
    const inReview = state.mode === 'review';
    if (!inReview) {
      state.total += 1;
      if (correct) {
        state.correct += 1;
        state.score += 10 + state.streak * 2;
        state.streak += 1;
      } else {
        state.streak = 0;
        state.lives -= 1;
        state.review.push(question);
      }
    }
    state.feedback = { correct: correct, choice: optionIndex };
    enqueueSync(state.level, question, { 选: optionIndex, 对: correct });
    render();
  }

  function assess(label) {
    const question = currentQuestion();
    if (!question) return;
    if (state.mode !== 'review') {
      state.total += 1;
      if (label === '答对了') state.correct += 1;
    }
    state.answers[question.id] = label;
    enqueueSync(state.level, question, { 自评: label });
    advance();
  }

  function finishLevel() {
    const accuracy = state.total === 0 ? 0 : Math.round((state.correct / state.total) * 100);
    state.view = 'result';
    if (state.lives > 0) {
      progress.completed[state.level.id] = { score: state.score, accuracy: accuracy, at: Date.now() };
      progress.best[state.level.id] = Math.max(progress.best[state.level.id] || 0, state.score);
      saveProgress();
    }
    state.result = { accuracy: accuracy };
    render();
  }

  function renderLevel() {
    const level = state.level;
    const question = currentQuestion();
    const index = levelIndex(level.id);
    const next = DATA.levels[index + 1];
    const head = el('div', { class: 'levelhead' },
      el('button', { onClick: function () { state.view = 'map'; render(); } }, '← 地图'),
      el('h2', { text: level.title }),
      el('span', { class: 'muted', text: level.kind + ' · ' + (level.number ? '第 ' + level.number + ' 关' : '') }),
      el('span', { class: 'spacer' }),
      el('span', { class: 'muted', text: '生命 ' + Math.max(0, state.lives) + '/3 · ' + state.score + ' 分 · 连击 ' + state.streak })
    );

    const wrap = el('div');
    wrap.append(head);
    if (state.mode === 'review') wrap.append(el('div', { class: 'muted', text: '复习错题 · 还剩 ' + state.review.length + ' 题' }));
    else wrap.append(el('div', { class: 'muted', text: qLabel(question, state.index) }));
    if (level.objective) wrap.append(el('div', { class: 'muted', text: '目标：' + level.objective }));

    if (!question) {
      wrap.append(el('div', { class: 'qcard', text: '这一关没有题目。' }));
      app.replaceChildren(wrap);
      return;
    }

    const card = el('div', { class: 'qcard' });
    card.append(el('p', { class: 'qtext', text: question.q }));

    if (question.kind === '客观题') {
      const opts = el('div', { class: 'opts' });
      (question.opts || []).forEach(function (option, i) {
        const chosen = state.feedback && state.feedback.choice === i;
        let cls = 'opt';
        if (state.feedback) {
          if (i === question.ans) cls += ' correct';
          else if (chosen) cls += ' wrong';
        }
        opts.append(el('button', {
          class: cls, disabled: !!state.feedback,
          onClick: function () { choose(i); },
        }, (i + 1) + '. ' + option));
      });
      card.append(opts);
      if (state.feedback) {
        const good = state.feedback.correct;
        card.append(el('div', { class: 'feedback ' + (good ? 'good' : 'bad') },
          el('div', { text: good ? '答对了。' : '答错了。正确选项是第 ' + (question.ans + 1) + ' 个。' }),
          question.why ? el('div', { text: question.why }) : null,
          state.lives <= 0 ? el('div', { class: 'muted', text: '生命用完了，本关需要重来。' }) : null
        ));
        card.append(el('div', { class: 'bar' },
          el('button', {
            class: 'primary',
            onClick: function () {
              if (state.lives <= 0) startLevel(level);
              else advance();
            },
          }, state.lives <= 0 ? '本关重来' : '下一题')));
      }
    } else {
      if (question.kind === '开放题' || question.kind === '预测验证') {
        card.append(el('textarea', {
          rows: 4,
          placeholder: '先自己写一遍，再展开对照。',
          on: { input: function (event) { state.drafts[question.id] = event.target.value; } },
        }));
      }
      const fields = [];
      if (question.predicted) fields.push(['你的预测', question.predicted]);
      if (question.compare) fields.push(['跑完的比对', question.compare]);
      if (question.deliverable) fields.push(['交付物', question.deliverable]);
      if (question.evidence) fields.push(['可运行证据', question.evidence]);
      if (question.answer) fields.push(['参考答案', question.answer]);
      if (question.criteria) fields.push(['判分要点', question.criteria]);

      if (!state.revealed) {
        card.append(el('div', { class: 'bar' },
          el('button', { class: 'primary', onClick: function () { state.revealed = true; render(); } }, '展开参考内容'),
          el('span', { class: 'muted', text: '这一题型不自动判分；对照后自己评。' })));
      } else {
        fields.forEach(function (pair) {
          card.append(el('div', { class: 'ref' }, el('div', { class: 'muted', text: pair[0] }), el('div', { text: pair[1] })));
        });
        card.append(el('div', { class: 'bar' },
          el('span', { class: 'muted', text: '自评：' }),
          ['答对了', '答了一半', '没答上'].map(function (label) {
            return el('button', { onClick: function () { assess(label); } }, label);
          })));
      }
    }

    wrap.append(card);
    app.replaceChildren(wrap);
  }

  function renderResult() {
    const level = state.level;
    const index = levelIndex(level.id);
    const next = DATA.levels[index + 1];
    const passed = state.lives > 0;
    const accuracy = state.result ? state.result.accuracy : 0;
    const wrap = el('div');
    wrap.append(el('div', { class: 'levelhead' },
      el('button', { onClick: function () { state.view = 'map'; render(); } }, '← 地图'),
      el('h2', { text: passed ? '本关完成' : '生命用完了' })));
    const card = el('div', { class: 'result' },
      el('div', { class: 'muted', text: level.title }),
      el('div', { class: 'score', text: String(state.score) }),
      el('div', { class: 'muted', text: passed ? '正确率 ' + accuracy + '% · 最高 ' + (progress.best[level.id] || state.score) + ' 分' : '本关没有记入通关，再试一次。' }));
    card.append(el('div', { class: 'bar', style: 'justify-content:center' },
      el('button', { class: 'primary', onClick: function () { startLevel(level); } }, '再玩一次'),
      el('button', { onClick: function () { state.view = 'map'; render(); } }, '回到地图'),
      passed && next ? el('button', { onClick: function () { startLevel(next); } }, '下一关') : null));
    wrap.append(card);
    app.replaceChildren(wrap);
  }

  function render() {
    renderMeta();
    if (state.view === 'map') renderMap();
    else if (state.view === 'level') renderLevel();
    else if (state.view === 'result') renderResult();
    syncBadge.textContent = state.sync;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.addEventListener('keydown', function (event) {
    if (state.view !== 'level') return;
    if (event.code === 'Escape') { state.view = 'map'; render(); return; }
    const question = currentQuestion();
    if (!question) return;
    if (question.kind === '客观题' && /^[1-9]$/.test(event.key)) {
      const index = Number(event.key) - 1;
      if (!state.feedback && index < (question.opts || []).length) choose(index);
    }
    if (event.key === 'Enter' && state.feedback) {
      event.preventDefault();
      if (state.lives <= 0) startLevel(state.level); else advance();
    }
  });

  refreshVersions().then(function () { render(); });
  render();
</script>
</body>
</html>
`;
}