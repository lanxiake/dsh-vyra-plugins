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
import { builtinAssetsFromTheme, fieldsFromTheme, mimeForAssetPath, tableFromTheme, THEME_ASSET_BASE } from "../shared/personalization/theme-model.js";
import { registerExternalSkin } from "../shared/personalization/catalog.js";
import { createProjection } from "./skins/translucency.js";

const THEMES_ROUTE = "/vyra-free-theme/themes";

function themeAssetUrl(id, path) {
  return `${THEME_ASSET_BASE}/${id}/${String(path).split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * Brand seats. The new-session hero (`conversation.hero.brand.mark`) can show an
 * image, a text wordmark, or nothing at all — `brand.heroMark` decides, so a
 * theme can drop the logo and let its title + headline carry the screen.
 */
function brandComponents(theme, jsx) {
  const title = theme.brand.title?.zh ?? theme.name.zh;
  const mode = theme.brand.heroMark ?? "auto";
  const markPath = theme.brand.mark;

  const Mark = () => {
    if (mode === "none") {
      return jsx("span", { "data-vft-hero-mark": "none", "aria-hidden": "true", style: { display: "none" } });
    }
    if (mode === "text") {
      return jsx("span", {
        "data-vft-hero-mark": "text",
        style: { fontSize: "0.86em", fontWeight: 600, letterSpacing: "0.14em", opacity: 0.9, whiteSpace: "nowrap" },
      }, title);
    }
    if ((mode === "auto" || mode === "image") && typeof markPath === "string" && mimeForAssetPath(markPath) !== null) {
      return jsx("img", {
        "data-vft-hero-mark": "image",
        src: themeAssetUrl(theme.id, markPath),
        alt: "",
        style: { maxHeight: "52px", maxWidth: "220px", objectFit: "contain" },
      });
    }
    // Neutral glyph rather than host artwork: a theme replaces the product
    // wordmark, so rendering DeepSeek Harness art here would be inconsistent.
    return jsx("svg", {
      "data-vft-hero-mark": "ring",
      width: 18,
      height: 18,
      viewBox: "0 0 18 18",
      "aria-hidden": "true",
      focusable: "false",
    }, jsx("circle", { cx: 9, cy: 9, r: 6.5, fill: "none", stroke: "currentColor", strokeWidth: 1.6 }));
  };

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