/**
 * 把 src/ 打包成 client.js。
 *
 * React 不进包：宿主在 factory(require) 里把它交进来，包只留一个可写的壳（src/react.js）。
 *
 * ## 为什么要把 CSS 换行统一成 LF
 *
 * CSS 通过 `loader: { '.css': 'text' }` 原样内联进产物，而 style.css 的换行符取决于
 * **检出时**的设置（Windows 上 git 常按 core.autocrlf 转成 CRLF）。于是同一份源码在
 * 不同机器、不同时间构建出的 client.js 字节不同——diff 里永远挂一条"看起来改了、
 * 其实只差 \r"的噪音，很容易被误判成"代码不一致/推送没成功"。
 *
 * 这里读一遍 CSS 把 CRLF 归一成 LF 再交给 esbuild，产物就只由源码内容决定。
 * scripts/check-build-sync.mjs 守住这条不变量（重新构建后必须与已提交版一致）。
 *
 * 用法：node scripts/build.mjs [--out client.js] [--watch]
 */
import { build, context } from 'esbuild'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

/** 以"换行已归一化"的形式提供 .css，避免产物随检出环境漂移。 */
const lfCss = {
  name: 'lf-css',
  setup(b) {
    b.onLoad({ filter: /\.css$/ }, (args) => ({
      contents: readFileSync(args.path, 'utf8').replace(/\r\n/g, '\n'),
      loader: 'text',
    }))
  },
}

const out = process.argv.includes('--out')
  ? process.argv[process.argv.indexOf('--out') + 1]
  : 'client.js'
const watch = process.argv.includes('--watch')

/** @type {import('esbuild').BuildOptions} */
const options = {
  absWorkingDir: join(here, '..'),
  entryPoints: ['src/entry.jsx'],
  bundle: true,
  format: 'iife',
  outfile: out,
  target: 'es2020',
  jsx: 'transform',
  jsxFactory: 'h',
  jsxFragment: 'Fragment',
  loader: { '.css': 'text' },
  plugins: [lfCss],
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