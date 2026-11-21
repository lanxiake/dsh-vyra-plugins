// The hook migration: versions up to 3.1.0 shipped `interceptRightClick: true` by default, and
// an untouched profile still has that value on disk. Loading it must turn the hook off exactly
// once — but a user who deliberately turned it on must keep it. Both branches are one assertion
// each, because getting this wrong either leaves remote sessions sticky or ignores a real choice.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Write a settings file under a throwaway DSH_HOME and load it through a fresh module. */
async function loadWith(settings) {
  const home = mkdtempSync(join(tmpdir(), 'dsh-system-selection-'))
  process.env.DSH_HOME = home
  const dir = join(home, 'storages', 'system-selection')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'settings.json'), JSON.stringify({ enabled: true, settings }))
  // A query string busts the module cache, so FILE (computed at import) points at the new home.
  const mod = await import(`../store.js?case=${Date.now()}-${Math.random()}`)
  return mod.loadSettings()
}

test('the old default hook-on is migrated off', async () => {
  const loaded = await loadWith({ interceptRightClick: true })
  assert.equal(loaded.settings.interceptRightClick, false)
  assert.equal(loaded.migrated, true)
})

test('a deliberate hook-on choice survives', async () => {
  const loaded = await loadWith({ interceptRightClick: true, rightClickExplicit: true })
  assert.equal(loaded.settings.interceptRightClick, true)
  assert.equal(loaded.migrated, false)
})

test('a fresh profile starts with the hook off', async () => {
  const loaded = await loadWith({})
  assert.equal(loaded.settings.interceptRightClick, false)
  assert.equal(loaded.migrated, false)
})
