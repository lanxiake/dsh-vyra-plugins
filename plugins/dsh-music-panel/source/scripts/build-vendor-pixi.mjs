#!/usr/bin/env node
/**
 * Bundle pixi into one committed fragment, the same way framer-motion is bundled.
 *
 * The source is the prebuilt ESM release downloaded to `src/client/vendor/pixi.esm.js`, so
 * this does not need the npm registry: esbuild only rewrites and minifies it into an
 * IIFE that the client can concatenate. Run: node scripts/build-vendor-pixi.mjs
 */

import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'src/client/vendor/pixi.bundle.js')

const result = await build({
  entryPoints: [join(ROOT, 'src/client/vendor/pixi-entry.js')],
  write: false,
  bundle: true,
  format: 'iife',
  globalName: 'MPPixiBundle',
  platform: 'browser',
  target: ['chrome120'],
  minify: true,
  legalComments: 'none',
})

const text = result.outputFiles[0].text
const wrapped =
  'function __mpPixiBundle() {\n' +
  text +
  '\nreturn typeof MPPixiBundle === "undefined" ? null : MPPixiBundle\n}\n'
writeFileSync(OUT, wrapped, 'utf8')
console.log('src/client/vendor/pixi.bundle.js written: ' + String(wrapped.length) + ' bytes')

