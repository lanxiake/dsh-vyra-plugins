#!/usr/bin/env node
/**
 * Bundle the ported Folia lyric styles (DOM/Canvas/Pixi/WebGL) into one fragment.
 * Mirrors scripts/build-pendolo.mjs; settings/preview UI resolves to boundary stubs.
 */
import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'src/folia/styles.bundle.js')
const FOLIA = 'src/folia'

const aliases = [
  [/^react$/, 'src/client/vendor/react-shim.js'],
  [/^react\/jsx-runtime$/, 'src/client/vendor/jsx-runtime-shim.js'],
  [/^framer-motion$/, `${FOLIA}/shims/framer-motion.js`],
  [/^lucide-react$/, `${FOLIA}/shims/lucide-react.js`],
  [/^@chenglou\/pretext$/, `${FOLIA}/vendor/pretext/dist/layout.js`],
  [/^@chenglou\/pretext\/rich-inline$/, `${FOLIA}/vendor/pretext/dist/rich-inline.js`],
  [/^pixi\.js$/, `${FOLIA}/vendor/pixi/pixi.min.mjs`],
  [/^pixi\.js\/advanced-blend-modes$/, `${FOLIA}/vendor/pixi/pixi.min.mjs`],
  [/^@react-three\/fiber$/, `${FOLIA}/vendor/r3f/r3f8.mjs`],
  [/^three$/, 'src/client/vendor/three.esm.js'],
  [/^@applemusic-like-lyrics\/ttml$/, `${FOLIA}/shims/ttml.ts`],
  [/^@xmldom\/xmldom$/, `${FOLIA}/shims/ttml.ts`],
  [/^react-dom\/server$/, `${FOLIA}/shims/react-dom-server.ts`],
  [/BackgroundSettingsCard$/, `${FOLIA}/shims/settings-card.tsx`],
  [/SettingsPanel$/, `${FOLIA}/shims/settings-card.tsx`],
  [/SettingsCard$/, `${FOLIA}/shims/settings-card.tsx`],
  [/settingsPanels$/, `${FOLIA}/shims/settings-card.tsx`],
  [/panelRows$/, `${FOLIA}/shims/settings-card.tsx`],
  [/modal\/settings\/kit/, `${FOLIA}/shims/settings-card.tsx`],
  [/^react-i18next$/, `${FOLIA}/shims/i18n.ts`],
  [/^i18next$/, `${FOLIA}/shims/i18n.ts`],
  [/^@\/mods\//, `${FOLIA}/shims/mods.ts`],
]

try {
  const result = await build({
    entryPoints: [join(ROOT, 'src/folia/styles-entry.tsx')],
    write: false,
    bundle: true,
    format: 'iife',
    globalName: 'MPFoliaStyles',
    platform: 'browser',
    target: ['chrome120'],
    jsx: 'automatic',
    minify: false,
    logLevel: 'silent',
    loader: { '.tsx': 'tsx', '.ts': 'ts', '.css': 'text', '.png': 'dataurl', '.jpg': 'dataurl', '.webp': 'dataurl' },
    define: {
      'import.meta.env.DEV': 'false',
      'import.meta.env.PROD': 'true',
      'import.meta.env.MODE': '"production"',
      'import.meta.env.SSR': 'false',
      'import.meta.env.BASE_URL': '"/"',
    },
    plugins: [
      {
        name: 'folia-aliases',
        setup(context) {
          for (const [filter, target] of aliases) {
            context.onResolve({ filter }, () => ({ path: join(ROOT, target) }))
          }
        },
      },
    ],
  })
  const js = result.outputFiles[0]
  let text = js.text
  // R3F 9 bundles a CJS reconciler that `require("react")`s. The host React is a
  // global in the plugin client, so resolve that one id through it instead of throwing.
  text = text.replace(
    `throw Error('Dynamic require of "' + x4 + '" is not supported');`,
    `if (x4 === 'react') return globalThis.__MP_REACT__; if (x4 === 'react-dom') return globalThis.__MP_REACT_DOM__ || {}; if (x4 === 'react/jsx-runtime') return globalThis.__MP_REACT__; throw Error('Dynamic require of "' + x4 + '" is not supported');`,
  )
  const indented = text.replace(/\n/g, '\n  ')
  writeFileSync(
    OUT,
    'function __mpStylesBundle() {\n  ' + indented + '\n  return typeof MPFoliaStyles === "undefined" ? null : MPFoliaStyles\n}\n',
    'utf8',
  )
  console.log('STYLES BUNDLE OK bytes=' + text.length)
} catch (error) {
  const errors = error.errors || []
  console.log('ERRORS ' + errors.length)
  if (errors.length === 0) console.log(String(error && error.message ? error.message : error))
  console.log(
    errors
      .slice(0, 40)
      .map((item) => (item.location ? item.location.file.split('folia/').pop() + ':' + item.location.line + ' ' : '') + item.text)
      .join('\n'),
  )
  process.exitCode = 1
}

