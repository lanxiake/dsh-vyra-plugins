# vyra-free-theme P0（fork + 改名）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 vendored 的 `@iasiv5/dsh-skins` 变成独立包 `vyra-free-theme`，装上后行为与现状完全一致，且不再与 `vyra-theme-styles` 抢令牌。

**Architecture:** 复制 `plugins/dsh-skins/source/`（上游源码树）为新包根目录，机械改名所有身份字符串（包名、客户端注册 id、路由前缀、CSS 标签前缀、全局句柄、esbuild define），把路径逻辑抽成可测模块并加入旧目录只读迁移。构建仍是 esbuild 双产物（`lib/client.js` IIFE + `lib/index.js` ESM）。

**Tech Stack:** Node 22 / ESM、esbuild 0.28、`node:test`、puppeteer 无关（本阶段不跑浏览器门禁）

**Spec:** `docs/superpowers/specs/2026-11-23-vyra-free-theme-design.md`（§4 架构、§10 存储与迁移、§14 退役）

## Global Constraints

- 客户端注册 id 必须**逐字等于** `package.json` 的 `name`（`vyra-free-theme`），否则 `dsh-client-modules` 报 "loaded without registering"
- 数据目录：Web `$DSH_HOME/vyra-free-theme/`，Desktop `$DSH_HOME/vyra-free-theme-desktop/`
- 旧目录 `$DSH_HOME/dsh-skins`、`$DSH_HOME/dsh-skins-desktop` **只读复制、永不移动或修改**
- 不新增运行时依赖；devDependencies 保持 esbuild / eslint / globals / cordis / playwright-core / semver
- 构建产物 `lib/client.js`、`lib/index.js` 必须提交
- 本阶段**不删**三套内置皮肤（P6 才替换成新主题），行为与上游 1.5.34 一致

## Review Focus

- 两个旧目录同时存在时，迁移不得覆盖、删除或改写任何一边
- 客户端注册 id 与包名不一致 → 构建期必须拦住，而不是运行期白屏
- `runtime.js` 按 `style[data-plugin-css^="dsh-skins/"]` 前缀清理样式，前缀漏改会导致切主题后旧样式残留
- 宿主路由前缀与客户端请求前缀必须同源（`/vyra-free-theme/config`）
- `package.json` 的 `files` 漏 `locale` 或 `assets` → 发布后资源 404

---

## File Structure

新建（全部在 `plugins/vyra-free-theme/` 下）：

| 路径 | 职责 |
| --- | --- |
| `package.json` | 包身份、dsh bundle/client 声明、依赖与脚本 |
| `cordis.patch.yml` | 装载清单行（id `free-theme`，name `vyra-free-theme`） |
| `src/host/paths.js` | **新抽出**：`dshHome` / `hostProfileFor` / `dataDirForProfile` / `LEGACY_DIRS`，纯函数、可单测 |
| `src/index.js` | 宿主入口，改为从 `paths.js` 取路径 |
| `src/client/**` | 客户端（改名的既有代码） |
| `scripts/**` | 构建与校验脚本（改名） |
| `smoke-test.cjs` | 冒烟（改名） |
| `locale/{zh,en}.json`、`assets/`、`icon.svg` | 资源（沿用） |
| `tests/paths.test.mjs` | 数据目录与迁移单测 |

---

### Task 1: 建立包骨架

**Files:**
- Create: `plugins/vyra-free-theme/`（复制 `plugins/dsh-skins/source/`）
- Create: `plugins/vyra-free-theme/package.json`
- Test: `plugins/vyra-free-theme/tests/package-identity.test.mjs`

**Interfaces:**
- Produces: 包根目录与 `package.json`（`name: "vyra-free-theme"`, `main: "lib/index.js"`, `exports["."]`, `exports["./client"]`）

- [ ] **Step 1: 复制源码树**

```bash
mkdir -p plugins/vyra-free-theme
cp -r plugins/dsh-skins/source/. plugins/vyra-free-theme/
rm -rf plugins/vyra-free-theme/.githooks plugins/vyra-free-theme/node_modules
```

- [ ] **Step 2: 写失败测试**

`tests/package-identity.test.mjs`：

```js
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
```

- [ ] **Step 3: 跑测试确认失败**

