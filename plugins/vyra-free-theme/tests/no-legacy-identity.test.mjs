import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SKIP = new Set(["node_modules", "lib", ".git", "assets", "tests"]);
// 白名单：只有旧目录迁移的只读检测允许出现旧名（P0-T3 创建）
const LEGACY_ALLOW = [/src[\\/]host[\\/]paths\.js$/];
const EXT = /\.(js|mjs|cjs|json|yml|yaml|md)$/;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (EXT.test(entry.name)) yield path;
  }
}

test("no legacy identity strings outside the migration whitelist", async () => {
  const offenders = [];
  for await (const path of walk(ROOT)) {
    const rel = relative(ROOT, path).replaceAll("\\", "/");
    if (LEGACY_ALLOW.some((re) => re.test(rel))) continue;
    const text = await readFile(path, "utf8");
    if (/dsh-skins|DSH_SKINS/.test(text)) offenders.push(rel);
  }
  assert.deepEqual(offenders, []);
});
