#!/usr/bin/env node
/**
 * vft — vyra-free-theme CLI.
 *
 * Design contract (spec §11):
 *   - `theme.json` is the single source of truth. The CLI is a careful editor
 *     for those files plus the two host-side facts (`selection.json`, the
 *     personalization `state.json`), never a parallel database.
 *   - Every command supports `--json` and a stable exit code:
 *       0 done · 2 the theme/colour gate failed · 3 needs confirmation · 1 error
 *   - Offline: no DSH process is needed. The agent-facing skill documents the
 *     same guarantee, because an agent that lost the CLI can still write the
 *     file and validate it.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { normalizeTheme, fieldsFromTheme, tableFromTheme } from "../src/shared/personalization/theme-model.js";
import { SIDEBAR_PACKS, resolveSidebar, sidebarCss } from "../src/shared/personalization/sidebar-presets.js";
import { rankPalettes, SCORE_THRESHOLD, scoreTheme } from "../src/shared/personalization/color-score.js";
import { readSelection, writeSelection, isSelectableId, OFFICIAL_ID } from "../src/host/themes/selection.js";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const EXIT = { ok: 0, error: 1, gate: 2, confirm: 3 };
const THEME_ID = /^[a-z][a-z0-9-]{1,39}$/;

// ---------------------------------------------------------------------------
// tiny argv helpers
// ---------------------------------------------------------------------------

export function parseArgs(argv) {
  const positionals = [];
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
    const body = token.slice(2);
    const eq = body.indexOf("=");
    if (eq !== -1) {
      flags[body.slice(0, eq)] = body.slice(eq + 1);
      continue;
    }
    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith("--")) {
      flags[body] = next;
      index += 1;
    } else {
      flags[body] = true;
    }
  }
  return { positionals, flags };
}

function fail(code, message, extra = {}) {
  return { exitCode: code, payload: { ok: false, code, error: message, ...extra } };
}

// ---------------------------------------------------------------------------
// paths and theme loading
// ---------------------------------------------------------------------------

export function resolvePaths({ dshHome, profile } = {}) {
  const home = resolve(dshHome ?? process.env.DSH_HOME ?? join(homedir(), ".dsh"));
  const resolvedProfile = profile ?? (existsSync(join(home, "vyra-free-theme-desktop")) ? "desktop" : "web");
  const dataDir = join(home, resolvedProfile === "desktop" ? "vyra-free-theme-desktop" : "vyra-free-theme");
  return {
    home,
    profile: resolvedProfile,
    dataDir,
    userThemesDir: join(dataDir, "themes"),
    selectionFile: join(dataDir, "selection.json"),
    stateFile: join(dataDir, "state.json"),
    packageRoot: PACKAGE_ROOT,
  };
}

function sources(paths) {
  return [
    { kind: "user", dir: paths.userThemesDir },
    { kind: "builtin", dir: join(paths.packageRoot, "themes") },
    { kind: "preset", dir: join(paths.packageRoot, "presets", "colors") },
  ];
}

function listIds(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(dir, entry.name, "theme.json")))
    .map((entry) => entry.name)
    .sort();
}

/** Find a theme by id across user → builtin → preset. Returns null when absent. */
export function findTheme(paths, id) {
  for (const source of sources(paths)) {
    const dir = join(source.dir, id);
    const file = join(dir, "theme.json");
    if (!existsSync(file)) continue;
    let raw;
    try {
      raw = JSON.parse(readFileSync(file, "utf8"));
    } catch (error) {
      return { kind: source.kind, id, dir, error: `theme.json 解析失败：${error.message}` };
    }
    return { kind: source.kind, id, dir, raw };
  }
  return null;
}

function normalizeOrThrow(raw) {
  const result = normalizeTheme(raw);
  if (!result.ok) {
    const issues = result.issues.map((issue) => `${issue.code} ${issue.path}: ${issue.message}`).join("; ");
    const error = new Error(`主题校验失败：${issues}`);
    error.issues = result.issues;
    throw error;
  }
  return result.theme;
}

