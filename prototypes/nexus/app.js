/*
 * NEXUS demo behaviour — the parts that make the prototype worth clicking.
 *
 * Kept in one place so all three skins share it and remain comparable:
 *   - sidebar selection         (high-frequency: instant, colour only)
 *   - new session ritual        (rare: the delight budget)
 *   - agent reply sequence      (thinking -> streaming -> tool -> done)
 *   - composer ruler            (state indication)
 */

(function nexusDemo() {
  "use strict";

  /* ---------------------------------------------------------------- */
  /* Sidebar: selection is instant, no motion                          */
  /* ---------------------------------------------------------------- */
  const sidebar = document.querySelector("[data-session-list]");
  if (sidebar) {
    sidebar.addEventListener("click", (event) => {
      const row = event.target.closest(".nx-item");
      if (!row) return;
      for (const other of sidebar.querySelectorAll(".nx-item.is-active")) {
        other.classList.remove("is-active");
        other.removeAttribute("aria-current");
      }
      row.classList.add("is-active");
      row.setAttribute("aria-current", "page");
      const title = document.querySelector("[data-thread-title]");
      if (title) title.textContent = row.dataset.title || row.textContent.trim();
    });
  }

  /* ---------------------------------------------------------------- */
  /* Composer ruler: one tick per 12 characters, capped at 14          */
  /* ---------------------------------------------------------------- */
  const textarea = document.querySelector("[data-composer]");
  const ruler = document.querySelector("[data-ruler]");

  function buildRuler() {
    if (!ruler) return [];
    ruler.innerHTML = "";
    const ticks = [];
    for (let index = 0; index < 14; index += 1) {
      const tick = document.createElement("span");
      tick.className = "nx-ruler__tick";
      ruler.appendChild(tick);
      ticks.push(tick);
    }
    return ticks;
  }

  let ticks = buildRuler();

  function paintRuler() {
    if (!textarea) return;
    const on = Math.min(Math.ceil(textarea.value.length / 12), ticks.length);
    ticks.forEach((tick, index) => {
      tick.classList.toggle("is-on", index < on);
    });
  }

  if (textarea) {
    textarea.addEventListener("input", paintRuler);
    textarea.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        runReply();
      }
    });
  }

  /* ---------------------------------------------------------------- */
  /* Agent reply sequence                                              */
  /* ---------------------------------------------------------------- */
  const thread = document.querySelector("[data-thread]");
  const REPLY_TEXT =
    "已就绪。这套主题把侧栏、对话流与命令输入统一到同一套仪器语言里：" +
    "状态用灯位表达，层级用对齐表达，动效只在你等待时出现。";

  let running = false;

  function prefersReduced() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function makeMessage(who) {
    const wrap = document.createElement("article");
    wrap.className = "nx-msg";
    const label = document.createElement("div");
    label.className = "nx-msg__who";
    label.textContent = who;
    const body = document.createElement("div");
    body.className = "nx-msg__body";
    wrap.append(label, body);
    return { wrap, body };
  }

  async function runReply() {
    if (!thread || running) return;
    running = true;

    /* Echo the draft as a user turn, then clear it. */
    const draft = (textarea?.value || "").trim();
    if (draft) {
      const user = makeMessage("你");
      user.wrap.classList.add("nx-msg--user");
      user.body.textContent = draft;
      thread.appendChild(user);
      textarea.value = "";
      paintRuler();
    }

    const reply = makeMessage("AGENT");
    /* --- 1. thinking: the orbit --------------------------------- */
    const thinking = document.createElement("div");
    thinking.className = "nx-thinking";
    thinking.innerHTML =
      '<span class="nx-orbit"><span class="nx-orbit__core"></span></span>' +
      "<span>正在解析上下文…</span>";
    reply.body.appendChild(thinking);
    thread.appendChild(reply);
    thread.scrollTop = thread.scrollHeight;

    await wait(prefersReduced() ? 120 : 900);

    /* --- 2. tool call: the node fires to its lamp --------------- */
    thinking.remove();
    const tool = document.createElement("div");
    tool.className = "nx-tool";
    tool.dataset.state = "running";
    tool.innerHTML =
      '<span class="nx-tool__node"></span>' +
      '<span class="nx-tool__name">read_file · prototypes/nexus/tokens.css</span>' +
      '<span class="nx-tool__lamp"></span>';
    reply.body.appendChild(tool);
    thread.scrollTop = thread.scrollHeight;

    await wait(prefersReduced() ? 120 : 700);
    tool.dataset.state = "done";

    /* --- 3. streaming: the caret, then the text ----------------- */
    const out = document.createElement("p");
    const caret = document.createElement("span");
    caret.className = "nx-caret";
    out.appendChild(caret);
    reply.body.appendChild(out);

    const step = prefersReduced() ? 0 : 18;
    for (const char of REPLY_TEXT) {
      caret.before(document.createTextNode(char));
      if (step > 0) {
        /* Batching keeps this to ~60 writes/sec instead of one per char. */
        if (Math.random() < 0.55) await wait(step);
      }
      thread.scrollTop = thread.scrollHeight;
    }
    caret.remove();

    /* --- 4. done: brackets close on the finished block ---------- */
    reply.wrap.classList.add("nx-bracket-host");
    reply.wrap.classList.add("is-active");
    thread.scrollTop = thread.scrollHeight;
    running = false;
  }

  /* The send button and the demo's "回放" both drive the same sequence. */
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-send]")) runReply();
    if (event.target.closest("[data-replay]")) {
      thread?.querySelectorAll(".nx-msg").forEach((el) => el.remove());
      runReply();
    }
  });

  /* ---------------------------------------------------------------- */
  /* New session: the one ritual in the prototype                      */
  /* ---------------------------------------------------------------- */
  document.addEventListener("click", (event) => {
    if (!event.target.closest("[data-new-session]")) return;
    if (!sidebar) return;
    const group = sidebar.querySelector(".nx-group");
    if (!group) return;

    const row = document.createElement("button");
    row.type = "button";
    row.className = "nx-item nx-bracket-host";
    row.dataset.title = "未命名会话";
    row.innerHTML =
      '<span class="nx-item__dot"></span>' +
      '<span class="nx-item__label">未命名会话</span>' +
      '<span class="nx-item__meta">now</span>';

    /* Enter from below, 8px — spatial consistency: it came from the composer. */
    row.style.opacity = "0";
    row.style.transform = prefersReduced() ? "none" : "translateY(8px)";
    group.appendChild(row);
    requestAnimationFrame(() => {
      row.style.transition = "opacity 180ms cubic-bezier(0.23,1,0.32,1), transform 180ms cubic-bezier(0.23,1,0.32,1)";
      row.style.opacity = "1";
      row.style.transform = "translateY(0)";
    });
    row.click();
    textarea?.focus();
  });

  /* ---------------------------------------------------------------- */
  /* Rail toggle                                                       */
  /* ---------------------------------------------------------------- */
  document.addEventListener("click", (event) => {
    if (!event.target.closest("[data-rail-toggle]")) return;
    const app = document.querySelector(".nx-app");
    if (!app) return;
    app.dataset.rail = app.dataset.rail === "true" ? "false" : "true";
  });
})();