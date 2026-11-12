/**
 * Bundle both halves of the plugin.
 *
 * `src/index.ts` becomes the ESM Host entry a DSH profile loads from
 * `node_modules`. `src/client/index.ts` becomes the CommonJS browser entry the
 * client bundle consumes, where `react` is supplied by the browser bundle's
 * module map and must stay external — bundling it would ship a second React and
 * break hooks in components rendered by the Host's own tree.
 *
 * @module vyra-tool-usage-stats/build
 */

import { build } from 'esbuild'

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  logLevel: 'info',
})

await build({
  entryPoints: ['src/client/index.ts'],
  outfile: 'lib/client.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  logLevel: 'info',
})
