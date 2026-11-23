#!/usr/bin/env node

// cli/vft.mjs
import { copyFileSync, existsSync as existsSync2, mkdirSync as mkdirSync2, readdirSync, readFileSync as readFileSync2, renameSync as renameSync2, rmSync, statSync, writeFileSync as writeFileSync2 } from "node:fs";
import { basename, dirname, extname, join as join2, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

// src/shared/personalization/catalog.js
var GLOBAL_MAX_BYTES = 20 * 1024 * 1024;
var GLOBAL_MAX_PIXELS = 4e7;
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
  // openbmc（出厂皮肤，v1.0.6 起注册顺序第一位，见 client/index.js）
  openbmc: {
    builtinAssets: { art: { mime: "image/webp", labelKey: "personalization.openbmc.art" } },
    fields: [
      { ...WALLPAPER_FIELD, default: "builtin:openbmc:art", builtinChoices: ["art"] },
      {
        key: "slogan",
        type: "text",
        scope: "locale",
        labelKey: "personalization.slogan",
        maxLength: 40,
        default: { zh: "察于未萌 · 治于未乱", en: "Govern before the storm" }
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
        default: 55
      }
    ]
  },
  "uefi-harness": {
    builtinAssets: { art: { mime: "image/webp", labelKey: "personalization.uefi.art" } },
    fields: [
      { ...WALLPAPER_FIELD, default: "builtin:uefi-harness:art", builtinChoices: ["art"] },
      {
        key: "slogan",
        type: "text",
        scope: "locale",
        labelKey: "personalization.slogan",
        maxLength: 40,
        default: { zh: "启于固件 · 行于万象", en: "Boot before everything" }
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
        default: 55
      }
    ]
  },
  // 美人志（v1.0.6 前的出厂皮肤，现注册顺序第三位）：6 张内置精选，出厂默认 yuntai
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
    `/* vyra-free-theme sidebar pack: ${spec.pack} / ${spec.surface} / ${spec.density} */`,
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

// src/shared/personalization/theme-model.js
var THEME_SCHEMA_VERSION = 1;
var TRANSLUCENT_TOKENS = [
  "--dsw-alias-bg-base",
  "--dsw-alias-bg-layer-1",
  "--dsw-alias-bg-layer-2",
  "--dsw-alias-bg-layer-3",
  "--dsw-alias-bg-module-platform",
  "--dsw-specific-sidebar-fill"
];
var COVERAGE_SCOPES = ["sidebar", "topbar", "rightpanel"];
var ID_PATTERN = /^[a-z][a-z0-9-]{1,39}$/;
var TOKEN_PATTERN = /^--[a-z0-9-]+$/;
var HEX_PATTERN = /^#[0-9a-f]{6}$/i;
var CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
var KNOWN_KEYS = /* @__PURE__ */ new Set([
  "schema",
  "id",
  "name",
  "author",
  "version",
  "brand",
  "colors",
  "shape",
  "translucency",
  "wallpaper",
  "coverage",
  "sidebar",
  "decorations"
]);
var TEXT_MAX = 64;
var NAME_MAX = 60;
var SLOGAN_MAX = 40;
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function boundedText(value, max) {
  return typeof value === "string" && value.length > 0 && value.length <= max && !CONTROL_CHARS.test(value);
}
function validLocalePair(value, max) {
  return isPlainObject(value) && Object.keys(value).length === 2 && boundedText(value.zh, max) && boundedText(value.en, max);
}
function validColorPair(value) {
  return isPlainObject(value) && Object.keys(value).length === 2 && boundedText(value.light, TEXT_MAX) && boundedText(value.dark, TEXT_MAX);
}
function parsePercent(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100 ? Math.round(value) : null;
}
function normalizeTheme(raw) {
  const issues = [];
  const fail2 = (code, path, message) => issues.push({ code, path, message });
  if (!isPlainObject(raw)) {
    fail2("bad-shape", "", "theme.json 必须是一个对象");
    return { ok: false, issues };
  }
  for (const key of Object.keys(raw)) {
    if (!KNOWN_KEYS.has(key)) fail2("unknown-key", key, `未知字段 "${key}"（schema v1 不接受）`);
  }
  if (raw.schema !== THEME_SCHEMA_VERSION) {
    fail2("schema-version", "schema", `schema 必须是 ${THEME_SCHEMA_VERSION}`);
  }
  const id = raw.id;
  if (typeof id !== "string" || !ID_PATTERN.test(id)) {
    fail2("bad-id", "id", "id 必须是 2–40 位小写字母/数字/连字符，以字母开头");
  }
  if (!validLocalePair(raw.name, NAME_MAX)) {
    fail2("bad-name", "name", "name 必须是 { zh, en } 两个非空字符串（各 ≤60 字）");
  }
  if (!isPlainObject(raw.colors)) {
    fail2("bad-colors", "colors", "colors 必须是 { light, dark }");
  } else {
    for (const mode of ["light", "dark"]) {
      const table = raw.colors[mode];
      if (!isPlainObject(table) || Object.keys(table).length === 0) {
        fail2("bad-colors", `colors.${mode}`, `${mode} 至少需要一个令牌`);
        continue;
      }
      for (const [token, value] of Object.entries(table)) {
        if (!TOKEN_PATTERN.test(token)) fail2("bad-token", `colors.${mode}.${token}`, `非法令牌名 "${token}"`);
        if (!boundedText(value, TEXT_MAX)) {
          fail2("bad-token-value", `colors.${mode}.${token}`, "令牌值必须是非空字符串（≤64 字）");
        } else if (TRANSLUCENT_TOKENS.includes(token) && !HEX_PATTERN.test(value)) {
          fail2("bad-translucent-color", `colors.${mode}.${token}`, "随动令牌必须是 #RRGGBB，才能按通透度换算 alpha");
        }
      }
    }
    const lightKeys = Object.keys(raw.colors.light ?? {}).sort();
    const darkKeys = Object.keys(raw.colors.dark ?? {}).sort();
    if (lightKeys.join() !== darkKeys.join()) {
      fail2("color-token-mismatch", "colors", "light 与 dark 必须声明完全相同的令牌集合");
    }
    if (!isPlainObject(raw.colors.light) || !HEX_PATTERN.test(raw.colors.light["--dsw-alias-bg-base"] ?? "")) {
      fail2("missing-bg-base", "colors.light.--dsw-alias-bg-base", "必须声明 #RRGGBB 形式的 --dsw-alias-bg-base");
    }
  }
  if (raw.shape !== void 0) {
    if (!isPlainObject(raw.shape)) fail2("bad-shape", "shape", "shape 必须是对象");
    else {
      for (const [token, value] of Object.entries(raw.shape)) {
        if (!TOKEN_PATTERN.test(token)) fail2("bad-token", `shape.${token}`, `非法令牌名 "${token}"`);
        if (!boundedText(value, TEXT_MAX)) fail2("bad-token-value", `shape.${token}`, "令牌值必须是非空字符串");
      }
    }
  }
  let translucency = { web: 55, desktop: 66, baked: {} };
  if (raw.translucency !== void 0) {
    if (!isPlainObject(raw.translucency)) {
      fail2("bad-translucency", "translucency", "translucency 必须是对象");
    } else {
      for (const key of Object.keys(raw.translucency)) {
        if (!["web", "desktop", "baked"].includes(key)) {
          fail2("unknown-key", `translucency.${key}`, `未知字段 "${key}"`);
        }
      }
      for (const mode of ["web", "desktop"]) {
        if (raw.translucency[mode] === void 0) continue;
        const value = parsePercent(raw.translucency[mode]);
        if (value === null) fail2("bad-translucency", `translucency.${mode}`, "必须是 0–100 的数字");
        else translucency[mode] = value;
      }
      if (raw.translucency.baked !== void 0) {
        if (!isPlainObject(raw.translucency.baked)) {
          fail2("bad-translucency", "translucency.baked", "baked 必须是 { 令牌: 0–100 }");
        } else {
          for (const [token, value] of Object.entries(raw.translucency.baked)) {
            if (!TRANSLUCENT_TOKENS.includes(token)) {
              fail2("bad-translucency", `translucency.baked.${token}`, "只有随动令牌可以声明 baked");
            }
            const points = parsePercent(value);
            if (points === null) fail2("bad-translucency", `translucency.baked.${token}`, "必须是 0–100 的数字");
            else translucency.baked[token] = points;
          }
        }
      }
    }
  }
  let brand = { title: null, mark: null, favicon: null, slogans: { zh: "", en: "" } };
  if (raw.brand !== void 0) {
    if (!isPlainObject(raw.brand)) fail2("bad-brand", "brand", "brand 必须是对象");
    else {
      for (const key of Object.keys(raw.brand)) {
        if (!["title", "mark", "favicon", "slogans"].includes(key)) {
          fail2("unknown-key", `brand.${key}`, `未知字段 "${key}"`);
        }
      }
      if (raw.brand.title !== void 0) {
        if (!validLocalePair(raw.brand.title, NAME_MAX)) fail2("bad-brand", "brand.title", "title 必须是 { zh, en }");
        else brand.title = { zh: raw.brand.title.zh, en: raw.brand.title.en };
      }
      if (raw.brand.mark !== void 0 && raw.brand.mark !== null) {
        if (!boundedText(raw.brand.mark, 256)) fail2("bad-brand", "brand.mark", "mark 必须是路径或内联 SVG 字符串");
        else brand.mark = raw.brand.mark;
      }
      if (raw.brand.favicon !== void 0 && raw.brand.favicon !== null) {
        const favicon = raw.brand.favicon;
        if (!isPlainObject(favicon) || !boundedText(favicon.href, 2048) || !boundedText(favicon.mime, 64)) {
          fail2("bad-brand", "brand.favicon", "favicon 必须是 { href, mime }");
        } else brand.favicon = { href: favicon.href, mime: favicon.mime };
      }
      if (raw.brand.slogans !== void 0) {
        if (!validLocalePair(raw.brand.slogans, SLOGAN_MAX)) {
          fail2("bad-brand", "brand.slogans", "slogans 必须是 { zh, en }（各 ≤40 字）");
        } else brand.slogans = { zh: raw.brand.slogans.zh, en: raw.brand.slogans.en };
      }
    }
  }
  let wallpaper = null;
  if (raw.wallpaper !== void 0 && raw.wallpaper !== null) {
    if (!isPlainObject(raw.wallpaper)) fail2("bad-wallpaper", "wallpaper", "wallpaper 必须是对象");
    else if (!["image", "video", "animated", "code"].includes(raw.wallpaper.kind)) {
      fail2("unsupported-wallpaper-kind", "wallpaper.kind", "kind 必须是 image / video / animated / code");
    } else if (raw.wallpaper.kind === "code") {
      if (!boundedText(raw.wallpaper.entry, 256) || mimeForAssetPath(raw.wallpaper.entry) !== THEME_ASSET_MIME[".js"]) {
        fail2("bad-wallpaper", "wallpaper.entry", "代码壁纸必须声明一个 theme 内的 .js 入口");
      } else {
        wallpaper = { kind: "code", entry: raw.wallpaper.entry };
      }
    } else if (raw.wallpaper.kind === "video") {
      wallpaper = { kind: "video", light: raw.wallpaper.light ?? null, dark: raw.wallpaper.dark ?? null };
      if (wallpaper.light === null && wallpaper.dark === null) {
        fail2("bad-wallpaper", "wallpaper", "至少需要 light 或 dark 一侧");
      }
      for (const mode of ["light", "dark"]) {
        const side = wallpaper[mode];
        if (side === null) continue;
        if (!isPlainObject(side) || !boundedText(side.src, 256)) {
          fail2("bad-wallpaper", `wallpaper.${mode}`, "每一侧必须是 { src, poster?, overlay?, blur? }");
          continue;
        }
        const mime = mimeForAssetPath(side.src);
        if (mime !== "video/mp4" && mime !== "video/webm") {
          fail2("bad-wallpaper", `wallpaper.${mode}.src`, "视频壁纸必须是 .mp4 或 .webm");
        }
        if (side.poster !== void 0 && side.poster !== null) {
          const posterMime = mimeForAssetPath(side.poster);
          if (!boundedText(side.poster, 256) || posterMime === null || !posterMime.startsWith("image/")) {
            fail2("bad-wallpaper", `wallpaper.${mode}.poster`, "poster 必须是 theme 内的图片路径");
          }
        }
      }
    } else {
      wallpaper = { kind: raw.wallpaper.kind, light: raw.wallpaper.light ?? null, dark: raw.wallpaper.dark ?? null };
      if (wallpaper.light === null && wallpaper.dark === null) {
        fail2("bad-wallpaper", "wallpaper", "至少需要 light 或 dark 一侧");
      }
      for (const mode of ["light", "dark"]) {
        const side = wallpaper[mode];
        if (side === null) continue;
        if (!isPlainObject(side) || !boundedText(side.src, 256)) {
          fail2("bad-wallpaper", `wallpaper.${mode}`, "每一侧必须是 { src, poster?, overlay?, blur? }");
          continue;
        }
        const mime = mimeForAssetPath(side.src);
        const allowed = raw.wallpaper.kind === "animated" ? ["image/gif", "image/webp"] : Object.values(THEME_ASSET_MIME).filter((value) => value.startsWith("image/"));
        if (mime === null || !allowed.includes(mime)) {
          fail2("bad-wallpaper", `wallpaper.${mode}.src`, raw.wallpaper.kind === "animated" ? "动图壁纸必须是 .gif 或 .webp" : "静态壁纸必须是 .webp / .png / .jpg / .avif");
        }
      }
    }
  }
  let coverage = { shell: false, scopes: ["sidebar"] };
  if (raw.coverage !== void 0) {
    if (!isPlainObject(raw.coverage)) fail2("bad-coverage", "coverage", "coverage 必须是对象");
    else {
      if (raw.coverage.shell !== void 0) {
        if (typeof raw.coverage.shell !== "boolean") fail2("bad-coverage", "coverage.shell", "shell 必须是布尔值");
        else coverage.shell = raw.coverage.shell;
      }
      if (raw.coverage.scopes !== void 0) {
        if (!Array.isArray(raw.coverage.scopes) || raw.coverage.scopes.some((scope) => !COVERAGE_SCOPES.includes(scope))) {
          fail2("bad-coverage", "coverage.scopes", `scopes 只能取 ${COVERAGE_SCOPES.join(" / ")}`);
        } else coverage.scopes = [...raw.coverage.scopes];
      }
    }
  }
  let sidebar = null;
  if (raw.sidebar !== void 0 && raw.sidebar !== null) {
    if (!isPlainObject(raw.sidebar)) {
      fail2("bad-sidebar", "sidebar", "sidebar 必须是对象");
    } else {
      const known = ["pack", "surface", "blur", "radius", "density", "icon", "states", "divider", "background"];
      for (const key of Object.keys(raw.sidebar)) {
        if (!known.includes(key)) fail2("unknown-key", `sidebar.${key}`, `未知字段 "${key}"`);
      }
      if (raw.sidebar.pack !== void 0 && SIDEBAR_PACKS[raw.sidebar.pack] === void 0) {
        fail2("bad-sidebar", "sidebar.pack", `pack 必须是 ${Object.keys(SIDEBAR_PACKS).join(" / ")}`);
      }
      if (raw.sidebar.surface !== void 0 && !SIDEBAR_SURFACES.includes(raw.sidebar.surface)) {
        fail2("bad-sidebar", "sidebar.surface", `surface 必须是 ${SIDEBAR_SURFACES.join(" / ")}`);
      }
      if (raw.sidebar.density !== void 0 && !SIDEBAR_DENSITIES.includes(raw.sidebar.density)) {
        fail2("bad-sidebar", "sidebar.density", `density 必须是 ${SIDEBAR_DENSITIES.join(" / ")}`);
      }
      if (raw.sidebar.blur !== void 0 && !(Number.isInteger(raw.sidebar.blur) && raw.sidebar.blur >= 0 && raw.sidebar.blur <= 24)) {
        fail2("bad-sidebar", "sidebar.blur", "blur 必须是 0–24 的整数");
      }
      if (raw.sidebar.radius !== void 0) {
        if (!isPlainObject(raw.sidebar.radius)) fail2("bad-sidebar", "sidebar.radius", "radius 必须是 { card, item }");
        else {
          for (const key of Object.keys(raw.sidebar.radius)) {
            if (!["card", "item"].includes(key)) fail2("unknown-key", `sidebar.radius.${key}`, `未知字段 "${key}"`);
            const value = raw.sidebar.radius[key];
            if (!(Number.isInteger(value) && value >= 0 && value <= 32)) {
              fail2("bad-sidebar", `sidebar.radius.${key}`, "必须是 0–32 的整数");
            }
          }
        }
      }
      if (raw.sidebar.icon !== void 0) {
        if (!validColorPair(raw.sidebar.icon)) fail2("bad-sidebar", "sidebar.icon", "icon 必须是 { light, dark }");
      }
      if (raw.sidebar.states !== void 0) {
        if (!isPlainObject(raw.sidebar.states)) fail2("bad-sidebar", "sidebar.states", "states 必须是对象");
        else {
          for (const [state, values] of Object.entries(raw.sidebar.states)) {
            if (!["hover", "active", "selected"].includes(state)) {
              fail2("unknown-key", `sidebar.states.${state}`, `未知状态 "${state}"`);
              continue;
            }
            if (!isPlainObject(values)) {
              fail2("bad-sidebar", `sidebar.states.${state}`, "状态必须是对象");
              continue;
            }
            for (const [field, value] of Object.entries(values)) {
              if (!["bg", "fg", "darkBg", "darkFg", "indicator", "darkIndicator"].includes(field)) {
                fail2("unknown-key", `sidebar.states.${state}.${field}`, `未知字段 "${field}"`);
              } else if (!boundedText(value, TEXT_MAX)) {
                fail2("bad-sidebar", `sidebar.states.${state}.${field}`, "必须是颜色字符串");
              }
            }
          }
        }
      }
      if (raw.sidebar.divider !== void 0 && raw.sidebar.divider !== null) {
        const divider = raw.sidebar.divider;
        if (!isPlainObject(divider) || !boundedText(divider.color, TEXT_MAX)) {
          fail2("bad-sidebar", "sidebar.divider", "divider 必须是 { color, style? }");
        } else if (divider.style !== void 0 && !["solid", "dashed", "none"].includes(divider.style)) {
          fail2("bad-sidebar", "sidebar.divider.style", "style 必须是 solid / dashed / none");
        }
      }
      if (raw.sidebar.background !== void 0 && raw.sidebar.background !== null) {
        const background = raw.sidebar.background;
        if (!isPlainObject(background) || !boundedText(background.light, TEXT_MAX) || background.dark !== void 0 && !boundedText(background.dark, TEXT_MAX)) {
          fail2("bad-sidebar", "sidebar.background", "background 必须是 { light, dark? }");
        }
      }
      if (!issues.some((issue) => issue.path.startsWith("sidebar"))) {
        sidebar = { ...raw.sidebar };
      }
    }
  }
  if (raw.decorations !== void 0 && raw.decorations !== null && !Array.isArray(raw.decorations)) {
    fail2("bad-decorations", "decorations", "decorations 必须是数组");
  }
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    issues: [],
    theme: {
      schema: THEME_SCHEMA_VERSION,
      id: raw.id,
      name: { zh: raw.name.zh, en: raw.name.en },
      author: typeof raw.author === "string" ? raw.author : null,
      version: typeof raw.version === "string" ? raw.version : null,
      brand,
      colors: { light: { ...raw.colors.light }, dark: { ...raw.colors.dark } },
      shape: raw.shape === void 0 ? {} : { ...raw.shape },
      translucency,
      wallpaper,
      coverage,
      sidebar,
      decorations: raw.decorations ?? null
    }
  };
}
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