function writeJsonAtomic(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  const stage = `${file}.tmp-${process.pid}`;
  writeFileSync(stage, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(stage, file);
}

/** Edit one theme that lives in the user directory; never mutates built-ins. */
function mutateUserTheme(paths, id, mutate) {
  const found = findTheme(paths, id);
  if (found === null) return fail(EXIT.error, `找不到主题 "${id}"`);
  if (found.kind !== "user") {
    return fail(EXIT.confirm, `"${id}" 是${found.kind === "builtin" ? "内置" : "预设"}主题，只读；先 vft theme create --from ${id} --id <新id>`, { kind: found.kind });
  }
  const next = { ...found.raw };
  mutate(next);
  const normalized = normalizeOrThrow(next);
  writeJsonAtomic(join(found.dir, "theme.json"), next);
  return { exitCode: EXIT.ok, payload: { ok: true, id, theme: normalized } };
}

function ensureUserTheme(paths, id) {
  const dir = join(paths.userThemesDir, id);
  if (!existsSync(join(dir, "theme.json"))) return fail(EXIT.error, `用户主题 "${id}" 不存在`);
  return { exitCode: EXIT.ok, payload: { ok: true, dir } };
}

// ---------------------------------------------------------------------------
// commands
// ---------------------------------------------------------------------------

function summarise(paths, id, kind, raw) {
  try {
    const theme = normalizeOrThrow(raw);
    const report = scoreTheme(theme);
    return {
      id,
      kind,
      name: theme.name,
      wallpaper: theme.wallpaper === null ? null : theme.wallpaper.kind,
      sidebar: resolveSidebar(theme).pack,
      coverage: theme.coverage,
      score: report.score,
      pass: report.pass,
    };
  } catch (error) {
    return { id, kind, error: error.message };
  }
}

function cmdThemeList(paths, { flags }) {
  const rows = [];
  const seen = new Set();
  for (const source of sources(paths)) {
    for (const id of listIds(source.dir)) {
      if (source.kind !== "user" && seen.has(id)) continue;
      seen.add(id);
      let raw;
      try {
        raw = JSON.parse(readFileSync(join(source.dir, id, "theme.json"), "utf8"));
      } catch {
        rows.push({ id, kind: source.kind, error: "theme.json 解析失败" });
        continue;
      }
      rows.push(summarise(paths, id, source.kind, raw));
    }
  }
  const active = readSelection(paths.dataDir);
  if (flags.json === true) return { exitCode: EXIT.ok, payload: { ok: true, active: active?.skinId ?? null, themes: rows } };
  const lines = rows.map((row) => {
    const status = row.error !== undefined ? "INVALID" : row.pass ? "pass" : "FAIL";
    const score = row.error !== undefined ? "  -" : String(row.score).padStart(3);
    const marker = active?.skinId === row.id ? "*" : " ";
    return `${marker} ${status.padEnd(7)} ${score}  ${row.kind.padEnd(7)} ${row.id}${row.error ? `  (${row.error})` : ""}`;
  });
  return {
    exitCode: EXIT.ok,
    payload: { ok: true, active: active?.skinId ?? null, themes: rows },
    text: [`当前：${active?.skinId ?? "(未设置，跟随客户端)"}`, ...lines].join("\n"),
  };
}

function cmdThemeShow(paths, { positionals, flags }) {
  const id = positionals[0];
  const found = findTheme(paths, id);
  if (found === null) return fail(EXIT.error, `找不到主题 "${id}"`);
  const theme = normalizeOrThrow(found.raw);
  const report = scoreTheme(theme);
  const payload = {
    ok: true,
    id,
    kind: found.kind,
    theme,
    resolved: { sidebar: resolveSidebar(theme), fields: fieldsFromTheme(theme, paths.profile) },
    colour: report,
  };
  return { exitCode: EXIT.ok, payload, text: flags.json === true ? undefined : JSON.stringify(payload.theme, null, 2) };
}

function cmdThemeCreate(paths, { flags }) {
  const from = flags.from;
  const id = flags.id;
  if (typeof from !== "string" || typeof id !== "string") return fail(EXIT.error, "用法：vft theme create --from <id> --id <新id> [--name 名称] [--name-en Name]");
  if (!THEME_ID.test(id)) return fail(EXIT.error, `非法主题 id "${id}"（2–40 位小写字母/数字/连字符）`);
  const found = findTheme(paths, from);
  if (found === null) return fail(EXIT.error, `找不到来源主题 "${from}"`);
  const targetDir = join(paths.userThemesDir, id);
  if (existsSync(targetDir)) return fail(EXIT.confirm, `"${id}" 已存在；先删除或换一个 id`);
  const next = JSON.parse(JSON.stringify(found.raw));
  next.id = id;
  if (typeof flags.name === "string") next.name = { zh: flags.name, en: typeof flags["name-en"] === "string" ? flags["name-en"] : flags.name };
  if (typeof flags["name-en"] === "string" && next.name.en === next.name.zh) next.name.en = flags["name-en"];
  next.version = next.version ?? "0.1.0";
  normalizeOrThrow(next);
  mkdirSync(targetDir, { recursive: true });
  writeJsonAtomic(join(targetDir, "theme.json"), next);
  // Copy the source's own assets so the copy renders identically.
  const assetsDir = join(found.dir, "assets");
  if (existsSync(assetsDir)) {
    mkdirSync(join(targetDir, "assets"), { recursive: true });
    for (const name of readdirSync(assetsDir)) {
      copyFileSync(join(assetsDir, name), join(targetDir, "assets", name));
    }
  }
  const entry = extname(found.dir) === ".js" ? null : join(found.dir, found.raw.wallpaper?.entry ?? "");
  if (found.raw.wallpaper?.kind === "code" && entry !== null && existsSync(entry)) {
    copyFileSync(entry, join(targetDir, found.raw.wallpaper.entry));
  }
  return { exitCode: EXIT.ok, payload: { ok: true, id, from, kind: "user", dir: targetDir }, text: `已创建 ${id}（来源 ${from}）→ ${targetDir}` };
}

function cmdThemeRename(paths, { positionals, flags }) {
  const id = positionals[0];
  if (typeof flags.name !== "string" && typeof flags["name-en"] !== "string") return fail(EXIT.error, "用法：vft theme rename <id> --name <中文名> [--name-en <English>]");
  return mutateUserTheme(paths, id, (raw) => {
    raw.name = {
      zh: typeof flags.name === "string" ? flags.name : raw.name.zh,
      en: typeof flags["name-en"] === "string" ? flags["name-en"] : (typeof flags.name === "string" ? flags.name : raw.name.en),
    };
  });
}

function cmdThemeDelete(paths, { positionals, flags }) {
  const id = positionals[0];
  const found = findTheme(paths, id);
  if (found === null) return fail(EXIT.error, `找不到主题 "${id}"`);
  if (found.kind !== "user") return fail(EXIT.confirm, `"${id}" 是${found.kind === "builtin" ? "内置" : "预设"}主题，不可删除`);
  if (flags.force !== true) return fail(EXIT.confirm, `删除 "${id}" 不可撤销；确认后加 --force 重跑`, { id });
  rmSync(found.dir, { recursive: true, force: true });
  return { exitCode: EXIT.ok, payload: { ok: true, id, deleted: true }, text: `已删除 ${id}` };
}

function cmdThemeApply(paths, { positionals, flags }) {
  const id = positionals[0];
  if (!isSelectableId(id)) return fail(EXIT.error, `非法主题 id "${id}"`);
  if (id !== OFFICIAL_ID) {
    const found = findTheme(paths, id);
    if (found === null) return fail(EXIT.error, `找不到主题 "${id}"；先 theme list 看可用项`);
  }
  const record = writeSelection(paths.dataDir, id);
  return {
    exitCode: EXIT.ok,
    payload: { ok: true, ...record, note: "客户端下次加载生效（已打开的页面刷新即生效）" },
    text: `已选择 ${id}（客户端刷新后生效）`,
  };
}

function cmdReset(paths) {
  const record = writeSelection(paths.dataDir, OFFICIAL_ID);
  return { exitCode: EXIT.ok, payload: { ok: true, ...record }, text: "已回官方主题（客户端刷新后生效）" };
}

function cmdThemeReset(paths, { positionals }) {
  const id = positionals[0];
  if (!existsSync(paths.stateFile)) return { exitCode: EXIT.ok, payload: { ok: true, id, cleared: false }, text: "没有个性化状态文件，无需复位" };
  let state;
  try {
    state = JSON.parse(readFileSync(paths.stateFile, "utf8"));
  } catch (error) {
    return fail(EXIT.error, `state.json 解析失败：${error.message}`);
  }
  if (state?.skins === undefined || state.skins[id] === undefined) {
    return { exitCode: EXIT.ok, payload: { ok: true, id, cleared: false }, text: `"${id}" 没有个性化覆盖` };
  }
  delete state.skins[id];
  writeJsonAtomic(paths.stateFile, state);
  return { exitCode: EXIT.ok, payload: { ok: true, id, cleared: true }, text: `已清掉 "${id}" 的个性化覆盖（回到出厂值）` };
}

function cmdThemeExport(paths, { positionals, flags }) {
  const id = positionals[0];
  const found = findTheme(paths, id);
  if (found === null) return fail(EXIT.error, `找不到主题 "${id}"`);
  const outDir = typeof flags.out === "string" ? resolve(flags.out) : resolve(process.cwd(), `${id}.vft`);
  copyDirRecursive(found.dir, outDir);
  return { exitCode: EXIT.ok, payload: { ok: true, id, out: outDir }, text: `已导出 ${id} → ${outDir}` };
}

function copyDirRecursive(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const source = join(from, entry.name);
    const target = join(to, entry.name);
    if (entry.isDirectory()) copyDirRecursive(source, target);
    else copyFileSync(source, target);
  }
}

