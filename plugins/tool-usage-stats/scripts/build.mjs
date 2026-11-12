/**
 * Bundle `src/index.ts` into `lib/index.js`.
 *
 * The runtime entry is plain JavaScript because a DSH profile loads plugin
 * modules directly from `node_modules`; nothing in the profile transpiles
 * TypeScript. esbuild strips the types and inlines the local `counters` import;
 * there are no runtime dependencies to leave external.
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
  sourcemap: false,
  logLevel: 'info',
})
