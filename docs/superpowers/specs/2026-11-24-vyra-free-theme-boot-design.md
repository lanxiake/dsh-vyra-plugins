# Boot sequence — the narrative slot

**Date:** 2026-11-24
**Status:** prototype shipped (`prototypes/noir/`), not yet wired into `vyra-free-theme`
**Decision:** a theme gains an optional `boot` block; the studio-site narrative
grammar moves there instead of into the app surface.

---

## 1. The problem this solves

A studio case-study page and an agent console want opposite things. The case
study is a **narrative surface**: one idea per viewport, huge display type,
hundreds of pixels of air, motion that carries you down the page. It is looked
at for ninety seconds, once.

The console is a **tool surface**: dense, re-read constantly, used hundreds of
times a day. Put the narrative grammar there and it degrades from "impressive"
to "slow" by the third day. This is the same conclusion Rauno reaches about
frequency and novelty, and the same gate the `animate` reference applies: a
100-times-a-day interaction gets *no* animation, never a decorative one.

That leaves the narrative grammar homeless inside a desktop app — until you
notice that **a client start is exactly a case-study page's situation**:

| Case study page | App boot | Match |
|---|---|---|
| Visitor chose to arrive | User chose to launch | ✓ |
| Nothing else to do but look | Already waiting for the client | ✓ |
| Seen once, maybe twice | Seen once per install | ✓ |
| Narrative is the point | Narrative is the point | ✓ |

So: the story lives in the boot sequence. The app itself stays quiet.

---

## 2. What a boot sequence is

A boot sequence plays **once**, when the client starts, over everything, then
leaves permanently. It is:

- **optional** — a theme without `boot` starts straight into the app
- **skippable from frame 0** — any key, any click, plus a visible affordance
- **bounded** — 6s hard ceiling; a watchdog closes it even if media stalls
- **once by default** — `localStorage` marks it seen; a settings switch can
  re-enable it, and `?boot=1` forces it while designing
- **suppressed on deep links** — someone opening a specific session asked to be
  *there*, not to watch an intro

---

## 3. Media channels

The same four a wallpaper already supports, plus a fifth that needs no media
at all. Reusing the channels means the existing asset pipeline, the existing
validator and the existing code-art sandbox all apply unchanged.

| `kind` | Needs | Owns | Best for |
|---|---|---|---|
| `story` | 1–5 beats of type | the timeline | the studio-site grammar |
| `image` | `src` (webp/png/jpg/avif) | nothing; CSS supplies motion | a still with a slow push-in |
| `video` | `src` (mp4/webm), optional `poster` | its own length | a rendered title card |
| `animated` | `src` (webp/gif/apng) | its own loop | a short authored motion loop |
| `code` | `entry` (theme-local `.js`) | its own frame | generative or reactive openers |

`code` boots an iframe with the **same posture as code art**: `sandbox="allow-scripts"`,
no same-origin, no referrer. A boot entry gets no more authority than a
wallpaper entry.

---

## 4. The `story` form

A story is a list of **beats**. Each beat is one held moment:

```json
{
  "kind": "story",
  "theme": "dark",
  "fadeMs": 420,
  "skipLabel": { "zh": "跳过", "en": "Skip" },
  "beats": [
    { "kicker": { "zh": "自由主题", "en": "Free Theme" },
      "title":  { "zh": "为安静的工作而设计", "en": "Designed for quiet work" },
      "holdMs": 1500 },
    { "kicker": { "zh": "暗场 · 铜色 · 呼吸", "en": "Dark field · Copper · Breath" },
      "title":  { "zh": "一条会呼吸的光标", "en": "One breathing caret" },
      "holdMs": 1700 }
  ]
}
```

What makes it read as a studio site rather than a splash screen:

1. **One line per beat.** Not a headline plus a subhead plus a bullet list.
   The beat's whole job is one sentence.
2. **Display type at 30–62px, `-0.028em` tracking.** Tight tracking is the
   single strongest signal of "designed" in type.
