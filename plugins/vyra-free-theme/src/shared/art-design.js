/**
 * Design primitives for procedural wallpapers.
 *
 * "Premium" is not a vibe here — it is a short list of decisions that separate a
 * flat gradient from a composed image. Each one is a function so every recipe
 * gets them, instead of each recipe reinventing (or forgetting) them:
 *
 *   1. A tonal ladder, not a gradient. Five values with the shadows shifted cool
 *      and the highlights shifted warm; nothing is pure black or pure white.
 *   2. Atmosphere. Distant layers lose contrast and drift toward the fog colour,
 *      the way air actually reads.
 *   3. A quiet zone. The interface draws text over the middle-left; the art must
 *      get calmer there or the UI fights the wallpaper.
 *   4. A focal point. One bloom, off-centre (rule of thirds), not a symmetric
 *      spotlight in the middle.
 *   5. Grain + ordered dither. Film grain hides banding; a Bayer dither kills
 *      the "8-bit stair" that cheap gradients show on large panels.
 *   6. Seamless motion. Every animated value is periodic over the loop length,
 *      so a video wallpaper never jumps at the end.
 */

export const FOG = Object.freeze({ light: [232, 236, 240], dark: [18, 22, 30] });

const clampByte = (value) => Math.min(255, Math.max(0, Math.round(value)));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (t) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

/** Cool the shadows, warm the highlights: the single cheapest "graded film" cue. */
export function grade(rgb, { shadowShift = [2, 4, 12], highlightShift = [6, 3, -4] } = {}) {
  const [r, g, b] = rgb;
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const shadow = 1 - luma;
  return [
    clampByte(r + shadowShift[0] * shadow + highlightShift[0] * luma),
    clampByte(g + shadowShift[1] * shadow + highlightShift[1] * luma),
    clampByte(b + shadowShift[2] * shadow + highlightShift[2] * luma),
  ];
}

/**
 * Five-step tonal ladder between `dark` and `light` with a hue-shifted midpoint.
 * `t` spans 0..1.
 */
export function tonalLadder(t, dark, mid, light) {
  const x = Math.min(1, Math.max(0, t));
  const eased = smoothstep(x);
  const from = eased < 0.5 ? dark : mid;
  const to = eased < 0.5 ? mid : light;
  const local = eased < 0.5 ? eased * 2 : (eased - 0.5) * 2;
  return [lerp(from[0], to[0], local), lerp(from[1], to[1], local), lerp(from[2], to[2], local)];
}

/** Distance-based atmospheric blend: `amount` 0 = untouched, 1 = fully fogged. */
export function atmosphere(rgb, fog, amount) {
  const a = Math.min(1, Math.max(0, amount));
  return [lerp(rgb[0], fog[0], a), lerp(rgb[1], fog[1], a), lerp(rgb[2], fog[2], a)];
}

/** Radial vignette multiplier (1 in the centre, `1 - strength` at the corners). */
export function vignette(u, v, { strength = 0.28, radius = 0.75, cx = 0.5, cy = 0.5 } = {}) {
  const d = Math.hypot(u - cx, v - cy) / radius;
  return 1 - Math.min(1, d * d) * strength;
}

/**
 * Calm-zone mask (0..1 = how much to calm). The interface stacks text over the
 * left/centre; `strength` pulls that area toward the theme surface colour.
 */
export function quietZone(u, v, { cx = 0.42, cy = 0.44, rx = 0.62, ry = 0.52, strength = 0.34 } = {}) {
  const d = Math.hypot((u - cx) / rx, (v - cy) / ry);
  return smoothstep(1 - d) * strength;
}

/** Ordered 4×4 Bayer dither, ±`amplitude` levels. Kills gradient banding. */
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
export function dither(x, y, amplitude = 1.6) {
  const value = BAYER[y & 3][x & 3] / 15 - 0.5;
  return value * amplitude;
}

/** Per-pixel grain from a cheap hash — stable for a given seed and position. */
export function grain(x, y, seed, amplitude = 3.2) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) >>> 0;
  h = (h ^ (h >>> 13)) * 1274126177 >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return ((h % 1000) / 1000 - 0.5) * amplitude;
}

