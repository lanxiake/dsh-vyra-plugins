import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

test("package identity is the new plugin", () => {
  assert.equal(pkg.name, "vyra-free-theme");
  assert.equal(pkg.main, "lib/index.js");
  assert.equal(pkg.exports["."], "./lib/index.js");
  assert.equal(pkg.exports["./client"], "./lib/client.js");
});

test("published files cover runtime assets", () => {
  for (const entry of ["lib", "assets", "locale", "cordis.patch.yml", "icon.svg"]) {
    assert.ok(pkg.files.includes(entry), `files must include ${entry}`);
  }
});

test("client platform and inject contract kept", () => {
  assert.equal(pkg.dsh.client.platform, "web");
  assert.ok(pkg.dsh.client.inject.includes("@deepseek-ai/dsh-client-ui-theme"));
  assert.equal(pkg.dsh.bundle.patch, "./cordis.patch.yml");
});
