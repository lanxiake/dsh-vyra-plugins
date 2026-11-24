import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run, parseArgs, resolvePaths } from "../cli/vft.mjs";
import { readSelection } from "../src/host/themes/selection.js";

function sandbox() {
  return mkdtempSync(join(tmpdir(), "vft-cli-"));
}

function cli(home, ...argv) {
  return run([...argv, "--dsh-home-unused"], { dshHome: home });
}

/** run() reads DSH_HOME from options.dshHome; keep a thin wrapper for readability. */
function vft(home, ...argv) {
  return run(argv, { dshHome: home });
}

test("argument parsing handles flags, values and equals form", () => {
  assert.deepEqual(parseArgs(["theme", "create", "--from", "mono", "--json"]), {
    positionals: ["theme", "create"],
    flags: { from: "mono", json: true },
  });
  assert.deepEqual(parseArgs(["a", "--x=1", "--y", "2"]), { positionals: ["a"], flags: { x: "1", y: "2" } });
});

test("paths resolve to the new data directory and infer the profile", () => {
  const home = sandbox();
  mkdirSync(join(home, "vyra-free-theme-desktop"), { recursive: true });
  const paths = resolvePaths({ dshHome: home });
  assert.equal(paths.profile, "desktop");
  assert.equal(paths.dataDir, join(home, "vyra-free-theme-desktop"));
  const webPaths = resolvePaths({ dshHome: home, profile: "web" });
  assert.equal(webPaths.dataDir, join(home, "dsh-vyra-free-theme"));
});

test("list reports bundled themes and presets, with no selection yet", async () => {
  const home = sandbox();
  const { exitCode, payload } = await vft(home, "theme", "list", "--json");
  assert.equal(exitCode, 0);
  assert.equal(payload.active, null);
  const ids = payload.themes.map((theme) => `${theme.kind}:${theme.id}`);
  /* The five bundled themes were retired, so `builtin:*` entries are gone by
     design. The presets are what remains, and they must still list cleanly. */
  assert.equal(ids.filter((id) => id.startsWith("builtin:")).length, 0,
    "no bundled themes should remain after retirement");
  assert.ok(ids.includes("preset:mono"));
  assert.ok(ids.length >= 6, "the colour presets must still enumerate");
  for (const theme of payload.themes) {
    assert.equal(theme.error, undefined, JSON.stringify(theme));
    assert.equal(theme.pass, true, `${theme.id} should pass the colour gate`);
  }
});

test("create copies a preset into the user directory and validates it", async () => {
  const home = sandbox();
  const created = await vft(home, "theme", "create", "--from", "mono", "--id", "mine", "--name", "我的主题", "--name-en", "Mine");
  assert.equal(created.exitCode, 0, JSON.stringify(created.payload));
  const file = join(home, "dsh-vyra-free-theme", "themes", "mine", "theme.json");
  assert.ok(existsSync(file));
  const raw = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(raw.id, "mine");
  assert.deepEqual(raw.name, { zh: "我的主题", en: "Mine" });

  const again = await vft(home, "theme", "create", "--from", "mono", "--id", "mine");
  assert.equal(again.exitCode, 3, "creating over an existing id must need confirmation");
});

test("read-only sources are still protected from mutation", async () => {
  const home = sandbox();
  /* There are no bundled themes to mutate any more, so the guard is exercised
     through the presets, which carry the same read-only contract. */
  const result = await vft(home, "sidebar", "set", "mono", "obsidian");
  assert.equal(result.exitCode, 3);
  assert.match(result.payload.error, /只读/);
});

test("apply writes the host selection the client reads", async () => {
  const home = sandbox();
  await vft(home, "theme", "create", "--from", "mono", "--id", "mine");
  const applied = await vft(home, "theme", "apply", "mine");
  assert.equal(applied.exitCode, 0, JSON.stringify(applied.payload));
  assert.equal(readSelection(join(home, "dsh-vyra-free-theme")).skinId, "mine");
  const list = await vft(home, "theme", "list", "--json");
  assert.equal(list.payload.active, "mine");

  const official = await vft(home, "reset");
  assert.equal(official.exitCode, 0);
  assert.equal(readSelection(join(home, "dsh-vyra-free-theme")).skinId, "official");
});

test("apply refuses an unknown id", async () => {
  const home = sandbox();
  const result = await vft(home, "theme", "apply", "ghost");
  assert.equal(result.exitCode, 1);
  assert.match(result.payload.error, /找不到主题/);
});

test("check passes good themes and fails a broken one with the gate exit code", async () => {
  const home = sandbox();
  await vft(home, "theme", "create", "--from", "mono", "--id", "mine");
  const good = await vft(home, "theme", "check", "mine", "--json");
  assert.equal(good.exitCode, 0);
  assert.equal(good.payload.results[0].pass, true);

  const broken = join(home, "dsh-vyra-free-theme", "themes", "broken");
  mkdirSync(broken, { recursive: true });
  writeFileSync(join(broken, "theme.json"), JSON.stringify({
    schema: 1,
    id: "broken",
    name: { zh: "坏", en: "Broken" },
    colors: {
      light: { "--dsw-alias-bg-base": "#FFFFFF", "--dsw-alias-label-primary": "#FAFAFA", "--dsw-alias-brand-primary": "#F8F8F8" },
      dark: { "--dsw-alias-bg-base": "#000000", "--dsw-alias-label-primary": "#050505", "--dsw-alias-brand-primary": "#070707" },
    },
  }));
  const bad = await vft(home, "theme", "check", "broken", "--json");
  assert.equal(bad.exitCode, 2);
  assert.equal(bad.payload.results[0].pass, false);
});

