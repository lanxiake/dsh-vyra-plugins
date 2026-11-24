/*
 * NOIR behaviour.
 *
 * Three effects, each with a stated job:
 *   aura      — pointer-following light behind the canvas (delight, rare)
 *   reveal    — layered entrance per message, once (prevents a jarring jump)
 *   reply     — thinking -> tool -> streaming -> settled (state indication)
 *
 * Everything high-frequency (row selection, hover, focus) is pure CSS.
 */

(function noir() {
  "use strict";

  const reduce = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------------ */
  /* 1. Pointer aura                                                     */
  /* ------------------------------------------------------------------ */
  /* One element, one transform write per frame. It sits at z-index 0 and  */
  /* is pointer-events:none, so it can never intercept a click.           */
  const aura = document.querySelector("[data-aura]");
  if (aura) {
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let live = false;
    let raf = 0;

    const tick = () => {
      /* Critically damped follow: the pool trails the pointer by a few
         frames, which is what makes it feel like light and not glue. */
      currentX += (targetX - currentX) * 0.14;
      currentY += (targetY - currentY) * 0.14;
      aura.style.transform = `translate(${currentX}px, ${currentY}px)`;
      if (Math.abs(targetX - currentX) > 0.4 || Math.abs(targetY - currentY) > 0.4 || !live) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = 0;
      }
    };

    document.addEventListener(
      "pointermove",
      (event) => {
        if (reduce()) return;
        targetX = event.clientX;
        targetY = event.clientY;
        if (!live) {
          live = true;
          currentX = targetX;
          currentY = targetY;
          aura.classList.add("is-live");
        }
        if (raf === 0) raf = requestAnimationFrame(tick);
      },
      { passive: true }
    );

    document.addEventListener("pointerleave", () => {
      aura.classList.remove("is-live");
    });
  }

  /* ------------------------------------------------------------------ */
  /* 2. Layered reveal                                                   */
  /* ------------------------------------------------------------------ */
  /* IntersectionObserver so a message that arrives below the fold is     */
  /* revealed when it is actually seen, not queued behind the scroll.     */
  const io = "IntersectionObserver" in window
    ? new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        },
        { threshold: 0.08 }
      )
    : null;

  function reveal(element) {
    if (!element) return;
    if (reduce() || io === null) {
      element.classList.add("is-in");
      return;
    }
    io.observe(element);
  }

  document.querySelectorAll(".noir-msg").forEach(reveal);

  /* ------------------------------------------------------------------ */
  /* 3. Sidebar selection (instant — no motion)                          */
  /* ------------------------------------------------------------------ */
  const list = document.querySelector("[data-session-list]");

  list?.addEventListener("click", (event) => {
    const row = event.target.closest(".noir-item");
    if (!row) return;
    for (const other of list.querySelectorAll(".noir-item.is-active")) {
      other.classList.remove("is-active");
      other.removeAttribute("aria-current");
    }
    row.classList.add("is-active");
    row.setAttribute("aria-current", "page");
    const title = document.querySelector("[data-thread-title]");
    if (title) title.textContent = row.dataset.title || row.textContent.trim();
  });

  /* ------------------------------------------------------------------ */
  /* 4. Composer + reply sequence                                        */
  /* ------------------------------------------------------------------ */
  const thread = document.querySelector("[data-thread]");
  const textarea = document.querySelector("[data-composer]");
  const count = document.querySelector("[data-count]");

  /* The transcript opens at the top: starting scrolled to the end would hide
     most of the conversation behind a scroll the visitor has no reason to
     expect. Declared after `thread` to avoid the temporal dead zone. */
  if (thread) thread.scrollTop = 0;

  textarea?.addEventListener("input", () => {
    if (count) count.textContent = String(textarea.value.length).padStart(3, "0");
  });

  textarea?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      reply();
    }
  });

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const REPLY = [
    "已按你的口气收紧了。列表行现在只改颜色和前导细线，没有任何位移。",
    "铜色只出现在三处：当前会话的竖线、流式光标、输入框聚焦时的下划线。其他地方一律留给暖白与石墨。",
  ];

  let busy = false;

  function message(who) {
    const wrap = document.createElement("article");
    wrap.className = "noir-msg";
    const label = document.createElement("div");
    label.className = "noir-msg__who";
    label.textContent = who;
    const body = document.createElement("div");
    body.className = "noir-msg__body";
    wrap.append(label, body);
    return { wrap, body };
  }

  function atBottom() {
    if (!thread) return;
    thread.scrollTop = thread.scrollHeight;
  }

  async function reply() {
    if (!thread || busy) return;
    busy = true;
    const fast = reduce();

    /* Echo the draft, then clear it. */
    const draft = (textarea?.value || "").trim();
    if (draft) {
      const user = message("你");
      user.wrap.classList.add("noir-msg--user");
      user.body.textContent = draft;
      thread.appendChild(user);
      reveal(user.wrap);
      textarea.value = "";
      if (count) count.textContent = "000";
      atBottom();
      await wait(fast ? 0 : 140);
    }

    const out = message("AGENT");

    /* --- thinking ------------------------------------------------ */
    const thinking = document.createElement("div");
    thinking.className = "noir-thinking";
    thinking.innerHTML =
      '<span class="noir-aura-dot"></span><span>正在阅读上下文</span>';
    out.body.appendChild(thinking);
    thread.appendChild(out);
    reveal(out.wrap);
    atBottom();

    await wait(fast ? 60 : 820);

    /* --- tool call ----------------------------------------------- */
    thinking.remove();
    const tool = document.createElement("div");
    tool.className = "noir-tool";
    tool.dataset.state = "running";
    tool.innerHTML =
      '<span class="noir-tool__name">read · prototypes/noir/noir.css</span>' +
      '<span class="noir-tool__state">running</span>';
    out.body.appendChild(tool);
    atBottom();

    await wait(fast ? 60 : 640);
    tool.dataset.state = "done";
    tool.querySelector(".noir-tool__state").textContent = "done";

    /* --- streaming ----------------------------------------------- */
    /* One paragraph at a time, each with its own caret. The caret lives at
       the end of the paragraph being written and is removed when the stream
       finishes, so at no point are there two cursors on screen. */
    const paragraphs = REPLY.map(() => {
      const p = document.createElement("p");
      out.body.appendChild(p);
      return p;
    });

    for (let index = 0; index < REPLY.length; index += 1) {
      const para = paragraphs[index];
      const caret = document.createElement("span");
      caret.className = "noir-caret";
      para.appendChild(caret);

      const text = REPLY[index];
      for (let char = 0; char < text.length; char += 1) {
        caret.before(document.createTextNode(text[char]));
        /* Batch into ~16ms slices: one DOM write per frame, not per char. */
        if (!fast && char % 3 === 0) await wait(16);
        if (char % 24 === 0) atBottom();
      }
      caret.remove();
    }
    atBottom();

    busy = false;
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-send]")) reply();
    if (event.target.closest("[data-replay]")) {
      thread?.querySelectorAll(".noir-msg").forEach((el) => el.remove());
      reply();
    }
    if (event.target.closest("[data-rail-toggle]")) {
      const app = document.querySelector(".noir-app");
      if (app) app.dataset.rail = app.dataset.rail === "true" ? "false" : "true";
    }
    if (event.target.closest("[data-new-session]")) {
      const group = list?.querySelector(".noir-group");
      if (!group) return;
      const row = document.createElement("button");
      row.type = "button";
      row.className = "noir-item";
      row.dataset.title = "未命名会话";
      row.innerHTML =
        '<span class="noir-item__pip"></span>' +
        '<span class="noir-item__label">未命名会话</span>' +
        '<span class="noir-item__meta">now</span>';
      group.appendChild(row);
      row.click();
      textarea?.focus();
    }
  });

  /* Auto-size the textarea so it grows with the draft instead of scrolling
     inside a 1-row box. */
  textarea?.addEventListener("input", () => {
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  });
})();