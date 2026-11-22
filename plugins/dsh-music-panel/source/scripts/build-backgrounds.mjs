#!/usr/bin/env node
/**
 * Bundle the ported Folia shell backgrounds into one fragment.
 *
 * Same boundary rules as the Pendolo build: the six entry modules and their renderers
 * are Folia's files; React/framer-motion/lucide come from the plugin client; the
 * settings-window cards (not hosted yet) resolve to a no-op; Paper Shaders and twgl
 * are vendored packages.
 */
import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'src/folia/backgrounds.bundle.js')

const aliases = [
  [/^react$/, 'src/client/vendor/react-shim.js'],
  [/^react\/jsx-runtime$/, 'src/client/vendor/jsx-runtime-shim.js'],
  [/^framer-motion$/, 'src/folia/shims/framer-motion.js'],
  [/^lucide-react$/, 'src/folia/shims/lucide-react.js'],
  [/^@paper-design\/shaders-react$/, 'src/folia/vendor/paper-shaders-react/dist/index.js'],
  [/^@paper-design\/shaders$/, 'src/folia/vendor/paper-shaders/dist/index.js'],
  [/^twgl\.js$/, 'src/folia/vendor/twgl/dist/7.x/twgl-full.module.js'],
  [/BackgroundSettingsCard$/, 'src/folia/shims/settings-card.tsx'],
  [/monet\/monetBackgroundPipeline$/, 'src/folia/components/visualizer/backgrounds/monet/monetBackgroundPipeline.ts'],
]

try {
  const result = await build({
    entryPoints: [join(ROOT, 'src/folia/backgrounds-entry.tsx')],
    write: false,
    bundle: true,
    format: 'iife',
    globalName: 'MPFoliaBackgrounds',
    platform: 'browser',
    target: ['chrome120'],
    jsx: 'automatic',
    minify: false,
    logLevel: 'silent',
    loader: { '.tsx': 'tsx', '.ts': 'ts', '.css': 'text' },
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
  const js = result.outputFiles[0]
  if (!js) {
    console.log('outputs=' + result.outputFiles.map((file) => file.path).join(','))
    throw new Error('no JavaScript output')
  }
  const text = js.text
  const indented = text.replace(/\n/g, '\n  ')
  writeFileSync(
    OUT,
    'function __mpBackgroundsBundle() {\n  ' + indented + '\n  return typeof MPFoliaBackgrounds === "undefined" ? null : MPFoliaBackgrounds\n}\n',
    'utf8',
  )
  console.log('BACKGROUNDS BUNDLE OK bytes=' + text.length)
} catch (error) {
  const errors = error.errors || []
  console.log('ERRORS ' + errors.length)
  if (errors.length === 0) console.log(String(error && error.message ? error.message : error))
  console.log(
    errors
      .slice(0, 30)
      .map((item) => (item.location ? item.location.file.split('folia/').pop() + ':' + item.location.line + ' ' : '') + item.text)
      .join('\n'),
  )
  process.exitCode = 1
}

