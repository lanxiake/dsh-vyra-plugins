# Folia port (`src/render/folia/`)

Verbatim port of Folia's **Pendolo（时计）** lyric renderer and its **six shell
backgrounds** (common / monet / nomand / latent / sora / url), plus the small shared
modules they import. Upstream: `folia-major-main` **0.7.28** (AGPL-3.0-only).

## What is here

| Path | Origin | Notes |
|---|---|---|
| `components/visualizer/pendolo/` | `src/components/visualizer/pendolo/` | All 23 files, unchanged. The settings panel, `entry.tsx` and `tuning.ts` are kept but not compiled/registered yet. |
| `components/visualizer/{still,tilt,partita,claddagh,cappella,cadenza,fume,monet,lumiere,sonnet,tempera,hanabi,nebbia,diorama}/` | same paths | Verbatim sources for the 14 styles compiled by `styles.bundle.js`; their entries declare labels/glyphs and the settings panels are build-time no-ops. |
| `components/visualizer/machi/` | same path | Source kept for reference; the runtime actually uses the already compiled `machi.bundle.js` (Folia engine) through `src/render/styles/machi-native.js`. |
| `components/visualizer/diorama/` | same path | Verbatim source, enabled; `@react-three/fiber@8.18.0` is vendored in `vendor/r3f/`. Canvas/CameraRig/DioramaScene render; a React 18 host is caught by the style error boundary and falls back to classic. |
| `components/visualizer/backgrounds/` | `src/components/visualizer/backgrounds/` | The six background renderers and their entries, unchanged except: `registry.tsx` is an explicit-import boundary (Vite's `import.meta.glob` is not available here); `monet/monetBackgroundPipeline.ts` paints on an `OffscreenCanvas` instead of a Worker (same `paintMonetBackground`); `nomand/NomandBackgroundEffectSettings.tsx` keeps only the effect data used by the entry. Settings cards are aliased to a no-op stub at build time. |
| `components/visualizer/{styleTransition/firstFrame,layerTransition}.ts`, `backgrounds/useBlendedColors.ts` | same paths | Background timing/colour-blend helpers. |
| `components/visualizer/preview/frozenPicture.ts` | rewritten boundary | Only the two data attributes the backgrounds read. |
| `backgrounds-entry.tsx` | build entry | Exports the renderer, registry, mode ids and tuning defaults. |
| `types.ts`, `types/visualizerModes.ts`, `utils/**`, `stores/motionSignals.ts` | Folia paths | Shared types, colour/paper-shader helpers, cover URL helpers, the two beat signals Latent reads. |
| `shims/` | build-time | React/framer-motion/lucide from the plugin client; settings cards and quick controls are no-ops; beat services stay off. |
| `vendor/pretext/`, `vendor/paper-shaders*/`, `vendor/twgl/` | npm packages | MIT / Apache-2.0 / MIT, vendored because the plugin ships one client file. The paper-shaders React wrappers are patched locally to forward `ref` to `ShaderMount` (Folia runs React 19 where `ref` is a prop; the plugin host is React 18). |
| `pendolo.bundle.js`, `backgrounds.bundle.js` | generated | `node scripts/build-pendolo.mjs`, `node scripts/build-backgrounds.mjs`. |

## Boundary (plugin side)

- `src/render/styles/folia-audio.js` is Folia's audio write path: one analyser wave →
  `audioPower`, the five 0–255 bands and the raw `spectrum`, with upstream's Hz splits,
  power curve and idle breath. Every Folia stage below reads it.
- `src/render/styles/folia-pendolo.js` builds Folia's `VisualizerSharedProps` (clock,
  bands, `Line[]`, `Theme`, defaults tuning) and mounts the style once per song.
- `src/render/styles/folia-backdrop.js` builds Folia's `VisualizerBackgroundConfig`
  (mode, URL list, per-mode defaults), theme and audio signals, and mounts the
  background renderer inside the player page (`.mp-np`, not a global overlay).
- The player sheet's 背景 row now lists Folia's six modes plus 空; `prefs.bgMode`
  defaults to `latent`, old flow/cover/aurora/stars/off values migrate.


## Not ported yet (and therefore different from Folia)

- Folia's **settings windows / per-style tuning UI** and background settings cards; the
  plugin mounts styles with their default tuning. The cover palette + built-in theme
  generator *are* ported (`utils/builtinTheme`, `services/baseThemes`).
- AI/custom themes and the theme editor.
- Style-switch soft focus and background transition frames (`VisualizerBackgroundTransition`),
  the shared subtitle/harmony overlays and Folia's player chrome.
- Background tuning UI (Paper shader sliders, Monet layout, Nomand effect picker, URL list
  management): only the mode choice and one URL string are exposed in the player sheet.
- Monet's background Worker: the same `paintMonetBackground` runs on an `OffscreenCanvas`
  in the main thread because the plugin has no separate worker file.
- `nebbia` stroke data (`nebbia-strokes.json`); falls back to the font skeleton. Cappella's
  built-in avatars/emoji are Folia's images, served from the plugin's `/music/assets` route.
- Smart beat (`beat_this`) and drum stems (`htdemucs`): the drum-head / gear-beat effects
  stay off; the base picture is unaffected.
- Global render quality tiers, frame-rate cap, prewarm and the per-style tuning UI.
- Folia's app-level wallpaper/transparent page modes.