function cmdThemeImport(paths, { positionals, flags }) {
  const fromDir = resolve(positionals[0] ?? "");
  if (!existsSync(join(fromDir, "theme.json"))) return fail(EXIT.error, `"${fromDir}" 不是主题目录（缺 theme.json）`);
  let raw;
  try {
    raw = JSON.parse(readFileSync(join(fromDir, "theme.json"), "utf8"));
  } catch (error) {
    return fail(EXIT.error, `theme.json 解析失败：${error.message}`);
  }
  if (typeof flags.id === "string") raw.id = flags.id;
  const theme = normalizeOrThrow(raw);
  const targetDir = join(paths.userThemesDir, theme.id);
  if (existsSync(targetDir)) return fail(EXIT.confirm, `"${theme.id}" 已存在；换 id 或先删除`);
  copyDirRecursive(fromDir, targetDir);
  writeJsonAtomic(join(targetDir, "theme.json"), raw);
  return { exitCode: EXIT.ok, payload: { ok: true, id: theme.id, dir: targetDir }, text: `已导入 ${theme.id} → ${targetDir}` };
}

const IMAGE_MIME = { ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".avif": "image/avif", ".gif": "image/gif" };

function cmdWallpaperList(paths, { positionals, flags }) {
  const id = positionals[0];
  const found = findTheme(paths, id);
  if (found === null) return fail(EXIT.error, `找不到主题 "${id}"`);
  const assetsDir = join(found.dir, "assets");
  const files = existsSync(assetsDir)
    ? readdirSync(assetsDir).filter((name) => IMAGE_MIME[extname(name).toLowerCase()] !== undefined)
    : [];
  const wallpaper = found.raw.wallpaper ?? null;
  const payload = { ok: true, id, kind: found.kind, wallpaper, files };
  if (flags.json === true) return { exitCode: EXIT.ok, payload };
  return {
    exitCode: EXIT.ok,
    payload,
    text: [`${id}：${wallpaper === null ? "无壁纸" : `${wallpaper.kind}${wallpaper.light ? ` light=${wallpaper.light.src}` : ""}${wallpaper.dark ? ` dark=${wallpaper.dark.src}` : ""}`}`,
      ...files.map((name) => `  · ${name}`)].join("\n"),
  };
}

