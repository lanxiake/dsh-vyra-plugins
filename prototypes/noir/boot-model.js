/**
 * Boot sequence (splash) — the narrative layer for a theme.
 *
 * A boot sequence plays once, when the client starts, and then leaves for
 * good. That is the single most valuable slot in an interface for narrative
 * motion: it is rare, the user is already waiting, and nothing they are
 * doing can be interrupted. It is also the one place where a theme is
 * allowed to *tell* rather than *show*.
 *
 * Four media channels, the same ones a wallpaper already has, plus `story`:
 *
 *   image     a still; the sequence supplies the motion (scale, mask, type)
 *   video     an mp4/webm that owns the frame; the sequence only times it
 *   animated  a WebP/APNG/GIF loop with a fixed beat
 *   code      a theme-local `.js` entry, sandboxed exactly like code art
 *   story     no media at all: type and rules, the "case study" form
 *
 * The contract with the rest of the client:
 *   - `boot` is OPTIONAL. A theme without it boots straight to the app.
 *   - the sequence never blocks input beyond its own overlay
 *   - it is skippable from the first frame (any key, any click)
 *   - it honours `prefers-reduced-motion` by collapsing to a single hold
 *   - it can be disabled per theme and globally, and is skipped on every
 *     launch after the first unless the user asks to see it again
 *
 * @module vyra-free-theme/boot-model
 */

/** Media kinds a boot sequence accepts, mirroring wallpaper's four. */
export const BOOT_KINDS = Object.freeze(["story", "image", "video", "animated", "code"]);

/** Hard ceilings. A boot that runs long is worse than no boot at all. */
export const BOOT_LIMITS = Object.freeze({
  /** Total sequence budget, before the skip affordance is forced. */
  maxDurationMs: 6000,
  /** Per-beat minimum: below ~600ms a title reads as a flicker. */
  minBeatMs: 600,
  /** A story beat may hold longer than a media beat; this is the ceiling. */
  maxBeatMs: 3200,
  /** Beats beyond this are a film, not a boot. */
  maxBeats: 5,
});

const ID_PATTERN = /^[a-z][a-z0-9-]{1,39}$/;
const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const MAX_TEXT = 120;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function boundedText(value, max = MAX_TEXT) {
  return typeof value === "string" && value.length > 0 && value.length <= max && !CONTROL_CHARS.test(value);
}

/** `{ zh, en }` pair, the same shape every other localized field uses. */
function validLocalePair(value, max = MAX_TEXT) {
  return isPlainObject(value)
    && boundedText(value.zh, max)
    && boundedText(value.en, max);
}

function clampBeat(value) {
  if (!Number.isFinite(value)) return null;
  return Math.round(Math.min(Math.max(value, BOOT_LIMITS.minBeatMs), BOOT_LIMITS.maxBeatMs));
}

/**
 * Normalize + validate a theme's `boot` block.
 *
 * Returns `{ ok: true, boot }` or `{ ok: false, issues }`. A theme with an
 * invalid boot block is rejected as a whole, which matches how every other
 * block behaves: a theme either loads completely or not at all.
 */
