/**
 * Procedural wallpaper recipes (pure Node, no canvas, no GPU, no deps).
 *
 * Every recipe paints an RGB buffer and hands it to `encodePng`, so the same
 * code path works in tests, in the CLI and at build time. Determinism is part of
 * the contract: the same (recipe, seed, size) must produce the same pixels, or a
 * theme could not be regenerated after someone deletes its assets.
 *
 * Scope note: these are *static* wallpapers. The dynamic channel is the runtime
 * canvas art (`themes/<id>/art.js`), which is live rather than pre-rendered.
 */
import { encodePng } from "./png-stats.js";
import { PREMIUM_ANIMATED, PREMIUM_FNS, PREMIUM_META } from "./art-recipes-premium.js";

export const ART_RECIPES_BASE = Object.freeze({
  starfield: {
    label: { zh: "星云", en: "Starfield" },
    description: "深空底色 + 星云光雾 + 三层星点，静帧版的星云主题",
  },
  "ink-wash": {
    label: { zh: "水墨", en: "Ink wash" },
    description: "宣纸底 + 米氏云山剪影 + 飞白噪点，静帧版的山水主题",
  },
  fluid: {
    label: { zh: "流体", en: "Fluid" },
    description: "域扭曲噪声 + 双色映射，柔和的抽象流体",
  },
  "neon-grid": {
    label: { zh: "霓虹网格", en: "Neon grid" },
    description: "地平线辉光 + 透视网格 + 扫描线",
  },
  "paper-grain": {
    label: { zh: "纸纹", en: "Paper grain" },
    description: "暖纸底 + 纤维噪声 + 暗角",
  },
  "ridge-dawn": {
    label: { zh: "晨雾山脊", en: "Ridge at dawn" },
    description: "分层山脊 + 大气透视 + 天光渐变",
  },
});

/** Every recipe: the first-generation set plus the premium overrides/additions. */
export const ART_RECIPES = Object.freeze({ ...ART_RECIPES_BASE, ...PREMIUM_META });

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (value) => Math.min(255, Math.max(0, Math.round(value)));
const mix = (a, b, t) => a + (b - a) * t;
const smoothstep = (t) => t * t * (3 - 2 * t);

/** 2D value noise with smooth interpolation (enough for gradients/fluid). */
function makeNoise(random, gridSize = 8) {
  const table = new Float32Array((gridSize + 1) * (gridSize + 1));
  for (let index = 0; index < table.length; index += 1) table[index] = random();
  const at = (x, y) => table[(y % (gridSize + 1)) * (gridSize + 1) + (x % (gridSize + 1))];
  return (u, v) => {
    const x = u * gridSize;
    const y = v * gridSize;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = smoothstep(x - x0);
    const ty = smoothstep(y - y0);
    const top = mix(at(x0, y0), at(x0 + 1, y0), tx);
    const bottom = mix(at(x0, y0 + 1), at(x0 + 1, y0 + 1), tx);
    return mix(top, bottom, ty);
  };
}