function cmdWallpaperAdd(paths, { positionals, flags }) {
  const [id, ...files] = positionals;
  if (files.length === 0) return fail(EXIT.error, "用法：vft wallpaper add <id> <图片...> [--mode light|dark|both]");
  const mode = typeof flags.mode === "string" ? flags.mode : "both";
  if (!["light", "dark", "both"].includes(mode)) return fail(EXIT.error, "--mode 只能是 light / dark / both");
  return mutateUserTheme(paths, id, (raw) => {
    const themeDir = join(paths.userThemesDir, id);
    mkdirSync(join(themeDir, "assets"), { recursive: true });
    const added = [];
    for (const file of files) {
      const absolute = resolve(file);
      if (!existsSync(absolute)) throw new Error(`找不到文件 ${absolute}`);
      const mime = IMAGE_MIME[extname(absolute).toLowerCase()];
      if (mime === undefined) throw new Error(`${basename(absolute)}：只接受 webp/png/jpg/avif/gif`);
      const name = basename(absolute);
      copyFileSync(absolute, join(themeDir, "assets", name));
      added.push({ src: `assets/${name}`, mime });
    }
    const first = added[0];
    const isAnimated = first.mime === "image/gif";
    raw.wallpaper = {
      kind: isAnimated ? "animated" : "image",
      light: mode === "dark" ? (raw.wallpaper?.light ?? null) : { src: first.src },
      dark: mode === "light" ? (raw.wallpaper?.dark ?? null) : { src: (added[1] ?? first).src },
    };
  });
}

