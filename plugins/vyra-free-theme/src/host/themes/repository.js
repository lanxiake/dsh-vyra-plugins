/**
 * Theme repository (Host) — discovers `themes/<id>/theme.json` in two places:
 * the themes shipped inside the package, and the user's data directory.
 *
 * Two jobs:
 *   1. Report every theme (valid ones plus per-theme problems) to the client,
 *      which renders cards and projects effects.
 *   2. Register the valid ones into the shared catalog so the Host store can
 *      validate their personalization overrides exactly like a compiled-in
 *      skin's — the store must never see a field it cannot name.
 *
 * Built-in themes win over user themes on an id collision; the shadowed copy is
 * reported rather than silently dropped.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { normalizeTheme, fieldsFromTheme } from "../../shared/personalization/theme-model.js";
import { registerExternalSkin, unregisterExternalSkin } from "../../shared/personalization/catalog.js";

const THEME_FILE = "theme.json";

function readTheme(dir) {
  const file = join(dir, THEME_FILE);
  if (!existsSync(file)) return null;
  let raw;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    return { issues: [{ code: "bad-json", path: THEME_FILE, message: String(error.message ?? error) }] };
  }
  const result = normalizeTheme(raw);
  if (!result.ok) return { issues: result.issues };
  return { theme: result.theme };
}

/**
 * @param {{ dirs: Array<{source: "builtin"|"user", dir: string}>, profile?: "web"|"desktop" }} options
 */
export function createThemeRepository({ dirs, profile = "web" }) {
  let registered = [];

  function discover() {
    const themes = [];
    const problems = [];
    const seen = new Set();

    for (const { source, dir } of dirs) {
      if (!existsSync(dir)) continue;
      let entries;
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch (error) {
        problems.push({ source, id: null, issues: [{ code: "unreadable-dir", path: dir, message: String(error.message ?? error) }] });
        continue;
      }
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const themeDir = join(dir, entry.name);
        const parsed = readTheme(themeDir);
        if (parsed === null) continue;
        if (parsed.issues !== undefined) {
          problems.push({ source, id: entry.name, issues: parsed.issues });
          continue;
        }
        if (parsed.theme.id !== entry.name) {
          problems.push({
            source,
            id: entry.name,
            issues: [{ code: "dir-id-mismatch", path: THEME_FILE, message: `目录名与 theme.id "${parsed.theme.id}" 不一致` }],
          });
          continue;
        }
        if (seen.has(parsed.theme.id)) {
          problems.push({
            source,
            id: entry.name,
            issues: [{ code: "shadowed", path: THEME_FILE, message: "同 id 的主题已被内置主题占用，此项未加载" }],
          });
          continue;
        }
        seen.add(parsed.theme.id);
        themes.push({ source, dir: themeDir, theme: parsed.theme });
      }
    }
    return { themes, problems };
  }

  /**
   * Discover + register into the shared catalog. Safe to call repeatedly:
   * registrations from the previous pass are dropped first so a deleted theme
   * cannot linger in the store's field table.
   */
  function sync() {
    for (const id of registered) unregisterExternalSkin(id);
    const { themes, problems } = discover();
    registered = [];
    for (const { theme } of themes) {
      registerExternalSkin({ id: theme.id, fields: fieldsFromTheme(theme, profile), builtinAssets: {} });
      registered.push(theme.id);
    }
    return {
      themes: themes.map(({ source, theme }) => ({ source, theme })),
      problems,
    };
  }

  return { discover, sync, registeredIds: () => [...registered] };
}