import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const read = name => readFileSync(join(root, name), 'utf8')

test('locale files carry the required meta fields', () => {
  const zh = JSON.parse(read('locale/zh.json'))
  const en = JSON.parse(read('locale/en.json'))
  assert.ok(zh.meta.title && zh.meta.description)
  assert.ok(en.meta.title && en.meta.description)
  assert.notEqual(zh.meta.title, en.meta.title)
})

test('the manifest exports the locale and icon and lists every runtime file', () => {
  const pkg = JSON.parse(read('package.json'))
  assert.ok(pkg.exports['./locale/*.json'])
  assert.ok(pkg.exports['./icon'])
  for (const file of ['index.js', 'client.js', 'src', 'vendor', 'locale', 'cordis.patch.yml']) {
    assert.ok(pkg.files.includes(file), `files is missing ${file}`)
  }
  assert.equal(pkg.dependencies, undefined)
})

test('the icon is a valid svg under the size cap', () => {
  const svg = read('icon.svg')
  assert.ok(svg.includes('<svg'))
  assert.ok(Buffer.byteLength(svg) < 256 * 1024)
})

test('the icon references nothing external', () => {
  const svg = read('icon.svg')
  // `xmlns` is a namespace name, not a fetch: only a real remote resource would
  // make the icon fail to render without network.
  assert.equal(svg.includes('xlink:href'), false)
  assert.equal(/<image\b/i.test(svg), false)
  assert.equal(/url\(\s*['"]?https?:/i.test(svg), false)
  assert.equal(/@import/i.test(svg), false)
})

test('the readme documents the six known limits from the spec', () => {
  assert.ok(existsSync(join(root, 'README.md')))
  const text = readFileSync(join(root, 'README.md'), 'utf8')
  for (const marker of ['已知限制', '免费池', '积分', '额度', '转发', '敏感内容']) {
    assert.ok(text.includes(marker), `README must mention ${marker}`)
  }
  // Six numbered limits, so a reader knows the list is complete.
  assert.ok(/^1\./m.test(text) && /^6\./m.test(text), 'the limits must be a numbered list of six')
})

test('the readme credits both upstreams its code came from', () => {
  const text = readFileSync(join(root, 'README.md'), 'utf8')
  assert.ok(/Jet/.test(text), 'the channel pack author must be credited')
  assert.ok(/MIT/.test(text), 'the licence must be stated')
})

test('the licence file is the MIT text, not a pointer to one', () => {
  const text = read('LICENSE')
  assert.ok(text.includes('MIT License'))
  assert.ok(text.includes('Permission is hereby granted'))
})
