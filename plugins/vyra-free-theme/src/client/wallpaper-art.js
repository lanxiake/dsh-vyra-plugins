/**
 * Code-art wallpaper document (pure string builder, no DOM).
 *
 * A theme's `art.js` is untrusted, local, author-supplied code. It runs inside
 * a sandboxed iframe whose origin is opaque (`allow-scripts` without
 * `allow-same-origin`), with a policy that forbids every network destination.
 * It therefore cannot read the host page, the session, or the network; the only
 * channel back is `postMessage`.
 *
 * Contract (spec §6.3): the module must provide `art.mount(canvas, env)` and
 * may return `{ destroy() {} }`. `env` carries only geometry, display mode and
 * the reduced-motion preference.
 */
export const CODE_ART_LIMITS = Object.freeze({
  maxSourceBytes: 256 * 1024,
  firstFrameTimeoutMs: 2000,
  maxFps: 30,
});

const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:";

/**
 * `export const art = …` / `export function art(…)` / `export default …`
 * become plain declarations pinned on `window.art`, because an inline module in
 * `srcdoc` cannot be imported from elsewhere.
 */
export function inlineArtSource(source) {
  let text = String(source ?? "");
  text = text.replace(/\bexport\s+default\s+/g, "window.art = ");
  text = text.replace(/\bexport\s+(const|let|var|function|class)\s+art\b/g, "$1 art");
  if (!/\bwindow\.art\s*=/.test(text)) {
    text += "\n;window.art = typeof art !== \"undefined\" ? art : window.art;";
  }
  // A literal `</script` inside the source would close the host <script> tag.
  return text.replace(/<\/script/gi, "<\\/script");
}

export function buildCodeArtDocument({ source, mode = "light", reducedMotion = false }) {
  const art = inlineArtSource(source);
  const safeMode = mode === "dark" ? "dark" : "light";
  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<style>
  html,body{margin:0;height:100%;overflow:hidden;background:transparent}
  canvas{display:block;width:100%;height:100%}
</style></head>
<body><canvas id="vft-art"></canvas>
<script>${art}</script>
<script>
(function () {
  var canvas = document.getElementById("vft-art");
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  var reduced = ${reducedMotion ? "true" : "false"};
  var env = {
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: dpr,
    mode: ${JSON.stringify(safeMode)},
    reducedMotion: reduced
  };
  function resize() {
    canvas.width = Math.max(1, Math.floor(window.innerWidth * dpr));
    canvas.height = Math.max(1, Math.floor(window.innerHeight * dpr));
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
  }
  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("message", function (event) {
    var data = event.data || {};
    if (data && data.vft === "mode" && (data.mode === "light" || data.mode === "dark")) {
      env.mode = data.mode;
    }
  });
  var handle = null;
  try {
    if (!window.art || typeof window.art.mount !== "function") {
      throw new Error("art.js must expose art.mount(canvas, env)");
    }
    handle = window.art.mount(canvas, env);
    // Publish "ready" only after a frame actually reached the canvas.
    requestAnimationFrame(function () {
      parent.postMessage({ vft: "ready" }, "*");
    });
  } catch (error) {
    parent.postMessage({ vft: "error", message: String((error && error.message) || error) }, "*");
  }
  window.addEventListener("pagehide", function () {
    try { if (handle && typeof handle.destroy === "function") handle.destroy(); } catch (e) {}
  });
})();
</script></body></html>`;
}