Run: `cd plugins/vyra-free-theme && node --test tests/package-identity.test.mjs`
Expected: FAIL（`name` 仍是 `@iasiv5/dsh-skins`）

- [ ] **Step 4: 改 `package.json`**

必改字段：

```json
{
  "name": "vyra-free-theme",
  "version": "0.1.0",
  "description": "自由主题：主题、壁纸（静态/视频/动图/代码）与左侧菜单样式一体化，明暗自适应，Web 与 Desktop 通用。",
  "icon": "./icon.svg",
  "repository": { "type": "git", "url": "git+https://github.com/lanxiake/dsh-vyra-plugins.git", "directory": "plugins/vyra-free-theme" },
  "homepage": "https://github.com/lanxiake/dsh-vyra-plugins/tree/master/plugins/vyra-free-theme#readme",
  "keywords": ["dsh", "dsh-plugin", "deepseek-harness", "theme", "skin", "wallpaper", "personalization"],
  "files": ["lib", "assets", "themes", "locale", "cordis.patch.yml", "README.md", "README.en.md", "LICENSE", "NOTICE.md", "icon.svg"]
}
```

删除 `publishConfig`、`packageManager`、`bugs`（指向旧上游）。`dsh` / `peerDependencies` / `license` / devDependencies 保持不变。

- [ ] **Step 5: 跑测试确认通过**

Run: `cd plugins/vyra-free-theme && node --test tests/package-identity.test.mjs`
Expected: PASS（3 个用例）

- [ ] **Step 6: 提交**

```bash
git add plugins/vyra-free-theme
git commit -m "feat(free-theme): fork dsh-skins source as vyra-free-theme package skeleton"
```

---

### Task 2: 机械改名（身份字符串）

**Files:**
- Modify: `plugins/vyra-free-theme/src/**`、`scripts/**`、`smoke-test.cjs`、`cordis.patch.yml`、`locale/*.json`、`icon.svg`
- Test: `plugins/vyra-free-theme/tests/no-legacy-identity.test.mjs`

**Interfaces:**
- Produces: 全树无 `dsh-skins` / `DSH_SKINS` 残留（白名单见 Step 4），客户端 id `"vyra-free-theme"`

- [ ] **Step 1: 写失败测试**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SKIP = new Set(["node_modules", "lib", ".git", "assets"]);
// 白名单：仅旧目录迁移的只读检测允许出现旧名
const LEGACY_ALLOW = [/src\/host\/paths\.js$/];

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (/\.(js|mjs|cjs|json|yml|yaml)$/.test(entry.name)) yield path;
  }
}

