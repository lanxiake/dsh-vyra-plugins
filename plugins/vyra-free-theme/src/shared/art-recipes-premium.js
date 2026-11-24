/**
 * Premium recipe set.
 *
 * These replace the first-generation recipes for the themes that ship, and add
 * the ones the wallpapers are actually chosen for. Every recipe runs the same
 * finishing pass (`finishPixel`), so the qualities that read as "expensive" are
 * present in all of them: a graded tonal ladder instead of a plain gradient,
 * atmospheric depth, an off-centre focal point, a calm zone under the interface
 * text, dither against banding, and film grain.
 *
 * The motion rules come from the production notes of the OpenMotion /
 * OpenDesign motion library (nexu-io/openmotion, Apache-2.0), read as design
 * guidance rather than copied: a small number of soft blobs instead of many
 * hard shapes, one dominant motion with everything else still, one accent
 * colour rather than a full rainbow, slow settling easing with no bounce, and a
 * loop that closes on itself.
 *
 * Loop discipline: an animated recipe derives every moving value from
 * `loopPhase(time, duration, cycles)` with an integer `cycles`, so the frame
 * that would come after the last one is exactly frame 0. That is what makes a
 * video wallpaper loop without a seam, and it is asserted in the tests.
 */
import { encodePng } from "./png-stats.js";
import {
  atmosphere,
  bloom,
  finishPixel,
  grade,
  loopPhase,
  loopSwing,
  makeFbm,
  screenBlend,
  softBlob,
  tonalLadder,
} from "./art-design.js";

const clampByte = (value) => Math.min(255, Math.max(0, Math.round(value)));
const clamp01 = (value) => Math.min(1, Math.max(0, value));
const lerp = (a, b, t) => a + (b - a) * t;

/** Paint an RGB pixel buffer (no encoding), for recipes that add pixels later. */
function paintPixels(width, height, fn) {
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = fn(x / width, y / height, x, y);
      const base = (y * width + x) * 3;
      pixels[base] = clampByte(r);
      pixels[base + 1] = clampByte(g);
      pixels[base + 2] = clampByte(b);
    }
  }
  return pixels;
}

/** Paint and encode in one step. */
function paint(width, height, fn) {
  return encodePng({ width, height, pixels: paintPixels(width, height, fn) });
}

/** Additive dot with soft falloff, clipped to the canvas. */
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
      pixels[base] = clampByte(pixels[base] + colour[0] * weight);
      pixels[base + 1] = clampByte(pixels[base + 1] + colour[1] * weight);
      pixels[base + 2] = clampByte(pixels[base + 2] + colour[2] * weight);
    }
  }
}

const seedRandom = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

// ---------------------------------------------------------------------------
// starfield - deep space with a graded nebula and two off-centre lights
// ---------------------------------------------------------------------------

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
    phase: random() * Math.PI * 2,
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
    rgb = screenBlend(rgb, [0.55, 0.42, 1.0], bloom(u, v, { cx: 0.34, cy: 0.36, radius: 0.46, strength: 0.42 }));
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

// ---------------------------------------------------------------------------
// ink-wash - washi paper, aerial-perspective ridges, wet edges
// ---------------------------------------------------------------------------

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
    { base: 0.85, amp: 0.038, freq: 3.2, phase: 5.2, density: 0.9, fog: 0.05 },
  ];
  const drift = Math.sin(loopPhase(time, duration || 1, 1)) * 0.004;

  return paint(width, height, (u, v, x, y) => {
    const fibre = fiber(u * 3.1, v * 3.1, { octaves: 3 });
    const stain = cloud(u * 1.2 + 0.3, v * 1.1 - 0.2, { octaves: 2 });
    let rgb = tonalLadder(0.25 + stain * 0.35, paper, paperLight, paperLight);
    rgb = [rgb[0] + (fibre - 0.5) * 7, rgb[1] + (fibre - 0.5) * 6.4, rgb[2] + (fibre - 0.5) * 5.6];

    for (const ridge of ridges) {
      // organic profile: sines plus an fbm warp, so no machine-perfect wave
      const warp = (cloud(u * 2.4 + ridge.phase, v * 0.6, { octaves: 3 }) - 0.5) * ridge.amp * 1.1;
      const profile = ridge.base
        + Math.sin((u * ridge.freq + ridge.phase + drift) * Math.PI * 2) * ridge.amp
        + Math.sin((u * ridge.freq * 2.6 + ridge.phase) * Math.PI * 2) * ridge.amp * 0.3
        + warp;
      if (v < profile) continue;
      const depth = Math.min(1, (v - profile) / 0.2);
      const wet = Math.exp(-((v - profile) ** 2) / 0.000035) * 0.3;
      const density = Math.min(1, ridge.density * (0.5 + depth * 0.7) + wet);
      const texture = 0.9 + fiber(u * 7, v * 7, { octaves: 2 }) * 0.2;
      const ridgeColour = atmosphere(ink, fog, ridge.fog + (1 - depth) * 0.1);
      rgb = [
        lerp(rgb[0], ridgeColour[0], density * texture),
        lerp(rgb[1], ridgeColour[1], density * texture),
        lerp(rgb[2], ridgeColour[2], density * texture),
      ];
    }

    const fade = clamp01((v - 0.8) / 0.2);
    rgb = atmosphere(rgb, paper, fade ** 1.6 * 0.55);
    return finishPixel(rgb, {
      u, v, x, y, seed,
      quiet: dark ? 0.34 : 0.28,
      surface: paper,
      grainAmount: dark ? 2.4 : 3,
      vignetteStrength: dark ? 0.3 : 0.16,
    });
  });
}

