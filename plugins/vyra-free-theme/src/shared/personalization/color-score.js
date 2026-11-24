/**
 * Colour evaluation (pure, no DOM, no image decoder).
 *
 * Five dimensions, weighted as the spec fixes them (§8.1):
 *
 *   text contrast        30   body/secondary text vs the composited surface
 *   brand visibility     20   brand colour vs the surface (identifiable accent)
 *   luminance spread     20   layers must not collapse into one grey band
 *   hue harmony          15   brand hue must sit in an analogous or complementary band
 *   wallpaper interference 15  high-detail wallpaper behind text (needs sampling)
 *
 * Sampling is optional: without pixel data the interference dimension is
 * EXCLUDED and the remaining weights are renormalised, and the report says so.
 * That keeps the gate honest offline instead of silently scoring a guess.
 */

const WEIGHTS = Object.freeze({
  contrast: 30,
  brand: 20,
  luma: 20,
  hue: 15,
  interference: 15,
});

export const SCORE_THRESHOLD = 70;
export const CONTRAST_MIN = 4.5;
export const BRAND_MIN = 3;
export const LUMA_SPREAD_MIN = 0.01;

const HEX3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const HEX6 = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i;
const RGB_FN = /^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/i;

function clampByte(value) {
  return Math.min(255, Math.max(0, Math.round(value)));
}

/** Parse `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()` and `rgba()` into `{r,g,b,a}`. */
export function parseColor(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  const short = HEX3.exec(text);
  if (short !== null) {
    return { r: parseInt(short[1] + short[1], 16), g: parseInt(short[2] + short[2], 16), b: parseInt(short[3] + short[3], 16), a: 1 };
  }
  const long = HEX6.exec(text);
  if (long !== null) {
    const int = parseInt(long[1], 16);
    const alpha = long[2] === undefined ? 1 : parseInt(long[2], 16) / 255;
    return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255, a: alpha };
  }
  const fn = RGB_FN.exec(text);
  if (fn !== null) {
    const alphaText = fn[4];
    const alpha = alphaText === undefined
      ? 1
      : (alphaText.endsWith("%") ? parseFloat(alphaText) / 100 : parseFloat(alphaText));
    return { r: clampByte(Number(fn[1])), g: clampByte(Number(fn[2])), b: clampByte(Number(fn[3])), a: Math.min(1, Math.max(0, alpha)) };
  }
  return null;
}