function cmdWallpaperSet(paths, { positionals, flags }) {
  const id = positionals[0];
  if (typeof flags.src !== "string") return fail(EXIT.error, "用法：vft wallpaper set <id> --src assets/x.webp [--mode light|dark|both]");
  const mode = typeof flags.mode === "string" ? flags.mode : "both";
  return mutateUserTheme(paths, id, (raw) => {
    const side = { src: flags.src };
    raw.wallpaper = {
      kind: raw.wallpaper?.kind ?? "image",
      light: mode === "dark" ? (raw.wallpaper?.light ?? null) : side,
      dark: mode === "light" ? (raw.wallpaper?.dark ?? null) : side,
    };
  });
}

function cmdWallpaperPending(command) {
  return fail(EXIT.confirm,
    `vft wallpaper ${command} 需要本机 ComfyUI（P6 接线）：目前请用 ComfyUI 生成图片后执行 vft wallpaper add`,
    { pending: "comfyui" });
}

function cmdSidebarList(paths, { flags }) {
  const packs = Object.entries(SIDEBAR_PACKS).map(([id, pack]) => ({ id, ...pack }));
  const payload = { ok: true, packs };
  if (flags.json === true) return { exitCode: EXIT.ok, payload };
  return {
    exitCode: EXIT.ok,
    payload,
    text: packs.map((pack) => `${pack.id.padEnd(9)} surface=${pack.surface.padEnd(9)} blur=${String(pack.blur).padStart(2)} density=${pack.density}`).join("\n"),
  };
}

function cmdSidebarSet(paths, { positionals }) {
  const [id, pack] = positionals;
  if (pack === undefined || SIDEBAR_PACKS[pack] === undefined) {
    return fail(EXIT.error, `用法：vft sidebar set <id> <${Object.keys(SIDEBAR_PACKS).join("|")}>`);
  }
  return mutateUserTheme(paths, id, (raw) => {
    raw.sidebar = { ...(raw.sidebar ?? {}), pack };
  });
}

function cmdSidebarTune(paths, { positionals, flags }) {
  const id = positionals[0];
  const numeric = (value) => (value === undefined ? undefined : Number(value));
  const radiusCard = numeric(flags["radius-card"]);
  const radiusItem = numeric(flags["radius-item"]);
  return mutateUserTheme(paths, id, (raw) => {
    const sidebar = { ...(raw.sidebar ?? {}) };
    if (flags.blur !== undefined) sidebar.blur = numeric(flags.blur);
    if (flags.density !== undefined) sidebar.density = flags.density;
    if (radiusCard !== undefined || radiusItem !== undefined) {
      sidebar.radius = {
        ...(sidebar.radius ?? {}),
        ...(radiusCard === undefined ? {} : { card: radiusCard }),
        ...(radiusItem === undefined ? {} : { item: radiusItem }),
      };
    }
    if (flags["icon-light"] !== undefined || flags["icon-dark"] !== undefined) {
      sidebar.icon = {
        light: flags["icon-light"] ?? sidebar.icon?.light ?? "#333333",
        dark: flags["icon-dark"] ?? sidebar.icon?.dark ?? "#EEEEEE",
      };
    }
    raw.sidebar = sidebar;
  });
}

