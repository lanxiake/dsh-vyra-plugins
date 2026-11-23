import test from "node:test";
import assert from "node:assert/strict";
import {
  builtinAssetsFromTheme,
  fieldsFromTheme,
  normalizeTheme,
  tableFromTheme,
  THEME_ASSET_BASE,
} from "../src/shared/personalization/theme-model.js";
import { createProjection } from "../src/client/skins/translucency.js";
import { normalizeEffects } from "../src/client/personalization/projector.js";

function raw(extra = {}) {
  return {
    schema: 1,
    id: "nebula",
    name: { zh: "星云", en: "Nebula" },
    colors: {
      light: { "--dsw-alias-bg-base": "#F4F2FF" },
      dark: { "--dsw-alias-bg-base": "#0E0B1A" },
    },
    ...extra,
  };
}

function ok(extra) {
  const result = normalizeTheme(raw(extra));
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  return result.theme;
}

test("a static wallpaper pair becomes one builtin asset carrying both sides", () => {
  const theme = ok({
    wallpaper: {
      kind: "image",
      light: { src: "assets/light.webp" },
      dark: { src: "assets/dark.webp" },
    },
  });
  const assets = builtinAssetsFromTheme(theme);
  assert.deepEqual(Object.keys(assets), ["art"]);
  assert.equal(assets.art.url, `${THEME_ASSET_BASE}/nebula/assets/light.webp`);
  assert.equal(assets.art.mime, "image/webp");
  assert.equal(assets.art.darkUrl, `${THEME_ASSET_BASE}/nebula/assets/dark.webp`);
  assert.equal(assets.art.darkMime, "image/webp");
});

test("a light-only wallpaper has no dark override", () => {
  const theme = ok({ wallpaper: { kind: "image", light: { src: "assets/only.png" } } });
  const assets = builtinAssetsFromTheme(theme);
  assert.equal(assets.art.mime, "image/png");
  assert.equal(assets.art.darkUrl, undefined);
});

test("the wallpaper field defaults to the theme's own art", () => {
  const theme = ok({ wallpaper: { kind: "image", light: { src: "assets/light.webp" } } });
  const field = fieldsFromTheme(theme, "web").find((candidate) => candidate.key === "wallpaper");
  assert.equal(field.default, "builtin:nebula:art");
  assert.deepEqual(field.builtinChoices, ["art"]);
});

test("a theme without a wallpaper has no art default", () => {
  const theme = ok({});
  const field = fieldsFromTheme(theme, "web").find((candidate) => candidate.key === "wallpaper");
  assert.equal(field.default, null);
  assert.deepEqual(field.builtinChoices, []);
  assert.deepEqual(builtinAssetsFromTheme(theme), {});
});

test("animated wallpapers accept gif and webp only", () => {
  const gif = normalizeTheme(raw({ wallpaper: { kind: "animated", light: { src: "assets/a.gif" } } }));
  assert.equal(gif.ok, true, JSON.stringify(gif.issues));
  const png = normalizeTheme(raw({ wallpaper: { kind: "animated", light: { src: "assets/a.png" } } }));
  assert.ok(png.issues.some((issue) => issue.code === "bad-wallpaper"));
});

test("video and code channels are still rejected with a clear code", () => {
  for (const kind of ["video", "code"]) {
    const result = normalizeTheme(raw({ wallpaper: { kind } }));
    assert.ok(result.issues.some((issue) => issue.code === "unsupported-wallpaper-kind"), kind);
  }
});

test("a served dark asset reaches the projected dark backdrop", () => {
  const theme = ok({
    wallpaper: {
      kind: "image",
      light: { src: "assets/light.webp" },
      dark: { src: "assets/dark.webp" },
    },
  });
  const project = createProjection(tableFromTheme(theme, "web"));
  // the projector hands the chosen ref's asset as `assets.wallpaper`
  const effects = normalizeEffects(project({
    wallpaper: "builtin:nebula:art",
    slogan: { zh: "", en: "" },
    panelOpacity: 45,
  }, { wallpaper: builtinAssetsFromTheme(theme).art }));
  assert.match(effects.backdrop.imageLight, /assets\/light\.webp/);
  assert.match(effects.backdrop.imageDark, /assets\/dark\.webp/);
});

test("coverage travels from theme.json through projection", () => {
  const theme = ok({ coverage: { shell: true, scopes: ["sidebar", "topbar"] } });
  const project = createProjection(tableFromTheme(theme, "web"));
  const off = normalizeEffects(project({ wallpaper: null, slogan: { zh: "", en: "" }, panelOpacity: 45 }, {}));
  assert.deepEqual(off.coverage, { shell: true, scopes: ["sidebar", "topbar"] });
  const plain = normalizeTheme(raw());
  const plainProject = createProjection(tableFromTheme(plain.theme, "web"));
  const on = normalizeEffects(plainProject({ wallpaper: null, slogan: { zh: "", en: "" }, panelOpacity: 45 }, {}));
  assert.deepEqual(on.coverage, { shell: false, scopes: ["sidebar"] });
});