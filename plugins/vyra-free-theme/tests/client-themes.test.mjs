import test from "node:test";
import assert from "node:assert/strict";
import { installFileThemes } from "../src/client/themes.js";
import { getSkinSchema, listExternalSkinIds, unregisterExternalSkin } from "../src/shared/personalization/catalog.js";
import { normalizeTheme } from "../src/shared/personalization/theme-model.js";
import { normalizeEffects } from "../src/client/personalization/projector.js";

const jsx = (type, props, ...children) => ({ type, props, children });

function runtime() {
  const skins = new Map();
  return {
    register(skin) {
      if (skins.has(skin.id)) throw new Error(`duplicate skin ${skin.id}`);
      skins.set(skin.id, skin);
    },
    list: () => [...skins.values()].map((skin) => ({ id: skin.id, label: skin.label, description: skin.description })),
    skins,
  };
}

function catalog(themes, problems = []) {
  return async () => ({ ok: true, json: async () => ({ themes, problems }) });
}

function themeRaw(id) {
  return {
    schema: 1,
    id,
    name: { zh: `主题${id}`, en: `Theme ${id}` },
    colors: {
      light: { "--dsw-alias-bg-base": "#F7F5F2" },
      dark: { "--dsw-alias-bg-base": "#101016" },
    },
    translucency: { web: 45 },
  };
}

function entry(id) {
  const result = normalizeTheme(themeRaw(id));
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  return { source: "builtin", theme: result.theme };
}

test("a served theme becomes a registered skin that projects effects", async () => {
  const fake = runtime();
  try {
    const { installed, problems } = await installFileThemes({
      runtime: fake, jsx, profile: "web", fetchImpl: catalog([entry("nebula")]),
    });
    assert.deepEqual(installed, ["nebula"]);
    assert.deepEqual(problems, []);
    assert.ok(listExternalSkinIds().includes("nebula"));
    assert.equal(getSkinSchema("nebula").fields.length, 3);

    const skin = fake.skins.get("nebula");
    const effects = normalizeEffects(skin.project(
      { wallpaper: null, slogan: { zh: "", en: "" }, panelOpacity: 45 },
      {},
    ));
    assert.equal(effects.bodyAttribute, "vftNebula");
    // the brand seat replaces the product wordmark with the theme's own name
    assert.equal(effects.titleBrand, "主题nebula");
    assert.equal(typeof skin.Mark, "function");
    assert.equal(typeof skin.Name, "function");
    assert.equal(skin.Name().children[0], "主题nebula");
  } finally {
    unregisterExternalSkin("nebula");
  }
});

test("an already registered id is reported installed but not re-registered", async () => {
  const fake = runtime();
  fake.register({ id: "nebula", label: {}, description: {}, Mark: null, Name: null, project: null, builtinAssets: {} });
  try {
    const { installed } = await installFileThemes({
      runtime: fake, jsx, profile: "web", fetchImpl: catalog([entry("nebula")]),
    });
    assert.deepEqual(installed, ["nebula"]);
    assert.equal(fake.skins.size, 1);
  } finally {
    unregisterExternalSkin("nebula");
  }
});

test("one bad theme does not stop the others and is reported", async () => {
  const fake = runtime();
  try {
    const { installed, problems } = await installFileThemes({
      runtime: fake, jsx, profile: "web",
      // "openbmc" collides with a compiled-in skin, so registration throws
      fetchImpl: catalog([entry("openbmc"), entry("nebula")]),
    });
    assert.deepEqual(installed, ["nebula"]);
    assert.equal(problems.length, 1);
    assert.equal(problems[0].id, "openbmc");
    assert.equal(problems[0].issues[0].code, "register-failed");
  } finally {
    unregisterExternalSkin("nebula");
  }
});

test("an unreachable catalog rejects instead of silently installing nothing", async () => {
  const fake = runtime();
  await assert.rejects(
    () => installFileThemes({ runtime: fake, jsx, profile: "web", fetchImpl: async () => ({ ok: false, status: 500 }) }),
    /HTTP 500/,
  );
});
