/**
 * Panel regression checks for the aggregated market UI.
 *
 * The panel is a `window.__ModuleLoader__` bundle that renders through React, so a
 * faithful render test would need a DOM and a React runtime that this package does
 * not depend on. These checks instead pin the four behaviours the rollout changed at
 * the string level: which RPC the market calls, that the category sidebar is built
 * from the Chinese labels on every tab, that the card button reads 目录, and that a
 * failing source surfaces as 不可达 rather than as an empty market.
 *
 * They are deliberately narrow: they fail if the contract drifts, and they are not a
 * substitute for opening the panel in a running DSH, which Task 8 does.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(here, '..', 'client.js'), 'utf8')

test('技能市场默认调用聚合通道，不再要求先选源', () => {
  assert.match(source, /call\('skills\.aggregate'/)
  assert.ok(!/call\('skills\.search', \{\s*\n\s*query[\s\S]{0,200}?source: opts\.source \|\| source/.test(source))
})

test('MCP 市场默认走 all，单源只是过滤条件', () => {
  assert.match(source, /call\('mcp\.search', \{[\s\S]{0,200}?source: opts\.source \|\| 'all'/)
})

test('分类侧栏在任何标签页都显示，不是只有市场页', () => {
  assert.match(source, /const showSidebar = !customItems && categoryList\.length >= 2/)
})

test('分类用中文标签，而不是上游原始值', () => {
  assert.match(source, /item\.categoryLabel \|\| item\.category/)
})

test('有源失败时显示不可达提示', () => {
  assert.match(source, /个源不可达/)
})

test('技能卡片按钮文案是「目录」', () => {
  assert.match(source, /\}, '目录'\)/)
  assert.ok(!source.includes("'打开目录'"))
})
