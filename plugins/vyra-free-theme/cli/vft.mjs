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
import { buildQwenImageWorkflow, validateWorkflow, WALLPAPER_SIZES, QWEN_IMAGE_DEFAULTS } from "../src/shared/comfy-workflow.js";
import { buildHunyuanI2VWorkflow, validateVideoWorkflow, HUNYUAN_I2V_DEFAULTS, framesForSeconds } from "../src/shared/comfy-video-workflow.js";
import { createComfyClient } from "../src/host/comfy.js";
import { imageStats, isPng } from "../src/shared/png-stats.js";
import { ART_RECIPES, ANIMATED_RECIPES, renderArt } from "../src/shared/art-recipes.js";
import { hasFfmpeg, renderArtVideo } from "../src/host/art-video.js";

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
      if (extname(name).toLowerCase() === ".png") {
        try {
          recordWallpaperStats(themeDir, mode, readFileSync(absolute));
        } catch {}
      }
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

function cmdWallpaperRecipes({ flags }) {
  const recipes = Object.entries(ART_RECIPES).map(([id, recipe]) => ({ id, ...recipe }));
  if (flags.json === true) return { exitCode: EXIT.ok, payload: { ok: true, recipes } };
  return {
    exitCode: EXIT.ok,
    payload: { ok: true, recipes },
    text: recipes.map((recipe) => `${recipe.id.padEnd(12)} ${recipe.label.zh}  ${recipe.description}`).join("\n"),
  };
}

async function cmdWallpaperAnim(paths, { positionals, flags }) {
  const id = positionals[0];
  const recipe = typeof flags.recipe === "string" ? flags.recipe : null;
  if (recipe === null || !ANIMATED_RECIPES.includes(recipe)) {
    return fail(EXIT.error, `用法：vft wallpaper anim <id> --recipe <${ANIMATED_RECIPES.join("|")}> [--size portrait|desktop|square] [--frames 48] [--fps 24] [--side light|dark|both] [--seed N]`);
  }
  const found = findTheme(paths, id);
  if (found === null) return fail(EXIT.error, `找不到主题 "${id}"`);
  if (found.kind !== "user") return fail(EXIT.confirm, `"${id}" 是${found.kind}主题，只读；先 theme create --from ${id} --id <新id>`);

  const ffmpegPath = typeof flags.ffmpeg === "string" ? flags.ffmpeg : (process.env.FFMPEG_PATH ?? "ffmpeg");
  if (!hasFfmpeg(ffmpegPath)) {
    return fail(EXIT.confirm, `找不到 ffmpeg（试过 "${ffmpegPath}"）：动态壁纸需要它编码 mp4；用 --ffmpeg 指定，或改用 wallpaper art 生成静帧`, { missing: "ffmpeg" });
  }

  const size = WALLPAPER_SIZES[typeof flags.size === "string" ? flags.size : "portrait"] ?? WALLPAPER_SIZES.portrait;
  const seed = flags.seed === undefined ? 1 : Number(flags.seed);
  const frames = flags.frames === undefined ? 48 : Number(flags.frames);
  const fps = flags.fps === undefined ? 24 : Number(flags.fps);
  const side = typeof flags.side === "string" ? flags.side : "both";
  if (!["light", "dark", "both"].includes(side)) return fail(EXIT.error, "--side 只能是 light / dark / both");

  const themeDir = join(paths.userThemesDir, id);
  mkdirSync(join(themeDir, "assets"), { recursive: true });
  const baseName = typeof flags.file === "string" ? flags.file.replace(/\.(mp4|webm)$/i, "") : `${recipe}-${seed}`;
  const mp4 = join(themeDir, "assets", `${baseName}.mp4`);
  const poster = join(themeDir, "assets", `${baseName}.png`);
  const result = renderArtVideo({
    recipe,
    width: size.width,
    height: size.height,
    seed,
    tone: flags.tone === "dark" ? "dark" : "light",
    frames,
    fps,
    crf: flags.crf === undefined ? 20 : Number(flags.crf),
    output: mp4,
    posterPath: poster,
    ffmpegPath,
  });

  const videoSide = { src: `assets/${baseName}.mp4`, poster: `assets/${baseName}.png` };
  const applied = mutateUserTheme(paths, id, (raw) => {
    // Both modes get the clip: a leftover image side on a video wallpaper is a
    // validation error ("必须是 .mp4 或 .webm"), and one clip already serves both.
    raw.wallpaper = { kind: "video", light: videoSide, dark: videoSide };
  });
  if (applied.exitCode !== EXIT.ok) return applied;
  const stats = recordWallpaperStats(themeDir, side, result.poster);
  return {
    exitCode: EXIT.ok,
    payload: { ok: true, id, recipe, file: videoSide.src, poster: videoSide.poster, bytes: result.bytes, frames: result.frames, fps: result.fps, side, stats },
    text: `已生成动态壁纸 ${videoSide.src}（${result.frames} 帧 @${result.fps}fps，${Math.round(result.bytes / 1024)} KB）`,
  };
}

