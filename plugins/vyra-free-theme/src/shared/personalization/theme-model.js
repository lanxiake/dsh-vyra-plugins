/**
 * Free-theme model — `theme.json` v1 as the single source of truth for a
 * user-authored or bundled theme.
 *
 * One rule drives this module: a JSON theme and a compiled-in theme must end
 * up as the SAME `SkinEffects` draft, produced by the same projection kernel
 * (`skins/translucency.js`). So this file does two pure jobs and nothing else:
 *
 *   1. `normalizeTheme(raw)` — structural validation + canonical defaults.
 *      Fail-closed: any problem is reported with a stable code and a path, and
 *      a theme with any issue is not registered at all.
 *
 *   2. `fieldsFromTheme` / `tableFromTheme` — turn a normalized theme into the
 *      personalization field catalog (what the panel edits) and the projection
 *      table (what `createProjection` consumes). No DOM, no React, no host
 *      APIs, so both halves and the test runner can use them.
 */
import { GLOBAL_MAX_BYTES, GLOBAL_MAX_PIXELS, USER_IMAGE_MIMES } from "./catalog.js";

export const THEME_SCHEMA_VERSION = 1;

/** Tokens whose alpha follows the translucency slider (the "riding" family). */
export const TRANSLUCENT_TOKENS = [
  "--dsw-alias-bg-base",
  "--dsw-alias-bg-layer-1",
  "--dsw-alias-bg-layer-2",
  "--dsw-alias-bg-layer-3",
  "--dsw-alias-bg-module-platform",
  "--dsw-specific-sidebar-fill",
];

/** Coverage scopes accepted by v1 (spec §6.2). */
export const COVERAGE_SCOPES = ["sidebar", "topbar", "rightpanel"];

const ID_PATTERN = /^[a-z][a-z0-9-]{1,39}$/;
const TOKEN_PATTERN = /^--[a-z0-9-]+$/;
const HEX_PATTERN = /^#[0-9a-f]{6}$/i;
const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

const KNOWN_KEYS = new Set([
  "schema", "id", "name", "author", "version", "brand", "colors", "shape",
  "translucency", "wallpaper", "coverage", "sidebar", "decorations",
]);

const TEXT_MAX = 64;
const NAME_MAX = 60;
const SLOGAN_MAX = 40;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function boundedText(value, max) {
  return typeof value === "string" && value.length > 0 && value.length <= max && !CONTROL_CHARS.test(value);
}

function validLocalePair(value, max) {
  return isPlainObject(value)
    && Object.keys(value).length === 2
    && boundedText(value.zh, max)
    && boundedText(value.en, max);
}

function parsePercent(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100
    ? Math.round(value)
    : null;
}

/**
 * Normalize + validate one `theme.json` document.
 * Returns `{ ok: true, theme }` or `{ ok: false, issues: [{ code, path, message }] }`.
 */
