/**
 * 把 src/ 打包成 client.js。
 *
 * React 不进包：宿主在 factory(require) 里把它交进来，包只留一个可写的壳（src/react.js）。
 * 这也让产物体积稳定在比 xterm 还小的量级，而 xterm 本身已由后端路由提供。
 *
 * 用法：node scripts/build.mjs [--out client.js] [--watch]
 */
import { build, context } from 'esbuild'

const out = process.argv.includes('--out')
  ? process.argv[process.argv.indexOf('--out') + 1]
  : 'client.js'
const watch = process.argv.includes('--watch')

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ['src/entry.jsx'],
  bundle: true,
  format: 'iife',
  outfile: out,
  target: 'es2020',
  jsx: 'transform',
  jsxFactory: 'h',
  jsxFragment: 'Fragment',
  loader: { '.css': 'text' },
  legalComments: 'none',
  charset: 'utf8',
  logLevel: 'info',
}

if (watch) {
  const ctx = await context(options)
  await ctx.watch()
  console.log('watching src/ …')
} else {
  await build(options)
}