function cmdColorsSuggest(paths, { positionals, flags }) {
  const id = positionals[0];
  const found = findTheme(paths, id);
  if (found === null) return fail(EXIT.error, `找不到主题 "${id}"`);
  const theme = normalizeOrThrow(found.raw);
  const seed = typeof flags.seed === "string" ? flags.seed : theme.colors.light["--dsw-alias-brand-primary"];
  const ranked = rankPalettes(seed, { baseTheme: theme });
  const best = ranked[0];
  if (flags.apply === true) {
    if (found.kind !== "user") {
      return fail(EXIT.confirm, `"${id}" 是${found.kind}主题，只读；先 theme create --from ${id} --id <新id>`);
    }
    mutateUserTheme(paths, id, (raw) => {
      raw.colors = best.colors;
    });
  }
  const payload = {
    ok: true,
    id,
    seed,
    applied: flags.apply === true,
    candidates: ranked.map((entry) => ({ harmony: entry.harmony, score: entry.report.score, colors: entry.colors })),
  };
  if (flags.json === true) return { exitCode: EXIT.ok, payload };
  return {
    exitCode: EXIT.ok,
    payload,
    text: [`种子 ${seed}`, ...ranked.map((entry) => `  ${entry.harmony.padEnd(14)} ${String(entry.report.score).padStart(3)}`)].join("\n"),
  };
}

function cmdBrandSet(paths, { positionals, flags }) {
  const id = positionals[0];
  return mutateUserTheme(paths, id, (raw) => {
    const brand = { ...(raw.brand ?? {}) };
    if (flags.title !== undefined || flags["title-en"] !== undefined) {
      brand.title = {
        zh: flags.title ?? brand.title?.zh ?? raw.name.zh,
        en: flags["title-en"] ?? flags.title ?? brand.title?.en ?? raw.name.en,
      };
    }
    if (flags.slogan !== undefined || flags["slogan-en"] !== undefined) {
      brand.slogans = {
        zh: flags.slogan ?? brand.slogans?.zh ?? "",
        en: flags["slogan-en"] ?? flags.slogan ?? brand.slogans?.en ?? "",
      };
    }
    if (flags.mark !== undefined) brand.mark = flags.mark;
    raw.brand = brand;
  });
}

function cmdAppearanceSet(paths, { positionals, flags }) {
  const id = positionals[0];
  const number = (value) => Number(value);
  return mutateUserTheme(paths, id, (raw) => {
    if (flags["translucency-web"] !== undefined || flags["translucency-desktop"] !== undefined) {
      raw.translucency = {
        ...(raw.translucency ?? {}),
        ...(flags["translucency-web"] === undefined ? {} : { web: number(flags["translucency-web"]) }),
        ...(flags["translucency-desktop"] === undefined ? {} : { desktop: number(flags["translucency-desktop"]) }),
      };
    }
    if (flags["coverage-shell"] !== undefined || flags.scopes !== undefined) {
      const coverage = { ...(raw.coverage ?? {}) };
      if (flags["coverage-shell"] !== undefined) {
        coverage.shell = flags["coverage-shell"] === true || flags["coverage-shell"] === "on" || flags["coverage-shell"] === "true";
      }
      if (typeof flags.scopes === "string") coverage.scopes = flags.scopes.split(",").map((scope) => scope.trim()).filter(Boolean);
      raw.coverage = coverage;
    }
  });
}

function cmdThemeCheck(paths, { positionals, flags }) {
  const ids = positionals.length > 0 ? positionals : listIds(paths.userThemesDir);
  if (ids.length === 0) return fail(EXIT.error, "没有可检查的用户主题；指定一个 id 或先创建主题");
  const results = [];
  for (const id of ids) {
    const found = findTheme(paths, id);
    if (found === null) {
      results.push({ id, ok: false, error: "找不到主题", pass: false, score: 0 });
      continue;
    }
    try {
      const theme = normalizeOrThrow(found.raw);
      const report = scoreTheme(theme);
      results.push({ id, ok: true, score: report.score, pass: report.pass, failures: report.failures, excluded: report.excluded });
    } catch (error) {
      results.push({ id, ok: false, error: error.message, pass: false, score: 0, issues: error.issues ?? [] });
    }
  }
  const failed = results.filter((result) => !result.pass);
  const payload = { ok: failed.length === 0, threshold: SCORE_THRESHOLD, results };
  if (flags.json === true) {
    return { exitCode: failed.length === 0 ? EXIT.ok : EXIT.gate, payload };
  }
  const lines = results.map((result) => {
    if (!result.ok) return `INVALID ${result.id}: ${result.error}`;
    const head = `${result.pass ? "pass" : "FAIL"}  ${String(result.score).padStart(3)}  ${result.id}`;
    const detail = result.failures.map((failure) => `\n         ! ${failure.dimension}/${failure.mode}: ${failure.fix}`);
    return [head, ...detail].join("");
  });
  return {
    exitCode: failed.length === 0 ? EXIT.ok : EXIT.gate,
    payload,
    text: [`配色门禁 · 阈值 ${SCORE_THRESHOLD}`, ...lines].join("\n"),
  };
}

