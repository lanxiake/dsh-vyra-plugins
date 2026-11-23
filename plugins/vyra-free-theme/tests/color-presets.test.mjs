import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeTheme } from "../src/shared/personalization/theme-model.js";
import { SCORE_THRESHOLD, scoreTheme, suggestPalette } from "../src/shared/personalization/color-score.js";

const PRESETS_DIR = fileURLToPath(new URL("../presets/colors/", import.meta.url));
const THEMES_DIR = fileURLToPath(new URL("../themes/", import.meta.url));

function ids(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function load(dir, id) {
  return JSON.parse(readFileSync(join(dir, id, "theme.json"), "utf8"));
}

test("the six built-in colour presets are valid and clear the colour gate", () => {
  const presetIds = ids(PRESETS_DIR);
  assert.equal(presetIds.length, 6, `expected six presets, found ${presetIds.join(", ")}`);
  for (const id of presetIds) {
    const result = normalizeTheme(load(PRESETS_DIR, id));
    assert.equal(result.ok, true, `${id}: ${JSON.stringify(result.issues)}`);
    assert.equal(result.theme.id, id, `${id}: id must match its directory`);
    const report = scoreTheme(result.theme);
    assert.equal(report.pass, true, `${id}: score ${report.score} — ${JSON.stringify(report.failures)}`);
    assert.equal(report.sampled, false);
  }
});

test("every bundled theme clears the same gate", () => {
  for (const id of ids(THEMES_DIR)) {
    const result = normalizeTheme(load(THEMES_DIR, id));
    assert.equal(result.ok, true, `${id}: ${JSON.stringify(result.issues)}`);
    const report = scoreTheme(result.theme);
    assert.equal(report.pass, true, `${id}: score ${report.score} — ${JSON.stringify(report.failures)}`);
    assert.ok(report.score >= SCORE_THRESHOLD);
  }
});

test("a preset can seed a new theme without re-deriving its colours", () => {
  const preset = normalizeTheme(load(PRESETS_DIR, "mono")).theme;
  const derived = normalizeTheme({
    schema: 1,
    id: "mono-copy",
    name: { zh: "极简副本", en: "Mono copy" },
    colors: preset.colors,
    translucency: preset.translucency,
    coverage: preset.coverage,
  });
  assert.equal(derived.ok, true, JSON.stringify(derived.issues));
  assert.equal(scoreTheme(derived.theme).pass, true);
});

test("suggestion never returns a palette below the gate for a mid-tone seed", () => {
  for (const seed of ["#6D4AFF", "#2F4F45", "#B08968", "#8A9A9E"]) {
    const colors = suggestPalette(seed, { harmony: "analogous" });
    const theme = normalizeTheme({
      schema: 1,
      id: "seed-check",
      name: { zh: "种子", en: "Seed" },
      colors,
    });
    assert.equal(theme.ok, true, `${seed}: ${JSON.stringify(theme.issues)}`);
    assert.equal(scoreTheme(theme.theme).pass, true, `${seed} should pass`);
  }
});