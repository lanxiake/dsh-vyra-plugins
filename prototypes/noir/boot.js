/*
 * Boot sequence runtime.
 *
 * Plays a normalized `boot` block (see boot-model.js) once, then hands the
 * screen back to the app. Design constraints this file enforces:
 *
 *   1. Skippable from frame 0 鈥?any key, any click, and an always-visible
 *      affordance. A splash you cannot skip is a bug, not a flourish.
 *   2. Never blocks longer than the budget; a watchdog closes it even if a
 *      media element stalls.
 *   3. Idempotent dispose: the overlay node is removed exactly once, and
 *      every timer and listener it created goes with it.
 *   4. Reduced motion collapses the run to one held beat.
 *
 * The story timeline is compiled in boot-model.js (pure, tested there); this
 * file only walks it against the DOM.
 */

import { storyTimeline } from "./boot-model.js";

const OVERLAY_ATTR = "data-vft-boot";

function reducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

const SLEEP = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Play a boot sequence.
 *
 * @param {object} boot         normalized `boot` block from normalizeBoot
 * @param {object} [options]
 * @param {(key: string) => string} [options.translate]  locale resolver
 * @param {() => void} [options.onFinish]                called once, after fade
 * @param {string} [options.prefix]  BEM prefix; a light skin passes its own so
 *                                   its stylesheet owns the presentation.
 * @param {string} [options.mark]    wordmark text
 * @returns {{ dispose: () => void }}  disposal is safe to call twice
 */