async function cmdWallpaperArt(paths, { positionals, flags }) {
  const id = positionals[0];
  const recipe = typeof flags.recipe === "string" ? flags.recipe : null;
  if (recipe === null || ART_RECIPES[recipe] === undefined) {
    return fail(EXIT.error, `用法：vft wallpaper art <id> --recipe <${Object.keys(ART_RECIPES).join("|")}> [--size portrait|desktop|square] [--side light|dark|both] [--seed N]`);
  }
  const found = findTheme(paths, id);
  if (found === null) return fail(EXIT.error, `找不到主题 "${id}"`);
  if (found.kind !== "user") return fail(EXIT.confirm, `"${id}" 是${found.kind}主题，只读；先 theme create --from ${id} --id <新id>`);

  const size = WALLPAPER_SIZES[typeof flags.size === "string" ? flags.size : "portrait"] ?? WALLPAPER_SIZES.portrait;
  const seed = flags.seed === undefined ? 1 : Number(flags.seed);
  const side = typeof flags.side === "string" ? flags.side : "both";
  if (!["light", "dark", "both"].includes(side)) return fail(EXIT.error, "--side 只能是 light / dark / both");

  const buffer = renderArt(recipe, { width: size.width, height: size.height, seed });
  const themeDir = join(paths.userThemesDir, id);
  mkdirSync(join(themeDir, "assets"), { recursive: true });
  const fileName = typeof flags.file === "string" ? flags.file : `${recipe}-${seed}.png`;
  writeFileSync(join(themeDir, "assets", fileName), buffer);
  const src = `assets/${fileName}`;
  const applied = mutateUserTheme(paths, id, (raw) => {
    raw.wallpaper = {
      kind: "image",
      light: side === "dark" ? (raw.wallpaper?.light ?? null) : { src },
      dark: side === "light" ? (raw.wallpaper?.dark ?? null) : { src },
    };
  });
  if (applied.exitCode !== EXIT.ok) return applied;
  const stats = recordWallpaperStats(themeDir, side, buffer);
  return {
    exitCode: EXIT.ok,
    payload: { ok: true, id, recipe, file: src, seed, size, side, stats },
    text: `已用 ${recipe} 生成 ${src}（${size.width}×${size.height}）${stats === null ? "" : ` · stdLuma ${stats.stdLuma} edge ${stats.edgeEnergy}`}`,
  };
}

function cmdWallpaperPending(command) {
  return fail(EXIT.confirm,
    `vft wallpaper ${command} 需要视频工作流（P6.1）：先用本机 ComfyUI 生成 mp4，再手改 theme.json 的 wallpaper 块（见技能文档）`,
    { pending: "comfyui-video" });
}

const STATS_FILE = "wallpaper-stats.json";

/**
 * Record pixel evidence for one wallpaper side. The colour gate's interference
 * dimension only runs when this exists, so it is written whenever a PNG lands.
 */
function recordWallpaperStats(themeDir, side, buffer) {
  if (!isPng(buffer)) return null;
  let stats;
  try {
    stats = imageStats(buffer);
  } catch {
    return null;
  }
  const file = join(themeDir, STATS_FILE);
  let all = {};
  if (existsSync(file)) {
    try {
      all = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      all = {};
    }
  }
  const record = { stdLuma: stats.stdLuma, edgeEnergy: stats.edgeEnergy, width: stats.width, height: stats.height };
  if (side === "dark") all.dark = record;
  else if (side === "both") { all.light = record; all.dark = record; }
  else all.light = record;
  writeJsonAtomic(file, all);
  return record;
}

