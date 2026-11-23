import test from "node:test";
import assert from "node:assert/strict";
import { buildCodeArtDocument, CODE_ART_LIMITS, inlineArtSource } from "../src/client/wallpaper-art.js";

test("export forms are rewritten into a window.art binding", () => {
  assert.equal(
    inlineArtSource("export const art = { mount() {} };"),
    "const art = { mount() {} };\n;window.art = typeof art !== \"undefined\" ? art : window.art;",
  );
  assert.match(inlineArtSource("export function art(canvas) {}"), /^function art\(canvas\)/);
  assert.match(inlineArtSource("export default { mount() {} };"), /^window\.art = /);
});

test("a literal closing script tag cannot break out of the host script", () => {
  const source = 'export const art = { html: "</script><script>alert(1)</script>" };';
  const document = buildCodeArtDocument({ source, mode: "light", reducedMotion: false });
  const opening = document.indexOf("<script>");
  const closing = document.indexOf("</script>", opening + 1);
  // the escaped source must not introduce an earlier terminator
  assert.ok(closing > document.indexOf("const art"));
  assert.ok(!document.slice(0, closing).includes("</script><script>alert(1)"));
});

test("the document locks the sandbox down to inline scripts and data images", () => {
  const document = buildCodeArtDocument({ source: "export const art = {};", mode: "dark", reducedMotion: true });
  assert.match(document, /Content-Security-Policy/);
  assert.match(document, /default-src 'none'/);
  assert.match(document, /script-src 'unsafe-inline'/);
  assert.match(document, /img-src data: blob:/);
  assert.match(document, /mode: "dark"/);
  assert.match(document, /var reduced = true;/);
  assert.match(document, /id="vft-art"/);
  assert.match(document, /parent\.postMessage\(\{ vft: "ready" \}/);
  assert.match(document, /postMessage\(\{ vft: "error"/);
});

test("the art contract is enforced inside the frame", () => {
  const document = buildCodeArtDocument({ source: "export const art = {};", mode: "light", reducedMotion: false });
  assert.match(document, /typeof window\.art\.mount !== "function"/);
  assert.match(document, /art\.mount\(canvas, env\)/);
  assert.equal(CODE_ART_LIMITS.maxSourceBytes, 256 * 1024);
  assert.equal(CODE_ART_LIMITS.firstFrameTimeoutMs, 2000);
});

test("only light and dark are accepted as modes", () => {
  const document = buildCodeArtDocument({ source: "export const art = {};", mode: "neon", reducedMotion: false });
  assert.match(document, /mode: "light"/);
});