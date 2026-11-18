// The panel's copy feature, checked without a browser.
//
// Run from the plugin directory: node tests/panel-copy.test.ts
//
// The refactor removed the model-analysis half (a scheduled run, three tuning
// numbers, and the routes that drove them) and replaced it with text the user
// copies into a conversation. Two things have to hold for that to be true of the
// shipped bundle rather than only of the source:
//
//   - nothing in either half still speaks of the analysis it no longer has;
//   - the panel carries the copy control, the five ranges, and the multi-select
//     that feeds them.
//
// The bundle is read as text because it is what a profile installs; the units
// this replaced are covered by the harness tests.
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const root = resolve(import.meta.dirname, '..')
const read = (name: string): string => readFileSync(resolve(root, name), 'utf8')

/**
 * Every string literal in a bundle, decoded.
 *
 * esbuild escapes non-ASCII characters inside string literals as `\uXXXX`, so a
 * search for the Chinese copy has to decode them first — searching the raw file
 * for a character finds nothing even when the bundle contains it. Only the
 * unicode escape is decoded; the other escapes do not appear in this copy.
 */
function literals(source: string): string {
  const out: string[] = []
  for (const match of source.matchAll(/"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`/gs)) {
    const raw = match[1] ?? match[2] ?? match[3] ?? ''
    out.push(raw.replace(/\\u([0-9a-fA-F]{4})/g, (_all, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16))))
  }
  return out.join(' ')
}

test('neither half still carries the analysis the plugin no longer runs', () => {
  const half = { client: read('lib/client.js'), host: read('lib/index.js') }
  for (const [name, source] of Object.entries(half)) {
    const text = literals(source)
    for (const gone of ['立即分析', '自动分析设置', '自动检查间隔', '触发门槛', '冷却天数', '改进建议', 'diagnosis']) {
      assert.ok(!text.includes(gone), `${name} still mentions ${gone}`)
    }
  }
  // The route names are code, not strings, so they are searched raw.
  assert.ok(!half.host.includes('/diagnose'), 'the diagnose route is gone')
  assert.ok(!half.host.includes('/dismiss'), 'the dismiss route is gone')
  assert.ok(!half.host.includes('analyzeEveryHours'), 'the schedule setting is gone')
})

test('the panel carries the copy control and the five ranges', () => {
  const text = literals(read('lib/client.js'))
  for (const wanted of ['工具分析', '复制错误日志', '全选', '剪贴板不可用']) {
    assert.ok(text.includes(wanted), `the panel is missing ${wanted}`)
  }
  for (const range of ['所有', '最近 30 天', '最近 7 天', '最近 3 天', '今天']) {
    assert.ok(text.includes(range), `the range selector is missing ${range}`)
  }
})

test('the panel offers every selected tool as evidence, not a summary of them', () => {
  const text = literals(read('lib/client.js'))
  // The prompt names what to do with the data and what each tool's section holds,
  // so a pasted block is self-describing without the panel's chrome around it.
  assert.ok(text.includes('请分析下面这些工具调用失败'), 'the pasted text asks for the analysis')
  assert.ok(text.includes('统计范围：'), 'the pasted text states its range')
  assert.ok(text.includes('最近的失败：'), 'each tool lists its failure samples')
})

test('the read endpoint answers without a diagnosis block', async () => {
  // The panel reads `data.failures` and `data.windows`; a diagnosis block would
  // mean the host still builds one. The host test exercises the real endpoint,
  // so this only guards the shape in the built half.
  const host = read('lib/index.js')
  assert.ok(host.includes('coverage'), 'the response still carries coverage')
  assert.ok(!host.includes('pending:'), 'the response no longer carries pending proposals')
  assert.ok(!host.includes('analyzing'), 'the response no longer carries the analyzing flag')
})