async function cmdWallpaperGen(paths, { positionals, flags }) {
  const id = positionals[0];
  if (typeof flags.prompt !== "string" || flags.prompt.trim().length === 0) {
    return fail(EXIT.error, "用法：vft wallpaper gen <id> --prompt \"画面描述\" [--size portrait|desktop|square] [--seed N] [--file 名称.png] [--mode light|dark|both] [--resolution 1024] [--sigmas 1.0,0.97,...]");
  }
  const found = findTheme(paths, id);
  if (found === null) return fail(EXIT.error, `找不到主题 "${id}"`);
  if (found.kind !== "user") return fail(EXIT.confirm, `"${id}" 是${found.kind}主题，只读；先 theme create --from ${id} --id <新id>`);

  const size = WALLPAPER_SIZES[typeof flags.size === "string" ? flags.size : "portrait"] ?? WALLPAPER_SIZES.portrait;
  const seed = flags.seed === undefined ? Math.floor(Math.random() * 2 ** 31) : Number(flags.seed);
  const workflow = buildQwenImageWorkflow({
    prompt: flags.prompt,
    negative: typeof flags.negative === "string" ? flags.negative : "",
    width: size.width,
    height: size.height,
    seed,
    cfg: flags.cfg === undefined ? QWEN_IMAGE_DEFAULTS.cfg : Number(flags.cfg),
    resolution: flags.resolution === undefined ? QWEN_IMAGE_DEFAULTS.resolution : Number(flags.resolution),
    sigmas: typeof flags.sigmas === "string" ? flags.sigmas : QWEN_IMAGE_DEFAULTS.sigmas,
    filenamePrefix: `vft/${id}`,
  });
  const issues = validateWorkflow(workflow);
  if (issues.length > 0) return fail(EXIT.gate, `工作流不合法：${issues.join("；")}`, { issues });

  const client = createComfyClient({ baseUrl: typeof flags["comfy-url"] === "string" ? flags["comfy-url"] : undefined, auth: typeof flags["comfy-auth"] === "string" ? flags["comfy-auth"] : undefined });
  const probe = await client.probe();
  if (!probe.ok) {
    const reason = probe.status === 401 || probe.status === 403
      ? `ComfyUI 在 ${client.baseUrl} 要求认证：${probe.status}。设 COMFYUI_AUTH=用户名:密码（或 Bearer <token>），或用 --comfy-auth 传`
      : `ComfyUI 不可达（${client.baseUrl}）。确认 ComfyUI 已启动，或用 --comfy-url / COMFYUI_URL 指定地址`;
    return fail(EXIT.confirm, reason, { comfy: client.baseUrl, status: probe.status });
  }

  const promptId = await client.submit(workflow);
  const timeoutMs = flags.timeout === undefined ? 900_000 : Number(flags.timeout) * 1000;
  const { images } = await client.wait(promptId, { timeoutMs });
  if (images.length === 0) return fail(EXIT.error, "ComfyUI 完成但没有任何输出图片");
  const buffer = await client.download(images[0]);

  const themeDir = join(paths.userThemesDir, id);
  mkdirSync(join(themeDir, "assets"), { recursive: true });
  const fileName = typeof flags.file === "string" ? flags.file : `${id}-${seed}.png`;
  const target = join(themeDir, "assets", fileName);
  writeFileSync(target, buffer);
  const mode = typeof flags.mode === "string" ? flags.mode : "both";
  const side = `assets/${fileName}`;
  mutateUserTheme(paths, id, (raw) => {
    raw.wallpaper = {
      kind: "image",
      light: mode === "dark" ? (raw.wallpaper?.light ?? null) : { src: side },
      dark: mode === "light" ? (raw.wallpaper?.dark ?? null) : { src: side },
    };
  });
  const stats = recordWallpaperStats(themeDir, mode, buffer);
  return {
    exitCode: EXIT.ok,
    payload: { ok: true, id, promptId, file: side, seed, size, stats },
    text: `已生成 ${side}（prompt ${promptId}，seed ${seed}）${stats === null ? "" : ` · stdLuma ${stats.stdLuma} edge ${stats.edgeEnergy}`}`,
  };
}

