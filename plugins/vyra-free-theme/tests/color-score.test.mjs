import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  composite,
  contrastRatio,
  hueHarmonyScore,
  parseColor,
  rankPalettes,
  relativeLuminance,
  SCORE_THRESHOLD,
  scoreTheme,
  suggestPalette,
} from "../src/shared/personalization/color-score.js";
import { normalizeTheme } from "../src/shared/personalization/theme-model.js";

const NEBULA = normalizeTheme(JSON.parse(readFileSync(
  fileURLToPath(new URL("../themes/nebula/theme.json", import.meta.url)), "utf8",
))).theme;

test("colour parsing covers the forms a theme may use", () => {
  assert.deepEqual(parseColor("#fff"), { r: 255, g: 255, b: 255, a: 1 });
  assert.deepEqual(parseColor("#101016"), { r: 16, g: 16, b: 22, a: 1 });
  assert.deepEqual(parseColor("#10101680"), { r: 16, g: 16, b: 22, a: 128 / 255 });
  assert.deepEqual(parseColor("rgba(33, 27, 51, 0.72)"), { r: 33, g: 27, b: 51, a: 0.72 });
  assert.deepEqual(parseColor("rgb(10 20 30)"), { r: 10, g: 20, b: 30, a: 1 });
  assert.equal(parseColor("not-a-colour"), null);
});

test("WCAG contrast and compositing match the published formulas", () => {
  assert.equal(Math.round(contrastRatio(parseColor("#000000"), parseColor("#ffffff"))), 21);
  assert.equal(Math.round(contrastRatio(parseColor("#ffffff"), parseColor("#ffffff"))), 1);
  assert.equal(Math.round(relativeLuminance({ r: 255, g: 255, b: 255 })), 1);
  const blended = composite({ r: 0, g: 0, b: 0, a: 1 }, { r: 255, g: 255, b: 255 }, 0.5);
  assert.deepEqual({ r: Math.round(blended.r), g: Math.round(blended.g), b: Math.round(blended.b) }, { r: 128, g: 128, b: 128 });
});

test("hue harmony rewards analogous and complementary, punishes the muddle", () => {
  assert.equal(hueHarmonyScore(20, 0), 100); // analogous
  assert.equal(hueHarmonyScore(8, 0), 100); // monochrome
  assert.equal(hueHarmonyScore(180, 0), 100); // complementary
  assert.equal(hueHarmonyScore(205, 0), 100); // inside the 150–210 band
  assert.equal(hueHarmonyScore(90, 0), 0); // squarely between the bands
  assert.ok(hueHarmonyScore(110, 0) < 60);
});

test("a well-built theme passes the gate", () => {
  const report = scoreTheme(NEBULA);
  assert.equal(report.pass, true, JSON.stringify(report));
  assert.ok(report.score >= SCORE_THRESHOLD, `score ${report.score}`);
  assert.deepEqual(report.excluded, ["interference"]);
  assert.equal(report.sampled, false);
  assert.deepEqual(report.failures, []);
});

test("a low-contrast theme fails with an actionable finding", () => {
  const theme = normalizeTheme({
    schema: 1,
    id: "washed",
    name: { zh: "糊", en: "Washed" },
    colors: {
      light: {
        "--dsw-alias-bg-base": "#F4F2FF",
        "--dsw-alias-bg-layer-1": "#F5F3FF",
        "--dsw-alias-bg-layer-2": "#F4F2FE",
        "--dsw-alias-bg-layer-3": "#F3F1FD",
        "--dsw-alias-label-primary": "#DDD8EE",
        "--dsw-alias-brand-primary": "#E8E4F7",
      },
      dark: {
        "--dsw-alias-bg-base": "#0E0B1A",
        "--dsw-alias-bg-layer-1": "#0F0C1B",
        "--dsw-alias-bg-layer-2": "#0E0B19",
        "--dsw-alias-bg-layer-3": "#0D0A18",
        "--dsw-alias-label-primary": "#1A1626",
        "--dsw-alias-brand-primary": "#1B1730",
      },
    },
  }).theme;
  const report = scoreTheme(theme);
  assert.equal(report.pass, false);
  assert.ok(report.score < SCORE_THRESHOLD);
  const dimensions = report.failures.map((failure) => failure.dimension);
  assert.ok(dimensions.includes("contrast"), JSON.stringify(report.failures));
  assert.ok(dimensions.includes("brand"));
  assert.ok(report.failures.every((failure) => typeof failure.fix === "string" && failure.fix.length > 0));
});

test("pixel evidence adds the interference dimension and can fail a theme", () => {
  const busy = { light: { stdLuma: 0.42, edgeEnergy: 0.30 }, dark: { stdLuma: 0.38, edgeEnergy: 0.28 } };
  const withPixels = scoreTheme(NEBULA, { sampled: busy });
  assert.equal(withPixels.sampled, true);
  assert.deepEqual(withPixels.excluded, []);
  assert.ok(withPixels.breakdown.some((item) => item.dimension === "interference"));
  assert.ok(withPixels.failures.some((failure) => failure.dimension === "interference"));
  assert.ok(withPixels.score < scoreTheme(NEBULA).score);

  const calm = { light: { stdLuma: 0.02, edgeEnergy: 0.01 }, dark: { stdLuma: 0.02, edgeEnergy: 0.01 } };
  const calmReport = scoreTheme(NEBULA, { sampled: calm });
  assert.equal(calmReport.score, scoreTheme(NEBULA).score); // full marks for calm art
  assert.ok(calmReport.failures.every((failure) => failure.dimension !== "interference"));
});

test("suggested palettes are deterministic and pass the gate", () => {
  const first = suggestPalette("#6D4AFF", { harmony: "analogous" });
  const second = suggestPalette("#6D4AFF", { harmony: "analogous" });
  assert.deepEqual(first, second);
  for (const harmony of ["monochrome", "analogous", "complementary"]) {
    const colors = suggestPalette("#6D4AFF", { harmony });
    const theme = { schema: 1, id: "seed", name: { zh: "种子", en: "Seed" }, colors, shape: {}, translucency: { web: 45, desktop: 66, baked: {} }, coverage: { shell: false, scopes: ["sidebar"] }, brand: { title: null, mark: null, favicon: null, slogans: { zh: "", en: "" } }, wallpaper: null, sidebar: null, decorations: null };
    const report = scoreTheme(theme);
    assert.equal(report.pass, true, `${harmony}: ${JSON.stringify(report.failures)}`);
  }
});

test("rankPalettes returns the three harmonies best-first", () => {
  const ranked = rankPalettes("#2F4F45");
  assert.equal(ranked.length, 3);
  assert.deepEqual(ranked.map((entry) => entry.harmony).sort(), ["analogous", "complementary", "monochrome"]);
  for (let index = 1; index < ranked.length; index += 1) {
    assert.ok(ranked[index - 1].report.score >= ranked[index].report.score);
  }
});