import test from "node:test";
import assert from "node:assert/strict";
import {
  bodyAttributeFor,
  fieldsFromTheme,
  normalizeTheme,
  tableFromTheme,
} from "../src/shared/personalization/theme-model.js";
import { createProjection } from "../src/client/skins/translucency.js";
import { normalizeEffects } from "../src/client/personalization/projector.js";

function baseTheme(overrides = {}) {
  return {
    schema: 1,
    id: "nebula",
    name: { zh: "星云", en: "Nebula" },
    colors: {
      light: {
        "--dsw-alias-bg-base": "#F7F5F2",
        "--dsw-alias-bg-layer-1": "#FFFFFF",
        "--dsw-alias-brand-primary": "#5B3FD9",
      },
      dark: {
        "--dsw-alias-bg-base": "#101016",
        "--dsw-alias-bg-layer-1": "#181820",
        "--dsw-alias-brand-primary": "#9B8CFF",
      },
    },
    ...overrides,
  };
}

function codes(result) {
  return result.issues.map((issue) => issue.code);
}

test("a minimal theme normalizes with v1 defaults", () => {
  const result = normalizeTheme(baseTheme());
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  const { theme } = result;
  assert.deepEqual(theme.translucency, { web: 55, desktop: 66, baked: {} });
  assert.deepEqual(theme.coverage, { shell: false, scopes: ["sidebar"] });
  assert.equal(theme.wallpaper, null);
  assert.deepEqual(theme.brand.slogans, { zh: "", en: "" });
  assert.equal(theme.brand.title, null);
});

test("schema, id and name are validated", () => {
  assert.ok(codes(normalizeTheme(baseTheme({ schema: 2 }))).includes("schema-version"));
  assert.ok(codes(normalizeTheme(baseTheme({ id: "Nebula!" }))).includes("bad-id"));
  assert.ok(codes(normalizeTheme(baseTheme({ name: { zh: "星云" } }))).includes("bad-name"));
});

test("light and dark must declare the same token set", () => {
  const raw = baseTheme();
  delete raw.colors.dark["--dsw-alias-brand-primary"];
  assert.ok(codes(normalizeTheme(raw)).includes("color-token-mismatch"));
});

test("translucent tokens must be hex so alpha can be derived", () => {
  const raw = baseTheme();
  raw.colors.light["--dsw-alias-bg-base"] = "rgba(247, 245, 242, 0.9)";
  assert.ok(codes(normalizeTheme(raw)).includes("bad-translucent-color"));
});

test("--dsw-alias-bg-base is required", () => {
  const raw = baseTheme();
  delete raw.colors.light["--dsw-alias-bg-base"];
  delete raw.colors.dark["--dsw-alias-bg-base"];
  assert.ok(codes(normalizeTheme(raw)).includes("missing-bg-base"));
});

test("unknown top-level keys and unsupported wallpaper kinds are rejected", () => {
  assert.ok(codes(normalizeTheme(baseTheme({ surprise: 1 }))).includes("unknown-key"));
  assert.ok(codes(normalizeTheme(baseTheme({ wallpaper: { kind: "nonsense" } }))).includes("unsupported-wallpaper-kind"));
  // video is a valid kind since P2, but a side is mandatory
  assert.ok(codes(normalizeTheme(baseTheme({ wallpaper: { kind: "video" } }))).includes("bad-wallpaper"));
});

test("wallpaper image kind is accepted and carried through", () => {
  const result = normalizeTheme(baseTheme({
    wallpaper: {
      kind: "image",
      light: { src: "assets/light.webp", overlay: "rgba(0,0,0,0.1)" },
    },
  }));
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  assert.equal(result.theme.wallpaper.kind, "image");
  assert.equal(result.theme.wallpaper.light.src, "assets/light.webp");
  assert.equal(result.theme.wallpaper.dark, null);
});

test("body attribute is a valid dataset key derived from the id", () => {
  assert.equal(bodyAttributeFor("nebula"), "vftNebula");
  assert.equal(bodyAttributeFor("ink-landscape"), "vftInkLandscape");
  assert.match(bodyAttributeFor("ink-landscape"), /^[a-zA-Z][a-zA-Z0-9]*$/);
});

