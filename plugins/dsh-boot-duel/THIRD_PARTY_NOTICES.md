# Third-party notices

`dsh-boot-duel` is written from scratch. **No source file from any other
project is vendored or copied verbatim into this repository** — with two
deliberate exceptions, both documented here in full: the CC0 sound files at the
bottom, and the animation/combat *techniques* described below, which were
studied in a public repository and then reimplemented.

## ⚠ Disclosed technique derivation: Waleee7/ragdoll-riot

The animation and combat system in `js/rig.js`, `js/fighter.js`,
`js/combat.js`, `js/juice.js` and `js/arena.js` is a **reimplementation of the
architecture** of [Waleee7/ragdoll-riot](https://github.com/Waleee7/ragdoll-riot).

**Upstream's own terms, quoted verbatim from its README:**

> © 2026 Akinwale Dare. All rights reserved. The source is public to read and
> learn from; it isn't licensed for reuse.

There is no `LICENSE` file in that repository. It is **not** open-source
licensed, and reuse is expressly disclaimed upstream.

**What was taken (techniques):**

| Technique | Where it lives here |
| --- | --- |
| Eleven-point Verlet skeleton, heavy trunk / light extremities, a minimum-only spine stick, per-point collision radius | `js/rig.js` (point layout, mass table, stick plan, integrator) |
| Procedural posing: eleven normalised offsets (`lean`, `pdx`, `crouch`, per-foot and per-hand x/y) driving two-bone IK, with a single easing scalar per attack | `js/fighter.js` (`P`, `ik`, `pose`, `poseAttack`) |
| Attack specs as fractions of a duration (`a`..`b` active window), strike carried by a named joint | `js/fighter.js` (`ATK`) |
| Capsule hit test against the victim's bone segments rather than a body box | `js/combat.js` (`hitTest`, `segDist`, `SEGMENTS`) |
| Launch velocity divided by the victim's mass | `js/combat.js` (`applyHit`) |
| Juice model: stacking impulse shake, hit-stop returning a zero time-scale, slow-mo easing back over its last third, fast-in/slow-out zoom punch | `js/juice.js` |
| Ragdoll-to-get-up transition by blending points back to the idle pose | `js/fighter.js` (`beginGetup`, `stepGetup`) |

**What was NOT taken:** no file was copied, no identifier was kept where it
could reasonably be renamed, and none of upstream's art, audio, stages, wave
system, boss design, super meter or HUD is present. The code here is a
different program built on the same technique.

**Distribution status.** This plugin is published as open source under MIT,
and the maintainer's assessment is that the derivative risk is low: it is a
small, non-commercial personal project, no file was copied, and no art, audio,
stages, characters, HUD, wave system or progression was taken. The note above
is kept in full because the upstream terms are what they are, and a reader
deserves to see them rather than a summary.

If the plugin ever becomes commercial, or draws more attention than a personal
project does, the cleanest step is a short message to the upstream author
asking whether the approach is fine. The upstream project is live at
<https://ragdoll-riot.vercel.app> and is worth playing.

## Design references (ideas only, no code)

The following open-source projects informed the *design*. Only ideas —
gameplay shape, presentation techniques, distribution approach — were taken
from them. Their licenses are recorded for transparency.

| Project | What informed the design | License |
| --- | --- | --- |
| [krishnagoswami52/stickman-skill](https://github.com/krishnagoswami52/stickman-skill) | Keyframe tables with smoothstep interpolation, tapered-capsule limbs, per-layer parallax. The **first** version of `rig.js` was built from its documented techniques; that version has since been replaced by the Verlet system above. | MIT — Copyright (c) 2026 michxlai |
| [ddrscott/stick-fight](https://github.com/ddrscott/stick-fight) | "Timing over button speed": random mashing yields little, and every strike has windup and recovery. | AGPL-3.0. Read as a design reference only; no code is reused. |
| [giorgosn/wallbrawl](https://github.com/giorgosn/wallbrawl) | Single-file packaging and WebAudio-synthesised sound effects with no audio assets. | MIT. Ideas only; no code is reused. |
| [javimosch/machin-stickman-battle](https://github.com/javimosch/machin-stickman-battle) | Active ragdoll: physics is disturbed by hits but keeps an upright posture otherwise. | Shell scripts only, no license terms declared. Ideas only; no code is reused. |

[StykAnimate's community library](https://stykanimate.com/library/) was
consulted as a **requirements reference** for what a stick-figure animation
tool is expected to offer (rigs, IK, camera, effects). Its downloads are
application-specific `.stkz` / `.stykmov` / `.styk` files under terms that do
not permit reuse here, so **nothing from it is used** — no figure, no clip, no
art asset.

## Assets shipped by this plugin

- The icon (`icon.svg`) is drawn for this plugin with plain SVG paths.
- Characters, arena, scenery, particles, and effects are drawn at runtime with
  the Canvas 2D API. No image files are bundled.
- **`sfx/*.ogg` are recorded sound effects by [Kenney](https://www.kenney.nl)**
  from the *Impact Sounds* and *RPG Audio* packs, released under
  **CC0 1.0** (`https://creativecommons.org/publicdomain/zero/1.0/`) — free for
  personal, educational and commercial use, attribution optional. The exact
  files and the credit note are listed in `sfx/CREDITS.txt`.
- Every sound the plugin can play also has a WebAudio-synthesised fallback, so
  the game still sounds like a fight if the sample route is unavailable.

## Runtime dependencies

None. The plugin declares no `dependencies`; it uses only host-provided
services and standard Web APIs.
