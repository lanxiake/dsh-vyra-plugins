import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readThemeAsset, resolveThemeAsset } from "../src/host/themes/assets.js";

function themeDir() {
  const dir = mkdtempSync(join(tmpdir(), "vft-assets-"));
  mkdirSync(join(dir, "assets"), { recursive: true });
  writeFileSync(join(dir, "assets", "light.webp"), Buffer.from([1, 2, 3]));
  writeFileSync(join(dir, "assets", "notes.txt"), "x");
  writeFileSync(join(dir, "theme.json"), "{}");
  return dir;
}

test("serves a plain file inside the theme directory", () => {
  const dir = themeDir();
  try {
    const asset = resolveThemeAsset(dir, "assets/light.webp");
    assert.equal(asset.mime, "image/webp");
    assert.equal(asset.byteLength, 3);
    const read = readThemeAsset(dir, "assets/light.webp");
    assert.deepEqual([...read.buffer], [1, 2, 3]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("refuses traversal, absolute paths and drive prefixes", () => {
  const dir = themeDir();
  try {
    for (const bad of [
      "../secret.webp",
      "assets/../../secret.webp",
      "/etc/passwd",
      "\\windows\\system32\\x.webp",
      "C:/windows/x.webp",
      "assets//light.webp",
      "./assets/light.webp",
      "",
    ]) {
      assert.equal(resolveThemeAsset(dir, bad), null, `expected null for ${JSON.stringify(bad)}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("refuses extensions it cannot label, and directories", () => {
  const dir = themeDir();
  try {
    assert.equal(resolveThemeAsset(dir, "assets/notes.txt"), null);
    assert.equal(resolveThemeAsset(dir, "theme.json"), null);
    assert.equal(resolveThemeAsset(dir, "assets"), null);
    assert.equal(resolveThemeAsset(dir, "missing.webp"), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("refuses a symlink that escapes the theme directory", () => {
  const dir = themeDir();
  const outside = mkdtempSync(join(tmpdir(), "vft-outside-"));
  writeFileSync(join(outside, "leak.webp"), Buffer.from([9]));
  try {
    try {
      symlinkSync(join(outside, "leak.webp"), join(dir, "assets", "leak.webp"));
    } catch {
      return; // symlink creation needs privileges on Windows; skip when unavailable
    }
    assert.equal(resolveThemeAsset(dir, "assets/leak.webp"), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test("the .js extension is served as text so code art can be embedded", () => {
  const dir = themeDir();
  writeFileSync(join(dir, "art.js"), "export const art = {}");
  try {
    const asset = resolveThemeAsset(dir, "art.js");
    assert.equal(asset.mime, "text/plain; charset=utf-8");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});