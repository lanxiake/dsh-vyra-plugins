import test from "node:test";
import assert from "node:assert/strict";
import {
  getExternalSkin,
  getField,
  getSkinSchema,
  listAssetFields,
  listExternalSkinIds,
  mergeValues,
  registerExternalSkin,
  unregisterExternalSkin,
  validateOverride,
} from "../src/shared/personalization/catalog.js";
import { fieldsFromTheme, normalizeTheme } from "../src/shared/personalization/theme-model.js";

function externalFields() {
  const { theme } = normalizeTheme({
    schema: 1,
    id: "nebula",
    name: { zh: "星云", en: "Nebula" },
    colors: {
      light: { "--dsw-alias-bg-base": "#F7F5F2" },
      dark: { "--dsw-alias-bg-base": "#101016" },
    },
    translucency: { web: 40, desktop: 70 },
  });
  return fieldsFromTheme(theme, "web");
}

test("a registered external skin is a first-class catalog entry", () => {
  registerExternalSkin({ id: "nebula", fields: externalFields(), builtinAssets: {} });
  try {
    const schema = getSkinSchema("nebula");
    assert.deepEqual(schema.fields.map((field) => field.key), ["wallpaper", "slogan", "panelOpacity"]);
    assert.equal(getField("nebula", "panelOpacity").default, 40);
    assert.equal(listAssetFields("nebula").length, 1);
    assert.deepEqual(listExternalSkinIds(), ["nebula"]);
    assert.ok(getExternalSkin("nebula"));
  } finally {
    unregisterExternalSkin("nebula");
  }
  assert.equal(getSkinSchema("nebula"), null);
});

test("overrides of an external skin validate through the same rules", () => {
  registerExternalSkin({ id: "nebula", fields: externalFields(), builtinAssets: {} });
  try {
    assert.equal(validateOverride("nebula", "panelOpacity", 40).ok, true);
    assert.equal(validateOverride("nebula", "panelOpacity", 101).ok, false);
    assert.equal(validateOverride("nebula", "slogan", { zh: "星云", en: "Nebula" }).ok, true);
    assert.equal(validateOverride("nebula", "slogan", { zh: "星云" }).ok, false);
    assert.equal(validateOverride("nebula", "nope", 1).ok, false);
    // a user-asset ref is structurally acceptable; the Host checks existence
    const ref = `u_${"a".repeat(32)}`;
    assert.equal(validateOverride("nebula", "wallpaper", ref).ok, true);
    assert.equal(validateOverride("nebula", "wallpaper", "builtin:other:art").ok, false);
  } finally {
    unregisterExternalSkin("nebula");
  }
});

test("mergeValues falls back to the theme defaults and reports bad overrides", () => {
  registerExternalSkin({ id: "nebula", fields: externalFields(), builtinAssets: {} });
  try {
    const ok = mergeValues("nebula", { panelOpacity: 20 });
    assert.equal(ok.values.panelOpacity, 20);
    assert.deepEqual(ok.issues, []);
    const bad = mergeValues("nebula", { panelOpacity: 999 });
    assert.equal(bad.values.panelOpacity, 40);
    assert.deepEqual(bad.issues, [{ key: "panelOpacity", code: "BAD_VALUE" }]);
  } finally {
    unregisterExternalSkin("nebula");
  }
});

test("an external id cannot shadow a compiled-in skin", () => {
  assert.throws(
    () => registerExternalSkin({ id: "openbmc", fields: externalFields() }),
    /collides with a compiled-in skin/,
  );
});

test("malformed external registrations are rejected", () => {
  assert.throws(() => registerExternalSkin({ id: "Bad Id", fields: externalFields() }), /malformed/);
  assert.throws(() => registerExternalSkin({ id: "empty-one", fields: [] }), /at least one field/);
});
