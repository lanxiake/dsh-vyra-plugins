import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeTheme, wallpaperLayersFromTheme, THEME_ASSET_MIME } from "../src/shared/personalization/theme-model.js";
import { CODE_ART_LIMITS } from "../src/client/wallpaper-art.js";

const THEMES_DIR = fileURLToPath(new URL("../themes/", import.meta.url));

function themeDirs() {
  /* All five bundled themes were retired, and git drops `themes/` once its
     last file goes. An absent directory means "no bundled themes", not an
     error — the loops below then simply have nothing to check. */
  if (!existsSync(THEMES_DIR)) return [];
  return readdirSync(THEMES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function readTheme(id) {
  const raw = JSON.parse(readFileSync(join(THEMES_DIR, id, "theme.json"), "utf8"));
  const result = normalizeTheme(raw);
  assert.equal(result.ok, true, `${id}: ${JSON.stringify(result.issues)}`);
  return result.theme;
}

function assertAsset(themeId, relPath, expectedMimePrefix) {
  const absolute = join(THEMES_DIR, themeId, relPath);
  const stat = statSync(absolute); // throws when a referenced asset is missing
  assert.ok(stat.isFile(), `${themeId}: ${relPath} must be a file`);
  const extension = /\.[a-z0-9]+$/i.exec(relPath)?.[0].toLowerCase();
  const mime = THEME_ASSET_MIME[extension];
  assert.ok(mime && mime.startsWith(expectedMimePrefix), `${themeId}: ${relPath} has unsupported extension`);
}

test("every bundled theme is valid, correctly named and ships the assets it references", () => {
  const ids = themeDirs();
  /* The five bundled themes (aurora / ink-landscape / liquid / magnet /
     nebula) were retired on request, leaving themes/ empty. The loop still
     runs so that a theme added later is held to the same contract; only the
     "at least two" floor is gone, because it was asserting the retired set. */
  assert.ok(Array.isArray(ids), "themes/ must be readable");
  for (const dir of ids) {
    const theme = readTheme(dir);
    assert.equal(theme.id, dir, `${dir}: directory name must equal theme.id`);
    const wallpaper = theme.wallpaper;
    if (wallpaper === null) continue;
    if (wallpaper.kind === "image" || wallpaper.kind === "animated") {
      for (const side of [wallpaper.light, wallpaper.dark]) {
        if (side === null) continue;
        assertAsset(dir, side.src, "image/");
      }
      continue;
    }
    if (wallpaper.kind === "video") {
      for (const side of [wallpaper.light, wallpaper.dark]) {
        if (side === null) continue;
        assertAsset(dir, side.src, "video/");
        if (side.poster) assertAsset(dir, side.poster, "image/");
      }
      continue;
    }
    if (wallpaper.kind === "code") {
      assertAsset(dir, wallpaper.entry, "text/plain");
      const source = readFileSync(join(THEMES_DIR, dir, wallpaper.entry), "utf8");
      assert.ok(Buffer.byteLength(source) <= CODE_ART_LIMITS.maxSourceBytes, `${dir}: art source too large`);
      assert.match(source, /art\.mount\(/, `${dir}: code art must expose art.mount(canvas, env)`);
      assert.ok(!/\bimport\s/.test(source), `${dir}: code art must be a single self-contained file`);
      // the inline transform the runtime applies must find a binding
      assert.ok(/export\s+(const|let|var|function|class)\s+art\b/.test(source) || /export\s+default/.test(source),
        `${dir}: code art must export art`);
    }
  }
});

test("element layers derived from bundled themes point at served theme paths", () => {
  for (const dir of themeDirs()) {
    const theme = readTheme(dir);
    for (const layer of wallpaperLayersFromTheme(theme)) {
      const urls = layer.kind === "video"
        ? [layer.light?.src, layer.light?.poster, layer.dark?.src, layer.dark?.poster].filter(Boolean)
        : [layer.entry];
      for (const url of urls) {
        assert.match(url, new RegExp(`^/vyra-free-theme/theme/${dir}/`), `${dir}: layer url ${url}`);
      }
    }
  }
});