// src/shared/personalization/color-score.js
var WEIGHTS = Object.freeze({
  contrast: 30,
  brand: 20,
  luma: 20,
  hue: 15,
  interference: 15
});
var SCORE_THRESHOLD = 70;
var CONTRAST_MIN = 4.5;
var BRAND_MIN = 3;
var LUMA_SPREAD_MIN = 0.01;
var HEX3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;
var HEX6 = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i;
var RGB_FN = /^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/i;
function clampByte(value) {
  return Math.min(255, Math.max(0, Math.round(value)));
}
function parseColor(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  const short = HEX3.exec(text);
  if (short !== null) {
    return { r: parseInt(short[1] + short[1], 16), g: parseInt(short[2] + short[2], 16), b: parseInt(short[3] + short[3], 16), a: 1 };
  }
  const long = HEX6.exec(text);
  if (long !== null) {
    const int = parseInt(long[1], 16);
    const alpha = long[2] === void 0 ? 1 : parseInt(long[2], 16) / 255;
    return { r: int >> 16 & 255, g: int >> 8 & 255, b: int & 255, a: alpha };
  }
  const fn = RGB_FN.exec(text);
  if (fn !== null) {
    const alphaText = fn[4];
    const alpha = alphaText === void 0 ? 1 : alphaText.endsWith("%") ? parseFloat(alphaText) / 100 : parseFloat(alphaText);
    return { r: clampByte(Number(fn[1])), g: clampByte(Number(fn[2])), b: clampByte(Number(fn[3])), a: Math.min(1, Math.max(0, alpha)) };
  }
  return null;
}
function relativeLuminance({ r, g, b }) {
  const channel = (value) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
function contrastRatio(foreground, background) {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}
function composite(foreground, background, alphaScale = 1) {
  const a = Math.min(1, Math.max(0, (foreground.a ?? 1) * alphaScale));
  return {
    r: foreground.r * a + background.r * (1 - a),
    g: foreground.g * a + background.g * (1 - a),
    b: foreground.b * a + background.b * (1 - a),
    a: 1
  };
}
function rgbToHsl({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const lightness = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: lightness };
  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue;
  if (max === rn) hue = ((gn - bn) / delta + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) hue = ((bn - rn) / delta + 2) / 6;
  else hue = ((rn - gn) / delta + 4) / 6;
  return { h: hue * 360, s: saturation, l: lightness };
}
function hslToRgb({ h, s, l }) {
  const hue = (h % 360 + 360) % 360 / 360;
  if (s === 0) {
    const value = clampByte(l * 255);
    return { r: value, g: value, b: value, a: 1 };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t) => {
    let temp = t;
    if (temp < 0) temp += 1;
    if (temp > 1) temp -= 1;
    if (temp < 1 / 6) return p + (q - p) * 6 * temp;
    if (temp < 1 / 2) return q;
    if (temp < 2 / 3) return p + (q - p) * (2 / 3 - temp) * 6;
    return p;
  };
  return {
    r: clampByte(channel(hue + 1 / 3) * 255),
    g: clampByte(channel(hue) * 255),
    b: clampByte(channel(hue - 1 / 3) * 255),
    a: 1
  };
}
function toHex({ r, g, b }) {
  return `#${[r, g, b].map((value) => clampByte(value).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}
function circularDistance(a, b) {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}
function hueHarmonyScore(brandHue, baseHue) {
  const distance = circularDistance(brandHue, baseHue);
  const bands = [[0, 15], [0, 45], [150, 210]];
  let nearest = Infinity;
  for (const [low, high] of bands) {
    if (distance >= low && distance <= high) nearest = 0;
    else nearest = Math.min(nearest, Math.min(Math.abs(distance - low), Math.abs(distance - high)));
  }
  return Math.round(Math.max(0, 100 - nearest / 45 * 100));
}
function luminanceSpread(tokens) {
  const values = tokens.map((token) => parseColor(token)).filter((color) => color !== null).map((color) => rgbToHsl(color).l);
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}
function spreadScore(std) {
  if (std >= 0.03) return 100;
  return Math.round(Math.max(0, Math.min(100, std / 0.03 * 100)));
}
function interferenceScore(sampled) {
  if (sampled === null || sampled === void 0) return null;
  const edge = typeof sampled.edgeEnergy === "number" ? sampled.edgeEnergy : 0;
  const std = typeof sampled.stdLuma === "number" ? sampled.stdLuma : 0;
  const score = 100 - Math.min(100, edge / 0.16 * 55 + std / 0.3 * 45);
  return Math.round(Math.max(0, score));
}
var SURFACE_TOKENS = ["--dsw-alias-bg-base", "--dsw-alias-bg-layer-1", "--dsw-alias-bg-layer-2", "--dsw-alias-bg-layer-3"];
var TEXT_TOKENS = ["--dsw-alias-label-primary", "--dsw-alias-label-secondary"];
function modeScore(theme, mode, sampled) {
  const colors = theme.colors[mode];
  const base = parseColor(colors["--dsw-alias-bg-base"]);
  if (base === null) return null;
  const surface = base;
  const textRatios = TEXT_TOKENS.map((token) => colors[token]).filter((value) => typeof value === "string").map((value) => {
    const parsed = parseColor(value);
    if (parsed === null) return null;
    const composited = parsed.a < 1 ? composite(parsed, surface) : parsed;
    return contrastRatio(composited, surface);
  }).filter((ratio) => ratio !== null);
  const contrast = textRatios.length === 0 ? 0 : Math.min(...textRatios);
  const brandColor = parseColor(colors["--dsw-alias-brand-primary"] ?? "");
  const brand = brandColor === null ? 0 : contrastRatio(brandColor, surface);
  const std = luminanceSpread(SURFACE_TOKENS.map((token) => colors[token]).filter(Boolean));
  const baseHue = rgbToHsl(base).h;
  const brandHue = brandColor === null ? baseHue : rgbToHsl(brandColor).h;
  return {
    contrast: {
      value: Math.round(Math.min(100, Math.min(contrast, CONTRAST_MIN * 2) / (CONTRAST_MIN * 2) * 100)),
      raw: Number(contrast.toFixed(2))
    },
    brand: {
      value: Math.round(Math.min(100, Math.min(brand, BRAND_MIN * 2) / (BRAND_MIN * 2) * 100)),
      raw: Number(brand.toFixed(2))
    },
    luma: { value: spreadScore(std), raw: Number(std.toFixed(4)) },
    hue: { value: hueHarmonyScore(brandHue, baseHue), raw: Math.round(circularDistance(brandHue, baseHue)) },
    interference: sampled === null || sampled === void 0 ? null : { value: interferenceScore(sampled), raw: sampled }
  };
}
function failureFor(dimension, mode, entry) {
  if (entry === null) return null;
  if (dimension === "contrast" && entry.raw < CONTRAST_MIN) {
    return {
      dimension,
      mode,
      value: entry.raw,
      threshold: CONTRAST_MIN,
      fix: "把 label-primary / label-secondary 调向背景反方向（更亮或更暗），或调高 panelOpacity 压暗壁纸"
    };
  }
  if (dimension === "brand" && entry.raw < BRAND_MIN) {
    return { dimension, mode, value: entry.raw, threshold: BRAND_MIN, fix: "提高品牌色与背景的明度差（加饱和或拉开明度）" };
  }
  if (dimension === "luma" && entry.raw < LUMA_SPREAD_MIN) {
    return {
      dimension,
      mode,
      value: entry.raw,
      threshold: LUMA_SPREAD_MIN,
      fix: "图层之间几乎同亮度：把 base 与 layer-3 的明度拉开 ≥6%"
    };
  }
  if (dimension === "hue" && entry.value < 50) {
    return {
      dimension,
      mode,
      value: entry.raw,
      threshold: "0–45° 或 150–210°",
      fix: "把品牌色相移进类似色（≤45°）或互补色（150–210°）区"
    };
  }
  if (dimension === "interference" && entry.value < 50) {
    return { dimension, mode, value: entry.value, threshold: 50, fix: "壁纸太花：提高 overlay 不透明度、加模糊，或换一张低细节壁纸" };
  }
  return null;
}
function scoreTheme(theme, { sampled = null } = {}) {
  const breakdown = [];
  const failures = [];
  const modes = ["light", "dark"];
  const perMode = {};
  for (const mode of modes) {
    perMode[mode] = modeScore(theme, mode, sampled?.[mode] ?? null);
  }
  const includeInterference = sampled !== null && sampled !== void 0 && modes.every((mode) => perMode[mode]?.interference !== null && perMode[mode]?.interference !== void 0);
  for (const dimension of ["contrast", "brand", "luma", "hue", "interference"]) {
    if (dimension === "interference" && !includeInterference) continue;
    for (const mode of modes) {
      const entry = perMode[mode]?.[dimension];
      if (entry === null || entry === void 0) continue;
      breakdown.push({ dimension, mode, weight: WEIGHTS[dimension], value: entry.value, raw: entry.raw });
      const failure = failureFor(dimension, mode, entry);
      if (failure !== null) failures.push(failure);
    }
  }
  const weightSum = breakdown.reduce((sum, item) => sum + item.weight, 0);
  const weighted = breakdown.reduce((sum, item) => sum + item.weight * item.value, 0);
  const score = weightSum === 0 ? 0 : Math.round(weighted / weightSum);
  return {
    score,
    threshold: SCORE_THRESHOLD,
    pass: score >= SCORE_THRESHOLD,
    sampled: includeInterference,
    excluded: includeInterference ? [] : ["interference"],
    breakdown,
    failures
  };
}
var HARMONIES = Object.freeze(["monochrome", "analogous", "complementary"]);
var HUE_OFFSET = { monochrome: 8, analogous: 32, complementary: 180 };
function brandFromSeed(hsl, mode, harmony) {
  const hue = (hsl.h + HUE_OFFSET[harmony]) % 360;
  const saturation = Math.min(0.92, Math.max(0.45, hsl.s + (harmony === "monochrome" ? 0.1 : 0.18)));
  if (mode === "light") {
    return hslToRgb({ h: hue, s: saturation, l: Math.min(0.42, Math.max(0.22, hsl.l * 0.55)) });
  }
  return hslToRgb({ h: hue, s: Math.min(0.9, saturation), l: Math.max(0.62, Math.min(0.78, hsl.l + 0.35)) });
}
function rgbaLabel(color, alpha) {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}
function suggestPalette(seedHex, { harmony = "analogous" } = {}) {
  const seed = parseColor(seedHex);
  if (seed === null) throw new Error(`invalid seed colour "${seedHex}"`);
  const harmonyKey = HARMONIES.includes(harmony) ? harmony : "analogous";
  const hsl = rgbToHsl(seed);
  const hue = hsl.h;
  const tint = (l, s) => toHex(hslToRgb({ h: hue, s, l }));
  const labelLight = hslToRgb({ h: hue, s: 0.18, l: 0.13 });
  const labelDark = hslToRgb({ h: hue, s: 0.12, l: 0.94 });
  const light = {
    "--dsw-alias-bg-base": tint(0.96, Math.min(0.35, Math.max(0.12, hsl.s * 0.5))),
    "--dsw-alias-bg-layer-1": tint(0.985, Math.min(0.28, Math.max(0.08, hsl.s * 0.4))),
    "--dsw-alias-bg-layer-2": tint(0.93, Math.min(0.3, Math.max(0.1, hsl.s * 0.45))),
    "--dsw-alias-bg-layer-3": tint(0.89, Math.min(0.32, Math.max(0.12, hsl.s * 0.5))),
    "--dsw-alias-bg-module-platform": tint(0.945, Math.min(0.3, Math.max(0.1, hsl.s * 0.45))),
    "--dsw-specific-sidebar-fill": tint(0.94, Math.min(0.3, Math.max(0.1, hsl.s * 0.45))),
    "--dsw-alias-brand-primary": toHex(brandFromSeed(hsl, "light", harmonyKey)),
    "--dsw-alias-label-primary": toHex(labelLight),
    "--dsw-alias-label-secondary": rgbaLabel(labelLight, 0.72)
  };
  const dark = {
    "--dsw-alias-bg-base": tint(0.065, Math.min(0.32, Math.max(0.12, hsl.s * 0.5))),
    "--dsw-alias-bg-layer-1": tint(0.105, Math.min(0.3, Math.max(0.1, hsl.s * 0.45))),
    "--dsw-alias-bg-layer-2": tint(0.145, Math.min(0.3, Math.max(0.1, hsl.s * 0.45))),
    "--dsw-alias-bg-layer-3": tint(0.185, Math.min(0.32, Math.max(0.12, hsl.s * 0.5))),
    "--dsw-alias-bg-module-platform": tint(0.12, Math.min(0.3, Math.max(0.1, hsl.s * 0.45))),
    "--dsw-specific-sidebar-fill": tint(0.11, Math.min(0.3, Math.max(0.1, hsl.s * 0.45))),
    "--dsw-alias-brand-primary": toHex(brandFromSeed(hsl, "dark", harmonyKey)),
    "--dsw-alias-label-primary": toHex(labelDark),
    "--dsw-alias-label-secondary": rgbaLabel(labelDark, 0.72)
  };
  return { light, dark };
}
function rankPalettes(seedHex, { baseTheme } = {}) {
  return HARMONIES.map((harmony) => {
    const colors = suggestPalette(seedHex, { harmony });
    const theme = {
      ...baseTheme ?? {},
      schema: 1,
      id: baseTheme?.id ?? "suggested",
      name: baseTheme?.name ?? { zh: "建议", en: "Suggested" },
      colors
    };
    const report = scoreTheme(theme);
    return { harmony, colors, report };
  }).sort((a, b) => b.report.score - a.report.score);
}

// src/host/themes/selection.js
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
var SELECTION_FILE = "selection.json";
var OFFICIAL_ID = "official";
var ID_PATTERN2 = /^[a-z][a-z0-9-]{1,39}$/;
function isSelectableId(id) {
  return id === OFFICIAL_ID || typeof id === "string" && ID_PATTERN2.test(id);
}
function readSelection(dataDir) {
  const file = join(dataDir, SELECTION_FILE);
  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    if (parsed === null || typeof parsed !== "object") return null;
    if (!isSelectableId(parsed.skinId)) return null;
    return { skinId: parsed.skinId, updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null };
  } catch {
    return null;
  }
}
function writeSelection(dataDir, skinId, { now = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  if (!isSelectableId(skinId)) throw new Error(`invalid skin id "${skinId}"`);
  mkdirSync(dataDir, { recursive: true });
  const record = { skinId, updatedAt: now() };
  const target = join(dataDir, SELECTION_FILE);
  const stage = `${target}.tmp-${process.pid}`;
  writeFileSync(stage, `${JSON.stringify(record, null, 2)}
`, "utf8");
  renameSync(stage, target);
  return record;
}

// cli/vft.mjs
var PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
var EXIT = { ok: 0, error: 1, gate: 2, confirm: 3 };
var THEME_ID = /^[a-z][a-z0-9-]{1,39}$/;
function parseArgs(argv) {
  const positionals = [];
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
    const body = token.slice(2);
    const eq = body.indexOf("=");
    if (eq !== -1) {
      flags[body.slice(0, eq)] = body.slice(eq + 1);
      continue;
    }
    const next = argv[index + 1];
    if (next !== void 0 && !next.startsWith("--")) {
      flags[body] = next;
      index += 1;
    } else {
      flags[body] = true;
    }
  }
  return { positionals, flags };
}
function fail(code, message, extra = {}) {
  return { exitCode: code, payload: { ok: false, code, error: message, ...extra } };
}
function resolvePaths({ dshHome, profile } = {}) {
  const home = resolve(dshHome ?? process.env.DSH_HOME ?? join2(homedir(), ".dsh"));
  const resolvedProfile = profile ?? (existsSync2(join2(home, "vyra-free-theme-desktop")) ? "desktop" : "web");
  const dataDir = join2(home, resolvedProfile === "desktop" ? "vyra-free-theme-desktop" : "vyra-free-theme");
  return {
    home,
    profile: resolvedProfile,
    dataDir,
    userThemesDir: join2(dataDir, "themes"),
    selectionFile: join2(dataDir, "selection.json"),
    stateFile: join2(dataDir, "state.json"),
    packageRoot: PACKAGE_ROOT
  };
}
function sources(paths) {
  return [
    { kind: "user", dir: paths.userThemesDir },
    { kind: "builtin", dir: join2(paths.packageRoot, "themes") },
    { kind: "preset", dir: join2(paths.packageRoot, "presets", "colors") }
  ];
}
function listIds(dir) {
  if (!existsSync2(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory() && existsSync2(join2(dir, entry.name, "theme.json"))).map((entry) => entry.name).sort();
}
function findTheme(paths, id) {
  for (const source of sources(paths)) {
    const dir = join2(source.dir, id);
    const file = join2(dir, "theme.json");
    if (!existsSync2(file)) continue;
    let raw;
    try {
      raw = JSON.parse(readFileSync2(file, "utf8"));
    } catch (error) {
      return { kind: source.kind, id, dir, error: `theme.json 解析失败：${error.message}` };
    }
    return { kind: source.kind, id, dir, raw };
  }
  return null;
}
function normalizeOrThrow(raw) {
  const result = normalizeTheme(raw);
  if (!result.ok) {
    const issues = result.issues.map((issue) => `${issue.code} ${issue.path}: ${issue.message}`).join("; ");
    const error = new Error(`主题校验失败：${issues}`);
    error.issues = result.issues;
    throw error;
  }
  return result.theme;
}
function writeJsonAtomic(file, value) {
  mkdirSync2(dirname(file), { recursive: true });
  const stage = `${file}.tmp-${process.pid}`;
  writeFileSync2(stage, `${JSON.stringify(value, null, 2)}
`, "utf8");
  renameSync2(stage, file);
}
function mutateUserTheme(paths, id, mutate) {
  const found = findTheme(paths, id);
  if (found === null) return fail(EXIT.error, `找不到主题 "${id}"`);
  if (found.kind !== "user") {
    return fail(EXIT.confirm, `"${id}" 是${found.kind === "builtin" ? "内置" : "预设"}主题，只读；先 vft theme create --from ${id} --id <新id>`, { kind: found.kind });
  }
  const next = { ...found.raw };
  mutate(next);
  const normalized = normalizeOrThrow(next);
  writeJsonAtomic(join2(found.dir, "theme.json"), next);
  return { exitCode: EXIT.ok, payload: { ok: true, id, theme: normalized } };
}
function summarise(paths, id, kind, raw) {
  try {
    const theme = normalizeOrThrow(raw);
    const report = scoreTheme(theme);
    return {
      id,
      kind,
      name: theme.name,
      wallpaper: theme.wallpaper === null ? null : theme.wallpaper.kind,
      sidebar: resolveSidebar(theme).pack,
      coverage: theme.coverage,
      score: report.score,
      pass: report.pass
    };
  } catch (error) {
    return { id, kind, error: error.message };
  }
}
function cmdThemeList(paths, { flags }) {
  const rows = [];
  const seen = /* @__PURE__ */ new Set();
  for (const source of sources(paths)) {
    for (const id of listIds(source.dir)) {
      if (source.kind !== "user" && seen.has(id)) continue;
      seen.add(id);
      let raw;
      try {
        raw = JSON.parse(readFileSync2(join2(source.dir, id, "theme.json"), "utf8"));
      } catch {
        rows.push({ id, kind: source.kind, error: "theme.json 解析失败" });
        continue;
      }
      rows.push(summarise(paths, id, source.kind, raw));
    }
  }
  const active = readSelection(paths.dataDir);
  if (flags.json === true) return { exitCode: EXIT.ok, payload: { ok: true, active: active?.skinId ?? null, themes: rows } };
  const lines = rows.map((row) => {
    const status = row.error !== void 0 ? "INVALID" : row.pass ? "pass" : "FAIL";
    const score = row.error !== void 0 ? "  -" : String(row.score).padStart(3);
    const marker = active?.skinId === row.id ? "*" : " ";
    return `${marker} ${status.padEnd(7)} ${score}  ${row.kind.padEnd(7)} ${row.id}${row.error ? `  (${row.error})` : ""}`;
  });
  return {
    exitCode: EXIT.ok,
    payload: { ok: true, active: active?.skinId ?? null, themes: rows },
    text: [`当前：${active?.skinId ?? "(未设置，跟随客户端)"}`, ...lines].join("\n")
  };
}
function cmdThemeShow(paths, { positionals, flags }) {
  const id = positionals[0];
  const found = findTheme(paths, id);
  if (found === null) return fail(EXIT.error, `找不到主题 "${id}"`);
  const theme = normalizeOrThrow(found.raw);
  const report = scoreTheme(theme);
  const payload = {
    ok: true,
    id,
    kind: found.kind,
    theme,
    resolved: { sidebar: resolveSidebar(theme), fields: fieldsFromTheme(theme, paths.profile) },
    colour: report
  };
  return { exitCode: EXIT.ok, payload, text: flags.json === true ? void 0 : JSON.stringify(payload.theme, null, 2) };
}
function cmdThemeCreate(paths, { flags }) {
  const from = flags.from;
  const id = flags.id;
  if (typeof from !== "string" || typeof id !== "string") return fail(EXIT.error, "用法：vft theme create --from <id> --id <新id> [--name 名称] [--name-en Name]");
  if (!THEME_ID.test(id)) return fail(EXIT.error, `非法主题 id "${id}"（2–40 位小写字母/数字/连字符）`);
  const found = findTheme(paths, from);
  if (found === null) return fail(EXIT.error, `找不到来源主题 "${from}"`);
  const targetDir = join2(paths.userThemesDir, id);
  if (existsSync2(targetDir)) return fail(EXIT.confirm, `"${id}" 已存在；先删除或换一个 id`);
  const next = JSON.parse(JSON.stringify(found.raw));
  next.id = id;
  if (typeof flags.name === "string") next.name = { zh: flags.name, en: typeof flags["name-en"] === "string" ? flags["name-en"] : flags.name };
  if (typeof flags["name-en"] === "string" && next.name.en === next.name.zh) next.name.en = flags["name-en"];
  next.version = next.version ?? "0.1.0";
  normalizeOrThrow(next);
  mkdirSync2(targetDir, { recursive: true });
  writeJsonAtomic(join2(targetDir, "theme.json"), next);
  const assetsDir = join2(found.dir, "assets");
  if (existsSync2(assetsDir)) {
    mkdirSync2(join2(targetDir, "assets"), { recursive: true });
    for (const name of readdirSync(assetsDir)) {
      copyFileSync(join2(assetsDir, name), join2(targetDir, "assets", name));
    }
  }
  const entry = extname(found.dir) === ".js" ? null : join2(found.dir, found.raw.wallpaper?.entry ?? "");
  if (found.raw.wallpaper?.kind === "code" && entry !== null && existsSync2(entry)) {
    copyFileSync(entry, join2(targetDir, found.raw.wallpaper.entry));
  }
  return { exitCode: EXIT.ok, payload: { ok: true, id, from, kind: "user", dir: targetDir }, text: `已创建 ${id}（来源 ${from}）→ ${targetDir}` };
}
function cmdThemeRename(paths, { positionals, flags }) {
  const id = positionals[0];
  if (typeof flags.name !== "string" && typeof flags["name-en"] !== "string") return fail(EXIT.error, "用法：vft theme rename <id> --name <中文名> [--name-en <English>]");
  return mutateUserTheme(paths, id, (raw) => {
    raw.name = {
      zh: typeof flags.name === "string" ? flags.name : raw.name.zh,
      en: typeof flags["name-en"] === "string" ? flags["name-en"] : typeof flags.name === "string" ? flags.name : raw.name.en
    };
  });
}
function cmdThemeDelete(paths, { positionals, flags }) {
  const id = positionals[0];
  const found = findTheme(paths, id);
  if (found === null) return fail(EXIT.error, `找不到主题 "${id}"`);
  if (found.kind !== "user") return fail(EXIT.confirm, `"${id}" 是${found.kind === "builtin" ? "内置" : "预设"}主题，不可删除`);
  if (flags.force !== true) return fail(EXIT.confirm, `删除 "${id}" 不可撤销；确认后加 --force 重跑`, { id });
  rmSync(found.dir, { recursive: true, force: true });
  return { exitCode: EXIT.ok, payload: { ok: true, id, deleted: true }, text: `已删除 ${id}` };
}
function cmdThemeApply(paths, { positionals, flags }) {
  const id = positionals[0];
  if (!isSelectableId(id)) return fail(EXIT.error, `非法主题 id "${id}"`);
  if (id !== OFFICIAL_ID) {
    const found = findTheme(paths, id);
    if (found === null) return fail(EXIT.error, `找不到主题 "${id}"；先 theme list 看可用项`);
  }
  const record = writeSelection(paths.dataDir, id);
  return {
    exitCode: EXIT.ok,
    payload: { ok: true, ...record, note: "客户端下次加载生效（已打开的页面刷新即生效）" },
    text: `已选择 ${id}（客户端刷新后生效）`
  };
}
function cmdReset(paths) {
  const record = writeSelection(paths.dataDir, OFFICIAL_ID);
  return { exitCode: EXIT.ok, payload: { ok: true, ...record }, text: "已回官方主题（客户端刷新后生效）" };
}
function cmdThemeReset(paths, { positionals }) {
  const id = positionals[0];
  if (!existsSync2(paths.stateFile)) return { exitCode: EXIT.ok, payload: { ok: true, id, cleared: false }, text: "没有个性化状态文件，无需复位" };
  let state;
  try {
    state = JSON.parse(readFileSync2(paths.stateFile, "utf8"));
  } catch (error) {
    return fail(EXIT.error, `state.json 解析失败：${error.message}`);
  }
  if (state?.skins === void 0 || state.skins[id] === void 0) {
    return { exitCode: EXIT.ok, payload: { ok: true, id, cleared: false }, text: `"${id}" 没有个性化覆盖` };
  }
  delete state.skins[id];
  writeJsonAtomic(paths.stateFile, state);
  return { exitCode: EXIT.ok, payload: { ok: true, id, cleared: true }, text: `已清掉 "${id}" 的个性化覆盖（回到出厂值）` };
}
function cmdThemeExport(paths, { positionals, flags }) {
  const id = positionals[0];
  const found = findTheme(paths, id);
  if (found === null) return fail(EXIT.error, `找不到主题 "${id}"`);
  const outDir = typeof flags.out === "string" ? resolve(flags.out) : resolve(process.cwd(), `${id}.vft`);
  copyDirRecursive(found.dir, outDir);
  return { exitCode: EXIT.ok, payload: { ok: true, id, out: outDir }, text: `已导出 ${id} → ${outDir}` };
}
function copyDirRecursive(from, to) {
  mkdirSync2(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const source = join2(from, entry.name);
    const target = join2(to, entry.name);
    if (entry.isDirectory()) copyDirRecursive(source, target);
    else copyFileSync(source, target);
  }
}
function cmdThemeImport(paths, { positionals, flags }) {
  const fromDir = resolve(positionals[0] ?? "");
  if (!existsSync2(join2(fromDir, "theme.json"))) return fail(EXIT.error, `"${fromDir}" 不是主题目录（缺 theme.json）`);
  let raw;
  try {
    raw = JSON.parse(readFileSync2(join2(fromDir, "theme.json"), "utf8"));
  } catch (error) {
    return fail(EXIT.error, `theme.json 解析失败：${error.message}`);
  }
  if (typeof flags.id === "string") raw.id = flags.id;
  const theme = normalizeOrThrow(raw);
  const targetDir = join2(paths.userThemesDir, theme.id);
  if (existsSync2(targetDir)) return fail(EXIT.confirm, `"${theme.id}" 已存在；换 id 或先删除`);
  copyDirRecursive(fromDir, targetDir);
  writeJsonAtomic(join2(targetDir, "theme.json"), raw);
  return { exitCode: EXIT.ok, payload: { ok: true, id: theme.id, dir: targetDir }, text: `已导入 ${theme.id} → ${targetDir}` };
}
var IMAGE_MIME = { ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".avif": "image/avif", ".gif": "image/gif" };
function cmdWallpaperList(paths, { positionals, flags }) {
  const id = positionals[0];
  const found = findTheme(paths, id);
  if (found === null) return fail(EXIT.error, `找不到主题 "${id}"`);
  const assetsDir = join2(found.dir, "assets");
  const files = existsSync2(assetsDir) ? readdirSync(assetsDir).filter((name) => IMAGE_MIME[extname(name).toLowerCase()] !== void 0) : [];
  const wallpaper = found.raw.wallpaper ?? null;
  const payload = { ok: true, id, kind: found.kind, wallpaper, files };
  if (flags.json === true) return { exitCode: EXIT.ok, payload };
  return {
    exitCode: EXIT.ok,
    payload,
    text: [
      `${id}：${wallpaper === null ? "无壁纸" : `${wallpaper.kind}${wallpaper.light ? ` light=${wallpaper.light.src}` : ""}${wallpaper.dark ? ` dark=${wallpaper.dark.src}` : ""}`}`,
      ...files.map((name) => `  · ${name}`)
    ].join("\n")
  };
}
function cmdWallpaperAdd(paths, { positionals, flags }) {
  const [id, ...files] = positionals;
  if (files.length === 0) return fail(EXIT.error, "用法：vft wallpaper add <id> <图片...> [--mode light|dark|both]");
  const mode = typeof flags.mode === "string" ? flags.mode : "both";
  if (!["light", "dark", "both"].includes(mode)) return fail(EXIT.error, "--mode 只能是 light / dark / both");
  return mutateUserTheme(paths, id, (raw) => {
    const themeDir = join2(paths.userThemesDir, id);
    mkdirSync2(join2(themeDir, "assets"), { recursive: true });
    const added = [];
    for (const file of files) {
      const absolute = resolve(file);
      if (!existsSync2(absolute)) throw new Error(`找不到文件 ${absolute}`);
      const mime = IMAGE_MIME[extname(absolute).toLowerCase()];
      if (mime === void 0) throw new Error(`${basename(absolute)}：只接受 webp/png/jpg/avif/gif`);
      const name = basename(absolute);
      copyFileSync(absolute, join2(themeDir, "assets", name));
      added.push({ src: `assets/${name}`, mime });
    }
    const first = added[0];
    const isAnimated = first.mime === "image/gif";
    raw.wallpaper = {
      kind: isAnimated ? "animated" : "image",
      light: mode === "dark" ? raw.wallpaper?.light ?? null : { src: first.src },
      dark: mode === "light" ? raw.wallpaper?.dark ?? null : { src: (added[1] ?? first).src }
    };
  });
}
function cmdWallpaperSet(paths, { positionals, flags }) {
  const id = positionals[0];
  if (typeof flags.src !== "string") return fail(EXIT.error, "用法：vft wallpaper set <id> --src assets/x.webp [--mode light|dark|both]");
  const mode = typeof flags.mode === "string" ? flags.mode : "both";
  return mutateUserTheme(paths, id, (raw) => {
    const side = { src: flags.src };
    raw.wallpaper = {
      kind: raw.wallpaper?.kind ?? "image",
      light: mode === "dark" ? raw.wallpaper?.light ?? null : side,
      dark: mode === "light" ? raw.wallpaper?.dark ?? null : side
    };
  });
}
function cmdWallpaperPending(command) {
  return fail(
    EXIT.confirm,
    `vft wallpaper ${command} 需要本机 ComfyUI（P6 接线）：目前请用 ComfyUI 生成图片后执行 vft wallpaper add`,
    { pending: "comfyui" }
  );
}
function cmdSidebarList(paths, { flags }) {
  const packs = Object.entries(SIDEBAR_PACKS).map(([id, pack]) => ({ id, ...pack }));
  const payload = { ok: true, packs };
  if (flags.json === true) return { exitCode: EXIT.ok, payload };
  return {
    exitCode: EXIT.ok,
    payload,
    text: packs.map((pack) => `${pack.id.padEnd(9)} surface=${pack.surface.padEnd(9)} blur=${String(pack.blur).padStart(2)} density=${pack.density}`).join("\n")
  };
}
function cmdSidebarSet(paths, { positionals }) {
  const [id, pack] = positionals;
  if (pack === void 0 || SIDEBAR_PACKS[pack] === void 0) {
    return fail(EXIT.error, `用法：vft sidebar set <id> <${Object.keys(SIDEBAR_PACKS).join("|")}>`);
  }
  return mutateUserTheme(paths, id, (raw) => {
    raw.sidebar = { ...raw.sidebar ?? {}, pack };
  });
}
function cmdSidebarTune(paths, { positionals, flags }) {
  const id = positionals[0];
  const numeric = (value) => value === void 0 ? void 0 : Number(value);
  const radiusCard = numeric(flags["radius-card"]);
  const radiusItem = numeric(flags["radius-item"]);
  return mutateUserTheme(paths, id, (raw) => {
    const sidebar = { ...raw.sidebar ?? {} };
    if (flags.blur !== void 0) sidebar.blur = numeric(flags.blur);
    if (flags.density !== void 0) sidebar.density = flags.density;
    if (radiusCard !== void 0 || radiusItem !== void 0) {
      sidebar.radius = {
        ...sidebar.radius ?? {},
        ...radiusCard === void 0 ? {} : { card: radiusCard },
        ...radiusItem === void 0 ? {} : { item: radiusItem }
      };
    }
    if (flags["icon-light"] !== void 0 || flags["icon-dark"] !== void 0) {
      sidebar.icon = {
        light: flags["icon-light"] ?? sidebar.icon?.light ?? "#333333",
        dark: flags["icon-dark"] ?? sidebar.icon?.dark ?? "#EEEEEE"
      };
    }
    raw.sidebar = sidebar;
  });
}
function cmdColorsSuggest(paths, { positionals, flags }) {
  const id = positionals[0];
  const found = findTheme(paths, id);
  if (found === null) return fail(EXIT.error, `找不到主题 "${id}"`);
  const theme = normalizeOrThrow(found.raw);
  const seed = typeof flags.seed === "string" ? flags.seed : theme.colors.light["--dsw-alias-brand-primary"];
  const ranked = rankPalettes(seed, { baseTheme: theme });
  const best = ranked[0];
  if (flags.apply === true) {
    if (found.kind !== "user") {
      return fail(EXIT.confirm, `"${id}" 是${found.kind}主题，只读；先 theme create --from ${id} --id <新id>`);
    }
    mutateUserTheme(paths, id, (raw) => {
      raw.colors = best.colors;
    });
  }
  const payload = {
    ok: true,
    id,
    seed,
    applied: flags.apply === true,
    candidates: ranked.map((entry) => ({ harmony: entry.harmony, score: entry.report.score, colors: entry.colors }))
  };
  if (flags.json === true) return { exitCode: EXIT.ok, payload };
  return {
    exitCode: EXIT.ok,
    payload,
    text: [`种子 ${seed}`, ...ranked.map((entry) => `  ${entry.harmony.padEnd(14)} ${String(entry.report.score).padStart(3)}`)].join("\n")
  };
}
function cmdBrandSet(paths, { positionals, flags }) {
  const id = positionals[0];
  return mutateUserTheme(paths, id, (raw) => {
    const brand = { ...raw.brand ?? {} };
    if (flags.title !== void 0 || flags["title-en"] !== void 0) {
      brand.title = {
        zh: flags.title ?? brand.title?.zh ?? raw.name.zh,
        en: flags["title-en"] ?? flags.title ?? brand.title?.en ?? raw.name.en
      };
    }
    if (flags.slogan !== void 0 || flags["slogan-en"] !== void 0) {
      brand.slogans = {
        zh: flags.slogan ?? brand.slogans?.zh ?? "",
        en: flags["slogan-en"] ?? flags.slogan ?? brand.slogans?.en ?? ""
      };
    }
    if (flags.mark !== void 0) brand.mark = flags.mark;
    raw.brand = brand;
  });
}
function cmdAppearanceSet(paths, { positionals, flags }) {
  const id = positionals[0];
  const number = (value) => Number(value);
  return mutateUserTheme(paths, id, (raw) => {
    if (flags["translucency-web"] !== void 0 || flags["translucency-desktop"] !== void 0) {
      raw.translucency = {
        ...raw.translucency ?? {},
        ...flags["translucency-web"] === void 0 ? {} : { web: number(flags["translucency-web"]) },
        ...flags["translucency-desktop"] === void 0 ? {} : { desktop: number(flags["translucency-desktop"]) }
      };
    }
    if (flags["coverage-shell"] !== void 0 || flags.scopes !== void 0) {
      const coverage = { ...raw.coverage ?? {} };
      if (flags["coverage-shell"] !== void 0) {
        coverage.shell = flags["coverage-shell"] === true || flags["coverage-shell"] === "on" || flags["coverage-shell"] === "true";
      }
      if (typeof flags.scopes === "string") coverage.scopes = flags.scopes.split(",").map((scope) => scope.trim()).filter(Boolean);
      raw.coverage = coverage;
    }
  });
}
function cmdThemeCheck(paths, { positionals, flags }) {
  const ids = positionals.length > 0 ? positionals : listIds(paths.userThemesDir);
  if (ids.length === 0) return fail(EXIT.error, "没有可检查的用户主题；指定一个 id 或先创建主题");
  const results = [];
  for (const id of ids) {
    const found = findTheme(paths, id);
    if (found === null) {
      results.push({ id, ok: false, error: "找不到主题", pass: false, score: 0 });
      continue;
    }
    try {
      const theme = normalizeOrThrow(found.raw);
      const report = scoreTheme(theme);
      results.push({ id, ok: true, score: report.score, pass: report.pass, failures: report.failures, excluded: report.excluded });
    } catch (error) {
      results.push({ id, ok: false, error: error.message, pass: false, score: 0, issues: error.issues ?? [] });
    }
  }
  const failed = results.filter((result) => !result.pass);
  const payload = { ok: failed.length === 0, threshold: SCORE_THRESHOLD, results };
  if (flags.json === true) {
    return { exitCode: failed.length === 0 ? EXIT.ok : EXIT.gate, payload };
  }
  const lines = results.map((result) => {
    if (!result.ok) return `INVALID ${result.id}: ${result.error}`;
    const head = `${result.pass ? "pass" : "FAIL"}  ${String(result.score).padStart(3)}  ${result.id}`;
    const detail = result.failures.map((failure) => `
         ! ${failure.dimension}/${failure.mode}: ${failure.fix}`);
    return [head, ...detail].join("");
  });
  return {
    exitCode: failed.length === 0 ? EXIT.ok : EXIT.gate,
    payload,
    text: [`配色门禁 · 阈值 ${SCORE_THRESHOLD}`, ...lines].join("\n")
  };
}
function usage() {
  return [
    "vft — vyra-free-theme CLI",
    "",
    "  vft theme list|show|create|rename|delete|apply|reset|export|import",
    "  vft wallpaper list|add|set|gen|video",
    "  vft sidebar list|set|tune",
    "  vft colors suggest <id> [--apply] [--seed #RRGGBB]",
    "  vft brand set <id> --title … --title-en … --slogan … --mark …",
    "  vft appearance set <id> --translucency-web 45 --coverage-shell on --scopes sidebar",
    "  vft theme check [id…] [--json]",
    "  vft reset                     回官方主题",
    "",
    "  --profile desktop|web   默认按数据目录存在情况推断",
    "  --json                  机器可读输出",
    "  exit: 0 成功 · 2 校验/配色未过 · 3 需确认 · 1 错误"
  ].join("\n");
}
async function run(argv, options = {}) {
  const { positionals, flags } = parseArgs(argv);
  const paths = resolvePaths({ dshHome: options.dshHome, profile: typeof flags.profile === "string" ? flags.profile : options.profile });
  const [group, action, ...rest] = positionals;
  const ctx = { positionals: rest, flags, paths };
  if (group === void 0 || flags.help === true) return { exitCode: EXIT.ok, payload: { ok: true }, text: usage() };
  if (group === "reset") return cmdReset(paths);
  try {
    if (group === "theme") {
      switch (action) {
        case "list":
          return cmdThemeList(paths, ctx);
        case "show":
          return cmdThemeShow(paths, ctx);
        case "create":
          return cmdThemeCreate(paths, ctx);
        case "rename":
          return cmdThemeRename(paths, ctx);
        case "delete":
          return cmdThemeDelete(paths, ctx);
        case "apply":
          return cmdThemeApply(paths, ctx);
        case "reset":
          return cmdThemeReset(paths, ctx);
        case "export":
          return cmdThemeExport(paths, ctx);
        case "import":
          return cmdThemeImport(paths, ctx);
        case "check":
          return cmdThemeCheck(paths, ctx);
        default:
          return fail(EXIT.error, `未知子命令 theme ${action ?? ""}`.trim());
      }
    }
    if (group === "wallpaper") {
      switch (action) {
        case "list":
          return cmdWallpaperList(paths, ctx);
        case "add":
          return cmdWallpaperAdd(paths, ctx);
        case "set":
          return cmdWallpaperSet(paths, ctx);
        case "gen":
          return cmdWallpaperPending("gen");
        case "video":
          return cmdWallpaperPending("video");
        default:
          return fail(EXIT.error, `未知子命令 wallpaper ${action ?? ""}`.trim());
      }
    }
    if (group === "sidebar") {
      switch (action) {
        case "list":
          return cmdSidebarList(paths, ctx);
        case "set":
          return cmdSidebarSet(paths, ctx);
        case "tune":
          return cmdSidebarTune(paths, ctx);
        default:
          return fail(EXIT.error, `未知子命令 sidebar ${action ?? ""}`.trim());
      }
    }
    if (group === "colors" && action === "suggest") return cmdColorsSuggest(paths, ctx);
    if (group === "brand" && action === "set") return cmdBrandSet(paths, ctx);
    if (group === "appearance" && action === "set") return cmdAppearanceSet(paths, ctx);
    return fail(EXIT.error, `未知命令 ${positionals.join(" ")}`);
  } catch (error) {
    return fail(EXIT.error, String(error?.message ?? error), { issues: error?.issues ?? null });
  }
}
function sidebarPreview(theme, bodyAttribute) {
  return sidebarCss(resolveSidebar(theme), bodyAttribute);
}
var isMain = process.argv[1] !== void 0 && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { exitCode, payload, text } = await run(process.argv.slice(2));
  const wantsJson = process.argv.includes("--json");
  if (wantsJson) process.stdout.write(`${JSON.stringify(payload, null, 2)}
`);
  else if (text !== void 0) process.stdout.write(`${text}
`);
  else if (payload?.error !== void 0) process.stderr.write(`${payload.error}
`);
  process.exit(exitCode);
}
export {
  findTheme,
  parseArgs,
  resolvePaths,
  run,
  sidebarPreview
};