test("delete needs --force and then removes the directory", async () => {
  const home = sandbox();
  await vft(home, "theme", "create", "--from", "mono", "--id", "mine");
  const guarded = await vft(home, "theme", "delete", "mine");
  assert.equal(guarded.exitCode, 3);
  assert.ok(existsSync(join(home, "dsh-vyra-free-theme", "themes", "mine")));
  const forced = await vft(home, "theme", "delete", "mine", "--force");
  assert.equal(forced.exitCode, 0);
  assert.ok(!existsSync(join(home, "dsh-vyra-free-theme", "themes", "mine")));
});

test("wallpaper add copies the file and rewrites the wallpaper block", async () => {
  const home = sandbox();
  await vft(home, "theme", "create", "--from", "mono", "--id", "mine");
  const source = join(home, "wall.webp");
  writeFileSync(source, Buffer.from([1, 2, 3]));
  const added = await vft(home, "wallpaper", "add", "mine", source);
  assert.equal(added.exitCode, 0, JSON.stringify(added.payload));
  const raw = JSON.parse(readFileSync(join(home, "dsh-vyra-free-theme", "themes", "mine", "theme.json"), "utf8"));
  assert.equal(raw.wallpaper.kind, "image");
  assert.equal(raw.wallpaper.light.src, "assets/wall.webp");
  assert.ok(existsSync(join(home, "dsh-vyra-free-theme", "themes", "mine", "assets", "wall.webp")));

  const listed = await vft(home, "wallpaper", "list", "mine", "--json");
  assert.deepEqual(listed.payload.files, ["wall.webp"]);
});

test("appearance set writes coverage and translucency", async () => {
  const home = sandbox();
  await vft(home, "theme", "create", "--from", "mono", "--id", "mine");
  const result = await vft(home, "appearance", "set", "mine", "--coverage-shell", "on", "--scopes", "sidebar,topbar", "--translucency-web", "40");
  assert.equal(result.exitCode, 0, JSON.stringify(result.payload));
  const raw = JSON.parse(readFileSync(join(home, "dsh-vyra-free-theme", "themes", "mine", "theme.json"), "utf8"));
  assert.equal(raw.coverage.shell, true);
  assert.deepEqual(raw.coverage.scopes, ["sidebar", "topbar"]);
  assert.equal(raw.translucency.web, 40);
});

test("colors suggest ranks three harmonies and can apply the best", async () => {
  const home = sandbox();
  await vft(home, "theme", "create", "--from", "mono", "--id", "mine");
  const suggested = await vft(home, "colors", "suggest", "mine", "--json");
  assert.equal(suggested.exitCode, 0);
  assert.equal(suggested.payload.candidates.length, 3);
  assert.ok(suggested.payload.candidates[0].score >= suggested.payload.candidates[1].score);
  const applied = await vft(home, "colors", "suggest", "mine", "--apply", "--json");
  assert.equal(applied.exitCode, 0);
  assert.equal(applied.payload.applied, true);
  const scored = await vft(home, "theme", "check", "mine", "--json");
  assert.equal(scored.payload.results[0].pass, true);
});

test("export then import round-trips a theme under a new id", async () => {
  const home = sandbox();
  await vft(home, "theme", "create", "--from", "mono", "--id", "mine");
  const out = join(home, "exported");
  const exported = await vft(home, "theme", "export", "mine", "--out", out);
  assert.equal(exported.exitCode, 0);
  assert.ok(existsSync(join(out, "theme.json")));
  const imported = await vft(home, "theme", "import", out, "--id", "copied");
  assert.equal(imported.exitCode, 0, JSON.stringify(imported.payload));
  assert.ok(existsSync(join(home, "dsh-vyra-free-theme", "themes", "copied", "theme.json")));
});

test("unknown commands, missing prompts and blocked video generation report clearly", async () => {
  const home = sandbox();
  const unknown = await vft(home, "theme", "explode");
  assert.equal(unknown.exitCode, 1);
  // gen exists now but needs a prompt and a theme
  const noPrompt = await vft(home, "wallpaper", "gen", "x");
  assert.equal(noPrompt.exitCode, 1);
  assert.match(noPrompt.payload.error, /--prompt/);
  const noId = await vft(home, "wallpaper", "gen", "--prompt", "x");
  assert.equal(noId.exitCode, 1);
  assert.match(noId.payload.error, /缺少主题 id/);
  // video needs a theme that exists before it can look for a still to animate
  const video = await vft(home, "wallpaper", "video", "x");
  assert.equal(video.exitCode, 1);
  assert.match(video.payload.error, /找不到主题/);
  /* `mono` seeds a theme with no wallpaper image, which is all this step
     needs; the bundled themes it used to copy from are gone. */
  const noImage = await vft(home, "theme", "create", "--from", "mono", "--id", "vid");
  assert.equal(noImage.exitCode, 0, JSON.stringify(noImage.payload));
  const videoNoImage = await vft(home, "wallpaper", "video", "vid");
  assert.equal(videoNoImage.exitCode, 1);
  assert.match(videoNoImage.payload.error, /找不到要动的图片/);
});