test("fields mirror the compiled-in field catalog", () => {
  const { theme } = normalizeTheme(baseTheme({
    translucency: { web: 40, desktop: 70 },
    brand: { slogans: { zh: "于无声处", en: "Where silence speaks" } },
  }));
  const web = fieldsFromTheme(theme, "web");
  assert.deepEqual(web.map((field) => field.key), ["wallpaper", "slogan", "panelOpacity"]);
  assert.deepEqual(web.find((f) => f.key === "slogan").default, { zh: "于无声处", en: "Where silence speaks" });
  assert.equal(web.find((f) => f.key === "panelOpacity").default, 40);
  assert.equal(fieldsFromTheme(theme, "desktop").find((f) => f.key === "panelOpacity").default, 70);
});

test("the theme table projects into a valid SkinEffects draft", () => {
  const { theme } = normalizeTheme(baseTheme());
  const project = createProjection(tableFromTheme(theme, "web"));
  const values = {
    wallpaper: null,
    slogan: { zh: "星云", en: "Nebula" },
    panelOpacity: 55,
  };
  const effects = normalizeEffects(project(values, {}));
  assert.notEqual(effects, null);
  assert.equal(effects.bodyAttribute, "vftNebula");
  assert.equal(effects.titleBrand, "星云");
  // at the anchor the riding alpha is the slider value itself (55%)
  assert.equal(effects.tokenOverrides["--dsw-alias-bg-base"].light, "rgba(247, 245, 242, 0.55)");
  assert.equal(effects.tokenOverrides["--dsw-alias-bg-base"].dark, "rgba(16, 16, 22, 0.55)");
  // non-translucent colours stay constant pairs
  assert.deepEqual(effects.tokenOverrides["--dsw-alias-brand-primary"], { light: "#5B3FD9", dark: "#9B8CFF" });
  // no wallpaper asset yet �?the base-tone scrim gradient
  assert.match(effects.backdrop.imageLight, /^linear-gradient\(/);
});

test("panel opacity drives alpha and blur", () => {
  const { theme } = normalizeTheme(baseTheme());
  const project = createProjection(tableFromTheme(theme, "web"));
  const low = normalizeEffects(project({ wallpaper: null, slogan: { zh: "", en: "" }, panelOpacity: 0 }, {}));
  const high = normalizeEffects(project({ wallpaper: null, slogan: { zh: "", en: "" }, panelOpacity: 100 }, {}));
  assert.equal(low.tokenOverrides["--dsw-alias-bg-base"].light, "rgba(247, 245, 242, 0.00)");
  assert.equal(high.tokenOverrides["--dsw-alias-bg-base"].light, "rgba(247, 245, 242, 1.00)");
  assert.equal(low.backdrop.blur, 0);
  assert.ok(high.backdrop.blur > 0);
  // base-tone gradient alpha follows the slider: 0 at P=0, opaque at P=100
  assert.match(low.backdrop.imageLight, /rgba\(247, 245, 242, 0\.00\)/);
  assert.match(high.backdrop.imageLight, /rgba\(247, 245, 242, 1\.00\)/);
  assert.equal(low.backdrop.overlayLight, null);
});

test("a video wallpaper may not keep an image side", () => {
  // This is what the CLI used to produce when only one side was regenerated:
  // kind: "video" plus a leftover .png side, which the model rejects.
  const theme = {
    schema: 1,
    id: "mixed",
    name: { zh: "混合", en: "Mixed" },
    colors: { light: { "--dsw-alias-bg-base": "#FFFFFF" }, dark: { "--dsw-alias-bg-base": "#111111" } },
    wallpaper: {
      kind: "video",
      light: { src: "assets/a.png" },
      dark: { src: "assets/b.mp4", poster: "assets/b.png" },
    },
  };
  const result = normalizeTheme(theme);
  assert.ok(result.issues.some((issue) => issue.message.includes(".mp4")), JSON.stringify(result.issues));
});
