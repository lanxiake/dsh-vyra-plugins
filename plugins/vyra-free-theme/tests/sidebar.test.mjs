import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultSidebarSpec,
  resolveSidebar,
  sidebarCss,
  SIDEBAR_PACKS,
} from "../src/shared/personalization/sidebar-presets.js";
import { bodyAttributeFor, normalizeTheme, tableFromTheme } from "../src/shared/personalization/theme-model.js";
import { createProjection } from "../src/client/skins/translucency.js";
import { normalizeEffects } from "../src/client/personalization/projector.js";

function raw(extra = {}) {
  return {
    schema: 1,
    id: "nebula",
    name: { zh: "星云", en: "Nebula" },
    colors: {
      light: {
        "--dsw-alias-bg-base": "#F4F2FF",
        "--dsw-alias-label-primary": "#211B33",
        "--dsw-alias-label-secondary": "#5B5273",
        "--dsw-alias-brand-primary": "#6D4AFF",
      },
      dark: {
        "--dsw-alias-bg-base": "#0E0B1A",
        "--dsw-alias-label-primary": "#F3EEFF",
        "--dsw-alias-label-secondary": "#B9AEDA",
        "--dsw-alias-brand-primary": "#A78BFF",
      },
    },
    ...extra,
  };
}

function theme(extra) {
  const result = normalizeTheme(raw(extra));
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  return result.theme;
}

function codes(result) {
  return result.issues.map((issue) => issue.code);
}

test("a theme with no sidebar block derives everything from its palette", () => {
  const spec = defaultSidebarSpec(theme({}));
  assert.equal(spec.pack, "inherit");
  assert.equal(spec.surface, "inherit");
  assert.equal(spec.density, "cozy");
  assert.deepEqual(spec.radius, { card: 14, item: 8 });
  assert.equal(spec.icon.light, "#5B5273");
  assert.equal(spec.icon.dark, "#B9AEDA");
  assert.match(spec.states.selected.bg, /^rgba\(109, 74, 255, 0\.14\)$/);
  assert.equal(spec.states.selected.indicator, "#6D4AFF");
  assert.equal(spec.states.hover.fg, null);
});

test("every built-in pack resolves without further input", () => {
  for (const pack of Object.keys(SIDEBAR_PACKS)) {
    const spec = resolveSidebar(theme({ sidebar: { pack } }));
    assert.equal(spec.pack, pack);
    assert.equal(typeof spec.surface, "string");
    assert.equal(typeof spec.blur, "number");
    assert.ok(spec.radius.card >= 0);
  }
});

test("explicit fields override the pack, field by field", () => {
  const spec = resolveSidebar(theme({
    sidebar: {
      pack: "frost",
      blur: 6,
      density: "compact",
      radius: { item: 2 },
      icon: { light: "#111111", dark: "#EEEEEE" },
      divider: { color: "rgba(0,0,0,0.06)", style: "dashed" },
      states: { selected: { bg: "rgba(1,2,3,0.2)", fg: "#123456" } },
    },
  }));
  assert.equal(spec.pack, "frost");
  assert.equal(spec.surface, "frost"); // from the pack
  assert.equal(spec.blur, 6); // explicit wins
  assert.equal(spec.density, "compact");
  assert.deepEqual(spec.radius, { card: 16, item: 2 }); // card from pack, item explicit
  assert.equal(spec.icon.light, "#111111");
  assert.deepEqual(spec.divider, { color: "rgba(0,0,0,0.06)", style: "dashed" });
  assert.equal(spec.states.selected.bg, "rgba(1,2,3,0.2)");
});

test("sidebar validation rejects malformed blocks", () => {
  for (const bad of [
    { pack: "chocolate" },
    { surface: "glass" },
    { density: "tight" },
    { blur: 40 },
    { radius: { card: 99 } },
    { icon: { light: "#111111" } },
    { states: { hover: { colour: "red" } } },
    { divider: { style: "solid" } },
    { background: { dark: "#000" } },
    { nope: 1 },
  ]) {
    const result = normalizeTheme(raw({ sidebar: bad }));
    assert.equal(result.ok, false, JSON.stringify(bad));
    assert.ok(codes(result).length > 0, JSON.stringify(bad));
  }
});