// ---------------------------------------------------------------------------
// fluid - two-octave domain warp with a graded three-stop palette
// ---------------------------------------------------------------------------

function fluid({ width, height, seed, time = 0, duration = 0, tone = "light" }) {
  const warpField = makeFbm(seed);
  const flowField = makeFbm(seed + 91);
  const dark = tone === "dark";
  // a forward drift that eases home, so the folds read as moving cloth
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

// ---------------------------------------------------------------------------
// aurora-blobs - the reference "premium hero" look: three soft colour fields
// ---------------------------------------------------------------------------

function auroraBlobs({ width, height, seed, time = 0, duration = 0 }) {
  const haze = makeFbm(seed + 13);
  const span = duration || 1;
  // One 8s cycle: fast enough to notice life, slow enough that the eye settles.
  const slow = loopPhase(time, span, 1);
  const breathe = loopPhase(time, span, 2);
  // 2-3 blobs, magenta / amber / violet. Radii are in canvas fractions so the
  // look is identical at 1080p and 4K; 0.13 of the short side is a ~140px blur.
  const blobs = [
    { tint: [0.909, 0.271, 0.604], cx: 0.34, cy: 0.4, r: 0.3, ox: 0.055, oy: 0.035, phase: 0, strength: 0.98 },
    { tint: [1.0, 0.71, 0.278], cx: 0.63, cy: 0.32, r: 0.24, ox: 0.04, oy: 0.05, phase: 2.1, strength: 0.74 },
    { tint: [0.478, 0.302, 1.0], cx: 0.5, cy: 0.68, r: 0.34, ox: 0.06, oy: 0.028, phase: 4.2, strength: 0.62 },
  ];
  const base = [11, 6, 16];

  return paint(width, height, (u, v, x, y) => {
    // near-black base with a faint upward lift, so it is never a dead flat fill
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
    // where the fields stack, lift toward white: that is what makes it a glow
    rgb = screenBlend(rgb, [1.0, 0.94, 0.98], clamp01((heat - 0.58) / 0.5) * 0.55);

    // one wide, dim key light so the whole frame has a direction
    rgb = screenBlend(rgb, [0.35, 0.2, 0.5], bloom(u, v, { cx: 0.42, cy: 0.48, radius: 0.9, strength: 0.14 }));
    return finishPixel(rgb, {
      u, v, x, y, seed,
      quiet: 0.22,
      surface: [11, 6, 16],
      grainAmount: 2.4,
      vignetteStrength: 0.34,
      ditherAmount: 1.8,
    });
  });
}

// ---------------------------------------------------------------------------
// liquid-blob - one saturated hue, shape morphing instead of a hard cut
// ---------------------------------------------------------------------------

function liquidBlob({ width, height, seed, time = 0, duration = 0 }) {
  const surface = makeFbm(seed + 29);
  const span = duration || 1;
  const slow = loopPhase(time, span, 1);
  // Metaball centres on Lissajous paths: the outline splits and rejoins, which
  // is what replaces a cut in this look.
  const balls = [
    { cx: 0.46, cy: 0.46, r: 0.26, ax: 0.1, ay: 0.07, phase: 0 },
    { cx: 0.58, cy: 0.52, r: 0.2, ax: 0.08, ay: 0.09, phase: 1.7 },
    { cx: 0.4, cy: 0.6, r: 0.17, ax: 0.07, ay: 0.05, phase: 3.4 },
    { cx: 0.56, cy: 0.4, r: 0.13, ax: 0.09, ay: 0.06, phase: 5.1 },
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
    // smooth threshold: the edge stays liquid instead of snapping
    const body = clamp01((field - 0.42) / 0.34);
    const rim = Math.exp(-((field - 0.46) ** 2) / 0.004) * 0.9;
    let rgb = tonalLadder(clamp01(v * 0.6), deep, [18, 13, 38], [28, 20, 54]);
    const sheen = surface(u * 2.2 + slow * 0.08, v * 2 - slow * 0.05, { octaves: 3 });
    rgb = screenBlend(rgb, [ink[0] / 255, ink[1] / 255, ink[2] / 255], body * (0.85 + sheen * 0.45));
    rgb = screenBlend(rgb, [0.72, 0.62, 1.0], rim * 0.75);
    // internal shading: brighter where the field is thickest
    rgb = [rgb[0] * (1 + body * 0.12), rgb[1] * (1 + body * 0.1), rgb[2] * (1 + body * 0.12)];
    rgb = screenBlend(rgb, [0.86, 0.8, 1.0], clamp01((body - 0.5) / 0.5) * 0.4);
    return finishPixel(rgb, {
      u, v, x, y, seed,
      quiet: 0.22,
      surface: deep,
      grainAmount: 2.4,
      vignetteStrength: 0.32,
    });
  });
}