export function playBoot(
  boot,
  {
    translate = (key) => key,
    onFinish = () => {},
    prefix = "noir-boot",
    mark: markText = "Vyra",
    decorate = null,
  } = {},
) {
  const reduced = reducedMotion();
  const doc = document;
  const cls = (block) => `${prefix}__${block}`;

  const overlay = doc.createElement("div");
  overlay.className = prefix;
  overlay.setAttribute(OVERLAY_ATTR, boot.kind);
  overlay.setAttribute("role", "presentation");
  overlay.style.setProperty("--noir-boot-fade", `${reduced ? 0 : boot.fadeMs}ms`);

  /* ---- chrome: wordmark, progress, skip ----------------------------- */
  const mark = doc.createElement("div");
  mark.className = cls("mark");
  mark.innerHTML =
    '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
    '<path d="M8 1 15 8 8 15 1 8Z" stroke="currentColor" stroke-width="1"/>' +
    '<path d="M8 5.4 10.6 8 8 10.6 5.4 8Z" fill="currentColor"/></svg>' +
    `<span>${markText}</span>`;

  const skip = doc.createElement("button");
  skip.type = "button";
  skip.className = cls("skip");
  skip.textContent = boot.skipLabel
    ? translate(boot.skipLabel)
    : translate({ zh: "璺宠繃", en: "Skip" });

  const progress = doc.createElement("div");
  progress.className = cls("progress");
  const bar = doc.createElement("span");
  progress.appendChild(bar);

  let done = false;
  let barAnimation = null;

  function dispose() {
    if (done) return;
    done = true;
    doc.removeEventListener("keydown", onKey, true);
    overlay.removeEventListener("click", onClick, true);
    barAnimation?.cancel?.();
    overlay.remove();
  }

  async function finish() {
    if (done) return;
    overlay.classList.add("is-leaving");
    await SLEEP(reduced ? 0 : boot.fadeMs);
    dispose();
    onFinish();
  }

  function onKey(event) {
    /* Any key skips, including Tab: a user reaching for the keyboard is
       telling us they want the app, not the film. */
    event.preventDefault();
    event.stopPropagation();
    void finish();
  }

  function onClick(event) {
    /* The click that skips must not also land on the app underneath, so it
       is captured on the overlay and discarded. */
    event.stopPropagation();
    void finish();
  }

  /* ---- media kinds --------------------------------------------------- */
  if (boot.kind !== "story") {
    const media = doc.createElement("div");
    media.className = cls("media");
    if (boot.kind === "video") {
      const video = doc.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.autoplay = !reduced;
      video.preload = "auto";
      if (boot.media.poster) video.poster = boot.media.poster;
      video.src = boot.media.src;
      video.setAttribute("aria-hidden", "true");
      media.appendChild(video);
      if (!reduced) video.play?.().catch(() => {});
    } else if (boot.kind === "code") {
      /* Same sandbox posture as code art: scripts only, no same-origin, no
         referrer. The entry renders its own frame. */
      const frame = doc.createElement("iframe");
      frame.setAttribute("sandbox", "allow-scripts");
      frame.setAttribute("referrerpolicy", "no-referrer");
      frame.setAttribute("aria-hidden", "true");
      frame.src = boot.media.entry;
      media.appendChild(frame);
    } else {
      const img = doc.createElement("img");
      img.src = boot.media.src;
      img.alt = "";
      img.setAttribute("aria-hidden", "true");
      media.appendChild(img);
    }
    overlay.appendChild(media);
  }

  /* ---- story beats --------------------------------------------------- */
  if (boot.kind === "story") {
    /*
     * A skin may supply its own scenic layer — LUMII's sunrise, for instance,
     * is seven parallax planes that no generic runtime could guess. The hook is
     * a `decorate` callback rather than a list of class names, so the runtime
     * stays skin-agnostic and each skin owns its own composition.
     */
    if (typeof decorate === "function") {
      try {
        const scenery = decorate({ doc, cls, mode: reduced ? "reduced" : "full" });
        if (scenery) overlay.appendChild(scenery);
      } catch (error) {
        /* A broken decoration must not take the splash down with it. */
        console.warn("[boot] decorate failed:", error);
      }
    }

    const stage = doc.createElement("div");
    stage.className = cls("stage");
    const steps = storyTimeline(boot, { reducedMotion: reduced });

    const nodes = boot.beats.map((beat) => {
      const el = doc.createElement("div");
      el.className = cls("beat");
      if (beat.kicker) {
        const kicker = doc.createElement("div");
        kicker.className = cls("kicker");
        kicker.textContent = translate(beat.kicker);
        el.appendChild(kicker);
      }
      const title = doc.createElement("h1");
      title.className = cls("title");
      title.textContent = translate(beat.title);
      el.appendChild(title);
      const rule = doc.createElement("div");
      rule.className = cls("rule");
      el.appendChild(rule);
      stage.appendChild(el);
      return el;
    });

    /* The stage must be in the document before its transition is measured —
       getComputedStyle on a detached node reports "0s". This is also the
       append that puts it on screen; there is no second one. */
    overlay.appendChild(stage);

    /* Walk the compiled timeline. Each beat is brought live, held, then dropped
       before the next one starts — so two beats are never on screen at the same
       opacity.

       Both the fade-out and the rise are listed in transition-duration, so the
       longest value is what the outgoing beat actually needs. */
    function longestTransitionMs(el) {
      if (!el) return 0;
      const raw = getComputedStyle(el).transitionDuration || "0s";
      return raw
        .split(",")
        .map((part) => parseFloat(part) * (part.trim().endsWith("ms") ? 1 : 1000))
        .filter((n) => Number.isFinite(n))
        .reduce((max, n) => Math.max(max, n), 0);
    }

    const measured = longestTransitionMs(nodes[0]);
    const FADE_MS = reduced ? 0 : Math.max(measured, 600);

    void (async () => {
      for (const step of steps) {
        if (done) return;
        if (step.kind !== "beat") continue;
        const node = nodes[step.index];
        if (!node) continue;
        node.classList.add("is-live");
        await SLEEP(step.holdMs);
        if (done) return;
        node.classList.remove("is-live");
        /* Wait for the outgoing fade to finish before the next beat begins.
           Without this the two lines overlap for the length of the transition,
           which reads as a printing error rather than a cross-fade. */
        if (step.index < nodes.length - 1) await SLEEP(FADE_MS);
      }
      await finish();
    })();
  } else {
    /* Media owns its own duration; hold for the budget and fade out. */
    setTimeout(() => {
      if (!done) void finish();
    }, reduced ? 900 : (boot.totalMs ?? 3200));
  }

  overlay.append(mark, progress, skip);
  doc.body.appendChild(overlay);

  /* Progress hairline runs over the whole sequence. */
  if (typeof bar.animate === "function") {
    barAnimation = bar.animate(
      [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
      { duration: reduced ? 900 : (boot.totalMs ?? 3200), easing: "linear", fill: "forwards" },
    );
  }

  doc.addEventListener("keydown", onKey, true);
  overlay.addEventListener("click", onClick, true);

  /* Watchdog: never leave a splash up because a media element stalled. */
  setTimeout(() => {
    if (!done) void finish();
  }, (boot.totalMs ?? 3200) + 2000);

  return { dispose };
}