﻿/**
 * Turn an existing still into a moving wallpaper with local HunyuanVideo 1.5.
 *
 * The still is uploaded to ComfyUI, conditioned as the first frame, and the clip
 * is written next to it. The still stays as the poster, so a browser that will
 * not autoplay a video still shows the right picture.
 */
async function cmdWallpaperVideo(paths, { positionals, flags }) {
  const id = positionals[0];
  if (id === undefined) return fail(EXIT.error, "用法：vft wallpaper video <id> --image assets/x.png [--prompt 运动描述] [--seconds 2] [--fps 24] [--size desktop] [--seed N]");
  const found = findTheme(paths, id);
  if (found === null) return fail(EXIT.error, `找不到主题 "${id}"`);
  if (found.kind !== "user") return fail(EXIT.confirm, `"${id}" 是${found.kind}主题，只读；先 theme create --from ${id} --id <新id>`);

  const themeDir = join(paths.userThemesDir, id);
  const theme = JSON.parse(readFileSync(join(themeDir, "theme.json"), "utf8"));
  const side = typeof flags.side === "string" ? flags.side : (theme.wallpaper?.dark === undefined ? "light" : "dark");
  if (!["light", "dark"].includes(side)) return fail(EXIT.error, "--side 只能是 light / dark");

  let imagePath = typeof flags.image === "string" ? resolve(flags.image) : null;
  if (imagePath === null) {
    // Re-animating a theme that is already a video: its poster is the still the
    // clip started from, so that is the honest source rather than an error.
    const entry = theme.wallpaper?.[side] ?? theme.wallpaper?.light ?? theme.wallpaper?.dark ?? {};
    if (typeof entry.poster === "string" && /\.(png|jpe?g|webp)$/i.test(entry.poster)) imagePath = join(themeDir, entry.poster);
    else if (typeof entry.src === "string" && /\.(png|jpe?g|webp)$/i.test(entry.src)) imagePath = join(themeDir, entry.src);
    else if (typeof theme.wallpaper?.light?.src === "string" && /\.(png|jpe?g|webp)$/i.test(theme.wallpaper.light.src)) imagePath = join(themeDir, theme.wallpaper.light.src);
  }
  if (imagePath === null || !existsSync(imagePath)) {
    return fail(EXIT.error, "找不到要动的图片：用 --image 指定一张 png/jpg，或先 vft wallpaper gen / art 生成一张");
  }
  const source = readFileSync(imagePath);

  const size = WALLPAPER_SIZES[typeof flags.size === "string" ? flags.size : "desktop"] ?? WALLPAPER_SIZES.desktop;
  const fps = flags.fps === undefined ? HUNYUAN_I2V_DEFAULTS.fps : Number(flags.fps);
  const seconds = flags.seconds === undefined ? 2 : Number(flags.seconds);
  if (!(seconds > 0) || seconds > 10) return fail(EXIT.error, "--seconds 取 0-10 之间（受显存与时长限制）");
  const seed = flags.seed === undefined ? Math.floor(Math.random() * 2 ** 31) : Number(flags.seed);

  const client = createComfyClient({
    baseUrl: typeof flags["comfy-url"] === "string" ? flags["comfy-url"] : undefined,
    auth: typeof flags["comfy-auth"] === "string" ? flags["comfy-auth"] : undefined,
  });
  const probe = await client.probe();
  if (!probe.ok) {
    const reason = probe.status === 401 || probe.status === 403
      ? `ComfyUI 在 ${client.baseUrl} 要求认证：${probe.status}。设 COMFYUI_AUTH=用户名:密码（或 Bearer <token>），或用 --comfy-auth 传`
      : `ComfyUI 不可达（${client.baseUrl}）。确认 ComfyUI 已启动，或用 --comfy-url / COMFYUI_URL 指定地址`;
    return fail(EXIT.confirm, reason, { comfy: client.baseUrl, status: probe.status });
  }

  const uploaded = await client.uploadImage(source, `vft-${id}-${seed}.png`);
  const workflow = buildHunyuanI2VWorkflow({
    image: uploaded,
    prompt: typeof flags.prompt === "string" ? flags.prompt : undefined,
    negative: typeof flags.negative === "string" ? flags.negative : undefined,
    width: size.width,
    height: size.height,
    fps,
    seconds,
    seed,
    steps: flags.steps === undefined ? HUNYUAN_I2V_DEFAULTS.steps : Number(flags.steps),
    shift: flags.shift === undefined ? HUNYUAN_I2V_DEFAULTS.shift : Number(flags.shift),
    cfg: flags.cfg === undefined ? HUNYUAN_I2V_DEFAULTS.cfg : Number(flags.cfg),
    filenamePrefix: `vft/${id}`,
  });
  const issues = validateVideoWorkflow(workflow);
  if (issues.length > 0) return fail(EXIT.gate, `工作流不合法：${issues.join("；")}`, { issues });

  const promptId = await client.submit(workflow);
  const timeoutMs = flags.timeout === undefined ? 1_800_000 : Number(flags.timeout) * 1000;
  const { files } = await client.wait(promptId, { timeoutMs });
  const clip = files.find((file) => /\.(mp4|webm|mov)$/i.test(file.filename ?? ""));
  if (clip === undefined) return fail(EXIT.error, "ComfyUI 完成但没有输出视频文件");
  const buffer = await client.download(clip);

  mkdirSync(join(themeDir, "assets"), { recursive: true });
  const baseName = typeof flags.file === "string" ? flags.file.replace(/\.(mp4|webm)$/i, "") : `${id}-${seed}`;
  const mp4 = join(themeDir, "assets", `${baseName}.mp4`);
  const posterName = `${baseName}.png`;
  writeFileSync(mp4, buffer);
  writeFileSync(join(themeDir, "assets", posterName), source);

  const videoSide = { src: `assets/${baseName}.mp4`, poster: `assets/${posterName}` };
  const applied = mutateUserTheme(paths, id, (raw) => {
    // Same rule as the code-animated path: the clip replaces both sides, so a
    // stale image side can never survive into a kind: "video" theme.
    raw.wallpaper = { kind: "video", light: videoSide, dark: videoSide };
  });
  if (applied.exitCode !== EXIT.ok) return applied;
  const stats = recordWallpaperStats(themeDir, side, source);
  const frames = framesForSeconds(seconds, fps);
  return {
    exitCode: EXIT.ok,
    payload: { ok: true, id, promptId, file: videoSide.src, poster: videoSide.poster, bytes: buffer.byteLength, frames, fps, side, stats },
    text: `已生成动态壁纸 ${videoSide.src}（${frames} 帧 @${fps}fps，${Math.round(buffer.byteLength / 1024)} KB）· 首帧沿用 ${basename(imagePath)}`,
  };
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
    if (flags["hero-mark"] !== undefined) brand.heroMark = flags["hero-mark"];
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
      // Pixel evidence, when the theme has it: the interference dimension only
      // joins the score with real wallpaper statistics on disk.
      let sampled = null;
      const statsFile = join(found.dir, STATS_FILE);
      if (existsSync(statsFile)) {
        try {
          const parsed = JSON.parse(readFileSync(statsFile, "utf8"));
          if (parsed?.light !== undefined && parsed?.dark !== undefined) sampled = parsed;
        } catch {}
      }
      const report = scoreTheme(theme, { sampled });
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

  // Commands that address one theme must fail with a usage line, not with a
  // path error from deep inside a directory join.
  const NEEDS_ID = new Set([
    "theme:show", "theme:rename", "theme:delete", "theme:apply", "theme:reset",
    "theme:export", "theme:import", "wallpaper:list", "wallpaper:add", "wallpaper:set",
    "wallpaper:gen", "wallpaper:video", "wallpaper:art", "wallpaper:anim", "sidebar:set", "sidebar:tune",
    "colors:suggest", "brand:set", "appearance:set",
  ]);
  if (NEEDS_ID.has(`${group}:${action}`) && typeof rest[0] !== "string") {
    return fail(EXIT.error, `缺少主题 id：vft ${group} ${action} <id>`);
  }

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
        case "art": return await cmdWallpaperArt(paths, ctx);
        case "anim": return await cmdWallpaperAnim(paths, ctx);
        case "recipes": return cmdWallpaperRecipes(ctx);
        case "gen": return await cmdWallpaperGen(paths, ctx);
        case "video": return await cmdWallpaperVideo(paths, ctx);
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