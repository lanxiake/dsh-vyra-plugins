#!/usr/bin/env node
/**
 * Bundle the client's vendor code (framer-motion) into one committed fragment.
 *
 * `client.js` is a zero-build IIFE factory that may only `require` host modules,
 * so a library that lives in node_modules has to be inlined. This script runs at
 * authoring time; the produced file is committed and `build-client.mjs` just
 * concatenates it.
 *
 * Run: node scripts/build-vendor.mjs
 */

import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'src/client/vendor/framer.bundle.js')

const result = await build({
  entryPoints: [join(ROOT, 'src/client/vendor/framer-entry.js')],
  write: false,
  bundle: true,
  format: 'iife',
  globalName: 'MPFramerBundle',
  platform: 'browser',
  target: ['chrome120'],
  minify: true,
  legalComments: 'none',
  metafile: true,
  // The host owns React: everything imports the shims, which read the instance the
  // factory puts on globalThis before this fragment runs. Exact-match resolution is
  // used because an alias would rewrite `react/jsx-runtime` into a bogus path.
  plugins: [
    {
      name: 'host-react',
      setup(context) {
        context.onResolve({ filter: /^react$/ }, () => ({ path: join(ROOT, 'src/client/vendor/react-shim.js') }))
        context.onResolve({ filter: /^react\/jsx-runtime$/ }, () => ({
          path: join(ROOT, 'src/client/vendor/jsx-runtime-shim.js'),
        }))
        context.onResolve({ filter: /^react\/jsx-dev-runtime$/ }, () => ({
          path: join(ROOT, 'src/client/vendor/jsx-runtime-shim.js'),
        }))
      },
    },
  ],
  define: { 'process.env.NODE_ENV': '"production"' },
})

const text = result.outputFiles[0].text
// Wrapped in a function so a host whose React surface is not the real one (tests,
// an older host) can catch the failure and fall back to the CSS layout.
const wrapped =
  'function __mpFramerBundle() {\n' +
  text +
  '\nreturn typeof MPFramerBundle === "undefined" ? {} : MPFramerBundle\n}\n'

writeFileSync(OUT, wrapped, 'utf8')
console.log(`src/client/vendor/framer.bundle.js written: ${wrapped.length} bytes`)

