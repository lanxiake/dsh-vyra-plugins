/**
 * Prove the write plans are safe on the *real* configuration on this machine.
 *
 * Reads the live files (read-only), runs both plans, and checks that every
 * pre-existing key survives. Nothing is written: this only exercises planX.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { planClaudeWrite, planCodexWrite } from '../src/configure.js'

const home = homedir()

// ── Claude Code ─────────────────────────────────────────────────────────────
const claudeFile = join(home, '.claude', 'settings.json')
if (!existsSync(claudeFile)) {
  console.log('[claude] no live settings.json; skipping')
} else {
  const before = readFileSync(claudeFile, 'utf8')
  let original
  try { original = JSON.parse(before) } catch { original = undefined }
  const plan = planClaudeWrite(before, { port: 8899, key: 'sk-dryrun', model: 'kilo-auto/free', home })

  if (plan.ok !== true) {
    console.log('[claude] REFUSED:', plan.reason)
  } else {
    const after = JSON.parse(plan.after)
    const keysBefore = Object.keys(original)
    const keysAfter = Object.keys(after)
    const lost = keysBefore.filter(key => !keysAfter.includes(key))
    const changed = keysBefore.filter(key => JSON.stringify(original[key]) !== JSON.stringify(after[key]))
    console.log('[claude] top-level keys before:', keysBefore.length, '| after:', keysAfter.length)
    console.log('[claude] lost keys:', lost.length === 0 ? 'none' : lost.join(', '))
    console.log('[claude] changed keys:', changed.length === 0 ? 'none' : changed.join(', '))
    const envBefore = Object.keys(original.env ?? {}).length
    const envAfter = Object.keys(after.env ?? {}).length
    console.log('[claude] env entries before/after:', envBefore, '/', envAfter)
    console.log('[claude] new key present:', after.vyraFree !== undefined)
  }
}

// ── Codex ───────────────────────────────────────────────────────────────────
const codexFile = join(home, '.codex', 'config.toml')
if (!existsSync(codexFile)) {
  console.log('[codex] no live config.toml; skipping')
} else {
  const before = readFileSync(codexFile, 'utf8')
  const plan = planCodexWrite(before, { port: 8899, home })

  if (plan.ok !== true) {
    console.log('[codex] REFUSED:', plan.reason)
  } else {
    const headerLines = text => text.split('\n').filter(line => /^\s*\[/.test(line)).map(line => line.trim())
    const beforeHeaders = headerLines(before)
    const afterHeaders = headerLines(plan.after)
    const lostHeaders = beforeHeaders.filter(header => !afterHeaders.includes(header))
    console.log('[codex] sections before:', beforeHeaders.length, '| after:', afterHeaders.length)
    console.log('[codex] lost sections:', lostHeaders.length === 0 ? 'none' : lostHeaders.join(', '))

    // Every key=value line outside our section must survive verbatim.
    const ours = plan.after.slice(plan.after.indexOf('[model_providers.vyra-free]'))
    const theirs = plan.after.slice(0, plan.after.indexOf('[model_providers.vyra-free]'))
    const keyLines = text => text.split('\n')
      .map(line => line.trim())
      .filter(line => line !== '' && !line.startsWith('[') && line.includes('='))
    const beforeKeys = keyLines(before)
    const afterKeys = keyLines(theirs)
    const lostKeys = beforeKeys.filter(line => !afterKeys.includes(line))
    console.log('[codex] key lines before:', beforeKeys.length, '| preserved:', afterKeys.length)
    console.log('[codex] lost key lines:', lostKeys.length === 0 ? 'none' : lostKeys.join(' | '))
    console.log('[codex] model_provider untouched:', theirs.includes('model_provider = "custom"'))
    console.log('[codex] our section:', ours.split('\n')[0].trim(), '->', ours.includes('wire_api = "responses"'))
  }
}
