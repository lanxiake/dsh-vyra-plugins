/*
 * LUMII behaviour.
 *
 * Three groups:
 *   1. pointer spotlight  -- drives --mx/--my on any .lm-card (lumii's mechanism)
 *   2. app surface        -- selection, composer, reply sequence, tool cards
 *   3. boot dust motes    -- the only canvas on the page
 *
 * The spotlight is the one effect worth a global listener: it is the thing
 * that makes Lumii's cards feel alive, and it costs one rAF write per hovered
 * card, not per element on the page.
 */

(function lumii() {
  "use strict";

  const reduce = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ================================================================== */
  /* 1. Pointer spotlight                                               */
  /* ================================================================== */
  /*
   * Coordinates are written as percentages so the gradient tracks the card at
   * any size without a second resize listener. One rAF per pointer move over a
   * card, coalesced by the frame flag below.
   */
  if (!reduce()) {
    document.addEventListener(
      "pointermove",
      (event) => {
        const card = event.target.closest(".lm-card");
        if (!card || card.dataset.lmSpot === "1") return;
        card.dataset.lmSpot = "1";
        const { clientX, clientY } = event;
        requestAnimationFrame(() => {
          card.dataset.lmSpot = "0";
          const rect = card.getBoundingClientRect();
          card.style.setProperty("--mx", `${((clientX - rect.left) / rect.width) * 100}%`);
          card.style.setProperty("--my", `${((clientY - rect.top) / rect.height) * 100}%`);
        });
      },
      { passive: true },
    );
  }

  /* ================================================================== */
  /* 2. Boot dust motes                                                 */
  /* ================================================================== */
  /*
   * Spawned by observing the body for the boot overlay, so the shared boot
   * runtime stays free of skin-specific canvas work. When the overlay leaves
   * the DOM the loop stops by itself.
   */
  const MOTE_COUNT = 64;

  function attachMotes(overlay) {
    const canvas = document.createElement("canvas");
    canvas.className = "lm-boot__motes";
    overlay.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize, { passive: true });

    function spawn(initial) {
      return {
        x: Math.random() * width,
        y: initial ? Math.random() * height : height * (0.55 + Math.random() * 0.45),
        r: 0.6 + Math.random() * 1.9,
        vy: -(6 + Math.random() * 22),
        vx: (Math.random() - 0.5) * 9,
        a: 0.18 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
        twinkle: 0.6 + Math.random() * 1.8,
      };
    }

    const motes = Array.from({ length: MOTE_COUNT }, () => spawn(true));

    let last = performance.now();
    let raf = 0;
    let running = true;

    function frame(now) {
      if (!running) return;
      /* 30fps cap: the motes are soft and slow, 60 buys nothing visible and
         spends the composite thread the sunrise is also using. */
      if (now - last < 33) {
        raf = requestAnimationFrame(frame);
        return;
      }
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < motes.length; i += 1) {
        const m = motes[i];
        m.y += m.vy * dt;
        m.x += m.vx * dt;
        m.phase += dt * m.twinkle;

        if (m.y < -12) {
          motes[i] = spawn(false);
          continue;
        }

        const climb = Math.max(0, Math.min(1, m.y / height));
        const alpha = m.a * climb * (0.62 + 0.38 * Math.sin(m.phase));

        const grd = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 3.4);
        grd.addColorStop(0, `rgba(255, 240, 200, ${alpha})`);
        grd.addColorStop(1, "rgba(255, 240, 200, 0)");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r * 3.4, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);

    const cleanup = () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.remove();
    };

    const observer = new MutationObserver(() => {
      if (!overlay.isConnected) {
        cleanup();
        observer.disconnect();
      }
    });
    observer.observe(overlay.parentNode ?? document.body, { childList: true });
  }

  if (!reduce()) {
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.classList?.contains("lm-boot") && !node.querySelector(".lm-boot__motes")) {
            attachMotes(node);
          }
        }
      }
    }).observe(document.body, { childList: true });
  }

  /* ================================================================== */
  /* 3. App surface                                                     */
  /* ================================================================== */
  const list = document.querySelector("[data-session-list]");
  const thread = document.querySelector("[data-thread]");
  const textarea = document.querySelector("[data-composer]");

  const io = "IntersectionObserver" in window
    ? new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        },
        { threshold: 0.06 },
      )
    : null;

  function reveal(el) {
    if (!el) return;
    if (reduce() || io === null) {
      el.classList.add("is-in");
      return;
    }
    io.observe(el);
  }

  /* Stagger is expressed as a CSS custom property so the transition itself
     stays a plain class toggle. */
  document.querySelectorAll(".lm-msg").forEach((el, i) => {
    el.style.setProperty("--lm-i", String(i));
    reveal(el);
  });

  list?.addEventListener("click", (event) => {
    const row = event.target.closest(".lm-item");
    if (!row) return;
    for (const other of list.querySelectorAll(".lm-item.is-active")) {
      other.classList.remove("is-active");
      other.removeAttribute("aria-current");
    }
    row.classList.add("is-active");
    row.setAttribute("aria-current", "page");
    const title = document.querySelector("[data-thread-title]");
    if (title) title.textContent = row.dataset.title || row.textContent.trim();
  });

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const atBottom = () => {
    if (thread) thread.scrollTop = thread.scrollHeight;
  };

  /* Direct, not padded — the voice matches the boot copy: state it, then the
     next move. */
  const REPLY = [
    "好，那就先拆鉴权分支。它其实只剩一个判断没覆盖到：token 过期但没被清理的那条路径。",
    "我把那段单独拎出来了，你只需要决定过期后是直接重签还是先回登录页。",
  ];

  let busy = false;

  function message(who, { user = false } = {}) {
    const wrap = document.createElement("article");
    wrap.className = user ? "lm-msg lm-msg--user" : "lm-msg lm-msg--agent";
    const label = document.createElement("div");
    label.className = "lm-msg__who";
    label.textContent = who;
    const body = document.createElement("div");
    body.className = "lm-msg__body";
    wrap.append(label, body);
    return { wrap, body };
  }

  /* A tool call is an object, so it renders as a card with a header, a state
     lamp and an expandable payload. */
  function toolCard(name, state, payload) {
    const card = document.createElement("div");
    card.className = "lm-toolcard";
    card.dataset.state = state;

    const head = document.createElement("div");
    head.className = "lm-toolcard__head";

    const lamp = document.createElement("span");
    lamp.className = "lm-lamp";
    lamp.dataset.state = state;

    const title = document.createElement("span");
    title.className = "lm-toolcard__name";
    title.textContent = name;

    const dur = document.createElement("span");
    dur.className = "lm-toolcard__dur";
    dur.textContent = state === "running" ? "…" : "0.4s";

    head.append(lamp, title, dur);
    card.appendChild(head);

    if (payload) {
      const body = document.createElement("pre");
      body.className = "lm-toolcard__body";
      body.textContent = payload;
      card.appendChild(body);

      const more = document.createElement("button");
      more.type = "button";
      more.className = "lm-toolcard__more";
      more.textContent = "展开";
      more.addEventListener("click", () => {
        const expanded = card.dataset.expanded === "true";
        card.dataset.expanded = expanded ? "false" : "true";
        more.textContent = expanded ? "展开" : "收起";
      });
      card.appendChild(more);
    }

    return { card, lamp, dur };
  }

  async function reply() {
    if (!thread || busy) return;
    busy = true;
    const fast = reduce();

    const draft = (textarea?.value || "").trim();
    if (draft) {
      const user = message("你", { user: true });
      user.body.textContent = draft;
      thread.appendChild(user);
      reveal(user.wrap);
      textarea.value = "";
      textarea.style.height = "auto";
      atBottom();
      await wait(fast ? 0 : 220);
    }

    const out = message("Lumii");

    const thinking = document.createElement("div");
    thinking.className = "lm-thinking";
    thinking.innerHTML = '<span class="lm-sun"></span><span>翻昨天的记录…</span>';
    out.body.appendChild(thinking);
    thread.appendChild(out);
    reveal(out.wrap);
    atBottom();

    await wait(fast ? 60 : 800);
    thinking.remove();

    /* Running card first — dashed border, pulsing lamp. */
    const running = toolCard("read · 鉴权分支", "running");
    out.body.appendChild(running.card);
    atBottom();

    await wait(fast ? 60 : 620);

    /* Then it settles: solid border, green lamp, and the payload appears. */
    running.card.dataset.state = "done";
    running.lamp.dataset.state = "done";
    running.dur.textContent = "0.4s";

    /* Two lines in the collapsed state, the whole thing when expanded. The
       truncation happens in markup rather than in CSS — see the comment block
       above .lm-toolcard__clip for why four CSS approaches all failed. */
    const SHORT = "src/auth/session.ts:88\n  if (!session.expiresAt || session.expiresAt < Date.now()) {";
    const FULL =
      "src/auth/session.ts:88\n" +
      "  if (!session.expiresAt || session.expiresAt < Date.now()) {\n" +
      "    // 过期但未清理：这里直接返回 401，没有走重签\n" +
      "    return reject(new AuthError('expired'));\n" +
      "  }";

    const payload = document.createElement("pre");
    payload.className = "lm-toolcard__body";
    payload.textContent = SHORT;
    payload.dataset.short = SHORT;
    payload.dataset.full = FULL;

    /* The wrapper owns the fade at the cut edge. */
    const clip = document.createElement("div");
    clip.className = "lm-toolcard__clip";
    clip.appendChild(payload);
    running.card.appendChild(clip);

    const more = document.createElement("button");
    more.type = "button";
    more.className = "lm-toolcard__more";
    more.textContent = "展开";
    more.addEventListener("click", () => {
      const expanded = running.card.dataset.expanded === "true";
      running.card.dataset.expanded = expanded ? "false" : "true";
      payload.textContent = expanded ? SHORT : FULL;
      more.textContent = expanded ? "展开" : "收起";
    });
    running.card.appendChild(more);

    for (const [index, text] of REPLY.entries()) {
      const p = document.createElement("p");
      const caret = document.createElement("span");
      caret.className = "lm-caret";
      p.appendChild(caret);
      /* The first paragraph sits above the card, so insert before it. */
      out.body.insertBefore(p, index === 0 ? running.card : null);
      for (let i = 0; i < text.length; i += 1) {
        caret.before(document.createTextNode(text[i]));
        if (!fast && i % 3 === 0) await wait(16);
      }
      caret.remove();
      if (index < REPLY.length - 1) await wait(fast ? 0 : 160);
    }
    atBottom();

    busy = false;
  }

  textarea?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      reply();
    }
  });

  textarea?.addEventListener("input", () => {
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 170)}px`;
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-send]")) reply();
    if (event.target.closest("[data-rail-toggle]")) {
      const app = document.querySelector(".lm-app");
      if (app) app.dataset.rail = app.dataset.rail === "true" ? "false" : "true";
    }
    if (event.target.closest("[data-quote-close]")) {
      event.target.closest(".lm-quote")?.remove();
    }
    if (event.target.closest("[data-new-session]")) {
      const group = list?.querySelector(".lm-group");
      if (!group) return;
      const row = document.createElement("button");
      row.type = "button";
      row.className = "lm-item";
      row.dataset.title = "新会话";
      row.innerHTML =
        '<span class="lm-item__dot"></span>' +
        '<span class="lm-item__label">新会话</span>' +
        '<span class="lm-item__meta">刚刚</span>';
      group.appendChild(row);
      row.click();
      textarea?.focus();
    }
  });
})();