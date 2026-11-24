#!/usr/bin/env node
/**
 * build:art - regenerate the bundled themes' wallpapers from code.
 *
 * Every bundled wallpaper is reproducible: the recipe, seed and size live in
 * TARGETS below, and the output is byte-identical on any machine (the recipes
 * are deterministic). Running this is how a theme's art is created or repaired -
 * there is no hidden source image to lose.
 *
 *   node scripts/build-theme-art.mjs            # all targets
 *   node scripts/build-theme-art.mjs aurora     # one theme
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderArt } from "../src/shared/art-recipes.js";
import { imageStats } from "../src/shared/png-stats.js";
import { hasFfmpeg, renderArtVideo } from "../src/host/art-video.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const THEMES = join(ROOT, "themes");

/**
 * One entry per bundled theme that owes its art to code.
 *
 * `sides` maps a mode to the recipe tone used for it. A video entry renders one
 * clip per side; the clip's own length (frames / fps) is the loop length the
 * recipe closes on, so it must not be changed on one side only.
 */
const TARGETS = [
  {
    id: "ink-landscape",
    mode: "image",
    recipe: "ink-wash",
    seed: 7,
    size: { width: 2048, height: 1280 },
    sides: { light: { tone: "light" }, dark: { tone: "dark" } },
  },
  {
    id: "aurora",
    mode: "video",
    recipe: "aurora-blobs",
    seed: 3,
    size: { width: 1280, height: 720 },
    frames: 160,
    fps: 20,
    // One clip serves both modes: the palette already works dark, and the
    // per-mode difference belongs to the theme's scrim, not two files.
    sides: { light: { tone: "light" } },
  },
  {
    id: "liquid",
    mode: "video",
    recipe: "liquid-blob",
    seed: 11,
    size: { width: 1280, height: 720 },
    frames: 160,
    fps: 20,
    sides: { dark: { tone: "dark" } },
  },
  {
    id: "magnet",
    mode: "image",
    recipe: "magnet-field",
    seed: 5,
    size: { width: 2048, height: 1280 },
    sides: { light: { tone: "light" }, dark: { tone: "dark" } },
  },
];

function writeThemeJson(id, mutate) {
  const file = join(THEMES, id, "theme.json");
  const theme = JSON.parse(readFileSync(file, "utf8"));
  mutate(theme);
  writeFileSync(file, `${JSON.stringify(theme, null, 2)}\n`, "utf8");
}

function writeStats(id, stats) {
  writeFileSync(join(THEMES, id, "wallpaper-stats.json"), `${JSON.stringify(stats, null, 2)}\n`, "utf8");
}

const only = process.argv[2];
const ffmpegReady = hasFfmpeg();
let built = 0;

for (const target of TARGETS) {
  if (only !== undefined && only !== target.id) continue;
  if (target.mode === "video" && !ffmpegReady) {
    console.log(`skip ${target.id}: ffmpeg not found (needed for the video channel)`);
    continue;
  }
  const dir = join(THEMES, target.id);
  const assets = join(dir, "assets");
  mkdirSync(assets, { recursive: true });
  const stats = {};
  const wallpaper = { kind: target.mode === "video" ? "video" : "image" };

  for (const [side, sideOptions] of Object.entries(target.sides)) {
    const base = `${target.id}-${side}`;
    if (target.mode === "video") {
      const result = renderArtVideo({
        recipe: target.recipe,
        width: target.size.width,
        height: target.size.height,
        seed: target.seed,
        tone: sideOptions.tone,
        frames: target.frames,
        fps: target.fps,
        output: join(assets, `${base}.mp4`),
        posterPath: join(assets, `${base}.png`),
      });
      wallpaper[side] = { src: `assets/${base}.mp4`, poster: `assets/${base}.png` };
      const measured = imageStats(result.poster);
      stats[side] = { stdLuma: measured.stdLuma, edgeEnergy: measured.edgeEnergy, width: measured.width, height: measured.height };
      console.log(`built ${target.id}/${side}: ${result.frames} frames @${result.fps}fps, loop ${(result.frames / result.fps).toFixed(1)}s (${Math.round(result.bytes / 1024)} KB)`);
    } else {
      const png = renderArt(target.recipe, {
        width: target.size.width,
        height: target.size.height,
        seed: target.seed,
        tone: sideOptions.tone,
      });
      writeFileSync(join(assets, `${base}.png`), png);
      wallpaper[side] = { src: `assets/${base}.png` };
      const measured = imageStats(png);
      stats[side] = { stdLuma: measured.stdLuma, edgeEnergy: measured.edgeEnergy, width: measured.width, height: measured.height };
      console.log(`built ${target.id}/${side}: ${measured.width}x${measured.height} (${Math.round(png.byteLength / 1024)} KB)`);
    }
  }

  writeThemeJson(target.id, (theme) => {
    theme.wallpaper = wallpaper;
  });
  writeStats(target.id, { recipe: target.recipe, seed: target.seed, ...stats });
  built += 1;
}

console.log(`\n${built} theme(s) refreshed`);