export function normalizeTheme(raw) {
  const issues = [];
  const fail = (code, path, message) => issues.push({ code, path, message });

  if (!isPlainObject(raw)) {
    fail("bad-shape", "", "theme.json 必须是一个对象");
    return { ok: false, issues };
  }
  for (const key of Object.keys(raw)) {
    if (!KNOWN_KEYS.has(key)) fail("unknown-key", key, `未知字段 "${key}"（schema v1 不接受）`);
  }
  if (raw.schema !== THEME_SCHEMA_VERSION) {
    fail("schema-version", "schema", `schema 必须是 ${THEME_SCHEMA_VERSION}`);
  }
  const id = raw.id;
  if (typeof id !== "string" || !ID_PATTERN.test(id)) {
    fail("bad-id", "id", "id 必须是 2–40 位小写字母/数字/连字符，以字母开头");
  }

  if (!validLocalePair(raw.name, NAME_MAX)) {
    fail("bad-name", "name", "name 必须是 { zh, en } 两个非空字符串（各 ≤60 字）");
  }

  if (!isPlainObject(raw.colors)) {
    fail("bad-colors", "colors", "colors 必须是 { light, dark }");
  } else {
    for (const mode of ["light", "dark"]) {
      const table = raw.colors[mode];
      if (!isPlainObject(table) || Object.keys(table).length === 0) {
        fail("bad-colors", `colors.${mode}`, `${mode} 至少需要一个令牌`);
        continue;
      }
      for (const [token, value] of Object.entries(table)) {
        if (!TOKEN_PATTERN.test(token)) fail("bad-token", `colors.${mode}.${token}`, `非法令牌名 "${token}"`);
        if (!boundedText(value, TEXT_MAX)) {
          fail("bad-token-value", `colors.${mode}.${token}`, "令牌值必须是非空字符串（≤64 字）");
        } else if (TRANSLUCENT_TOKENS.includes(token) && !HEX_PATTERN.test(value)) {
          fail("bad-translucent-color", `colors.${mode}.${token}`, "随动令牌必须是 #RRGGBB，才能按通透度换算 alpha");
        }
      }
    }
    const lightKeys = Object.keys(raw.colors.light ?? {}).sort();
    const darkKeys = Object.keys(raw.colors.dark ?? {}).sort();
    if (lightKeys.join() !== darkKeys.join()) {
      fail("color-token-mismatch", "colors", "light 与 dark 必须声明完全相同的令牌集合");
    }
    if (!isPlainObject(raw.colors.light) || !HEX_PATTERN.test(raw.colors.light["--dsw-alias-bg-base"] ?? "")) {
      fail("missing-bg-base", "colors.light.--dsw-alias-bg-base", "必须声明 #RRGGBB 形式的 --dsw-alias-bg-base");
    }
  }

  if (raw.shape !== undefined) {
    if (!isPlainObject(raw.shape)) fail("bad-shape", "shape", "shape 必须是对象");
    else {
      for (const [token, value] of Object.entries(raw.shape)) {
        if (!TOKEN_PATTERN.test(token)) fail("bad-token", `shape.${token}`, `非法令牌名 "${token}"`);
        if (!boundedText(value, TEXT_MAX)) fail("bad-token-value", `shape.${token}`, "令牌值必须是非空字符串");
      }
    }
  }

  let translucency = { web: 55, desktop: 66, baked: {} };
  if (raw.translucency !== undefined) {
    if (!isPlainObject(raw.translucency)) {
      fail("bad-translucency", "translucency", "translucency 必须是对象");
    } else {
      for (const key of Object.keys(raw.translucency)) {
        if (!["web", "desktop", "baked"].includes(key)) {
          fail("unknown-key", `translucency.${key}`, `未知字段 "${key}"`);
        }
      }
      for (const mode of ["web", "desktop"]) {
        if (raw.translucency[mode] === undefined) continue;
        const value = parsePercent(raw.translucency[mode]);
        if (value === null) fail("bad-translucency", `translucency.${mode}`, "必须是 0–100 的数字");
        else translucency[mode] = value;
      }
      if (raw.translucency.baked !== undefined) {
        if (!isPlainObject(raw.translucency.baked)) {
          fail("bad-translucency", "translucency.baked", "baked 必须是 { 令牌: 0–100 }");
        } else {
          for (const [token, value] of Object.entries(raw.translucency.baked)) {
            if (!TRANSLUCENT_TOKENS.includes(token)) {
              fail("bad-translucency", `translucency.baked.${token}`, "只有随动令牌可以声明 baked");
            }
            const points = parsePercent(value);
            if (points === null) fail("bad-translucency", `translucency.baked.${token}`, "必须是 0–100 的数字");
            else translucency.baked[token] = points;
          }
        }
      }
    }
  }

  let brand = { title: null, mark: null, favicon: null, slogans: { zh: "", en: "" } };
  if (raw.brand !== undefined) {
    if (!isPlainObject(raw.brand)) fail("bad-brand", "brand", "brand 必须是对象");
    else {
      for (const key of Object.keys(raw.brand)) {
        if (!["title", "mark", "favicon", "slogans"].includes(key)) {
          fail("unknown-key", `brand.${key}`, `未知字段 "${key}"`);
        }
      }
      if (raw.brand.title !== undefined) {
        if (!validLocalePair(raw.brand.title, NAME_MAX)) fail("bad-brand", "brand.title", "title 必须是 { zh, en }");
        else brand.title = { zh: raw.brand.title.zh, en: raw.brand.title.en };
      }
      if (raw.brand.mark !== undefined && raw.brand.mark !== null) {
        if (!boundedText(raw.brand.mark, 256)) fail("bad-brand", "brand.mark", "mark 必须是路径或内联 SVG 字符串");
        else brand.mark = raw.brand.mark;
      }
      if (raw.brand.favicon !== undefined && raw.brand.favicon !== null) {
        const favicon = raw.brand.favicon;
        if (!isPlainObject(favicon) || !boundedText(favicon.href, 2048) || !boundedText(favicon.mime, 64)) {
          fail("bad-brand", "brand.favicon", "favicon 必须是 { href, mime }");
        } else brand.favicon = { href: favicon.href, mime: favicon.mime };
      }
      if (raw.brand.slogans !== undefined) {
        if (!validLocalePair(raw.brand.slogans, SLOGAN_MAX)) {
          fail("bad-brand", "brand.slogans", "slogans 必须是 { zh, en }（各 ≤40 字）");
        } else brand.slogans = { zh: raw.brand.slogans.zh, en: raw.brand.slogans.en };
      }
    }
  }

  let wallpaper = null;
  if (raw.wallpaper !== undefined && raw.wallpaper !== null) {
    if (!isPlainObject(raw.wallpaper)) fail("bad-wallpaper", "wallpaper", "wallpaper 必须是对象");
    else if (!["image", "video", "animated", "code"].includes(raw.wallpaper.kind)) {
      fail("unsupported-wallpaper-kind", "wallpaper.kind", "kind 必须是 image / video / animated / code");
    } else if (raw.wallpaper.kind === "code") {
      if (!boundedText(raw.wallpaper.entry, 256) || mimeForAssetPath(raw.wallpaper.entry) !== THEME_ASSET_MIME[".js"]) {
        fail("bad-wallpaper", "wallpaper.entry", "代码壁纸必须声明一个 theme 内的 .js 入口");
      } else {
        wallpaper = { kind: "code", entry: raw.wallpaper.entry };
      }
    } else if (raw.wallpaper.kind === "video") {
      wallpaper = { kind: "video", light: raw.wallpaper.light ?? null, dark: raw.wallpaper.dark ?? null };
      if (wallpaper.light === null && wallpaper.dark === null) {
        fail("bad-wallpaper", "wallpaper", "至少需要 light 或 dark 一侧");
      }
      for (const mode of ["light", "dark"]) {
        const side = wallpaper[mode];
        if (side === null) continue;
        if (!isPlainObject(side) || !boundedText(side.src, 256)) {
          fail("bad-wallpaper", `wallpaper.${mode}`, "每一侧必须是 { src, poster?, overlay?, blur? }");
          continue;
        }
        const mime = mimeForAssetPath(side.src);
        if (mime !== "video/mp4" && mime !== "video/webm") {
          fail("bad-wallpaper", `wallpaper.${mode}.src`, "视频壁纸必须是 .mp4 或 .webm");
        }
        if (side.poster !== undefined && side.poster !== null) {
          const posterMime = mimeForAssetPath(side.poster);
          if (!boundedText(side.poster, 256) || posterMime === null || !posterMime.startsWith("image/")) {
            fail("bad-wallpaper", `wallpaper.${mode}.poster`, "poster 必须是 theme 内的图片路径");
          }
        }
      }
    } else {
      wallpaper = { kind: raw.wallpaper.kind, light: raw.wallpaper.light ?? null, dark: raw.wallpaper.dark ?? null };
      if (wallpaper.light === null && wallpaper.dark === null) {
        fail("bad-wallpaper", "wallpaper", "至少需要 light 或 dark 一侧");
      }
      for (const mode of ["light", "dark"]) {
        const side = wallpaper[mode];
        if (side === null) continue;
        if (!isPlainObject(side) || !boundedText(side.src, 256)) {
          fail("bad-wallpaper", `wallpaper.${mode}`, "每一侧必须是 { src, poster?, overlay?, blur? }");
          continue;
        }
        const mime = mimeForAssetPath(side.src);
        const allowed = raw.wallpaper.kind === "animated"
          ? ["image/gif", "image/webp"]
          : Object.values(THEME_ASSET_MIME).filter((value) => value.startsWith("image/"));
        if (mime === null || !allowed.includes(mime)) {
          fail("bad-wallpaper", `wallpaper.${mode}.src`, raw.wallpaper.kind === "animated"
            ? "动图壁纸必须是 .gif 或 .webp"
            : "静态壁纸必须是 .webp / .png / .jpg / .avif");
        }
      }
    }
  }

  let coverage = { shell: false, scopes: ["sidebar"] };
  if (raw.coverage !== undefined) {
    if (!isPlainObject(raw.coverage)) fail("bad-coverage", "coverage", "coverage 必须是对象");
    else {
      if (raw.coverage.shell !== undefined) {
        if (typeof raw.coverage.shell !== "boolean") fail("bad-coverage", "coverage.shell", "shell 必须是布尔值");
        else coverage.shell = raw.coverage.shell;
      }
      if (raw.coverage.scopes !== undefined) {
        if (!Array.isArray(raw.coverage.scopes)
          || raw.coverage.scopes.some((scope) => !COVERAGE_SCOPES.includes(scope))) {
          fail("bad-coverage", "coverage.scopes", `scopes 只能取 ${COVERAGE_SCOPES.join(" / ")}`);
        } else coverage.scopes = [...raw.coverage.scopes];
      }
    }
  }

  if (raw.sidebar !== undefined && raw.sidebar !== null && !isPlainObject(raw.sidebar)) {
    fail("bad-sidebar", "sidebar", "sidebar 必须是对象（P3 校验其字段形状）");
  }
  if (raw.decorations !== undefined && raw.decorations !== null && !Array.isArray(raw.decorations)) {
    fail("bad-decorations", "decorations", "decorations 必须是数组");
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
      shape: raw.shape === undefined ? {} : { ...raw.shape },
      translucency,
      wallpaper,
      coverage,
      sidebar: raw.sidebar ?? null,
      decorations: raw.decorations ?? null,
    },
  };
}

