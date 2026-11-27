/**
 * 快捷键表的测试。
 *
 * 这张表有两个用途：一是「快捷键一览」面板要显示它，二是它记录了**哪些键我们
 * 不接**（交给远端 shell）。第二件事尤其容易出错——抢了 shell 的键，用户在 bash
 * 里按 Ctrl+R 搜不到历史，会以为插件坏了。
 */
import assert from 'node:assert/strict'
import { APP_KEYS, SHELL_KEYS } from '../src/shortcut-table.js'

const results = []
const test = (name, fn) => {
  try {
    fn()
    results.push(`✓ ${name}`)
  } catch (e) {
    results.push(`✗ ${name}\n  ${e instanceof Error ? e.stack : e}`)
    process.exitCode = 1
  }
}

const keys = (rows) => rows.map(([k]) => k)

test('两组快捷键都非空，且每条都有说明', () => {
  assert.ok(APP_KEYS.length >= 15, `应用快捷键太少：${APP_KEYS.length}`)
  assert.ok(SHELL_KEYS.length >= 8, `shell 快捷键太少：${SHELL_KEYS.length}`)
  for (const [k, w] of [...APP_KEYS, ...SHELL_KEYS]) {
    assert.ok(k && String(k).trim(), '按键不能为空')
    assert.ok(w && String(w).trim(), `${k} 缺少说明`)
  }
})

test('应用快捷键里没有和 shell 抢的键（Ctrl+R / Ctrl+L / Ctrl+U 等）', () => {
  // 这些是 shell 自己的；出现在应用表里就意味着会被我们抢走。
  // 注意要按「整条键位」比对：`Ctrl + Tab` 里含有 `Tab` 子串，但它不是裸 Tab。
  const forbidden = ['Ctrl + R', 'Ctrl + L', 'Ctrl + U', 'Ctrl + D', 'Ctrl + W', 'Ctrl + A', 'Ctrl + E', 'Tab']
  for (const row of APP_KEYS) {
    for (const one of String(row[0]).split(' / ')) {
      assert.ok(!forbidden.includes(one.trim()), `应用快捷键不该包含 ${one.trim()}（这是 shell 的键）`)
    }
  }
})

test('shell 快捷键表里明确列出了 Ctrl+R（用户才知道那是 bash 的）', () => {
  assert.ok(keys(SHELL_KEYS).some((k) => k.includes('Ctrl + R')), 'Ctrl+R 必须在 shell 那一栏')
  assert.ok(keys(SHELL_KEYS).some((k) => k === 'Tab'), 'Tab 必须在 shell 那一栏')
})

test('每一项都有明确用途（不是占位符）', () => {
  for (const [k, w] of [...APP_KEYS, ...SHELL_KEYS]) {
    assert.ok(!/TODO|待定|xxx/i.test(w), `${k} 的说明是占位符：${w}`)
  }
})

test('没有重复登记的按键', () => {
  const seen = new Set()
  for (const k of keys(APP_KEYS)) {
    assert.ok(!seen.has(k), `应用快捷键重复：${k}`)
    seen.add(k)
  }
})

test('LiteShell 的核心快捷键都有对应项', () => {
  // 从 LiteShell 的 SHORTCUTS 里挑出我们该有的那些
  const expected = [
    'Ctrl + T', 'Ctrl + B', 'Ctrl + K', 'Ctrl + /',
    'Ctrl + Tab / Ctrl + Shift + Tab', 'Ctrl + 1 … 9', 'Ctrl + Shift + W',
    'Ctrl + Shift + B', 'Ctrl + Shift + M', 'Ctrl + Shift + A',
    'Ctrl + Shift + H', 'Ctrl + Shift + K', 'Esc',
  ]
  for (const want of expected) {
    assert.ok(keys(APP_KEYS).includes(want), `缺少 LiteShell 有而这边没有的快捷键：${want}`)
  }
})

console.log(results.join('\n'))
console.log(`\n${results.filter((r) => r.startsWith('✓')).length}/${results.length} passed`)