function usage() {
  return [
    "vft — vyra-free-theme CLI",
    "",
    "  vft theme list|show|create|rename|delete|apply|reset|export|import",
    "  vft wallpaper list|add|set|gen|video",
    "  vft sidebar list|set|tune",
    "  vft colors suggest <id> [--apply] [--seed #RRGGBB]",
    "  vft brand set <id> --title … --title-en … --slogan … --mark …",
    "  vft appearance set <id> --translucency-web 45 --coverage-shell on --scopes sidebar",
    "  vft theme check [id…] [--json]",
    "  vft reset                     回官方主题",
    "",
    "  --profile desktop|web   默认按数据目录存在情况推断",
    "  --json                  机器可读输出",
    "  exit: 0 成功 · 2 校验/配色未过 · 3 需确认 · 1 错误",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// dispatch
// ---------------------------------------------------------------------------

export async function run(argv, options = {}) {
  const { positionals, flags } = parseArgs(argv);
  const paths = resolvePaths({ dshHome: options.dshHome, profile: typeof flags.profile === "string" ? flags.profile : options.profile });
  const [group, action, ...rest] = positionals;
  const ctx = { positionals: rest, flags, paths };

  if (group === undefined || flags.help === true) return { exitCode: EXIT.ok, payload: { ok: true }, text: usage() };
  if (group === "reset") return cmdReset(paths);

  try {
    if (group === "theme") {
      switch (action) {
        case "list": return cmdThemeList(paths, ctx);
        case "show": return cmdThemeShow(paths, ctx);
        case "create": return cmdThemeCreate(paths, ctx);
        case "rename": return cmdThemeRename(paths, ctx);
        case "delete": return cmdThemeDelete(paths, ctx);
        case "apply": return cmdThemeApply(paths, ctx);
        case "reset": return cmdThemeReset(paths, ctx);
        case "export": return cmdThemeExport(paths, ctx);
        case "import": return cmdThemeImport(paths, ctx);
        case "check": return cmdThemeCheck(paths, ctx);
        default: return fail(EXIT.error, `未知子命令 theme ${action ?? ""}`.trim());
      }
    }
    if (group === "wallpaper") {
      switch (action) {
        case "list": return cmdWallpaperList(paths, ctx);
        case "add": return cmdWallpaperAdd(paths, ctx);
        case "set": return cmdWallpaperSet(paths, ctx);
        case "gen": return cmdWallpaperPending("gen");
        case "video": return cmdWallpaperPending("video");
        default: return fail(EXIT.error, `未知子命令 wallpaper ${action ?? ""}`.trim());
      }
    }
    if (group === "sidebar") {
      switch (action) {
        case "list": return cmdSidebarList(paths, ctx);
        case "set": return cmdSidebarSet(paths, ctx);
        case "tune": return cmdSidebarTune(paths, ctx);
        default: return fail(EXIT.error, `未知子命令 sidebar ${action ?? ""}`.trim());
      }
    }
    if (group === "colors" && action === "suggest") return cmdColorsSuggest(paths, ctx);
    if (group === "brand" && action === "set") return cmdBrandSet(paths, ctx);
    if (group === "appearance" && action === "set") return cmdAppearanceSet(paths, ctx);
    return fail(EXIT.error, `未知命令 ${positionals.join(" ")}`);
  } catch (error) {
    return fail(EXIT.error, String(error?.message ?? error), { issues: error?.issues ?? null });
  }
}

/** Testable sidebar CSS preview: `vft sidebar preview <id>`. */
export function sidebarPreview(theme, bodyAttribute) {
  return sidebarCss(resolveSidebar(theme), bodyAttribute);
}

const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { exitCode, payload, text } = await run(process.argv.slice(2));
  const wantsJson = process.argv.includes("--json");
  if (wantsJson) process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  else if (text !== undefined) process.stdout.write(`${text}\n`);
  else if (payload?.error !== undefined) process.stderr.write(`${payload.error}\n`);
  process.exit(exitCode);
}