import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dataDirForProfile, hostProfileFor, LEGACY_DIRS, DATA_DIRS } from "../src/host/paths.js";

function sandbox() {
  return mkdtempSync(join(tmpdir(), "vft-paths-"));
}

test("web profile uses the new directory name", () => {
  const root = sandbox();
  assert.equal(dataDirForProfile(root, "web"), join(root, DATA_DIRS.web));
});

test("desktop profile prefers its own directory", () => {
  const root = sandbox();
  mkdirSync(join(root, DATA_DIRS.desktop));
  assert.equal(dataDirForProfile(root, "desktop"), join(root, DATA_DIRS.desktop));
});

test("legacy desktop data is copied once and the original is untouched", () => {
  const root = sandbox();
  const legacy = join(root, LEGACY_DIRS.desktop[0]);
  mkdirSync(join(legacy, "library"), { recursive: true });
  writeFileSync(join(legacy, "config.json"), '{"v":1}');
  writeFileSync(join(legacy, "library", "a.webp"), "x");

  const dir = dataDirForProfile(root, "desktop");
  assert.equal(dir, join(root, DATA_DIRS.desktop));
  assert.deepEqual(readdirSync(dir).sort(), ["config.json", "library"]);
  assert.deepEqual(readdirSync(legacy).sort(), ["config.json", "library"]);
});

test("desktop falls back to the pre-1.5.4 legacy directory", () => {
  const root = sandbox();
  const legacy = join(root, LEGACY_DIRS.desktop[1]);
  mkdirSync(legacy, { recursive: true });
  writeFileSync(join(legacy, "config.json"), '{"v":2}');

  const dir = dataDirForProfile(root, "desktop");
  assert.equal(readFileSync(join(dir, "config.json"), "utf8"), '{"v":2}');
});

test("web legacy data is copied once too", () => {
  const root = sandbox();
  const legacy = join(root, LEGACY_DIRS.web[0]);
  mkdirSync(join(legacy, "library"), { recursive: true });
  writeFileSync(join(legacy, "config.json"), '{"web":true}');

  const dir = dataDirForProfile(root, "web");
  assert.equal(readFileSync(join(dir, "config.json"), "utf8"), '{"web":true}');
  assert.ok(existsSync(join(legacy, "config.json")));
});

test("migration never overwrites an existing new directory", () => {
  const root = sandbox();
  mkdirSync(join(root, LEGACY_DIRS.desktop[0], "library"), { recursive: true });
  writeFileSync(join(root, LEGACY_DIRS.desktop[0], "config.json"), '{"legacy":true}');
  mkdirSync(join(root, DATA_DIRS.desktop));
  writeFileSync(join(root, DATA_DIRS.desktop, "config.json"), '{"mine":true}');

  const dir = dataDirForProfile(root, "desktop");
  assert.equal(readFileSync(join(dir, "config.json"), "utf8"), '{"mine":true}');
  assert.ok(!existsSync(join(dir, "library")));
});

test("desktop profile is detected from the profile working directory", () => {
  const root = sandbox();
  assert.equal(hostProfileFor(root, join(root, "profiles", "desktop")), "desktop");
  assert.equal(hostProfileFor(root, join(root, "profiles", "web")), "web");
});
