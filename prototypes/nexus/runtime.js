/*
 * NEXUS interaction runtime — the behaviour shared by every skin.
 *
 * Deliberately small and dependency-free: this is a prototype, so the only
 * thing it has to prove is the *feel*. Anything that would need the real
 * DSH client (slots, host routes, the projector) is stubbed in the demo.
 *
 * What it does:
 *   1. press feedback      pointerdown -> .is-pressed, pointerup -> release
 *   2. pulse rings         one ring spawned at the pointer, removed on end
 *   3. bracket intent      pointer offset fed to --nx-intent-x/y
 *   4. motion intensity    the `balanced | subtle | vivid` switch from the
 *                          design: one number, multiplied into amplitudes
 *   5. reduced-motion      mirrors the OS setting into a class the CSS reads
 */
(function nexusRuntime() {
  "use strict";

  const INTENSITY = { subtle: 0.55, balanced: 1, vivid: 1.55 };

  /* ------------------------------------------------------------------ */
  /* Motion intensity                                                    */
  /* ------------------------------------------------------------------ */
  function applyIntensity(name) {
    const value = INTENSITY[name] ?? INTENSITY.balanced;
    document.documentElement.style.setProperty("--nx-int", String(value));
    document.documentElement.dataset.nxIntensity = name;
    for (const btn of document.querySelectorAll("[data-nx-intensity]")) {
      btn.setAttribute(
        "aria-pressed",
        btn.dataset.nxIntensity === name ? "true" : "false"
      );
    }
  }

  /* ------------------------------------------------------------------ */
  /* Pulse ring                                                          */
  /* ------------------------------------------------------------------ */
  let ringPool = [];

  function spawnPulse(x, y, host) {
    if (document.documentElement.style.getPropertyValue("--nx-int") === "0") return;
    const ring = ringPool.pop() ?? document.createElement("span");
    ring.className = "nx-pulse";
    /* The accent is read off the *host* element so a pulse inside a cyan
       panel is cyan, not the page accent. */
    const accent = host
      ? getComputedStyle(host).getPropertyValue("--nx-accent").trim()
      : "";
    if (accent) ring.style.borderColor = accent;
    ring.style.transform = `translate(${x}px, ${y}px)`;
    document.body.appendChild(ring);
    ring.addEventListener(
      "animationend",
      () => {
        ring.remove();
        if (ringPool.length < 24) ringPool.push(ring);
      },
      { once: true }
    );
  }

  /* ------------------------------------------------------------------ */
  /* Press + pulse, delegated so dynamically-added rows work too         */
  /* ------------------------------------------------------------------ */
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (event.button !== 0) return;
      const target = event.target.closest(".nx-press");
      if (!target) return;
      target.classList.add("is-pressed");
      /* The pulse is the "confirmation" channel; it starts on the same
         frame as the press so the two read as one event. */
      spawnPulse(event.clientX, event.clientY, target);
    },
    { passive: true }
  );

  for (const type of ["pointerup", "pointercancel", "pointerleave"]) {
    document.addEventListener(
      type,
      () => {
        for (const el of document.querySelectorAll(".nx-press.is-pressed")) {
          el.classList.remove("is-pressed");
        }
      },
      { passive: true }
    );
  }

  /* ------------------------------------------------------------------ */
  /* Bracket intent — pointer offset nudges the corner brackets          */
  /* ------------------------------------------------------------------ */
  document.addEventListener(
    "pointermove",
    (event) => {
      const host = event.target.closest(".nx-bracket-host");
      if (!host) return;
      /* Cheap throttle: one write per animation frame at most. */
      if (host.dataset.nxRaf === "1") return;
      host.dataset.nxRaf = "1";
      const { clientX, clientY } = event;
      requestAnimationFrame(() => {
        host.dataset.nxRaf = "0";
        const rect = host.getBoundingClientRect();
        /* -1 .. 1 across the element, so the bracket leans toward the pointer */
        const dx = ((clientX - rect.left) / rect.width - 0.5) * 2;
        const dy = ((clientY - rect.top) / rect.height - 0.5) * 2;
        host.style.setProperty("--nx-intent-x", dx.toFixed(2));
        host.style.setProperty("--nx-intent-y", dy.toFixed(2));
      });
    },
    { passive: true }
  );

  /* ------------------------------------------------------------------ */
  /* Reduced motion mirror                                               */
  /* ------------------------------------------------------------------ */
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  function syncReducedMotion() {
    document.documentElement.dataset.nxReduced = motionQuery.matches ? "1" : "0";
  }
  motionQuery.addEventListener?.("change", syncReducedMotion);
  syncReducedMotion();

  /* ------------------------------------------------------------------ */
  /* Wiring                                                              */
  /* ------------------------------------------------------------------ */
  document.addEventListener("click", (event) => {
    const intensity = event.target.closest("[data-nx-intensity]");
    if (intensity) applyIntensity(intensity.dataset.nxIntensity);
  });

  applyIntensity("balanced");

  window.NEXUS = { applyIntensity, spawnPulse, INTENSITY };
})();