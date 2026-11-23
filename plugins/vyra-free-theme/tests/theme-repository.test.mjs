import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createThemeRepository } from "../src/host/themes/repository.js";
import { getSkinSchema, listExternalSkinIds, unregisterExternalSkin } from "../src/shared/personalization/catalog.js";

function sandbox() {
  return mkdtempSync(join(tmpdir(), "vft-repo-"));
}

function theme(id, extra = {}) {
  return {
    schema: 1,
    id,
    name: { zh: `主题${id}`, en: `Theme ${id}` },
    colors: {
      light: { "--dsw-alias-bg-base": "#F7F5F2" },
      dark: { "--dsw-alias-bg-base": "#101016" },
    },
    ...extra,
  };
}

function writeTheme(dir, id, body) {
  const target = join(dir, id);
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, "theme.json"), JSON.stringify(body ?? theme(id), null, 2));
}

test("discovers valid themes and registers them in the shared catalog", () => {
  const builtin = sandbox();
  writeTheme(builtin, "nebula");
  const repo = createThemeRepository({ dirs: [{ source: "builtin", dir: builtin }] });
  try {
    const result = repo.sync();
    assert.equal(result.themes.length, 1);
    assert.equal(result.themes[0].source, "builtin");
    assert.deepEqual(result.problems, []);
    assert.ok(listExternalSkinIds().includes("nebula"));
    assert.equal(getSkinSchema("nebula").fields.length, 3);
  } finally {
    unregisterExternalSkin("nebula");
    rmSync(builtin, { recursive: true, force: true });
  }
});

test("invalid themes are reported with issues and never registered", () => {
  const builtin = sandbox();
  writeTheme(builtin, "broken", theme("broken", { schema: 9 }));
  const repo = createThemeRepository({ dirs: [{ source: "builtin", dir: builtin }] });
  try {
    const result = repo.sync();
    assert.equal(result.themes.length, 0);
    assert.equal(result.problems.length, 1);
    assert.equal(result.problems[0].id, "broken");
    assert.ok(result.problems[0].issues.some((issue) => issue.code === "schema-version"));
    assert.ok(!listExternalSkinIds().includes("broken"));
  } finally {
    rmSync(builtin, { recursive: true, force: true });
  }
});

test("a directory whose name does not match theme.id is rejected", () => {
  const builtin = sandbox();
  writeTheme(builtin, "folder-name", theme("other-id"));
  const repo = createThemeRepository({ dirs: [{ source: "builtin", dir: builtin }] });
  try {
    const result = repo.sync();
    assert.equal(result.themes.length, 0);
    assert.ok(result.problems[0].issues.some((issue) => issue.code === "dir-id-mismatch"));
  } finally {
    rmSync(builtin, { recursive: true, force: true });
  }
});

test("builtin themes win over a user theme with the same id", () => {
  const builtin = sandbox();
  const user = sandbox();
  writeTheme(builtin, "nebula");
  writeTheme(user, "nebula");
  const repo = createThemeRepository({
    dirs: [{ source: "builtin", dir: builtin }, { source: "user", dir: user }],
  });
  try {
    const result = repo.sync();
    assert.equal(result.themes.length, 1);
    assert.equal(result.themes[0].source, "builtin");
    assert.ok(result.problems.some((problem) => problem.issues.some((issue) => issue.code === "shadowed")));
  } finally {
    unregisterExternalSkin("nebula");
    rmSync(builtin, { recursive: true, force: true });
    rmSync(user, { recursive: true, force: true });
  }
});

test("sync is idempotent and drops a theme that was deleted", () => {
  const builtin = sandbox();
  writeTheme(builtin, "nebula");
  writeTheme(builtin, "ink-landscape");
  const repo = createThemeRepository({ dirs: [{ source: "builtin", dir: builtin }] });
  try {
    repo.sync();
    assert.deepEqual(repo.registeredIds().sort(), ["ink-landscape", "nebula"]);
    rmSync(join(builtin, "ink-landscape"), { recursive: true, force: true });
    const second = repo.sync();
    assert.deepEqual(second.themes.map((entry) => entry.theme.id), ["nebula"]);
    assert.deepEqual(repo.registeredIds(), ["nebula"]);
    assert.ok(!listExternalSkinIds().includes("ink-landscape"));
  } finally {
    unregisterExternalSkin("nebula");
    rmSync(builtin, { recursive: true, force: true });
  }
});

test("a malformed theme.json is a per-theme problem, not a crash", () => {
  const builtin = sandbox();
  const dir = join(builtin, "bad-json");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "theme.json"), "{ not json");
  const repo = createThemeRepository({ dirs: [{ source: "builtin", dir: builtin }] });
  try {
    const result = repo.sync();
    assert.equal(result.themes.length, 0);
    assert.ok(result.problems[0].issues.some((issue) => issue.code === "bad-json"));
  } finally {
    rmSync(builtin, { recursive: true, force: true });
  }
});
