import test from "node:test";
import assert from "node:assert/strict";
import {
  builtinAssetsFromTheme,
  fieldsFromTheme,
  normalizeTheme,
  tableFromTheme,
  wallpaperLayersFromTheme,
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

test("video wallpapers accept mp4/webm with an optional poster", () => {
  const theme = ok({
    wallpaper: {
      kind: "video",
      light: { src: "assets/light.mp4", poster: "assets/light.webp" },
      dark: { src: "assets/dark.webm" },
    },
  });
  assert.equal(theme.wallpaper.kind, "video");
  const bad = normalizeTheme(raw({ wallpaper: { kind: "video", light: { src: "assets/clip.avi" } } }));
  assert.ok(bad.issues.some((issue) => issue.code === "bad-wallpaper"));
  const badPoster = normalizeTheme(raw({
    wallpaper: { kind: "video", light: { src: "assets/clip.mp4", poster: "assets/p.mp4" } },
  }));
  assert.ok(badPoster.issues.some((issue) => issue.code === "bad-wallpaper"));
});

test("code wallpapers require a .js entry inside the theme", () => {
  const theme = ok({ wallpaper: { kind: "code", entry: "art.js" } });
  assert.equal(theme.wallpaper.kind, "code");
  assert.ok(normalizeTheme(raw({ wallpaper: { kind: "code", entry: "art.mjs" } }))
    .issues.some((issue) => issue.code === "bad-wallpaper"));
});

test("element layers are emitted for video and code, and suppressed by an image choice", () => {
  const video = ok({ wallpaper: { kind: "video", light: { src: "assets/loop.mp4" } } });
  const videoLayers = wallpaperLayersFromTheme(video);
  assert.equal(videoLayers.length, 1);
  assert.equal(videoLayers[0].kind, "video");
  assert.equal(videoLayers[0].light.src, `${THEME_ASSET_BASE}/nebula/assets/loop.mp4`);
  assert.equal(videoLayers[0].dark, null);

  const project = createProjection(tableFromTheme(video, "web"));
  const withLayer = normalizeEffects(project({ wallpaper: null, slogan: { zh: "", en: "" }, panelOpacity: 45 }, {}));
  assert.equal(withLayer.backdrop.layers.length, 1);
  const replaced = normalizeEffects(project({
    wallpaper: `u_${"a".repeat(32)}`,
    slogan: { zh: "", en: "" },
    panelOpacity: 45,
  }, { wallpaper: { url: "/vyra-free-theme/assets/abc.webp", mime: "image/webp" } }));
  assert.equal(replaced.backdrop.layers, null);
  assert.match(replaced.backdrop.imageLight, /abc\.webp/);

  const code = ok({ wallpaper: { kind: "code", entry: "art.js" } });
  const codeLayers = wallpaperLayersFromTheme(code);
  assert.deepEqual(codeLayers, [{ kind: "code", entry: `${THEME_ASSET_BASE}/nebula/art.js` }]);
});

test("image and animated wallpapers emit no element layer", () => {
  const image = ok({ wallpaper: { kind: "image", light: { src: "assets/a.webp" } } });
  assert.deepEqual(wallpaperLayersFromTheme(image), []);
  const animated = ok({ wallpaper: { kind: "animated", light: { src: "assets/a.gif" } } });
  assert.deepEqual(wallpaperLayersFromTheme(animated), []);
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