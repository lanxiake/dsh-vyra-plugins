/**
 * Bundle both halves of the plugin.
 *
 * `src/index.ts` becomes the ESM Host entry a DSH profile loads from
 * `node_modules`. `src/client/index.ts` becomes the browser entry, which is not
 * plain CommonJS: the page's module system executes each client bundle as a
 * factory registered on `window.__ModuleLoader__`, and passes `require` in. A
 * bundle without that wrapper fails with `module is not defined` at load and
 * the plugin never appears. The banner/intro/footer below reproduce the wrapper
 * `packages/client/tsdown.client.ts` emits for first-party client packages.
 *
 * `react` stays external because the wrapper's `require` resolves it from the
 * page's shared module map; bundling it would ship a second React and break
 * hooks in any component the host's own tree renders.
 *
 * @module vyra-tool-usage-stats/build
 */

import { build } from 'esbuild'

const PACKAGE_ID = 'vyra-tool-usage-stats'

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
  // The wrapper supplies `module` and `exports`; the body is CommonJS.
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  banner: {
    js: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PACKAGE_ID)}, factory: (require) => {\nvar module = { exports: {} }; var exports = module.exports;`,
  },
  footer: { js: 'return module.exports; } });' },
  logLevel: 'info',
})