/** `vft-ink-landscape` → `vftInkLandscape` (dataset key, see normalizeEffects). */
export function bodyAttributeFor(id) {
  return `vft${id.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("")}`;
}

/** Asset URL prefix: the Host serves `<base>/<themeId>/<path-inside-theme>`. */
export const THEME_ASSET_BASE = "/vyra-free-theme/theme";

/** Extensions a theme may ship, with the MIME the Host must answer with. */
export const THEME_ASSET_MIME = Object.freeze({
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".js": "text/plain; charset=utf-8",
});

export function mimeForAssetPath(path) {
  if (typeof path !== "string") return null;
  const match = /\.[a-z0-9]+$/i.exec(path);
  return match === null ? null : (THEME_ASSET_MIME[match[0].toLowerCase()] ?? null);
}

function themeAssetUrl(themeId, path) {
  const encoded = String(path).split("/").map(encodeURIComponent).join("/");
  return `${THEME_ASSET_BASE}/${themeId}/${encoded}`;
}

/**
 * The `builtinAssets` map for a theme: one `art` entry whose light side is the
 * served URL and whose dark side travels as `darkUrl` (the asset contract lets
 * one wallpaper ref carry a pair, which is how a theme ships light/dark art
 * without needing two image fields).
 */
export function builtinAssetsFromTheme(theme) {
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

/**
 * Element-backed wallpaper layers for a theme (spec §6.1): `video` and `code`
 * cannot be expressed as a CSS background, so they travel as layer descriptors
 * the runtime mounts as real nodes. Static/animated art stays on the image
 * channel and contributes no layer.
 */
export function wallpaperLayersFromTheme(theme) {
  const wallpaper = theme.wallpaper;
  if (wallpaper === null) return [];
  if (wallpaper.kind === "video") {
    const side = (value) => (value === null ? null : {
      src: themeAssetUrl(theme.id, value.src),
      poster: value.poster ? themeAssetUrl(theme.id, value.poster) : null,
    });
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
    builtinChoices: hasArt ? ["art"] : [],
  };
}

/**
 * The personalization field catalog for one theme — same three fields as every
 * compiled-in skin, so the panel and the Host store need no new concept.
 */
export function fieldsFromTheme(theme, profile = "web") {
  const opacity = profile === "desktop" ? theme.translucency.desktop : theme.translucency.web;
  return [
    wallpaperField(theme),
    {
      key: "slogan",
      type: "text",
      scope: "locale",
      labelKey: "personalization.slogan",
      maxLength: SLOGAN_MAX,
      default: theme.brand.slogans,
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
      default: opacity,
    },
  ];
}

/** `#8B5CF6` → `"139, 92, 246"` (the rgb channel form the projection kernel needs). */
export function hexToRgb(hex) {
  return `${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}`;
}

/**
 * Build the projection table for `createProjection`. Shape matches
 * `defineSkin`'s table exactly, so both theme sources run the same kernel.
 */
export function tableFromTheme(theme, profile = "web") {
  const riding = {};
  const constantTokens = {};
  // Default `baked` is the profile anchor: alpha = P + baked − anchor then
  // reduces to P/100, i.e. the slider reads as "how opaque is the surface",
  // 0 = wallpaper fully visible, 100 = fully covered. A theme can override
  // individual tokens (translucency.baked) to keep a lighter or heavier floor.
  const anchor = profile === "desktop" ? theme.translucency.desktop : theme.translucency.web;
  for (const token of Object.keys(theme.colors.light)) {
    if (TRANSLUCENT_TOKENS.includes(token)) {
      const baked = theme.translucency.baked[token] ?? anchor;
      riding[token] = {
        light: [hexToRgb(theme.colors.light[token]), baked],
        dark: [hexToRgb(theme.colors.dark[token]), baked],
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
        dark: [[baseDark, anchor], [baseDark, anchor]],
      },
      artLayer: "",
    },
    blur: { max: 12 },
    glassVar: "--vft-glass-blur",
    desktopBlur: { rate: 55, dark: "boost" },
    wallpaper: { kind: "assets" },
    layers: wallpaperLayersFromTheme(theme),
    coverage: theme.coverage,
    staticCss: "",
  };
}