function paint(width, height, fn) {
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

/** Soft radial glow added with screen blending. */
function glow(u, v, cx, cy, radius, strength) {
  const dx = u - cx;
  const dy = v - cy;
  const d = Math.sqrt(dx * dx + dy * dy) / radius;
  if (d >= 1) return 0;
  return (1 - d) ** 2 * strength;
}

const RECIPE_FNS = {
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
      speed: 0.003 + random() * 0.01,
    }));
    const shimmer = 0.5 + 0.5 * Math.sin(time * 0.9);
    const px = paint(width, height, (u, v) => {
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
      const tintB = mix(bright, bright * 1.0, star.tint);
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
    // `tone: "dark"` is the night scroll: deep ink paper, pale mist ridges.
    const dark = tone === "dark";
    const paper = dark ? [22, 24, 28] : [246, 241, 231];
    const inkTones = dark
      ? [0.42, 0.32, 0.22, 0.14]
      : [0.34, 0.52, 0.76, 0.95];
    const ridges = [
      { y: 0.52, amp: 0.055, freq: 2.1, shift: 0.0 },
      { y: 0.62, amp: 0.075, freq: 1.5, shift: 1.7 },
      { y: 0.76, amp: 0.05, freq: 2.8, shift: 3.1 },
      { y: 0.88, amp: 0.035, freq: 3.6, shift: 5.3 },
    ].map((ridge, index) => ({ ...ridge, tone: inkTones[index] }));
    const specks = Array.from({ length: 420 }, () => ({ u: random(), v: 0.45 + random() * 0.55, s: random() }));
    return finish(width, height, paint(width, height, (u, v) => {
      // warm washi paper
      const grain = (fiber(u * 3, v * 3) - 0.5) * (dark ? 8 : 14);
      let r = paper[0] + grain;
      let g = paper[1] + grain;
      let b = paper[2] + grain * 0.8;
      // paper fibres
      r -= Math.abs(Math.sin((u * 220) + v * 8)) * 2.4;
      g -= Math.abs(Math.sin((u * 220) + v * 8)) * 2.2;
      const inkRgb = dark ? [186, 196, 206] : [28, 30, 30];
      // sumi ridges, nearest (darkest) wins, with a wet edge
      for (const ridge of ridges) {
        const profile = ridge.y
          + Math.sin((u * ridge.freq + ridge.shift) * Math.PI * 2) * ridge.amp
          + Math.sin((u * ridge.freq * 2.7 + ridge.shift) * Math.PI * 2) * ridge.amp * 0.32;
        if (v < profile) continue;
        const depth = Math.min(1, (v - profile) / 0.22);
        const wet = Math.exp(-((v - profile) ** 2) / 0.00004) * 0.35;
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
      // bottom fade to paper so text panels stay readable
      const fade = smoothstep(Math.min(1, Math.max(0, (v - 0.82) / 0.18)));
      return [
        mix(r, paper[0] + 2, fade * 0.75),
        mix(g, paper[1] + 2, fade * 0.75),
        mix(b, paper[2] + 2, fade * 0.75),
      ];
    }));
  },

  fluid({ width, height, seed, time = 0 }) {
    const random = mulberry32(seed);
    const warp = makeNoise(random, 10);
    const flow = makeNoise(random, 5);
    // Slow domain drift: the whole field breathes instead of sliding.
    const clock = time * 0.06;
    return finish(width, height, paint(width, height, (u, v) => {
      const w1 = warp(u + clock, v - clock * 0.6);
      const w2 = warp(u + w1 * 0.35 - clock * 0.4, v - w1 * 0.28 + clock * 0.3);
      const t = Math.min(1, Math.max(0, flow(u + w2 * 0.5 + clock * 0.2, v + w1 * 0.4 - clock * 0.15)));
      const violet = [58, 44, 128];
      const teal = [38, 138, 148];
      const blush = [214, 132, 168];
      const mid = t < 0.5 ? t * 2 : (t - 0.5) * 2;
      const base = t < 0.5
        ? [mix(violet[0], teal[0], mid), mix(violet[1], teal[1], mid), mix(violet[2], teal[2], mid)]
        : [mix(teal[0], blush[0], mid), mix(teal[1], blush[1], mid), mix(teal[2], blush[2], mid)];
      const sheen = (1 - Math.abs(w2 - 0.5) * 2) * 26;
      return [base[0] + sheen, base[1] + sheen * 0.8, base[2] + sheen * 1.1];
    }));
  },

  "neon-grid"({ width, height, seed }) {
    const random = mulberry32(seed);
    const sky = makeNoise(random, 7);
    const horizon = 0.62;
    return finish(width, height, paint(width, height, (u, v) => {
      if (v < horizon) {
        const depth = 1 - v / horizon;
        let r = mix(58, 12, depth);
        let g = mix(16, 6, depth);
        let b = mix(86, 22, depth);
        r += sky(u, v) * 40;
        b += sky(u, v) * 70;
        r += glow(u, v, 0.5, horizon, 0.45, 90);
        g += glow(u, v, 0.5, horizon, 0.45, 30);
        b += glow(u, v, 0.5, horizon, 0.45, 120);
        return [r, g, b];
      }
      // floor: perspective grid
      const depth = (v - horizon) / (1 - horizon);
      const scale = 1 / Math.max(0.0001, depth);
      const horizonGlow = Math.exp(-depth * 5) * 120;
      const gx = Math.abs(((u * scale * 6) % 1) - 0.5);
      const gy = Math.abs(((scale * 0.9) % 1) - 0.5);
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
    return finish(width, height, paint(width, height, (u, v) => {
      const grain = (fiber(u * 5, v * 5) - 0.5) * 10 + (random() - 0.5) * 6;
      const vignette = 1 - Math.min(1, (Math.hypot(u - 0.5, v - 0.5) / 0.85) ** 2) * 0.28;
      return [
        (243 + grain) * vignette,
        (234 + grain) * vignette,
        (214 + grain * 0.9) * vignette,
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
      { base: 0.84, amp: 0.04, freq: 3.1, tone: [42, 48, 66], phase: 5.1 },
    ];
    return finish(width, height, paint(width, height, (u, v) => {
      // sky: dawn gradient + sun bloom
      const skyT = Math.min(1, v / 0.65);
      let r = mix(252, 214, skyT);
      let g = mix(226, 186, skyT);
      let b = mix(198, 176, skyT);
      r += glow(u, v, 0.72, 0.34, 0.5, 60);
      g += glow(u, v, 0.72, 0.34, 0.5, 40);
      b += glow(u, v, 0.72, 0.34, 0.5, 18);
      for (const layer of layers) {
        const profile = layer.base
          + Math.sin((u * layer.freq + layer.phase) * Math.PI * 2) * layer.amp
          + Math.sin((u * layer.freq * 3.1 + layer.phase) * Math.PI * 2) * layer.amp * 0.28;
        if (v < profile) continue;
        const blend = 0.78 + haze(u * 2, v * 2) * 0.22;
        r = mix(r, layer.tone[0] * blend, 0.9);
        g = mix(g, layer.tone[1] * blend, 0.9);
        b = mix(b, layer.tone[2] * blend, 0.9);
      }
      return [r, g, b];
    }));
  },
};

// The premium set replaces starfield / ink-wash / fluid and adds silk and
// aurora-veil. Overrides happen here so the first-generation bodies above stay
// readable as the "simple" reference implementation.
Object.assign(RECIPE_FNS, PREMIUM_FNS);

/**
 * Render one recipe to a PNG buffer.
 * `time` is the animation clock in seconds (default 0). Recipes that support it
 * produce a different frame per `time`, which is how a code recipe becomes a
 * video wallpaper (`vft wallpaper anim`); at `time: 0` they render the still.
 * `duration` is the length of the clip being rendered. Animated recipes derive
 * every moving value from `loopPhase(time, duration, cycles)`, so an integer
 * number of cycles closes the loop with no visible seam.
 * @param {keyof ART_RECIPES} recipe
 * @param {{width?: number, height?: number, seed?: number, tone?: "light"|"dark", time?: number, duration?: number}} options
 */
export function renderArt(recipe, options = {}) {
  const fn = RECIPE_FNS[recipe];
  if (fn === undefined) {
    throw new Error(`unknown art recipe "${recipe}" (available: ${Object.keys(RECIPE_FNS).join(", ")})`);
  }
  const width = Math.max(16, Math.min(4096, Math.round(options.width ?? 1024)));
  const height = Math.max(16, Math.min(4096, Math.round(options.height ?? 1536)));
  const seed = Number.isFinite(options.seed) ? Math.abs(Math.floor(options.seed)) : 1;
  const time = Number.isFinite(options.time) ? options.time : 0;
  const duration = Number.isFinite(options.duration) && options.duration > 0 ? options.duration : 0;
  return fn({ width, height, seed, time, duration, tone: options.tone === "dark" ? "dark" : "light" });
}

/** Recipes that animate: they change with `time`. */
export const ANIMATED_RECIPES = PREMIUM_ANIMATED;