/*
 * MORNING behaviour.
 *
 * Deliberately the least animated of the skins: a morning interface that
 * moves a lot is an alarm clock. Everything here is either instant (row
 * selection) or a single soft entrance.
 */

(function morning() {
  "use strict";

  const reduce = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const list = document.querySelector("[data-session-list]");
  const thread = document.querySelector("[data-thread]");
  const textarea = document.querySelector("[data-composer]");

  /* ------------------------------------------------------------------ */
  /* Reveal — messages settle in, once.                                  */
  /* ------------------------------------------------------------------ */
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

  document.querySelectorAll(".morning-msg").forEach(reveal);

  /* ------------------------------------------------------------------ */
  /* Sidebar selection — instant.                                        */
  /* ------------------------------------------------------------------ */
  list?.addEventListener("click", (event) => {
    const row = event.target.closest(".morning-item");
    if (!row) return;
    for (const other of list.querySelectorAll(".morning-item.is-active")) {
      other.classList.remove("is-active");
      other.removeAttribute("aria-current");
    }
    row.classList.add("is-active");
    row.setAttribute("aria-current", "page");
    const title = document.querySelector("[data-thread-title]");
    if (title) title.textContent = row.dataset.title || row.textContent.trim();
  });

  /* ------------------------------------------------------------------ */
  /* Composer                                                            */
  /* ------------------------------------------------------------------ */
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /*
   * The reply is written to be kind without being saccharine: it names
   * something small and true, and never claims the day will be great.
   */
  const REPLY = [
    "收到。那就先只做一件：把手上这件事往前推一小步，做到能停下来的地方就行。",
    "做完了跟我说一声，我们再决定下一步。不着急。",
  ];

  let busy = false;

  function message(who, { user = false } = {}) {
    const wrap = document.createElement("article");
    wrap.className = user ? "morning-msg morning-msg--user" : "morning-msg";
    const label = document.createElement("div");
    label.className = "morning-msg__who";
    label.textContent = who;
    const body = document.createElement("div");
    body.className = "morning-msg__body";
    wrap.append(label, body);
    return { wrap, body };
  }

  function atBottom() {
    if (thread) thread.scrollTop = thread.scrollHeight;
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
      await wait(fast ? 0 : 260);
    }

    const out = message("Vyra");

    const thinking = document.createElement("div");
    thinking.className = "morning-thinking";
    thinking.innerHTML = '<span class="morning-sun"></span><span>想一下…</span>';
    out.body.appendChild(thinking);
    thread.appendChild(out);
    reveal(out.wrap);
    atBottom();

    await wait(fast ? 80 : 900);
    thinking.remove();

    /* One chip, because one tool call is the truthful amount here. */
    const tool = document.createElement("div");
    tool.className = "morning-tool";
    tool.dataset.state = "running";
    tool.innerHTML =
      '<span class="morning-tool__name">读 · 今天的工作记录</span>' +
      '<span class="morning-tool__state">reading</span>';
    out.body.appendChild(tool);
    atBottom();
    await wait(fast ? 80 : 700);
    tool.dataset.state = "done";
    tool.querySelector(".morning-tool__state").textContent = "done";

    for (const [index, text] of REPLY.entries()) {
      const p = document.createElement("p");
      const caret = document.createElement("span");
      caret.className = "morning-caret";
      p.appendChild(caret);
      out.body.appendChild(p);
      for (let char = 0; char < text.length; char += 1) {
        caret.before(document.createTextNode(text[char]));
        if (!fast && char % 3 === 0) await wait(18);
      }
      caret.remove();
      if (index < REPLY.length - 1) await wait(fast ? 0 : 180);
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
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-send]")) reply();
    if (event.target.closest("[data-rail-toggle]")) {
      const app = document.querySelector(".morning-app");
      if (app) app.dataset.rail = app.dataset.rail === "true" ? "false" : "true";
    }
    if (event.target.closest("[data-new-session]")) {
      const group = list?.querySelector(".morning-group");
      if (!group) return;
      const row = document.createElement("button");
      row.type = "button";
      row.className = "morning-item";
      row.dataset.title = "新会话";
      row.innerHTML =
        '<span class="morning-item__dot"></span>' +
        '<span class="morning-item__label">新会话</span>';
      group.appendChild(row);
      row.click();
      textarea?.focus();
    }
  });
})();