/** sRGB relative luminance (WCAG 2.x). */
export function relativeLuminance({ r, g, b }) {
  const channel = (value) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(foreground, background) {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Source-over composite of `foreground` (with its own alpha, scaled) on `background`. */
export function composite(foreground, background, alphaScale = 1) {
  const a = Math.min(1, Math.max(0, (foreground.a ?? 1) * alphaScale));
  return {
    r: foreground.r * a + background.r * (1 - a),
    g: foreground.g * a + background.g * (1 - a),
    b: foreground.b * a + background.b * (1 - a),
    a: 1,
  };
}

export function rgbToHsl({ r, g, b }) {
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

export function hslToRgb({ h, s, l }) {
  const hue = (((h % 360) + 360) % 360) / 360;
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
    a: 1,
  };
}

export function toHex({ r, g, b }) {
  return `#${[r, g, b].map((value) => clampByte(value).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function circularDistance(a, b) {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Hue harmony: analogous 0–45°, monochrome 0–15°, complementary 150–210°.
 * Inside any band → 100; outside → linear falloff over 45° of distance.
 */
export function hueHarmonyScore(brandHue, baseHue) {
  const distance = circularDistance(brandHue, baseHue);
  const bands = [[0, 15], [0, 45], [150, 210]];
  let nearest = Infinity;
  for (const [low, high] of bands) {
    if (distance >= low && distance <= high) nearest = 0;
    else nearest = Math.min(nearest, Math.min(Math.abs(distance - low), Math.abs(distance - high)));
  }
  return Math.round(Math.max(0, 100 - (nearest / 45) * 100));
}

function luminanceSpread(tokens) {
  // Perceptual lightness (HSL L), not WCAG relative luminance: near black the
  // latter compresses so hard that a genuinely layered dark theme looks flat.
  const values = tokens
    .map((token) => parseColor(token))
    .filter((color) => color !== null)
    .map((color) => rgbToHsl(color).l);
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function spreadScore(std) {
  // Perceptual-lightness spread: ≲0.010 reads as one grey slab, ≥0.030 is
  // clearly layered. (Anchors are lightness units, not WCAG luminance.)
  if (std >= 0.03) return 100;
  return Math.round(Math.max(0, Math.min(100, (std / 0.03) * 100)));
}

function interferenceScore(sampled) {
  if (sampled === null || sampled === undefined) return null;
  const edge = typeof sampled.edgeEnergy === "number" ? sampled.edgeEnergy : 0;
  const std = typeof sampled.stdLuma === "number" ? sampled.stdLuma : 0;
  // More than 0.16 of edge energy or 0.30 luma spread behind text is busy.
  const score = 100 - Math.min(100, (edge / 0.16) * 55 + (std / 0.30) * 45);
  return Math.round(Math.max(0, score));
}

const SURFACE_TOKENS = ["--dsw-alias-bg-base", "--dsw-alias-bg-layer-1", "--dsw-alias-bg-layer-2", "--dsw-alias-bg-layer-3"];
const TEXT_TOKENS = ["--dsw-alias-label-primary", "--dsw-alias-label-secondary"];

function modeScore(theme, mode, sampled) {
  const colors = theme.colors[mode];
  const base = parseColor(colors["--dsw-alias-bg-base"]);
  if (base === null) return null;

  // The wallpaper sits behind the base tone; at full opacity the surface is the
  // base colour. Without pixel data the surface is exactly the base tone.
  const surface = base;

  const textRatios = TEXT_TOKENS
    .map((token) => colors[token])
    .filter((value) => typeof value === "string")
    .map((value) => {
      const parsed = parseColor(value);
      if (parsed === null) return null;
      const composited = parsed.a < 1 ? composite(parsed, surface) : parsed;
      return contrastRatio(composited, surface);
    })
    .filter((ratio) => ratio !== null);
  const contrast = textRatios.length === 0 ? 0 : Math.min(...textRatios);

  const brandColor = parseColor(colors["--dsw-alias-brand-primary"] ?? "");
  const brand = brandColor === null ? 0 : contrastRatio(brandColor, surface);

  const std = luminanceSpread(SURFACE_TOKENS.map((token) => colors[token]).filter(Boolean));
  const baseHue = rgbToHsl(base).h;
  const brandHue = brandColor === null ? baseHue : rgbToHsl(brandColor).h;

  return {
    contrast: {
      value: Math.round(Math.min(100, (Math.min(contrast, CONTRAST_MIN * 2) / (CONTRAST_MIN * 2)) * 100)),
      raw: Number(contrast.toFixed(2)),
    },
    brand: {
      value: Math.round(Math.min(100, (Math.min(brand, BRAND_MIN * 2) / (BRAND_MIN * 2)) * 100)),
      raw: Number(brand.toFixed(2)),
    },
    luma: { value: spreadScore(std), raw: Number(std.toFixed(4)) },
    hue: { value: hueHarmonyScore(brandHue, baseHue), raw: Math.round(circularDistance(brandHue, baseHue)) },
    interference: sampled === null || sampled === undefined
      ? null
      : { value: interferenceScore(sampled), raw: sampled },
  };
}

function failureFor(dimension, mode, entry) {
  if (entry === null) return null;
  if (dimension === "contrast" && entry.raw < CONTRAST_MIN) {
    return {
      dimension, mode, value: entry.raw, threshold: CONTRAST_MIN,
      fix: "把 label-primary / label-secondary 调向背景反方向（更亮或更暗），或调高 panelOpacity 压暗壁纸",
    };
  }
  if (dimension === "brand" && entry.raw < BRAND_MIN) {
    return { dimension, mode, value: entry.raw, threshold: BRAND_MIN, fix: "提高品牌色与背景的明度差（加饱和或拉开明度）" };
  }
  if (dimension === "luma" && entry.raw < LUMA_SPREAD_MIN) {
    return {
      dimension, mode, value: entry.raw, threshold: LUMA_SPREAD_MIN,
      fix: "图层之间几乎同亮度：把 base 与 layer-3 的明度拉开 ≥6%",
    };
  }
  if (dimension === "hue" && entry.value < 50) {
    return {
      dimension, mode, value: entry.raw, threshold: "0–45° 或 150–210°",
      fix: "把品牌色相移进类似色（≤45°）或互补色（150–210°）区",
    };
  }
  if (dimension === "interference" && entry.value < 50) {
    return { dimension, mode, value: entry.value, threshold: 50, fix: "壁纸太花：提高 overlay 不透明度、加模糊，或换一张低细节壁纸" };
  }
  return null;
}

/**
 * Score one normalized theme. `sampled` is optional pixel evidence:
 * `{ light: {stdLuma, edgeEnergy}, dark: {...} }`.
 */
export function scoreTheme(theme, { sampled = null } = {}) {
  const breakdown = [];
  const failures = [];
  const modes = ["light", "dark"];
  const perMode = {};

  for (const mode of modes) {
    perMode[mode] = modeScore(theme, mode, sampled?.[mode] ?? null);
  }

  const includeInterference = sampled !== null && sampled !== undefined
    && modes.every((mode) => perMode[mode]?.interference !== null && perMode[mode]?.interference !== undefined);

  for (const dimension of ["contrast", "brand", "luma", "hue", "interference"]) {
    if (dimension === "interference" && !includeInterference) continue;
    for (const mode of modes) {
      const entry = perMode[mode]?.[dimension];
      if (entry === null || entry === undefined) continue;
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
    failures,
  };
}

// ---------------------------------------------------------------------------
// Palette suggestion
// ---------------------------------------------------------------------------

export const HARMONIES = Object.freeze(["monochrome", "analogous", "complementary"]);

const HUE_OFFSET = { monochrome: 8, analogous: 32, complementary: 180 };

function brandFromSeed(hsl, mode, harmony) {
  const hue = (hsl.h + HUE_OFFSET[harmony]) % 360;
  const saturation = Math.min(0.92, Math.max(0.45, hsl.s + (harmony === "monochrome" ? 0.1 : 0.18)));
  if (mode === "light") {
    // dark enough to clear 3:1 on a near-white surface
    return hslToRgb({ h: hue, s: saturation, l: Math.min(0.42, Math.max(0.22, hsl.l * 0.55)) });
  }
  // light enough to clear 3:1 on a near-black surface
  return hslToRgb({ h: hue, s: Math.min(0.9, saturation), l: Math.max(0.62, Math.min(0.78, hsl.l + 0.35)) });
}

function rgbaLabel(color, alpha) {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}

/**
 * Build a light/dark token set around a seed colour. Deterministic: same seed +
 * harmony always yields the same palette.
 */
export function suggestPalette(seedHex, { harmony = "analogous" } = {}) {
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
    "--dsw-alias-label-secondary": rgbaLabel(labelLight, 0.72),
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
    "--dsw-alias-label-secondary": rgbaLabel(labelDark, 0.72),
  };

  return { light, dark };
}

/**
 * Rank the three harmonies for a seed colour using the same scorer.
 * Returns the best first; ties break by declaration order (monochrome first).
 */
export function rankPalettes(seedHex, { baseTheme } = {}) {
  return HARMONIES
    .map((harmony) => {
      const colors = suggestPalette(seedHex, { harmony });
      const theme = {
        ...(baseTheme ?? {}),
        schema: 1,
        id: baseTheme?.id ?? "suggested",
        name: baseTheme?.name ?? { zh: "建议", en: "Suggested" },
        colors,
      };
      const report = scoreTheme(theme);
      return { harmony, colors, report };
    })
    .sort((a, b) => b.report.score - a.report.score);
}