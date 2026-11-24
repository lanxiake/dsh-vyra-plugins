#!/usr/bin/env node
/**
 * Bundle guard (ADR-0023改形): assets can never enter the client bundle.
 *
 * History: through 1.5.21 this guard enforced a GROWTH formula —
 *   lib/client.js ≤ 776,360 (code baseline, ratcheted at 1.0.1 → 770,785 and
 *   1.2.3 → 776,360) + ceil(ΣWebP × 4/3) + 20,480 slack
 * blessing a bundle that tracked the wallpaper total (3,375,471 bytes at
 * 1.5.21, 94.4% inline image data). ADR-0023 externalized the non-factory
 * artwork to assets/ + the host asset route, so the ceiling becomes FIXED:
 *
 *   1. lib/client.js ≤ 351,737 (= 331,257 measured at the 1.5.22 externalized
 *      build + 20,480 accidental-growth slack; ratchet down with future
 *      shrinkage, never up for asset reasons — assets belong in assets/).
 *   2. No single line may exceed 150,000 bytes (a mega-string regression
 *      trips this before the ceiling; the old inline openbmc art line was
 *      ~139,458, which is where the number comes from).
 *   3. assets/manifest.json drift checks: unique entries, files exist and
 *      match their declared bytes, per-file sha256 recomputed over the actual
 *      bytes (content-level — same-length tampering is detectable), single
 *      file ≤ 640,000, meirenzhi total ≤ 2,300,000 (plan-B guardrails,
 *      values inherited verbatim from build-meirenzhi-wallpapers.mjs), and no
 *      entries for a retired skin (openbmc / uefi-harness).
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const CLIENT = "lib/client.js";
const MANIFEST = "assets/manifest.json";
const ASSETS_DIR = "assets";
const MAX_CLIENT_BYTES = 351_737;
const MAX_LINE_BYTES = 150_000;
const MAX_SINGLE_WEBP_BYTES = 640_000;
const MAX_MEIRENZHI_TOTAL_BYTES = 2_300_000;
/* The uefi-harness golden pin was removed with that skin. No hand-migrated
   asset remains outside the manifest's own byte/sha checks. */

const problems = [];

const clientBytes = readFileSync(CLIENT).length;
if (clientBytes > MAX_CLIENT_BYTES) {
  problems.push(`lib/client.js ${clientBytes} exceeds the fixed ceiling ${MAX_CLIENT_BYTES} (asset bytes belong in assets/, not the bundle)`);
}

let longest = 0;
let longestLine = 0;
const lines = readFileSync(CLIENT, "utf8").split("\n");
for (let index = 0; index < lines.length; index += 1) {
  if (lines[index].length > longest) {
    longest = lines[index].length;
    longestLine = index + 1;
  }
}
if (longest > MAX_LINE_BYTES) {
  problems.push(`lib/client.js line ${longestLine} is ${longest} bytes (>${MAX_LINE_BYTES}) — inline mega-string regression`);
}

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const seen = new Set();
const totals = new Map();
for (const entry of manifest.entries ?? []) {
  const id = `${entry.skinId}:${entry.assetKey}`;
  if (seen.has(id)) {
    problems.push(`manifest: duplicate entry ${id}`);
    continue;
  }
  seen.add(id);
  /* openbmc and uefi-harness were retired with the bundled themes; a manifest
     that still lists them is stale and must be rebuilt, not silently kept. */
  if (entry.skinId === "openbmc" || entry.skinId === "uefi-harness") {
    problems.push(`manifest: ${id} belongs to a retired skin (openbmc / uefi-harness were removed)`);
  }
  let buffer;
  try {
    buffer = readFileSync(`${ASSETS_DIR}/${entry.file}`);
  } catch {
    problems.push(`manifest: file missing for ${id}: assets/${entry.file}`);
    continue;
  }
  if (buffer.length !== entry.bytes) {
    problems.push(`manifest: bytes mismatch for ${id}: file ${buffer.length} !== manifest ${entry.bytes}`);
  }
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  if (sha256 !== entry.sha256) {
    problems.push(`manifest: sha256 mismatch for ${id} (content-level check)`);
  }
  if (entry.bytes > MAX_SINGLE_WEBP_BYTES) {
    problems.push(`manifest: ${id} is ${entry.bytes} bytes (> ${MAX_SINGLE_WEBP_BYTES} single-file guard)`);
  }
  if (entry.skinId === "meirenzhi") {
    totals.set(entry.skinId, (totals.get(entry.skinId) ?? 0) + entry.bytes);
  }
}

/* The former golden pin for uefi-harness:art is gone with that skin; the
   manifest's own per-entry byte and sha checks still cover every asset. */
const mrzTotal = totals.get("meirenzhi") ?? 0;
if (mrzTotal > MAX_MEIRENZHI_TOTAL_BYTES) {
  problems.push(`manifest: meirenzhi total ${mrzTotal} exceeds the ${MAX_MEIRENZHI_TOTAL_BYTES}-byte guard`);
}

// Asset-rev gate (2026-11-01 Beat 1, folded back onto the ADR-0023 guard
// during redelivery): the build-time define must have substituted the rev
// (minified shape: `rev = "<version>"` feeding the `?v=${rev}` template —
// the contiguous string `?v=<version>` never appears), with zero unresolved
// __VFT_ASSET_REV__ residue. verify:delivery re-asserts on the PACKED
// artifact (the one npm actually ships).
{
  const version = JSON.parse(readFileSync("package.json", "utf8")).version;
  const clientText = readFileSync(CLIENT, "utf8");
  const revEscaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!new RegExp(`rev\\s*=\\s*"${revEscaped}"`).test(clientText)) problems.push(`lib/client.js lacks the asset-rev define literal rev = "${version}"`);
  if (!clientText.includes("?v=")) problems.push("lib/client.js lacks the ?v= cache-busting template");
  if (clientText.includes("__VFT_ASSET_REV__")) problems.push("lib/client.js carries unresolved __VFT_ASSET_REV__");
}

// Reverse drift check (ADR-0023 review R-1): the forward pass above is
// entry-driven — an asset file on disk WITHOUT a manifest entry would never
// be inspected (dropped from delivery, silently unguarded). Walk the assets
// tree and require every b_*.webp to be registered; factory-skin files are
// reported with the inline-rule reason.
const BUILTIN_FILE_PATTERN = /^b_([a-z0-9][a-z0-9-]*)_([a-z0-9][a-z0-9-]*)\.webp$/;
const registeredFiles = new Set([...seen].map((id) => {
  const [skinId, assetKey] = id.split(":");
  return `b_${skinId}_${assetKey}.webp`;
}));
const walkAssets = (dir) => {
  for (const dirent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, dirent.name);
    if (dirent.isDirectory()) walkAssets(full);
    else if (BUILTIN_FILE_PATTERN.test(dirent.name)) {
      if (!registeredFiles.has(dirent.name)) {
        problems.push(`assets: ${dirent.name} is not registered in ${MANIFEST}`);
      }
    }
  }
};
walkAssets(ASSETS_DIR);

if (problems.length > 0) {
  for (const problem of problems) console.error(`bundle-guard: ${problem}`);
  process.exit(1);
}
console.log(
  `✓ bundle guard OK: lib/client.js ${clientBytes} ≤ ${MAX_CLIENT_BYTES} (longest line ${longest}); `
  + `manifest ${seen.size} entries, meirenzhi Σ ${mrzTotal} ≤ ${MAX_MEIRENZHI_TOTAL_BYTES}, assets tree fully registered`,
);