// ---------------------------------------------------------------------------
// ink-ribbon - one ribbon behind the text, echo outline, paper ground
// ---------------------------------------------------------------------------

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

    // The centreline is a function of x, so one subtraction per pixel gets the
    // distance. Two harmonics keep it from reading as a sine wave.
    const centre = 0.44
      + Math.sin((u * 1.15 + 0.1 + drift) * Math.PI * 2) * 0.1
      + Math.sin((u * 2.3 - 0.35) * Math.PI * 2) * 0.045;
    const widthField = 0.035 + Math.sin((u * 1.7 + 0.6) * Math.PI * 2) * 0.012;
    const d = Math.abs(v - centre);

    if (d < widthField) {
      // solid ribbon with a wet edge
      const edge = clamp01(1 - (d / widthField) ** 4);
      rgb = [lerp(rgb[0], ink[0], edge), lerp(rgb[1], ink[1], edge), lerp(rgb[2], ink[2], edge)];
    } else if (d < widthField * 2.4) {
      // one echo outline: repetition as texture, never a second ribbon
      const echo = 1 - (d - widthField) / (widthField * 1.4);
      const weight = clamp01(echo) ** 2 * 0.22;
      rgb = [lerp(rgb[0], ink[0], weight), lerp(rgb[1], ink[1], weight), lerp(rgb[2], ink[2], weight)];
    }

    // a single accent block sits on the ribbon at the reading line
    if (Math.abs(v - 0.52) < 0.03 && u > 0.12 && u < 0.42) {
      rgb = [lerp(rgb[0], accent[0], 0.85), lerp(rgb[1], accent[1], 0.85), lerp(rgb[2], accent[2], 0.85)];
    }

    // calm the composition area, keep the right edge graphic
    rgb = atmosphere(rgb, paper, clamp01((u - 0.1) / 0.5) * 0.18);
    return finishPixel(rgb, {
      u, v, x, y, seed,
      quiet: tone === "dark" ? 0.26 : 0.2,
      surface: paper,
      grainAmount: tone === "dark" ? 2.2 : 2.6,
      vignetteStrength: tone === "dark" ? 0.28 : 0.14,
    });
  });
}

// ---------------------------------------------------------------------------
// magnet-field - flat paper, a thousand square dots, one meaningful accent
// ---------------------------------------------------------------------------

function magnetField({ width, height, seed, time = 0, duration = 0, tone = "light" }) {
  const dark = tone === "dark";
  const paper = dark ? [24, 26, 30] : [244, 241, 234];
  const charcoal = dark ? [214, 210, 200] : [30, 42, 47];
  const accent = dark ? [42, 178, 160] : [15, 156, 140];
  const span = duration || 1;
  const slow = loopPhase(time, span, 1);
  // Square dots stay legible where round ones blur together at the same size.
  const dot = Math.max(1.6, Math.min(width, height) / 300);
  const count = 1200;

  const pixels = paintPixels(width, height, (u, v, x, y) => {
    let rgb = paper;
    // flat fill is deliberate: gradient banding is visible under hundreds of
    // moving dots, and the dither in finishPixel would have to fight it
    const lift = dark ? 0 : 2.5;
    rgb = [rgb[0] + lift, rgb[1] + lift, rgb[2] + lift];
    return finishPixel(rgb, { u, v, x, y, seed, quiet: 0.16, surface: paper, grainAmount: dark ? 2 : 1.6, vignetteStrength: dark ? 0.24 : 0.1 });
  });

  for (let index = 0; index < count; index += 1) {
    // phyllotaxis lattice: even coverage with no visible rows
    const angle = index * 2.399963229728653;
    const radius = Math.sqrt(index / count) * 0.52;
    const swirl = slow + radius * 2.4;
    const u = 0.5 + Math.cos(angle + swirl) * radius * 1.18;
    const v = 0.5 + Math.sin(angle + swirl) * radius * 0.94;
    if (u < 0 || u > 1 || v < 0 || v > 1) continue;
    // atmospheric depth: outer dots fade, so the field has a centre of gravity
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
        pixels[base] = clampByte(lerp(pixels[base], colour[0], alpha));
        pixels[base + 1] = clampByte(lerp(pixels[base + 1], colour[1], alpha));
        pixels[base + 2] = clampByte(lerp(pixels[base + 2], colour[2], alpha));
      }
    }
  }
  return encodePng({ width, height, pixels });
}

