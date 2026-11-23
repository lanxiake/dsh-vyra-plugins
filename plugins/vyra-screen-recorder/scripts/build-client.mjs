import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scripts = path.dirname(fileURLToPath(import.meta.url))
const plugin = path.dirname(scripts)
const body = readFileSync(path.join(plugin, 'src/client.body.js'), 'utf8')
const vendor = readFileSync(path.join(plugin, 'vendor/webm-muxer.js'), 'utf8')
const marker = '/*__WEBM_MUXER__*/'
if (!body.includes(marker)) throw new Error('src/client.body.js 缺少 ' + marker)
const output = body.replace(marker, vendor)
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
