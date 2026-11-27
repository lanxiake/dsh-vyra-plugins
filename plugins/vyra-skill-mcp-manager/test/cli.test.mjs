import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const cli = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'cli.mjs')
const run = (args) => execFileSync(process.execPath, [cli, ...args], { encoding: 'utf8' })

test('--help 列出全部命令且不含任何升级命令', () => {
  const out = run(['--help'])
  for (const cmd of ['search', 'info', 'list', 'categories', 'open-dir', 'install', 'uninstall', 'enable', 'disable', 'mcp']) {
    assert.match(out, new RegExp(cmd))
  }
  assert.ok(!/upgrade/i.test(out))
})

test('categories --json 返回 10 个中文分类', () => {
  const rows = JSON.parse(run(['categories', '--json']))
  assert.equal(rows.categories.length, 10)
  assert.equal(rows.categories[0].label, '软件开发')
})

test('install 不带 --apply 只输出计划，不改磁盘', () => {
  const plan = JSON.parse(run(['install', 'demo-skill', '--json']))
  assert.equal(plan.applied, undefined)
  assert.ok(plan.actions.length > 0)
  assert.equal(plan.actions[0].tool, 'skill_market_install')
})

test('uninstall 不带 --apply 只输出计划', () => {
  const plan = JSON.parse(run(['uninstall', 'demo-skill', '--json']))
  assert.equal(plan.applied, undefined)
  assert.equal(plan.actions[0].tool, 'skill_market_uninstall')
})

test('mcp install 也不提供升级命令', () => {
  const out = run(['mcp', '--help'])
  assert.match(out, /search/)
  assert.ok(!/upgrade/i.test(out))
})
