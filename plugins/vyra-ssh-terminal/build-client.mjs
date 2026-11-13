import { build } from 'esbuild'

await build({
  entryPoints: ['src/entry.jsx'],
  bundle: true,
  format: 'iife',
  outfile: 'client.js',
  target: 'es2020',
  jsx: 'transform',
  jsxFactory: 'h',
  jsxFragment: 'Fragment',
  loader: { '.css': 'text' },
  legalComments: 'none',
  logLevel: 'info',
})
