/**
 * Writing the local port into another tool's configuration.
 *
 * The one rule that outranks everything else here: the user already has a
 * working setup. Both files this module touches are live — they hold a
 * third-party relay, MCP servers, project trust entries, plugin lists. A write
 * that loses any of that costs the user a working environment, so every change
 * is additive and the original is backed up first.
 *
 * The planning half is pure: given the file's text, it returns the text to
 * write or a reason it refuses. That is what makes "does not destroy anything"
 * testable without touching a disk.
 *
 * @module src/configure.js
 */

import fs from 'node:fs'
import path from 'node:path'

/** The key this plugin owns inside Claude Code's settings document. */
export const CLAUDE_KEY = 'vyraFree'

/** The provider table this plugin owns inside Codex's config. */
export const CODEX_SECTION = 'model_providers.vyra-free'

/** Everything this plugin writes is addressable by these two ids. */
export const TOOLS = Object.freeze(['claude', 'codex'])

/** `settings.json` for Claude Code, `config.toml` for Codex. */
export function configPathFor(tool, home) {
  if (tool === 'claude') return path.join(home, '.claude', 'settings.json')
  if (tool === 'codex') return path.join(home, '.codex', 'config.toml')
  return undefined
}

/** Where the launcher for one tool lives. */
export function scriptPathFor(tool, home) {
  const name = tool === 'claude' ? 'claude-vyra' : 'codex-vyra'
  return path.join(home, '.dsh', 'dsh-vyra-free-model', 'bin', process.platform === 'win32' ? `${name}.cmd` : name)
}

/** The backup path a write will use. */
export function backupPathFor(file, stamp) {
  return `${file}.vyra-bak-${stamp}`
}

/**
 * Plan a Claude Code write.
 *
 * The values go under `vyraFree`, never into `env`: `env` is where the user's
 * own provider lives, and overwriting it would silently move them onto this
 * port without their asking.
 *
 * @returns {{ ok: boolean, path?: string, before?: string, after?: string, backup?: string, reason?: string }}
 */
export function planClaudeWrite(original, { port, key, model, home = '', stamp = now() }) {
  const text = typeof original === 'string' ? original : ''
  let document
  if (text.trim() === '') {
    document = {}
  } else {
    try {
      document = JSON.parse(text)
    } catch {
      return { ok: false, reason: 'settings.json 不是有效的 JSON，为避免破坏你现有配置，本次不写入。' }
    }
  }
  if (document === null || typeof document !== 'object' || Array.isArray(document)) {
    return { ok: false, reason: 'settings.json 的顶层不是对象，为避免破坏你现有配置，本次不写入。' }
  }

  // Copy at every level we touch, so the caller's object is never mutated and a
  // refusal later cannot leave a half-edited document behind.
  const next = { ...document }
  next[CLAUDE_KEY] = {
    ANTHROPIC_BASE_URL: `http://127.0.0.1:${port}`,
    ANTHROPIC_AUTH_TOKEN: String(key),
    ANTHROPIC_MODEL: String(model),
  }

  return {
    ok: true,
    path: configPathFor('claude', home),
    before: text,
    after: `${JSON.stringify(next, undefined, 2)}\n`,
    backup: backupPathFor(configPathFor('claude', home), stamp),
  }
}

/**
 * Plan a Codex write.
 *
 * The provider table is added; `model_provider` is deliberately left alone. The
 * user's default stays their default, and the plugin's port is used through the
 * launcher script or an explicit `--profile`-style flag instead.
 *
 * @returns {{ ok: boolean, path?: string, before?: string, after?: string, backup?: string, reason?: string }}
 */
export function planCodexWrite(original, { port, home = '', stamp = now() }) {
  const text = typeof original === 'string' ? original : ''
  const checked = checkToml(text)
  if (checked !== undefined) {
    return { ok: false, reason: `config.toml ${checked}，为避免破坏你现有配置，本次不写入。` }
  }

  const header = `[${CODEX_SECTION}]`
  const section = [
    header,
    'name = "Vyra Free Model"',
    `base_url = "http://127.0.0.1:${port}/v1"`,
    'wire_api = "responses"',
  ].join('\n')

  const lines = text.split('\n')
  const kept = []
  let inside = false
  /** Text in front of the first table header — where top-level keys live. */
  const out = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === header) {
      inside = true
      continue
    }
    if (inside) {
      // The section ends at the next table header; blank lines inside it are
      // part of the section being replaced.
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        inside = false
      } else {
        continue
      }
    }
    kept.push(line)
  }
  void out

  // Drop trailing blank lines so the appended section starts cleanly, then
  // restore exactly one separating blank line.
  while (kept.length > 0 && kept[kept.length - 1].trim() === '') kept.pop()
  const body = kept.length === 0 ? section : `${kept.join('\n')}\n\n${section}`

  return {
    ok: true,
    path: configPathFor('codex', home),
    before: text,
    after: `${body}\n`,
    backup: backupPathFor(configPathFor('codex', home), stamp),
  }
}

/**
 * A cheap structural check that catches the mistakes a text append would make
 * worse: an unbalanced bracket or a table header that never closed.
 *
 * This is not a TOML parser and does not pretend to be one. It answers exactly
 * one question — is this document well-formed enough that appending a section
 * cannot corrupt it?
 */
