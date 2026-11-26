# `sim/` — DEPRECATED

This directory is the **previous** engine: keyframed pose tables, axis-aligned
hit boxes, and a hand-written state machine. It is superseded by `../js/`.

Only one file here still ships: **`session.mjs`**, the keyboard/pause/unmount
controller. It is engine-agnostic and guards the exit path, so it was kept.

Everything else (`ai.mjs`, `combat.mjs`, `constants.mjs`, `duel.mjs`,
`fighter.mjs`, `ragdoll.mjs`) is exercised only by the legacy test suite under
`test/`. Nothing in the shipped bundle imports it. New work belongs in `js/`.

## Why the engine was replaced

The old one could not produce a fight that read as a fight:

- **Poses were per-joint keyframes**, so the hip, spine, feet and arms could
  disagree; a kick was authored as a separate skeleton from a punch.
- **Hits were axis-aligned boxes**, so a punch that visibly connected could
  miss, and a kick that visibly missed could land.
- **Knockdowns swapped a pose**, so a body that was launched did not fall —
  it changed picture.

The replacement (`js/`) derives every joint from eleven normalised offsets and
two-bone IK, tests hits as capsules against the drawn skeleton, and lets a
Verlet integrator own a launched body. See `THIRD_PARTY_NOTICES.md` for the
provenance of those techniques.
