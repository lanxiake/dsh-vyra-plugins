import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ART_RECIPES, renderArt } from "../src/shared/art-recipes.js";
import { decodePng, imageStats } from "../src/shared/png-stats.js";
import { run } from "../cli/vft.mjs";
import { scoreTheme } from "../src/shared/personalization/color-score.js";
import { normalizeTheme } from "../src/shared/personalization/theme-model.js";

function vft(home, ...argv) {
  return run(argv, { dshHome: home });
}

test("every recipe renders a decodable PNG at the requested size", () => {
  for (const recipe of Object.keys(ART_RECIPES)) {
    const png = renderArt(recipe, { width: 96, height: 64, seed: 7 });
    const image = decodePng(png);
    assert.equal(image.width, 96, recipe);
    assert.equal(image.height, 64, recipe);
    assert.equal(image.channels, 3, recipe);
  }
});

test("rendering is deterministic per seed and varies across seeds", () => {
  const a = renderArt("starfield", { width: 64, height: 64, seed: 3 });
  const b = renderArt("starfield", { width: 64, height: 64, seed: 3 });
  const c = renderArt("starfield", { width: 64, height: 64, seed: 4 });
  assert.ok(a.equals(b), "same seed must produce identical bytes");
  assert.ok(!a.equals(c), "different seed must produce different art");
});

test("recipes produce art, not flat colour, and keep the busy ones busy", () => {
  const starfield = imageStats(renderArt("starfield", { width: 256, height: 256, seed: 1 }));
  assert.ok(starfield.stdLuma > 0.05, `starfield stdLuma ${starfield.stdLuma}`);
  assert.ok(starfield.edgeEnergy > 0.002, `starfield edge ${starfield.edgeEnergy}`);

  const ink = imageStats(renderArt("ink-wash", { width: 256, height: 256, seed: 1 }));
  assert.ok(ink.stdLuma > 0.05, `ink stdLuma ${ink.stdLuma}`);

  const paper = imageStats(renderArt("paper-grain", { width: 256, height: 256, seed: 1 }));
  assert.ok(paper.stdLuma < starfield.stdLuma, "paper should be calmer than a starfield");
});

test("an unknown recipe fails loudly", () => {
  assert.throws(() => renderArt("unicorn", { width: 64, height: 64 }), /unknown art recipe/);
});

test("vft wallpaper art writes the asset, sets the wallpaper and records pixel stats", async () => {
  const home = mkdtempSync(join(tmpdir(), "vft-art-"));
  await vft(home, "theme", "create", "--from", "mono", "--id", "mine");
  const generated = await vft(home, "wallpaper", "art", "mine", "--recipe", "starfield", "--size", "square", "--seed", "11", "--json");
  assert.equal(generated.exitCode, 0, JSON.stringify(generated.payload));
  const themeDir = join(home, "vyra-free-theme", "themes", "mine");
  const asset = join(themeDir, "assets", "starfield-11.png");
  assert.ok(existsSync(asset));
  const raw = JSON.parse(readFileSync(join(themeDir, "theme.json"), "utf8"));
  assert.equal(raw.wallpaper.kind, "image");
  assert.equal(raw.wallpaper.light.src, "assets/starfield-11.png");
  assert.equal(raw.wallpaper.dark.src, "assets/starfield-11.png");
  const stats = JSON.parse(readFileSync(join(themeDir, "wallpaper-stats.json"), "utf8"));
  assert.ok(stats.light.stdLuma > 0.05);
  assert.equal(generated.payload.stats.stdLuma, stats.light.stdLuma);

  // the gate now runs the interference dimension with real pixels
  const checked = await vft(home, "theme", "check", "mine", "--json");
  assert.equal(checked.exitCode, 0, JSON.stringify(checked.payload));
  assert.deepEqual(checked.payload.results[0].excluded, []);
});

test("a busy wallpaper measurably lowers a theme's colour score", () => {
  const theme = normalizeTheme({
    schema: 1,
    id: "busy",
    name: { zh: "花", en: "Busy" },
    colors: {
      light: {
        "--dsw-alias-bg-base": "#F4F2FF",
        "--dsw-alias-bg-layer-1": "#FBF9FF",
        "--dsw-alias-bg-layer-2": "#EEEAFB",
        "--dsw-alias-bg-layer-3": "#E4DEF6",
        "--dsw-alias-label-primary": "#211B33",
        "--dsw-alias-brand-primary": "#6D4AFF",
      },
      dark: {
        "--dsw-alias-bg-base": "#0E0B1A",
        "--dsw-alias-bg-layer-1": "#171226",
        "--dsw-alias-bg-layer-2": "#221A38",
        "--dsw-alias-bg-layer-3": "#2C2246",
        "--dsw-alias-label-primary": "#F3EEFF",
        "--dsw-alias-brand-primary": "#A78BFF",
      },
    },
  }).theme;
  const clean = scoreTheme(theme);
  const busyStats = imageStats(renderArt("starfield", { width: 256, height: 256, seed: 1 }));
  const withPixels = scoreTheme(theme, {
    sampled: { light: { stdLuma: busyStats.stdLuma * 3, edgeEnergy: busyStats.edgeEnergy * 6 }, dark: { stdLuma: busyStats.stdLuma * 3, edgeEnergy: busyStats.edgeEnergy * 6 } },
  });
  assert.equal(withPixels.sampled, true);
  assert.ok(withPixels.score < clean.score, `${withPixels.score} < ${clean.score}`);
});