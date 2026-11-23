#!/usr/bin/env node

// cli/vft.mjs
import { copyFileSync, existsSync as existsSync2, mkdirSync as mkdirSync3, readdirSync, readFileSync as readFileSync3, renameSync as renameSync2, rmSync as rmSync2, statSync, writeFileSync as writeFileSync3 } from "node:fs";
import { basename, dirname as dirname2, extname, join as join3, resolve } from "node:path";
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
  let brand = { title: null, mark: null, favicon: null, slogans: { zh: "", en: "" }, heroMark: "auto" };
  if (raw.brand !== void 0) {
    if (!isPlainObject(raw.brand)) fail2("bad-brand", "brand", "brand 必须是对象");
    else {
      for (const key of Object.keys(raw.brand)) {
        if (!["title", "mark", "favicon", "slogans", "heroMark"].includes(key)) {
          fail2("unknown-key", `brand.${key}`, `未知字段 "${key}"`);
        }
      }
      if (raw.brand.heroMark !== void 0) {
        if (!["auto", "ring", "text", "none"].includes(raw.brand.heroMark)) {
          fail2("bad-brand", "brand.heroMark", "heroMark 必须是 auto / ring / text / none");
        } else {
          brand.heroMark = raw.brand.heroMark;
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

// src/shared/comfy-workflow.js
var TURBO_SIGMAS = Object.freeze([
  1,
  0.978453,
  0.95418,
  0.926626,
  0.89508,
  0.845148,
  0.704534,
  0.414568,
  0
]);
var QWEN_IMAGE_DEFAULTS = Object.freeze({
  unet: "qwen_image_2.1_turbo_int8_convrot.safetensors",
  clip: "qwen3vl_8b_w4a8.safetensors",
  vae: "qwen_image_2.1_vae_bf16.safetensors",
  sampler: "euler",
  cfg: 1,
  /** Bucket hint the 2.1 encoder wants; 1024 is the native conditioning size. */
  resolution: 1024,
  sigmas: TURBO_SIGMAS.join(", ")
});
var WALLPAPER_SIZES = Object.freeze({
  desktop: { width: 2048, height: 1280 },
  portrait: { width: 1024, height: 1536 },
  square: { width: 1280, height: 1280 }
});
function buildQwenImageWorkflow(options) {
  const {
    prompt,
    negative = "",
    width = WALLPAPER_SIZES.desktop.width,
    height = WALLPAPER_SIZES.desktop.height,
    seed = 1,
    cfg = QWEN_IMAGE_DEFAULTS.cfg,
    sampler = QWEN_IMAGE_DEFAULTS.sampler,
    resolution = QWEN_IMAGE_DEFAULTS.resolution,
    sigmas = QWEN_IMAGE_DEFAULTS.sigmas,
    unet = QWEN_IMAGE_DEFAULTS.unet,
    clip = QWEN_IMAGE_DEFAULTS.clip,
    vae = QWEN_IMAGE_DEFAULTS.vae,
    filenamePrefix = "vft/wallpaper"
  } = options;
  if (typeof prompt !== "string" || prompt.trim().length === 0) throw new Error("prompt is required");
  if (typeof sigmas !== "string" || sigmas.trim().length === 0) throw new Error("sigmas is required");
  return {
    "1": { class_type: "UNETLoader", inputs: { unet_name: unet, weight_dtype: "default" } },
    "2": { class_type: "CLIPLoader", inputs: { clip_name: clip, type: "qwen_image", device: "default" } },
    "3": { class_type: "VAELoader", inputs: { vae_name: vae } },
    "4": {
      class_type: "TextEncodeQwenImage21",
      inputs: { clip: ["2", 0], prompt, negative_prompt: negative, resolution }
    },
    "5": { class_type: "QwenImage21Cache", inputs: { model: ["1", 0], device: "auto", dtype: "default" } },
    "6": { class_type: "CFGGuider", inputs: { model: ["5", 0], positive: ["4", 0], negative: ["4", 1], cfg } },
    "7": { class_type: "KSamplerSelect", inputs: { sampler_name: sampler } },
    "8": { class_type: "RandomNoise", inputs: { noise_seed: seed } },
    "9": { class_type: "ManualSigmas", inputs: { sigmas } },
    "10": { class_type: "EmptyLatentImage", inputs: { width, height, batch_size: 1 } },
    "11": {
      class_type: "SamplerCustomAdvanced",
      inputs: {
        noise: ["8", 0],
        guider: ["6", 0],
        sampler: ["7", 0],
        sigmas: ["9", 0],
        latent_image: ["10", 0]
      }
    },
    "12": { class_type: "VAEDecode", inputs: { samples: ["11", 0], vae: ["3", 0] } },
    "13": { class_type: "SaveImage", inputs: { images: ["12", 0], filename_prefix: filenamePrefix } }
  };
}
function validateWorkflow(workflow) {
  const issues = [];
  if (workflow === null || typeof workflow !== "object") return ["workflow must be an object"];
  const ids = Object.keys(workflow);
  if (ids.length === 0) return ["workflow is empty"];
  for (const [id, node] of Object.entries(workflow)) {
    if (typeof node?.class_type !== "string") issues.push(`node ${id}: missing class_type`);
    if (node?.inputs === void 0 || typeof node.inputs !== "object") issues.push(`node ${id}: missing inputs`);
  }
  const outputs = ids.filter((id) => workflow[id].class_type === "SaveImage");
  if (outputs.length === 0) issues.push("no SaveImage node: the run would produce nothing retrievable");
  for (const [id, node] of Object.entries(workflow)) {
    for (const [key, value] of Object.entries(node.inputs ?? {})) {
      if (Array.isArray(value) && value.length === 2 && typeof value[0] === "string") {
        if (workflow[value[0]] === void 0) issues.push(`node ${id}.${key} references missing node ${value[0]}`);
      }
    }
  }
  const types = Object.values(workflow).map((node) => node.class_type);
  if (!types.includes("ManualSigmas")) issues.push("no ManualSigmas: the turbo checkpoint needs its own schedule or it renders mosaic noise");
  if (!types.includes("TextEncodeQwenImage21")) issues.push("no TextEncodeQwenImage21: a plain CLIPTextEncode does not fit the 2.1 text encoder");
  return issues;
}

// src/shared/comfy-video-workflow.js
var HUNYUAN_I2V_DEFAULTS = Object.freeze({
  unet: "hunyuanvideo1.5_720p_i2v_cfg_distilled_fp8_scaled.safetensors",
  clip: "qwen_2.5_vl_7b_fp8_scaled.safetensors",
  clipGlyph: "byt5_small_glyphxl_fp16.safetensors",
  clipVision: "sigclip_vision_patch14_384.safetensors",
  vae: "hunyuanvideo15_vae_fp16.safetensors",
  width: 1280,
  height: 720,
  fps: 24,
  steps: 20,
  shift: 7,
  cfg: 1,
  sampler: "euler",
  scheduler: "simple"
});
function framesForSeconds(seconds, fps = HUNYUAN_I2V_DEFAULTS.fps) {
  const wanted = Math.max(1, Math.round(seconds * fps));
  return Math.max(5, Math.round((wanted - 1) / 4) * 4 + 1);
}
function buildHunyuanI2VWorkflow(options) {
  const {
    image,
    prompt = "The scene breathes slowly: soft light drifts, gradients bloom and fade, gentle organic motion. Fixed camera, no cuts.",
    negative = "static, frozen, sudden motion, jump cut, shaking, text, watermark, people",
    width = HUNYUAN_I2V_DEFAULTS.width,
    height = HUNYUAN_I2V_DEFAULTS.height,
    seconds = 2,
    fps = HUNYUAN_I2V_DEFAULTS.fps,
    seed = 1,
    steps = HUNYUAN_I2V_DEFAULTS.steps,
    shift = HUNYUAN_I2V_DEFAULTS.shift,
    cfg = HUNYUAN_I2V_DEFAULTS.cfg,
    sampler = HUNYUAN_I2V_DEFAULTS.sampler,
    scheduler = HUNYUAN_I2V_DEFAULTS.scheduler,
    unet = HUNYUAN_I2V_DEFAULTS.unet,
    clip = HUNYUAN_I2V_DEFAULTS.clip,
    clipGlyph = HUNYUAN_I2V_DEFAULTS.clipGlyph,
    clipVision = HUNYUAN_I2V_DEFAULTS.clipVision,
    vae = HUNYUAN_I2V_DEFAULTS.vae,
    filenamePrefix = "vft/video"
  } = options;
  if (typeof image !== "string" || image.trim().length === 0) throw new Error("image is required");
  const length = options.frames ?? framesForSeconds(seconds, fps);
  return {
    "1": { class_type: "UNETLoader", inputs: { unet_name: unet, weight_dtype: "default" } },
    "2": {
      class_type: "DualCLIPLoader",
      inputs: { clip_name1: clip, clip_name2: clipGlyph, type: "hunyuan_video_15", device: "default" }
    },
    "3": { class_type: "VAELoader", inputs: { vae_name: vae } },
    "4": { class_type: "CLIPVisionLoader", inputs: { clip_name: clipVision } },
    "5": { class_type: "LoadImage", inputs: { image } },
    "6": { class_type: "CLIPVisionEncode", inputs: { clip_vision: ["4", 0], image: ["5", 0], crop: "center" } },
    "7": { class_type: "CLIPTextEncode", inputs: { text: prompt, clip: ["2", 0] } },
    "8": { class_type: "CLIPTextEncode", inputs: { text: negative, clip: ["2", 0] } },
    "9": {
      class_type: "HunyuanVideo15ImageToVideo",
      inputs: {
        positive: ["7", 0],
        negative: ["8", 0],
        vae: ["3", 0],
        start_image: ["5", 0],
        clip_vision_output: ["6", 0],
        width,
        height,
        length,
        batch_size: 1
      }
    },
    "10": { class_type: "ModelSamplingSD3", inputs: { model: ["1", 0], shift } },
    "11": { class_type: "BasicScheduler", inputs: { model: ["10", 0], scheduler, steps, denoise: 1 } },
    "12": { class_type: "KSamplerSelect", inputs: { sampler_name: sampler } },
    "13": { class_type: "RandomNoise", inputs: { noise_seed: seed } },
    "14": { class_type: "CFGGuider", inputs: { model: ["10", 0], positive: ["9", 0], negative: ["9", 1], cfg } },
    "15": {
      class_type: "SamplerCustomAdvanced",
      inputs: {
        noise: ["13", 0],
        guider: ["14", 0],
        sampler: ["12", 0],
        sigmas: ["11", 0],
        latent_image: ["9", 2]
      }
    },
    "16": { class_type: "VAEDecode", inputs: { samples: ["15", 0], vae: ["3", 0] } },
    "17": { class_type: "CreateVideo", inputs: { images: ["16", 0], fps } },
    "18": { class_type: "SaveVideo", inputs: { video: ["17", 0], filename_prefix: filenamePrefix, format: "auto", codec: "h264" } }
  };
}
function validateVideoWorkflow(workflow) {
  const issues = [];
  if (workflow === null || typeof workflow !== "object") return ["workflow must be an object"];
  const types = Object.values(workflow).map((node) => node?.class_type);
  if (!types.includes("HunyuanVideo15ImageToVideo")) issues.push("no HunyuanVideo15ImageToVideo: the start image would be ignored");
  if (!types.includes("LoadImage")) issues.push("no LoadImage: nothing to animate");
  if (!types.includes("CLIPVisionEncode")) issues.push("no CLIPVisionEncode: the clip drifts away from the still");
  if (!types.includes("ModelSamplingSD3")) issues.push("no ModelSamplingSD3: this checkpoint renders washed out without its shift");
  if (!types.includes("SaveVideo")) issues.push("no SaveVideo: the run would produce no clip");
  const video = Object.values(workflow).find((node) => node?.class_type === "SaveVideo");
  const length = Object.values(workflow).find((node) => node?.class_type === "HunyuanVideo15ImageToVideo")?.inputs?.length;
  if (typeof length === "number" && (length - 1) % 4 !== 0) issues.push(`length ${length} is not 4n+1: HunyuanVideo 1.5 drops the remainder`);
  if (video !== void 0 && workflow[video.inputs.video?.[0]] === void 0) issues.push("SaveVideo references a missing node");
  return issues;
}

// src/host/comfy.js
var DEFAULT_BASE = "http://127.0.0.1:8188";
function authHeader(auth) {
  if (typeof auth !== "string" || auth.length === 0) return null;
  if (auth.startsWith("Basic ")) return { authorization: auth };
  if (auth.startsWith("Bearer ")) return { authorization: auth };
  return { authorization: `Basic ${Buffer.from(auth, "utf8").toString("base64")}` };
}
function comfyConfigFromEnv(env = process.env) {
  const baseUrl = env.COMFYUI_URL?.trim() || DEFAULT_BASE;
  const auth = env.COMFYUI_AUTH?.trim() || env.COMFYUI_BASIC_AUTH?.trim() || "";
  return { baseUrl: baseUrl.replace(/\/+$/, ""), auth };
}
function createComfyClient(options = {}) {
  const config = { ...comfyConfigFromEnv(options.env), ...options };
  const baseUrl = String(config.baseUrl ?? DEFAULT_BASE).replace(/\/+$/, "");
  const fetchImpl = config.fetchImpl ?? fetch;
  const sleep = config.sleep ?? ((ms) => new Promise((resolve2) => setTimeout(resolve2, ms)));
  const headers = { "content-type": "application/json", ...authHeader(config.auth) ?? {} };
  async function call(path, init = {}) {
    const response = await fetchImpl(`${baseUrl}${path}`, { ...init, headers: { ...headers, ...init.headers ?? {} } });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`ComfyUI ${path} → HTTP ${response.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
    }
    return response;
  }
  return {
    baseUrl,
    /** Queue one API-format workflow; returns its prompt id. */
    async submit(workflow, { clientId = "vyra-free-theme" } = {}) {
      const response = await call("/prompt", { method: "POST", body: JSON.stringify({ prompt: workflow, client_id: clientId }) });
      const body = await response.json();
      if (body?.error !== void 0) throw new Error(`ComfyUI rejected the workflow: ${JSON.stringify(body.error).slice(0, 300)}`);
      const promptId = body?.prompt_id;
      if (typeof promptId !== "string") throw new Error("ComfyUI did not return a prompt_id");
      return promptId;
    },
    /** Poll until the prompt appears in history; returns its output files. */
    async wait(promptId, { timeoutMs = 6e5, intervalMs = 2e3, onTick } = {}) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const response = await call(`/history/${encodeURIComponent(promptId)}`);
        const history = await response.json();
        const entry = history?.[promptId];
        if (entry !== void 0) {
          const status = entry.status ?? {};
          if (status.status_str === "error") {
            const message = status.messages?.find((pair) => pair?.[0] === "execution_error")?.[1]?.exception_message ?? "execution error";
            throw new Error(`ComfyUI execution failed: ${message}`);
          }
          const files = [];
          for (const output of Object.values(entry.outputs ?? {})) {
            for (const key of ["images", "videos", "gifs"]) {
              for (const file of output?.[key] ?? []) files.push(file);
            }
          }
          if (files.length > 0) {
            const images = files.filter((file) => /\.(png|jpe?g|webp)$/i.test(file.filename ?? ""));
            return { files, images, entry };
          }
        }
        onTick?.({ promptId, waitedMs: timeoutMs - Math.max(0, deadline - Date.now()) });
        await sleep(intervalMs);
      }
      throw new Error(`ComfyUI 在 ${Math.round(timeoutMs / 1e3)} 秒内没有完成 prompt ${promptId}`);
    },
    /**
     * Upload one local image so a LoadImage node can reference it.
     * Returns the filename to put in the node (ComfyUI may rename on conflict).
     */
    async uploadImage(buffer, filename, { overwrite = true } = {}) {
      const form = new FormData();
      form.append("image", new Blob([buffer]), filename);
      form.append("overwrite", overwrite ? "true" : "false");
      const response = await call("/upload/image", { method: "POST", body: form, headers: {} });
      const body = await response.json();
      const stored = body?.name ?? filename;
      return body?.subfolder ? `${body.subfolder}/${stored}` : stored;
    },
    /** Download one output image as bytes. */
    async download(image) {
      const query = new URLSearchParams({
        filename: image.filename,
        subfolder: image.subfolder ?? "",
        type: image.type ?? "output"
      });
      const response = await call(`/view?${query.toString()}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      return buffer;
    },
    /**
     * Reachability probe with the HTTP status kept, so "down" and "needs auth"
     * give different advice instead of one useless message. A 401 here is a
     * configuration fact, not a crash: ComfyUI is running and wants COMFYUI_AUTH.
     */
    async probe() {
      try {
        const response = await fetchImpl(`${baseUrl}/system_stats`, { headers });
        return { reachable: true, ok: response.ok, status: response.status };
      } catch (error) {
        return { reachable: false, ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
      }
    },
    /** Cheap reachability probe used for a clear error instead of a hang. */
    async ping() {
      const probe = await this.probe();
      return probe.ok;
    }
  };
}

// src/shared/png-stats.js
import { deflateSync, inflateSync } from "node:zlib";
var PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
function isPng(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length > 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE);
}
var CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 3988292384 ^ value >>> 1 : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();
function crc32(buffer) {
  let crc = 4294967295;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 255] ^ crc >>> 8;
  return (crc ^ 4294967295) >>> 0;
}
function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}
function decodePng(buffer) {
  if (!isPng(buffer)) throw new Error("not a PNG");
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat = [];
  let palette = null;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "PLTE") {
      palette = data;
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
  }
  if (width <= 0 || height <= 0) throw new Error("PNG has no dimensions");
  if (bitDepth !== 8) throw new Error(`unsupported PNG bit depth ${bitDepth}`);
  if (interlace !== 0) throw new Error("interlaced PNG is not supported");
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (channels === void 0) throw new Error(`unsupported PNG colour type ${colorType}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(stride * height);
  let previous = Buffer.alloc(stride);
  for (let row = 0; row < height; row += 1) {
    const filter = raw[row * (stride + 1)];
    const line = raw.subarray(row * (stride + 1) + 1, row * (stride + 1) + 1 + stride);
    const target = out.subarray(row * stride, row * stride + stride);
    for (let index = 0; index < stride; index += 1) {
      const left = index >= channels ? target[index - channels] : 0;
      const up = previous[index];
      const upLeft = index >= channels ? previous[index - channels] : 0;
      let value;
      switch (filter) {
        case 0:
          value = line[index];
          break;
        case 1:
          value = line[index] + left;
          break;
        case 2:
          value = line[index] + up;
          break;
        case 3:
          value = line[index] + (left + up >> 1);
          break;
        case 4:
          value = line[index] + paeth(left, up, upLeft);
          break;
        default:
          throw new Error(`unknown PNG filter ${filter}`);
      }
      target[index] = value & 255;
    }
    previous = target;
  }
  return { width, height, channels, colorType, palette, data: out };
}
function lumaAt(image, pixelIndex) {
  const { channels, colorType, data, palette } = image;
  if (colorType === 3) {
    const entry = data[pixelIndex];
    if (palette === null || entry * 3 + 2 >= palette.length) return 0;
    const r = palette[entry * 3];
    const g = palette[entry * 3 + 1];
    const b = palette[entry * 3 + 2];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  if (channels === 1) return data[pixelIndex];
  if (channels === 2) return data[pixelIndex * 2];
  const base = pixelIndex * channels;
  return 0.2126 * data[base] + 0.7152 * data[base + 1] + 0.0722 * data[base + 2];
}
function imageStats(buffer, { step = 1 } = {}) {
  const image = decodePng(buffer);
  const stride = Math.max(1, Math.floor(step));
  const values = [];
  const rows = [];
  for (let y = 0; y < image.height; y += stride) {
    const row = [];
    for (let x = 0; x < image.width; x += stride) {
      const luma = lumaAt(image, y * image.width + x);
      row.push(luma);
      values.push(luma);
    }
    rows.push(row);
  }
  const count = values.length;
  const mean = count === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / count;
  const variance = count === 0 ? 0 : values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / count;
  const stdLuma = Math.sqrt(variance) / 255;
  let edgeTotal = 0;
  let edgeCount = 0;
  for (const row of rows) {
    for (let index = 1; index < row.length; index += 1) {
      edgeTotal += Math.abs(row[index] - row[index - 1]);
      edgeCount += 1;
    }
  }
  for (let y = 1; y < rows.length; y += 1) {
    for (let x = 0; x < rows[y].length; x += 1) {
      edgeTotal += Math.abs(rows[y][x] - rows[y - 1][x]);
      edgeCount += 1;
    }
  }
  const edgeEnergy = edgeCount === 0 ? 0 : Math.min(1, edgeTotal / edgeCount / 255);
  return { width: image.width, height: image.height, stdLuma: Number(stdLuma.toFixed(4)), edgeEnergy: Number(edgeEnergy.toFixed(4)) };
}
function encodePng({ width, height, pixels }) {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeAndData));
    return Buffer.concat([length, typeAndData, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

// src/shared/art-design.js
var FOG = Object.freeze({ light: [232, 236, 240], dark: [18, 22, 30] });
var clampByte2 = (value) => Math.min(255, Math.max(0, Math.round(value)));
var lerp = (a, b, t) => a + (b - a) * t;
var smoothstep = (t) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};
function grade(rgb, { shadowShift = [2, 4, 12], highlightShift = [6, 3, -4] } = {}) {
  const [r, g, b] = rgb;
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const shadow = 1 - luma;
  return [
    clampByte2(r + shadowShift[0] * shadow + highlightShift[0] * luma),
    clampByte2(g + shadowShift[1] * shadow + highlightShift[1] * luma),
    clampByte2(b + shadowShift[2] * shadow + highlightShift[2] * luma)
  ];
}
function tonalLadder(t, dark, mid, light) {
  const x = Math.min(1, Math.max(0, t));
  const eased = smoothstep(x);
  const from = eased < 0.5 ? dark : mid;
  const to = eased < 0.5 ? mid : light;
  const local = eased < 0.5 ? eased * 2 : (eased - 0.5) * 2;
  return [lerp(from[0], to[0], local), lerp(from[1], to[1], local), lerp(from[2], to[2], local)];
}
function atmosphere(rgb, fog, amount) {
  const a = Math.min(1, Math.max(0, amount));
  return [lerp(rgb[0], fog[0], a), lerp(rgb[1], fog[1], a), lerp(rgb[2], fog[2], a)];
}
function vignette(u, v, { strength = 0.28, radius = 0.75, cx = 0.5, cy = 0.5 } = {}) {
  const d = Math.hypot(u - cx, v - cy) / radius;
  return 1 - Math.min(1, d * d) * strength;
}
function quietZone(u, v, { cx = 0.42, cy = 0.44, rx = 0.62, ry = 0.52, strength = 0.34 } = {}) {
  const d = Math.hypot((u - cx) / rx, (v - cy) / ry);
  return smoothstep(1 - d) * strength;
}
var BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5]
];
function dither(x, y, amplitude = 1.6) {
  const value = BAYER[y & 3][x & 3] / 15 - 0.5;
  return value * amplitude;
}
function grain(x, y, seed, amplitude = 3.2) {
  let h = x * 374761393 + y * 668265263 + seed * 2147483647 >>> 0;
  h = (h ^ h >>> 13) * 1274126177 >>> 0;
  h = (h ^ h >>> 16) >>> 0;
  return (h % 1e3 / 1e3 - 0.5) * amplitude;
}
function screenBlend(rgb, glow2, amount) {
  const a = Math.min(1, Math.max(0, amount));
  const screen = (base, light) => 255 - (255 - base) * (255 - light) / 255;
  return [
    lerp(rgb[0], screen(rgb[0], glow2[0] * 255), a),
    lerp(rgb[1], screen(rgb[1], glow2[1] * 255), a),
    lerp(rgb[2], screen(rgb[2], glow2[2] * 255), a)
  ];
}
function loopPhase(time, duration, cycles = 1, phase = 0) {
  const span = duration > 0 ? duration : 1;
  const cyclesInt = Math.max(1, Math.round(cycles));
  const fraction = (time / span % 1 + 1) % 1;
  return fraction * Math.PI * 2 * cyclesInt + phase;
}
function loopSwing(time, duration, cycles = 1, phase = 0) {
  return 0.5 - 0.5 * Math.cos(loopPhase(time, duration, cycles, phase));
}
function softBlob(u, v, { cx, cy, radius, feather = 2.4 }) {
  const d = Math.hypot(u - cx, v - cy) / radius;
  if (d >= 1) return 0;
  return (1 - d) ** feather;
}
function bloom(u, v, { cx, cy, radius, strength = 0.8 }) {
  const d = Math.hypot(u - cx, v - cy) / radius;
  if (d >= 1) return 0;
  return (1 - d) ** 3 * strength;
}
function makeFbm(seed) {
  let state = seed >>> 0;
  const random = () => {
    state = state * 1664525 + 1013904223 >>> 0;
    return state / 4294967296;
  };
  const grids = [];
  for (let octave = 0; octave < 4; octave += 1) {
    const size = 4 << octave;
    const table = new Float32Array((size + 1) * (size + 1));
    for (let index = 0; index < table.length; index += 1) table[index] = random();
    grids.push({ size, table });
  }
  const sample = (grid, u, v) => {
    const x = u * grid.size;
    const y = v * grid.size;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = smoothstep(x - x0);
    const ty = smoothstep(y - y0);
    const at = (gx, gy) => grid.table[gy % (grid.size + 1) * (grid.size + 1) + gx % (grid.size + 1)];
    const top = lerp(at(x0, y0), at(x0 + 1, y0), tx);
    const bottom = lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), tx);
    return lerp(top, bottom, ty);
  };
  return (u, v, { octaves = 3, gain = 0.5 } = {}) => {
    let value = 0;
    let amplitude = 1;
    let total = 0;
    for (let octave = 0; octave < Math.min(octaves, grids.length); octave += 1) {
      value += sample(grids[octave], u, v) * amplitude;
      total += amplitude;
      amplitude *= gain;
    }
    return value / total;
  };
}
function finishPixel(rgb, { u, v, x, y, seed = 1, quiet = 0.34, vignetteStrength = 0.26, grainAmount = 2.6, ditherAmount = 1.4, surface = [20, 24, 32] }) {
  let out = grade(rgb);
  const calm = quietZone(u, v, { strength: quiet });
  if (calm > 0) out = atmosphere(out, surface, calm);
  const vig = vignette(u, v, { strength: vignetteStrength });
  out = [out[0] * vig, out[1] * vig, out[2] * vig];
  const offset = dither(x, y, ditherAmount) + grain(x, y, seed, grainAmount);
  return [clampByte2(out[0] + offset), clampByte2(out[1] + offset), clampByte2(out[2] + offset)];
}

// src/shared/art-recipes-premium.js
var clampByte3 = (value) => Math.min(255, Math.max(0, Math.round(value)));
var clamp01 = (value) => Math.min(1, Math.max(0, value));
var lerp2 = (a, b, t) => a + (b - a) * t;
function paintPixels(width, height, fn) {
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = fn(x / width, y / height, x, y);
      const base = (y * width + x) * 3;
      pixels[base] = clampByte3(r);
      pixels[base + 1] = clampByte3(g);
      pixels[base + 2] = clampByte3(b);
    }
  }
  return pixels;
}
function paint(width, height, fn) {
  return encodePng({ width, height, pixels: paintPixels(width, height, fn) });
}
function addLight(pixels, width, height, cx, cy, radius, colour, intensity) {
  const reach = Math.ceil(radius);
  for (let dy = -reach; dy <= reach; dy += 1) {
    const py = Math.round(cy) + dy;
    if (py < 0 || py >= height) continue;
    for (let dx = -reach; dx <= reach; dx += 1) {
      const px = Math.round(cx) + dx;
      if (px < 0 || px >= width) continue;
      const d = Math.hypot(dx, dy) / radius;
      if (d >= 1) continue;
      const weight = (1 - d) ** 3 * intensity;
      const base = (py * width + px) * 3;
      pixels[base] = clampByte3(pixels[base] + colour[0] * weight);
      pixels[base + 1] = clampByte3(pixels[base + 1] + colour[1] * weight);
      pixels[base + 2] = clampByte3(pixels[base + 2] + colour[2] * weight);
    }
  }
}
var seedRandom = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = state * 1664525 + 1013904223 >>> 0;
    return state / 4294967296;
  };
};
function starfield({ width, height, seed, time = 0, duration = 0, tone = "light" }) {
  const fbm = makeFbm(seed);
  const random = seedRandom(seed);
  const stars = Array.from({ length: 780 }, () => ({
    u: random(),
    v: random(),
    size: 0.5 + random() * 1.9,
    bright: 0.35 + random() * 0.65,
    warm: random() > 0.78,
    // integer harmonics only: every star returns to its start on the last frame
    cycle: 1 + Math.floor(random() * 2),
    phase: random() * Math.PI * 2
  }));
  const drift = loopSwing(time, duration || 1, 1);
  const pixels = paintPixels(width, height, (u, v, x, y) => {
    const depth = clamp01((v - 0.08) / 0.92);
    let rgb = tonalLadder(depth, [7, 8, 18], [12, 14, 34], [26, 22, 54]);
    const veil = fbm(u * 1.5 + 0.11 + drift * 0.02, v * 1.25 - 0.07, { octaves: 4 });
    const core = fbm(u * 3.1 - 0.23, v * 2.7 + 0.19, { octaves: 3 });
    const band = Math.exp(-((v - 0.42 - drift * 0.01) ** 2) / 0.045);
    rgb = screenBlend(rgb, [0.16, 0.1, 0.42], band * veil * 0.85);
    rgb = screenBlend(rgb, [0.34, 0.12, 0.3], Math.max(0, core - 0.45) * 1.6);
    rgb = screenBlend(rgb, [0.55, 0.42, 1], bloom(u, v, { cx: 0.34, cy: 0.36, radius: 0.46, strength: 0.42 }));
    rgb = screenBlend(rgb, [0.3, 0.78, 0.86], bloom(u, v, { cx: 0.76, cy: 0.66, radius: 0.3, strength: 0.2 }));
    return finishPixel(rgb, { u, v, x, y, seed, quiet: tone === "dark" ? 0.3 : 0.4, surface: [10, 11, 24], grainAmount: 2.2 });
  });
  for (const star of stars) {
    const phase = loopPhase(time, duration || 1, star.cycle, star.phase);
    const sway = Math.sin(phase) * 0.012;
    const cx = (star.u + sway) * (width - 1);
    const cy = star.v * (height - 1);
    const twinkle = 0.72 + 0.28 * (0.5 + 0.5 * Math.cos(phase * 3));
    addLight(pixels, width, height, cx, cy, Math.max(1.4, star.size * 2.4), star.warm ? [255, 214, 178] : [206, 218, 255], star.bright * twinkle);
  }
  return encodePng({ width, height, pixels });
}
function inkWash({ width, height, seed, time = 0, duration = 0, tone = "light" }) {
  const fiber = makeFbm(seed + 17);
  const cloud = makeFbm(seed + 41);
  const dark = tone === "dark";
  const paper = dark ? [26, 28, 33] : [247, 242, 232];
  const paperLight = dark ? [40, 43, 50] : [253, 249, 242];
  const ink = dark ? [176, 188, 200] : [24, 26, 28];
  const fog = dark ? [18, 20, 26] : [236, 230, 218];
  const ridges = [
    { base: 0.5, amp: 0.055, freq: 1.7, phase: 0.2, density: 0.26, fog: 0.42 },
    { base: 0.6, amp: 0.08, freq: 1.15, phase: 1.6, density: 0.42, fog: 0.3 },
    { base: 0.72, amp: 0.055, freq: 2.3, phase: 3.1, density: 0.66, fog: 0.16 },
    { base: 0.85, amp: 0.038, freq: 3.2, phase: 5.2, density: 0.9, fog: 0.05 }
  ];
  const drift = Math.sin(loopPhase(time, duration || 1, 1)) * 4e-3;
  return paint(width, height, (u, v, x, y) => {
    const fibre = fiber(u * 3.1, v * 3.1, { octaves: 3 });
    const stain = cloud(u * 1.2 + 0.3, v * 1.1 - 0.2, { octaves: 2 });
    let rgb = tonalLadder(0.25 + stain * 0.35, paper, paperLight, paperLight);
    rgb = [rgb[0] + (fibre - 0.5) * 7, rgb[1] + (fibre - 0.5) * 6.4, rgb[2] + (fibre - 0.5) * 5.6];
    for (const ridge of ridges) {
      const warp = (cloud(u * 2.4 + ridge.phase, v * 0.6, { octaves: 3 }) - 0.5) * ridge.amp * 1.1;
      const profile = ridge.base + Math.sin((u * ridge.freq + ridge.phase + drift) * Math.PI * 2) * ridge.amp + Math.sin((u * ridge.freq * 2.6 + ridge.phase) * Math.PI * 2) * ridge.amp * 0.3 + warp;
      if (v < profile) continue;
      const depth = Math.min(1, (v - profile) / 0.2);
      const wet = Math.exp(-((v - profile) ** 2) / 35e-6) * 0.3;
      const density = Math.min(1, ridge.density * (0.5 + depth * 0.7) + wet);
      const texture = 0.9 + fiber(u * 7, v * 7, { octaves: 2 }) * 0.2;
      const ridgeColour = atmosphere(ink, fog, ridge.fog + (1 - depth) * 0.1);
      rgb = [
        lerp2(rgb[0], ridgeColour[0], density * texture),
        lerp2(rgb[1], ridgeColour[1], density * texture),
        lerp2(rgb[2], ridgeColour[2], density * texture)
      ];
    }
    const fade = clamp01((v - 0.8) / 0.2);
    rgb = atmosphere(rgb, paper, fade ** 1.6 * 0.55);
    return finishPixel(rgb, {
      u,
      v,
      x,
      y,
      seed,
      quiet: dark ? 0.34 : 0.28,
      surface: paper,
      grainAmount: dark ? 2.4 : 3,
      vignetteStrength: dark ? 0.3 : 0.16
    });
  });
}
function fluid({ width, height, seed, time = 0, duration = 0, tone = "light" }) {
  const warpField = makeFbm(seed);
  const flowField = makeFbm(seed + 91);
  const dark = tone === "dark";
  const clock = loopSwing(time, duration || 1, 1) * 0.12;
  const deep = dark ? [10, 16, 30] : [30, 34, 58];
  const mid = dark ? [22, 62, 82] : [56, 132, 140];
  const bright = dark ? [46, 132, 150] : [236, 178, 168];
  return paint(width, height, (u, v, x, y) => {
    const w1 = warpField(u + clock, v - clock * 0.6, { octaves: 4 });
    const w2 = warpField(u + w1 * 0.42 - clock * 0.4, v - w1 * 0.3 + clock * 0.25, { octaves: 3 });
    const flow = flowField(u + w2 * 0.55, v + w1 * 0.45 - clock * 0.18, { octaves: 3 });
    const ridge = 1 - Math.abs(flow * 2 - 1);
    let rgb = tonalLadder(ridge, deep, mid, bright);
    rgb = screenBlend(rgb, [0.5, 0.75, 0.9], bloom(u, v, { cx: 0.66, cy: 0.34, radius: 0.42, strength: 0.22 }));
    rgb = screenBlend(rgb, [0.9, 0.55, 0.5], bloom(u, v, { cx: 0.3, cy: 0.7, radius: 0.34, strength: 0.14 }));
    return finishPixel(rgb, { u, v, x, y, seed, quiet: dark ? 0.3 : 0.36, surface: deep, grainAmount: 2.2, vignetteStrength: 0.24 });
  });
}
function auroraBlobs({ width, height, seed, time = 0, duration = 0 }) {
  const haze = makeFbm(seed + 13);
  const span = duration || 1;
  const slow = loopPhase(time, span, 1);
  const breathe = loopPhase(time, span, 2);
  const blobs = [
    { tint: [0.909, 0.271, 0.604], cx: 0.34, cy: 0.4, r: 0.3, ox: 0.055, oy: 0.035, phase: 0, strength: 0.98 },
    { tint: [1, 0.71, 0.278], cx: 0.63, cy: 0.32, r: 0.24, ox: 0.04, oy: 0.05, phase: 2.1, strength: 0.74 },
    { tint: [0.478, 0.302, 1], cx: 0.5, cy: 0.68, r: 0.34, ox: 0.06, oy: 0.028, phase: 4.2, strength: 0.62 }
  ];
  const base = [11, 6, 16];
  return paint(width, height, (u, v, x, y) => {
    let rgb = tonalLadder(clamp01(v * 0.55 + 0.15), base, [24, 12, 32], [40, 21, 54]);
    rgb = atmosphere(rgb, [11, 6, 16], 0.25);
    const cloud = haze(u * 1.4 + slow * 0.06, v * 1.2, { octaves: 3 }) - 0.5;
    rgb = [rgb[0] + cloud * 6, rgb[1] + cloud * 4, rgb[2] + cloud * 8];
    let heat = 0;
    for (const blob of blobs) {
      const cx = blob.cx + Math.sin(slow + blob.phase) * blob.ox;
      const cy = blob.cy + Math.cos(slow + blob.phase) * blob.oy;
      const radius = blob.r * (1 + Math.sin(breathe + blob.phase) * 0.06);
      const field = softBlob(u, v, { cx, cy, radius, feather: 2.6 });
      heat += field * blob.strength;
      rgb = screenBlend(rgb, blob.tint, field * blob.strength);
    }
    rgb = screenBlend(rgb, [1, 0.94, 0.98], clamp01((heat - 0.58) / 0.5) * 0.55);
    rgb = screenBlend(rgb, [0.35, 0.2, 0.5], bloom(u, v, { cx: 0.42, cy: 0.48, radius: 0.9, strength: 0.14 }));
    return finishPixel(rgb, {
      u,
      v,
      x,
      y,
      seed,
      quiet: 0.22,
      surface: [11, 6, 16],
      grainAmount: 2.4,
      vignetteStrength: 0.34,
      ditherAmount: 1.8
    });
  });
}
function liquidBlob({ width, height, seed, time = 0, duration = 0 }) {
  const surface = makeFbm(seed + 29);
  const span = duration || 1;
  const slow = loopPhase(time, span, 1);
  const balls = [
    { cx: 0.46, cy: 0.46, r: 0.26, ax: 0.1, ay: 0.07, phase: 0 },
    { cx: 0.58, cy: 0.52, r: 0.2, ax: 0.08, ay: 0.09, phase: 1.7 },
    { cx: 0.4, cy: 0.6, r: 0.17, ax: 0.07, ay: 0.05, phase: 3.4 },
    { cx: 0.56, cy: 0.4, r: 0.13, ax: 0.09, ay: 0.06, phase: 5.1 }
  ];
  const ink = [86, 58, 255];
  const deep = [9, 7, 20];
  return paint(width, height, (u, v, x, y) => {
    let field = 0;
    for (const ball of balls) {
      const cx = ball.cx + Math.sin(slow + ball.phase) * ball.ax;
      const cy = ball.cy + Math.cos(slow * 2 + ball.phase) * ball.ay;
      const radius = ball.r * (1 + Math.sin(slow + ball.phase * 1.5) * 0.1);
      field += softBlob(u, v, { cx, cy, radius, feather: 3.2 }) * (0.55 + radius);
    }
    const body = clamp01((field - 0.42) / 0.34);
    const rim = Math.exp(-((field - 0.46) ** 2) / 4e-3) * 0.9;
    let rgb = tonalLadder(clamp01(v * 0.6), deep, [18, 13, 38], [28, 20, 54]);
    const sheen = surface(u * 2.2 + slow * 0.08, v * 2 - slow * 0.05, { octaves: 3 });
    rgb = screenBlend(rgb, [ink[0] / 255, ink[1] / 255, ink[2] / 255], body * (0.85 + sheen * 0.45));
    rgb = screenBlend(rgb, [0.72, 0.62, 1], rim * 0.75);
    rgb = [rgb[0] * (1 + body * 0.12), rgb[1] * (1 + body * 0.1), rgb[2] * (1 + body * 0.12)];
    rgb = screenBlend(rgb, [0.86, 0.8, 1], clamp01((body - 0.5) / 0.5) * 0.4);
    return finishPixel(rgb, {
      u,
      v,
      x,
      y,
      seed,
      quiet: 0.22,
      surface: deep,
      grainAmount: 2.4,
      vignetteStrength: 0.32
    });
  });
}
function inkRibbon({ width, height, seed, time = 0, duration = 0, tone = "light" }) {
  const paper = tone === "dark" ? [22, 23, 28] : [246, 243, 235];
  const ink = tone === "dark" ? [188, 198, 210] : [22, 24, 27];
  const accent = tone === "dark" ? [96, 156, 230] : [43, 84, 160];
  const fibre = makeFbm(seed + 5);
  const span = duration || 1;
  const slow = loopPhase(time, span, 1);
  const drift = Math.sin(slow) * 0.018;
  return paint(width, height, (u, v, x, y) => {
    const grainField = fibre(u * 3.4, v * 3.4, { octaves: 3 });
    let rgb = [paper[0] + (grainField - 0.5) * 5, paper[1] + (grainField - 0.5) * 5, paper[2] + (grainField - 0.5) * 4];
    const centre = 0.44 + Math.sin((u * 1.15 + 0.1 + drift) * Math.PI * 2) * 0.1 + Math.sin((u * 2.3 - 0.35) * Math.PI * 2) * 0.045;
    const widthField = 0.035 + Math.sin((u * 1.7 + 0.6) * Math.PI * 2) * 0.012;
    const d = Math.abs(v - centre);
    if (d < widthField) {
      const edge = clamp01(1 - (d / widthField) ** 4);
      rgb = [lerp2(rgb[0], ink[0], edge), lerp2(rgb[1], ink[1], edge), lerp2(rgb[2], ink[2], edge)];
    } else if (d < widthField * 2.4) {
      const echo = 1 - (d - widthField) / (widthField * 1.4);
      const weight = clamp01(echo) ** 2 * 0.22;
      rgb = [lerp2(rgb[0], ink[0], weight), lerp2(rgb[1], ink[1], weight), lerp2(rgb[2], ink[2], weight)];
    }
    if (Math.abs(v - 0.52) < 0.03 && u > 0.12 && u < 0.42) {
      rgb = [lerp2(rgb[0], accent[0], 0.85), lerp2(rgb[1], accent[1], 0.85), lerp2(rgb[2], accent[2], 0.85)];
    }
    rgb = atmosphere(rgb, paper, clamp01((u - 0.1) / 0.5) * 0.18);
    return finishPixel(rgb, {
      u,
      v,
      x,
      y,
      seed,
      quiet: tone === "dark" ? 0.26 : 0.2,
      surface: paper,
      grainAmount: tone === "dark" ? 2.2 : 2.6,
      vignetteStrength: tone === "dark" ? 0.28 : 0.14
    });
  });
}
function magnetField({ width, height, seed, time = 0, duration = 0, tone = "light" }) {
  const dark = tone === "dark";
  const paper = dark ? [24, 26, 30] : [244, 241, 234];
  const charcoal = dark ? [214, 210, 200] : [30, 42, 47];
  const accent = dark ? [42, 178, 160] : [15, 156, 140];
  const span = duration || 1;
  const slow = loopPhase(time, span, 1);
  const dot = Math.max(1.6, Math.min(width, height) / 300);
  const count = 1200;
  const pixels = paintPixels(width, height, (u, v, x, y) => {
    let rgb = paper;
    const lift = dark ? 0 : 2.5;
    rgb = [rgb[0] + lift, rgb[1] + lift, rgb[2] + lift];
    return finishPixel(rgb, { u, v, x, y, seed, quiet: 0.16, surface: paper, grainAmount: dark ? 2 : 1.6, vignetteStrength: dark ? 0.24 : 0.1 });
  });
  for (let index = 0; index < count; index += 1) {
    const angle = index * 2.399963229728653;
    const radius = Math.sqrt(index / count) * 0.52;
    const swirl = slow + radius * 2.4;
    const u = 0.5 + Math.cos(angle + swirl) * radius * 1.18;
    const v = 0.5 + Math.sin(angle + swirl) * radius * 0.94;
    if (u < 0 || u > 1 || v < 0 || v > 1) continue;
    const depth = clamp01(1 - radius / 0.52);
    const focal = Math.hypot(u - 0.62, v - 0.38) < 0.16;
    const colour = focal ? accent : charcoal;
    const alpha = (0.55 + depth * 0.4) * (focal ? 1 : 0.9);
    const cx = u * (width - 1);
    const cy = v * (height - 1);
    const half = dot / 2;
    for (let dy = 0; dy < Math.ceil(dot); dy += 1) {
      for (let dx = 0; dx < Math.ceil(dot); dx += 1) {
        const px = Math.round(cx - half + dx);
        const py = Math.round(cy - half + dy);
        if (px < 0 || py < 0 || px >= width || py >= height) continue;
        const base = (py * width + px) * 3;
        pixels[base] = clampByte3(lerp2(pixels[base], colour[0], alpha));
        pixels[base + 1] = clampByte3(lerp2(pixels[base + 1], colour[1], alpha));
        pixels[base + 2] = clampByte3(lerp2(pixels[base + 2], colour[2], alpha));
      }
    }
  }
  return encodePng({ width, height, pixels });
}
function silk({ width, height, seed, time = 0, duration = 0, tone = "dark" }) {
  const folds = makeFbm(seed + 7);
  const dark = tone === "dark";
  const shadow = dark ? [16, 18, 26] : [222, 214, 206];
  const mid = dark ? [38, 42, 56] : [238, 228, 216];
  const light = dark ? [126, 132, 156] : [252, 248, 242];
  const gold = [196, 168, 122];
  const drift = Math.sin(loopPhase(time, duration || 1, 1)) * 0.05;
  return paint(width, height, (u, v, x, y) => {
    const s = u * 0.82 + v * 0.28 + drift;
    const t = v * 0.94 - u * 0.16;
    const fold = folds(s * 1.6, t * 3.4, { octaves: 4 });
    const ridge = 1 - Math.abs(fold * 2 - 1);
    const sheen = Math.max(0, ridge - 0.72) * 3.2;
    let rgb = tonalLadder(ridge, shadow, mid, light);
    rgb = screenBlend(rgb, [gold[0] / 255, gold[1] / 255, gold[2] / 255], sheen * 0.3);
    rgb = screenBlend(rgb, [0.9, 0.93, 1], bloom(u, v, { cx: 0.62, cy: 0.3, radius: 0.5, strength: 0.12 }));
    return finishPixel(rgb, { u, v, x, y, seed, quiet: 0.3, surface: shadow, grainAmount: 2.6, vignetteStrength: 0.3 });
  });
}
function auroraVeil({ width, height, seed, time = 0, duration = 0 }) {
  const curtains = makeFbm(seed + 3);
  const random = seedRandom(seed + 5);
  const stars = Array.from({ length: 220 }, () => ({ u: random(), v: random() * 0.7, b: 0.2 + random() * 0.6 }));
  const span = duration || 1;
  const slow = loopPhase(time, span, 1);
  const ripplePhase = loopPhase(time, span, 2);
  const pixels = paintPixels(width, height, (u, v, x, y) => {
    let rgb = tonalLadder(Math.min(1, v / 0.9), [6, 8, 20], [10, 14, 34], [18, 22, 48]);
    const layers = [
      { cx: 0.32, width: 0.17, tint: [0.22, 0.85, 0.72], speed: 1, strength: 0.74 },
      { cx: 0.52, width: 0.13, tint: [0.35, 0.95, 0.62], speed: 2, strength: 0.38 },
      { cx: 0.71, width: 0.2, tint: [0.5, 0.45, 1], speed: 1, strength: 0.3 }
    ];
    for (const layer of layers) {
      const sway = Math.sin(slow * layer.speed + layer.cx * 6) * 0.022;
      const ripple = (curtains(u * 1.3 + layer.cx * 4, v * 0.55 + ripplePhase * 0.03, { octaves: 3 }) - 0.5) * 0.16;
      const centre = layer.cx + sway + ripple * 0.4;
      const d = Math.abs(u - centre) / layer.width;
      const vertical = Math.exp(-((v - 0.3) ** 2) / 0.09) * (1 - clamp01((v - 0.55) / 0.45) * 0.6);
      const edge = Math.exp(-(d ** 4));
      rgb = screenBlend(rgb, layer.tint, edge * vertical * layer.strength);
    }
    rgb = screenBlend(rgb, [0.2, 0.6, 0.5], bloom(u, v, { cx: 0.5, cy: 0.78, radius: 0.55, strength: 0.16 }));
    return finishPixel(rgb, { u, v, x, y, seed, quiet: 0.3, surface: [8, 10, 22], grainAmount: 2, vignetteStrength: 0.3 });
  });
  for (const star of stars) {
    const cx = star.u * (width - 1);
    const cy = star.v * (height - 1);
    addLight(pixels, width, height, cx, cy, 2.2, [220, 230, 250], star.b * 0.8);
  }
  return encodePng({ width, height, pixels });
}
var PREMIUM_FNS = Object.freeze({
  starfield,
  "ink-wash": inkWash,
  fluid,
  "aurora-blobs": auroraBlobs,
  "liquid-blob": liquidBlob,
  "ink-ribbon": inkRibbon,
  "magnet-field": magnetField,
  silk,
  "aurora-veil": auroraVeil
});
var PREMIUM_META = Object.freeze({
  "aurora-blobs": {
    label: { zh: "极光色团", en: "Aurora blobs" },
    description: "三团柔光色场 + 单一主光，深梅黑底，8 秒无缝循环；最接近高级主视觉的做法"
  },
  "liquid-blob": {
    label: { zh: "液态色块", en: "Liquid blob" },
    description: "单一高饱和色相的金属球融合，形状自身分裂回流，没有硬切"
  },
  "ink-ribbon": {
    label: { zh: "墨带", en: "Ink ribbon" },
    description: "纸面上只有一条丝带，带一层回声轮廓，文字区保持干净"
  },
  "magnet-field": {
    label: { zh: "磁点场", en: "Magnet field" },
    description: "暖纸底 + 一千余方形点缓慢涡旋，青色只出现在焦点环"
  },
  silk: {
    label: { zh: "绸缎", en: "Silk" },
    description: "斜向褶皱 + 金色光泽 + 最安静的对比，长文阅读友好"
  },
  "aurora-veil": {
    label: { zh: "极光幕", en: "Aurora veil" },
    description: "三层视差光幕 + 星点 + 地平辉光，无缝循环"
  }
});
var PREMIUM_ANIMATED = Object.freeze([
  "starfield",
  "fluid",
  "aurora-blobs",
  "liquid-blob",
  "magnet-field",
  "aurora-veil"
]);

// src/shared/art-recipes.js
var ART_RECIPES_BASE = Object.freeze({
  starfield: {
    label: { zh: "星云", en: "Starfield" },
    description: "深空底色 + 星云光雾 + 三层星点，静帧版的星云主题"
  },
  "ink-wash": {
    label: { zh: "水墨", en: "Ink wash" },
    description: "宣纸底 + 米氏云山剪影 + 飞白噪点，静帧版的山水主题"
  },
  fluid: {
    label: { zh: "流体", en: "Fluid" },
    description: "域扭曲噪声 + 双色映射，柔和的抽象流体"
  },
  "neon-grid": {
    label: { zh: "霓虹网格", en: "Neon grid" },
    description: "地平线辉光 + 透视网格 + 扫描线"
  },
  "paper-grain": {
    label: { zh: "纸纹", en: "Paper grain" },
    description: "暖纸底 + 纤维噪声 + 暗角"
  },
  "ridge-dawn": {
    label: { zh: "晨雾山脊", en: "Ridge at dawn" },
    description: "分层山脊 + 大气透视 + 天光渐变"
  }
});
var ART_RECIPES = Object.freeze({ ...ART_RECIPES_BASE, ...PREMIUM_META });
function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = state + 1831565813 >>> 0;
    let t = state;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
var clamp = (value) => Math.min(255, Math.max(0, Math.round(value)));
var mix = (a, b, t) => a + (b - a) * t;
var smoothstep2 = (t) => t * t * (3 - 2 * t);
function makeNoise(random, gridSize = 8) {
  const table = new Float32Array((gridSize + 1) * (gridSize + 1));
  for (let index = 0; index < table.length; index += 1) table[index] = random();
  const at = (x, y) => table[y % (gridSize + 1) * (gridSize + 1) + x % (gridSize + 1)];
  return (u, v) => {
    const x = u * gridSize;
    const y = v * gridSize;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = smoothstep2(x - x0);
    const ty = smoothstep2(y - y0);
    const top = mix(at(x0, y0), at(x0 + 1, y0), tx);
    const bottom = mix(at(x0, y0 + 1), at(x0 + 1, y0 + 1), tx);
    return mix(top, bottom, ty);
  };
}
function paint2(width, height, fn) {
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = fn(x / width, y / height, x, y);
      const base = (y * width + x) * 3;
      pixels[base] = clamp(r);
      pixels[base + 1] = clamp(g);
      pixels[base + 2] = clamp(b);
    }
  }
  return pixels;
}
function finish(width, height, pixels) {
  return encodePng({ width, height, pixels });
}
function glow(u, v, cx, cy, radius, strength) {
  const dx = u - cx;
  const dy = v - cy;
  const d = Math.sqrt(dx * dx + dy * dy) / radius;
  if (d >= 1) return 0;
  return (1 - d) ** 2 * strength;
}
var RECIPE_FNS = {
  starfield({ width, height, seed, time = 0 }) {
    const random = mulberry32(seed);
    const haze = makeNoise(random, 6);
    const stars = Array.from({ length: 900 }, () => ({
      u: random(),
      v: random(),
      size: 0.4 + random() * 1.8,
      bright: 60 + random() * 195,
      tint: random(),
      phase: random() * Math.PI * 2,
      speed: 3e-3 + random() * 0.01
    }));
    const shimmer = 0.5 + 0.5 * Math.sin(time * 0.9);
    const px = paint2(width, height, (u, v) => {
      const depth = 1 - v;
      let r = mix(16, 6, depth);
      let g = mix(13, 4, depth);
      let b = mix(38, 12, depth);
      const hazeValue = haze(u * 1.4 + 0.1, v * 1.1);
      const band = Math.exp(-((v - 0.45) ** 2) / 0.05) * hazeValue * (0.8 + 0.4 * shimmer);
      r += band * 70 + glow(u, v, 0.32, 0.34, 0.42, 42);
      g += band * 34 + glow(u, v, 0.32, 0.34, 0.42, 24);
      b += band * 120 + glow(u, v, 0.32, 0.34, 0.42, 92);
      r += glow(u, v, 0.76, 0.66, 0.3, 46);
      g += glow(u, v, 0.76, 0.66, 0.3, 18);
      b += glow(u, v, 0.76, 0.66, 0.3, 74);
      return [r, g, b];
    });
    for (const star of stars) {
      const driftU = (star.u + time * star.speed) % 1;
      const cx = Math.round(driftU * (width - 1));
      const cy = Math.round(star.v * (height - 1));
      const radius = star.size;
      const twinkle = 0.78 + 0.22 * Math.sin(time * 2.1 + star.phase);
      const bright = star.bright * twinkle;
      const tintR = mix(bright, bright * 0.72, star.tint);
      const tintB = mix(bright, bright * 1, star.tint);
      for (let dy = -Math.ceil(radius * 2); dy <= Math.ceil(radius * 2); dy += 1) {
        for (let dx = -Math.ceil(radius * 2); dx <= Math.ceil(radius * 2); dx += 1) {
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || y < 0 || x >= width || y >= height) continue;
          const d = Math.sqrt(dx * dx + dy * dy) / (radius * 2);
          if (d > 1) continue;
          const weight = (1 - d) ** 3;
          const base = (y * width + x) * 3;
          px[base] = clamp(px[base] + tintR * weight);
          px[base + 1] = clamp(px[base + 1] + tintR * 0.92 * weight);
          px[base + 2] = clamp(px[base + 2] + tintB * weight);
        }
      }
    }
    return finish(width, height, px);
  },
  "ink-wash"({ width, height, seed, tone = "light" }) {
    const random = mulberry32(seed);
    const fiber = makeNoise(random, 24);
    const dark = tone === "dark";
    const paper = dark ? [22, 24, 28] : [246, 241, 231];
    const inkTones = dark ? [0.42, 0.32, 0.22, 0.14] : [0.34, 0.52, 0.76, 0.95];
    const ridges = [
      { y: 0.52, amp: 0.055, freq: 2.1, shift: 0 },
      { y: 0.62, amp: 0.075, freq: 1.5, shift: 1.7 },
      { y: 0.76, amp: 0.05, freq: 2.8, shift: 3.1 },
      { y: 0.88, amp: 0.035, freq: 3.6, shift: 5.3 }
    ].map((ridge, index) => ({ ...ridge, tone: inkTones[index] }));
    const specks = Array.from({ length: 420 }, () => ({ u: random(), v: 0.45 + random() * 0.55, s: random() }));
    return finish(width, height, paint2(width, height, (u, v) => {
      const grain2 = (fiber(u * 3, v * 3) - 0.5) * (dark ? 8 : 14);
      let r = paper[0] + grain2;
      let g = paper[1] + grain2;
      let b = paper[2] + grain2 * 0.8;
      r -= Math.abs(Math.sin(u * 220 + v * 8)) * 2.4;
      g -= Math.abs(Math.sin(u * 220 + v * 8)) * 2.2;
      const inkRgb = dark ? [186, 196, 206] : [28, 30, 30];
      for (const ridge of ridges) {
        const profile = ridge.y + Math.sin((u * ridge.freq + ridge.shift) * Math.PI * 2) * ridge.amp + Math.sin((u * ridge.freq * 2.7 + ridge.shift) * Math.PI * 2) * ridge.amp * 0.32;
        if (v < profile) continue;
        const depth = Math.min(1, (v - profile) / 0.22);
        const wet = Math.exp(-((v - profile) ** 2) / 4e-5) * 0.35;
        const ink = (ridge.tone * (0.55 + depth * 0.45) + wet) * (0.92 + fiber(u * 9, v * 9) * 0.16);
        r = mix(r, inkRgb[0], Math.min(0.94, ink));
        g = mix(g, inkRgb[1], Math.min(0.94, ink));
        b = mix(b, inkRgb[2], Math.min(0.94, ink));
      }
      for (const speck of specks) {
        const dx = (u - speck.u) * width;
        const dy = (v - speck.v) * height;
        if (dx * dx + dy * dy < 2.2 + speck.s * 3) {
          r = mix(r, inkRgb[0], 0.35);
          g = mix(g, inkRgb[1], 0.35);
          b = mix(b, inkRgb[2], 0.35);
        }
      }
      const fade = smoothstep2(Math.min(1, Math.max(0, (v - 0.82) / 0.18)));
      return [
        mix(r, paper[0] + 2, fade * 0.75),
        mix(g, paper[1] + 2, fade * 0.75),
        mix(b, paper[2] + 2, fade * 0.75)
      ];
    }));
  },
  fluid({ width, height, seed, time = 0 }) {
    const random = mulberry32(seed);
    const warp = makeNoise(random, 10);
    const flow = makeNoise(random, 5);
    const clock = time * 0.06;
    return finish(width, height, paint2(width, height, (u, v) => {
      const w1 = warp(u + clock, v - clock * 0.6);
      const w2 = warp(u + w1 * 0.35 - clock * 0.4, v - w1 * 0.28 + clock * 0.3);
      const t = Math.min(1, Math.max(0, flow(u + w2 * 0.5 + clock * 0.2, v + w1 * 0.4 - clock * 0.15)));
      const violet = [58, 44, 128];
      const teal = [38, 138, 148];
      const blush = [214, 132, 168];
      const mid = t < 0.5 ? t * 2 : (t - 0.5) * 2;
      const base = t < 0.5 ? [mix(violet[0], teal[0], mid), mix(violet[1], teal[1], mid), mix(violet[2], teal[2], mid)] : [mix(teal[0], blush[0], mid), mix(teal[1], blush[1], mid), mix(teal[2], blush[2], mid)];
      const sheen = (1 - Math.abs(w2 - 0.5) * 2) * 26;
      return [base[0] + sheen, base[1] + sheen * 0.8, base[2] + sheen * 1.1];
    }));
  },
  "neon-grid"({ width, height, seed }) {
    const random = mulberry32(seed);
    const sky = makeNoise(random, 7);
    const horizon = 0.62;
    return finish(width, height, paint2(width, height, (u, v) => {
      if (v < horizon) {
        const depth2 = 1 - v / horizon;
        let r2 = mix(58, 12, depth2);
        let g2 = mix(16, 6, depth2);
        let b2 = mix(86, 22, depth2);
        r2 += sky(u, v) * 40;
        b2 += sky(u, v) * 70;
        r2 += glow(u, v, 0.5, horizon, 0.45, 90);
        g2 += glow(u, v, 0.5, horizon, 0.45, 30);
        b2 += glow(u, v, 0.5, horizon, 0.45, 120);
        return [r2, g2, b2];
      }
      const depth = (v - horizon) / (1 - horizon);
      const scale = 1 / Math.max(1e-4, depth);
      const horizonGlow = Math.exp(-depth * 5) * 120;
      const gx = Math.abs(u * scale * 6 % 1 - 0.5);
      const gy = Math.abs(scale * 0.9 % 1 - 0.5);
      const line = Math.min(gx, gy);
      const glowLine = Math.max(0, 1 - line / 0.06);
      const scan = 0.5 + 0.5 * Math.sin(v * 900);
      let r = 8 + horizonGlow * 0.5;
      let g = 4 + horizonGlow * 0.25;
      let b = 18 + horizonGlow * 0.8;
      r += glowLine * (120 + 90 * (1 - depth));
      g += glowLine * (40 + 30 * (1 - depth));
      b += glowLine * (200 + 55 * (1 - depth));
      const dim = 0.85 + scan * 0.15;
      return [r * dim, g * dim, b * dim];
    }));
  },
  "paper-grain"({ width, height, seed }) {
    const random = mulberry32(seed);
    const fiber = makeNoise(random, 36);
    return finish(width, height, paint2(width, height, (u, v) => {
      const grain2 = (fiber(u * 5, v * 5) - 0.5) * 10 + (random() - 0.5) * 6;
      const vignette2 = 1 - Math.min(1, (Math.hypot(u - 0.5, v - 0.5) / 0.85) ** 2) * 0.28;
      return [
        (243 + grain2) * vignette2,
        (234 + grain2) * vignette2,
        (214 + grain2 * 0.9) * vignette2
      ];
    }));
  },
  "ridge-dawn"({ width, height, seed }) {
    const random = mulberry32(seed);
    const haze = makeNoise(random, 8);
    const layers = [
      { base: 0.5, amp: 0.06, freq: 1.7, tone: [148, 150, 168], phase: 0.4 },
      { base: 0.6, amp: 0.08, freq: 1.2, tone: [112, 118, 140], phase: 1.9 },
      { base: 0.72, amp: 0.06, freq: 2.4, tone: [74, 82, 104], phase: 3.4 },
      { base: 0.84, amp: 0.04, freq: 3.1, tone: [42, 48, 66], phase: 5.1 }
    ];
    return finish(width, height, paint2(width, height, (u, v) => {
      const skyT = Math.min(1, v / 0.65);
      let r = mix(252, 214, skyT);
      let g = mix(226, 186, skyT);
      let b = mix(198, 176, skyT);
      r += glow(u, v, 0.72, 0.34, 0.5, 60);
      g += glow(u, v, 0.72, 0.34, 0.5, 40);
      b += glow(u, v, 0.72, 0.34, 0.5, 18);
      for (const layer of layers) {
        const profile = layer.base + Math.sin((u * layer.freq + layer.phase) * Math.PI * 2) * layer.amp + Math.sin((u * layer.freq * 3.1 + layer.phase) * Math.PI * 2) * layer.amp * 0.28;
        if (v < profile) continue;
        const blend = 0.78 + haze(u * 2, v * 2) * 0.22;
        r = mix(r, layer.tone[0] * blend, 0.9);
        g = mix(g, layer.tone[1] * blend, 0.9);
        b = mix(b, layer.tone[2] * blend, 0.9);
      }
      return [r, g, b];
    }));
  }
};
Object.assign(RECIPE_FNS, PREMIUM_FNS);
function renderArt(recipe, options = {}) {
  const fn = RECIPE_FNS[recipe];
  if (fn === void 0) {
    throw new Error(`unknown art recipe "${recipe}" (available: ${Object.keys(RECIPE_FNS).join(", ")})`);
  }
  const width = Math.max(16, Math.min(4096, Math.round(options.width ?? 1024)));
  const height = Math.max(16, Math.min(4096, Math.round(options.height ?? 1536)));
  const seed = Number.isFinite(options.seed) ? Math.abs(Math.floor(options.seed)) : 1;
  const time = Number.isFinite(options.time) ? options.time : 0;
  const duration = Number.isFinite(options.duration) && options.duration > 0 ? options.duration : 0;
  return fn({ width, height, seed, time, duration, tone: options.tone === "dark" ? "dark" : "light" });
}
var ANIMATED_RECIPES = PREMIUM_ANIMATED;

// src/host/art-video.js
import { spawnSync } from "node:child_process";
import { mkdirSync as mkdirSync2, mkdtempSync, readFileSync as readFileSync2, rmSync, writeFileSync as writeFileSync2 } from "node:fs";
import { dirname, join as join2 } from "node:path";
import { tmpdir } from "node:os";
var MAX_BYTES = 50 * 1024 * 1024;
function hasFfmpeg(ffmpegPath = process.env.FFMPEG_PATH ?? "ffmpeg") {
  const result = spawnSync(ffmpegPath, ["-version"], { encoding: "utf8" });
  return result.status === 0;
}
function renderArtVideo(options) {
  const {
    recipe,
    width,
    height,
    seed = 1,
    tone = "light",
    frames = 48,
    fps = 24,
    crf = 20,
    output,
    posterPath,
    ffmpegPath = process.env.FFMPEG_PATH ?? "ffmpeg"
  } = options;
  const frameCount = Math.max(2, Math.min(240, Math.round(frames)));
  const frameRate = Math.max(1, Math.min(60, Math.round(fps)));
  const work = mkdtempSync(join2(tmpdir(), "vft-anim-"));
  const duration = frameCount / frameRate;
  try {
    let poster = null;
    for (let index = 0; index < frameCount; index += 1) {
      const png = renderArt(recipe, { width, height, seed, tone, time: index / frameRate, duration });
      if (index === 0) poster = png;
      writeFileSync2(join2(work, `frame-${String(index).padStart(4, "0")}.png`), png);
    }
    mkdirSync2(dirname(output), { recursive: true });
    const result = spawnSync(ffmpegPath, [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-framerate",
      String(frameRate),
      "-i",
      join2(work, "frame-%04d.png"),
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-crf",
      String(crf),
      "-movflags",
      "+faststart",
      "-an",
      output
    ], { encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error(`ffmpeg failed: ${(result.stderr ?? "").slice(0, 400) || `exit ${result.status}`}`);
    }
    const bytes = readFileSync2(output).byteLength;
    if (bytes > MAX_BYTES) throw new Error(`generated clip is ${Math.round(bytes / 1024 / 1024)}MB, over the 50MB wallpaper limit`);
    if (posterPath !== void 0) writeFileSync2(posterPath, poster);
    return { bytes, frames: frameCount, fps: frameRate, poster };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

// cli/vft.mjs
var PACKAGE_ROOT = resolve(dirname2(fileURLToPath(import.meta.url)), "..");
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
  const home = resolve(dshHome ?? process.env.DSH_HOME ?? join3(homedir(), ".dsh"));
  const resolvedProfile = profile ?? (existsSync2(join3(home, "vyra-free-theme-desktop")) ? "desktop" : "web");
  const dataDir = join3(home, resolvedProfile === "desktop" ? "vyra-free-theme-desktop" : "vyra-free-theme");
  return {
    home,
    profile: resolvedProfile,
    dataDir,
    userThemesDir: join3(dataDir, "themes"),
    selectionFile: join3(dataDir, "selection.json"),
    stateFile: join3(dataDir, "state.json"),
    packageRoot: PACKAGE_ROOT
  };
}
function sources(paths) {
  return [
    { kind: "user", dir: paths.userThemesDir },
    { kind: "builtin", dir: join3(paths.packageRoot, "themes") },
    { kind: "preset", dir: join3(paths.packageRoot, "presets", "colors") }
  ];
}
function listIds(dir) {
  if (!existsSync2(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory() && existsSync2(join3(dir, entry.name, "theme.json"))).map((entry) => entry.name).sort();
}
function findTheme(paths, id) {
  for (const source of sources(paths)) {
    const dir = join3(source.dir, id);
    const file = join3(dir, "theme.json");
    if (!existsSync2(file)) continue;
    let raw;
    try {
      raw = JSON.parse(readFileSync3(file, "utf8"));
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
  mkdirSync3(dirname2(file), { recursive: true });
  const stage = `${file}.tmp-${process.pid}`;
  writeFileSync3(stage, `${JSON.stringify(value, null, 2)}
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
  writeJsonAtomic(join3(found.dir, "theme.json"), next);
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
        raw = JSON.parse(readFileSync3(join3(source.dir, id, "theme.json"), "utf8"));
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
  const targetDir = join3(paths.userThemesDir, id);
  if (existsSync2(targetDir)) return fail(EXIT.confirm, `"${id}" 已存在；先删除或换一个 id`);
  const next = JSON.parse(JSON.stringify(found.raw));
  next.id = id;
  if (typeof flags.name === "string") next.name = { zh: flags.name, en: typeof flags["name-en"] === "string" ? flags["name-en"] : flags.name };
  if (typeof flags["name-en"] === "string" && next.name.en === next.name.zh) next.name.en = flags["name-en"];
  next.version = next.version ?? "0.1.0";
  normalizeOrThrow(next);
  mkdirSync3(targetDir, { recursive: true });
  writeJsonAtomic(join3(targetDir, "theme.json"), next);
  const assetsDir = join3(found.dir, "assets");
  if (existsSync2(assetsDir)) {
    mkdirSync3(join3(targetDir, "assets"), { recursive: true });
    for (const name of readdirSync(assetsDir)) {
      copyFileSync(join3(assetsDir, name), join3(targetDir, "assets", name));
    }
  }
  const entry = extname(found.dir) === ".js" ? null : join3(found.dir, found.raw.wallpaper?.entry ?? "");
  if (found.raw.wallpaper?.kind === "code" && entry !== null && existsSync2(entry)) {
    copyFileSync(entry, join3(targetDir, found.raw.wallpaper.entry));
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
  rmSync2(found.dir, { recursive: true, force: true });
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
    state = JSON.parse(readFileSync3(paths.stateFile, "utf8"));
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
  mkdirSync3(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const source = join3(from, entry.name);
    const target = join3(to, entry.name);
    if (entry.isDirectory()) copyDirRecursive(source, target);
    else copyFileSync(source, target);
  }
}
function cmdThemeImport(paths, { positionals, flags }) {
  const fromDir = resolve(positionals[0] ?? "");
  if (!existsSync2(join3(fromDir, "theme.json"))) return fail(EXIT.error, `"${fromDir}" 不是主题目录（缺 theme.json）`);
  let raw;
  try {
    raw = JSON.parse(readFileSync3(join3(fromDir, "theme.json"), "utf8"));
  } catch (error) {
    return fail(EXIT.error, `theme.json 解析失败：${error.message}`);
  }
  if (typeof flags.id === "string") raw.id = flags.id;
  const theme = normalizeOrThrow(raw);
  const targetDir = join3(paths.userThemesDir, theme.id);
  if (existsSync2(targetDir)) return fail(EXIT.confirm, `"${theme.id}" 已存在；换 id 或先删除`);
  copyDirRecursive(fromDir, targetDir);
  writeJsonAtomic(join3(targetDir, "theme.json"), raw);
  return { exitCode: EXIT.ok, payload: { ok: true, id: theme.id, dir: targetDir }, text: `已导入 ${theme.id} → ${targetDir}` };
}
var IMAGE_MIME = { ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".avif": "image/avif", ".gif": "image/gif" };
function cmdWallpaperList(paths, { positionals, flags }) {
  const id = positionals[0];
  const found = findTheme(paths, id);
  if (found === null) return fail(EXIT.error, `找不到主题 "${id}"`);
  const assetsDir = join3(found.dir, "assets");
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
    const themeDir = join3(paths.userThemesDir, id);
    mkdirSync3(join3(themeDir, "assets"), { recursive: true });
    const added = [];
    for (const file of files) {
      const absolute = resolve(file);
      if (!existsSync2(absolute)) throw new Error(`找不到文件 ${absolute}`);
      const mime = IMAGE_MIME[extname(absolute).toLowerCase()];
      if (mime === void 0) throw new Error(`${basename(absolute)}：只接受 webp/png/jpg/avif/gif`);
      const name = basename(absolute);
      copyFileSync(absolute, join3(themeDir, "assets", name));
      if (extname(name).toLowerCase() === ".png") {
        try {
          recordWallpaperStats(themeDir, mode, readFileSync3(absolute));
        } catch {
        }
      }
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
function cmdWallpaperRecipes({ flags }) {
  const recipes = Object.entries(ART_RECIPES).map(([id, recipe]) => ({ id, ...recipe }));
  if (flags.json === true) return { exitCode: EXIT.ok, payload: { ok: true, recipes } };
  return {
    exitCode: EXIT.ok,
    payload: { ok: true, recipes },
    text: recipes.map((recipe) => `${recipe.id.padEnd(12)} ${recipe.label.zh}  ${recipe.description}`).join("\n")
  };
}
async function cmdWallpaperAnim(paths, { positionals, flags }) {
  const id = positionals[0];
  const recipe = typeof flags.recipe === "string" ? flags.recipe : null;
  if (recipe === null || !ANIMATED_RECIPES.includes(recipe)) {
    return fail(EXIT.error, `用法：vft wallpaper anim <id> --recipe <${ANIMATED_RECIPES.join("|")}> [--size portrait|desktop|square] [--frames 48] [--fps 24] [--side light|dark|both] [--seed N]`);
  }
  const found = findTheme(paths, id);
  if (found === null) return fail(EXIT.error, `找不到主题 "${id}"`);
  if (found.kind !== "user") return fail(EXIT.confirm, `"${id}" 是${found.kind}主题，只读；先 theme create --from ${id} --id <新id>`);
  const ffmpegPath = typeof flags.ffmpeg === "string" ? flags.ffmpeg : process.env.FFMPEG_PATH ?? "ffmpeg";
  if (!hasFfmpeg(ffmpegPath)) {
    return fail(EXIT.confirm, `找不到 ffmpeg（试过 "${ffmpegPath}"）：动态壁纸需要它编码 mp4；用 --ffmpeg 指定，或改用 wallpaper art 生成静帧`, { missing: "ffmpeg" });
  }
  const size = WALLPAPER_SIZES[typeof flags.size === "string" ? flags.size : "portrait"] ?? WALLPAPER_SIZES.portrait;
  const seed = flags.seed === void 0 ? 1 : Number(flags.seed);
  const frames = flags.frames === void 0 ? 48 : Number(flags.frames);
  const fps = flags.fps === void 0 ? 24 : Number(flags.fps);
  const side = typeof flags.side === "string" ? flags.side : "both";
  if (!["light", "dark", "both"].includes(side)) return fail(EXIT.error, "--side 只能是 light / dark / both");
  const themeDir = join3(paths.userThemesDir, id);
  mkdirSync3(join3(themeDir, "assets"), { recursive: true });
  const baseName = typeof flags.file === "string" ? flags.file.replace(/\.(mp4|webm)$/i, "") : `${recipe}-${seed}`;
  const mp4 = join3(themeDir, "assets", `${baseName}.mp4`);
  const poster = join3(themeDir, "assets", `${baseName}.png`);
  const result = renderArtVideo({
    recipe,
    width: size.width,
    height: size.height,
    seed,
    tone: flags.tone === "dark" ? "dark" : "light",
    frames,
    fps,
    crf: flags.crf === void 0 ? 20 : Number(flags.crf),
    output: mp4,
    posterPath: poster,
    ffmpegPath
  });
  const videoSide = { src: `assets/${baseName}.mp4`, poster: `assets/${baseName}.png` };
  const applied = mutateUserTheme(paths, id, (raw) => {
    raw.wallpaper = {
      kind: "video",
      light: side === "dark" ? raw.wallpaper?.light ?? null : videoSide,
      dark: side === "light" ? raw.wallpaper?.dark ?? null : videoSide
    };
  });
  if (applied.exitCode !== EXIT.ok) return applied;
  const stats = recordWallpaperStats(themeDir, side, result.poster);
  return {
    exitCode: EXIT.ok,
    payload: { ok: true, id, recipe, file: videoSide.src, poster: videoSide.poster, bytes: result.bytes, frames: result.frames, fps: result.fps, side, stats },
    text: `已生成动态壁纸 ${videoSide.src}（${result.frames} 帧 @${result.fps}fps，${Math.round(result.bytes / 1024)} KB）`
  };
}
async function cmdWallpaperArt(paths, { positionals, flags }) {
  const id = positionals[0];
  const recipe = typeof flags.recipe === "string" ? flags.recipe : null;
  if (recipe === null || ART_RECIPES[recipe] === void 0) {
    return fail(EXIT.error, `用法：vft wallpaper art <id> --recipe <${Object.keys(ART_RECIPES).join("|")}> [--size portrait|desktop|square] [--side light|dark|both] [--seed N]`);
  }
  const found = findTheme(paths, id);
  if (found === null) return fail(EXIT.error, `找不到主题 "${id}"`);
  if (found.kind !== "user") return fail(EXIT.confirm, `"${id}" 是${found.kind}主题，只读；先 theme create --from ${id} --id <新id>`);
  const size = WALLPAPER_SIZES[typeof flags.size === "string" ? flags.size : "portrait"] ?? WALLPAPER_SIZES.portrait;
  const seed = flags.seed === void 0 ? 1 : Number(flags.seed);
  const side = typeof flags.side === "string" ? flags.side : "both";
  if (!["light", "dark", "both"].includes(side)) return fail(EXIT.error, "--side 只能是 light / dark / both");
  const buffer = renderArt(recipe, { width: size.width, height: size.height, seed });
  const themeDir = join3(paths.userThemesDir, id);
  mkdirSync3(join3(themeDir, "assets"), { recursive: true });
  const fileName = typeof flags.file === "string" ? flags.file : `${recipe}-${seed}.png`;
  writeFileSync3(join3(themeDir, "assets", fileName), buffer);
  const src = `assets/${fileName}`;
  const applied = mutateUserTheme(paths, id, (raw) => {
    raw.wallpaper = {
      kind: "image",
      light: side === "dark" ? raw.wallpaper?.light ?? null : { src },
      dark: side === "light" ? raw.wallpaper?.dark ?? null : { src }
    };
  });
  if (applied.exitCode !== EXIT.ok) return applied;
  const stats = recordWallpaperStats(themeDir, side, buffer);
  return {
    exitCode: EXIT.ok,
    payload: { ok: true, id, recipe, file: src, seed, size, side, stats },
    text: `已用 ${recipe} 生成 ${src}（${size.width}×${size.height}）${stats === null ? "" : ` · stdLuma ${stats.stdLuma} edge ${stats.edgeEnergy}`}`
  };
}
var STATS_FILE = "wallpaper-stats.json";
function recordWallpaperStats(themeDir, side, buffer) {
  if (!isPng(buffer)) return null;
  let stats;
  try {
    stats = imageStats(buffer);
  } catch {
    return null;
  }
  const file = join3(themeDir, STATS_FILE);
  let all = {};
  if (existsSync2(file)) {
    try {
      all = JSON.parse(readFileSync3(file, "utf8"));
    } catch {
      all = {};
    }
  }
  const record = { stdLuma: stats.stdLuma, edgeEnergy: stats.edgeEnergy, width: stats.width, height: stats.height };
  if (side === "dark") all.dark = record;
  else if (side === "both") {
    all.light = record;
    all.dark = record;
  } else all.light = record;
  writeJsonAtomic(file, all);
  return record;
}
async function cmdWallpaperGen(paths, { positionals, flags }) {
  const id = positionals[0];
  if (typeof flags.prompt !== "string" || flags.prompt.trim().length === 0) {
    return fail(EXIT.error, '用法：vft wallpaper gen <id> --prompt "画面描述" [--size portrait|desktop|square] [--seed N] [--file 名称.png] [--mode light|dark|both] [--resolution 1024] [--sigmas 1.0,0.97,...]');
  }
  const found = findTheme(paths, id);
  if (found === null) return fail(EXIT.error, `找不到主题 "${id}"`);
  if (found.kind !== "user") return fail(EXIT.confirm, `"${id}" 是${found.kind}主题，只读；先 theme create --from ${id} --id <新id>`);
  const size = WALLPAPER_SIZES[typeof flags.size === "string" ? flags.size : "portrait"] ?? WALLPAPER_SIZES.portrait;
  const seed = flags.seed === void 0 ? Math.floor(Math.random() * 2 ** 31) : Number(flags.seed);
  const workflow = buildQwenImageWorkflow({
    prompt: flags.prompt,
    negative: typeof flags.negative === "string" ? flags.negative : "",
    width: size.width,
    height: size.height,
    seed,
    cfg: flags.cfg === void 0 ? QWEN_IMAGE_DEFAULTS.cfg : Number(flags.cfg),
    resolution: flags.resolution === void 0 ? QWEN_IMAGE_DEFAULTS.resolution : Number(flags.resolution),
    sigmas: typeof flags.sigmas === "string" ? flags.sigmas : QWEN_IMAGE_DEFAULTS.sigmas,
    filenamePrefix: `vft/${id}`
  });
  const issues = validateWorkflow(workflow);
  if (issues.length > 0) return fail(EXIT.gate, `工作流不合法：${issues.join("；")}`, { issues });
  const client = createComfyClient({ baseUrl: typeof flags["comfy-url"] === "string" ? flags["comfy-url"] : void 0, auth: typeof flags["comfy-auth"] === "string" ? flags["comfy-auth"] : void 0 });
  const probe = await client.probe();
  if (!probe.ok) {
    const reason = probe.status === 401 || probe.status === 403 ? `ComfyUI 在 ${client.baseUrl} 要求认证：${probe.status}。设 COMFYUI_AUTH=用户名:密码（或 Bearer <token>），或用 --comfy-auth 传` : `ComfyUI 不可达（${client.baseUrl}）。确认 ComfyUI 已启动，或用 --comfy-url / COMFYUI_URL 指定地址`;
    return fail(EXIT.confirm, reason, { comfy: client.baseUrl, status: probe.status });
  }
  const promptId = await client.submit(workflow);
  const timeoutMs = flags.timeout === void 0 ? 9e5 : Number(flags.timeout) * 1e3;
  const { images } = await client.wait(promptId, { timeoutMs });
  if (images.length === 0) return fail(EXIT.error, "ComfyUI 完成但没有任何输出图片");
  const buffer = await client.download(images[0]);
  const themeDir = join3(paths.userThemesDir, id);
  mkdirSync3(join3(themeDir, "assets"), { recursive: true });
  const fileName = typeof flags.file === "string" ? flags.file : `${id}-${seed}.png`;
  const target = join3(themeDir, "assets", fileName);
  writeFileSync3(target, buffer);
  const mode = typeof flags.mode === "string" ? flags.mode : "both";
  const side = `assets/${fileName}`;
  mutateUserTheme(paths, id, (raw) => {
    raw.wallpaper = {
      kind: "image",
      light: mode === "dark" ? raw.wallpaper?.light ?? null : { src: side },
      dark: mode === "light" ? raw.wallpaper?.dark ?? null : { src: side }
    };
  });
  const stats = recordWallpaperStats(themeDir, mode, buffer);
  return {
    exitCode: EXIT.ok,
    payload: { ok: true, id, promptId, file: side, seed, size, stats },
    text: `已生成 ${side}（prompt ${promptId}，seed ${seed}）${stats === null ? "" : ` · stdLuma ${stats.stdLuma} edge ${stats.edgeEnergy}`}`
  };
}
async function cmdWallpaperVideo(paths, { positionals, flags }) {
  const id = positionals[0];
  if (id === void 0) return fail(EXIT.error, "用法：vft wallpaper video <id> --image assets/x.png [--prompt 运动描述] [--seconds 2] [--fps 24] [--size desktop] [--seed N]");
  const found = findTheme(paths, id);
  if (found === null) return fail(EXIT.error, `找不到主题 "${id}"`);
  if (found.kind !== "user") return fail(EXIT.confirm, `"${id}" 是${found.kind}主题，只读；先 theme create --from ${id} --id <新id>`);
  const themeDir = join3(paths.userThemesDir, id);
  const theme = JSON.parse(readFileSync3(join3(themeDir, "theme.json"), "utf8"));
  const side = typeof flags.side === "string" ? flags.side : theme.wallpaper?.dark === void 0 ? "light" : "dark";
  if (!["light", "dark"].includes(side)) return fail(EXIT.error, "--side 只能是 light / dark");
  let imagePath = typeof flags.image === "string" ? resolve(flags.image) : null;
  if (imagePath === null) {
    const src = theme.wallpaper?.[side]?.src ?? theme.wallpaper?.light?.src ?? theme.wallpaper?.dark?.src;
    if (typeof src === "string" && /\.(png|jpe?g|webp)$/i.test(src)) imagePath = join3(themeDir, src);
  }
  if (imagePath === null || !existsSync2(imagePath)) {
    return fail(EXIT.error, "找不到要动的图片：用 --image 指定一张 png/jpg，或先 vft wallpaper gen / art 生成一张");
  }
  const source = readFileSync3(imagePath);
  const size = WALLPAPER_SIZES[typeof flags.size === "string" ? flags.size : "desktop"] ?? WALLPAPER_SIZES.desktop;
  const fps = flags.fps === void 0 ? HUNYUAN_I2V_DEFAULTS.fps : Number(flags.fps);
  const seconds = flags.seconds === void 0 ? 2 : Number(flags.seconds);
  if (!(seconds > 0) || seconds > 10) return fail(EXIT.error, "--seconds 取 0-10 之间（受显存与时长限制）");
  const seed = flags.seed === void 0 ? Math.floor(Math.random() * 2 ** 31) : Number(flags.seed);
  const client = createComfyClient({
    baseUrl: typeof flags["comfy-url"] === "string" ? flags["comfy-url"] : void 0,
    auth: typeof flags["comfy-auth"] === "string" ? flags["comfy-auth"] : void 0
  });
  const probe = await client.probe();
  if (!probe.ok) {
    const reason = probe.status === 401 || probe.status === 403 ? `ComfyUI 在 ${client.baseUrl} 要求认证：${probe.status}。设 COMFYUI_AUTH=用户名:密码（或 Bearer <token>），或用 --comfy-auth 传` : `ComfyUI 不可达（${client.baseUrl}）。确认 ComfyUI 已启动，或用 --comfy-url / COMFYUI_URL 指定地址`;
    return fail(EXIT.confirm, reason, { comfy: client.baseUrl, status: probe.status });
  }
  const uploaded = await client.uploadImage(source, `vft-${id}-${seed}.png`);
  const workflow = buildHunyuanI2VWorkflow({
    image: uploaded,
    prompt: typeof flags.prompt === "string" ? flags.prompt : void 0,
    negative: typeof flags.negative === "string" ? flags.negative : void 0,
    width: size.width,
    height: size.height,
    fps,
    seconds,
    seed,
    steps: flags.steps === void 0 ? HUNYUAN_I2V_DEFAULTS.steps : Number(flags.steps),
    shift: flags.shift === void 0 ? HUNYUAN_I2V_DEFAULTS.shift : Number(flags.shift),
    cfg: flags.cfg === void 0 ? HUNYUAN_I2V_DEFAULTS.cfg : Number(flags.cfg),
    filenamePrefix: `vft/${id}`
  });
  const issues = validateVideoWorkflow(workflow);
  if (issues.length > 0) return fail(EXIT.gate, `工作流不合法：${issues.join("；")}`, { issues });
  const promptId = await client.submit(workflow);
  const timeoutMs = flags.timeout === void 0 ? 18e5 : Number(flags.timeout) * 1e3;
  const { files } = await client.wait(promptId, { timeoutMs });
  const clip = files.find((file) => /\.(mp4|webm|mov)$/i.test(file.filename ?? ""));
  if (clip === void 0) return fail(EXIT.error, "ComfyUI 完成但没有输出视频文件");
  const buffer = await client.download(clip);
  mkdirSync3(join3(themeDir, "assets"), { recursive: true });
  const baseName = typeof flags.file === "string" ? flags.file.replace(/\.(mp4|webm)$/i, "") : `${id}-${seed}`;
  const mp4 = join3(themeDir, "assets", `${baseName}.mp4`);
  const posterName = `${baseName}.png`;
  writeFileSync3(mp4, buffer);
  writeFileSync3(join3(themeDir, "assets", posterName), source);
  const videoSide = { src: `assets/${baseName}.mp4`, poster: `assets/${posterName}` };
  const applied = mutateUserTheme(paths, id, (raw) => {
    raw.wallpaper = { ...raw.wallpaper ?? {}, kind: "video", [side]: videoSide };
  });
  if (applied.exitCode !== EXIT.ok) return applied;
  const stats = recordWallpaperStats(themeDir, side, source);
  const frames = framesForSeconds(seconds, fps);
  return {
    exitCode: EXIT.ok,
    payload: { ok: true, id, promptId, file: videoSide.src, poster: videoSide.poster, bytes: buffer.byteLength, frames, fps, side, stats },
    text: `已生成动态壁纸 ${videoSide.src}（${frames} 帧 @${fps}fps，${Math.round(buffer.byteLength / 1024)} KB）· 首帧沿用 ${basename(imagePath)}`
  };
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
    if (flags["hero-mark"] !== void 0) brand.heroMark = flags["hero-mark"];
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
      let sampled = null;
      const statsFile = join3(found.dir, STATS_FILE);
      if (existsSync2(statsFile)) {
        try {
          const parsed = JSON.parse(readFileSync3(statsFile, "utf8"));
          if (parsed?.light !== void 0 && parsed?.dark !== void 0) sampled = parsed;
        } catch {
        }
      }
      const report = scoreTheme(theme, { sampled });
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
  const NEEDS_ID = /* @__PURE__ */ new Set([
    "theme:show",
    "theme:rename",
    "theme:delete",
    "theme:apply",
    "theme:reset",
    "theme:export",
    "theme:import",
    "wallpaper:list",
    "wallpaper:add",
    "wallpaper:set",
    "wallpaper:gen",
    "wallpaper:video",
    "wallpaper:art",
    "wallpaper:anim",
    "sidebar:set",
    "sidebar:tune",
    "colors:suggest",
    "brand:set",
    "appearance:set"
  ]);
  if (NEEDS_ID.has(`${group}:${action}`) && typeof rest[0] !== "string") {
    return fail(EXIT.error, `缺少主题 id：vft ${group} ${action} <id>`);
  }
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
        case "art":
          return await cmdWallpaperArt(paths, ctx);
        case "anim":
          return await cmdWallpaperAnim(paths, ctx);
        case "recipes":
          return cmdWallpaperRecipes(ctx);
        case "gen":
          return await cmdWallpaperGen(paths, ctx);
        case "video":
          return await cmdWallpaperVideo(paths, ctx);
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
