import test from "node:test";
import assert from "node:assert/strict";
import {
  BOOT_KINDS,
  BOOT_LIMITS,
  normalizeBoot,
  shouldPlayBoot,
  storyTimeline,
} from "./boot-model.js";

const story = (extra = {}) => ({
  kind: "story",
  beats: [
    { title: { zh: "开始", en: "Begin" } },
  ],
  ...extra,
});

function codes(result) {
  return result.issues.map((issue) => issue.code);
}

/* ---------------------------------------------------------------- */
/* shape                                                             */
/* ---------------------------------------------------------------- */

test("a theme without a boot block is valid and boots straight to the app", () => {
  const result = normalizeBoot(undefined);
  assert.equal(result.ok, true);
  assert.equal(result.boot, null);
  assert.equal(normalizeBoot(null).boot, null);
});

test("every declared kind is accepted", () => {
  assert.deepEqual([...BOOT_KINDS], ["story", "image", "video", "animated", "code"]);
});

test("a story beat fills in the default hold", () => {
  const { ok, boot } = normalizeBoot(story());
  assert.equal(ok, true);
  assert.equal(boot.kind, "story");
  assert.equal(boot.beats[0].holdMs, 1800);
  assert.equal(boot.beats[0].kicker, null);
});

test("a hold is clamped into the readable band", () => {
  const low = normalizeBoot(story({ beats: [{ title: { zh: "甲", en: "A" }, holdMs: 10 }] }));
  assert.equal(low.boot.beats[0].holdMs, BOOT_LIMITS.minBeatMs);

  const high = normalizeBoot(story({ beats: [{ title: { zh: "甲", en: "A" }, holdMs: 99_999 }] }));
  assert.equal(high.boot.beats[0].holdMs, BOOT_LIMITS.maxBeatMs);
});

test("the total of a story is clamped to the budget", () => {
  const beats = Array.from({ length: 5 }, () => ({
    title: { zh: "甲", en: "A" },
    holdMs: BOOT_LIMITS.maxBeatMs,
  }));
  const { boot } = normalizeBoot(story({ beats }));
  assert.ok(boot.totalMs <= BOOT_LIMITS.maxDurationMs, `totalMs ${boot.totalMs}`);
});

/* ---------------------------------------------------------------- */
/* rejection                                                         */
/* ---------------------------------------------------------------- */

test("malformed boot blocks are rejected with a stable code", () => {
  const cases = [
    ["bad-boot", "nope"],
    ["bad-boot", story().beats && 42],
    ["bad-boot-kind", story({ kind: "hologram" })],
    ["bad-boot", story({ beats: [] })],
    ["too-many-beats", story({ beats: Array.from({ length: 6 }, () => ({ title: { zh: "甲", en: "A" } })) })],
    ["bad-beat", story({ beats: [{ kicker: { zh: "甲", en: "A" } }] })],
    ["bad-boot", story({ theme: "neon" })],
  ];
  for (const [code, raw] of cases) {
    const result = normalizeBoot(raw);
    assert.equal(result.ok, false, JSON.stringify(raw));
    assert.ok(codes(result).includes(code), `${code} not in ${codes(result)}`);
  }
});

test("a media kind rejects a source that is the wrong format or missing", () => {
  assert.ok(codes(normalizeBoot({ kind: "video", src: "poster.png" })).includes("bad-boot"));
  assert.ok(codes(normalizeBoot({ kind: "image", src: "clip.mp4" })).includes("bad-boot"));
  assert.ok(codes(normalizeBoot({ kind: "code", entry: "art.css" })).includes("bad-boot"));
  assert.ok(codes(normalizeBoot({ kind: "image" })).includes("bad-boot"));
});

test("a declared asset that the theme does not ship is caught at load", () => {
  const result = normalizeBoot(
    { kind: "image", src: "assets/missing.webp" },
    { assetExists: () => false },
  );
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes("missing-boot-asset"));
});

/* ---------------------------------------------------------------- */
/* launch policy                                                     */
/* ---------------------------------------------------------------- */

test("the sequence plays once, then never again by default", () => {
  const { boot } = normalizeBoot(story());
  assert.equal(shouldPlayBoot({ boot, seen: false }).play, true);
  assert.equal(shouldPlayBoot({ boot, seen: true }).reason, "already-seen");
});

test("deep links, a disabled theme and a missing block all skip", () => {
  const { boot } = normalizeBoot(story());
  assert.equal(shouldPlayBoot({ boot, seen: false, deepLink: true }).reason, "deep-link");
  assert.equal(shouldPlayBoot({ boot, seen: false, enabled: false }).reason, "disabled");
  assert.equal(shouldPlayBoot({ boot: null, seen: false }).reason, "no-boot");
});

test("reduced motion still plays, but is reported as such", () => {
  const { boot } = normalizeBoot(story());
  const verdict = shouldPlayBoot({ boot, seen: false, reducedMotion: true });
  assert.equal(verdict.play, true);
  assert.equal(verdict.reason, "reduced-motion");
});

/* ---------------------------------------------------------------- */
/* timeline                                                          */
/* ---------------------------------------------------------------- */

test("a timeline lays beats end to end and ends with the fade", () => {
  const { boot } = normalizeBoot(story({
    fadeMs: 400,
    beats: [
      { title: { zh: "甲", en: "A" }, holdMs: 1000 },
      { title: { zh: "乙", en: "B" }, holdMs: 1200 },
    ],
  }));
  const steps = storyTimeline(boot);
  assert.deepEqual(steps.map((step) => step.kind), ["beat", "beat", "end"]);
  assert.deepEqual(steps.map((step) => step.atMs), [0, 1000, 2200]);
  assert.equal(steps[2].holdMs, 400);
});

test("under reduced motion every beat holds for the same short beat", () => {
  const { boot } = normalizeBoot(story({
    beats: [
      { title: { zh: "甲", en: "A" }, holdMs: 3000 },
      { title: { zh: "乙", en: "B" }, holdMs: 2000 },
    ],
  }));
  const steps = storyTimeline(boot, { reducedMotion: true }).filter((step) => step.kind === "beat");
  assert.deepEqual(steps.map((step) => step.holdMs), [900, 900]);
});

test("a non-story boot has no timeline", () => {
  const { boot } = normalizeBoot({ kind: "video", src: "a.mp4" });
  assert.deepEqual(storyTimeline(boot), []);
});