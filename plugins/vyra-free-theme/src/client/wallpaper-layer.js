/**
 * Element-backed wallpaper layers (runtime, DOM).
 *
 * Static and animated art stay on the CSS background (`body::before`). Video
 * and code art need real nodes, so they live in one fixed, click-through
 * container at the backdrop z-index. Everything here is disposable: the
 * returned function removes the nodes, cancels in-flight fetches and stops
 * observers, because theme switches and unmounts must leave nothing behind.
 */
import { buildCodeArtDocument, CODE_ART_LIMITS } from "./wallpaper-art.js";

const HOST_ATTR = "data-vft-wallpaper";

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

function isDark() {
  return document.body?.hasAttribute("data-ds-dark-theme") ?? false;
}

function mountVideoLayer(host, layer) {
  const video = document.createElement("video");
  video.muted = true;
  video.loop = true;
  video.preload = "auto";
  video.setAttribute("muted", "");
  video.setAttribute("playsinline", "");
  video.setAttribute("aria-hidden", "true");
  video.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover";
  const reduced = prefersReducedMotion();
  if (reduced) video.autoplay = false;

  const side = () => (isDark() ? (layer.dark ?? layer.light) : (layer.light ?? layer.dark));
  let current = null;
  const applySide = () => {
    const next = side();
    if (next === null || next === undefined) return;
    if (current === next.src) return;
    current = next.src;
    if (next.poster) video.poster = next.poster;
    video.src = next.src;
    if (!reduced) video.play?.().catch(() => {});
  };
  applySide();

  const onVisibility = () => {
    if (reduced) return;
    if (document.hidden) video.pause?.();
    else video.play?.().catch(() => {});
  };
  document.addEventListener("visibilitychange", onVisibility);
  const observer = new MutationObserver(() => applySide());
  if (document.body) {
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-ds-dark-theme", "data-ds-light-theme"] });
  }
  host.appendChild(video);

  return () => {
    observer.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    video.pause?.();
    video.removeAttribute("src");
    video.load?.();
    video.remove();
  };
}

function mountCodeLayer(host, layer) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox", "allow-scripts");
  iframe.setAttribute("referrerpolicy", "no-referrer");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:absolute;inset:0;width:100%;height:100%;border:0";
  host.appendChild(iframe);

  const controller = typeof AbortController === "function" ? new AbortController() : null;
  let ready = false;
  let disposed = false;
  let watchdog = null;

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (watchdog !== null) clearTimeout(watchdog);
    controller?.abort();
    iframe.remove();
  };

  const onMessage = (event) => {
    if (event.source !== iframe.contentWindow) return;
    const data = event.data ?? {};
    if (data.vft === "ready") {
      ready = true;
      if (watchdog !== null) clearTimeout(watchdog);
    } else if (data.vft === "error") {
      dispose();
    }
  };
  window.addEventListener("message", onMessage);

  const postMode = () => {
    try {
      iframe.contentWindow?.postMessage({ vft: "mode", mode: isDark() ? "dark" : "light" }, "*");
    } catch {}
  };
  const observer = new MutationObserver(postMode);
  if (document.body) {
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-ds-dark-theme", "data-ds-light-theme"] });
  }

  fetch(layer.entry, { cache: "no-store", signal: controller?.signal })
    .then((response) => {
      if (!response.ok) throw new Error(`art.js answered HTTP ${response.status}`);
      return response.text();
    })
    .then((source) => {
      if (disposed) return;
      if (source.length > CODE_ART_LIMITS.maxSourceBytes) throw new Error("art.js is too large");
      iframe.srcdoc = buildCodeArtDocument({
        source,
        mode: isDark() ? "dark" : "light",
        reducedMotion: prefersReducedMotion(),
      });
      watchdog = setTimeout(() => {
        // No first frame within the budget: fall back to the theme's gradient
        // rather than leaving a blank iframe over the interface.
        if (!ready) dispose();
      }, CODE_ART_LIMITS.firstFrameTimeoutMs);
    })
    .catch(() => {
      if (!disposed) dispose();
    });

  return () => {
    window.removeEventListener("message", onMessage);
    observer.disconnect();
    dispose();
  };
}

/**
 * Mount every layer a projection asked for. Returns a disposer, or null when
 * the theme has no element-backed wallpaper.
 */
export function mountWallpaperLayers({ layers, skinId }) {
  if (!Array.isArray(layers) || layers.length === 0) return null;
  if (!document.body) return null;
  const host = document.createElement("div");
  host.setAttribute(HOST_ATTR, skinId);
  host.style.cssText = "position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none";
  const disposers = [];
  for (const layer of layers) {
    if (layer?.kind === "video") disposers.push(mountVideoLayer(host, layer));
    else if (layer?.kind === "code") disposers.push(mountCodeLayer(host, layer));
  }
  if (disposers.length === 0) return null;
  document.body.appendChild(host);
  return () => {
    for (const dispose of disposers) {
      try { dispose(); } catch {}
    }
    host.remove();
  };
}