function checkToml(text) {
  const stripped = text.split('\n').filter(line => {
    const trimmed = line.trim()
    return trimmed !== '' && !trimmed.startsWith('#')
  })
  for (const line of stripped) {
    const trimmed = line.trim()
    if (trimmed.startsWith('[') && !trimmed.endsWith(']')) return '有一个未闭合的表头'
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const inner = trimmed.slice(1, -1)
      if (inner.trim() === '') return '有一个空的表头'
      if ((inner.match(/"/g) ?? []).length % 2 !== 0) return '有一个引号未闭合的表头'
    }
    if (!trimmed.startsWith('[') && !trimmed.includes('=')) return `有一行既不是表头也不是赋值（${trimmed.slice(0, 40)}）`
  }
  return undefined
}

/**
 * The launcher a user runs instead of the plain command.
 *
 * This is why nothing has to be made default: the script sets the environment
 * for one invocation and forwards every argument.
 */
export function starterScript(tool, { port, key, model }) {
  if (tool === 'claude') {
    const lines = [
      '@echo off',
      'REM Generated by dsh-vyra-free-model. Runs Claude Code against the local free-model port.',
      `set "ANTHROPIC_BASE_URL=http://127.0.0.1:${port}"`,
      `set "ANTHROPIC_AUTH_TOKEN=${key}"`,
      `set "ANTHROPIC_MODEL=${model}"`,
      'claude %*',
    ]
    return lines.join('\r\n')
  }
  const lines = [
    '@echo off',
    'REM Generated by dsh-vyra-free-model. Runs Codex against the local free-model port.',
    `set "OPENAI_BASE_URL=http://127.0.0.1:${port}/v1"`,
    `set "OPENAI_API_KEY=${key}"`,
    'codex -c model_provider=vyra-free %*',
  ]
  return lines.join('\r\n')
}

/** A filename-safe timestamp for backups. */
export function now() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

/**
 * Carry out a plan on disk.
 *
 * Backup first, then a temp file, then rename: a crash mid-write leaves the
 * original intact rather than truncated.
 */
export function applyPlan(plan) {
  if (plan?.ok !== true || typeof plan.path !== 'string') {
    return { ok: false, reason: plan?.reason ?? '没有可执行的写入计划' }
  }
  try {
    fs.mkdirSync(path.dirname(plan.path), { recursive: true })
    if (plan.before !== undefined && plan.before !== '') {
      fs.writeFileSync(plan.backup, plan.before, { mode: 0o600 })
    }
    const temp = `${plan.path}.${process.pid}.tmp`
    fs.writeFileSync(temp, plan.after, { mode: 0o600 })
    fs.renameSync(temp, plan.path)
    pruneBackups(plan.path)
    return { ok: true, path: plan.path, backup: plan.before === '' ? undefined : plan.backup }
  } catch (error) {
    return { ok: false, reason: String(error?.message ?? error) }
  }
}

/** Keep the newest five backups; older ones are deleted. */
export function pruneBackups(file, keep = 5) {
  try {
    const dir = path.dirname(file)
    const base = `${path.basename(file)}.vyra-bak-`
    const found = fs.readdirSync(dir)
      .filter(name => name.startsWith(base))
      .sort()
    for (const name of found.slice(0, Math.max(0, found.length - keep))) {
      try { fs.unlinkSync(path.join(dir, name)) } catch { /* already gone */ }
    }
  } catch { /* a directory we cannot read has no backups to prune */ }
}

/** The backups available for one file, newest first. */
export function listBackups(file) {
  try {
    const dir = path.dirname(file)
    const base = `${path.basename(file)}.vyra-bak-`
    return fs.readdirSync(dir)
      .filter(name => name.startsWith(base))
      .sort()
      .reverse()
      .map(name => {
        const full = path.join(dir, name)
        return { stamp: name.slice(base.length), path: full, bytes: fs.statSync(full).size }
      })
  } catch {
    return []
  }
}

/** Put a file back exactly as a backup holds it. */
export function restoreFrom(backupPath, file) {
  try {
    const text = fs.readFileSync(backupPath, 'utf8')
    const temp = `${file}.${process.pid}.tmp`
    fs.writeFileSync(temp, text, { mode: 0o600 })
    fs.renameSync(temp, file)
    return { ok: true, path: file, from: backupPath }
  } catch (error) {
    return { ok: false, reason: String(error?.message ?? error) }
  }
}

/**
 * Whether one tool looks configured, by reading its file for this plugin's mark.
 *
 * Deliberately tolerant: an unreadable or missing file is simply "not
 * configured", which is the answer that gives the user a write button.
 */
export function readStatus(tool, home) {
  const file = configPathFor(tool, home)
  if (file === undefined) return { tool, configured: false, backupAt: undefined, stale: false }
  let text = ''
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    return { tool, configured: false, backupAt: undefined, stale: false }
  }
  const backups = listBackups(file)
  const marker = tool === 'claude' ? CLAUDE_KEY : `[${CODEX_SECTION}]`
  const configured = text.includes(marker)
  const port = /127\.0\.0\.1:(\d+)/.exec(text)
  return {
    tool,
    configured,
    port: port === null ? undefined : Number(port[1]),
    backupAt: backups.length === 0 ? undefined : backups[0].stamp,
    stale: false,
  }
}