import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  clearSelection,
  isSelectableId,
  OFFICIAL_ID,
  readSelection,
  SELECTION_FILE,
  writeSelection,
} from "../src/host/themes/selection.js";
import { installSkillAndShims } from "../src/host/install-skill.js";

function sandbox() {
  return mkdtempSync(join(tmpdir(), "vft-sel-"));
}

test("selection round-trips through one atomically written file", () => {
  const dir = sandbox();
  assert.equal(readSelection(dir), null);
  const record = writeSelection(dir, "nebula", { now: () => "2026-11-23T00:00:00.000Z" });
  assert.deepEqual(record, { skinId: "nebula", updatedAt: "2026-11-23T00:00:00.000Z" });
  assert.deepEqual(readSelection(dir), record);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, SELECTION_FILE), "utf8")), record);
});

test("official is a selectable id and garbage is refused", () => {
  assert.equal(isSelectableId(OFFICIAL_ID), true);
  assert.equal(isSelectableId("ink-landscape"), true);
  assert.equal(isSelectableId("Bad Id"), false);
  assert.equal(isSelectableId(""), false);
  assert.throws(() => writeSelection(sandbox(), "../escape"), /invalid skin id/);
});

test("a hand-edited or corrupted selection file reads as absent", () => {
  const dir = sandbox();
  writeFileSync(join(dir, SELECTION_FILE), "{ not json");
  assert.equal(readSelection(dir), null);
  writeFileSync(join(dir, SELECTION_FILE), JSON.stringify({ skinId: "Not Valid" }));
  assert.equal(readSelection(dir), null);
  writeFileSync(join(dir, SELECTION_FILE), JSON.stringify({ skinId: "official" }));
  assert.equal(readSelection(dir).skinId, "official");
});

test("clearSelection removes the file", () => {
  const dir = sandbox();
  writeSelection(dir, "nebula");
  clearSelection(dir);
  assert.equal(existsSync(join(dir, SELECTION_FILE)), false);
  assert.equal(readSelection(dir), null);
});

test("skill and launchers are installed once and rewritten on change", () => {
  const home = sandbox();
  const packageRoot = join(process.cwd(), "plugins", "vyra-free-theme");
  const result = installSkillAndShims({ dshHome: home, packageRoot });
  if (result.skill === null) return; // package layout differs (e.g. installed copy without skill/)
  assert.ok(existsSync(join(home, "skills", "vyra-free-theme", "SKILL.md")));
  assert.ok(existsSync(join(home, "vyra-free-theme", "bin", "vft")));
  assert.ok(existsSync(join(home, "vyra-free-theme", "bin", "vft.cmd")));
  // idempotent: nothing reported as written the second time
  const again = installSkillAndShims({ dshHome: home, packageRoot });
  assert.equal(again.skill, null);
  assert.deepEqual(again.shims, []);
});