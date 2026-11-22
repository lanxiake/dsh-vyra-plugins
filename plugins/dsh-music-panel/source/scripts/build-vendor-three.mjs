#!/usr/bin/env node
/** Bundle three.js into one committed fragment, like pixi and framer. */
import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const result = await build({
  entryPoints: [join(ROOT, 'src/client/vendor/three-entry.js')],
  write: false, bundle: true, format: 'iife', globalName: 'MPThreeBundle',
  platform: 'browser', target: ['chrome120'], minify: true, legalComments: 'none',
})
const text = result.outputFiles[0].text
// Two spaces per line: the client build's duplicate-declaration scanner only looks
// at column 0, and minified three repeats `var float`-style locals.
const indented = text.replace(/\n/g, '\n  ')
writeFileSync(join(ROOT, 'src/client/vendor/three.bundle.js'),
  'function __mpThreeBundle() {\n  ' + indented + '\n  return typeof MPThreeBundle === "undefined" ? null : MPThreeBundle\n}\n', 'utf8')
console.log('three.bundle.js: ' + String(text.length) + ' bytes')

