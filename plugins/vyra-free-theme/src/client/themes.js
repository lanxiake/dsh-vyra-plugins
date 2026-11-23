/**
 * File-backed themes (Web + Desktop) — the bridge between `theme.json` on disk
 * and a registered skin.
 *
 * The Host serves the normalized theme catalog; this module turns each entry
 * into the same seven-field skin object a compiled-in theme returns, using the
 * SAME projection kernel (`createProjection(tableFromTheme(…))`). From here on
 * nothing distinguishes a JSON theme from a built-in one: the switcher lists
 * it, the panel edits it, the runtime mounts it.
 */
import { builtinAssetsFromTheme, fieldsFromTheme, tableFromTheme } from "../shared/personalization/theme-model.js";
import { registerExternalSkin } from "../shared/personalization/catalog.js";
import { createProjection } from "./skins/translucency.js";

const THEMES_ROUTE = "/vyra-free-theme/themes";

function brandComponents(theme, jsx) {
  const title = theme.brand.title?.zh ?? theme.name.zh;
  // A neutral glyph rather than a host icon: a theme replaces the product
  // wordmark, so rendering DeepSeek Harness artwork here would be inconsistent.
  const Mark = () => jsx(
    "svg",
    { width: 18, height: 18, viewBox: "0 0 18 18", "aria-hidden": "true", focusable: "false" },
    jsx("circle", { cx: 9, cy: 9, r: 6.5, fill: "none", stroke: "currentColor", strokeWidth: 1.6 }),
  );
  const Name = () => jsx("span", { className: "vft-brand-name" }, title);
  return { Mark, Name };
}

/**
 * Install every theme the Host reports. Returns the ids that were installed and
 * the per-theme problems the Host found (so the panel can show broken cards).
 */
export async function installFileThemes({ runtime, jsx, profile, fetchImpl = fetch }) {
  const response = await fetchImpl(THEMES_ROUTE, { cache: "no-store" });
  if (!response.ok) throw new Error(`themes route answered HTTP ${response.status}`);
  const payload = await response.json();
  const entries = Array.isArray(payload?.themes) ? payload.themes : [];
  const problems = Array.isArray(payload?.problems) ? payload.problems : [];
  const known = new Set(runtime.list().map((skin) => skin.id));
  const installed = [];

  for (const entry of entries) {
    const theme = entry?.theme;
    if (!theme || typeof theme.id !== "string") continue;
    if (known.has(theme.id)) {
      installed.push(theme.id);
      continue;
    }
    try {
      const { Mark, Name } = brandComponents(theme, jsx);
      const builtinAssets = builtinAssetsFromTheme(theme);
      registerExternalSkin({ id: theme.id, fields: fieldsFromTheme(theme, profile), builtinAssets });
      runtime.register({
        id: theme.id,
        label: theme.name,
        description: theme.brand.slogans.zh ? theme.brand.slogans : theme.name,
        Mark,
        Name,
        project: createProjection(tableFromTheme(theme, profile)),
        builtinAssets,
      });
      installed.push(theme.id);
    } catch (error) {
      problems.push({ source: entry?.source ?? "user", id: theme.id, issues: [{ code: "register-failed", path: "theme.json", message: String(error.message ?? error) }] });
    }
  }

  return { installed, problems };
}