3. **A kicker, not a subtitle.** 10px, uppercase, `0.34em` tracking, copper.
   It reads as a coordinate label, which is the register these sites use.
4. **A rule that draws itself.** 1px, 64px wide, copper, 620ms, left-origin.
   It is the only "drawing" motion in the sequence.
5. **12px of travel.** Not 40, not a mask wipe. A hero that flies in reads as
   a template; one that settles reads as a title.
6. **Cross-fade, not slide.** Beats stack in one grid cell and fade through
   each other, so the type never appears to move between beats.

---

## 5. Timing rules

| Rule | Value | Why |
|---|---|---|
| Minimum hold | 600ms | below this a line reads as a flicker |
| Default hold | 1800ms | roughly one comfortable read of a short line |
| Maximum hold | 3200ms | longer and the user reaches for the skip |
| Maximum beats | 5 | beyond this it is a film |
| Total ceiling | 6000ms | the whole sequence, clamped |
| Fade to app | 420ms | `cubic-bezier(0.23,1,0.32,1)` |

The ceiling is enforced twice: `normalizeBoot` clamps `totalMs`, and the
runtime keeps a watchdog at `totalMs + 2000ms` so a stalled video cannot leave
the splash up.

---

## 6. Reduced motion

The sequence still plays under `prefers-reduced-motion` — it carries
information (the app is starting) — but it is **collapsed**:

- every beat holds 900ms regardless of what the theme asked
- no travel, no cross-fade, no rule-drawing (transitions cancelled)
- media kinds hold one frame for 900ms
- the progress hairline still fills, so the wait is still legible

This follows C39/SCR40: keep the state change, drop the movement.

---

## 7. Validation

`normalizeBoot` is pure and fail-closed, matching every other block in
`theme-model.js`. It rejects with a stable code:

| Code | Trigger |
|---|---|
| `bad-boot` | not an object, missing `src`/`entry`, a beat with no `title` |
| `bad-boot-kind` | `kind` outside the five |
| `too-many-beats` | more than 5 beats |
| `bad-beat` | malformed `title`/`kicker`/`holdMs` |
| `missing-boot-asset` | declared an asset the theme does not ship |
| `bad-boot` (media) | wrong extension for the kind |

A theme with an invalid `boot` is **not registered at all** — the same rule the
sidebar, wallpaper and colour blocks already follow.

---

## 8. Files

| File | Role |
|---|---|
| `prototypes/noir/boot-model.js` | `normalizeBoot`, `shouldPlayBoot`, `storyTimeline` — pure, no DOM |
| `prototypes/noir/boot-model.test.mjs` | 14 tests: shape, rejection, launch policy, timeline |
| `prototypes/noir/boot.js` | `playBoot` — the only DOM code; disposable, skippable, watchdogged |
| `prototypes/noir/boot.css` | the sequence's presentation |

Verified: `node --test prototypes/noir/boot-model.test.mjs` → 14 pass, 0 fail.

---

## 9. Wiring into `vyra-free-theme` (next step)

1. **`theme-model.js`** — add `boot` to `KNOWN_KEYS`, call `normalizeBoot(raw.boot, { assetExists })`
   after the wallpaper block, expose it on the normalized theme.
2. **`paths.js` / `themes/repository.js`** — a boot asset lives under the same
   theme directory and is served by the existing `/vyra-free-theme/theme/<id>/<path>`
   route; no new route is needed.
3. **`client/index.js`** — mount the overlay **before first paint**, so the
   sequence covers the app's own entrance rather than following it.
4. **Host config** — a per-theme `bootEnabled` and a global `bootSeen` marker
   in `$DSH_HOME/vyra-free-theme/config.json`.
5. **Settings row** — "启动动画：开 / 关 / 重播" next to the theme picker.

The block is additive: a theme that does not declare `boot` is unaffected, and
`schema` stays at 1 because `boot` is optional and unknown keys are the only
thing schema versioning guards.