// ---------------------------------------------------------------------------
// silk - anisotropic folds, the quietest of the set
// ---------------------------------------------------------------------------

function silk({ width, height, seed, time = 0, duration = 0, tone = "dark" }) {
  const folds = makeFbm(seed + 7);
  const dark = tone === "dark";
  const shadow = dark ? [16, 18, 26] : [222, 214, 206];
  const mid = dark ? [38, 42, 56] : [238, 228, 216];
  const light = dark ? [126, 132, 156] : [252, 248, 242];
  const gold = [196, 168, 122];
  const drift = Math.sin(loopPhase(time, duration || 1, 1)) * 0.05;

  return paint(width, height, (u, v, x, y) => {
    // rotate the sampling axis so folds run diagonally, not left-to-right
    const s = u * 0.82 + v * 0.28 + drift;
    const t = v * 0.94 - u * 0.16;
    const fold = folds(s * 1.6, t * 3.4, { octaves: 4 });
    const ridge = 1 - Math.abs(fold * 2 - 1);
    const sheen = Math.max(0, ridge - 0.72) * 3.2;
    let rgb = tonalLadder(ridge, shadow, mid, light);
    rgb = screenBlend(rgb, [gold[0] / 255, gold[1] / 255, gold[2] / 255], sheen * 0.3);
    rgb = screenBlend(rgb, [0.9, 0.93, 1.0], bloom(u, v, { cx: 0.62, cy: 0.3, radius: 0.5, strength: 0.12 }));
    return finishPixel(rgb, { u, v, x, y, seed, quiet: 0.3, surface: shadow, grainAmount: 2.6, vignetteStrength: 0.3 });
  });
}

// ---------------------------------------------------------------------------
// aurora-veil - vertical curtains, parallax, seamless loop
// ---------------------------------------------------------------------------

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
      { cx: 0.71, width: 0.2, tint: [0.5, 0.45, 1.0], speed: 1, strength: 0.3 },
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

export const PREMIUM_FNS = Object.freeze({
  starfield,
  "ink-wash": inkWash,
  fluid,
  "aurora-blobs": auroraBlobs,
  "liquid-blob": liquidBlob,
  "ink-ribbon": inkRibbon,
  "magnet-field": magnetField,
  silk,
  "aurora-veil": auroraVeil,
});

export const PREMIUM_META = Object.freeze({
  "aurora-blobs": {
    label: { zh: "极光色团", en: "Aurora blobs" },
    description: "三团柔光色场 + 单一主光，深梅黑底，8 秒无缝循环；最接近高级主视觉的做法",
  },
  "liquid-blob": {
    label: { zh: "液态色块", en: "Liquid blob" },
    description: "单一高饱和色相的金属球融合，形状自身分裂回流，没有硬切",
  },
  "ink-ribbon": {
    label: { zh: "墨带", en: "Ink ribbon" },
    description: "纸面上只有一条丝带，带一层回声轮廓，文字区保持干净",
  },
  "magnet-field": {
    label: { zh: "磁点场", en: "Magnet field" },
    description: "暖纸底 + 一千余方形点缓慢涡旋，青色只出现在焦点环",
  },
  silk: {
    label: { zh: "绸缎", en: "Silk" },
    description: "斜向褶皱 + 金色光泽 + 最安静的对比，长文阅读友好",
  },
  "aurora-veil": {
    label: { zh: "极光幕", en: "Aurora veil" },
    description: "三层视差光幕 + 星点 + 地平辉光，无缝循环",
  },
});

export const PREMIUM_ANIMATED = Object.freeze([
  "starfield",
  "fluid",
  "aurora-blobs",
  "liquid-blob",
  "magnet-field",
  "aurora-veil",
]);
