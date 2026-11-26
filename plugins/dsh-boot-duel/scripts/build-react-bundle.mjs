/**
 * Build the React/ReactDOM IIFE the offline harness mounts the layer with.
 *
 * The plugin itself gets React from `require('react')` — the host's module
 * table — so this bundle exists only so the *test page* can render the slot
 * component the way the host's slot renderer does.
 *
 * Usage: node scripts/build-react-bundle.mjs [outfile]
 *   default: <repo temp>/dsh-boot-duel-react.js
 *
 * Set DSH_E2E_REACT to the output path before running the harness.
 */
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const require = createRequire(import.meta.url)
const outfile = process.argv[2] || path.join(tmpdir(), 'dsh-boot-duel-react.js')

// esbuild and React are not dependencies of this plugin (it ships zero
// runtime deps); borrow them from an install that has both.
const SEARCH = [
  'C:/Users/75791/.dsh/profiles/desktop/node_modules',
  'C:/myself/projects/my/自由创作区/ai-jinxingshi/node_modules',
]

function findEsbuild() {
  for (const base of SEARCH) {
    const candidate = path.join(base, 'esbuild')
    if (existsSync(candidate)) return candidate
  }
  return null
}

const esbuildPath = findEsbuild()
if (!esbuildPath) {
  console.error('esbuild not found; install it or set up one of:\n  ' + SEARCH.join('\n  '))
  process.exit(2)
}

const esbuild = require(esbuildPath)
esbuild.buildSync({
  stdin: {
    contents: "import React from 'react'\nimport ReactDOMClient from 'react-dom/client'\nimport ReactDOM from 'react-dom'\nwindow.React = React\nwindow.ReactDOM = { ...ReactDOM, createRoot: ReactDOMClient.createRoot }\n",
    resolveDir: path.dirname(esbuildPath),
    loader: 'js',
  },
  bundle: true,
  outfile,
  format: 'iife',
  platform: 'browser',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
})
console.log(outfile)
