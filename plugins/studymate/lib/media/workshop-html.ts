/* ─────────────────────────────────────────────────────────────────────────
   StudyMate · 媒体域 —— 第 1 课工作坊（MVP）

   《谁在停下来？》：读者模式 → 缺口实验 → 钩子工坊 → 模拟信息流 → 复盘。
   这是试点课的专用切片：内容写死在这里，先把“展示 / 了解 / 学习 / 实践”
   连成一个可玩的体验；通用工作坊格式以后再抽。
   ───────────────────────────────────────────────────────────────────────── */

export function buildWorkshopHtml(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>第 1 课工作坊：谁在停下来？</title>
<style>
  :root { color-scheme: light dark; --bg:#f6f7f9; --panel:#fff; --ink:#1b1f27; --muted:#667085; --line:#e4e7ec; --brand:#1b1f27; --good:#067647; --bad:#b42318; --accent:#175cd3; }
  @media (prefers-color-scheme: dark) { :root { --bg:#121417; --panel:#1a1d21; --ink:#e8eaee; --muted:#98a2b3; --line:#2a2f36; --brand:#e8eaee; --good:#75e0a7; --bad:#fda29b; --accent:#84adff; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.7 system-ui,-apple-system,"Segoe UI","Noto Sans SC",sans-serif; }
  header { max-width:880px; margin:0 auto; padding:28px 20px 8px; }
  h1 { font-size:22px; line-height:1.35; margin:0 0 6px; }
  h2 { font-size:18px; margin:0 0 10px; }
  .muted { color:var(--muted); font-size:13px; }
  main { max-width:880px; margin:0 auto; padding:12px 20px 80px; }
  .dots { display:flex; flex-wrap:wrap; gap:8px; margin:14px 0 18px; }
  .dot { font-size:12px; color:var(--muted); border:1px solid var(--line); border-radius:999px; padding:3px 9px; }
  .dot.on { color:var(--bg); background:var(--brand); border-color:var(--brand); }
  .panel { background:var(--panel); border:1px solid var(--line); border-radius:16px; padding:20px; }
  .row { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
  .spacer { flex:1; }
  button { appearance:none; border:1px solid var(--line); background:var(--panel); color:var(--ink); border-radius:10px; padding:9px 13px; font:inherit; font-size:14px; cursor:pointer; }
  button:hover:not(:disabled) { border-color:var(--muted); }
  button:disabled { opacity:.45; cursor:not-allowed; }
  button.primary { background:var(--brand); color:var(--bg); border-color:var(--brand); }
  .feed { display:grid; gap:12px; margin-top:14px; }
  .post { background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:14px; }
  .post.stopped { border-color:var(--good); }
  .post .author { font-size:12px; color:var(--muted); }
  .post .hook { margin:6px 0 10px; white-space:pre-wrap; }
  .tag { display:inline-block; font-size:11px; color:var(--muted); border:1px solid var(--line); border-radius:999px; padding:1px 7px; margin-right:6px; }
  .reasons { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }
  .reasons button { font-size:12px; padding:5px 9px; }
  .bill { margin-top:14px; padding:12px 14px; border:1px dashed var(--line); border-radius:12px; }
  .slider { width:100%; margin:10px 0; }
  .meter { height:12px; border-radius:999px; background:var(--line); overflow:hidden; }
  .meter i { display:block; height:100%; background:var(--accent); transition:width .2s; }
  .gates { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
  .gate { font-size:12px; border:1px solid var(--line); border-radius:999px; padding:4px 9px; color:var(--muted); }
  .field { margin:12px 0; }
  .field label { display:block; font-size:13px; color:var(--muted); margin-bottom:4px; }
  textarea, input[type=text] { width:100%; padding:10px 12px; border-radius:10px; border:1px solid var(--line); background:var(--bg); color:var(--ink); font:inherit; resize:vertical; }
  .preview { margin-top:14px; padding:12px 14px; border:1px solid var(--line); border-radius:12px; background:color-mix(in srgb,var(--panel) 85%,var(--bg)); white-space:pre-wrap; }
  .persona { background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:14px; }
  .persona h3 { font-size:15px; margin:0 0 2px; }
  .badges { display:flex; flex-wrap:wrap; gap:6px; margin:8px 0; }
  .badge { font-size:11px; border-radius:999px; padding:2px 8px; border:1px solid var(--line); color:var(--muted); }
  .badge.yes { color:var(--good); border-color:color-mix(in srgb,var(--good) 45%,var(--line)); }
  .badge.no { color:var(--bad); border-color:color-mix(in srgb,var(--bad) 45%,var(--line)); }
  .funnel { display:grid; gap:8px; margin:14px 0; }
  .funnel .line { display:grid; grid-template-columns:64px 1fr 32px; gap:8px; align-items:center; font-size:13px; }
  .funnel .bar { height:10px; border-radius:999px; background:var(--line); overflow:hidden; }
  .funnel .bar i { display:block; height:100%; background:var(--accent); }
  .note { margin-top:12px; padding:10px 12px; border-radius:10px; border:1px solid color-mix(in srgb,var(--accent) 35%,var(--line)); color:var(--muted); font-size:12px; }
  .actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:16px; }
  a { color:inherit; }
  @media (max-width:600px) { header,main { padding-left:14px; padding-right:14px; } .panel { padding:16px; } }
</style>
</head>
<body>
<header>
  <h1>第 1 课工作坊：谁在停下来？</h1>
  <div class="muted">先当读者，再当主理人。你的目标不是卖货，是让一个不懂技术的职场人停下来读。</div>
  <div class="dots" id="dots"></div>
</header>
<main id="app"></main>
<script>
  const FEED = [
    { id:'p1', author:'小林的同学', tag:'周报', hook:'每次做周报，我都要把上周的数据一条条粘进表格里。今天做了个东西，3 分钟出完。' },
    { id:'p2', author:'效率工具官方', tag:'广告', hook:'12 种场景，一站式效率工具，限时 5 折。' },
    { id:'p3', author:'阿May', tag:'好奇', hook:'为什么你每天都很忙，却说不清自己做了什么？' },
    { id:'p4', author:'老周', tag:'案例', hook:'团队每周花 6 小时做汇报。我把流程砍到 1 小时，附一张前后对比。' },
    { id:'p5', author:'转行日记', tag:'故事', hook:'30 岁转行做产品，我用 3 个月把工资翻倍。' },
    { id:'p6', author:'数据小站', tag:'数据', hook:'一张图看懂：周报数据从 6 个表格到 1 个看板。' },
  ];
  const REASONS = ['跟我有关', '我想知道答案', '怕错过', '只是好看'];
  const PERSONAS = [
    { id:'lin', name:'小林', role:'职场人 · 每周做周报', need:'想少花时间，但怕又装一个没用的工具', stopFor:['situation','proof'], readFor:['proof','data'], actFor:['situation','proof'] },
    { id:'may', name:'阿May', role:'内容创作者 · 好奇心强', need:'想看新鲜、有情绪的东西，讨厌广告', stopFor:['curiosity','story'], readFor:['story','curiosity'], actFor:['curiosity'] },
    { id:'zhou', name:'老周', role:'小团队负责人 · 重实效', need:'要能说服团队、看得见结果的方案', stopFor:['proof','data'], readFor:['proof','data'], actFor:['proof'] },
  ];
  const EXAMPLES = {
    situation: '每次做周报，我都要把上周的数据一条条粘进表格里',
    gap: '如果不用手动粘，能省下多少时间？',
    promise: '我把这套模板做成了一键生成，3 分钟出周报',
  };
  const STEPS = ['读者模式', '缺口实验', '钩子工坊', '模拟信息流', '复盘'];
  const KEY = 'studymate:workshop:intro.why-content-works';
  const app = document.getElementById('app');
  const dots = document.getElementById('dots');
  const state = {
    step: 0, stops: [], reasons: {}, pending: null, readerDone: false,
    gapValue: 50, situation: '', gap: '', promise: '',
    revised: false, archetype: '', reactions: [], takeaway: '', saved: false,
  };

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
        else if (key === 'value' && 'value' in node) node.value = value;
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

  function renderDots() {
    dots.replaceChildren(...STEPS.map((name, index) => el('span', {
      class: 'dot' + (index === state.step ? ' on' : ''),
      text: (index + 1) + '. ' + name,
    })));
  }

  function stop(postId) {
    if (state.stops.length >= 3 || state.stops.includes(postId)) return;
    state.pending = postId;
    render();
  }
  function chooseReason(postId, reason) {
    if (!state.stops.includes(postId)) state.stops.push(postId);
    state.reasons[postId] = reason;
    state.pending = null;
    if (state.stops.length >= 3) state.readerDone = true;
    render();
  }

  function renderReader() {
    const wrap = el('div');
    wrap.append(el('div', { class: 'panel' },
      el('h2', { text: '你现在是读者小林' }),
      el('div', { class: 'muted', text: '32 岁，每周做周报，对“效率工具”既需要又警惕。你正在刷首页，只能停 3 次。' })));
    const feed = el('div', { class: 'feed' });
    FEED.forEach((post) => {
      const stopped = state.stops.includes(post.id);
      const card = el('div', { class: 'post' + (stopped ? ' stopped' : '') },
        el('div', { class: 'author', text: post.author + ' · ' + post.tag }),
        el('div', { class: 'hook', text: post.hook }));
      if (!stopped) {
        card.append(el('button', {
          disabled: state.stops.length >= 3 || (state.pending !== null && state.pending !== post.id),
          onClick: function () { stop(post.id); },
        }, state.stops.length >= 3 ? '注意力用完了' : '停下来'));
      } else {
        card.append(el('div', { class: 'muted', text: '已停 · ' + (state.reasons[post.id] || '') }));
      }
      if (state.pending === post.id) {
        card.append(el('div', { class: 'reasons' }, REASONS.map((reason) => el('button', {
          onClick: function () { chooseReason(post.id, reason); },
        }, reason))));
      }
      feed.append(card);
    });
    wrap.append(feed);
    if (state.readerDone || state.stops.length >= 3) {
      wrap.append(el('div', { class: 'bill' },
        el('div', { text: '注意力账单' }),
        el('div', { class: 'muted', text: '你停了 ' + state.stops.length + ' 次；6 条里有 ' + (6 - state.stops.length) + ' 条连让你停一下都没做到。' }),
        el('div', { class: 'muted', text: state.stops.map(function (id) {
          const post = FEED.find(function (item) { return item.id === id; });
          return post.tag + '（' + state.reasons[id] + '）';
        }).join(' · ') }),
        el('div', { class: 'actions' }, el('button', { class: 'primary', onClick: function () { state.step = 1; render(); } }, '进入缺口实验'))));
    } else {
      wrap.append(el('div', { class: 'actions' }, el('button', {
        disabled: state.stops.length === 0,
        onClick: function () { state.readerDone = true; render(); },
      }, '先看到这里')));
    }
    app.replaceChildren(wrap);
  }

  function gapInfo(value) {
    if (value < 30) return { label: '太小：答案看起来不值钱', chance: 28 + value };
    if (value > 70) return { label: '太大：读者觉得跟自己无关', chance: 128 - value };
    return { label: '合适：跟他有关，但他还不知道', chance: 70 + (value - 30) };
  }

  function renderGap() {
    const info = gapInfo(state.gapValue);
    const meter = el('div', { class: 'meter' }, el('i', { style: 'width:' + Math.min(100, info.chance) + '%' }));
    const label = el('div', { class: 'muted', text: info.label });
    const slider = el('input', {
      class: 'slider', type: 'range', min: 0, max: 100, value: state.gapValue,
      on: { input: function (event) {
        state.gapValue = Number(event.target.value);
        const next = gapInfo(state.gapValue);
        label.textContent = next.label;
        meter.firstChild.style.width = Math.min(100, next.chance) + '%';
      } },
    });
    const wrap = el('div');
    wrap.append(el('div', { class: 'panel' },
      el('h2', { text: '缺口实验：多大的缺口才让人停下来？' }),
      el('div', { class: 'muted', text: '缺口太小，读者觉得答案不值得；缺口太大，读者觉得跟自己无关。拖动滑块看停下来的可能。' }),
      slider,
      label,
      meter,
      el('div', { class: 'gates' },
        el('span', { class: 'gate', text: '第一关 · 被点开' }),
        el('span', { class: 'gate', text: '第二关 · 被读完' }),
        el('span', { class: 'gate', text: '第三关 · 被照着做' })),
      el('div', { class: 'actions' }, el('button', { class: 'primary', onClick: function () { state.step = 2; render(); } }, '去写我的开头'))));
    app.replaceChildren(wrap);
  }

  function hookText() {
    return [state.situation, state.gap, state.promise]
      .map(function (part) { return part.trim(); })
      .filter(Boolean)
      .join('\\n');
  }

  function renderBuilder() {
    const fields = [
      ['situation', '处境：读者正在经历什么？', '例：每次做周报，我都要把上周的数据一条条粘进表格里'],
      ['gap', '缺口：他此刻想知道什么？', '例：如果不用手动粘，能省下多少时间？'],
      ['promise', '承诺：你能给他什么？', '例：我把这套模板做成了一键生成，3 分钟出周报'],
    ];
    const inputs = fields.map(function (pair) {
      const field = el('div', { class: 'field' },
        el('label', { text: pair[1] }),
        el('textarea', {
          rows: 3, placeholder: pair[2],
          value: state[pair[0]],
          on: { input: function (event) {
            state[pair[0]] = event.target.value;
            preview.textContent = hookText() || '（你的开头会显示在这里）';
          } },
        }));
      return field;
    });
    const preview = el('div', { class: 'preview', text: hookText() || '（你的开头会显示在这里）' });
    const wrap = el('div');
    wrap.append(el('div', { class: 'panel' },
      el('h2', { text: '现在切回主理人：给小林写一个开头' }),
      el('div', { class: 'muted', text: '别急着讲产品。先写她正在经历的处境，再写她想知道的那个问题，最后给她一个拿得走的承诺。' }),
      inputs,
      el('div', { class: 'actions' },
        el('button', { onClick: function () {
          state.situation = EXAMPLES.situation;
          state.gap = EXAMPLES.gap;
          state.promise = EXAMPLES.promise;
          render();
        } }, '填个例子'),
        el('button', { class: 'primary', onClick: function () {
          if (hookText().trim() === '') { alert('先写一句开头再发布。'); return; }
          state.archetype = classify(state.situation, state.gap, state.promise);
          state.reactions = PERSONAS.map(function (persona) { return react(persona, state.archetype, hookText()); });
          state.step = 3;
          render();
        } }, '发布这个开头')),
      preview));
    app.replaceChildren(wrap);
  }

  function classify(situation, gap, promise) {
    const text = [situation, gap, promise].join(' ');
    const hasSituation = /周报|表格|会议|汇报|数据|同事|老板|加班|月末|复盘|总结|PPT|邮件/.test(text);
    const hasProduct = /模板|工具|插件|DSH|AI|看板|系统|软件|效率/.test(text);
    const hasQuestion = /[?？]|为什么|怎么|多少|哪/.test(text);
    const hasNumber = /\\d/.test(text);
    if (hasSituation) return 'situation';
    if (hasProduct) return 'product';
    if (hasNumber) return 'number';
    if (hasQuestion) return 'curiosity';
    return 'vague';
  }

  function react(persona, archetype, text) {
    const curious = /[?？]|为什么|怎么|多少|哪/.test(text);
    const team = /团队|同事|汇报|会议|老板/.test(text);
    const stop = persona.stopFor.indexOf(archetype) >= 0
      || (archetype === 'situation' && persona.id === 'lin')
      || (persona.id === 'may' && curious)
      || (persona.id === 'zhou' && team);
    const read = stop && (persona.readFor.indexOf(archetype) >= 0 || archetype === 'situation' || (persona.id === 'may' && curious));
    const act = read && (persona.actFor.indexOf(archetype) >= 0 || (persona.id === 'lin' && archetype === 'situation'));
    const comments = {
      situation: { lin:'这说的就是我周三下午。', may:'有点具体，但我更想知道你最后怎么做的。', zhou:'如果团队能直接用，我愿意看看。' },
      product: { lin:'听起来像又一个效率工具。', may:'太像广告了。', zhou:'先给我一个案例。' },
      curiosity: { lin:'有点好奇，但跟我有什么关系？', may:'我想知道答案。', zhou:'标题不错，正文有东西吗？' },
      number: { lin:'数字挺具体，但我不确定是不是真的。', may:'有点像营销。', zhou:'有前后对比吗？' },
      vague: { lin:'没太看懂跟我有什么关系。', may:'太泛了。', zhou:'不知道能解决什么。' },
    };
    let comment = comments[archetype][persona.id] || '';
    if (!stop) {
      comment = persona.id === 'lin' ? '这跟我没什么关系。' : persona.id === 'may' ? '太像广告了。' : '没看出对团队有什么用。';
    } else if (!read) {
      comment = '停了一下，但没读完。';
    } else if (!act) {
      comment = '读完了，但还没想动手。';
    }
    return { id: persona.id, stop: stop, read: read, act: act, comment: comment };
  }

  function renderSim() {
    const reactions = state.reactions;
    const stops = reactions.filter(function (item) { return item.stop; }).length;
    const reads = reactions.filter(function (item) { return item.read; }).length;
    const acts = reactions.filter(function (item) { return item.act; }).length;
    const funnel = [['曝光', 3], ['停下', stops], ['读完', reads], ['想动手', acts]].map(function (pair) {
      return el('div', { class: 'line' },
        el('span', { text: pair[0] }),
        el('div', { class: 'bar' }, el('i', { style: 'width:' + (pair[1] / 3) * 100 + '%' })),
        el('span', { class: 'muted', text: String(pair[1]) }));
    });
    const wrap = el('div');
    wrap.append(el('div', { class: 'panel' },
      el('h2', { text: '你的开头进入了信息流' }),
      el('div', { class: 'preview', text: hookText() }),
      el('div', { class: 'funnel' }, funnel),
      el('div', { class: 'feed' }, PERSONAS.map(function (persona) {
        const reaction = reactions.find(function (item) { return item.id === persona.id; });
        return el('div', { class: 'persona' },
          el('h3', { text: persona.name + ' · ' + persona.role }),
          el('div', { class: 'muted', text: persona.need }),
          el('div', { class: 'badges' },
            el('span', { class: 'badge ' + (reaction.stop ? 'yes' : 'no'), text: reaction.stop ? '停下来了' : '划走了' }),
            el('span', { class: 'badge ' + (reaction.read ? 'yes' : 'no'), text: reaction.read ? '读完了' : '没读完' }),
            el('span', { class: 'badge ' + (reaction.act ? 'yes' : 'no'), text: reaction.act ? '想动手' : '没动手' })),
          el('div', { class: 'muted', text: '“' + reaction.comment + '”' }));
      })),
      el('div', { class: 'note', text: '这是模拟信息流，不是真实数据；它只帮你看清：同一个开头，不同读者会在哪里停下来。' }),
      el('div', { class: 'actions' },
        !state.revised ? el('button', { onClick: function () { state.revised = true; state.step = 2; render(); } }, '改一次再发') : null,
        el('button', { class: 'primary', onClick: function () { state.step = 4; render(); } }, '完成并复盘'))));
    app.replaceChildren(wrap);
  }

  function archetypeLabel(archetype) {
    return {
      situation: '处境型：你把读者放进了画面',
      product: '产品型：你先讲了自己',
      curiosity: '好奇型：你留了一个缺口',
      number: '数字型：你用具体数字抓注意',
      vague: '模糊型：读者不知道这跟他有什么关系',
    }[archetype] || '还没分类';
  }

  function renderDebrief() {
    const wrap = el('div');
    wrap.append(el('div', { class: 'panel' },
      el('h2', { text: '复盘：你在哪一关用力？' }),
      el('div', { text: archetypeLabel(state.archetype) }),
      el('div', { class: 'muted', text: state.archetype === 'product' || state.archetype === 'vague'
        ? '这次主要卡在第一关：读者还没有认出自己的处境。'
        : '这次第一关有抓手；接下来要看第二关（读完）和第三关（动手）。' }),
      el('div', { class: 'muted', text: '钩子卡会保存你的开头、读者反应与一句复盘，成为工作室作品集的第一张卡。' }),
      el('div', { class: 'field' },
        el('label', { text: '写一句：下次我会……' }),
        el('textarea', { rows: 3, value: state.takeaway, on: { input: function (event) { state.takeaway = event.target.value; } } })),
      el('div', { class: 'actions' },
        el('button', { class: 'primary', onClick: function () {
          const card = {
            lesson: 'intro.why-content-works',
            situation: state.situation,
            gap: state.gap,
            promise: state.promise,
            text: hookText(),
            archetype: state.archetype,
            reactions: state.reactions,
            takeaway: state.takeaway.trim(),
            at: Date.now(),
          };
          try { localStorage.setItem(KEY, JSON.stringify(card)); state.saved = true; render(); }
          catch (error) { alert('本地存档失败（可能是隐私模式）。'); }
        } }, '保存钩子卡'),
        el('a', { href: 'index.html' }, '回到关卡地图')),
      state.saved ? el('div', { class: 'note', text: '已保存。下一课我们会把这张卡接进 30 天内容库。' }) : null));
    app.replaceChildren(wrap);
  }

  function render() {
    renderDots();
    if (state.step === 0) renderReader();
    else if (state.step === 1) renderGap();
    else if (state.step === 2) renderBuilder();
    else if (state.step === 3) renderSim();
    else renderDebrief();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  render();
</script>
</body>
</html>
`;
}