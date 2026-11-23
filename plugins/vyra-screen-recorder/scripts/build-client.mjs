import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scripts = path.dirname(fileURLToPath(import.meta.url))
const plugin = path.dirname(scripts)
const body = readFileSync(path.join(plugin, 'src/client.body.js'), 'utf8')
const webm = readFileSync(path.join(plugin, 'vendor/webm-muxer.js'), 'utf8')
const mp4 = readFileSync(path.join(plugin, 'vendor/mp4-muxer.js'), 'utf8')
if (!body.includes('/*__WEBM_MUXER__*/') || !body.includes('/*__MP4_MUXER__*/')) {
  throw new Error('src/client.body.js 缺少 muxer 占位符')
}
const output = body
  .replace('/*__WEBM_MUXER__*/', webm)
  .replace('/*__MP4_MUXER__*/', mp4)
const target = path.join(plugin, 'client.js')
if (process.argv.includes('--check')) {
  const current = readFileSync(target, 'utf8')
  if (current !== output) {
    console.error('client.js 与源码不一致，请运行 npm run build:client')
    process.exit(1)
  }
  console.log('client.js 一致（' + output.length + ' 字节）')
} else {
  writeFileSync(target, output)
  console.log('已生成 client.js（' + output.length + ' 字节）')
}