test("the compiled CSS is scoped to the theme and keyed on runtime tags", () => {
  const spec = resolveSidebar(theme({ sidebar: { pack: "frost" } }));
  const css = sidebarCss(spec, bodyAttributeFor("nebula"));
  assert.match(css, /body\[data-vftNebula\] \[class\*="_sidebarCol"\]/);
  assert.match(css, /backdrop-filter:blur\(14px\)/);
  assert.match(css, /\[data-vft-sb-item\]\{/);
  assert.match(css, /padding-top:6px/); // cozy
  assert.match(css, /color:#5B5273/); // icon light
  assert.match(css, /\[class\*="_sidebarCol"\] svg|\[data-vft-sb-item\] svg/);
  assert.match(css, /:hover\{background:/);
  assert.match(css, /\[aria-current\],[^{]*\{position:relative/);
  assert.match(css, /width:3px/); // selected indicator
  // the dark variant of the icon rule is emitted separately
  assert.match(css, /body\[data-vftNebula\]\[data-ds-dark-theme\] \[data-vft-sb-item\] svg\{color:#B9AEDA\}/);
});

test("solid and custom surfaces paint, wallpaper surface does not", () => {
  const solid = sidebarCss(resolveSidebar(theme({ sidebar: { pack: "obsidian" } })), "vftNebula");
  assert.match(solid, /background:var\(--dsw-specific-sidebar-fill\)/);
  assert.doesNotMatch(solid, /backdrop-filter/);

  const custom = sidebarCss(resolveSidebar(theme({
    sidebar: { surface: "custom", background: { light: "rgba(1,2,3,0.3)", dark: "rgba(4,5,6,0.4)" } },
  })), "vftNebula");
  assert.match(custom, /background:rgba\(1,2,3,0\.3\)/);
  assert.match(custom, /\[data-ds-dark-theme\] \[class\*="_sidebarCol"\]\{background:rgba\(4,5,6,0\.4\)\}/);

  const wallpaper = sidebarCss(resolveSidebar(theme({ sidebar: { pack: "hairline" } })), "vftNebula");
  assert.doesNotMatch(wallpaper, /backdrop-filter/);
  assert.match(wallpaper, /border-radius:0px/);
});

test("dividers are emitted only when declared", () => {
  const plain = sidebarCss(resolveSidebar(theme({})), "vftNebula");
  assert.doesNotMatch(plain, /border-bottom/);
  const ruled = sidebarCss(resolveSidebar(theme({ sidebar: { divider: { color: "rgba(0,0,0,0.08)" } } })), "vftNebula");
  assert.match(ruled, /border-bottom:1px solid rgba\(0,0,0,0\.08\)/);
});

test("the resolved pack reaches the projection and survives validation", () => {
  const t = theme({ sidebar: { pack: "neon" } });
  const project = createProjection(tableFromTheme(t, "web"));
  const effects = normalizeEffects(project({ wallpaper: null, slogan: { zh: "", en: "" }, panelOpacity: 45 }, {}));
  assert.equal(effects.sidebar.pack, "neon");
  assert.equal(effects.sidebar.surface, "frost");
  assert.ok(effects.sidebar.blur >= 18);
});

test("a skin without a sidebar spec projects null and writes no sidebar CSS", () => {
  // compiled-in skins never pass table.sidebar
  const project = createProjection({
    bodyAttribute: "officialX", anchor: 55,
    riding: { "--dsw-alias-bg-base": { light: ["1, 1, 1", 55], dark: ["2, 2, 2", 55] } },
    constantTokens: null,
    scrim: { kind: "baked-gradient", stops: { light: [["1, 1, 1", 55], ["1, 1, 1", 55]], dark: [["2, 2, 2", 55], ["2, 2, 2", 55]] }, artLayer: "" },
    blur: { max: 12 }, glassVar: "--x", desktopBlur: { rate: 55, dark: "boost" },
    wallpaper: { kind: "assets" }, staticCss: "",
  });
  const effects = normalizeEffects(project({ wallpaper: null, slogan: { zh: "", en: "" }, panelOpacity: 55 }, {}));
  assert.equal(effects.sidebar, null);
});