test("no legacy identity strings outside the migration whitelist", async () => {
  const offenders = [];
  for await (const path of walk(ROOT)) {
    if (LEGACY_ALLOW.some((re) => re.test(path.replaceAll("\\", "/")))) continue;
    const text = await readFile(path, "utf8");
    if (/dsh-skins|DSH_SKINS/.test(text)) offenders.push(path.replace(ROOT, ""));
  }
  assert.deepEqual(offenders, []);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd plugins/vyra-free-theme && node --test tests/no-legacy-identity.test.mjs`
Expected: FAIL，`offenders` 列出 30+ 文件

- [ ] **Step 3: 执行改名**

用一次性 Node 脚本（跨平台，避免 Windows 上没有 sed/xargs）：

```js
// .tmp/rename-identity.mjs —— 跑完即删
const MAP = [
  ["@iasiv5/dsh-skins", "vyra-free-theme"],
  ["dsh-skins-desktop", "vyra-free-theme-desktop"],
  ["__DSH_SKINS_ASSET_REV__", "__VFT_ASSET_REV__"],
  ["__DSH_SKINS__", "__VFT__"],
  ["DSH_SKINS", "VFT"],
  ["dsh-skins", "vyra-free-theme"],
];
// 遍历 .js/.mjs/.cjs/.json/.yml/.yaml/.md，跳过 node_modules、lib、.git、assets、tests
// 对每个文件按 MAP 顺序做全量字符串替换
```

Run: `node .tmp/rename-identity.mjs "E:\my-project\dsh-vyra-plugins\plugins\vyra-free-theme"`
Expected: `rewrote 36 files`

改完必须人工核对两处（全量替换会连带影响）：

1. `src/host/paths.js`（Task 3 创建）是唯一允许保留旧名的文件——本任务先把它建出来，内容见 Task 3 Step 2
2. `cordis.patch.yml` 的装载行 id 改为 `free-theme`（原为 `skins`）：

```yaml
- id: free-theme
  name: vyra-free-theme
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd plugins/vyra-free-theme && node --test tests/no-legacy-identity.test.mjs`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add -A plugins/vyra-free-theme
git commit -m "refactor(free-theme): rename package, client id, routes, css prefixes and globals"
```

---

### Task 3: 抽路径模块并加旧目录迁移

**Files:**
- Create: `plugins/vyra-free-theme/src/host/paths.js`
- Modify: `plugins/vyra-free-theme/src/index.js`（改为从 `paths.js` 取）
- Test: `plugins/vyra-free-theme/tests/paths.test.mjs`

**Interfaces:**
- Produces:
  - `export const LEGACY_DIRS = { web: "dsh-skins", desktop: "dsh-skins-desktop" }`
  - `export function dshHome(): string`
  - `export function hostProfileFor(root: string, cwd?: string): "desktop" | "web"`
  - `export function dataDirForProfile(root: string, profile: "desktop" | "web"): string`
- `src/index.js` 保留同名 re-export（`export { hostProfileFor, dataDirForProfile } from "./host/paths.js"`），外部调用方不变

- [ ] **Step 1: 写失败测试**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dataDirForProfile, hostProfileFor, LEGACY_DIRS } from "../src/host/paths.js";

function sandbox() {
  return mkdtempSync(join(tmpdir(), "vft-paths-"));
}

test("web profile uses the new directory name", () => {
  const root = sandbox();
  assert.equal(dataDirForProfile(root, "web"), join(root, "vyra-free-theme"));
});

test("desktop profile prefers its own directory", () => {
  const root = sandbox();
  mkdirSync(join(root, "vyra-free-theme-desktop"));
  assert.equal(dataDirForProfile(root, "desktop"), join(root, "vyra-free-theme-desktop"));
});

test("legacy desktop data is copied once and the original is untouched", () => {
  const root = sandbox();
  const legacy = join(root, LEGACY_DIRS.desktop);
  mkdirSync(join(legacy, "library"), { recursive: true });
  writeFileSync(join(legacy, "config.json"), '{"v":1}');
  writeFileSync(join(legacy, "library", "a.webp"), "x");

  const dir = dataDirForProfile(root, "desktop");
  assert.equal(dir, join(root, "vyra-free-theme-desktop"));
  assert.deepEqual(readdirSync(dir).sort(), ["config.json", "library"]);
  // 旧目录必须原样保留
  assert.deepEqual(readdirSync(legacy).sort(), ["config.json", "library"]);
});

test("migration never overwrites an existing new directory", () => {
  const root = sandbox();
  mkdirSync(join(root, LEGACY_DIRS.desktop, "library"), { recursive: true });
  writeFileSync(join(root, LEGACY_DIRS.desktop, "config.json"), '{"legacy":true}');
  mkdirSync(join(root, "vyra-free-theme-desktop"));
  writeFileSync(join(root, "vyra-free-theme-desktop", "config.json"), '{"mine":true}');

  const dir = dataDirForProfile(root, "desktop");
  assert.equal(readFileSync(join(dir, "config.json"), "utf8"), '{"mine":true}');
  assert.ok(!existsSync(join(dir, "library")));
});

test("desktop profile is detected from the profile working directory", () => {
  const root = sandbox();
  assert.equal(hostProfileFor(root, join(root, "profiles", "desktop")), "desktop");
  assert.equal(hostProfileFor(root, join(root, "profiles", "web")), "web");
});
```

（`readFileSync` 记得一并 import。）

- [ ] **Step 2: 跑测试确认失败**

Run: `cd plugins/vyra-free-theme && node --test tests/paths.test.mjs`
Expected: FAIL，`Cannot find module '../src/host/paths.js'`

- [ ] **Step 3: 实现 `src/host/paths.js`**

把 `src/index.js` 现有的 `expandHomePath` / `dshHome` / `hostProfileFor` / `dataDirForProfile` 原样搬过来，只改两处：

- 常量：`LEGACY_DIRS = { web: "dsh-skins", desktop: "dsh-skins-desktop" }`（唯一保留旧名的位置，被 Task 2 白名单豁免）
- 迁移源顺序：先看**新目录**，不存在再看 `LEGACY_DIRS[profile]`，复制到新目录；`web` 平台**不做**自动复制（旧 Web 数据由 P7 迁移脚本统一处理），desktop 沿用"暂存目录 + 同父 rename"的原子发布，失败时清理暂存

`src/index.js` 顶部改为：

```js
import { dataDirForProfile, hostProfileFor, dshHome } from "./host/paths.js";
export { dataDirForProfile, hostProfileFor } from "./host/paths.js";
```

并删除原来的四个函数定义（`dshHome` 从 paths 导入）。

- [ ] **Step 4: 跑测试确认通过**

Run: `cd plugins/vyra-free-theme && node --test tests/paths.test.mjs`
Expected: PASS（5 个用例）

- [ ] **Step 5: 提交**

```bash
git add plugins/vyra-free-theme
git commit -m "feat(free-theme): extract host paths and add read-only legacy data migration"
```

---

### Task 4: 构建并校验双产物

**Files:**
- Modify: `plugins/vyra-free-theme/scripts/build-client.mjs`（define 键名已由 Task 2 改）
- Create: `plugins/vyra-free-theme/lib/`（构建产物，提交）

**Interfaces:**
- Consumes: Task 2 的 `__VFT_ASSET_REV__` define、Task 3 的宿主入口
- Produces: `lib/client.js`（含 `id: "vyra-free-theme"`）、`lib/index.js`（含 `/vyra-free-theme/config`）

- [ ] **Step 1: 安装构建依赖**

```bash
cd plugins/vyra-free-theme && npm install --no-audit --no-fund
```

Expected: `node_modules/esbuild` 就位

- [ ] **Step 2: 跑构建**

Run: `cd plugins/vyra-free-theme && npm run build`
Expected: 输出两行 `built lib/...`；若报 `registration id` 不匹配，说明 `src/client/index.js` 的 `id` 与包名有出入

- [ ] **Step 3: 静态校验**

```bash
cd plugins/vyra-free-theme
node --check lib/client.js && node --check lib/index.js
grep -c 'id: "vyra-free-theme"' lib/client.js          # 期望 1
grep -c '/vyra-free-theme/config' lib/index.js         # 期望 >=1
! grep -q 'dsh-skins' lib/index.js && echo "host clean"
```

- [ ] **Step 4: 提交产物**

```bash
git add plugins/vyra-free-theme/lib
git commit -m "build(free-theme): commit first vyra-free-theme bundles"
```

---

### Task 5: 装进 desktop profile 冒烟

**Files:**
- Modify: `C:\Users\Administrator\.dsh\profiles\desktop\cordis.patch.yml`（禁用旧两插件）

**Interfaces:**
- Consumes: Task 4 的 `lib/` 产物
- Produces: 运行中的 DSH Desktop 只有一个视觉插件在改令牌

- [ ] **Step 1: 在 profile 里加入新插件并禁用旧两插件**

`cordis.patch.yml` 追加：

```yaml
- id: include:skins
  disabled: true
- id: include:dsh-theme-styles
  disabled: true
```

再按插件管理器的正常入口安装 `plugins/vyra-free-theme`（本地路径安装，P0 不发布 npm）。

- [ ] **Step 2: 重启并验证**

- 侧栏底部出现「皮肤切换」（P0 保留原 UI），能切 openbmc / uefi-harness / meirenzhi
- 设置 → 通用 不再出现「主题风格」那一行
- 开发者工具里 `window.__VFT__.list()` 返回 3 项

- [ ] **Step 3: 提交 profile 变更说明**

profile 不在本仓库，改完在 `plugins/vyra-free-theme/NOTICE.md` 记录"旧插件须禁用"，随 P7 一起随 README 发布。

---

## P0 完成判据

1. `plugins/vyra-free-theme` 可独立构建，`lib/` 双产物通过 `node --check`
2. `node --test tests/*.test.mjs` 全绿（包身份、无残留、路径与迁移）
3. 装进 desktop profile 后行为与上游 1.5.34 一致，且不再有双令牌层
4. 旧目录 `dsh-skins*` 未被修改

后续阶段（P1–P7）见 spec §17，每阶段开工前另写计划。