/** Seamless loop clock: `t` in 0..1 across the clip, `phase` offsets a wave. */
export function loopClock(progress, cycles = 1, phase = 0) {
  return Math.sin(progress * Math.PI * 2 * cycles + phase);
}

/** Screen blend of a glow colour (brightens without clipping the base). */
export function screenBlend(rgb, glow, amount) {
  const a = Math.min(1, Math.max(0, amount));
  const screen = (base, light) => 255 - (255 - base) * (255 - light) / 255;
  return [
    lerp(rgb[0], screen(rgb[0], glow[0] * 255), a),
    lerp(rgb[1], screen(rgb[1], glow[1] * 255), a),
    lerp(rgb[2], screen(rgb[2], glow[2] * 255), a),
  ];
}

/**
 * Easing for motion that is allowed to settle. Nothing in a wallpaper should
 * bounce: arrival is slow and confident, which is what reads as expensive.
 */
export function easeOutQuint(t) {
  const x = Math.min(1, Math.max(0, t));
  return 1 - (1 - x) ** 5;
}

/** Symmetric ease: used for anything that breathes in and out over the loop. */
export function easeInOutSine(t) {
  const x = Math.min(1, Math.max(0, t));
  return 0.5 - 0.5 * Math.cos(Math.PI * x);
}

/**
 * Loop phase in radians for an animation cycle.
 *
 * The fraction is taken modulo one clip length *before* it is turned into
 * radians, so the frame after the last one and frame 0 evaluate to the very same
 * number instead of differing in the last float bit. `cycles` is rounded to an
 * integer for the same reason: a 0.5 multiplier would put the clip's end half a
 * wave away from its start.
 */
export function loopPhase(time, duration, cycles = 1, phase = 0) {
  const span = duration > 0 ? duration : 1;
  const cyclesInt = Math.max(1, Math.round(cycles));
  const fraction = ((time / span) % 1 + 1) % 1;
  return fraction * Math.PI * 2 * cyclesInt + phase;
}

/** Periodic 0..1 oscillation that starts and ends on the same value. */
export function loopSwing(time, duration, cycles = 1, phase = 0) {
  return 0.5 - 0.5 * Math.cos(loopPhase(time, duration, cycles, phase));
}

/**
 * Soft radial field with a controllable feather — a "blurred blob" without a
 * convolution. `feather` 1 is a smooth dome, 3+ keeps a bright core and a long
 * falloff, which is what a 100px gaussian looks like scaled to a canvas.
 */
export function softBlob(u, v, { cx, cy, radius, feather = 2.4 }) {
  const d = Math.hypot(u - cx, v - cy) / radius;
  if (d >= 1) return 0;
  return (1 - d) ** feather;
}

/** Soft circular bloom with a squared falloff — the "focal point" primitive. */
export function bloom(u, v, { cx, cy, radius, strength = 0.8 }) {
  const d = Math.hypot(u - cx, v - cy) / radius;
  if (d >= 1) return 0;
  return (1 - d) ** 3 * strength;
}

/**
 * Value noise with fBm octaves. `octaves: 3` is enough for cloud/silk fields and
 * still cheap enough for 2048×1280 stills.
 */
export function makeFbm(seed) {
  let state = seed >>> 0;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
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
    const at = (gx, gy) => grid.table[(gy % (grid.size + 1)) * (grid.size + 1) + (gx % (grid.size + 1))];
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

/**
 * Per-pixel finishing pass. Apply last: grade → quiet zone → vignette → dither →
 * grain. Every recipe ends here so no image escapes un-graded.
 */
export function finishPixel(rgb, { u, v, x, y, seed = 1, quiet = 0.34, vignetteStrength = 0.26, grainAmount = 2.6, ditherAmount = 1.4, surface = [20, 24, 32] }) {
  let out = grade(rgb);
  const calm = quietZone(u, v, { strength: quiet });
  if (calm > 0) out = atmosphere(out, surface, calm);
  const vig = vignette(u, v, { strength: vignetteStrength });
  out = [out[0] * vig, out[1] * vig, out[2] * vig];
  const offset = dither(x, y, ditherAmount) + grain(x, y, seed, grainAmount);
  return [clampByte(out[0] + offset), clampByte(out[1] + offset), clampByte(out[2] + offset)];
}