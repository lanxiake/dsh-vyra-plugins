#!/usr/bin/env node
/**
 * verify:colors — the colour gate (spec §8.2).
 *
 * Scores every bundled theme and every colour preset with the same deterministic
 * five-dimension scorer the CLI and the panel use. Exits 2 when any of them is
 * below the threshold, so a palette cannot ship "because it looked fine".
 *
 * Usage:
 *   node scripts/check-colors.mjs            # gate
 *   node scripts/check-colors.mjs --table    # extra per-dimension detail
 *   node scripts/check-colors.mjs --json     # machine-readable
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeTheme } from "../src/shared/personalization/theme-model.js";
import { SCORE_THRESHOLD, scoreTheme } from "../src/shared/personalization/color-score.js";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const args = new Set(process.argv.slice(2));
const asJson = args.has("--json");
const detailed = args.has("--table") || asJson;

function themeIds(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(dir, entry.name, "theme.json")))
    .map((entry) => entry.name);
}

function load(dir, id) {
  return JSON.parse(readFileSync(join(dir, id, "theme.json"), "utf8"));
}

const results = [];
for (const [kind, dir] of [
  ["theme", join(ROOT, "themes")],
  ["preset", join(ROOT, "presets", "colors")],
]) {
  for (const id of themeIds(dir)) {
    const normalized = normalizeTheme(load(dir, id));
    if (!normalized.ok) {
      results.push({ kind, id, ok: false, issues: normalized.issues, score: 0, pass: false });
      continue;
    }
    const report = scoreTheme(normalized.theme);
    results.push({ kind, id, ok: true, score: report.score, pass: report.pass, report });
  }
}

const failures = results.filter((result) => !result.ok || !result.pass);

if (asJson) {
  console.log(JSON.stringify({ threshold: SCORE_THRESHOLD, results, failures: failures.length }, null, 2));
} else {
  console.log(`colour gate · threshold ${SCORE_THRESHOLD}\n`);
  for (const result of results) {
    const status = !result.ok ? "INVALID" : result.pass ? "pass" : "FAIL";
    const score = !result.ok ? "-" : String(result.score).padStart(3);
    console.log(`${status.padEnd(7)} ${score}  ${result.kind.padEnd(6)} ${result.id}`);
    if (!result.ok) {
      for (const issue of result.issues) console.log(`         · ${issue.code} ${issue.path}: ${issue.message}`);
      continue;
    }
    if (!detailed) continue;
    for (const item of result.report.breakdown) {
      if (item.dimension === "interference") continue;
      console.log(`         · ${item.dimension.padEnd(8)} ${item.mode.padEnd(5)} value=${String(item.value).padStart(3)} raw=${item.raw}`);
    }
    for (const failure of result.report.failures) {
      console.log(`         ! ${failure.dimension}/${failure.mode}: ${failure.fix}`);
    }
  }
  console.log(`\n${results.length - failures.length}/${results.length} at or above threshold`);
}

process.exit(failures.length === 0 ? 0 : 2);
