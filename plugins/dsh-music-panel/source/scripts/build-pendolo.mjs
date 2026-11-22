#!/usr/bin/env node
/**
 * Bundle the ported Folia `pendolo` renderer (clockwork + lyric rail) into one fragment.
 *
 * This is the second verbatim port after `machi`, and it follows the same shape:
 * esbuild compiles Folia's TSX subtree, the plugin's own React instance is injected
 * through the existing vendor shims, and the services Folia reads (smart beat, drum
 * stems, the settings store) are boundary shims so the renderer itself stays untouched.
 */
import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'src/folia/pendolo.bundle.js')

const aliases = [
  [/^react$/, 'src/client/vendor/react-shim.js'],
  [/^react\/jsx-runtime$/, 'src/client/vendor/jsx-runtime-shim.js'],
  [/^framer-motion$/, 'src/folia/shims/framer-motion.js'],
  [/^lucide-react$/, 'src/folia/shims/lucide-react.js'],
  [/^@chenglou\/pretext$/, 'src/folia/vendor/pretext/dist/layout.js'],
  [/^@chenglou\/pretext\/rich-inline$/, 'src/folia/vendor/pretext/dist/rich-inline.js'],
]

try {
  const result = await build({
    entryPoints: [join(ROOT, 'src/folia/entry.tsx')],
    write: false,
    bundle: true,
    format: 'iife',
    globalName: 'MPFoliaPendolo',
    platform: 'browser',
    target: ['chrome120'],
    jsx: 'automatic',
    minify: false,
    logLevel: 'silent',
    loader: { '.tsx': 'tsx', '.ts': 'ts' },
    define: {
      'import.meta.env.DEV': 'false',
      'import.meta.env.PROD': 'true',
      'import.meta.env.MODE': '"production"',
      'import.meta.env.SSR': 'false',
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
  const text = result.outputFiles[0].text
  // Two-space indent: the client build's duplicate scanner only reads column 0.
  const indented = text.replace(/\n/g, '\n  ')
  writeFileSync(
    OUT,
    'function __mpPendoloBundle() {\n  ' + indented + '\n  return typeof MPFoliaPendolo === "undefined" ? null : MPFoliaPendolo\n}\n',
    'utf8',
  )
  console.log('PENDOLO BUNDLE OK bytes=' + text.length)
} catch (error) {
  const errors = error.errors || []
  console.log('ERRORS ' + errors.length)
  console.log(
    errors
      .slice(0, 30)
      .map((item) => (item.location ? item.location.file.split('folia/').pop() + ':' + item.location.line + ' ' : '') + item.text)
      .join('\n'),
  )
  process.exitCode = 1
}