export function normalizeBoot(raw, { assetExists } = {}) {
  const issues = [];
  const fail = (code, path, message) => issues.push({ code, path, message });

  if (raw === undefined || raw === null) return { ok: true, boot: null };
  if (!isPlainObject(raw)) {
    fail("bad-boot", "boot", "boot 必须是对象");
    return { ok: false, issues };
  }

  const kind = raw.kind;
  if (!BOOT_KINDS.includes(kind)) {
    fail("bad-boot-kind", "boot.kind", `kind 必须是 ${BOOT_KINDS.join(" / ")}`);
  }

  /* --- media source ------------------------------------------------- */
  let media = null;
  if (kind === "image" || kind === "animated") {
    if (!boundedText(raw.src, 256)) {
      fail("bad-boot", "boot.src", `${kind} 需要 src`);
    } else if (assetExists && !assetExists(raw.src)) {
      fail("missing-boot-asset", "boot.src", `主题内没有 ${raw.src}`);
    } else if (kind === "image" && !/\.(webp|png|jpe?g|avif)$/i.test(raw.src)) {
      fail("bad-boot", "boot.src", "image 必须是 webp/png/jpg/avif");
    } else if (kind === "animated" && !/\.(webp|gif|png|apng)$/i.test(raw.src)) {
      fail("bad-boot", "boot.src", "animated 必须是 webp/gif/apng");
    }
    media = { src: raw.src };
  } else if (kind === "video") {
    if (!boundedText(raw.src, 256)) {
      fail("bad-boot", "boot.src", "video 需要 src");
    } else if (!/\.(mp4|webm)$/i.test(raw.src)) {
      fail("bad-boot", "boot.src", "视频必须是 .mp4 或 .webm");
    } else if (assetExists && !assetExists(raw.src)) {
      fail("missing-boot-asset", "boot.src", `主题内没有 ${raw.src}`);
    }
    if (raw.poster !== undefined && !boundedText(raw.poster, 256)) {
      fail("bad-boot", "boot.poster", "poster 必须是主题内的图片路径");
    }
    media = { src: raw.src, poster: raw.poster ?? null };
  } else if (kind === "code") {
    if (!boundedText(raw.entry, 256) || !/\.js$/i.test(raw.entry)) {
      fail("bad-boot", "boot.entry", "代码启动动画必须声明主题内的 .js 入口");
    } else if (assetExists && !assetExists(raw.entry)) {
      fail("missing-boot-asset", "boot.entry", `主题内没有 ${raw.entry}`);
    }
    media = { entry: raw.entry };
  }

  /* --- story beats --------------------------------------------------- */
  /*
   * A story is a list of beats; each beat is one held moment. This is the
   * "case study" form: a line of display type, an optional kicker, and an
   * optional rule. No media, so it costs nothing to paint and works when the
   * network does not.
   */
  let beats = [];
  if (kind === "story") {
    if (!Array.isArray(raw.beats) || raw.beats.length === 0) {
      fail("bad-boot", "boot.beats", "story 需要至少 1 个 beat");
    } else if (raw.beats.length > BOOT_LIMITS.maxBeats) {
      fail("too-many-beats", "boot.beats", `beat 最多 ${BOOT_LIMITS.maxBeats} 个`);
    } else {
      raw.beats.forEach((beat, index) => {
        const path = `boot.beats[${index}]`;
        if (!isPlainObject(beat)) {
          fail("bad-beat", path, "beat 必须是对象");
          return;
        }
        if (!validLocalePair(beat.title)) {
          fail("bad-beat", `${path}.title`, "title 必须是 { zh, en }（各 ≤120 字）");
        }
        if (beat.kicker !== undefined && !validLocalePair(beat.kicker, 40)) {
          fail("bad-beat", `${path}.kicker`, "kicker 必须是 { zh, en }（各 ≤40 字）");
        }
        if (beat.holdMs !== undefined) {
          const hold = clampBeat(beat.holdMs);
          if (hold === null) fail("bad-beat", `${path}.holdMs`, "holdMs 必须是数字");
        }
        beats.push({
          title: beat.title,
          kicker: beat.kicker ?? null,
          holdMs: clampBeat(beat.holdMs) ?? 1800,
        });
      });
    }
  }

  /* --- shared presentation ------------------------------------------- */
  const theme = raw.theme ?? "auto"; // auto | dark | light
  if (!["auto", "dark", "light"].includes(theme)) {
    fail("bad-boot", "boot.theme", "theme 必须是 auto / dark / light");
  }

  const fadeMs = Number.isFinite(raw.fadeMs) ? Math.round(Math.max(0, Math.min(raw.fadeMs, 900))) : 420;

  const skipLabel = raw.skipLabel === undefined ? null : raw.skipLabel;
  if (skipLabel !== null && !validLocalePair(skipLabel, 24)) {
    fail("bad-boot", "boot.skipLabel", "skipLabel 必须是 { zh, en }（各 ≤24 字）");
  }

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    boot: {
      kind,
      media,
      beats,
      theme,
      fadeMs,
      skipLabel,
      /* Total budget: media own their own length; a story is the sum of its
         holds plus the fades. Clamped so a boot can never outstay its
         welcome even if every beat asked for the maximum. */
      totalMs: kind === "story"
        ? Math.min(
          beats.reduce((sum, beat) => sum + beat.holdMs, 0) + fadeMs * 2,
          BOOT_LIMITS.maxDurationMs,
        )
        : null,
    },
  };
}

/**
 * Should the sequence play at all on this launch?
 *
 * The default is "once per first launch", which is the behaviour of a
 * narrative page: it is worth seeing, and worth never being forced to see
 * again. Every reason to skip is checked here so the runtime stays dumb.
 */
export function shouldPlayBoot({ boot, seen, enabled = true, reducedMotion = false, deepLink = false }) {
  if (boot === null || boot === undefined) return { play: false, reason: "no-boot" };
  if (!enabled) return { play: false, reason: "disabled" };
  /* A deep link (someone opening a specific session from outside) is an
     intent to be somewhere, not to watch an intro. */
  if (deepLink) return { play: false, reason: "deep-link" };
  if (seen) return { play: false, reason: "already-seen" };
  /* Reduced motion still gets a boot — it is informational, not decorative —
     but the caller renders it as a single held frame with no transitions. */
  return { play: true, reason: reducedMotion ? "reduced-motion" : "first-launch" };
}

/**
 * Compile a story boot into a timeline the runtime can walk.
 *
 * Pure and synchronous on purpose: the order of beats, their holds and the
 * fade envelope are the part worth testing, and none of it needs a DOM.
 */
export function storyTimeline(boot, { reducedMotion = false } = {}) {
  if (boot === null || boot.kind !== "story") return [];
  let cursor = 0;
  const steps = [];
  for (const [index, beat] of boot.beats.entries()) {
    /* Under reduced motion every beat holds once, briefly, with no travel. */
    const hold = reducedMotion ? 900 : beat.holdMs;
    steps.push({
      index,
      kind: "beat",
      atMs: cursor,
      holdMs: hold,
      title: beat.title,
      kicker: beat.kicker,
    });
    cursor += hold;
  }
  steps.push({ index: steps.length, kind: "end", atMs: cursor, holdMs: boot.fadeMs });
  return steps;
}