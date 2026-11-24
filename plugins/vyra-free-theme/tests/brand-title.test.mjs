import test from "node:test";
import assert from "node:assert/strict";
import { fieldsFromTheme, normalizeTheme, tableFromTheme } from "../src/shared/personalization/theme-model.js";
import { createProjection } from "../src/client/skins/translucency.js";
import { normalizeEffects } from "../src/client/personalization/projector.js";

function theme(extra = {}) {
  const result = normalizeTheme({
    schema: 1,
    id: "dawn",
    name: { zh: "晨光", en: "Dawn" },
    brand: { title: { zh: "晨光工作台", en: "Dawn Desk" } },
    colors: {
      light: {
        "--dsw-alias-bg-base": "#FBF8F2",
        "--dsw-alias-label-primary": "#2E2A26",
      },
      dark: {
        "--dsw-alias-bg-base": "#14110E",
        "--dsw-alias-label-primary": "#F2EDE4",
      },
    },
    ...extra,
  });
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  return result.theme;
}

/** Run a theme + override set through the same kernel the client uses. */
function project(t, overrides = {}) {
  const values = {
    wallpaper: null,
    slogan: t.brand.slogans,
    panelOpacity: t.translucency.web,
    ...overrides,
  };
  const effects = createProjection(tableFromTheme(t, "web"))(values, {});
  return normalizeEffects(effects);
}

function brandField(t) {
  return fieldsFromTheme(t).find((field) => field.key === "brandTitle");
}

/* ---------------------------------------------------------------- */
/* the field exists and is editable                                  */
/* ---------------------------------------------------------------- */

test("a theme-backed skin exposes an editable brand name", () => {
  const t = theme();
  const field = brandField(t);
  assert.ok(field, "brandTitle field must be in the catalog");
  assert.equal(field.type, "text");
  /* `locale` is what makes the panel render a zh/en input pair. */
  assert.equal(field.scope, "locale");
  assert.equal(field.labelKey, "personalization.brandTitle");
  assert.ok(field.maxLength > 0);
});

test("the field defaults to the theme's own brand, then to its name", () => {
  assert.deepEqual(brandField(theme()).default, { zh: "晨光工作台", en: "Dawn Desk" });

  /* A theme that declares no brand.title falls back to name, so clearing the
     input lands on something meaningful rather than an empty title. */
  const bare = normalizeTheme({
    schema: 1,
    id: "bare",
    name: { zh: "素白", en: "Bare" },
    colors: { light: { "--dsw-alias-bg-base": "#FFFFFF" }, dark: { "--dsw-alias-bg-base": "#000000" } },
  });
  assert.equal(bare.ok, true);
  assert.deepEqual(brandField(bare.theme).default, { zh: "素白", en: "Bare" });
});

/* ---------------------------------------------------------------- */
/* the override actually reaches the projection                      */
/* ---------------------------------------------------------------- */

test("without an override the projected brand is the theme's", () => {
  assert.equal(project(theme()).titleBrand, "晨光工作台");
});

test("a user override replaces the projected brand", () => {
  const effects = project(theme(), { brandTitle: { zh: "我的工作台", en: "My Desk" } });
  assert.equal(effects.titleBrand, "我的工作台");
});

test("a blank locale falls back rather than emptying the title", () => {
  const t = theme();
  /* zh cleared, en set: the set side wins. */
  assert.equal(project(t, { brandTitle: { zh: "", en: "My Desk" } }).titleBrand, "My Desk");
  /* both cleared: back to the theme's own name, never "". */
  assert.equal(project(t, { brandTitle: { zh: "", en: "" } }).titleBrand, "晨光工作台");
});

test("a malformed override cannot break the projection", () => {
  for (const bad of [undefined, null, "", 42, [], { zh: "x" }]) {
    const effects = project(theme(), { brandTitle: bad });
    assert.equal(typeof effects.titleBrand, "string");
    assert.ok(effects.titleBrand.length > 0, `brand went empty for ${JSON.stringify(bad)}`);
  }
});

/* ---------------------------------------------------------------- */
/* field ordering and the surrounding contract                       */
/* ---------------------------------------------------------------- */

test("the brand row sits above the slogan, both before opacity", () => {
  const keys = fieldsFromTheme(theme()).map((field) => field.key);
  assert.deepEqual(keys, ["wallpaper", "brandTitle", "slogan", "panelOpacity"]);
});

test("the field is scoped to the theme's own profile", () => {
  const t = theme();
  /* Opacity differs by profile; the brand field must be identical across them
     so a desktop user and a web user edit the same value. */
  const web = fieldsFromTheme(t, "web").find((f) => f.key === "brandTitle");
  const desktop = fieldsFromTheme(t, "desktop").find((f) => f.key === "brandTitle");
  assert.deepEqual(web, desktop);
});