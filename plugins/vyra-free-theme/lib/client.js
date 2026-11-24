"use strict";
(() => {
  // src/shared/personalization/catalog.js
  var GLOBAL_MAX_BYTES = 20 * 1024 * 1024;
  var GLOBAL_MAX_PIXELS = 4e7;
  var GIF_MAX_PIXELS = 12e6;
  var ASSET_ID_PATTERN = /^u_[0-9a-f]{32}$/;
  var BUILTIN_REF_PATTERN = /^builtin:([a-z0-9][a-z0-9-]*):([a-z0-9][a-z0-9-]*)$/;
  function defaultWallpaperRef(skinId) {
    const skin = skinEntry(skinId);
    if (skin === void 0 || skin === null) return void 0;
    const field = skin.fields.find((candidate) => candidate.key === "wallpaper");
    return field?.default ?? void 0;
  }
  var EXTERNAL_SKINS = /* @__PURE__ */ new Map();
  function registerExternalSkin({ id, fields, builtinAssets = {} }) {
    if (typeof id !== "string" || !/^[a-z][a-z0-9-]{1,39}$/.test(id)) {
      throw new Error(`[dsh-vyra-free-theme] external skin id "${id}" is malformed`);
    }
    if (Object.hasOwn(SKINS, id)) {
      throw new Error(`[dsh-vyra-free-theme] external skin "${id}" collides with a compiled-in skin`);
    }
    if (!Array.isArray(fields) || fields.length === 0) {
      throw new Error(`[dsh-vyra-free-theme] external skin "${id}" needs at least one field`);
    }
    EXTERNAL_SKINS.set(id, { id, fields, builtinAssets });
    return id;
  }
  function skinEntry(skinId) {
    return Object.hasOwn(SKINS, skinId) ? SKINS[skinId] : EXTERNAL_SKINS.get(skinId) ?? null;
  }
  var USER_IMAGE_MIMES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
  var WALLPAPER_FIELD = {
    key: "wallpaper",
    type: "image",
    scope: "single",
    labelKey: "personalization.wallpaper",
    default: null,
    // filled per skin below
    allowedUserMime: USER_IMAGE_MIMES,
    maxBytes: GLOBAL_MAX_BYTES,
    maxWidth: 16384,
    maxHeight: 16384,
    maxPixels: GLOBAL_MAX_PIXELS
  };
  var SKINS = {
    // ADR-0004 (reversing design §9a): every catalog skin declares the same
    // standard field set. Slogan defaults are single-sourced here (ADR-0014/B14)
    // — the factories carry no static copies. panelOpacity defaults are each
    // skin's 出厂锚 (GLOSSARY; 55/55/35 web, 66 desktop): they anchor the riding
    // rebase and blur hinge inside skins/translucency.js, and the byte-equality
    // at the anchor is pinned by tests/translucency-contract.test.mjs. Legacy
    // wallpaper semantics (scrim never applies to user images, placeholder
    // branch) live in the translucency projection kernel's wallpaper branches.
    // openbmc 与 uefi-harness 随内置主题一并退役；meirenzhi 是现存的唯一编译皮肤。
    // 美人志（v1.0.6 前的出厂皮肤）：6 张内置精选，出厂默认 yuntai
    // （001合照）领头并对齐已移除 tgcf 皮肤的「出厂默认领先」惯例；panelOpacity 锚定
    // 其二次曲线（projector 数学见 skins/meirenzhi/index.js）。
    meirenzhi: {
      builtinAssets: {
        yuntai: { mime: "image/webp", labelKey: "personalization.meirenzhi.yuntai" },
        mupeiling: { mime: "image/webp", labelKey: "personalization.meirenzhi.mupeiling" },
        ziling: { mime: "image/webp", labelKey: "personalization.meirenzhi.ziling" },
        nangongwan: { mime: "image/webp", labelKey: "personalization.meirenzhi.nangongwan" },
        nangongque: { mime: "image/webp", labelKey: "personalization.meirenzhi.nangongque" },
        yinyue: { mime: "image/webp", labelKey: "personalization.meirenzhi.yinyue" }
      },
      fields: [
        {
          ...WALLPAPER_FIELD,
          default: "builtin:meirenzhi:yuntai",
          builtinChoices: [
            "yuntai",
            "mupeiling",
            "ziling",
            "nangongwan",
            "nangongque",
            "yinyue"
          ]
        },
        {
          key: "slogan",
          type: "text",
          scope: "locale",
          labelKey: "personalization.slogan",
          maxLength: 40,
          default: { zh: "风起凡尘 · 红颜问道", en: "From mortal dust, immortals bloom" }
        },
        {
          key: "panelOpacity",
          type: "range",
          scope: "single",
          labelKey: "personalization.panelTranslucency",
          min: 0,
          max: 100,
          step: 1,
          unit: "%",
          default: 35
        }
      ]
    }
  };
  function getSkinSchema(skinId, profile = "web") {
    if (!Object.hasOwn(SKINS, skinId)) {
      const external = EXTERNAL_SKINS.get(skinId);
      if (external === void 0) return null;
      return { skinId, fields: external.fields, builtinAssets: external.builtinAssets };
    }
    const entry = SKINS[skinId];
    const fields = profile === "desktop" ? entry.fields.map((field) => field.key === "panelOpacity" ? { ...field, default: 66 } : field) : entry.fields;
    return { skinId, fields, builtinAssets: entry.builtinAssets };
  }
  function getField(skinId, key) {
    return skinEntry(skinId)?.fields.find((field) => field.key === key) ?? null;
  }
  function defaultsFor(skinId, profile = "web") {
    const values = {};
    for (const field of getSkinSchema(skinId, profile)?.fields ?? []) values[field.key] = field.default;
    return values;
  }
  function isSameOverrideValue(a, b) {
    if (a === b) return true;
    if (a === null || b === null || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) || Array.isArray(b)) {
      return false;
    }
    const keysA = Object.keys(a);
    return keysA.length === Object.keys(b).length && keysA.every((key) => Object.hasOwn(b, key) && isSameOverrideValue(a[key], b[key]));
  }
  function resolveImageRef(value) {
    if (typeof value !== "string" || value.length === 0) return null;
    if (value.startsWith("builtin:")) {
      const match = BUILTIN_REF_PATTERN.exec(value);
      return match === null ? null : { kind: "builtin", skinId: match[1], assetKey: match[2] };
    }
    if (ASSET_ID_PATTERN.test(value)) return { kind: "user", id: value };
    return null;
  }
  var HEX_COLOR = /^#[0-9a-f]{6}$/i;
  var CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
  function scopeKeys(scope) {
    if (scope === "locale") return ["zh", "en"];
    if (scope === "colorScheme") return ["light", "dark"];
    return null;
  }
  function validScopeObject(value, scope, checkMember) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const keys = scopeKeys(scope);
    if (Object.keys(value).length !== keys.length) return false;
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) return false;
      if (!checkMember(value[key])) return false;
    }
    return true;
  }
  function validateTextMember(value, field) {
    if (typeof value !== "string") return false;
    if (CONTROL_CHARS.test(value)) return false;
    return value.length <= field.maxLength;
  }
  function validateRangeMember(value, field) {
    if (typeof value !== "number" || !Number.isFinite(value)) return false;
    if (value < field.min || value > field.max) return false;
    if (field.step !== void 0 && field.step > 0) {
      const steps = (value - field.min) / field.step;
      if (Math.abs(steps - Math.round(steps)) > 1e-9) return false;
    }
    return true;
  }
  function validateScalar(value, field) {
    switch (field.type) {
      case "text":
        return validateTextMember(value, field);
      case "range":
        return validateRangeMember(value, field);
      case "select":
        return typeof value === "string" && field.options.some((option) => option.value === value);
      default:
        return false;
    }
  }
  function validateImageRef(value, field, skinId, meta) {
    const ref = resolveImageRef(value);
    if (ref === null) return false;
    if (ref.kind === "builtin") {
      if (ref.skinId !== skinId) return false;
      return skinEntry(skinId)?.builtinAssets[ref.assetKey] !== void 0;
    }
    if (meta === void 0 || meta === null) return true;
    return metaSatisfiesField(field, meta);
  }
  function metaSatisfiesField(field, meta) {
    if (typeof meta.mime !== "string" || !field.allowedUserMime.includes(meta.mime)) return false;
    if (meta.byteLength > field.maxBytes) return false;
    if (meta.width > field.maxWidth || meta.height > field.maxHeight) return false;
    const maxPixels = meta.mime === "image/gif" ? Math.min(field.maxPixels, GIF_MAX_PIXELS) : field.maxPixels;
    return meta.width * meta.height <= maxPixels;
  }
  function validateOverride(skinId, key, value, metaProvider) {
    const field = getField(skinId, key);
    if (field === null) return { ok: false, code: "UNKNOWN_FIELD" };
    const provider = typeof metaProvider === "function" ? metaProvider : void 0;
    if (field.scope === "single") {
      if (field.type === "image") {
        const ref = resolveImageRef(value);
        if (ref === null) return { ok: false, code: "BAD_SHAPE" };
        if (ref.kind === "builtin") {
          if (!validateImageRef(value, field, skinId, void 0)) return { ok: false, code: "BAD_ASSET" };
          return { ok: true };
        }
        if (provider !== void 0) {
          const meta = provider(ref.id);
          if (meta === null) return { ok: false, code: "MISSING_ASSET" };
          if (!validateImageRef(value, field, skinId, meta)) return { ok: false, code: "BAD_ASSET" };
        }
        return { ok: true };
      }
      if (!validateScalar(value, field)) return { ok: false, code: "BAD_VALUE" };
      return { ok: true };
    }
    if (!validScopeObject(value, field.scope, (member) => {
      if (field.type === "text") return validateTextMember(member, field);
      if (field.type === "range") return validateRangeMember(member, field);
      if (field.type === "color") return typeof member === "string" && HEX_COLOR.test(member);
      return false;
    })) return { ok: false, code: "BAD_SHAPE" };
    return { ok: true };
  }
  function mergeValues(skinId, overrides, metaProvider, profile = "web") {
    const schema = getSkinSchema(skinId, profile);
    if (schema === null) return { values: {}, issues: [] };
    const provider = typeof metaProvider === "function" ? metaProvider : void 0;
    const values = {};
    const issues = [];
    for (const field of schema.fields) {
      const override = overrides?.[field.key];
      if (override === void 0) {
        values[field.key] = field.default;
        continue;
      }
      const verdict = validateOverride(skinId, field.key, override, provider);
      if (verdict.ok) {
        values[field.key] = override;
      } else {
        values[field.key] = field.default;
        issues.push({ key: field.key, code: verdict.code });
      }
    }
    return { values, issues };
  }

  // src/client/personalization/projector.js
  var DATASET_KEY = /^[a-zA-Z][a-zA-Z0-9]*$/;
  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  function deepFreeze(value) {
    if (value === null || typeof value !== "object") return value;
    for (const child of Object.values(value)) deepFreeze(child);
    return Object.freeze(value);
  }
  function optionalString(value) {
    if (value === void 0 || value === null) return null;
    return typeof value === "string" ? value : void 0;
  }
  function validLayers(layers) {
    if (!Array.isArray(layers)) return false;
    for (const layer of layers) {
      if (!isPlainObject(layer)) return false;
      if (layer.kind === "video") {
        for (const side of [layer.light, layer.dark]) {
          if (side === null || side === void 0) continue;
          if (!isPlainObject(side) || typeof side.src !== "string" || side.src.length === 0) return false;
          if (side.poster !== null && side.poster !== void 0 && typeof side.poster !== "string") return false;
        }
        if (layer.light == null && layer.dark == null) return false;
        continue;
      }
      if (layer.kind === "code") {
        if (typeof layer.entry !== "string" || layer.entry.length === 0) return false;
        continue;
      }
      return false;
    }
    return true;
  }
  function normalizeEffects(draft) {
    let source;
    try {
      source = structuredClone(draft);
    } catch {
      return null;
    }
    if (!isPlainObject(source)) return null;
    if (typeof source.bodyAttribute !== "string" || !DATASET_KEY.test(source.bodyAttribute)) return null;
    const slogans = source.slogans ?? null;
    if (slogans !== null && (!isPlainObject(slogans) || typeof slogans.zh !== "string" || typeof slogans.en !== "string")) return null;
    const titleBrand = optionalString(source.titleBrand);
    if (titleBrand === void 0) return null;
    const favicon = source.favicon ?? null;
    if (favicon !== null && (!isPlainObject(favicon) || typeof favicon.href !== "string" || favicon.href.length === 0 || typeof favicon.mime !== "string")) return null;
    const backdrop = source.backdrop ?? null;
    if (backdrop !== null) {
      if (!isPlainObject(backdrop)) return null;
      for (const key of ["imageLight", "imageDark", "overlayLight", "overlayDark"]) {
        const value = backdrop[key] ?? null;
        if (value !== null && typeof value !== "string") return null;
      }
      const blur = backdrop.blur ?? 0;
      if (typeof blur !== "number" || !(blur >= 0 && blur <= 24)) return null;
      const desktopBlur = backdrop.desktopBlur ?? null;
      if (desktopBlur !== null) {
        if (!isPlainObject(desktopBlur)) return null;
        for (const key of ["light", "dark"]) {
          const value = desktopBlur[key];
          if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 24) return null;
        }
      }
    }
    const tokenOverrides = source.tokenOverrides ?? null;
    if (tokenOverrides !== null) {
      if (!isPlainObject(tokenOverrides)) return null;
      for (const value of Object.values(tokenOverrides)) {
        if (!isPlainObject(value) || typeof value.light !== "string" || typeof value.dark !== "string") return null;
      }
    }
    const cssVariables = source.cssVariables ?? null;
    if (cssVariables !== null) {
      if (!isPlainObject(cssVariables)) return null;
      for (const value of Object.values(cssVariables)) {
        if (!isPlainObject(value) || typeof value.light !== "string" || typeof value.dark !== "string") return null;
      }
    }
    const staticCss = optionalString(source.staticCss);
    if (staticCss === void 0) return null;
    const decorations = source.decorations ?? null;
    if (decorations !== null) {
      if (!Array.isArray(decorations)) return null;
      for (const decoration of decorations) {
        if (!isPlainObject(decoration) || typeof decoration.key !== "string" || decoration.key.length === 0 || typeof decoration.css !== "string") return null;
      }
    }
    const layers = source.backdrop?.layers ?? null;
    if (layers !== null && !validLayers(layers)) return null;
    const coverage = source.coverage ?? null;
    if (coverage !== null) {
      if (!isPlainObject(coverage) || typeof coverage.shell !== "boolean") return null;
      if (coverage.scopes !== void 0 && (!Array.isArray(coverage.scopes) || coverage.scopes.some((scope) => typeof scope !== "string"))) return null;
    }
    const sidebar = source.sidebar ?? null;
    if (sidebar !== null && (!isPlainObject(sidebar) || typeof sidebar.pack !== "string")) return null;
    return deepFreeze({
      bodyAttribute: source.bodyAttribute,
      slogans,
      titleBrand,
      favicon,
      sidebar,
      coverage: coverage === null ? null : { shell: coverage.shell, scopes: coverage.scopes ?? [] },
      backdrop: backdrop === null ? null : {
        imageLight: backdrop.imageLight ?? null,
        imageDark: backdrop.imageDark ?? null,
        overlayLight: backdrop.overlayLight ?? null,
        overlayDark: backdrop.overlayDark ?? null,
        blur: backdrop.blur ?? 0,
        desktopBlur: backdrop.desktopBlur ?? null,
        layers
      },
      tokenOverrides,
      cssVariables,
      staticCss,
      decorations
    });
  }
  function projectSkin(skin, rawOverrides, context = {}) {
    const schema = getSkinSchema(skin.id, context.profile);
    if (schema === null) {
      return { effects: null, issues: [], degraded: "failed" };
    }
    const project = skin.project;
    const attempt = (overrides) => {
      const { values, issues } = mergeValues(skin.id, overrides, context.metaProvider, context.profile);
      const resolvedAssets = {};
      for (const field of schema.fields) {
        if (field.type !== "image") continue;
        const ref = resolveImageRef(values[field.key]);
        if (ref === null) continue;
        const resolved = context.assetResolver?.(ref) ?? null;
        if (resolved === null || typeof resolved.url !== "string" || resolved.url.length === 0) {
          throw new Error(`asset resolution failed for ${skin.id}.${field.key}`);
        }
        resolvedAssets[field.key] = resolved;
      }
      return { issues, normalized: normalizeEffects(project(values, resolvedAssets)) };
    };
    const safeAttempt = (overrides) => {
      try {
        return attempt(overrides);
      } catch {
        return { issues: [], normalized: null, crashed: true };
      }
    };
    const first = safeAttempt(rawOverrides ?? {});
    if (first.normalized !== null) return { effects: first.normalized, issues: first.issues, degraded: "none" };
    const second = safeAttempt(defaultsFor(skin.id, context.profile));
    if (second.normalized !== null) return { effects: second.normalized, issues: first.issues, degraded: "defaults" };
    return { effects: null, issues: first.issues, degraded: "failed" };
  }

  // src/client/wallpaper-art.js
  var CODE_ART_LIMITS = Object.freeze({
    maxSourceBytes: 256 * 1024,
    firstFrameTimeoutMs: 2e3,
    maxFps: 30
  });
  var CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:";
  function inlineArtSource(source) {
    let text = String(source ?? "");
    text = text.replace(/\bexport\s+default\s+/g, "window.art = ");
    text = text.replace(/\bexport\s+(const|let|var|function|class)\s+art\b/g, "$1 art");
    if (!/\bwindow\.art\s*=/.test(text)) {
      text += '\n;window.art = typeof art !== "undefined" ? art : window.art;';
    }
    return text.replace(/<\/script/gi, "<\\/script");
  }
  function buildCodeArtDocument({ source, mode = "light", reducedMotion = false }) {
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
<script>${art}<\/script>
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
<\/script></body></html>`;
  }

  // src/client/wallpaper-layer.js
  var HOST_ATTR = "data-vft-wallpaper";
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
    const side = () => isDark() ? layer.dark ?? layer.light : layer.light ?? layer.dark;
    let current = null;
    const applySide = () => {
      const next = side();
      if (next === null || next === void 0) return;
      if (current === next.src) return;
      current = next.src;
      if (next.poster) video.poster = next.poster;
      video.src = next.src;
      if (!reduced) video.play?.().catch(() => {
      });
    };
    applySide();
    const onVisibility = () => {
      if (reduced) return;
      if (document.hidden) video.pause?.();
      else video.play?.().catch(() => {
      });
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
      } catch {
      }
    };
    const observer = new MutationObserver(postMode);
    if (document.body) {
      observer.observe(document.body, { attributes: true, attributeFilter: ["data-ds-dark-theme", "data-ds-light-theme"] });
    }
    fetch(layer.entry, { cache: "no-store", signal: controller?.signal }).then((response) => {
      if (!response.ok) throw new Error(`art.js answered HTTP ${response.status}`);
      return response.text();
    }).then((source) => {
      if (disposed) return;
      if (source.length > CODE_ART_LIMITS.maxSourceBytes) throw new Error("art.js is too large");
      iframe.srcdoc = buildCodeArtDocument({
        source,
        mode: isDark() ? "dark" : "light",
        reducedMotion: prefersReducedMotion()
      });
      watchdog = setTimeout(() => {
        if (!ready) dispose();
      }, CODE_ART_LIMITS.firstFrameTimeoutMs);
    }).catch(() => {
      if (!disposed) dispose();
    });
    return () => {
      window.removeEventListener("message", onMessage);
      observer.disconnect();
      dispose();
    };
  }
  function mountWallpaperLayers({ layers, skinId }) {
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
        try {
          dispose();
        } catch {
        }
      }
      host.remove();
    };
  }

  // src/client/sidebar-theme.js
  var INTERACTIVE = 'a,button,[role="button"],[role="treeitem"],[role="option"],[tabindex]:not([tabindex="-1"])';
  var COLUMN = '[class*="_sidebarCol"]';
  function installSidebarTagging() {
    if (typeof document === "undefined" || !document.body) return null;
    const tagged = /* @__PURE__ */ new Set();
    let observer = null;
    let frame = 0;
    let attached = false;
    const tagWithin = (column) => {
      for (const element of column.querySelectorAll(INTERACTIVE)) {
        if (!element.hasAttribute("data-vft-sb-item")) {
          element.setAttribute("data-vft-sb-item", "");
          tagged.add(element);
        }
      }
    };
    const attach = () => {
      const column = document.querySelector(COLUMN);
      if (column === null) return false;
      tagWithin(column);
      if (!attached) {
        attached = true;
        observer.disconnect();
        observer.observe(column, { childList: true, subtree: true });
      }
      return true;
    };
    const schedule = () => {
      if (frame !== 0) return;
      const run = () => {
        frame = 0;
        try {
          attach();
        } catch {
        }
      };
      frame = typeof requestAnimationFrame === "function" ? requestAnimationFrame(run) : (setTimeout(run, 16), 1);
    };
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    attach();
    return () => {
      observer.disconnect();
      if (frame !== 0 && typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
      for (const element of tagged) {
        try {
          element.removeAttribute("data-vft-sb-item");
        } catch {
        }
      }
      tagged.clear();
    };
  }

  // src/shared/personalization/sidebar-presets.js
  var SIDEBAR_PACKS = Object.freeze({
    // Same tone as the rest of the theme: only radius/icon/states get touched.
    inherit: { surface: "inherit", blur: 0, density: "cozy", radius: { card: 14, item: 8 } },
    // Translucent panel floating over the wallpaper.
    frost: { surface: "frost", blur: 14, density: "cozy", radius: { card: 16, item: 10 } },
    // Paper-like: transparent fill, hairline separators.
    hairline: { surface: "wallpaper", blur: 0, density: "compact", radius: { card: 0, item: 0 } },
    // Deep solid card with a bright accent.
    obsidian: { surface: "solid", blur: 0, density: "comfortable", radius: { card: 14, item: 10 } },
    // Dark translucent with glowing edges.
    neon: { surface: "frost", blur: 18, density: "cozy", radius: { card: 16, item: 12 } }
  });
  var SIDEBAR_SURFACES = ["inherit", "solid", "frost", "wallpaper", "custom"];
  var SIDEBAR_DENSITIES = ["compact", "cozy", "comfortable"];
  var DENSITY_METRICS = {
    compact: { padY: 4, minHeight: 26, gap: 2 },
    cozy: { padY: 6, minHeight: 30, gap: 4 },
    comfortable: { padY: 9, minHeight: 34, gap: 6 }
  };
  function hexToRgbChannels(hex) {
    const value = /^#([0-9a-f]{6})$/i.exec(hex);
    if (value === null) return null;
    const int = parseInt(value[1], 16);
    return `${int >> 16 & 255}, ${int >> 8 & 255}, ${int & 255}`;
  }
  function withAlpha(color, alpha) {
    const channels = hexToRgbChannels(color);
    if (channels === null) return color;
    return `rgba(${channels}, ${alpha})`;
  }
  function resolveSidebar(theme) {
    const explicit = theme.sidebar ?? {};
    const packName = SIDEBAR_PACKS[explicit.pack] !== void 0 ? explicit.pack : "inherit";
    const pack = SIDEBAR_PACKS[packName];
    const surface = SIDEBAR_SURFACES.includes(explicit.surface) ? explicit.surface : pack.surface;
    const density = SIDEBAR_DENSITIES.includes(explicit.density) ? explicit.density : pack.density;
    const blur = Number.isInteger(explicit.blur) ? explicit.blur : pack.blur;
    const radius = {
      card: Number.isInteger(explicit.radius?.card) ? explicit.radius.card : pack.radius.card,
      item: Number.isInteger(explicit.radius?.item) ? explicit.radius.item : pack.radius.item
    };
    const light = theme.colors.light;
    const dark = theme.colors.dark;
    const labelLight = light["--dsw-alias-label-secondary"] ?? light["--dsw-alias-label-primary"];
    const labelDark = dark["--dsw-alias-label-secondary"] ?? dark["--dsw-alias-label-primary"];
    const icon = explicit.icon ?? { light: labelLight, dark: labelDark };
    const brandLight = light["--dsw-alias-brand-primary"] ?? labelLight;
    const brandDark = dark["--dsw-alias-brand-primary"] ?? labelDark;
    const states = {
      hover: explicit.states?.hover ?? {
        bg: withAlpha(light["--dsw-alias-label-primary"] ?? "#000000", "0.05"),
        darkBg: withAlpha(dark["--dsw-alias-label-primary"] ?? "#ffffff", "0.07"),
        fg: null
      },
      active: explicit.states?.active ?? {
        bg: withAlpha(light["--dsw-alias-label-primary"] ?? "#000000", "0.08"),
        darkBg: withAlpha(dark["--dsw-alias-label-primary"] ?? "#ffffff", "0.10"),
        fg: null
      },
      selected: explicit.states?.selected ?? {
        bg: withAlpha(brandLight, "0.14"),
        darkBg: withAlpha(brandDark, "0.20"),
        fg: brandLight,
        darkFg: brandDark,
        indicator: brandLight,
        darkIndicator: brandDark
      }
    };
    return {
      pack: packName,
      surface,
      blur,
      density,
      metrics: DENSITY_METRICS[density],
      radius,
      icon: { light: icon.light, dark: icon.dark },
      states,
      divider: explicit.divider ?? null,
      background: explicit.background ?? null
    };
  }
  var HOOK = {
    col: '[class*="_sidebarCol"]',
    root: '[class*="_root"]',
    item: "[data-vft-sb-item]",
    icon: "[data-vft-sb-item] svg"
  };
  function sidebarCss(spec, bodyAttribute) {
    const scope = `body[data-${bodyAttribute}]`;
    const dark = `${scope}[data-ds-dark-theme]`;
    const metrics = spec.metrics;
    const rules = [
      `/* dsh-vyra-free-theme sidebar pack: ${spec.pack} / ${spec.surface} / ${spec.density} */`,
      // The column never clips the wallpaper; the fill token decides opacity.
      `${scope} ${HOOK.col}{background:transparent}`,
      `${scope} ${HOOK.col} ${HOOK.root}{border-radius:${spec.radius.card}px}`
    ];
    if (spec.surface === "frost" || spec.blur > 0) {
      const blur = spec.surface === "frost" ? Math.max(spec.blur, 8) : spec.blur;
      rules.push(
        `${scope} ${HOOK.col}{backdrop-filter:blur(${blur}px);-webkit-backdrop-filter:blur(${blur}px)}`,
        `${scope} [class*="_scrollFade"]{background:linear-gradient(transparent, rgba(0,0,0,0.04))}`
      );
    }
    if (spec.surface === "solid" || spec.surface === "custom") {
      const fillLight = spec.background?.light ?? spec.states.selected.bg;
      if (spec.surface === "solid") {
        rules.push(
          `${scope} ${HOOK.col}{background:var(--dsw-specific-sidebar-fill)}`,
          `${scope} ${HOOK.col} ${HOOK.root}{background:transparent}`
        );
      } else if (spec.background !== null) {
        rules.push(
          `${scope} ${HOOK.col}{background:${spec.background.light ?? fillLight}}`,
          `${dark} ${HOOK.col}{background:${spec.background.dark ?? spec.background.light ?? fillLight}}`
        );
      }
    }
    rules.push(
      // Compact/comfortable: item rhythm, never the layout's own spacing contract.
      `${scope} ${HOOK.item}{border-radius:${spec.radius.item}px;padding-top:${metrics.padY}px;padding-bottom:${metrics.padY}px;min-height:${metrics.minHeight}px;margin-bottom:${metrics.gap}px;transition:background-color 120ms ease,color 120ms ease}`,
      // Icon tint: SVG inherits currentColor in the host, so colouring it here
      // reaches every glyph inside an item.
      `${scope} ${HOOK.icon}{color:${spec.icon.light}}`,
      `${dark} ${HOOK.icon}{color:${spec.icon.dark}}`,
      // Interactive states. `:hover` is the selector; the rest are attribute
      // markers the host (or the runtime tagger) may set on the active surface.
      `${scope} ${HOOK.item}:hover{background:${spec.states.hover.bg}}`,
      `${dark} ${HOOK.item}:hover{background:${spec.states.hover.darkBg}}`,
      `${scope} ${HOOK.item}:active{background:${spec.states.active.bg}}`,
      `${dark} ${HOOK.item}:active{background:${spec.states.active.darkBg}}`,
      `${scope} ${HOOK.item}[aria-current],${scope} ${HOOK.item}[data-active="true"],${scope} ${HOOK.item}[data-selected="true"]{position:relative;background:${spec.states.selected.bg};color:${spec.states.selected.fg ?? "inherit"}}`,
      `${dark} ${HOOK.item}[aria-current],${dark} ${HOOK.item}[data-active="true"],${dark} ${HOOK.item}[data-selected="true"]{background:${spec.states.selected.darkBg};color:${spec.states.selected.darkFg ?? "inherit"}}`,
      // Selected indicator: a 3px bar on the leading edge, drawn by pseudo-element
      // so no host layout is touched.
      `${scope} ${HOOK.item}[aria-current]::before,${scope} ${HOOK.item}[data-active="true"]::before,${scope} ${HOOK.item}[data-selected="true"]::before{content:"";position:absolute;inset-inline-start:0;top:20%;bottom:20%;width:3px;border-radius:999px;background:${spec.states.selected.indicator}}`,
      `${dark} ${HOOK.item}[aria-current]::before,${dark} ${HOOK.item}[data-active="true"]::before,${dark} ${HOOK.item}[data-selected="true"]::before{background:${spec.states.selected.darkIndicator}}`
    );
    if (spec.divider !== null) {
      rules.push(
        `${scope} ${HOOK.item}{border-bottom:1px ${spec.divider.style ?? "solid"} ${spec.divider.color}}`
      );
    }
    return rules.join("\n");
  }

  // src/client/runtime.js
  var SKIN_STORAGE_KEY = "dsh-vyra-free-theme:active";
  var SKIN_URL_PARAM = "skin";
  var OFFICIAL_SKIN_ID = "official";
  var LEGACY_OFFICIAL_ALIAS = "default";
  var HERO_NS = "conversation";
  var HERO_KEY = "hero.headline";
  var ACTIVE_EVENT = "dsh-vyra-free-theme:active-changed";
  function datasetAttribute(key) {
    return `data-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
  }
  function resolvePreloadUrl(skins, personalization, skinId, defaultRef) {
    if (typeof skinId !== "string" || skinId === "" || skinId === OFFICIAL_SKIN_ID) return null;
    let ref = defaultRef;
    try {
      const override = personalization?.getOverrides?.(skinId)?.wallpaper;
      if (typeof override === "string" && override !== "") ref = override;
    } catch {
    }
    if (typeof ref !== "string") return null;
    const match = BUILTIN_REF_PATTERN.exec(ref);
    if (match === null) return null;
    const asset = skins.get?.(match[1])?.builtinAssets?.[match[2]];
    const url = asset?.url;
    return typeof url === "string" && url.startsWith("/dsh-vyra-free-theme/assets/") ? url : null;
  }
  function parseRgbaChannels(value) {
    const match = /^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)$/i.exec(value ?? "");
    if (match === null) return null;
    const channels = [match[1], match[2], match[3], match[4]].map(Number);
    if (channels.some((channel) => !Number.isFinite(channel))) return null;
    const [r, g, b, a] = channels;
    return { r, g, b, a: Math.min(1, Math.max(0, a)) };
  }
  function sidebarPaintOrderCss(bodyAttribute) {
    return `body[${datasetAttribute(bodyAttribute)}] [class*="_sidebarCol"]{position:relative;z-index:1}`;
  }
  function buildSidebarFadeCss(bodyAttribute) {
    return `body[${datasetAttribute(bodyAttribute)}] [class*="_scrollFade"]{background-image:none!important}`;
  }
  function buildShellAlignmentCss(bodyAttribute, opaqueFills, backdrop) {
    const body = `body[${datasetAttribute(bodyAttribute)}]`;
    const scoped = `html[data-windows-titlebar] ${body}`;
    const lines = [
      "/* dsh-vyra-free-theme shell-frame alignment (ADR-0009): solid chrome + wallpaper in the conversation area on Windows desktop */",
      'html[data-windows-titlebar] [class*="_frame"]:has(> [class*="_sidebarCol"])::before{background:0 0}',
      'html[data-windows-titlebar] [class*="_frame"] > [class*="_sidebarCol"]{background:0 0}',
      'html[data-windows-titlebar] [class*="_sidebarCol"] > [class*="_root"]{background:0 0}'
    ];
    if (opaqueFills !== null) {
      lines.push(
        `${scoped}{--dsw-specific-sidebar-fill:${opaqueFills.light}!important}`,
        `${scoped}[data-ds-dark-theme]{--dsw-specific-sidebar-fill:${opaqueFills.dark}!important}`
      );
    }
    if (backdrop !== null && backdrop !== void 0 && backdrop.imageLight !== null && backdrop.imageDark !== null) {
      lines.push(
        `${scoped} [class*="_centerCol"]{background-image:${backdrop.imageLight};background-size:cover;background-position:center;background-repeat:no-repeat}`,
        `${scoped}[data-ds-dark-theme] [class*="_centerCol"]{background-image:${backdrop.imageDark}}`
      );
    }
    if (opaqueFills !== null) {
      lines.push(
        `${scoped} [data-rightbar-col] > *{background-color:${opaqueFills.light}!important}`,
        `${scoped}[data-ds-dark-theme] [data-rightbar-col] > *{background-color:${opaqueFills.dark}!important}`
      );
      lines.push(
        `${scoped} [class*="_pane_"]{background:${opaqueFills.light}!important}`,
        `${scoped}[data-ds-dark-theme] [class*="_pane_"]{background:${opaqueFills.dark}!important}`
      );
    }
    return lines.join("\n");
  }
  function buildFullscreenBaseCss(bodyAttribute, opaqueFills) {
    if (opaqueFills === null) return "";
    const body = `body[${datasetAttribute(bodyAttribute)}]`;
    const column = ' [data-rightbar-fullscreen] [class*="_rightbarCol"]';
    const emptyPaneGuard = ':not(:has([class*="_paneBody"] > [class*="_empty"]))';
    const openGate = '[data-sidebar-right-open="true"]';
    const dockPanel = ` [data-sidebar-right-panel="fullscreen"]${openGate}${emptyPaneGuard}`;
    const dockPane = ` [data-sidebar-right-panel="fullscreen"]${openGate} [data-dockkit-pane]${emptyPaneGuard}`;
    return [
      "/* dsh-vyra-free-theme fullscreen base (ADR-0020): solid skin-tone base while data-rightbar-fullscreen is set — the fullscreen dockkit PANE paints a translucent bg token where the official theme paints opaque white (DOM-dump evidence), so the pane is the bleed surface; solid matches the official look. Docked column untouched. Sheet rules gated on data-sidebar-right-open (stale-fullscreen collapse, ADR-0021 amendment 四) */",
      `${body}${column},${body}${dockPanel},${body}${dockPane}{background-color:${opaqueFills.light}!important}`,
      `${body}[data-ds-dark-theme]${column},${body}[data-ds-dark-theme]${dockPanel},${body}[data-ds-dark-theme]${dockPane}{background-color:${opaqueFills.dark}!important}`
    ].join("\n");
  }
  function buildReadingBaseCss(bodyAttribute, opaqueFills) {
    if (opaqueFills === null) return "";
    const body = `body[${datasetAttribute(bodyAttribute)}]`;
    const panel = ' [data-plugin-panel="true"]';
    return [
      "/* dsh-vyra-free-theme reading base (ADR-0022): solid skin-tone base under the plugin panel route container — the live page paints the whole route transparent over the wallpaper while the official theme paints an opaque bg token (DOM-dump evidence 2026-10-30), so text sits on a translucent token x wallpaper composite; solid matches the official look. Element-bound: the route leaves the DOM with the page, no state gate needed. Layer pin per ADR-0021 amendment doctrine (large-area cover rules always carry the pin). */",
      `${body}${panel}{position:relative;z-index:0;background-color:${opaqueFills.light}!important}`,
      `${body}[data-ds-dark-theme]${panel}{position:relative;z-index:0;background-color:${opaqueFills.dark}!important}`
    ].join("\n");
  }
  var PRODUCTION_FIELDS = /* @__PURE__ */ new Set([
    "id",
    "label",
    "description",
    "Mark",
    "Name",
    "project",
    "builtinAssets"
  ]);
  function createSkinRuntime({ profile = "web" } = {}) {
    const skins = /* @__PURE__ */ new Map();
    const order = [];
    let ctx = null;
    let mounted = null;
    let selectedId = null;
    let personalization = null;
    function register(skin) {
      if (!skin || typeof skin.id !== "string" || skin.id.length === 0) {
        throw new Error("[dsh-vyra-free-theme] every skin needs a non-empty id");
      }
      if (skin.id === OFFICIAL_SKIN_ID || skin.id === LEGACY_OFFICIAL_ALIAS) {
        throw new Error(`[dsh-vyra-free-theme] skin id "${skin.id}" is reserved for the official appearance`);
      }
      for (const key of Object.keys(skin)) {
        if (!PRODUCTION_FIELDS.has(key)) {
          throw new Error(`[dsh-vyra-free-theme] unknown skin field "${key}" on "${skin.id}" — the skin interface is exactly PRODUCTION_FIELDS (ADR-0014)`);
        }
      }
      if (skins.has(skin.id)) throw new Error(`[dsh-vyra-free-theme] duplicate skin id "${skin.id}"`);
      skins.set(skin.id, skin);
      order.push(skin.id);
    }
    function activeLocale() {
      try {
        return ctx?.locale?.getLocale?.().active ?? "zh";
      } catch {
        return "zh";
      }
    }
    function localizedText(value) {
      if (value === null || value === void 0) return "";
      if (typeof value === "string") return value;
      if (typeof value === "object") return value[activeLocale()] ?? value.en ?? value.zh ?? "";
      return String(value);
    }
    function list() {
      return order.map((id) => {
        const skin = skins.get(id);
        return { id, label: localizedText(skin.label), description: localizedText(skin.description) };
      });
    }
    function normalizeChoiceId(id) {
      return id === LEGACY_OFFICIAL_ALIAS ? OFFICIAL_SKIN_ID : id;
    }
    function isKnownChoice(id) {
      return id === OFFICIAL_SKIN_ID || skins.has(id);
    }
    function resolveSelectedId() {
      try {
        const query = window.location?.search;
        const fromUrl = query ? new URLSearchParams(query).get(SKIN_URL_PARAM) : null;
        const normalizedUrl = normalizeChoiceId(fromUrl);
        if (normalizedUrl && isKnownChoice(normalizedUrl)) {
          localStorage.setItem(SKIN_STORAGE_KEY, normalizedUrl);
          return normalizedUrl;
        }
        const stored = normalizeChoiceId(localStorage.getItem(SKIN_STORAGE_KEY));
        if (stored && isKnownChoice(stored)) {
          localStorage.setItem(SKIN_STORAGE_KEY, stored);
          return stored;
        }
      } catch {
      }
      return OFFICIAL_SKIN_ID;
    }
    function announce(id) {
      if (typeof window.dispatchEvent === "function" && typeof CustomEvent === "function") {
        window.dispatchEvent(new CustomEvent(ACTIVE_EVENT, { detail: id }));
      }
    }
    function overridesFor(skinId) {
      try {
        return personalization?.getOverrides?.(skinId) ?? {};
      } catch {
        return {};
      }
    }
    function projectionContext() {
      return {
        profile,
        assetResolver: personalization?.assetResolver,
        metaProvider: personalization?.metaProvider
      };
    }
    function styleTag(id, content) {
      let tag = document.querySelector(`style[data-plugin-css=${JSON.stringify(id)}]`);
      if (tag === null) {
        tag = document.createElement("style");
        tag.dataset.plugin = "dsh-vyra-free-theme";
        tag.dataset.pluginCss = id;
        document.head.appendChild(tag);
      }
      tag.textContent = content;
      return tag;
    }
    function backdropCss(effects) {
      const backdrop = effects.backdrop;
      if (backdrop === null) return null;
      const selector = `body[${datasetAttribute(effects.bodyAttribute)}]`;
      const darkSelector = `${selector}[data-ds-dark-theme]`;
      const rules = [];
      if (backdrop.imageLight !== null || backdrop.imageDark !== null) {
        const blur = backdrop.blur > 0 ? `filter:blur(${backdrop.blur}px);transform:scale(1.02);` : "";
        rules.push(`${selector}::before{content:"";position:fixed;inset:0;z-index:-1;background-image:${backdrop.imageLight ?? "none"};background-size:cover;background-position:center;background-repeat:no-repeat;pointer-events:none;${blur}}`);
        if (backdrop.imageDark !== null && backdrop.imageDark !== backdrop.imageLight) {
          rules.push(`${darkSelector}::before{background-image:${backdrop.imageDark}}`);
        }
      }
      if (backdrop.overlayLight !== null || backdrop.overlayDark !== null) {
        rules.push(`${selector}::after{content:"";position:fixed;inset:0;z-index:-1;background-image:${backdrop.overlayLight ?? "none"};pointer-events:none;}`);
        if (backdrop.overlayDark !== null && backdrop.overlayDark !== backdrop.overlayLight) {
          rules.push(`${darkSelector}::after{background-image:${backdrop.overlayDark}}`);
        }
      }
      const desktopBlur = backdrop.desktopBlur ?? null;
      if (desktopBlur !== null && (backdrop.imageLight !== null || backdrop.imageDark !== null)) {
        const desktopSelector = `html[data-windows-titlebar] ${selector}`;
        const blurDeclarations = (blur) => `filter:blur(${blur}px);transform:scale(1.02);`;
        if (desktopBlur.light === desktopBlur.dark) {
          if (desktopBlur.light > 0) {
            rules.push(`${desktopSelector}::before{${blurDeclarations(desktopBlur.light)}}`);
          }
        } else {
          if (desktopBlur.light > 0) {
            rules.push(`${desktopSelector}:not([data-ds-dark-theme])::before{${blurDeclarations(desktopBlur.light)}}`);
          }
          if (desktopBlur.dark > 0) {
            rules.push(`${desktopSelector}[data-ds-dark-theme]::before{${blurDeclarations(desktopBlur.dark)}}`);
          }
        }
      }
      return rules.length === 0 ? null : rules.join("\n");
    }
    function variablesCss(effects) {
      if (effects.cssVariables === null) return null;
      const selector = `body[${datasetAttribute(effects.bodyAttribute)}]`;
      const darkSelector = `${selector}[data-ds-dark-theme]`;
      const light = [];
      const dark = [];
      for (const [name, pair] of Object.entries(effects.cssVariables)) {
        light.push(`${name}:${pair.light}`);
        dark.push(`${name}:${pair.dark}`);
      }
      return `${selector}{${light.join(";")}}
${darkSelector}{${dark.join(";")}}`;
    }
    const BRAND_PRIORITY_BASE = -20;
    function occupantPriorities(name) {
      try {
        return (ctx.slots.entries?.(name) ?? []).map((entry) => entry.options.priority ?? 0);
      } catch {
        return [];
      }
    }
    function registerBrandSeat(name, component) {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const taken = occupantPriorities(name);
        const floor = taken.length > 0 ? Math.min(...taken) - 1 : BRAND_PRIORITY_BASE;
        const priority = Math.min(BRAND_PRIORITY_BASE, floor);
        try {
          return ctx.slots.register({ name, priority }, component);
        } catch (error) {
          if (!/already has a registration/.test(String(error?.message ?? error))) throw error;
          console.warn(`[dsh-vyra-free-theme] brand seat "${name}" priority ${priority} taken; retrying deeper`);
        }
      }
      console.warn(`[dsh-vyra-free-theme] brand seat "${name}" stays with its occupant; skin mounts without it`);
      return () => {
      };
    }
    const SWEEP_SELECTOR = 'style[data-plugin-css^="dsh-vyra-free-theme/"]:not([data-plugin-css="dsh-vyra-free-theme/sidebar.css"])';
    function flushStylesForSweep() {
      try {
        void document.body?.offsetHeight;
      } catch {
      }
    }
    function refreshSkinStyleTags() {
      if (typeof document === "undefined" || document.head?.querySelectorAll === void 0) return;
      const tags = [...document.head.querySelectorAll(SWEEP_SELECTOR)];
      if (tags.length === 0) return;
      const saved = tags.map((tag) => ({ tag, content: tag.textContent }));
      for (const { tag } of saved) tag.textContent = "";
      flushStylesForSweep();
      for (const { tag, content } of saved) tag.textContent = content;
      flushStylesForSweep();
    }
    let rightPanelRepaintHookInstalled = false;
    function installRightPanelRepaintHook() {
      if (rightPanelRepaintHookInstalled || typeof MutationObserver !== "function") return;
      if (typeof document === "undefined" || document.body === void 0 || document.body === null) return;
      rightPanelRepaintHookInstalled = true;
      const observer = new MutationObserver((records) => {
        for (const record of records ?? []) {
          const before = record.oldValue;
          const after = record.target.getAttribute?.("data-sidebar-right-panel");
          if (before !== "fullscreen" || after === "fullscreen") continue;
          const tag = document.querySelector('style[data-plugin-css$=".fullscreen.css"]');
          if (tag === null) continue;
          const id = tag.dataset.pluginCss;
          const content = tag.textContent;
          tag.remove();
          requestAnimationFrame(() => requestAnimationFrame(() => {
            const fresh = document.createElement("style");
            fresh.dataset.plugin = "dsh-vyra-free-theme";
            fresh.dataset.pluginCss = id;
            fresh.textContent = content;
            document.head.append(fresh);
          }));
        }
      });
      observer.observe(document.body, {
        subtree: true,
        attributes: true,
        attributeFilter: ["data-sidebar-right-panel"],
        attributeOldValue: true
      });
    }
    function buildEffects(skin, effects) {
      if (!ctx) throw new Error("[dsh-vyra-free-theme] mount before apply");
      const body = document.body;
      const stops = [];
      const unwind = () => {
        for (let index = stops.length - 1; index >= 0; index -= 1) {
          try {
            stops[index]();
          } catch {
          }
        }
      };
      try {
        stops.push(ctx.slots.inject(
          "sidebar.brand.mark",
          () => ctx.slots.inject(
            "sidebar.brand.name",
            () => ctx.slots.inject("conversation.hero.brand.mark", () => {
              const registrations = [
                registerBrandSeat("sidebar.brand.mark", skin.Mark),
                registerBrandSeat("sidebar.brand.name", skin.Name),
                registerBrandSeat("conversation.hero.brand.mark", skin.Mark)
              ];
              return () => {
                for (let index = registrations.length - 1; index >= 0; index -= 1) {
                  registrations[index]();
                }
              };
            })
          )
        ));
        if (effects.slogans !== null) {
          const table = ctx.locale?.dicts?.get(HERO_NS);
          const originals = [];
          if (table) {
            for (const [locale, entries] of table) {
              if (entries && entries[HERO_KEY] !== void 0) {
                originals.push([entries, entries[HERO_KEY]]);
                entries[HERO_KEY] = effects.slogans[locale] ?? effects.slogans.zh;
              }
            }
          }
          stops.push(() => {
            for (const [entries, value] of originals) entries[HERO_KEY] = value;
          });
        }
        if (effects.staticCss !== null) {
          const tag = styleTag(`dsh-vyra-free-theme/${skin.id}.css`, effects.staticCss);
          stops.push(() => tag.remove());
        }
        {
          const tag = styleTag(
            `dsh-vyra-free-theme/${skin.id}.paintorder.css`,
            sidebarPaintOrderCss(effects.bodyAttribute)
          );
          stops.push(() => tag.remove());
        }
        {
          const fills = effects.tokenOverrides?.["--dsw-specific-sidebar-fill"] ?? null;
          const lightFill = fills === null ? null : parseRgbaChannels(fills.light);
          const darkFill = fills === null ? null : parseRgbaChannels(fills.dark);
          const coverage = effects.coverage ?? null;
          const sidebarCovered = coverage !== null && coverage.shell === true && (coverage.scopes ?? []).includes("sidebar");
          const shellOpaque = !sidebarCovered;
          const derivedFills = shellOpaque && lightFill !== null && darkFill !== null ? {
            light: `rgb(${lightFill.r}, ${lightFill.g}, ${lightFill.b})`,
            dark: `rgb(${darkFill.r}, ${darkFill.g}, ${darkFill.b})`
          } : null;
          const opaqueFills = derivedFills;
          const backdrop2 = effects.backdrop === null ? null : {
            imageLight: effects.backdrop.imageLight,
            imageDark: effects.backdrop.imageDark
          };
          const tag = styleTag(
            `dsh-vyra-free-theme/${skin.id}.shell.css`,
            buildShellAlignmentCss(effects.bodyAttribute, opaqueFills, backdrop2)
          );
          stops.push(() => tag.remove());
          const fullscreenCss = buildFullscreenBaseCss(effects.bodyAttribute, opaqueFills);
          if (fullscreenCss !== "") {
            const fullscreenTag = styleTag(`dsh-vyra-free-theme/${skin.id}.fullscreen.css`, fullscreenCss);
            stops.push(() => fullscreenTag.remove());
          }
          const readingCss = buildReadingBaseCss(effects.bodyAttribute, opaqueFills);
          if (readingCss !== "") {
            const readingTag = styleTag(`dsh-vyra-free-theme/${skin.id}.reading.css`, readingCss);
            stops.push(() => readingTag.remove());
          }
          const sidebarFadeCss = fills === null ? "" : buildSidebarFadeCss(effects.bodyAttribute);
          if (sidebarFadeCss !== "") {
            const fadeTag = styleTag(`dsh-vyra-free-theme/${skin.id}.sidebarfade.css`, sidebarFadeCss);
            stops.push(() => fadeTag.remove());
          }
        }
        const backdrop = backdropCss(effects);
        if (backdrop !== null) {
          const tag = styleTag(`dsh-vyra-free-theme/${skin.id}.backdrop.css`, backdrop);
          stops.push(() => tag.remove());
        }
        if (effects.sidebar !== null && effects.sidebar !== void 0) {
          const tag = styleTag(
            `dsh-vyra-free-theme/${skin.id}.sidebar.css`,
            sidebarCss(effects.sidebar, effects.bodyAttribute)
          );
          stops.push(() => tag.remove());
          const tagging = installSidebarTagging();
          if (tagging !== null) stops.push(tagging);
        }
        const wallpaperStop = mountWallpaperLayers({
          layers: effects.backdrop?.layers ?? null,
          skinId: skin.id
        });
        if (wallpaperStop !== null) stops.push(wallpaperStop);
        const variables = variablesCss(effects);
        if (variables !== null) {
          const tag = styleTag(`dsh-vyra-free-theme/${skin.id}.vars.css`, variables);
          stops.push(() => tag.remove());
        }
        if (effects.decorations !== null) {
          for (const decoration of effects.decorations) {
            const tag = styleTag(`dsh-vyra-free-theme/${skin.id}.decor.${decoration.key}.css`, decoration.css);
            stops.push(() => tag.remove());
          }
        }
        if (effects.tokenOverrides !== null && typeof ctx.theme?.overrideTokens === "function") {
          const disposeTokens = ctx.theme.overrideTokens(`dsh-vyra-free-theme/${skin.id}`, effects.tokenOverrides);
          stops.push(disposeTokens);
        }
        const hadAttribute = body.dataset[effects.bodyAttribute] !== void 0;
        stops.push(() => {
          if (!hadAttribute) delete body.dataset[effects.bodyAttribute];
        });
        body.dataset[effects.bodyAttribute] = "";
        if (effects.favicon !== null) {
          const removedIcons = [...document.head.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]')];
          let favicon = null;
          stops.push(() => {
            if (favicon !== null) favicon.remove();
            for (const element of removedIcons) document.head.append(element);
          });
          removedIcons.forEach((element) => element.remove());
          favicon = document.createElement("link");
          favicon.rel = "icon";
          favicon.type = effects.favicon.mime;
          favicon.href = effects.favicon.href;
          document.head.append(favicon);
        }
        const officialBrand = "DeepSeek Harness";
        const brand = effects.titleBrand === null || effects.titleBrand === "" ? null : effects.titleBrand;
        let titleObserver = null;
        stops.push(() => {
          if (titleObserver !== null) {
            titleObserver.disconnect();
            if (document.title === brand) document.title = officialBrand;
            else if (brand !== null && document.title.endsWith(" — " + brand)) {
              document.title = document.title.slice(0, document.title.length - brand.length) + officialBrand;
            }
          }
        });
        if (brand !== null) {
          const withBrand = (text) => {
            if (text === officialBrand) return brand;
            if (text.endsWith(" — " + officialBrand)) return text.slice(0, text.length - officialBrand.length) + brand;
            return null;
          };
          const rebrand = () => {
            const next = withBrand(document.title);
            if (next !== null && next !== document.title) document.title = next;
          };
          rebrand();
          titleObserver = new MutationObserver(rebrand);
          titleObserver.observe(document.head, { childList: true, subtree: true, characterData: true });
        }
      } catch (error) {
        unwind();
        throw error;
      }
      return unwind;
    }
    function unmount() {
      if (!mounted) return;
      mounted.stop();
      mounted = null;
    }
    function applyEffects(skin, effects, overrides) {
      const previous = mounted === null ? null : { skin: mounted.skin, overrides: mounted.overrides };
      unmount();
      let stop;
      try {
        stop = buildEffects(skin, effects);
      } catch (error) {
        console.warn(`[dsh-vyra-free-theme] mounting "${skin.id}" failed`, error);
        restorePrevious(previous, error);
        return false;
      }
      mounted = { skin, effects, overrides, stop };
      selectedId = skin.id;
      announce(skin.id);
      installRightPanelRepaintHook();
      if (previous !== null && previous.skin.id !== skin.id) refreshSkinStyleTags();
      return true;
    }
    function restorePrevious(previous, cause) {
      if (previous !== null) {
        try {
          const restored = projectSkin(previous.skin, previous.overrides, projectionContext());
          if (restored.effects !== null) {
            const stop = buildEffects(previous.skin, restored.effects);
            mounted = { skin: previous.skin, effects: restored.effects, overrides: previous.overrides, stop };
            selectedId = previous.skin.id;
            announce(previous.skin.id);
            return;
          }
        } catch (restoreError) {
          console.error("[dsh-vyra-free-theme] restoring the previous skin failed; falling back to official", restoreError);
        }
      }
      void cause;
      selectedId = OFFICIAL_SKIN_ID;
      announce(OFFICIAL_SKIN_ID);
    }
    function mountSkin(skin) {
      const overrides = overridesFor(skin.id);
      const result = projectSkin(skin, overrides, projectionContext());
      if (result.effects === null) {
        console.warn(`[dsh-vyra-free-theme] skin "${skin.id}" failed to project`);
        if (mounted !== null) return false;
        selectedId = OFFICIAL_SKIN_ID;
        announce(OFFICIAL_SKIN_ID);
        return false;
      }
      if (result.degraded !== "none") {
        console.warn(`[dsh-vyra-free-theme] skin "${skin.id}" projected with degraded defaults (${result.degraded})`);
      }
      return applyEffects(skin, result.effects, overrides);
    }
    function updateActive() {
      if (mounted === null) return { applied: false, reason: "none" };
      const skin = mounted.skin;
      const overrides = overridesFor(skin.id);
      const result = projectSkin(skin, overrides, projectionContext());
      if (result.effects === null) {
        console.warn("[dsh-vyra-free-theme] config hot-update failed to project; keeping current effects");
        return { applied: false, reason: "projection-failed" };
      }
      const applied = applyEffects(skin, result.effects, overrides);
      return applied ? { applied: true, degraded: result.degraded } : { applied: false, reason: "mount-failed" };
    }
    function preloadEffectiveWallpaper(normalizedId) {
      try {
        const url = resolvePreloadUrl(skins, personalization, normalizedId, defaultWallpaperRef(normalizedId));
        if (url !== null && typeof Image === "function") {
          const image = new Image();
          image.src = url;
        }
      } catch {
      }
    }
    function select(id) {
      const normalizedId = normalizeChoiceId(id);
      const skin = skins.get(normalizedId);
      if (normalizedId !== OFFICIAL_SKIN_ID && !skin) {
        throw new Error(`[dsh-vyra-free-theme] unknown skin "${id}" — available: ${[OFFICIAL_SKIN_ID, ...order].join(", ")}`);
      }
      if (selectedId === normalizedId && mounted !== null) return normalizedId;
      preloadEffectiveWallpaper(normalizedId);
      if (normalizedId === OFFICIAL_SKIN_ID) {
        unmount();
        selectedId = OFFICIAL_SKIN_ID;
        try {
          localStorage.setItem(SKIN_STORAGE_KEY, normalizedId);
        } catch {
        }
        announce(OFFICIAL_SKIN_ID);
        return normalizedId;
      }
      if (mountSkin(skin)) {
        try {
          localStorage.setItem(SKIN_STORAGE_KEY, normalizedId);
        } catch {
        }
      } else {
        console.warn(`[dsh-vyra-free-theme] selection of "${normalizedId}" did not take effect`);
      }
      return normalizedId;
    }
    function setPersonalization(provider) {
      personalization = provider ?? null;
      if (mounted !== null) updateActive();
    }
    function apply(nextCtx) {
      ctx = nextCtx;
      const id = resolveSelectedId();
      if (id === OFFICIAL_SKIN_ID) {
        selectedId = OFFICIAL_SKIN_ID;
      } else {
        const skin = skins.get(id) ?? skins.get(order[0]);
        if (!skin) throw new Error("[dsh-vyra-free-theme] no skins registered");
        if (!mountSkin(skin)) selectedId = OFFICIAL_SKIN_ID;
      }
      return () => {
        unmount();
        selectedId = null;
      };
    }
    function refreshSelection() {
      const next = resolveSelectedId();
      if (next === selectedId && mounted !== null) return selectedId;
      return select(next);
    }
    return {
      officialId: OFFICIAL_SKIN_ID,
      register,
      list,
      select,
      apply,
      unmount,
      updateActive,
      setPersonalization,
      refreshSelection,
      active: () => selectedId
    };
  }

  // src/client/dicts.js
  var NS = "dsh-vyra-free-theme.ui";
  var DICTS = {
    zh: {
      "skins.switch": "主题切换",
      "skins.title": "选择皮肤",
      "skins.official.label": "DeepSeek Harness（官方）",
      "skins.official.description": "素笺玄墨 · 留白生辉 · 本色天成",
      "appearance.title": "外观配色",
      "appearance.light": "浅色",
      "appearance.dark": "深色",
      "appearance.system": "跟随系统",
      // Personalization surface (1.0.0)
      "personalization.title": "个性化",
      "personalization.collapse": "收起个性化面板",
      "personalization.reset": "恢复默认",
      "personalization.confirmTitle": "确认操作",
      "personalization.confirm": "确认",
      "personalization.cancel": "取消",
      "personalization.resetJoin": "\n• ",
      "personalization.resetConfirm": "以下设置将恢复为出厂默认：\n\n{fields}\n\n此操作立即生效，确认继续吗？",
      "personalization.resetConfirmIntro": "以下设置将恢复为出厂默认：",
      "personalization.resetConfirmOutro": "此操作立即生效，确认继续吗？",
      "personalization.light": "浅色",
      "personalization.dark": "深色",
      "personalization.builtin": "内置画作",
      "personalization.builtin.default": "默认壁纸",
      "personalization.wallpaper": "壁纸 Wallpaper",
      "personalization.brandTitle": "品牌名称 Brand name",
      "personalization.slogan": "标语 Slogan",
      "personalization.panelTranslucency": "通透度 Transparency",
      "personalization.meirenzhi.yuntai": "云台雅集 · 合照（默认壁纸）",
      "personalization.meirenzhi.mupeiling": "慕沛灵 · 单人",
      "personalization.meirenzhi.ziling": "紫灵 · 单人",
      "personalization.meirenzhi.nangongwan": "南宫婉 · 单人",
      "personalization.meirenzhi.nangongque": "南宫阙 · 单人",
      "personalization.meirenzhi.yinyue": "银月 · 单人",
      "personalization.library": "图库",
      "personalization.library.upload": "上传图片",
      "personalization.library.delete": "删除",
      "personalization.library.deleteConfirm": "删除后，以下皮肤的壁纸将回退为默认：",
      "personalization.library.deleteFailed": "删除失败，请重试",
      "personalization.library.deleted": "已删除：{name}",
      "personalization.library.empty": "图库为空，上传一张图片试试",
      "personalization.library.more": "还有 {count} 张未显示",
      "personalization.panelLabel": "个性化设置",
      "personalization.saveFailed": "保存失败，请重试",
      "personalization.saveConflict": "配置已在其他窗口更新，请重试",
      "personalization.fieldReverted": "壁纸已失效，已回退默认",
      "personalization.library.previewRef": "未保存引用",
      "personalization.library.clear": "清空图库",
      "personalization.library.clearConfirm": "将永久删除全部 {count} 张上传图片，且不可恢复。以下壁纸设置将回退为默认：{names}",
      "personalization.library.clearFailed": "清空图库失败，已刷新剩余列表",
      "personalization.library.uploading": "正在上传…",
      "personalization.library.uploadingBatch": "正在上传 {done}/{total}…",
      "personalization.library.uploadSomeFailed": "已上传 {ok} 张，{failed} 张失败（{reason}）",
      "personalization.library.uploadFailed": "上传失败，请重试",
      "personalization.status.loading": "正在同步个性化配置…",
      "personalization.status.offline": "配置尚未同步，暂时无法编辑",
      "personalization.status.retry": "重试",
      "personalization.status.unsupported": "配置由更新版本的插件创建，当前只读",
      "personalization.status.recovery": "检测到配置文件损坏",
      "personalization.status.recoveryHint": "可以从图片库重建配置；自定义标语与颜色等覆写可能丢失。",
      "personalization.recovery.confirm": "确认恢复",
      // Host-reported personalization errors (see host-errors.js HOST_ERROR_KEYS)
      "host.personalization.tooLarge": "图片超过大小限制",
      "host.personalization.unsupportedImage": "不支持的图片格式",
      "host.personalization.animatedWebp": "动画 WebP 暂不支持",
      "host.personalization.diskFull": "磁盘剩余空间不足",
      "host.personalization.invalidFilename": "文件展示名无效",
      "host.personalization.assetMissing": "图片不存在",
      "host.personalization.invalidConfig": "配置校验失败",
      "host.personalization.readonly": "配置为更高版本创建，当前只读",
      "host.personalization.recoveryRequired": "配置状态待恢复，请先在个性化面板确认恢复",
      "host.personalization.unknownSkin": "皮肤不存在",
      "host.personalization.uploadTimeout": "上传超时，请检查网络后重试"
    },
    en: {
      "skins.switch": "Theme Switcher",
      "skins.title": "Choose Skin",
      "skins.official.label": "DeepSeek Harness (Official)",
      "skins.official.description": "Plain paper & dark ink · breathing white space · naturally itself",
      "appearance.title": "Appearance",
      "appearance.light": "Light",
      "appearance.dark": "Dark",
      "appearance.system": "System",
      // Personalization surface (1.0.0)
      "personalization.title": "Personalize",
      "personalization.collapse": "Collapse personalization panel",
      "personalization.reset": "Restore defaults",
      "personalization.confirmTitle": "Confirm action",
      "personalization.confirm": "Confirm",
      "personalization.cancel": "Cancel",
      "personalization.resetJoin": "\n• ",
      "personalization.resetConfirm": "These settings will be reset to factory defaults:\n\n{fields}\n\nThis takes effect immediately. Continue?",
      "personalization.resetConfirmIntro": "These settings will be reset to factory defaults:",
      "personalization.resetConfirmOutro": "This takes effect immediately. Continue?",
      "personalization.light": "Light",
      "personalization.dark": "Dark",
      "personalization.builtin": "Built-in artwork",
      "personalization.builtin.default": "Default wallpaper",
      "personalization.wallpaper": "Wallpaper",
      "personalization.brandTitle": "Brand name",
      "personalization.slogan": "Slogan",
      "personalization.panelTranslucency": "Panel translucency",
      "personalization.meirenzhi.yuntai": "Yuntai Gathering · Group (default)",
      "personalization.meirenzhi.mupeiling": "Mu Peiling · Solo",
      "personalization.meirenzhi.ziling": "Zi Ling · Solo",
      "personalization.meirenzhi.nangongwan": "Nangong Wan · Solo",
      "personalization.meirenzhi.nangongque": "Nangong Que · Solo",
      "personalization.meirenzhi.yinyue": "Yin Yue · Solo",
      "personalization.library": "Library",
      "personalization.library.upload": "Upload image",
      "personalization.library.delete": "Delete",
      "personalization.library.deleteConfirm": "These skins will fall back to their default wallpaper:",
      "personalization.library.deleted": "Deleted: {name}",
      "personalization.library.deleteFailed": "Delete failed; try again",
      "personalization.library.empty": "Library is empty — upload an image",
      "personalization.library.more": "{count} more hidden",
      "personalization.panelLabel": "Personalization settings",
      "personalization.saveFailed": "Save failed; try again",
      "personalization.saveConflict": "Settings changed in another window; try again",
      "personalization.fieldReverted": "Wallpaper no longer exists; reset to default",
      "personalization.library.previewRef": "unsaved reference",
      "personalization.library.clear": "Clear library",
      "personalization.library.clearConfirm": "This permanently deletes all {count} uploaded images. These wallpaper settings fall back to defaults: {names}",
      "personalization.library.clearFailed": "Clear library failed; the remaining list was refreshed",
      "personalization.library.uploading": "Uploading…",
      "personalization.library.uploadingBatch": "Uploading {done}/{total}…",
      "personalization.library.uploadSomeFailed": "Uploaded {ok}; {failed} failed ({reason})",
      "personalization.library.uploadFailed": "Upload failed; try again",
      "personalization.status.loading": "Syncing personalization…",
      "personalization.status.offline": "Settings not synced yet; editing is unavailable",
      "personalization.status.retry": "Retry",
      "personalization.status.unsupported": "Created by a newer plugin version; read-only",
      "personalization.status.recovery": "Configuration file is damaged",
      "personalization.status.recoveryHint": "It can be rebuilt from the image library; custom slogans and colors may be lost.",
      "personalization.recovery.confirm": "Confirm recovery",
      // Host-reported personalization errors (see host-errors.js HOST_ERROR_KEYS)
      "host.personalization.tooLarge": "Image exceeds the size limit",
      "host.personalization.unsupportedImage": "Unsupported image format",
      "host.personalization.animatedWebp": "Animated WebP is not supported",
      "host.personalization.diskFull": "Not enough disk space",
      "host.personalization.invalidFilename": "Invalid display name",
      "host.personalization.assetMissing": "Image not found",
      "host.personalization.invalidConfig": "Configuration failed validation",
      "host.personalization.readonly": "Created by a newer config version; read-only",
      "host.personalization.recoveryRequired": "Configuration needs recovery; confirm it in the personalization panel first",
      "host.personalization.unknownSkin": "Skin not found",
      "host.personalization.uploadTimeout": "Upload timed out; check your connection and retry"
    }
  };
  function formatTemplate(template, params = {}) {
    return Object.entries(params).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
      template
    );
  }

  // src/client/host-errors.js
  var HOST_ERROR_KEYS = {
    UPLOAD_TOO_LARGE: "host.personalization.tooLarge",
    // UPLOAD_TIMEOUT: client-side fetch abort (config-client uploadImage).
    // UPLOAD_FAILED (any other rejected upload fetch) is intentionally unmapped —
    // resolveHostErrorText falls back to the panel's generic uploadFailed copy.
    UPLOAD_TIMEOUT: "host.personalization.uploadTimeout",
    UNSUPPORTED_IMAGE: "host.personalization.unsupportedImage",
    ANIMATION_UNSUPPORTED: "host.personalization.animatedWebp",
    DISK_FULL: "host.personalization.diskFull",
    FILENAME_INVALID: "host.personalization.invalidFilename",
    ASSET_NOT_FOUND: "host.personalization.assetMissing",
    INVALID_CONFIG: "host.personalization.invalidConfig",
    STORE_READONLY: "host.personalization.readonly",
    STORE_RECOVERY_REQUIRED: "host.personalization.recoveryRequired",
    UNKNOWN_SKIN: "host.personalization.unknownSkin"
  };
  function safeTr(tr, key, params) {
    if (typeof tr !== "function") return key;
    const text = tr(key, params);
    return typeof text === "string" ? text : key;
  }
  function resolveHostErrorText(value, tr) {
    if (value === null || value === void 0 || value === "") return "";
    if (typeof value === "string") return value;
    const key = value.code === void 0 ? void 0 : HOST_ERROR_KEYS[value.code];
    if (key !== void 0) {
      const text = safeTr(tr, key, value.params ?? {});
      if (text !== key) return text;
    }
    return value.text ?? value.message ?? String(value);
  }

  // src/client/personalization/panel.js
  var PANEL_CSS = [
    // Panel header collapse control (v1.0.0 ruling): ghost icon button in the
    // gear's visual language; collapses the PANEL only, never the shell.
    // margin-left:auto keeps it alone at the header's far right — the reset
    // control stays by the title on the left, separated by the flexible gap,
    // so aiming for « cannot mis-fire a destructive reset.
    ".vyra-free-theme-pz-collapse{flex:none;align-self:center;margin-left:auto;width:28px;height:28px;display:flex;align-items:center;justify-content:center;padding:0;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;opacity:.75;transition:opacity .15s}",
    ".vyra-free-theme-pz-collapse:hover,.vyra-free-theme-pz-collapse:focus-visible{opacity:1;border-color:var(--dsw-alias-border-l2);background:var(--dsw-alias-interactive-bg-hover)}",
    ".vyra-free-theme-pz-collapse svg{width:14px;height:14px}",
    ".vyra-free-theme-pz{display:flex;flex-direction:column;gap:10px}",
    ".vyra-free-theme-pz-head{display:flex;align-items:center;gap:8px}",
    // Title does NOT grow (flex:0 1 auto): the reset control must sit right
    // after the title text on the header's LEFT side (v1.0.0 ruling) — a
    // growing title would push it to the right end, adjacent to the collapse
    // chevron, and aiming for « could mis-fire a destructive reset.
    ".vyra-free-theme-pz-head .vyra-free-theme-pop-title{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;outline:none}",
    ".vyra-free-theme-pz-row{display:flex;flex-direction:column;gap:6px}",
    ".vyra-free-theme-pz-label{font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary);font-weight:500}",
    ".vyra-free-theme-pz-fields{display:flex;flex-direction:column;gap:6px}",
    ".vyra-free-theme-pz-colors{flex-direction:row;gap:14px}",
    ".vyra-free-theme-pz-color{display:flex;align-items:center;gap:6px}",
    ".vyra-free-theme-pz-color input[type=color]{width:34px;height:26px;padding:0;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);cursor:pointer}",
    ".vyra-free-theme-pz-range{display:flex;align-items:center;gap:8px}",
    ".vyra-free-theme-pz-range input[type=range]{flex:1;min-width:0;accent-color:var(--dsw-alias-brand-primary)}",
    ".vyra-free-theme-pz-range output{flex:none;min-width:44px;text-align:right;font-size:12px;color:var(--dsw-alias-label-secondary)}",
    ".vyra-free-theme-pz-input{box-sizing:border-box;width:100%;height:32px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px}",
    ".vyra-free-theme-pz-btn{flex:none;height:28px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer}",
    ".vyra-free-theme-pz-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}",
    ".vyra-free-theme-pz-btn:disabled{opacity:.55;cursor:default}",
    ".vyra-free-theme-pz-group{display:flex;flex-direction:column;gap:6px}",
    ".vyra-free-theme-pz-thumbs{display:grid;grid-template-columns:repeat(6,1fr);gap:6px}",
    // Grid helpers must span the full row: squeezed into one ~110px column
    // track, the "还有 N 张未显示" button and the empty-library hint wrapped
    // into multi-line stubs (field report). Centered full-row reads as the
    // load-more affordance; the hint stays left-aligned with its group label.
    ".vyra-free-theme-pz-thumbs>.vyra-free-theme-pz-btn{grid-column:1/-1;justify-self:center;white-space:nowrap}",
    ".vyra-free-theme-pz-thumbs>.vyra-free-theme-pz-muted{grid-column:1/-1;white-space:nowrap}",
    ".vyra-free-theme-pz-thumb{position:relative;aspect-ratio:4/3;padding:0;border:2px solid transparent;border-radius:10px;overflow:hidden;background:var(--dsw-alias-bg-layer-2);cursor:pointer}",
    ".vyra-free-theme-pz-thumb img{width:100%;height:100%;object-fit:cover}",
    ".vyra-free-theme-pz-thumb.on{border-color:var(--dsw-alias-brand-primary)}",
    ".vyra-free-theme-pz-thumb:disabled{opacity:.55;cursor:default}",
    ".vyra-free-theme-pz-muted{font-size:11px;line-height:16px;color:var(--dsw-alias-label-primary)}",
    ".vyra-free-theme-pz-strip{display:flex;flex-direction:column;gap:6px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-1);font-size:12px}",
    ".vyra-free-theme-pz-status{display:flex;align-items:center;gap:8px;justify-content:space-between}",
    ".vyra-free-theme-pz-warn{border-color:var(--dsw-alias-state-warning,#c77d00)}",
    ".vyra-free-theme-pz-asset{display:flex;align-items:center;gap:8px}",
    ".vyra-free-theme-pz-asset img{flex:none;width:44px;height:33px;border-radius:6px;object-fit:cover;border:1px solid var(--dsw-alias-border-l2)}",
    ".vyra-free-theme-pz-asset-copy{flex:1;min-width:0;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".vyra-free-theme-pz-gallery{display:flex;flex-direction:column;gap:8px}",
    // field issue #2: library cell corner-badges and the sticky action bar
    // (the scroll-region half of the same ruling lives in the shell's CSS —
    // it styles the shell-rendered panel column).
    ".vyra-free-theme-pz-cell{position:relative;display:block}",
    ".vyra-free-theme-pz-cell .vyra-free-theme-pz-thumb{width:100%}",
    ".vyra-free-theme-pz-del{position:absolute;top:4px;right:4px;width:22px;height:22px;display:flex;align-items:center;justify-content:center;padding:0;border:0;border-radius:50%;background:rgba(0,0,0,.55);color:#fff;font:inherit;font-size:14px;line-height:1;cursor:pointer}",
    ".vyra-free-theme-pz-del:hover{background:rgba(0,0,0,.78)}",
    ".vyra-free-theme-pz-del:disabled{opacity:.55;cursor:default}",
    ".vyra-free-theme-pz-del .vyra-free-theme-spinner{width:12px;height:12px;border-width:2px}",
    ".vyra-free-theme-pz-rowbtns{display:flex;gap:6px;flex-wrap:wrap}",
    ".vyra-free-theme-pz-actions{position:sticky;bottom:0;z-index:1;display:flex;align-items:flex-end;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:2px;padding:10px 2px 2px;background:var(--dsw-alias-bg-overlay);border-top:1px solid var(--dsw-alias-border-l2)}",
    ".vyra-free-theme-pz-cluster{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0}",
    ".vyra-free-theme-pz-cluster-status{flex-direction:column;align-items:flex-start;gap:4px;flex-wrap:nowrap}",
    ".vyra-free-theme-pz-primary{background:var(--dsh-alias-brand-primary,#C3272B);border-color:transparent;color:#fff}",
    ".vyra-free-theme-pz-primary:hover{filter:brightness(1.06)}",
    ".vyra-free-theme-pz-danger{color:var(--dsw-alias-error-text,var(--dsw-static-red-500,#d33));border-color:var(--dsw-alias-error-text,var(--dsw-static-red-500,#d33))}",
    ".vyra-free-theme-pz-fields-locale{flex-direction:row;gap:6px}",
    ".vyra-free-theme-pz-fields-locale .vyra-free-theme-pz-input{flex:1;min-width:0}",
    // HTML <dialog>.showModal() stays inside the renderer's top layer: unlike
    // window.confirm(), it never opens the Windows/Electron JavaScript dialog
    // that can leave the Desktop window unfocused after dismissal.
    ".vyra-free-theme-pz-dialog{box-sizing:border-box;width:min(480px,calc(100vw - 32px));max-height:calc(100vh - 32px);padding:20px;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:var(--dsw-alias-bg-elevated,var(--dsw-alias-bg-overlay));color:var(--dsw-alias-label-primary);box-shadow:var(--dsw-shadow-lv3,0 8px 24px rgba(0,0,0,.25));font:inherit}",
    ".vyra-free-theme-pz-dialog::backdrop{background:rgba(0,0,0,.45)}",
    ".vyra-free-theme-pz-dialog-message{margin:0 0 20px;white-space:pre-line;line-height:1.6;font-size:14px}",
    ".vyra-free-theme-pz-dialog-intro{margin:0;font-size:14px;line-height:1.6}.vyra-free-theme-pz-dialog-outro{margin:0 0 20px;font-size:14px;line-height:1.6}",
    ".vyra-free-theme-pz-dialog-tags{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 16px;padding:0;list-style:none}",
    ".vyra-free-theme-pz-dialog-tag{box-sizing:border-box;display:inline-flex;align-items:center;gap:7px;max-width:100%;padding:6px 10px;border:1px solid var(--dsw-alias-border-l2);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 42%,transparent);border-radius:999px;background:var(--dsw-alias-bg-layer-1);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,var(--dsw-alias-bg-overlay));color:var(--dsw-alias-label-primary);font-size:13px;line-height:18px;font-weight:600;white-space:normal}",
    '.vyra-free-theme-pz-dialog-tag::before{content:"";flex:none;width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-brand-primary)}',
    ".vyra-free-theme-pz-dialog-actions{display:flex;justify-content:flex-end;gap:8px}",
    // Stacked (<904px) resets MUST come after the rules they override — the
    // array order is the cascade order among equal-specificity selectors.
    "@media (max-width:904px){.vyra-free-theme-pz-thumbs{grid-template-columns:repeat(4,1fr)}}"
  ].join("\n");
  var PAGE_SIZE = 18;
  function createPersonalizationPanel({ jsx, react, configClient, tr, builtinAssetsFor, labelFor }) {
    const { useState, useEffect, useRef } = react;
    function useConfigState() {
      const [state, setState] = useState(() => configClient.getState());
      useEffect(() => configClient.onStateChange(() => setState(configClient.getState())), []);
      return state;
    }
    function TextField({ field, value, onValue, disabled }) {
      const inputs = field.scope === "locale" ? ["zh", "en"].map((locale) => jsx("input", {
        key: locale,
        type: "text",
        className: "vyra-free-theme-pz-input",
        value: value?.[locale] ?? "",
        maxLength: field.maxLength,
        disabled,
        "aria-label": `${tr(field.labelKey)} (${locale.toUpperCase()})`,
        placeholder: field.default?.[locale] ?? "",
        onChange: (event) => onValue({ ...value, [locale]: event.target.value })
      }, locale)) : [jsx("input", {
        key: "single",
        type: "text",
        className: "vyra-free-theme-pz-input",
        value: value ?? "",
        maxLength: field.maxLength,
        disabled,
        "aria-label": tr(field.labelKey),
        placeholder: field.default ?? "",
        onChange: (event) => onValue(event.target.value)
      })];
      return jsx("label", { className: "vyra-free-theme-pz-row", children: [
        jsx("span", { className: "vyra-free-theme-pz-label", children: tr(field.labelKey) }),
        jsx("div", {
          className: `vyra-free-theme-pz-fields${field.scope === "locale" ? " vyra-free-theme-pz-fields-locale" : ""}`,
          children: inputs
        })
      ] });
    }
    function RangeField({ field, value, onValue, disabled }) {
      const current = value ?? field.default;
      return jsx("label", { className: "vyra-free-theme-pz-row", children: [
        jsx("span", { className: "vyra-free-theme-pz-label", children: tr(field.labelKey) }),
        jsx("div", { className: "vyra-free-theme-pz-fields", children: jsx("div", { className: "vyra-free-theme-pz-range", children: [
          jsx("input", {
            type: "range",
            min: field.min,
            max: field.max,
            step: field.step,
            value: current,
            disabled,
            "aria-label": tr(field.labelKey),
            onChange: (event) => onValue(Number(event.target.value))
          }),
          jsx("output", { children: `${current}${field.unit ?? ""}` })
        ] }) })
      ] });
    }
    function SelectField({ field, value, onValue, disabled }) {
      return jsx("label", { className: "vyra-free-theme-pz-row", children: [
        jsx("span", { className: "vyra-free-theme-pz-label", children: tr(field.labelKey) }),
        jsx("div", { className: "vyra-free-theme-pz-fields", children: jsx("select", {
          className: "vyra-free-theme-pz-input",
          value: value ?? field.default,
          disabled,
          "aria-label": tr(field.labelKey),
          onChange: (event) => onValue(event.target.value),
          children: field.options.map((option) => jsx("option", {
            value: option.value,
            children: tr(option.labelKey)
          }, option.value))
        }) })
      ] });
    }
    function WallpaperSection({ skinId, field, value, onValue, state, disabled, requestConfirm }) {
      const uploadRef = useRef(null);
      const [message, setMessage] = useState(null);
      const [deletingId, setDeletingId] = useState(null);
      const [clearing, setClearing] = useState(false);
      const [visible, setVisible] = useState(PAGE_SIZE);
      const schema = getSkinSchema(skinId);
      const builtins = schema?.builtinAssets ?? {};
      const liveAssets = builtinAssetsFor(skinId);
      const choices = field.builtinChoices ?? [];
      const library = state.library;
      const deleteAsset = async (asset) => {
        setMessage(null);
        setDeletingId(asset.id);
        try {
          const result = await configClient.deleteImage(asset.id);
          setMessage(result.error ? tr("personalization.library.deleteFailed") : tr("personalization.library.deleted", { name: asset.displayName }));
        } catch {
          setMessage(tr("personalization.library.deleteFailed"));
        } finally {
          setDeletingId(null);
        }
      };
      const referenceLabelsFor = (assetId) => configClient.referencesFor(assetId).map((entry) => entry.layer === "preview" ? `${labelFor(entry.skinId)} · ${entry.key} · ${tr("personalization.library.previewRef")}` : `${labelFor(entry.skinId)} · ${entry.key}`);
      const removeAsset = (asset) => {
        if (deletingId !== null || clearing) return;
        const references = referenceLabelsFor(asset.id);
        if (references.length === 0) return deleteAsset(asset);
        requestConfirm(
          `${tr("personalization.library.deleteConfirm")}
${references.join("\n")}`,
          () => deleteAsset(asset)
        );
      };
      const clearLibrary = () => {
        if (clearing || deletingId !== null || library.length === 0) return;
        const names = /* @__PURE__ */ new Map();
        for (const asset of library) {
          for (const label of referenceLabelsFor(asset.id)) {
            names.set(label, true);
          }
        }
        const listed = [...names.keys()].join("、");
        requestConfirm(tr("personalization.library.clearConfirm", {
          count: library.length,
          names: listed === "" ? "—" : listed
        }), async () => {
          setClearing(true);
          try {
            const result = await configClient.clearLibrary();
            if (result.error) {
              setMessage(tr("personalization.library.clearFailed"));
              void configClient.refetch();
            }
          } catch {
            setMessage(tr("personalization.library.clearFailed"));
            void configClient.refetch();
          } finally {
            setClearing(false);
          }
        });
      };
      return jsx("div", { className: "vyra-free-theme-pz-row", children: [
        jsx("span", { className: "vyra-free-theme-pz-label", children: tr(field.labelKey) }),
        jsx("div", { className: "vyra-free-theme-pz-fields", children: [
          choices.length > 0 ? jsx("div", { className: "vyra-free-theme-pz-group", children: [
            jsx("div", { className: "vyra-free-theme-pz-muted", children: tr("personalization.builtin") }),
            jsx("div", { className: "vyra-free-theme-pz-thumbs", children: choices.map((key) => {
              const asset = builtins[key];
              const ref = `builtin:${skinId}:${key}`;
              return jsx("button", {
                type: "button",
                className: `vyra-free-theme-pz-thumb${value === ref ? " on" : ""}`,
                disabled,
                title: tr(asset?.labelKey ?? "personalization.builtin.default"),
                "aria-pressed": value === ref,
                onClick: () => onValue(ref),
                children: jsx("img", { src: liveAssets[key]?.url ?? asset?.url ?? "", alt: tr(asset?.labelKey ?? key), loading: "lazy", decoding: "async" })
              }, key);
            }) })
          ] }) : null,
          jsx("div", { className: "vyra-free-theme-pz-group", children: [
            jsx("div", { className: "vyra-free-theme-pz-muted", children: tr("personalization.library") }),
            jsx("div", { className: "vyra-free-theme-pz-thumbs", children: [
              ...library.slice(0, visible).map((asset) => jsx("div", {
                key: asset.id,
                className: `vyra-free-theme-pz-cell${value === asset.id ? " on" : ""}`,
                children: [
                  jsx("button", {
                    type: "button",
                    className: `vyra-free-theme-pz-thumb${value === asset.id ? " on" : ""}`,
                    disabled,
                    title: asset.displayName,
                    "aria-pressed": value === asset.id,
                    onClick: () => onValue(asset.id),
                    children: jsx("img", { src: configClient.assetUrl(asset), alt: asset.displayName, loading: "lazy", decoding: "async" })
                  }, asset.id),
                  jsx("button", {
                    type: "button",
                    className: `vyra-free-theme-pz-del${deletingId === asset.id ? " vyra-free-theme-pz-del-busy" : ""}`,
                    disabled: disabled || deletingId !== null || clearing,
                    "aria-label": `${tr("personalization.library.delete")}: ${asset.displayName}`,
                    onClick: () => removeAsset(asset),
                    children: deletingId === asset.id ? jsx("span", { className: "vyra-free-theme-spinner", "aria-hidden": "true" }) : "×"
                  }, `${asset.id}-del`)
                ]
              })),
              library.length > visible ? jsx("button", {
                type: "button",
                className: "vyra-free-theme-pz-btn",
                onClick: () => setVisible(visible + PAGE_SIZE),
                children: tr("personalization.library.more", { count: library.length - visible })
              }) : null,
              library.length === 0 ? jsx("span", {
                className: "vyra-free-theme-pz-muted",
                children: tr("personalization.library.empty")
              }) : null
            ] }),
            message === null ? null : jsx("div", { className: "vyra-free-theme-pz-status vyra-free-theme-pz-muted", children: message }),
            jsx("div", { className: "vyra-free-theme-pz-rowbtns", children: [
              jsx("button", {
                type: "button",
                className: "vyra-free-theme-pz-btn",
                disabled: disabled || deletingId !== null || clearing,
                onClick: () => uploadRef.current?.click(),
                children: tr("personalization.library.upload")
              }),
              library.length > 0 ? jsx("button", {
                type: "button",
                className: "vyra-free-theme-pz-btn vyra-free-theme-pz-danger",
                disabled: disabled || deletingId !== null || clearing,
                onClick: clearLibrary,
                children: tr("personalization.library.clear")
              }) : null
            ] }),
            jsx("input", {
              ref: uploadRef,
              type: "file",
              accept: "image/png,image/jpeg,image/webp,image/gif",
              multiple: true,
              style: { display: "none" },
              onChange: async (event) => {
                const files = [...event.target.files ?? []];
                event.target.value = "";
                if (files.length === 0) return;
                if (files.length > 1) {
                  let ok = 0;
                  let lastAssetId = null;
                  let firstError = null;
                  for (let index = 0; index < files.length; index += 1) {
                    setMessage(tr("personalization.library.uploadingBatch", {
                      done: index + 1,
                      total: files.length
                    }));
                    const result2 = await configClient.uploadImage(files[index]);
                    if (result2.asset) {
                      ok += 1;
                      lastAssetId = result2.asset.id;
                    } else if (firstError === null) {
                      firstError = resolveHostErrorText(
                        { code: result2.error, message: tr("personalization.library.uploadFailed") },
                        tr
                      );
                    }
                  }
                  if (lastAssetId !== null) {
                    onValue(lastAssetId);
                    await configClient.flushNow();
                  }
                  setMessage(firstError === null ? null : ok === 0 ? firstError : tr("personalization.library.uploadSomeFailed", {
                    ok,
                    failed: files.length - ok,
                    reason: firstError
                  }));
                  return;
                }
                const result = await configClient.uploadImage(files[0]);
                if (result.asset) {
                  setMessage(null);
                  onValue(result.asset.id);
                  await configClient.flushNow();
                } else {
                  setMessage(resolveHostErrorText(
                    { code: result.error, message: tr("personalization.library.uploadFailed") },
                    tr
                  ));
                }
              }
            })
          ] })
        ] })
      ] });
    }
    function CollapseIcon() {
      return jsx("svg", {
        viewBox: "0 0 24 24",
        fill: "none",
        "aria-hidden": "true",
        children: jsx("path", {
          d: "M17 6 L11 12 L17 18 M11 6 L5 12 L11 18",
          stroke: "currentColor",
          strokeWidth: "1.6",
          strokeLinecap: "round",
          strokeLinejoin: "round"
        })
      });
    }
    return function PersonalizationPanel({ skinId, onCollapse }) {
      const state = useConfigState();
      const desktopProfile = typeof location !== "undefined" && location.protocol === "dsh-app:" && location.hostname === "app";
      const profile = desktopProfile ? "desktop" : "web";
      const schema = getSkinSchema(skinId, profile);
      const headerRef = useRef(null);
      const dialogRef = useRef(null);
      const confirmationRef = useRef(null);
      const [confirmation, setConfirmation] = useState(null);
      const requestConfirm = (message, accept, { detailItems = null } = {}) => {
        if (!desktopProfile) {
          if (window.confirm(message)) void accept();
          return;
        }
        if (confirmationRef.current !== null) return;
        const next = { message, accept, detailItems };
        confirmationRef.current = next;
        setConfirmation(next);
      };
      const cancelConfirm = () => {
        confirmationRef.current = null;
        setConfirmation(null);
      };
      const acceptConfirm = () => {
        if (confirmationRef.current !== confirmation) return;
        confirmationRef.current = null;
        setConfirmation(null);
        if (configClient.canWrite()) {
          void confirmation.accept();
        }
      };
      useEffect(() => {
        if (confirmation !== null) dialogRef.current?.showModal?.();
      }, [confirmation]);
      const wideLayout = typeof window !== "undefined" && window.innerWidth >= 905;
      useEffect(() => {
        headerRef.current?.focus?.(wideLayout ? { preventScroll: true } : void 0);
      }, []);
      if (schema === null) return null;
      const writesBlocked = !configClient.canWrite();
      const overrides = configClient.effectiveOverrides(skinId);
      const { values } = mergeValues(skinId, overrides, void 0, profile);
      const hasAnyOverride = Object.keys(overrides).length > 0;
      const fieldRows = schema.fields.map((field) => {
        const value = values[field.key];
        const setValue = (next) => configClient.preview(skinId, field.key, next);
        const common = { field, value, onValue: setValue, disabled: writesBlocked };
        switch (field.type) {
          case "text":
            return jsx(TextField, { ...common, key: field.key });
          case "range":
            return jsx(RangeField, { ...common, key: field.key });
          case "select":
            return jsx(SelectField, { ...common, key: field.key });
          case "image":
            return jsx(WallpaperSection, {
              ...common,
              key: field.key,
              skinId,
              state,
              requestConfirm
            });
          default:
            return null;
        }
      });
      const statusCluster = [];
      if (state.mode === "recovery") {
        statusCluster.push(jsx("div", { key: "recovery", className: "vyra-free-theme-pz-status vyra-free-theme-pz-warn", children: [
          jsx("div", { children: tr("personalization.status.recovery") }),
          jsx("div", { className: "vyra-free-theme-pz-muted", children: tr("personalization.status.recoveryHint") }),
          jsx("button", {
            type: "button",
            className: "vyra-free-theme-pz-btn",
            onClick: () => configClient.confirmRecovery(),
            children: tr("personalization.recovery.confirm")
          })
        ] }));
      }
      if (state.status === "loading") {
        statusCluster.push(jsx("div", { key: "loading", className: "vyra-free-theme-pz-status", children: [
          jsx("span", { children: tr("personalization.status.loading") })
        ] }));
      }
      if (state.status === "offline-failed") {
        statusCluster.push(jsx("div", { key: "offline", className: "vyra-free-theme-pz-status", children: [
          jsx("span", { children: tr("personalization.status.offline") }),
          jsx("button", {
            type: "button",
            className: "vyra-free-theme-pz-btn",
            onClick: () => configClient.refetch(),
            children: tr("personalization.status.retry")
          })
        ] }));
      }
      if (state.status === "unsupported-readonly") {
        statusCluster.push(jsx("div", { key: "ro", className: "vyra-free-theme-pz-status", children: [
          jsx("span", { children: tr("personalization.status.unsupported") })
        ] }));
      }
      const notices = state.notices;
      const conflictNotice = notices.find((notice) => notice.kind === "conflict");
      const errorNotice = notices.find((notice) => notice.kind === "error");
      if (conflictNotice !== void 0) {
        statusCluster.push(jsx("div", { key: "save-conflict", className: "vyra-free-theme-pz-status vyra-free-theme-pz-warn", children: [
          jsx("span", { children: tr("personalization.saveConflict") })
        ] }));
      } else if (errorNotice !== void 0) {
        statusCluster.push(jsx("div", { key: "save-error", className: "vyra-free-theme-pz-status vyra-free-theme-pz-warn", children: [
          jsx("span", { children: tr("personalization.saveFailed") }),
          jsx("div", { className: "vyra-free-theme-pz-muted", children: errorNotice.message })
        ] }));
      }
      const revertedNotice = notices.find((notice) => notice.kind === "reverted");
      if (revertedNotice !== void 0 && revertedNotice.fields.length > 0) {
        statusCluster.push(jsx("div", { key: "reverted", className: "vyra-free-theme-pz-status", children: [
          jsx("div", { children: tr("personalization.fieldReverted") }),
          jsx("div", {
            className: "vyra-free-theme-pz-muted",
            children: revertedNotice.fields.map((entry) => `${labelFor(entry.skinId)} · ${entry.key}`).join("、")
          })
        ] }));
      }
      return jsx("div", { className: "vyra-free-theme-pz", children: [
        // Header row (`.vyra-free-theme-pz-head`): the heading stays the focus
        // target (issue #12); the reset and collapse controls pack at its
        // right end so both are discoverable where the user is looking —
        // the gear that opened it is a full column away (user ruling). The
        // reset appears only while the skin has overrides, and its appearing
        // can no longer change the panel's height (v1.0.0 ruling).
        jsx("div", { className: "vyra-free-theme-pz-head", children: [
          jsx("div", {
            ref: headerRef,
            className: "vyra-free-theme-pop-title",
            tabIndex: -1,
            role: "heading",
            "aria-level": 2,
            children: `${tr("personalization.title")} · ${labelFor(skinId)}`
          }),
          hasAnyOverride ? jsx("button", {
            type: "button",
            className: "vyra-free-theme-pz-btn vyra-free-theme-pz-danger",
            disabled: writesBlocked,
            onClick: () => {
              const affected = schema.fields.filter((field) => overrides[field.key] !== void 0).map((field) => tr(field.labelKey));
              requestConfirm(tr("personalization.resetConfirm", {
                fields: affected.length > 0 ? `• ${affected.join(tr("personalization.resetJoin"))}` : "—"
              }), () => {
                for (const field of schema.fields) configClient.previewReset(skinId, field.key);
                void configClient.flushNow();
              }, { detailItems: affected });
            },
            children: tr("personalization.reset")
          }) : null,
          onCollapse ? jsx("button", {
            type: "button",
            className: "vyra-free-theme-pz-collapse",
            "aria-label": tr("personalization.collapse"),
            title: tr("personalization.collapse"),
            onClick: onCollapse,
            children: jsx(CollapseIcon, {})
          }) : null
        ] }),
        ...fieldRows,
        statusCluster.length > 0 ? jsx("div", {
          className: "vyra-free-theme-pz-actions",
          children: jsx("div", { className: "vyra-free-theme-pz-cluster vyra-free-theme-pz-cluster-status", children: statusCluster })
        }) : null,
        confirmation === null ? null : jsx("dialog", {
          ref: dialogRef,
          className: "vyra-free-theme-pz-dialog",
          "aria-labelledby": "vyra-free-theme-confirm-title",
          onCancel: (event) => {
            event.preventDefault();
            cancelConfirm();
          },
          children: [
            jsx("div", { id: "vyra-free-theme-confirm-title", className: "vyra-free-theme-pop-title", children: tr("personalization.confirmTitle") }),
            confirmation.detailItems === null ? jsx("p", { className: "vyra-free-theme-pz-dialog-message", children: confirmation.message }) : jsx("div", { children: [
              jsx("p", { className: "vyra-free-theme-pz-dialog-intro", children: tr("personalization.resetConfirmIntro") }),
              confirmation.detailItems.length > 0 ? jsx("ul", { className: "vyra-free-theme-pz-dialog-tags", children: confirmation.detailItems.map((label) => jsx("li", { className: "vyra-free-theme-pz-dialog-tag", children: label }, label)) }) : jsx("p", { className: "vyra-free-theme-pz-dialog-message", children: "—" }),
              jsx("p", { className: "vyra-free-theme-pz-dialog-outro", children: tr("personalization.resetConfirmOutro") })
            ] }),
            jsx("div", { className: "vyra-free-theme-pz-dialog-actions", children: [
              jsx("button", {
                type: "button",
                className: "vyra-free-theme-pz-btn",
                autoFocus: true,
                onClick: cancelConfirm,
                children: tr("personalization.cancel")
              }),
              jsx("button", {
                type: "button",
                className: "vyra-free-theme-pz-btn vyra-free-theme-pz-danger",
                disabled: writesBlocked,
                onClick: acceptConfirm,
                children: tr("personalization.confirm")
              })
            ] })
          ]
        })
      ] });
    };
  }

  // src/client/sidebar-switcher.js
  var TAG_ID = "dsh-vyra-free-theme/sidebar.css";
  var SWEEP_MS = 200;
  function sweepShellHeight(shell, { from, fromWidth, maxHeight, duration = SWEEP_MS } = {}) {
    if (!shell || typeof from !== "number" || !Number.isFinite(from)) return () => {
    };
    if (typeof shell.getBoundingClientRect !== "function") return () => {
    };
    const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return () => {
    };
    const prevTransition = shell.style.transition;
    shell.style.transition = "none";
    const finalRect = shell.getBoundingClientRect();
    const toWidth = finalRect.width;
    const content = Math.max(finalRect.height, shell.scrollHeight || 0);
    const target = typeof maxHeight === "number" ? Math.min(content, maxHeight) : content;
    const startWidth = typeof fromWidth === "number" && Number.isFinite(fromWidth) ? fromWidth : toWidth;
    const heightDelta = Math.abs(target - from);
    const widthDelta = Math.abs(toWidth - startWidth);
    if (!Number.isFinite(target) || heightDelta < 1 && widthDelta < 1) {
      if (prevTransition === void 0) delete shell.style.transition;
      else shell.style.transition = prevTransition;
      return () => {
      };
    }
    const release = () => {
      shell.style.height = "";
      shell.style.width = "";
      shell.style.transition = "";
      shell.style.overflow = "";
      shell.style.removeProperty?.("--vyra-free-theme-sweep-panel-basis");
      shell.classList?.remove?.("vyra-free-theme-sweeping");
    };
    const panelColumn = shell.querySelector?.(".vyra-free-theme-pz-panel") ?? null;
    const panelBasis = panelColumn === null ? 0 : panelColumn.getBoundingClientRect().width;
    shell.classList?.add?.("vyra-free-theme-sweeping");
    if (panelBasis > 0) {
      shell.style.setProperty?.("--vyra-free-theme-sweep-panel-basis", `${Math.round(panelBasis * 100) / 100}px`);
    }
    shell.style.height = `${from}px`;
    shell.style.width = `${startWidth}px`;
    shell.style.overflow = "hidden";
    void shell.offsetHeight;
    shell.style.transition = `width ${duration}ms ease-out, height ${duration}ms ease-out`;
    shell.style.width = `${toWidth}px`;
    shell.style.height = `${target}px`;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      shell.removeEventListener?.("transitionend", onEnd);
      release();
    };
    const onEnd = (event) => {
      if (event?.propertyName === "height") finish();
    };
    const timer = setTimeout(finish, duration + 60);
    shell.addEventListener?.("transitionend", onEnd);
    return finish;
  }
  var THEME_CHOICES = [
    { id: "light", labelKey: "appearance.light" },
    { id: "dark", labelKey: "appearance.dark" },
    { id: "system", labelKey: "appearance.system" }
  ];
  var SHELL_CSS = [
    '[data-slot="sidebar.footer.action"]{display:flex!important;flex-direction:column;width:100%;min-width:0}',
    '[data-slot="sidebar.footer.action"]>*{flex:none;min-width:0}',
    ".vyra-free-theme-switcher-wrap{width:100%}",
    ".vyra-free-theme-switcher-wrap.rail{display:flex;justify-content:center}",
    // 2026-11-09（对齐 dsh-m issue #55）：弃 width+4px/margin -2px/10-8 不对称 padding 的全宽外溢
    // trick，改宿主规范形——border-inline 透明边吃 paint-inset + padding 9/9，内容起点 8+3+9=20px
    // 与官方面板行/设置行/dsh-m 入口同刻度（原 14px，dsh-m 对齐后本条成为唯一 6px 出列者，主人截图实证）
    ".vyra-free-theme-switcher-btn{box-sizing:border-box;display:flex;align-items:center;gap:8px;width:100%;height:42px;margin:4px 0;padding:0 9px;border:0;border-inline:var(--dsh-sidebar-paint-inset,3px) solid transparent;border-radius:var(--dsw-radius-md,12px);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;line-height:22px;cursor:pointer;overflow:hidden}",
    ".vyra-free-theme-switcher-wrap.rail .vyra-free-theme-switcher-btn{width:36px;height:36px;margin:8px 0 10px;padding:0;justify-content:center;border-radius:50%;gap:0}",
    ".vyra-free-theme-switcher-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}",
    ".vyra-free-theme-switcher-btn.on,.vyra-free-theme-switcher-btn[aria-expanded=true]{background:var(--dsw-specific-sidebar-nav-item-active)}",
    ".vyra-free-theme-switcher-btn svg{flex:none;width:16px;height:16px}",
    ".vyra-free-theme-switcher-wrap.rail .vyra-free-theme-switcher-btn svg{width:18px;height:18px}",
    ".vyra-free-theme-switcher-btn span{white-space:nowrap;overflow:hidden}",
    // 毛玻璃弹层（dsh-quota-watch 同款配方）：86% 不透明底 + blur14 提饱和，
    // 下层文字被底色盖住、只余柔光，弹层文字保持清晰可读；首条 solid 声明
    // 兜底不支持 color-mix 的浏览器。
    // Width term reserves 16px margins per side on sub-414px viewports (the
    // 390px cap keeps every wider viewport untouched). The old 24px term left
    // only ~10px of right margin once the trigger-anchored left offset was
    // paid, and — combined with the fixed 360px list column — clipped the
    // gear column at the pop's own edge on phones (field report 2026-10-14:
    // 手机上齿轮被截半 + 横向滚动条).
    // 窄屏抽屉层叠（2026-11-05 修复）：弹层经 portal 挂在 body 下，与官方侧栏
    // 抽屉同层竞争。dsh-client-ui-layout 在视口 <768px 时抽屉遮罩为 z-70、侧栏
    // 列为 z-71；旧值 z-60 让弹层整块压在抽屉之下（只余遮罩模糊后的轮廓，点不到）。
    // z-80 高于抽屉、低于宿主 z-100 起的各层（ADR-0021 的 z 全集）。
    ".vyra-free-theme-pop{position:fixed;z-index:80;box-sizing:border-box;display:flex;flex-direction:column;gap:8px;width:min(390px,calc(100vw - 32px));max-height:calc(100vh - 24px);padding:14px;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:var(--dsw-alias-bg-elevated,var(--dsw-alias-bg-overlay));background:color-mix(in srgb,var(--dsw-alias-bg-base,#1f1f1f) 86%,transparent);backdrop-filter:blur(14px) saturate(1.3);-webkit-backdrop-filter:blur(14px) saturate(1.3);color:var(--dsw-alias-label-primary);box-shadow:var(--dsw-shadow-lv3,0 8px 24px rgba(0,0,0,.14));overflow-y:auto;transition:width .2s ease-out}",
    // Slim themed scrollbars for the shell's own scroll region (list-only
    // popover): thin + token-colored thumb, WebKit and Firefox both covered.
    ".vyra-free-theme-pop{scrollbar-width:thin;scrollbar-color:var(--dsw-alias-border-l2) transparent}",
    ".vyra-free-theme-pop::-webkit-scrollbar{width:8px;height:8px}",
    ".vyra-free-theme-pop::-webkit-scrollbar-thumb{background:var(--dsw-alias-border-l2);border-radius:4px}",
    ".vyra-free-theme-pop::-webkit-scrollbar-thumb:hover{background:var(--dsw-alias-label-secondary)}",
    ".vyra-free-theme-pop::-webkit-scrollbar-track{background:transparent}",
    // 【共享原子】.vyra-free-theme-pop-title is shared vocabulary: the panel module
    // reuses it for its header heading (styled contextually in PANEL_CSS).
    ".vyra-free-theme-pop-title{font-size:13.5px;line-height:20px;font-weight:500;color:var(--dsw-alias-label-primary);padding:0 4px}",
    ".vyra-free-theme-theme-grid{display:flex;align-items:stretch;gap:8px}",
    ".vyra-free-theme-theme-card{box-sizing:border-box;display:flex;flex:1;min-width:0;height:72px;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:8px 5px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer}",
    ".vyra-free-theme-theme-card:hover{background:var(--dsw-alias-interactive-bg-hover)}",
    ".vyra-free-theme-theme-card-on,.vyra-free-theme-theme-card-on:hover{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-module-platform)}",
    ".vyra-free-theme-theme-card svg{width:18px;height:18px;flex:none}",
    ".vyra-free-theme-pop-divider{height:1px;margin:4px 0;background:var(--dsw-alias-border-l2)}",
    ".vyra-free-theme-pop-card{box-sizing:border-box;display:flex;flex-direction:column;gap:2px;align-items:flex-start;text-align:left;width:100%;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:0 0;color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer}",
    ".vyra-free-theme-pop-card:hover{background:var(--dsw-alias-interactive-bg-hover)}",
    ".vyra-free-theme-pop-card-on,.vyra-free-theme-pop-card-on:hover{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-module-platform)}",
    ".vyra-free-theme-pop-card-label{font-size:14px;line-height:20px;font-weight:500}",
    ".vyra-free-theme-pop-card-desc{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}",
    // 【共享原子】.vyra-free-theme-spinner (+ its keyframes and the
    // reduced-motion opt-out) is the personalization panel's delete-badge
    // loading indicator, styled here with the shell's base atoms.
    ".vyra-free-theme-spinner{width:16px;height:16px;border:2px solid var(--dsw-alias-border-l2);border-top-color:var(--dsw-alias-brand-primary);border-radius:50%;animation:vyra-free-theme-spin .8s linear infinite}",
    "@keyframes vyra-free-theme-spin{to{transform:rotate(360deg)}}",
    "@media (prefers-reduced-motion:reduce){.vyra-free-theme-spinner{animation:none}}",
    // -- personalization gear + panel -------------------------------------------
    ".vyra-free-theme-pop-card-row{display:flex;width:100%;min-width:0;gap:6px;align-items:stretch}",
    ".vyra-free-theme-pop-card-row .vyra-free-theme-pop-card{flex:1;min-width:0}",
    ".vyra-free-theme-pz-gear{position:relative;flex:none;align-self:center;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:1px solid transparent;border-radius:10px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;opacity:.75;transition:opacity .15s}",
    ".vyra-free-theme-pz-gear:hover,.vyra-free-theme-pz-gear:focus-visible,.vyra-free-theme-pz-gear.touch{opacity:1;border-color:var(--dsw-alias-border-l2);background:var(--dsw-alias-interactive-bg-hover)}",
    // Expanded state (declared after the hover rule so the brand tint wins
    // while hovering too): the gear IS the panel toggle — make that legible in
    // both states, same visual language as the selected skin card.
    '.vyra-free-theme-pz-gear[aria-expanded="true"]{opacity:1;border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-module-platform)}',
    ".vyra-free-theme-pz-gear svg{width:16px;height:16px}",
    // Deep dark surfaces: meirenzhi tints the bg-overlay token with its own
    // family, but in the OFFICIAL skin no token override exists and the pop
    // inherited the host's washed mid-gray (#61666b). Scope a deep charcoal to
    // the no-skin state (ruling #16); the skinned mode keeps its token-driven
    // overlay. openbmc / uefi-harness were retired, so only meirenzhi is
    // excluded now.
    "body[data-ds-dark-theme]:not([data-dsh-meirenzhi-skin]) .vyra-free-theme-pop{background:rgba(41,42,44,0.97)}",
    // -- combined shell (Q44/Q46): list column + docked panel column ----------
    ".vyra-free-theme-pop.vyra-free-theme-wide{flex-direction:row;align-items:stretch;width:min(1105px,calc(100vw - 24px))}",
    // List column: exactly 360px wherever the 390px narrow shell fits (the
    // v2.5 宽度恒定 ruling #10/#11), shrinking only BELOW a 414px viewport —
    // a fixed 360px column inside a narrower pop overflowed horizontally and
    // pushed the gear column behind the pop's right edge (same field report).
    ".vyra-free-theme-pop-main{display:flex;flex-direction:column;gap:8px;min-width:0;width:min(360px,100%);flex:none}",
    ".vyra-free-theme-pop.vyra-free-theme-wide .vyra-free-theme-pop-main{flex:0 0 360px}",
    // box-sizing is NOT inherited: without border-box here, the sweep's
    // measured rect width feeds flex-basis as a CONTENT width (+15px padding/
    // border), so the panel would sit 15px wide through the morph and snap
    // back at release — border-box makes the measured rect and the basis the
    // same quantity.
    // The panel COLUMN container is rendered by this shell (粘连外壳), so its
    // styles are shell-owned; the panel module's own root is .vyra-free-theme-pz.
    // The class name is part of the panel module's published interface to the
    // shell — the sweep rules below target it by name.
    ".vyra-free-theme-pz-panel{box-sizing:border-box;flex:0 1 700px;min-width:0;display:flex;flex-direction:column;gap:10px;padding-left:14px;border-left:1px solid var(--dsw-alias-border-l2);overflow-x:hidden;transform:translateX(16px);opacity:0;animation:vyra-free-theme-pz-in .2s ease-out forwards}",
    "@keyframes vyra-free-theme-pz-in{to{transform:none;opacity:1}}",
    "@media (prefers-reduced-motion:reduce){.vyra-free-theme-pz-panel{animation:none;transform:none;opacity:1}.vyra-free-theme-pop{transition:none}}",
    // Stacked sheet (≤904px + panel open): the shell becomes a near-full-
    // viewport sheet and the PANEL COLUMN owns the scroll (flex-fills the
    // shell, slim scrollbar) — anchoring a growing panel above the trigger
    // crammed list + panel into one sliver (field report: 窄视窗小条条).
    // Specificity (0,3,0) still beats the wide-scroll base rule below for
    // flex/basis; overflow-y now INHERITS that base rule instead of opting out.
    "@media (max-width:904px){.vyra-free-theme-pop.vyra-free-theme-wide{flex-direction:column;width:min(390px,calc(100vw - 24px))}.vyra-free-theme-pz-panel{flex:1 1 auto;min-height:0;flex-basis:auto;padding-left:0;border-left:0;border-top:1px solid var(--dsw-alias-border-l2);padding-top:12px;transform:translateY(12px)}}",
    ".vyra-free-theme-pz-panel{scrollbar-width:thin;scrollbar-color:var(--dsw-alias-border-l2) transparent}",
    ".vyra-free-theme-pz-panel::-webkit-scrollbar{width:8px;height:8px}",
    ".vyra-free-theme-pz-panel::-webkit-scrollbar-thumb{background:var(--dsw-alias-border-l2);border-radius:4px}",
    ".vyra-free-theme-pz-panel::-webkit-scrollbar-thumb:hover{background:var(--dsw-alias-label-secondary)}",
    ".vyra-free-theme-pz-panel::-webkit-scrollbar-track{background:transparent}",
    // -- field issue #2: a dedicated scroll region for the panel column -----
    //    (the cell corner-badges / sticky action bar half of the same ruling
    //    lives in the panel's own PANEL_CSS now) --------------------------------
    ".vyra-free-theme-wide .vyra-free-theme-pz-panel{overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin}",
    // While the shell is mid-sweep its height is pinned below the panel's
    // content extent, so scrollbars would flash on for the ~200ms of the
    // morph: the whole shell clips (both axes — the panel column is held wide
    // and overflows horizontally during the reveal), and the panel column's
    // own scrollbar is clipped too. Equal specificity with the wide scroll
    // rule and declared after it, so wide mode clips during the sweep; the
    // stacked sheet keeps the panel's own scroll region and clips with it.
    // Sweep is SHELL motion behaviour: these rules are written against the
    // panel column's class name — the declared interface use mentioned above.
    ".vyra-free-theme-sweeping{overflow:hidden}",
    ".vyra-free-theme-sweeping .vyra-free-theme-pz-panel{overflow-y:hidden}",
    // Clip-reveal hold (issue #13 rev. 2): the panel column stays at its
    // settled width for the whole beat — measured into the CSS var by the
    // sweep — so its content never reflows while it fades in. Desktop wide
    // row layout only; in the stacked column layout a fixed flex-basis would
    // be a HEIGHT, and the stacked panel never reflows horizontally anyway.
    "@media (min-width:905px){.vyra-free-theme-sweeping.vyra-free-theme-wide .vyra-free-theme-pz-panel{flex:0 0 var(--vyra-free-theme-sweep-panel-basis,700px)}}"
  ].join("\n");
  var CSS = [SHELL_CSS, PANEL_CSS].join("\n");
  function installSidebarSwitcher(ctx, { runtime, jsx, react, reactDom, configClient, skinsById }) {
    function fallbackTranslate(key, params = {}) {
      return formatTemplate(DICTS.zh[key] ?? key, params);
    }
    function localeTranslate(key, params = {}) {
      try {
        const text = ctx.locale?.translate?.(NS, key, params);
        if (typeof text === "string" && text !== key) return text;
      } catch {
      }
      return fallbackTranslate(key, params);
    }
    function labelFor(skinId) {
      if (skinId === runtime.officialId) return localeTranslate("skins.official.label");
      const listed = runtime.list().find((skin) => skin.id === skinId);
      return listed?.label ?? skinId;
    }
    function builtinAssetsFor(skinId) {
      return skinsById?.(skinId)?.builtinAssets ?? {};
    }
    const PersonalizationPanel = configClient ? createPersonalizationPanel({
      jsx,
      react,
      configClient,
      tr: localeTranslate,
      builtinAssetsFor,
      labelFor
    }) : null;
    function GearIcon() {
      return jsx("svg", {
        width: 16,
        height: 16,
        viewBox: "0 0 24 24",
        fill: "none",
        xmlns: "http://www.w3.org/2000/svg",
        "aria-hidden": "true",
        children: jsx("path", {
          d: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
          stroke: "currentColor",
          strokeWidth: 1.6,
          strokeLinejoin: "round"
        })
      });
    }
    function SwitcherIcon() {
      return jsx("svg", {
        width: 16,
        height: 16,
        viewBox: "0 0 24 24",
        fill: "none",
        xmlns: "http://www.w3.org/2000/svg",
        "aria-hidden": "true",
        children: [
          jsx("path", { d: "M12 3a9 9 0 1 0 .6 17.98c1.2-.05 1.8-1.5 1-2.4-.9-1-.25-2.58 1.1-2.58H18a4 4 0 0 0 4-4c0-5-4.5-9-10-9Z", stroke: "currentColor", strokeWidth: "2" }),
          jsx("circle", { cx: "7.8", cy: "10.2", r: "1.1", fill: "currentColor" }),
          jsx("circle", { cx: "11", cy: "7.2", r: "1.1", fill: "currentColor" }),
          jsx("circle", { cx: "15.2", cy: "7.8", r: "1.1", fill: "currentColor" }),
          jsx("circle", { cx: "17.4", cy: "11.4", r: "1.1", fill: "currentColor" })
        ]
      });
    }
    function ThemeIcon({ id }) {
      if (id === "light") {
        return jsx("svg", { viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true", children: [
          jsx("circle", { cx: "12", cy: "12", r: "4", stroke: "currentColor", strokeWidth: "1.6" }),
          jsx("path", { d: "M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round" })
        ] });
      }
      if (id === "dark") {
        return jsx("svg", { viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true", children: jsx("path", { d: "M20 15.2A8.2 8.2 0 0 1 8.8 4a8.2 8.2 0 1 0 11.2 11.2Z", stroke: "currentColor", strokeWidth: "1.6", strokeLinejoin: "round" }) });
      }
      return jsx("svg", { viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true", children: [
        jsx("rect", { x: "3", y: "4", width: "18", height: "13", rx: "2.5", stroke: "currentColor", strokeWidth: "1.6" }),
        jsx("path", { d: "M8 21h8M12 17v4", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round" })
      ] });
    }
    function SidebarAction(props) {
      if (shellTakeover()) return null;
      return jsx(SidebarActionBody, props);
    }
    function SidebarActionBody({ wide, t }) {
      const tr = typeof t === "function" ? (key, params) => t(key, params) : fallbackTranslate;
      const [open, setOpen] = react.useState(false);
      const [activeId, setActiveId] = react.useState(runtime.active);
      const [box, setBox] = react.useState(null);
      const [personalizeId, setPersonalizeId] = react.useState(null);
      const [themePreference, setThemePreference] = react.useState(() => ctx.theme?.getTheme?.().preference ?? "system");
      const buttonRef = react.useRef(null);
      const shellRef = react.useRef(null);
      const shellSizeRef = react.useRef(null);
      if (open && shellRef.current && typeof shellRef.current.getBoundingClientRect === "function") {
        const rect = shellRef.current.getBoundingClientRect();
        shellSizeRef.current = { width: rect.width, height: rect.height };
      }
      react.useEffect(() => {
        if (open) return void 0;
        setPersonalizeId(null);
        return void 0;
      }, [open]);
      const closeShell = () => {
        setOpen(false);
        buttonRef.current?.focus?.();
      };
      const collapsePanel = (skinId) => {
        setPersonalizeId(null);
        try {
          document.getElementById(`${skinId}-gear`)?.focus?.();
        } catch {
        }
      };
      react.useEffect(() => {
        if (!open) return void 0;
        const onPointer = (event) => {
          const node = event.target;
          if (!node || typeof node.closest !== "function") return;
          if (node.closest(".vyra-free-theme-pop, .vyra-free-theme-switcher-wrap")) return;
          closeShell();
        };
        const onKey = (event) => {
          if (event.key === "Escape" && !document.querySelector?.("dialog.vyra-free-theme-pz-dialog[open]")) closeShell();
        };
        document.addEventListener("pointerdown", onPointer, true);
        window.addEventListener("keydown", onKey);
        return () => {
          document.removeEventListener("pointerdown", onPointer, true);
          window.removeEventListener("keydown", onKey);
        };
      }, [open]);
      react.useEffect(() => {
        const onChange = () => setActiveId(runtime.active());
        window.addEventListener("dsh-vyra-free-theme:active-changed", onChange);
        return () => window.removeEventListener("dsh-vyra-free-theme:active-changed", onChange);
      }, []);
      react.useEffect(() => ctx.on("theme/change", (snapshot) => {
        if (snapshot?.preference) setThemePreference(snapshot.preference);
      }), []);
      const openPopover = () => {
        const rect = buttonRef.current?.getBoundingClientRect?.() ?? { left: 12, top: window.innerHeight - 60 };
        setBox({ left: Math.round(rect.left) + 4, bottom: Math.round(window.innerHeight - rect.top + 8) });
        setActiveId(runtime.active());
        setThemePreference(ctx.theme?.getTheme?.().preference ?? "system");
        setOpen(true);
      };
      const themeCards = THEME_CHOICES.map((choice) => jsx("button", {
        type: "button",
        className: `vyra-free-theme-theme-card${themePreference === choice.id ? " vyra-free-theme-theme-card-on" : ""}`,
        "aria-pressed": themePreference === choice.id,
        onClick: () => {
          ctx.theme.setTheme(choice.id);
          setThemePreference(choice.id);
        },
        children: [jsx(ThemeIcon, { id: choice.id }), jsx("span", { children: tr(choice.labelKey) })]
      }, choice.id));
      const choices = [
        {
          id: runtime.officialId,
          label: tr("skins.official.label"),
          description: tr("skins.official.description")
        },
        ...runtime.list()
      ];
      const skinCards = choices.map((skin) => {
        const personalizable = configClient !== null && getSkinSchema(skin.id) !== null;
        const card = jsx("button", {
          type: "button",
          role: "menuitemradio",
          "aria-checked": activeId === skin.id,
          "data-skin-id": skin.id,
          // ADR-0021/R21: stable hook for tests and headless verification — never match on localized labels
          className: `vyra-free-theme-pop-card${activeId === skin.id ? " vyra-free-theme-pop-card-on" : ""}`,
          onClick: () => {
            if (personalizeId !== null && personalizeId !== skin.id) {
              setPersonalizeId(personalizable ? skin.id : null);
            }
            runtime.select(skin.id);
            setActiveId(skin.id);
          },
          children: [
            jsx("span", { className: "vyra-free-theme-pop-card-label", children: skin.label }),
            jsx("span", { className: "vyra-free-theme-pop-card-desc", children: skin.description })
          ]
        }, skin.id);
        if (!personalizable) return card;
        return jsx("div", { className: "vyra-free-theme-pop-card-row", children: [
          card,
          jsx("button", {
            type: "button",
            id: `${skin.id}-gear`,
            className: "vyra-free-theme-pz-gear",
            "aria-label": localeTranslate("personalization.title"),
            title: localeTranslate("personalization.title"),
            "aria-expanded": personalizeId === skin.id,
            onClick: () => {
              if (personalizeId === skin.id) {
                collapsePanel(skin.id);
                return;
              }
              runtime.select(skin.id);
              setActiveId(runtime.active());
              setPersonalizeId(skin.id);
            },
            children: [
              jsx(GearIcon, {})
            ]
          }, `${skin.id}-gear`)
        ] }, skin.id);
      });
      const showPersonalization = personalizeId !== null && PersonalizationPanel !== null;
      const stackedSheet = showPersonalization && typeof window !== "undefined" && window.innerWidth <= 904;
      const shellLeft = box === null ? void 0 : showPersonalization && typeof window !== "undefined" ? Math.max(12, Math.min(box.left, window.innerWidth - 1117)) : typeof window !== "undefined" ? Math.max(16, Math.min(box.left, window.innerWidth - Math.min(390, window.innerWidth - 32) - 16)) : box.left;
      const shellMaxHeight = box === null || typeof window === "undefined" || typeof window.innerHeight !== "number" ? void 0 : stackedSheet ? window.innerHeight - 24 : Math.max(220, window.innerHeight - box.bottom - 12);
      react.useLayoutEffect(() => {
        if (!open || box === null) return void 0;
        const shell = shellRef.current;
        if (!shell) return void 0;
        const size = shellSizeRef.current;
        shellSizeRef.current = null;
        return sweepShellHeight(shell, {
          from: size?.height,
          fromWidth: size?.width,
          maxHeight: shellMaxHeight
        }) ?? void 0;
      }, [open, showPersonalization, personalizeId, shellMaxHeight]);
      const panel = open && box && typeof document !== "undefined" ? reactDom.createPortal(jsx("div", {
        ref: shellRef,
        className: `vyra-free-theme-pop${showPersonalization ? " vyra-free-theme-wide" : ""}`,
        role: "dialog",
        "aria-label": showPersonalization ? localeTranslate("personalization.title") : tr("skins.switch"),
        style: { left: shellLeft, bottom: stackedSheet ? 12 : box.bottom, maxHeight: shellMaxHeight },
        children: [
          jsx("div", { key: "main", className: "vyra-free-theme-pop-main", children: [
            jsx("div", { key: "appearance", className: "vyra-free-theme-pop-title", children: tr("appearance.title") }),
            jsx("div", { key: "grid", className: "vyra-free-theme-theme-grid", children: themeCards }),
            jsx("div", { key: "d1", className: "vyra-free-theme-pop-divider", "aria-hidden": "true" }),
            jsx("div", { key: "skins", className: "vyra-free-theme-pop-title", children: tr("skins.title") }),
            ...skinCards
          ] }),
          showPersonalization ? jsx("div", {
            key: "panel",
            className: "vyra-free-theme-pz-panel",
            role: "region",
            "aria-label": localeTranslate("personalization.panelLabel"),
            children: jsx(PersonalizationPanel, {
              skinId: personalizeId,
              onCollapse: () => collapsePanel(personalizeId)
            })
          }) : null
        ]
      }), document.body) : null;
      return jsx("div", {
        className: `vyra-free-theme-switcher-wrap${wide ? "" : " rail"}`,
        children: [
          jsx("button", {
            ref: buttonRef,
            type: "button",
            className: `vyra-free-theme-switcher-btn${open ? " on" : ""}`,
            "aria-label": tr("skins.switch"),
            "aria-expanded": open,
            title: tr("skins.switch"),
            onClick: () => {
              if (open) closeShell();
              else openPopover();
            },
            children: [jsx(SwitcherIcon, {}), wide ? jsx("span", { children: tr("skins.switch") }) : null]
          }),
          panel
        ]
      });
    }
    ctx.effect(() => {
      const tag = document.createElement("style");
      tag.dataset.plugin = "dsh-vyra-free-theme";
      tag.dataset.pluginCss = TAG_ID;
      tag.textContent = CSS;
      document.head.appendChild(tag);
      return () => tag.remove();
    }, "dsh-vyra-free-theme: sidebar switcher style");
    ctx.effect(() => {
      try {
        return ctx.locale.register(NS, DICTS);
      } catch {
        return () => {
        };
      }
    }, "dsh-vyra-free-theme: sidebar switcher dictionary");
    const shellTakeover = () => {
      try {
        return (ctx.slots.entries?.("sidebar.workspaces") ?? []).some((entry) => (entry.options.priority ?? 0) < 0);
      } catch {
        return false;
      }
    };
    ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
      name: "sidebar.footer.action",
      id: "skins-switcher",
      // Footer order stays at the positive utility seat (4): the bot view is
      // handled by the shell-takeover sentinel below (we render nothing there),
      // so order only sorts the PLAIN harness foot — where the DS Bot entry
      // (-200) belongs ABOVE these utility rows (ruling 2026-10-13: a deep
      // negative order was tried and reverted because it sank the DS Bot entry
      // to the bottom of the harness foot).
      order: 4,
      locale: NS,
      label: () => {
        try {
          const text = ctx.locale?.translate?.(NS, "skins.switch");
          if (typeof text === "string" && text !== "skins.switch") return text;
        } catch {
        }
        return fallbackTranslate("skins.switch");
      }
    }, SidebarAction));
  }

  // src/client/theme-persistence.js
  var THEME_STORAGE_KEY = "dsh-vyra-free-theme:theme-preference";
  var PREFERENCES = /* @__PURE__ */ new Set(["light", "dark", "system"]);
  function installRemoteThemePersistence(ctx) {
    if (ctx.connection?.isLoopback === true) return;
    const theme = ctx.theme;
    if (!theme || typeof theme.getTheme !== "function" || typeof theme.setTheme !== "function") return;
    const persist = (snapshot) => {
      const preference = snapshot?.preference;
      if (!PREFERENCES.has(preference)) return;
      try {
        localStorage.setItem(THEME_STORAGE_KEY, preference);
      } catch {
      }
    };
    ctx.on("theme/change", persist);
    let stored;
    try {
      stored = localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
    }
    if (PREFERENCES.has(stored)) {
      if (theme.getTheme().preference !== stored) theme.setTheme(stored);
    } else {
      persist(theme.getTheme());
    }
  }
  function readLocalThemePreference() {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  // src/client/personalization/config-client.js
  var CHANNEL = "dsh-vyra-free-theme";
  var FETCH_TIMEOUT_MS = 3e3;
  var UPLOAD_TIMEOUT_MS = 12e4;
  var RETRY = /* @__PURE__ */ Symbol("dsh-vyra-free-theme:write-dialect-retry");
  function cloneSkins(skins) {
    return skins === void 0 || skins === null ? {} : structuredClone(skins);
  }
  var FIRST_PAINT_HINT_KEY = "dsh-vyra-free-theme:first-paint-hint";
  var FIRST_PAINT_HINT_MAX_CHARS = 262144;
  var FIRST_PAINT_EXTENSION = /^[a-z0-9]+$/;
  function isPlainObject2(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  function defaultStorage() {
    try {
      return typeof localStorage !== "undefined" ? localStorage : null;
    } catch {
      return null;
    }
  }
  function parseFirstPaintHint(raw) {
    if (typeof raw !== "string" || raw.length > FIRST_PAINT_HINT_MAX_CHARS) return null;
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
    if (!isPlainObject2(data) || data.v !== 1) return null;
    if (!isPlainObject2(data.skins) || !Array.isArray(data.library)) return null;
    const skins = {};
    for (const [skinId, overrides] of Object.entries(data.skins)) {
      if (isPlainObject2(overrides)) skins[skinId] = overrides;
    }
    const library = data.library.filter((entry) => isPlainObject2(entry) && typeof entry.id === "string" && ASSET_ID_PATTERN.test(entry.id) && typeof entry.mime === "string" && typeof entry.extension === "string" && FIRST_PAINT_EXTENSION.test(entry.extension));
    return { skins, library };
  }
  function referencedAssetIds(skins) {
    const ids = /* @__PURE__ */ new Set();
    for (const overrides of Object.values(skins ?? {})) {
      if (!isPlainObject2(overrides)) continue;
      for (const value of Object.values(overrides)) {
        if (typeof value === "string" && ASSET_ID_PATTERN.test(value)) ids.add(value);
      }
    }
    return ids;
  }
  function readFirstPaintHint(storage) {
    if (storage === null || storage === void 0) return null;
    try {
      return parseFirstPaintHint(storage.getItem(FIRST_PAINT_HINT_KEY));
    } catch {
      return null;
    }
  }
  function createConfigClient(options = {}) {
    const fetchImpl = options.fetchImpl ?? (typeof fetch === "function" ? fetch : null);
    const baseUrl = options.baseUrl ?? "/dsh-vyra-free-theme";
    const profile = options.profile === "desktop" ? "desktop" : "web";
    const timeoutMs = options.timeoutMs ?? FETCH_TIMEOUT_MS;
    const uploadTimeoutMs = options.uploadTimeoutMs ?? UPLOAD_TIMEOUT_MS;
    if (typeof fetchImpl !== "function") throw new Error("config client requires a fetch implementation");
    let status = "loading";
    let snapshot = { skins: {}, library: [], references: {}, revision: 0, mode: "normal" };
    let sessionSynced = false;
    const storage = options.storage !== void 0 ? options.storage : defaultStorage();
    const firstPaintHint = readFirstPaintHint(storage);
    const previews = /* @__PURE__ */ new Map();
    const listeners = /* @__PURE__ */ new Set();
    let fetchGeneration = 0;
    let disposed = false;
    let writeChain = Promise.resolve();
    let notices = [];
    let channel = null;
    function setFlushFailure(code, message) {
      notices = notices.filter((notice) => notice.kind === "reverted");
      if (code === "REVISION_CONFLICT") notices.push({ kind: "conflict" });
      else if (message) notices.push({ kind: "error", message });
    }
    function noteReverted(entry) {
      const current = notices.find((notice) => notice.kind === "reverted");
      if (current !== void 0 && current.fields.some((field) => field.skinId === entry.skinId && field.key === entry.key)) return;
      notices = [
        ...notices.filter((notice) => notice.kind !== "reverted"),
        { kind: "reverted", fields: [...current?.fields ?? [], entry] }
      ];
    }
    function emit() {
      for (const listener of [...listeners]) {
        try {
          listener(publicState());
        } catch {
        }
      }
    }
    function publicState() {
      return {
        status,
        revision: snapshot.revision,
        mode: snapshot.mode,
        skins: cloneSkins(snapshot.skins),
        library: snapshot.library,
        references: snapshot.references ?? {},
        recovery: snapshot.recovery,
        quota: snapshot.quota,
        notices: structuredClone(notices),
        dirtyCount: previews.size
      };
    }
    async function request(path, init = {}) {
      const response = await fetchImpl(`${baseUrl}${path}`, {
        ...init,
        signal: init.signal ?? (typeof AbortSignal?.timeout === "function" ? AbortSignal.timeout(timeoutMs) : void 0)
      });
      return response;
    }
    function setStatus(next) {
      if (status === next) return;
      status = next;
      emit();
    }
    function persistFirstPaintHint() {
      if (storage === null || storage === void 0) return;
      try {
        const referenced = referencedAssetIds(snapshot.skins);
        const library = (snapshot.library ?? []).filter((entry) => referenced.has(entry.id));
        const payload = JSON.stringify({ v: 1, skins: snapshot.skins ?? {}, library });
        if (payload.length <= FIRST_PAINT_HINT_MAX_CHARS) {
          storage.setItem(FIRST_PAINT_HINT_KEY, payload);
          return;
        }
      } catch {
      }
      try {
        storage.removeItem(FIRST_PAINT_HINT_KEY);
      } catch {
      }
    }
    async function refetch() {
      if (disposed) return publicState();
      const generation = ++fetchGeneration;
      const contextAtStart = options.contextActive?.();
      try {
        const response = await request("/config");
        if (disposed || generation !== fetchGeneration) return publicState();
        if (contextAtStart !== void 0 && options.contextActive?.() !== contextAtStart) {
          void refetch();
          return publicState();
        }
        if (response.status === 404 || response.status === 501) {
          setStatus("offline-failed");
          return publicState();
        }
        if (!response.ok) {
          setStatus("offline-failed");
          return publicState();
        }
        const body = await response.json();
        if (disposed || generation !== fetchGeneration) return publicState();
        if (contextAtStart !== void 0 && options.contextActive?.() !== contextAtStart) {
          void refetch();
          return publicState();
        }
        if (body?.mode === "unsupported") {
          snapshot = { ...body, references: {} };
          sessionSynced = true;
          setStatus("unsupported-readonly");
          emit();
          return publicState();
        }
        if (body?.mode === "recovery") {
          snapshot = { ...body };
          sessionSynced = true;
          setStatus("synced");
          emit();
          return publicState();
        }
        snapshot = { ...body };
        sessionSynced = true;
        persistFirstPaintHint();
        setStatus("synced");
        emit();
        return publicState();
      } catch {
        if (!disposed) setStatus("offline-failed");
        return publicState();
      }
    }
    const FLUSH_DEBOUNCE_MS = 400;
    let flushTimer = null;
    function writeGate() {
      if (status === "synced") {
        return snapshot.mode === "recovery" ? "recovery" : null;
      }
      if (status === "loading") return "loading";
      if (status === "unsupported-readonly") return "unsupported";
      return "offline";
    }
    function scheduleFlush() {
      if (flushTimer !== null) clearTimeout(flushTimer);
      flushTimer = setTimeout(() => {
        flushTimer = null;
        void flushNow();
      }, FLUSH_DEBOUNCE_MS);
    }
    function runWriteOp(operations, policy) {
      writeChain = writeChain.then(async () => {
        try {
          if (disposed) return policy.disposed();
          const blocked = writeGate();
          if (blocked !== null) return policy.gated(blocked);
          const attemptedRevision = snapshot.revision;
          for (let attempt = 0; attempt < 2; attempt += 1) {
            let response;
            try {
              response = await request("/config", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ baseRevision: snapshot.revision, operations: operations() })
              });
            } catch (error) {
              return policy.offline(error);
            }
            if (disposed) return policy.disposedMidflight();
            if (response.status === 409) {
              const conflictBody = await response.json().catch(() => null);
              const code = conflictBody?.code;
              const errorMessage = conflictBody?.error ?? "HTTP 409";
              if (code === "STORE_READONLY") {
                setFlushFailure(null, null);
                setStatus("unsupported-readonly");
                return policy.readOnly(conflictBody);
              }
              if (code === "REVISION_CONFLICT") {
                const decision2 = await policy.onConflict({ attempt, attemptedRevision, errorMessage });
                if (decision2 === RETRY) continue;
                return decision2;
              }
              if (code === "STORE_RECOVERY_REQUIRED") {
                const decision2 = await policy.onRecoveryRequired(errorMessage);
                if (decision2 === RETRY) {
                  throw new Error("[dsh-vyra-free-theme] onRecoveryRequired must resolve, never RETRY");
                }
                return decision2;
              }
              const decision = await policy.onUnknown409({ attempt, errorMessage });
              if (decision === RETRY) continue;
              return decision;
            }
            if (!response.ok) return await policy.onError(response);
            const result = await policy.onSuccess(response);
            await refetch();
            announce();
            return result;
          }
          return policy.exhausted();
        } catch (error) {
          return policy.chainError(error);
        }
      });
      return writeChain;
    }
    function flushNow() {
      if (flushTimer !== null) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      if (previews.size === 0) return Promise.resolve({ flushed: 0 });
      const intent = [...previews.entries()];
      const buildOperations = () => intent.map(([composite, value]) => {
        const [skinId, key] = composite.split(" ");
        return value === null ? { op: "delete", skinId, key } : { op: "set", skinId, key, value };
      });
      const count = buildOperations().length;
      return runWriteOp(buildOperations, {
        disposed: () => ({ flushed: 0, blocked: "disposed" }),
        disposedMidflight: () => ({ flushed: 0 }),
        gated: (blocked) => ({ flushed: 0, blocked }),
        offline: (error) => {
          throw error;
        },
        readOnly: (conflictBody) => ({ flushed: 0, blocked: "conflict", errorMessage: conflictBody?.error ?? "" }),
        // ADR-0003: retry once only after a conflict refetch has actually
        // applied a newer normal-mode snapshot.
        onConflict: async ({ attempt, attemptedRevision }) => {
          if (attempt === 1) {
            setFlushFailure("REVISION_CONFLICT", null);
            emit();
            return { flushed: 0, blocked: "conflict" };
          }
          const refreshed = await refetch();
          const mayRetry = refreshed.status === "synced" && refreshed.mode === "normal" && refreshed.revision !== attemptedRevision;
          if (mayRetry) return RETRY;
          if (refreshed.mode === "recovery") {
            setFlushFailure(null, null);
            emit();
            return { flushed: 0, blocked: "recovery" };
          }
          if (refreshed.status === "offline-failed") {
            setFlushFailure(null, null);
            emit();
            return { flushed: 0, blocked: "offline" };
          }
          if (refreshed.status === "unsupported-readonly") {
            setFlushFailure(null, null);
            emit();
            return { flushed: 0, blocked: "unsupported" };
          }
          setFlushFailure("REVISION_CONFLICT", null);
          emit();
          return { flushed: 0, blocked: "conflict" };
        },
        onRecoveryRequired: async (errorMessage) => {
          const refreshed = await refetch();
          if (refreshed.mode === "recovery") {
            setFlushFailure(null, null);
            emit();
            return { flushed: 0, blocked: "recovery" };
          }
          setFlushFailure(null, errorMessage);
          emit();
          return { flushed: 0, blocked: "error", errorMessage };
        },
        onUnknown409: ({ errorMessage }) => {
          setFlushFailure(null, errorMessage);
          emit();
          return { flushed: 0, blocked: "error", errorMessage };
        },
        onError: async (response) => {
          const errorBody = await response.json().catch(() => null);
          const errorMessage = errorBody?.error ?? `HTTP ${response.status}`;
          const issues = Array.isArray(errorBody?.params?.issues) ? errorBody.params.issues : null;
          let excised = false;
          let onlyDangling = issues !== null && issues.length > 0;
          if (issues !== null) {
            for (const issue of issues) {
              const dangling = issue.code === "MISSING_ASSET" || issue.code === "BAD_ASSET";
              if (!dangling) onlyDangling = false;
              if (dangling && typeof issue.skinId === "string" && typeof issue.key === "string") {
                const composite = `${issue.skinId} ${issue.key}`;
                if (previews.has(composite)) {
                  previews.delete(composite);
                  excised = true;
                  noteReverted({ skinId: issue.skinId, key: issue.key });
                }
              }
            }
          }
          const healed = onlyDangling && excised;
          setFlushFailure(null, healed ? null : errorMessage);
          emit();
          if (excised && previews.size > 0) void flushNow();
          if (healed) return { flushed: 0, blocked: null, selfHealed: true };
          return { flushed: 0, blocked: "error", errorMessage };
        },
        onSuccess: async (response) => {
          await response.json().catch(() => null);
          for (const [composite, value] of intent) {
            if (previews.get(composite) === value) previews.delete(composite);
          }
          setFlushFailure(null, null);
          notices = [];
          return { flushed: count };
        },
        exhausted: () => ({ flushed: 0, blocked: "conflict" }),
        chainError: () => {
          setFlushFailure(null, null);
          emit();
          return { flushed: 0, blocked: "error" };
        }
      });
    }
    function announce() {
      try {
        if (typeof window !== "undefined" && typeof CustomEvent === "function") {
          window.dispatchEvent(new CustomEvent("dsh-vyra-free-theme:config-changed"));
        }
      } catch {
      }
      try {
        if (channel === null && typeof BroadcastChannel === "function") channel = new BroadcastChannel(CHANNEL);
        channel?.postMessage({ kind: "config-changed" });
      } catch {
      }
    }
    function preview(skinId, key, value) {
      const composite = `${skinId} ${key}`;
      const storedOverride = snapshot.skins[skinId]?.[key];
      const previewed = previews.get(composite);
      if (isSameOverrideValue(value, defaultsFor(skinId, profile)[key])) {
        if (storedOverride === void 0 && previewed === void 0) return;
        if (previewed === null) return;
        return previewReset(skinId, key);
      }
      if (effectiveOverrides(skinId)[key] === value) return;
      previews.set(composite, value);
      setFlushFailure(null, null);
      scheduleFlush();
      emit();
    }
    function previewReset(skinId, key) {
      previews.set(`${skinId} ${key}`, null);
      setFlushFailure(null, null);
      scheduleFlush();
      emit();
    }
    function effectiveOverrides(skinId) {
      const base = sessionSynced ? snapshot.skins[skinId] : firstPaintHint?.skins[skinId];
      const merged = cloneSkins(base ?? {});
      for (const [composite, value] of previews) {
        const [owner, key] = composite.split(" ");
        if (owner !== skinId) continue;
        if (value === null) delete merged[key];
        else merged[key] = value;
      }
      return merged;
    }
    function findLibraryEntry(id) {
      const library = sessionSynced ? snapshot.library ?? [] : firstPaintHint?.library ?? [];
      return library.find((entry) => entry.id === id) ?? null;
    }
    async function assetFingerprint(bytes) {
      if (typeof crypto?.subtle?.digest !== "function") return null;
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    function attemptUpload(bytes, file, displayName) {
      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const timer = controller === null ? null : setTimeout(() => controller.abort(), uploadTimeoutMs);
      return request("/library", {
        method: "POST",
        signal: controller === null ? void 0 : controller.signal,
        headers: {
          "content-type": typeof file?.type === "string" && file.type !== "" ? file.type : "application/octet-stream",
          "x-filename": encodeURIComponent(displayName ?? file?.name ?? "wallpaper")
        },
        body: bytes
      }).finally(() => {
        if (timer !== null) clearTimeout(timer);
      });
    }
    async function interpretAttempt(response, networkError) {
      if (networkError !== void 0) {
        const timedOut = networkError?.name === "TimeoutError" || networkError?.name === "AbortError";
        return timedOut ? { error: "UPLOAD_TIMEOUT" } : null;
      }
      if (response.ok) return { kind: "ok", response };
      const body = await response.json().catch(() => null);
      if (body?.code) return { error: body.code };
      if (response.status === 413) return { error: "UPLOAD_TOO_LARGE" };
      if (response.status === 400) return null;
      return { error: `HTTP ${response.status}` };
    }
    async function uploadImage(file, displayName) {
      const blocked = writeGate();
      if (blocked !== null) return { error: blocked };
      const bytes = file instanceof Uint8Array ? file : new Uint8Array(await file.arrayBuffer());
      let networkError;
      let response;
      try {
        response = await attemptUpload(bytes, file, displayName);
      } catch (error) {
        networkError = error;
      }
      let outcome = await interpretAttempt(response, networkError);
      if (outcome !== null) return concludeUpload(outcome);
      await refetch();
      const fingerprint = await assetFingerprint(bytes);
      const stored = snapshot.library.find((a) => fingerprint !== null ? a.sha256 === fingerprint : a.byteLength === bytes.length && a.displayName === (displayName ?? file?.name ?? "wallpaper"));
      if (stored) return { asset: stored };
      await new Promise((resolve) => setTimeout(resolve, 400));
      try {
        response = await attemptUpload(bytes, file, displayName);
      } catch {
        return { error: "UPLOAD_FAILED" };
      }
      outcome = await interpretAttempt(response, void 0);
      if (outcome === null || outcome.kind !== "ok") {
        return outcome?.error !== void 0 ? { error: outcome.error } : { error: "UPLOAD_FAILED" };
      }
      return concludeUpload(outcome);
    }
    async function concludeUpload(outcome) {
      if (outcome.error !== void 0) return { error: outcome.error };
      const body = await outcome.response.json();
      if (body?.asset?.id !== void 0) {
        snapshot = {
          ...snapshot,
          revision: typeof body.revision === "number" ? body.revision : snapshot.revision,
          library: [...snapshot.library, body.asset],
          quota: {
            count: (snapshot.quota?.count ?? 0) + 1,
            totalBytes: (snapshot.quota?.totalBytes ?? 0) + (body.asset.byteLength ?? 0)
          }
        };
        emit();
      }
      announce();
      return { asset: body.asset };
    }
    function runGalleryOp(operations, goalAchieved) {
      const conflictDisposition = async ({ attempt }) => {
        await refetch();
        if (goalAchieved()) return { affectedSkins: [] };
        if (attempt === 1) {
          setFlushFailure(null, null);
          emit();
          return { error: "REVISION_CONFLICT" };
        }
        return RETRY;
      };
      return runWriteOp(() => operations, {
        disposed: () => ({ error: "disposed" }),
        disposedMidflight: () => ({ error: "disposed" }),
        gated: (blocked) => ({ error: blocked }),
        offline: () => ({ error: "OFFLINE" }),
        readOnly: () => ({ error: "conflict" }),
        onConflict: conflictDisposition,
        // ADR-0018 alignment: the recovery code is dispatched BY NAME now —
        // never folded into the blind conflict retry. Code passthrough: the
        // Host-stable code reaches the caller unsuppressed (host-errors.js
        // resolves it), after one refetch so the recovery banner can land.
        onRecoveryRequired: async () => {
          await refetch();
          return { error: "STORE_RECOVERY_REQUIRED" };
        },
        onUnknown409: conflictDisposition,
        // unknown 409s keep the goal-first read
        onError: async (response) => {
          const body = await response.json().catch(() => null);
          if (body?.code === "INVALID_CONFIG" && body.params?.issues?.some((issue) => issue.code === "ASSET_NOT_FOUND")) {
            await refetch();
            if (goalAchieved()) return { affectedSkins: [] };
            return { error: "ASSET_NOT_FOUND" };
          }
          return { error: body?.code ?? `HTTP ${response.status}` };
        },
        onSuccess: async (response) => {
          const body = await response.json().catch(() => null);
          return { affectedSkins: body?.affectedSkins ?? [], revision: body?.revision };
        },
        exhausted: () => ({ error: "REVISION_CONFLICT" }),
        chainError: (error) => {
          throw error;
        }
      });
    }
    async function deleteImage(id) {
      const blocked = writeGate();
      if (blocked !== null) return { error: blocked };
      return runGalleryOp(
        [{ op: "deleteAsset", assetId: id }],
        () => !snapshot.library.some((entry) => entry.id === id)
      );
    }
    function clearLibrary() {
      return runGalleryOp([{ op: "clearLibrary" }], () => snapshot.library.length === 0);
    }
    function valuedPreviews() {
      const fields = [];
      for (const [composite, value] of previews) {
        if (value === null) continue;
        const [skinId, key] = composite.split(" ");
        fields.push({ skinId, key, value });
      }
      return fields;
    }
    function referencesFor(assetId) {
      const persisted = (snapshot.references?.[assetId] ?? []).map((entry) => ({ skinId: entry.skinId, key: entry.key, layer: "persisted" }));
      const preview2 = valuedPreviews().filter((entry) => entry.value === assetId).map((entry) => ({ skinId: entry.skinId, key: entry.key, layer: "preview" }));
      return [...persisted, ...preview2];
    }
    async function confirmRecovery() {
      const response = await request("/recovery", { method: "POST" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        return { error: body?.code ?? `HTTP ${response.status}` };
      }
      await refetch();
      return { ok: true };
    }
    function assetUrl(meta) {
      if (meta === null || meta === void 0 || typeof meta.id !== "string") return null;
      return `${baseUrl}/assets/${meta.id}.${meta.extension}`;
    }
    const api = {
      boot: refetch,
      refetch,
      flushNow,
      preview,
      previewReset,
      effectiveOverrides,
      findLibraryEntry,
      uploadImage,
      deleteImage,
      clearLibrary,
      referencesFor,
      confirmRecovery,
      assetUrl,
      getState: publicState,
      canWrite: () => writeGate() === null,
      onStateChange(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      dispose() {
        disposed = true;
        if (flushTimer !== null) clearTimeout(flushTimer);
        fetchGeneration += 1;
        try {
          channel?.close();
        } catch {
        }
        try {
          if (typeof window !== "undefined") window.removeEventListener("focus", onFocus);
        } catch {
        }
        listeners.clear();
      }
    };
    function onCrossTabMessage(event) {
      if (event?.data?.kind === "config-changed") refetch();
    }
    function onFocus() {
      refetch();
    }
    try {
      if (typeof BroadcastChannel === "function") {
        channel = new BroadcastChannel(CHANNEL);
        channel.onmessage = onCrossTabMessage;
        if (typeof channel.unref === "function") channel.unref();
      }
    } catch {
    }
    try {
      if (typeof window !== "undefined") window.addEventListener("focus", onFocus);
    } catch {
    }
    return api;
  }

  // src/shared/personalization/theme-model.js
  var TRANSLUCENT_TOKENS = [
    "--dsw-alias-bg-base",
    "--dsw-alias-bg-layer-1",
    "--dsw-alias-bg-layer-2",
    "--dsw-alias-bg-layer-3",
    "--dsw-alias-bg-module-platform",
    "--dsw-specific-sidebar-fill"
  ];
  var NAME_MAX = 60;
  var SLOGAN_MAX = 40;
  function bodyAttributeFor(id) {
    return `vft${id.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("")}`;
  }
  var THEME_ASSET_BASE = "/dsh-vyra-free-theme/theme";
  var THEME_ASSET_MIME = Object.freeze({
    ".webp": "image/webp",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".avif": "image/avif",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".js": "text/plain; charset=utf-8"
  });
  function mimeForAssetPath(path) {
    if (typeof path !== "string") return null;
    const match = /\.[a-z0-9]+$/i.exec(path);
    return match === null ? null : THEME_ASSET_MIME[match[0].toLowerCase()] ?? null;
  }
  function themeAssetUrl(themeId, path) {
    const encoded = String(path).split("/").map(encodeURIComponent).join("/");
    return `${THEME_ASSET_BASE}/${themeId}/${encoded}`;
  }
  function builtinAssetsFromTheme(theme) {
    const wallpaper = theme.wallpaper;
    if (wallpaper === null || wallpaper.kind !== "image") return {};
    const light = wallpaper.light;
    const dark = wallpaper.dark;
    if (light === null && dark === null) return {};
    const primary = light ?? dark;
    const mime = mimeForAssetPath(primary.src);
    if (mime === null) return {};
    const asset = { url: themeAssetUrl(theme.id, primary.src), mime };
    if (dark !== null && dark !== primary) {
      const darkMime = mimeForAssetPath(dark.src);
      if (darkMime !== null) {
        asset.darkUrl = themeAssetUrl(theme.id, dark.src);
        asset.darkMime = darkMime;
      }
    }
    return { art: asset };
  }
  function wallpaperLayersFromTheme(theme) {
    const wallpaper = theme.wallpaper;
    if (wallpaper === null) return [];
    if (wallpaper.kind === "video") {
      const side = (value) => value === null ? null : {
        src: themeAssetUrl(theme.id, value.src),
        poster: value.poster ? themeAssetUrl(theme.id, value.poster) : null
      };
      return [{ kind: "video", light: side(wallpaper.light), dark: side(wallpaper.dark) }];
    }
    if (wallpaper.kind === "code") {
      return [{ kind: "code", entry: themeAssetUrl(theme.id, wallpaper.entry) }];
    }
    return [];
  }
  function wallpaperField(theme) {
    const hasArt = theme.wallpaper !== null && theme.wallpaper.kind === "image";
    return {
      key: "wallpaper",
      type: "image",
      scope: "single",
      labelKey: "personalization.wallpaper",
      default: hasArt ? `builtin:${theme.id}:art` : null,
      allowedUserMime: USER_IMAGE_MIMES,
      maxBytes: GLOBAL_MAX_BYTES,
      maxWidth: 16384,
      maxHeight: 16384,
      maxPixels: GLOBAL_MAX_PIXELS,
      builtinChoices: hasArt ? ["art"] : []
    };
  }
  function fieldsFromTheme(theme, profile = "web") {
    const opacity = profile === "desktop" ? theme.translucency.desktop : theme.translucency.web;
    return [
      wallpaperField(theme),
      /*
       * Brand name. The theme declares a default; the panel lets the user
       * replace it. Scope `locale` because the host writes both a zh and an en
       * document title, and one language's brand should not leak into the
       * other's tab.
       *
       * `default` is what the theme itself ships, so clearing the input falls
       * back to the theme's own name rather than to an empty window title.
       */
      {
        key: "brandTitle",
        type: "text",
        scope: "locale",
        labelKey: "personalization.brandTitle",
        maxLength: NAME_MAX,
        default: theme.brand.title ?? theme.name
      },
      {
        key: "slogan",
        type: "text",
        scope: "locale",
        labelKey: "personalization.slogan",
        maxLength: SLOGAN_MAX,
        default: theme.brand.slogans
      },
      {
        key: "panelOpacity",
        type: "range",
        scope: "single",
        labelKey: "personalization.panelTranslucency",
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
        default: opacity
      }
    ];
  }
  function hexToRgb(hex) {
    return `${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}`;
  }
  function tableFromTheme(theme, profile = "web") {
    const riding = {};
    const constantTokens = {};
    const anchor = profile === "desktop" ? theme.translucency.desktop : theme.translucency.web;
    for (const token of Object.keys(theme.colors.light)) {
      if (TRANSLUCENT_TOKENS.includes(token)) {
        const baked = theme.translucency.baked[token] ?? anchor;
        riding[token] = {
          light: [hexToRgb(theme.colors.light[token]), baked],
          dark: [hexToRgb(theme.colors.dark[token]), baked]
        };
      } else {
        constantTokens[token] = { light: theme.colors.light[token], dark: theme.colors.dark[token] };
      }
    }
    for (const [token, value] of Object.entries(theme.shape)) {
      constantTokens[token] = { light: value, dark: value };
    }
    const baseLight = hexToRgb(theme.colors.light["--dsw-alias-bg-base"]);
    const baseDark = hexToRgb(theme.colors.dark["--dsw-alias-bg-base"]);
    return {
      bodyAttribute: bodyAttributeFor(theme.id),
      titleBrand: theme.brand.title?.zh ?? theme.name.zh,
      favicon: theme.brand.favicon,
      anchor,
      riding,
      constantTokens: Object.keys(constantTokens).length > 0 ? constantTokens : null,
      // A two-stop base-tone gradient: the same projection branch compiled-in
      // skins use for their artwork, so "no wallpaper asset yet" renders the
      // theme's base tone at the slider's alpha instead of nothing at all.
      scrim: {
        kind: "baked-gradient",
        stops: {
          light: [[baseLight, anchor], [baseLight, anchor]],
          dark: [[baseDark, anchor], [baseDark, anchor]]
        },
        artLayer: ""
      },
      blur: { max: 12 },
      glassVar: "--vft-glass-blur",
      desktopBlur: { rate: 55, dark: "boost" },
      wallpaper: { kind: "assets" },
      layers: wallpaperLayersFromTheme(theme),
      sidebar: resolveSidebar(theme),
      coverage: theme.coverage,
      staticCss: ""
    };
  }

  // src/client/skins/translucency.js
  function glassRule(bodyAttribute, glassVar) {
    const attr = bodyAttribute.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
    return `body[data-${attr}] [id="root"]{backdrop-filter:blur(var(${glassVar},0px))}`;
  }
  function createProjection(table) {
    const { anchor, riding, scrim, blur, glassVar, desktopBlur, wallpaper } = table;
    return function project(values, assets) {
      const P = values.panelOpacity;
      const pct = (points) => (points / 100).toFixed(2);
      const pt = (baked) => Math.min(100, Math.max(0, P + baked - anchor));
      const alpha = (rgb, baked, floor = 0) => `rgba(${rgb}, ${pct(Math.max(pt(baked), floor))})`;
      const tokenOverrides = { ...table.constantTokens ?? {} };
      for (const [key, modes] of Object.entries(riding)) {
        tokenOverrides[key] = {
          light: alpha(modes.light[0], modes.light[1], modes.light[2] ?? 0),
          dark: alpha(modes.dark[0], modes.dark[1], modes.dark[2] ?? 0)
        };
      }
      let imageLight;
      let imageDark;
      let overlayLight = null;
      let overlayDark = null;
      if (scrim.kind === "overlay") {
        const t = Math.min(1, Math.max(0, P / 100));
        const s = (Math.round(scrim.coefficient * t * t) / 100).toFixed(3);
        overlayLight = `linear-gradient(rgba(${scrim.light}, ${s}) 0%, rgba(${scrim.light}, ${s}) 100%)`;
        overlayDark = `linear-gradient(rgba(${scrim.dark}, ${s}) 0%, rgba(${scrim.dark}, ${s}) 100%)`;
        const url = assets?.wallpaper?.url ?? null;
        imageLight = url === null ? null : `url("${url}")`;
        imageDark = url === null ? null : `url("${url}")`;
      } else {
        const scrimLight = `linear-gradient(${alpha(scrim.stops.light[0][0], scrim.stops.light[0][1])} 0%, ${alpha(scrim.stops.light[1][0], scrim.stops.light[1][1])} 100%)` + scrim.artLayer;
        const scrimDark = `linear-gradient(${alpha(scrim.stops.dark[0][0], scrim.stops.dark[0][1])} 0%, ${alpha(scrim.stops.dark[1][0], scrim.stops.dark[1][1])} 100%)` + scrim.artLayer;
        if (wallpaper.kind === "legacy-baked") {
          const url = assets?.wallpaper?.url ?? null;
          const custom = typeof values.wallpaper === "string" && values.wallpaper !== wallpaper.sentinel && resolveImageRef(values.wallpaper)?.kind === "user" && url !== null;
          imageLight = custom ? `url("${url}")` : scrim.artLayer === "" ? wallpaper.placeholder?.light ?? scrimLight : scrimLight;
          imageDark = custom ? `url("${url}")` : scrim.artLayer === "" ? wallpaper.placeholder?.dark ?? scrimDark : scrimDark;
        } else {
          const url = assets?.wallpaper?.url ?? null;
          const darkUrl = assets?.wallpaper?.darkUrl ?? null;
          imageLight = url === null ? scrimLight : `url("${url}")`;
          imageDark = darkUrl !== null ? `url("${darkUrl}")` : url === null ? scrimDark : `url("${url}")`;
        }
      }
      const blurPx = Math.round(blur.max * Math.max(0, (P - anchor) / (100 - anchor)) ** 2);
      const boosted = Math.min(24, blurPx + P / desktopBlur.rate);
      const desktopBlurPair = desktopBlur.dark === "none" ? { light: boosted, dark: blurPx } : { light: boosted, dark: boosted };
      const brandFallback = typeof table.titleBrand === "string" ? table.titleBrand : "";
      const brandOverride = values.brandTitle;
      let brandResolved;
      if (typeof brandOverride === "string") {
        brandResolved = brandOverride || brandFallback;
      } else if (typeof brandOverride === "object" && brandOverride !== null && !Array.isArray(brandOverride)) {
        const zh = typeof brandOverride.zh === "string" ? brandOverride.zh : "";
        const en = typeof brandOverride.en === "string" ? brandOverride.en : "";
        brandResolved = zh || en || brandFallback;
      } else {
        brandResolved = brandFallback;
      }
      if (typeof brandResolved !== "string") brandResolved = brandFallback;
      return {
        bodyAttribute: table.bodyAttribute,
        slogans: values.slogan,
        titleBrand: brandResolved,
        favicon: table.favicon,
        backdrop: {
          imageLight,
          imageDark,
          overlayLight,
          overlayDark,
          blur: blurPx,
          desktopBlur: desktopBlurPair,
          // Element-backed layers (video / code art). A user- or catalog-chosen
          // image replaces them: the image channel is the override, exactly as a
          // built-in skin's gallery pick replaces its own art.
          layers: values.wallpaper == null && Array.isArray(table.layers) && table.layers.length > 0 ? table.layers : null
        },
        // Sidebar pack resolved from the theme's own palette (spec §7). Compiled-in
        // skins leave it undefined → no sidebar rules beyond the fill token.
        sidebar: table.sidebar ?? null,
        // Shell coverage (spec §6.2): a file-backed theme may opt the chrome in.
        // Compiled-in themes leave it undefined → normalizeEffects emits null.
        coverage: table.coverage ?? null,
        tokenOverrides,
        cssVariables: blurPx > 0 ? { [glassVar]: { light: `${blurPx}px`, dark: `${blurPx}px` } } : null,
        staticCss: blurPx > 0 ? table.staticCss + "\n" + glassRule(table.bodyAttribute, glassVar) : table.staticCss,
        decorations: null
      };
    };
  }

  // src/client/themes.js
  var THEMES_ROUTE = "/dsh-vyra-free-theme/themes";
  function themeAssetUrl2(id, path) {
    return `${THEME_ASSET_BASE}/${id}/${String(path).split("/").map(encodeURIComponent).join("/")}`;
  }
  function brandComponents(theme, jsx) {
    const title = theme.brand.title?.zh ?? theme.name.zh;
    const mode = theme.brand.heroMark ?? "auto";
    const markPath = theme.brand.mark;
    const Mark = () => {
      if (mode === "none") {
        return jsx("span", { "data-vft-hero-mark": "none", "aria-hidden": "true", style: { display: "none" } });
      }
      if (mode === "text") {
        return jsx("span", {
          "data-vft-hero-mark": "text",
          style: { fontSize: "0.86em", fontWeight: 600, letterSpacing: "0.14em", opacity: 0.9, whiteSpace: "nowrap" }
        }, title);
      }
      if ((mode === "auto" || mode === "image") && typeof markPath === "string" && mimeForAssetPath(markPath) !== null) {
        return jsx("img", {
          "data-vft-hero-mark": "image",
          src: themeAssetUrl2(theme.id, markPath),
          alt: "",
          style: { maxHeight: "52px", maxWidth: "220px", objectFit: "contain" }
        });
      }
      return jsx("svg", {
        "data-vft-hero-mark": "ring",
        width: 18,
        height: 18,
        viewBox: "0 0 18 18",
        "aria-hidden": "true",
        focusable: "false"
      }, jsx("circle", { cx: 9, cy: 9, r: 6.5, fill: "none", stroke: "currentColor", strokeWidth: 1.6 }));
    };
    const Name = () => jsx("span", { className: "vft-brand-name" }, title);
    return { Mark, Name };
  }
  async function installFileThemes({ runtime, jsx, profile, fetchImpl = fetch }) {
    const response = await fetchImpl(THEMES_ROUTE, { cache: "no-store" });
    if (!response.ok) throw new Error(`themes route answered HTTP ${response.status}`);
    const payload = await response.json();
    const entries = Array.isArray(payload?.themes) ? payload.themes : [];
    const problems = Array.isArray(payload?.problems) ? payload.problems : [];
    const known = new Set(runtime.list().map((skin) => skin.id));
    const installed = [];
    for (const entry of entries) {
      const theme = entry?.theme;
      if (!theme || typeof theme.id !== "string") continue;
      if (known.has(theme.id)) {
        installed.push(theme.id);
        continue;
      }
      try {
        const { Mark, Name } = brandComponents(theme, jsx);
        const builtinAssets = builtinAssetsFromTheme(theme);
        registerExternalSkin({ id: theme.id, fields: fieldsFromTheme(theme, profile), builtinAssets });
        runtime.register({
          id: theme.id,
          label: theme.name,
          description: theme.brand.slogans.zh ? theme.brand.slogans : theme.name,
          Mark,
          Name,
          project: createProjection(tableFromTheme(theme, profile)),
          builtinAssets
        });
        installed.push(theme.id);
      } catch (error) {
        problems.push({ source: entry?.source ?? "user", id: theme.id, issues: [{ code: "register-failed", path: "theme.json", message: String(error.message ?? error) }] });
      }
    }
    return { installed, problems };
  }

  // src/client/selection-sync.js
  var SELECTION_ROUTE = "/dsh-vyra-free-theme/selection";
  var ACTIVE_EVENT2 = "dsh-vyra-free-theme:active-changed";
  async function adoptHostSelection({ runtime, fetchImpl = fetch }) {
    try {
      const response = await fetchImpl(SELECTION_ROUTE, { cache: "no-store" });
      if (!response.ok) return { adopted: null };
      const body = await response.json();
      if (typeof body?.skinId !== "string") return { adopted: null };
      if (runtime.active() === body.skinId) return { adopted: body.skinId, changed: false };
      runtime.select(body.skinId);
      return { adopted: body.skinId, changed: true };
    } catch {
      return { adopted: null };
    }
  }
  function publishSelection({ fetchImpl = fetch, target = window } = {}) {
    if (typeof target?.addEventListener !== "function") return () => {
    };
    const listener = (event) => {
      const skinId = event?.detail;
      if (typeof skinId !== "string" || skinId.length === 0) return;
      try {
        fetchImpl(SELECTION_ROUTE, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ skinId })
        }).catch(() => {
        });
      } catch {
      }
    };
    target.addEventListener(ACTIVE_EVENT2, listener);
    return () => target.removeEventListener(ACTIVE_EVENT2, listener);
  }

  // src/client/builtin-assets.js
  var SEGMENT_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
  function builtinAssetUrl(skinId, assetKey, extension = "webp") {
    if (typeof skinId !== "string" || !SEGMENT_PATTERN.test(skinId)) {
      throw new RangeError(`builtinAssetUrl: invalid skinId ${JSON.stringify(skinId)}`);
    }
    if (typeof assetKey !== "string" || !SEGMENT_PATTERN.test(assetKey)) {
      throw new RangeError(`builtinAssetUrl: invalid assetKey ${JSON.stringify(assetKey)}`);
    }
    if (typeof extension !== "string" || !/^[a-z0-9]+$/.test(extension)) {
      throw new RangeError(`builtinAssetUrl: invalid extension ${JSON.stringify(extension)}`);
    }
    const rev = "0.1.0";
    return `/dsh-vyra-free-theme/assets/b_${skinId}_${assetKey}.${extension}?v=${rev}`;
  }

  // src/client/skins/meirenzhi/wallpapers.js
  var WALLPAPER_YUNTAI = builtinAssetUrl("meirenzhi", "yuntai");
  var WALLPAPER_MUPEILING = builtinAssetUrl("meirenzhi", "mupeiling");
  var WALLPAPER_ZILING = builtinAssetUrl("meirenzhi", "ziling");
  var WALLPAPER_NANGONGWAN = builtinAssetUrl("meirenzhi", "nangongwan");
  var WALLPAPER_NANGONGQUE = builtinAssetUrl("meirenzhi", "nangongque");
  var WALLPAPER_YINYUE = builtinAssetUrl("meirenzhi", "yinyue");

  // src/client/skins/decoration.js
  var BUBBLE_HOOKS = {
    chat: { exact: null, container: "userStack" },
    goal: { exact: "oRe1gG_bubble", container: "_stack" },
    bubbleLocal: "_bubble"
  };
  var unionSelector = (hook) => hook.exact === null ? `[class*="${hook.container}"] > [class*="${BUBBLE_HOOKS.bubbleLocal}"]` : `:is([class*="${hook.exact}"], [class*="${hook.container}"] > [class*="${BUBBLE_HOOKS.bubbleLocal}"])`;
  var BUBBLE_SELECTORS = {
    chat: unionSelector(BUBBLE_HOOKS.chat),
    goal: unionSelector(BUBBLE_HOOKS.goal)
  };
  function decorationCss(scope, palette) {
    const chat = BUBBLE_SELECTORS.chat;
    const goal = BUBBLE_SELECTORS.goal;
    return [
      `${scope} ${chat}{border:1px solid rgba(${palette.light}, 0.38);box-shadow:0 1px 4px rgba(${palette.light}, 0.10)}`,
      `${scope}[data-ds-dark-theme] ${chat}{border-color:rgba(${palette.dark}, 0.38);box-shadow:0 1px 6px rgba(${palette.dark}, 0.10)}`,
      `${scope} ${goal}{border:1px solid rgba(${palette.light}, 0.38);box-shadow:0 1px 4px rgba(${palette.light}, 0.10)}`,
      `${scope}[data-ds-dark-theme] ${goal}{border-color:rgba(${palette.dark}, 0.38);box-shadow:0 1px 6px rgba(${palette.dark}, 0.10)}`
    ].join("\n");
  }
  function rootClear(scope) {
    return `${scope} [id="root"]{background:0 0}`;
  }
  function badgeCss(scope, className, colors, metrics) {
    return [
      `${scope} ${className}{display:inline-flex;align-items:center;background:${colors.light.bg};border-radius:4px;padding:0 5px;font-size:10px;line-height:${metrics.lineHeight};font-weight:${metrics.fontWeight};letter-spacing:.08em;color:${colors.light.fg}}`,
      `${scope}[data-ds-dark-theme] ${className}{background:${colors.dark.bg};color:${colors.dark.fg}}`
    ].join("\n");
  }
  function streamingCss(scope, palette) {
    const KEYFRAMES = "vyra-free-theme-stream-pulse";
    return [
      `${scope} [data-streaming]{border-radius:4px;box-shadow:inset 3px 0 0 var(--dsw-alias-brand-primary)}`,
      `@keyframes ${KEYFRAMES}{from{box-shadow:inset 3px 0 0 var(--dsw-alias-brand-primary)}to{box-shadow:inset 3px 0 0 rgba(${palette.decay}, 0.20)}}`,
      `@media (prefers-reduced-motion: no-preference){${scope} [data-streaming]{animation:${KEYFRAMES} 1.6s ease-in-out infinite alternate}}`
    ].join("\n");
  }

  // src/client/skins/frost-family.js
  function frostFamilyCss(scope, tints) {
    const { frost, menu } = tints;
    return `/* 浮层毛玻璃家族（配方与选择器并集的唯一来源；裁决与修订史见 ADR-0007，单点生成见 ADR-0012）
   * 宿主 Modal（设置页各弹窗、风险确认）、dsh-m / dsh-vyra-free-theme / dsh-context 等
   * 插件弹层、dockkit 悬浮窗壳与宿主对话框兜底、下拉菜单面、右栏内嵌卡与
   * 提示卡的统一配方：86% 不透明皮肤底色 + blur(14px) saturate(1.3) 提饱和
   * （.lc-tip 经主人两轮实测定 96% 特例浓度），下层内容被盖住只余柔光；
   * --dsw-mask-blur 点亮官方默认 none 的遮罩模糊，弹窗四周一并磨砂。
   * 浮层族全部为固定值，不随通透度旋钮联动。遮罩/对话框由宿主 CSS modules
   * 渲染、类名不可测 → role/aria 属性定位；.dshm-* / .dsvm-* / .lc-* /
   * .vyra-free-theme-pop 为各插件自有稳定类名；结构钩子 _float_ / _dialog_ 由
   * verify-upstream-hooks 钉住。1.5.1 豁免（ADR-0007 amendment）：dsh-m 截图
   * 灯箱 .dsvm-lightbox 根同带 role/aria 语义，浅色 tint 会把影院式黑遮罩染
   * 成浅毛玻璃、白色控件整体隐形（用户双模式实拍）——影院遮罩归 dsh-m 自有
   * 不变量（0.9.62 起 background !important 自持），此处 :not 双保险、语义
   * 归位。1.5.26 增补（ADR-0007 amendment）：非模态 dialog 钩子
   * [role="dialog"]:not([aria-modal="true"]):not(.dsvm-lightbox)——
   * better-sidebar 锚定浮层（Git 提交图悬停卡、行上下文菜单）与其悬浮窗
   * 壳、chat 用量统计面板、conversation 用量浮卡全部 portal 到 body 的
   * fixed 浮层，底色吃半透 bg-layer/menu token 且自带 0 blur；官方 token
   * 值不透明故官方皮肤无症状，皮肤半透后透字（Git 悬停卡主人实拍
   * 2026-11-03）。2026-11-03 对已装插件与宿主 client 逐面排查：该钩子
   * 命中面全为浮层、无误染；灯箱本带 aria-modal，:not 三重保险仅属
   * 与 v1 钩子同构的 belt。 */
  ${scope} { --dsw-menu-surface-fill: rgba(${menu.light}, 0.94); --dsw-alias-menu-group-header-fill: rgba(${menu.light}, 0.94); --dsw-specific-menu: rgba(${menu.light}, 0.94); }
  ${scope}[data-ds-dark-theme] { --dsw-menu-surface-fill: rgba(${menu.dark}, 0.94); --dsw-alias-menu-group-header-fill: rgba(${menu.dark}, 0.94); --dsw-specific-menu: rgba(${menu.dark}, 0.94); }
  ${scope} { --dsw-mask-blur: blur(10px); }
  ${scope} [role="dialog"][aria-modal="true"]:not(.dsvm-lightbox),
  ${scope} [role="dialog"]:not([aria-modal="true"]):not(.dsvm-lightbox),
  ${scope} .dshm-panel,
  ${scope} .dshm-compat-dialog,
  ${scope} .dshm-dshchip-tip,
  ${scope} .vyra-free-theme-pop {
    background: color-mix(in srgb, rgb(${frost.light}) 86%, transparent);
    backdrop-filter: blur(14px) saturate(1.3);
    -webkit-backdrop-filter: blur(14px) saturate(1.3);
  }
  ${scope}[data-ds-dark-theme] [role="dialog"][aria-modal="true"]:not(.dsvm-lightbox),
  ${scope}[data-ds-dark-theme] [role="dialog"]:not([aria-modal="true"]):not(.dsvm-lightbox),
  ${scope}[data-ds-dark-theme] .dshm-panel,
  ${scope}[data-ds-dark-theme] .dshm-compat-dialog,
  ${scope}[data-ds-dark-theme] .dshm-dshchip-tip,
  ${scope}[data-ds-dark-theme] .vyra-free-theme-pop {
    background: color-mix(in srgb, rgb(${frost.dark}) 86%, transparent);
  }
  ${scope} .dshm-overlay,
  ${scope} .dsvm-overlay,
  ${scope} .lc-ov-backdrop,
  ${scope} .lc-modal-backdrop {
    backdrop-filter: var(--dsw-mask-blur, blur(10px));
    -webkit-backdrop-filter: var(--dsw-mask-blur, blur(10px));
  }
  ${scope} [class*="_float_"],
  ${scope} [class*="_dialog_"],
  ${scope} .dsvm-filterpop,
  ${scope} .dsvm-modalbox,
  ${scope} .dsvm-chipswrap {
    background: color-mix(in srgb, rgb(${frost.light}) 86%, transparent);
    backdrop-filter: blur(14px) saturate(1.3);
    -webkit-backdrop-filter: blur(14px) saturate(1.3);
  }
  ${scope}[data-ds-dark-theme] [class*="_float_"],
  ${scope}[data-ds-dark-theme] [class*="_dialog_"],
  ${scope}[data-ds-dark-theme] .dsvm-filterpop,
  ${scope}[data-ds-dark-theme] .dsvm-modalbox,
  ${scope}[data-ds-dark-theme] .dsvm-chipswrap {
    background: color-mix(in srgb, rgb(${frost.dark}) 86%, transparent);
  }
  ${scope} .lc-ov-card,
  ${scope} .lc-modal-card,
  ${scope} .lc-card,
  ${scope} .lc-settings-card {
    background: color-mix(in srgb, rgb(${frost.light}) 86%, transparent);
    backdrop-filter: blur(14px) saturate(1.3);
    -webkit-backdrop-filter: blur(14px) saturate(1.3);
  }
  ${scope}[data-ds-dark-theme] .lc-ov-card,
  ${scope}[data-ds-dark-theme] .lc-modal-card,
  ${scope}[data-ds-dark-theme] .lc-card,
  ${scope}[data-ds-dark-theme] .lc-settings-card {
    background: color-mix(in srgb, rgb(${frost.dark}) 86%, transparent);
  }
  ${scope} .lc-card:has(.group\\/tip:hover) {
    position: relative;
    z-index: 10;
  }
  ${scope} .lc-tip {
    background: color-mix(in srgb, rgb(${frost.light}) 96%, transparent);
    backdrop-filter: blur(14px) saturate(1.3);
    -webkit-backdrop-filter: blur(14px) saturate(1.3);
  }
  ${scope}[data-ds-dark-theme] .lc-tip {
    background: color-mix(in srgb, rgb(${frost.dark}) 96%, transparent);
  }`;
  }

  // src/client/skins/define-skin.js
  var FONT_TOKENS = {
    text: "--dsh-font-family-text-default",
    code: "--dsh-font-family-code-default"
  };
  var REQUIRED = [
    "id",
    "label",
    "description",
    "titleBrand",
    "favicon",
    "anchor",
    "bodyAttribute",
    "riding",
    "fonts",
    "scrim",
    "blur",
    "glassVar",
    "desktopBlur",
    "wallpaper",
    "tints",
    "cssSegments",
    "Mark",
    "Name"
  ];
  var OPTIONAL = ["constantTokens", "builtinAssets", "backgroundArt", "decoration", "streaming", "badge"];
  var KNOWN_KEYS = /* @__PURE__ */ new Set([...REQUIRED, ...OPTIONAL]);
  var SEGMENT_NAMES = /* @__PURE__ */ new Set(["badge", "decoration", "streaming", "rootclear", "frost"]);
  var BARE_IDENTIFIER = /^[a-z][a-z0-9-]*$/;
  var kebabAttr = (bodyAttribute) => bodyAttribute.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  var scopeOf = (bodyAttribute) => `body[data-${kebabAttr(bodyAttribute)}]`;
  var FLOOR_ALLOWED_KEYS = /* @__PURE__ */ new Set(["--dsw-specific-sidebar-fill", "--dsw-specific-input-major"]);
  var FLOOR_CAP_KEYS = /* @__PURE__ */ new Set(["--dsw-specific-sidebar-fill"]);
  function validateRiding(riding) {
    if (riding === null || typeof riding !== "object" || Array.isArray(riding)) {
      throw new Error("riding must be an object keyed by token");
    }
    for (const [key, modes] of Object.entries(riding)) {
      for (const mode of ["light", "dark"]) {
        const entry = modes?.[mode];
        if (!Array.isArray(entry) || entry.length < 2 || entry.length > 3) {
          throw new Error(`riding "${key}" ${mode}: entry must be [rgb, baked] or [rgb, baked, floor]`);
        }
        if (typeof entry[0] !== "string" || entry[0].trim() === "") {
          throw new Error(`riding "${key}" ${mode}: rgb must be a non-empty string`);
        }
        const baked = entry[1];
        if (typeof baked !== "number" || !Number.isInteger(baked) || baked < 0 || baked > 100) {
          throw new Error(`riding "${key}" ${mode}: baked must be an integer 0-100`);
        }
        if (entry.length === 3) {
          if (!FLOOR_ALLOWED_KEYS.has(key)) {
            throw new Error(`riding "${key}": floor (third element) is only allowed on --dsw-specific-sidebar-fill / --dsw-specific-input-major (ADR-0027 D1)`);
          }
          const floor = entry[2];
          if (typeof floor !== "number" || !Number.isInteger(floor) || floor < 0 || floor > 100) {
            throw new Error(`riding "${key}" ${mode}: floor must be an integer 0-100`);
          }
          if (FLOOR_CAP_KEYS.has(key) && floor > baked + 25) {
            throw new Error(`riding "${key}" ${mode}: floor ${floor} exceeds baked+25 cap (${baked + 25}) (ADR-0027 D2)`);
          }
        }
      }
    }
  }
  function needSegmentParam(param, name) {
    if (param === void 0 || param === null) {
      throw new Error(`Missing segment param: ${name}`);
    }
    return param;
  }
  function expandSegment(item, spec, scope) {
    if (!SEGMENT_NAMES.has(item)) {
      if (BARE_IDENTIFIER.test(item)) throw new Error(`Unknown segment: ${item}`);
      return item;
    }
    switch (item) {
      case "badge": {
        const badge = needSegmentParam(spec.badge, item);
        return badgeCss(scope, badge.selector, badge.colors, badge.metrics);
      }
      case "decoration":
        return decorationCss(scope, needSegmentParam(spec.decoration, item));
      case "streaming":
        return streamingCss(scope, needSegmentParam(spec.streaming, item));
      case "rootclear":
        return rootClear(scope);
      case "frost":
        return frostFamilyCss(scope, needSegmentParam(spec.tints, item));
      default:
        throw new Error(`Unknown segment: ${item}`);
    }
  }
  function buildScrim(spec) {
    if (spec.scrim.kind === "overlay") return { ...spec.scrim };
    const artLayer = spec.backgroundArt ? `, url(${spec.backgroundArt.url})` : "";
    return { ...spec.scrim, artLayer };
  }
  function buildWallpaper(spec) {
    const wallpaper = { ...spec.wallpaper };
    if (wallpaper.kind === "legacy-baked" && spec.backgroundArt) {
      wallpaper.sentinel = `builtin:${spec.id}:art`;
    }
    return wallpaper;
  }
  function deriveFonts(fonts) {
    if (fonts === null || typeof fonts !== "object" || Array.isArray(fonts)) {
      throw new Error("fonts must be an object keyed by font slot");
    }
    const derived = {};
    for (const [slot, value] of Object.entries(fonts)) {
      if (!Object.hasOwn(FONT_TOKENS, slot)) throw new Error(`Unknown font slot: ${slot}`);
      const bad = `font slot "${slot}": value must be null, a non-empty string, or { light, dark }`;
      if (value === null) continue;
      if (typeof value === "string") {
        if (value === "") throw new Error(bad);
        derived[FONT_TOKENS[slot]] = { light: value, dark: value };
        continue;
      }
      const keys = typeof value === "object" && !Array.isArray(value) ? Object.keys(value) : [];
      if (keys.length !== 2 || !keys.includes("light") || !keys.includes("dark") || typeof value.light !== "string" || value.light === "" || typeof value.dark !== "string" || value.dark === "") {
        throw new Error(bad);
      }
      derived[FONT_TOKENS[slot]] = { light: value.light, dark: value.dark };
    }
    return derived;
  }
  function defineSkin(spec) {
    for (const key of Object.keys(spec)) {
      if (!KNOWN_KEYS.has(key)) throw new Error(`Unknown spec key: ${key}`);
    }
    for (const key of REQUIRED) {
      if (spec[key] === void 0) throw new Error(`Missing required spec field: ${key}`);
    }
    validateRiding(spec.riding);
    const scope = scopeOf(spec.bodyAttribute);
    if (!Array.isArray(spec.cssSegments)) throw new Error("cssSegments must be an array");
    const staticCss = spec.cssSegments.map((item) => {
      if (typeof item !== "string") throw new Error(`Invalid segment item: ${typeof item}`);
      return expandSegment(item, spec, scope);
    }).join("");
    const builtinAssets = Object.assign(
      {},
      spec.backgroundArt ? { art: { mime: spec.backgroundArt.mime, url: spec.backgroundArt.url } } : {},
      spec.builtinAssets ?? {}
    );
    const fontTokens = deriveFonts(spec.fonts);
    const constantBase = spec.constantTokens ?? {};
    const constantTokens = Object.keys(fontTokens).length > 0 || Object.keys(constantBase).length > 0 ? { ...constantBase, ...fontTokens } : null;
    const table = {
      bodyAttribute: spec.bodyAttribute,
      titleBrand: spec.titleBrand,
      favicon: spec.favicon,
      anchor: spec.anchor,
      riding: spec.riding,
      constantTokens,
      scrim: buildScrim(spec),
      blur: spec.blur,
      glassVar: spec.glassVar,
      desktopBlur: { rate: spec.desktopBlur.rate ?? 55, dark: spec.desktopBlur.dark },
      wallpaper: buildWallpaper(spec),
      staticCss
    };
    return {
      id: spec.id,
      label: spec.label,
      description: spec.description,
      Mark: spec.Mark,
      Name: spec.Name,
      project: createProjection(table),
      builtinAssets
    };
  }

  // src/client/skins/meirenzhi/index.js
  var SCOPE = "body[data-dsh-meirenzhi-skin]";
  var MARK_URL = "data:image/webp;base64,UklGRqgNAABXRUJQVlA4WAoAAAAQAAAAXwAAXwAAQUxQSPUDAAABoHZtmyFJln8HGmvbtm3b+Gbbtm3btm3btneM1bAi4llv9hsZERPAf/cx8PfoaeXogcnnmWfu8SC2UHAwxwEPDJX07flz4FzLuAjrP9DRv444GlyreMcCL0hK+W8lSbfSqgFOTMpZ/3GsDiS0h4dbpKz/nMu7LeLhaXX0vwfNSWgJB3ero/9dNHBWfDtEzlNHDXZ0HrEVIhsqqcmkm9rB0fOtSkO7t0PkCCU1PA++Dej+VqWp+VpilqSGk7YjtsJ8ajrrZXwrzNppSkVrEttgyhGNZb2KbwM+LLkhZR1AV32RjdSYspanqzoCR6s0VfTNxMTq8GzdKQ0p660eYnUOhmtsKo0o6WVHrI3AfpJUGlHSK1PQVRuO5XfY9U2VRpT09Rx0ucrwAMcpN6Ks3zeHWBkhdjlOUG5ERTqpixDqApznJeVGpKKP14DoKyOw8NjSkJJ0xzwQfV10cZRyQypF+ZIZIPqqHL39VBqSsjTivKmgy1VEF4cpNSZlafi500H09TgmHKg+TdLQIyeH6GohcrFSX0hJGnb6VBBrCSypPk/S8KPHxYU6gA9V+khK0rfbQZerInKeUp9JSXp1IYg1BDZSNqCSlE6eBOftOab6XTaL1H8b6DIHfKhiQkrS4zMQvLXA7UpGpKTh20EwFjnKkLJ0Qy/BVmAdZTtSR29FginPorLd0VPgbc1RbCnpAZwz5JhmhDF1dATR1Lj9VGwpaTWipZ7vzRX9NC7OUO+P5pR0AtEM8LE9lZEz4c14XlY2l3QG0dBTFRR914OzErivAmWtR7Bzh5K9pOvtRK6rQRo4Hs7MpXVoCYKZs6pI2pZo5rhKTjK0UyUXmQmsq1zFZYaWUo1Jl5rxzF3JJWYc04yo43RD7jOVGg4wg+d5ZXtZ6xCsRK5VsqfOLHg7B1dQ9FXEWQmsoGIu6T4CVh1T/q4KjiaawfGasrWs9Qh2IqcpWUs6mW47nsWLzJexq9NtBs9rytakX+YjmAlsVEFRv8XxVvA8o2xNWf26cFYCq1RQ8sBx7RC4TsnaWJ1KxKxn4p9VbHX0PDg7RDZQNtXRm+PisRzZU8lQR2+PT8B2ZE/lYqWjJ7uJWA/sKiUTpegmCNiPrPGdlPouSYdBoMbIBOdLyn2U9OMyeEedERa/IUspN1eyHp6CLqp1ERa6YYSkknIjSToWIjWHCDPu/vCvklT+V5Y+WQMXqNwHYOrVD3tmpP5nKSonBqKjfh89wKQPKv+HkqS7F4VIS7oQIzONLP9SsvTmGhAdbdrNFUp/K1n6ZAcIgXb1zD86SylLn+/mIdK6ji/19/e2CBBp4cAOw0b1u3YDIDpa2THZzBMA0dHWHogB2wBWUDggjAkAALAkAJ0BKmAAYAA+TR6LRCKhoRh+TLQoBMSgCFiGlfM+ZPYO3bGbsDepXbX88V6Sd5h3n2uqvvHgv3+/csie436lPs+En4magXrDwGdhtZn0Avar7LxDfXDoc7zD7N/oPYA/nf9f/4f3AfHv/qf6H8yvZx9G/+b/N/AN/Lv61/yP8B7Uv//9wv7UeyD+sAx8FmpO+3a3JzsHA+l04d6+6aN1gy87tPxhcOjxultTnrN2cS3u0OJ8XjQ16a/TfXNi6gzkzo6QTA7tIibmU3GUX9D+gPIJJaHj+vLMezRWsWus5msSxWdJLnAHqdccnKCtxvV+Yu9kswCFzOLS8xcs1NRLFmfDzHwEr/dbzKz/kB0KJUO2y6iJfB2wUDoOk4DfdyQNirUV/cRb/8t99K7AAP77KfozPJGx5Q4+pcnuhz51qg5EcU9PrxBcAZ0/YUM+KQKNzuboi0lREzQdb5wZA2LyAMZ/0plhAEPtDZ38BbQGtfp5CUT5kv5nDq9bnVy35P8UmNQ4N9bgjDq1SQOaeDUz5wFXIZkARw6LRVBQYZhP+2sq641nceNKR5OQZbiCzIntVNcWMg1mvJYepq5/izQ4hnTrv03E4KWYkfcGynBGtZaOIGklVSnAJbpMVbDVGn19gYlShYHVD3q+Q75/Jjo0+1ONrMnnwYqb5xxoMlmqEKP5rE6tMO2DNMcs9MTjoEK4Grmr22EwBEAwqRcrXfcqEyjvtsIqz/Nf7tbNAWhkeAaZB9CsGwWt0zqdvn2DIfNJvoJJugkp6FH5Da2TZcFckLhqLLsbTuKK7VouXnjv+vLD3qFaf8zcA4mMEtMFPhHcNp24Qj2cENgNXbiG2Q9WdIwfb/n1NbIJPB5PbZ9C3/kKH8DGB1M8567IuTWTDRVqXHLQpVo+obHEgBMeA3HYxaOWe5BOz6Mk/LQbJn9aHXWp+paDJw26a4SIs4ux3n9gP1KN2qc38TjwLaOD82ibIcTe+jKZsZO4Y6rRkLscPRILCx+4LR+/C5Of45sdn/HFPO9FcxZ0eBniDomglILS2bozcZ18+RoUGBBwodp2PMCtlrs0L/ciaGH4VhGlsglZzRDnlo0eAvI+mDzH5OnzUG0GeP53Prnc0UXwH/QnXuMG7jCf1Lp4fooLI3sDevCxo+XNbzynXP2yvIg+VMb/4Zz//h1jBtWL/v2XP+Z34n+05n/e/4nDZ4eQHnS5SzsuWz3DpKwU8S4QkOhPw89ZBHr8vyzD8777iOGbxEd1oVhdyk2shldrCIGCm/Ue9IcAEV++sf+1kjJpQTiFkaaU1ygRnbdHFZz5OJXkpiHl+YkUgtpKM9Np9Gghc4RWfkrAl7b7tFvD++JOYvUyc9cwPYMrxDMTyH7m2E43607liLpf5wKOejRacRYWoj+dDas97icMprqrF9RgC+bfqUyIatfY3M2PIKIhysIq9kjRabfRjAJOdf04Lu7YW8Aqlbf7R+agBldCrqs8u97TPRvpgCobgqVEC0N9cZOgdUSATue4tdZlSUi2p8rogfktvsNN9OZtAzKAtYKr/HvnQUY85+/kLIDE6/B7ahAvwuNXfYeqJg+kr+3ej9l0laJtWXNxz2TVQ5Zi7otb4Uc6N84Tvd1smqegBb5Td/qqR48OlFELgacAqZ6FisBwGYhVVSve9cwNGi8pbncUjDYq8S5/YR4Tszoq5wUsx1GhEbSV9oEnn83+ObhaPso5tjmq7yZDM6vDeBvxGf/yx3Gudg9UrqNI5v7YJ2TdId5DBtSXnXS+h1XFWWKMRxYfXHHa3A/tIgskRJ8w90Ei7hYynL+7g/0iO537mBjTXqWrt8t+kNLjn9I2SRwZs5zcQRVzO+uBsYmqbBFQ8jrR46S4l/PZkRzwYe9w0P/IlMIuXD4bk25aRcaW1jhutOeYJICeUy1XCKm7wUv3XLKHX3iD8MR02uepp9ZX3S/dWryNxx4qcnECJGP/oN8pYj0aKaWiYOiBu8sXX0F7ijmJBg7ATyYoGem5d16iU5PohWTk/wSA3M35SeV1ADNrBQ5IVSO4JcB3PItBpPdBoRrI8Om8FYcXVmkGuU9A3uTkFfQjbAZQiNwmhz6aoGYUIZRTo7ghwX9a/axNXpqg9VGdMgvoDUQsocIq8HU7ORW/zS72JNCxRlsu/cYhLB4eP9FOCcNB9hfRtJcgf2pkrjmm/x85zO4bOO+xJ+6/sjdDl16G1OuEinx2NLCipJA/3Bdd4rHPpUaxjLvdq+c1//8Ips4Mh2uf5WneOFh2NljtuXCo2wfsIytLwj5jS35B/2Oz5O6ANIyrpbIP6EGDAbTCYyq1ggFf9U2mHppOZVczEP3F61+h3kWF2NTngUxCYAotVazubY2VBD8gkKuiVvn2ocouI59JxPHO7wN0J2zBLfPSyMIv/BXpvQI9DOpqq90ZtpBSo7X2AhKGnoUG6faCGqHDQupXzVWR3vT4+KD3cIGIwQ7yeHOn99DCAtae+tDBr51voAaREsId8UjRX58L++IaK0e2AsIoIjmjvtOAUjHRt9Y4zE1cMpBDdoMyJI4ZpB5rfcoJ/nzMc99Sz1udYJyiNNzSE7DSxeVnn/mzxd7lgZGhU6XF1sfFnPgbOkZV3Q10Ri81FQNh/NKXcaTIOpBPaRfQ3zW21B9TReZT8sgfm+8L8o/kOyt4/DxAh1jOc4/hB9aLDmsvKL8elXkbpWB9JLen35pCFZ8vAsR/gLTnyh3YYbKLjzZqmai8LfMiJTX2+oYSkJNFTJ9L721XzoRcoue38LrwxM7TXttgH/UmmZB/491XuDAjJ/qRKXcBU0iX7udU89Bd7C46ab117yp4E31E4sUoJsXoHAV3U41HA6xWoRMaAxqCGVFdPOxaO2EeuEO34wb8GhZFRZObxsIWe4HBNNjMhPaRkma/1yHHx8x0NsDFfXkZ7d4GwvfiAeZbNfsNz6gOYRfsfyMSnThFeU/AOdNB1uOHx/JChnK8dtxkwzZ7q+vND4PMn51KUR7cQvyOzdVUXeYNwP8GfvKNRocp/+HYytgpnYyaUS1fC/iS4jGoAQCjbmcTgJZ3p1f9sZlPm2epmgNIMcNOmffzxgjBo4bU2t4yNSFx2mU5HalgVLqLS4/cbR3DHrmKs7Hsbg+ofxAy9pPjDuor4SBKokWeXiyWa/Q6bCCoJGY1WBu25ku4YPyEjEvBxnK7/XwrSqHED7QDlG6Tw+BS3rlty9ZP/K1X49wcLMjIOgIWNNpelEe/TfSW9s0BKgAA";
  var SPEC = {
    id: "meirenzhi",
    label: { zh: "凡人修仙传 · 美人志", en: "Mortal's Journey · Beauty Chronicle" },
    description: {
      zh: "云鬓花颜 · 霞衣夜月 · 凡尘问道",
      en: "Moonlit silks · crimson & gold · mortal path"
    },
    titleBrand: "美人志",
    favicon: { href: MARK_URL, mime: "image/webp" },
    anchor: 35,
    bodyAttribute: "dshMeirenzhiSkin",
    riding: {
      "--dsw-alias-bg-base": { light: ["250, 249, 246", 35], dark: ["18, 18, 26", 35] },
      "--dsw-specific-sidebar-fill": { light: ["250, 249, 246", 40, 65], dark: ["18, 18, 26", 52, 52] },
      "--dsw-alias-bg-module-platform": { light: ["250, 249, 246", 35], dark: ["18, 18, 26", 40] },
      "--dsw-specific-input-major": { light: ["250, 249, 246", 40, 85], dark: ["18, 18, 26", 45, 85] }
    },
    constantTokens: {
      // 文字地板（ADR-0027 Task 6）：muted 次级字暗化至门禁 4.5（常量通道，B3 裁决；dark 维持宿主默认=达标）
      // muted 次级字（ADR-0027 Task 6/B3 token 通道）
      "--dsw-alias-label-tertiary": { light: "#666970", dark: "#adb2b8" },
      // 常量族：品牌绯红 × 鎏金、浮层「较实」、控件态、导航态（设计定案 §视觉系统）。
      // 用户气泡（产品主人裁决，参照 openbmc/uefi 双 token 结构）：浅色态=品牌
      // 绯红轻透纱（深字，融进暖雾白面板）；深色态=玄夜面板族较实底（亮字）。
      // 不再用饱和红实底，避免会话区色彩疲劳。
      "--dsw-alias-brand-primary": { light: "#B8433F", dark: "#E58A80" },
      "--dsw-alias-brand-text": { light: "#A87B2F", dark: "#D9B45C" },
      "--dsw-alias-button-primary-fill": { light: "#B8433F", dark: "#E58A80" },
      "--dsw-alias-button-primary-hover": { light: "#A87B2F", dark: "#D9B45C" },
      "--dsw-alias-bg-overlay": { light: "rgba(252, 250, 246, 0.85)", dark: "rgba(24, 24, 34, 0.88)" },
      "--dsw-alias-interactive-bg-hover": { light: "rgba(184, 67, 63, 0.08)", dark: "rgba(229, 138, 128, 0.14)" },
      "--dsw-alias-interactive-bg-active": { light: "rgba(184, 67, 63, 0.14)", dark: "rgba(229, 138, 128, 0.20)" },
      "--dsw-specific-sidebar-nav-item-hover": { light: "rgba(250, 249, 246, 0.6)", dark: "rgba(28, 28, 40, 0.6)" },
      "--dsw-specific-sidebar-nav-item-active": { light: "rgba(250, 249, 246, 0.9)", dark: "rgba(28, 28, 40, 0.9)" },
      "--dsw-specific-bubble": { light: "rgba(184, 67, 63, 0.10)", dark: "rgba(24, 24, 34, 0.90)" },
      "--dsw-specific-bubble-highlight": { light: "rgba(184, 67, 63, 0.18)", dark: "rgba(40, 40, 56, 0.92)" }
    },
    // 字体槽位（ADR-0025）：宿主跟随。
    fonts: { text: null, code: null },
    scrim: { kind: "overlay", coefficient: 30, light: "252, 250, 246", dark: "16, 16, 26" },
    blur: { max: 12 },
    glassVar: "--dsh-mrz-glass-blur",
    desktopBlur: { dark: "boost" },
    wallpaper: { kind: "assets" },
    builtinAssets: {
      yuntai: { mime: "image/webp", url: WALLPAPER_YUNTAI },
      mupeiling: { mime: "image/webp", url: WALLPAPER_MUPEILING },
      ziling: { mime: "image/webp", url: WALLPAPER_ZILING },
      nangongwan: { mime: "image/webp", url: WALLPAPER_NANGONGWAN },
      nangongque: { mime: "image/webp", url: WALLPAPER_NANGONGQUE },
      yinyue: { mime: "image/webp", url: WALLPAPER_YINYUE }
    },
    // 反色徽章（official HARNESS 反色语言，tgcf badge 同构）：规则唯一来源在
    // ../decoration.js（ADR-0016）；#12121A/#FAF9F6 与面板底色族同源。
    badge: {
      selector: ".dsh-mrz-badge",
      colors: { light: { bg: "#12121A", fg: "#FAF9F6" }, dark: { bg: "#FAF9F6", fg: "#12121A" } },
      metrics: { lineHeight: "16px", fontWeight: 600 }
    },
    // 用户+目标气泡描边（ADR-0006 并集挂接谱系，goal v1.0.4 扩入）：规则唯一
    // 来源在 ../decoration.js（ADR-0016），本皮肤只持描边色。
    decoration: { light: "184, 67, 63", dark: "229, 138, 128" },
    // 流式呼吸光条（ADR-0016 视觉窗口，本皮新增）：品牌令牌骨架 + 鎏金衰减
    // rgba(217, 180, 92, 0.20)（Q10 主人裁定例外，与萤火虫同源色）。
    streaming: { decay: "217, 180, 92" },
    // 浮层毛玻璃家族 tint（ADR-0012）：menu 与 frost 同值（暖雾白/玄夜），
    // 仍写两组、不靠巧合省略。家族配方与选择器并集住在 frost-family.js。
    tints: {
      frost: { light: "250, 249, 246", dark: "18, 18, 26" },
      menu: { light: "250, 249, 246", dark: "18, 18, 26" }
    },
    // 段序＝现状 CSS 数组序（ADR-0019 机制 a：段间字节由 "\n" 裸串项自持，
    // 工厂恒等拼接）。Ambient motion：慢速辉光呼吸骑在 runtime 的壁纸
    // ::before 层 + 两只漂移萤火虫走 #root 伪元素预算（与 tgcf 蝴蝶同形同
    // 价）；prefers-reduced-motion 全灭。
    cssSegments: [
      "badge",
      "\n",
      "decoration",
      "\n",
      "rootclear",
      "\n",
      "streaming",
      "\n",
      `@keyframes dsh-mrz-breathe{0%,100%{opacity:.94}50%{opacity:1}}`,
      "\n",
      `${SCOPE}::before{animation:dsh-mrz-breathe 26s ease-in-out infinite}`,
      "\n",
      `@keyframes dsh-mrz-drift-a{0%{transform:translate(0,0)}50%{transform:translate(42px,-34px)}100%{transform:translate(0,0)}}`,
      "\n",
      `@keyframes dsh-mrz-drift-b{0%{transform:translate(0,0)}50%{transform:translate(-46px,28px)}100%{transform:translate(0,0)}}`,
      "\n",
      `${SCOPE} #root::before{content:"";position:fixed;left:13%;top:19%;width:9px;height:9px;z-index:-1;background:radial-gradient(circle, rgba(217,180,92,.95) 0%, rgba(217,180,92,0) 70%);opacity:.16;animation:dsh-mrz-drift-a 38s ease-in-out infinite;pointer-events:none}`,
      "\n",
      `${SCOPE} #root::after{content:"";position:fixed;right:17%;bottom:23%;width:14px;height:14px;z-index:-1;background:radial-gradient(circle, rgba(250,249,246,.9) 0%, rgba(250,249,246,0) 70%);opacity:.12;animation:dsh-mrz-drift-b 47s ease-in-out infinite;pointer-events:none}`,
      "\n",
      `@media (prefers-reduced-motion:reduce){${SCOPE}::before,${SCOPE} #root::before,${SCOPE} #root::after{animation:none}}`,
      "\n",
      "frost",
      // 文字地板段（ADR-0027 新增裸串段；既有段零字节；Task 6/B2 终版=占位字形定点规则+实体面边框）：
      // 占位字形 = [data-composer-placeholder]（DraftEditor 兄弟元素，B1 实证），caption 全局 token 不动（B2 主人裁定）
      // 以下段首注释为段内自述：
      // （稳定属性锚 + :has 卡片锚；color/opacity 覆盖，content 不动）与实体面 1.4.11
      // 常量边框（对壁纸 p95 ≥3:1 反解：light rgb(110,113,120) ≤124 灰界、dark rgb(196,199,206) ≥192 灰界）。
      '\n  /* ---------- ADR-0027 text floor (Task 6/B2 终版)：占位字形定点规则 + 实体面边框 ----------\n     * 占位字形 = [data-composer-placeholder]（DraftEditor 兄弟元素，实施评审 B1 实证）；\n     * caption 为全局 token（宿主 38 文件 75 处骑跨，B2）——主人裁定走定点规则不动全局。 ---------- */\n  body[data-dsh-meirenzhi-skin]:not([data-ds-dark-theme]) [data-composer-placeholder]{color:rgb(102, 105, 112)!important;}\n  body[data-dsh-meirenzhi-skin][data-ds-dark-theme] [data-composer-placeholder]{color:rgb(173, 178, 184)!important;}\n  body[data-dsh-meirenzhi-skin]:not([data-ds-dark-theme]) [class*="_card"]:has([data-composer-input="true"]){border:1px solid rgb(110, 113, 120);}\n  body[data-dsh-meirenzhi-skin][data-ds-dark-theme] [class*="_card"]:has([data-composer-input="true"]){border:1px solid rgb(196, 199, 206);}\n  body[data-dsh-meirenzhi-skin][data-ds-dark-theme] .dsh-mrz-name{background-image:linear-gradient(120deg,#A87B2F,#D9B45C 45%,#B8433F)!important;}\n'
    ]
  };
  function createMeirenzhiSkin(jsxRuntime) {
    const { jsx } = jsxRuntime;
    function MeiRenZhiMark({ size = 24, className }) {
      return jsx("img", {
        src: MARK_URL,
        alt: "",
        width: size,
        height: size,
        className,
        style: { display: "block", borderRadius: "2px", filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.30))" },
        "aria-hidden": "true"
      });
    }
    function MeiRenZhiName() {
      return jsx("span", {
        style: {
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          fontWeight: 700,
          letterSpacing: "0.02em",
          whiteSpace: "nowrap"
        },
        children: [
          jsx("span", {
            className: "dsh-mrz-name",
            style: {
              // ADR-0027 Task 7：亮色止色暗化（门禁反解帽 L≤0.1706：#8C6228 0.1465 / #8C682D 0.157）；
              // 深色态由 cssSegments !important 规则恢复原亮金（dark 品牌本达标，不连坐）。
              background: "linear-gradient(120deg, #8C6228, #8C682D 45%, #B8433F)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent"
            },
            children: "凡人修仙传"
          }),
          jsx("span", { className: "dsh-mrz-badge", children: "BEAUTY" })
        ]
      });
    }
    return defineSkin({ ...SPEC, Mark: MeiRenZhiMark, Name: MeiRenZhiName });
  }

  // src/client/index.js
  window.__ModuleLoader__.load({
    // MUST equal the package.json `name` (and the roster row `name` in
    // cordis.patch.yml): the boot page emits __DSH_BOOT__ entries keyed by the
    // package name, and dsh-client-modules rejects a bundle whose registration
    // does not match its graph-row id ("loaded without registering …").
    id: "dsh-vyra-free-theme",
    factory: (require2) => {
      const jsxRuntime = require2("react/jsx-runtime");
      const react = require2("react");
      const reactDom = require2("react-dom");
      const profile = window.location?.protocol === "dsh-app:" && window.location?.hostname === "app" ? "desktop" : "web";
      const runtime = createSkinRuntime({ profile });
      const skinById = /* @__PURE__ */ new Map();
      for (const factory of [createMeirenzhiSkin]) {
        const skin = factory(jsxRuntime);
        skinById.set(skin.id, skin);
        runtime.register(skin);
      }
      const configClient = typeof fetch === "function" ? createConfigClient({ profile, contextActive: () => runtime.active() }) : null;
      if (configClient !== null) {
        const assetResolver = (ref) => {
          if (ref.kind === "builtin") {
            const asset = skinById.get(ref.skinId)?.builtinAssets?.[ref.assetKey];
            return asset ? { url: asset.url, mime: asset.mime, darkUrl: asset.darkUrl, darkMime: asset.darkMime } : null;
          }
          const meta = configClient.findLibraryEntry(ref.id);
          return meta ? { url: configClient.assetUrl(meta), mime: meta.mime } : null;
        };
        const metaProvider = (id) => configClient.findLibraryEntry(id);
        runtime.setPersonalization({
          getOverrides: (skinId) => configClient.effectiveOverrides(skinId),
          assetResolver,
          metaProvider
        });
        let lastOverridesKey = null;
        configClient.onStateChange(() => {
          const activeId = runtime.active();
          if (activeId === runtime.officialId) return;
          const key = JSON.stringify(configClient.effectiveOverrides(activeId));
          if (key === lastOverridesKey) return;
          lastOverridesKey = key;
          runtime.updateActive();
        });
        configClient.boot();
      }
      const inject = ["slots", "locale", "theme", "connection"];
      let fileThemesStarted = false;
      function apply(ctx) {
        installRemoteThemePersistence(ctx);
        ctx.effect(() => runtime.apply(ctx), "dsh-vyra-free-theme: active skin");
        if (configClient !== null) {
          ctx.effect(() => () => configClient.dispose(), "dsh-vyra-free-theme: config client");
        }
        ctx.effect(() => {
          if (fileThemesStarted) return;
          fileThemesStarted = true;
          publishSelection();
          installFileThemes({ runtime, jsx: jsxRuntime.jsx, profile }).then(({ installed, problems }) => {
            if (problems.length > 0) console.warn("[dsh-vyra-free-theme] theme problems:", problems);
            if (installed.length > 0) runtime.refreshSelection();
            return adoptHostSelection({ runtime });
          }).catch((error) => console.warn("[dsh-vyra-free-theme] file themes unavailable:", error));
        }, "dsh-vyra-free-theme: file themes");
        try {
          installSidebarSwitcher(ctx, {
            runtime,
            jsx: jsxRuntime.jsx,
            react,
            reactDom,
            configClient,
            skinsById: (id) => skinById.get(id) ?? null
          });
        } catch (error) {
          console.warn("[dsh-vyra-free-theme] sidebar switcher registration failed:", error);
        }
      }
      window.__VFT__ = {
        list: runtime.list,
        select: runtime.select,
        active: runtime.active,
        themePreference: readLocalThemePreference,
        personalization: configClient,
        hotUpdate: runtime.updateActive
      };
      return {
        apply,
        inject,
        selectSkin: runtime.select,
        listSkins: runtime.list
      };
    }
  });
})();
