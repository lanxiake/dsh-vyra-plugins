// The read-only `vyra-console` CLI, tested by SPAWNING it the way an agent does.
//
//   node --test plugins/vyra-dsh-console/test/cli.test.mjs
//
// Two things are being established, and they are different:
//
//   1. **It answers.** Each command produces the documented shape in both output
//      modes, exit codes mean what the usage text says, `--json` is stable and
//      pipeable, and the profile is resolved the way the market CLI resolves it.
//   2. **It never writes.** The binding constraint of this file. It is proven
//      against a FIXTURE profile under the OS temp directory — never the user's
//      real `~/.dsh` — by hashing the whole fixture tree (paths, sizes and
//      contents) before and after every command in every mode, and asserting the
//      digest is byte-identical. That digest is the guard for "this CLI must not
//      touch the profile", and it is mutation-tested in the task report.
//
// A spawned process is used rather than an import, deliberately: this is the
// surface an agent invokes (`node cli.mjs …`), so the thing under test is the
// real thing — argv parsing, stdout/stderr split and `process.exitCode`
// included. An in-process import would test none of those.
import { strict as assert } from 'node:assert'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const CLI = resolve(import.meta.dirname, '..', 'cli.mjs')

/**
 * Run the CLI against one DSH home, exactly as a caller would.
 *
 * `DSH_HOME` is set so nothing under test can reach the real `~/.dsh`: a bug
 * that made the CLI read or write the user's live profile would show up here as
 * a fixture assertion failing, and — more importantly — would not damage the
 * user's installation while the suite runs. `HOME`/`USERPROFILE` are left alone
 * so `homedir()` still works; `DSH_HOME` is the documented override and is what
 * the CLI gives precedence.
 *
 * PATH is inherited but the CLI never spawns anything: it imports no
 * `node:child_process`, which is itself part of the read-only construction.
 */
function runCli(home, args) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    env: { ...process.env, DSH_HOME: home, DSH_PROFILE: undefined },
    timeout: 30000,
  })
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    get json() {
      return JSON.parse(result.stdout)
    },
  }
}

/**
 * A fixture DSH home: a settings document, and one profile with a manifest and a
 * patch layer.
 *
 * The files are written to the shapes the real ones use — `settings.yaml` at the
 * HOME beside `profiles/<name>/`, `cordis.patch.yml` as a sequence of `- id:`
 * entries, `package.json` carrying `dsh.profile.bundles` and `dependencies` —
 * because the point is to test the CLI against the format it claims to read, not
 * against a convenient invention. Every one of those shapes was taken from a
 * real file on this machine.
 */
function makeHome() {
  const home = mkdtempSync(join(tmpdir(), 'vyra-console-cli-'))
  const profile = join(home, 'profiles', 'desktop')
  mkdirSync(join(profile, 'node_modules', 'vyra-theme-styles'), { recursive: true })
  mkdirSync(join(profile, 'node_modules', 'dsh-plugin'), { recursive: true })

  writeFileSync(join(home, 'settings.yaml'), [
    '# fixture settings document',
    'agent-default-model:',
    '  provider: cli-claude',
    '  model: default',
    'ui-theme:',
    '  preference: light',
    '',
  ].join('\n'))

  // A real installed package, so the version is read from node_modules rather
  // than falling back to the declared spec.
  writeFileSync(join(profile, 'node_modules', 'vyra-theme-styles', 'package.json'),
    JSON.stringify({ name: 'vyra-theme-styles', version: '9.9.9', dsh: { client: { platform: 'web' } } }, null, 2))
  writeFileSync(join(profile, 'node_modules', 'dsh-plugin', 'package.json'),
    JSON.stringify({ name: 'dsh-plugin', version: '2.3.9' }, null, 2))

  writeFileSync(join(profile, 'package.json'), JSON.stringify({
    name: 'dsh-profile-desktop',
    private: true,
    dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', 'vyra-theme-styles', 'dsh-plugin'] } },
    dependencies: {
      '@deepseek-ai/dsh-base': '1.0.0',
      'dsh-plugin': '2.3.9',
      'vyra-theme-styles': 'github:lanxiake/dsh-vyra-plugins#abc&path:plugins/vyra-theme-styles',
    },
  }, null, 2))

  writeFileSync(join(profile, 'cordis.patch.yml'), [
    '# fixture patch layer',
    '- id: ui-theme',
    '  name: "@deepseek-ai/dsh-client-ui-theme"',
    '  config:',
    '    preference: light',
    '- id: llm-pi-ai',
    '  name: "@deepseek-ai/dsh-llm-pi-ai"',
    '  config:',
    '    providers:',
    '      ydy-ds:',
    '        displayName: ydy-ds',
    '      local-ollama:',
    '        displayName: local-ollama',
    '- id: deepseek-v4.1-flash',
    '  disabled: true',
    'mcpServers:',
    '  filesystem:',
    '    command: npx',
    '  github:',
    '    command: npx',
    '',
  ].join('\n'))

  return { home, profile }
}

/**
 * A digest of every path, size and content byte under a directory.
 *
 * The read-only proof. It covers the WHOLE tree — including the `node_modules`
 * manifests and any file a command might add — because "nothing changed" has to
 * mean nothing, not "the files I remembered to check are unchanged". An added
 * file changes the digest as surely as an edited one, and a `--json` run that
 * quietly wrote a cache would be caught here.
 *
 * Directories are listed in sorted order so the digest is deterministic, and
 * symlinks are recorded by their target rather than followed.
 */
function treeDigest(root) {
  const hash = createHash('sha256')
  const visit = (dir, prefix) => {
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
    for (const entry of entries) {
      const path = join(dir, entry.name)
      const relative = `${prefix}${entry.name}`
      const stat = statSync(path)
      if (stat.isDirectory()) {
        hash.update(`dir ${relative}\n`)
        visit(path, `${relative}/`)
      } else {
        hash.update(`file ${relative} ${stat.size}\n`)
        hash.update(readFileSync(path))
        hash.update('\n')
      }
    }
  }
  visit(root, '')
  return hash.digest('hex')
}

/** Every command this CLI implements, with the arguments each is run with. */
const COMMANDS = [
  ['doctor'],
  ['state'],
  ['services'],
  ['events'],
  ['doctor', '--json'],
  ['state', '--json'],
  ['services', '--json'],
  ['events', '--json'],
  ['--help'],
  ['doctor', '--profile=desktop'],
]

// ---------------------------------------------------------------------------
// The read-only constraint: the fixture tree is byte-identical afterwards.
// ---------------------------------------------------------------------------

test('no command changes anything in the profile, in either output mode', () => {
  // THE guard for this task's binding constraint. Every command, in both output
  // modes, against a real fixture tree, with the digest compared before and
  // after each run — so a command that wrote on only some of its paths would
  // still be caught at the run that did it.
  const { home } = makeHome()
  try {
    for (const args of COMMANDS) {
      const before = treeDigest(home)
      const result = runCli(home, args)
      assert.equal(result.status, 0, `${args.join(' ')} must succeed: ${result.stderr}`)
      assert.equal(treeDigest(home), before,
        `${args.join(' ')} modified the fixture profile — this CLI must never write`)
    }
    // And the whole sequence again as one run, so a write that only happens on a
    // SECOND invocation (a cache, a lock file) cannot hide behind per-run checks.
    const before = treeDigest(home)
    for (const args of COMMANDS) runCli(home, args)
    assert.equal(treeDigest(home), before, 'a repeated run modified the fixture profile')
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('a refused mutating action does not touch the profile either', () => {
  // A refusal must be a refusal, not a refusal after a write. These are the
  // verbs most likely to be implemented as a mutation by a future change.
  const { home } = makeHome()
  try {
    const before = treeDigest(home)
    for (const verb of ['plugin.remove', 'plugin.install', 'settings.set', 'model.select', 'mcp.restart', 'appearance.setTheme', 'remove']) {
      const result = runCli(home, [verb])
      assert.equal(result.status, 1, `${verb} must be refused with a non-zero exit`)
      assert.equal(treeDigest(home), before, `${verb} modified the fixture profile`)
    }
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('the CLI imports no writer and no process spawner from node', async () => {
  // Read-only by construction, asserted on the source rather than trusted: the
  // absence of a write binding is what makes "no code path writes" a property of
  // the file instead of a claim about its current behaviour. `node:child_process`
  // is included because nothing stops a plugin shelling out to something that
  // writes, and this CLI must not be able to.
  const source = readFileSync(CLI, 'utf8')

  // Only the import lines are inspected, so the prose above them (which names
  // `writeFileSync` while explaining that it is absent) cannot satisfy or break
  // this check.
  const imports = source.split('\n').filter((line) => /^\s*import\s/.test(line))
  assert.ok(imports.length >= 2, 'the CLI must import what it uses')
  for (const line of imports) {
    // Every import is either a `node:` builtin or a same-plugin relative path.
    // Anything else would be an undeclared dependency, which this plugin cannot
    // have: it is plain ESM with no `node_modules` of its own.
    assert.match(line, /from '(?:node:|\.\/)/,
      `every import must be a node: builtin or same-plugin relative: ${line}`)
  }
  const specifiers = imports.join('\n')
  assert.ok(imports.some((line) => /from '\.\//.test(line)),
    'the action tables must be imported from this plugin, not restated')
  assert.match(specifiers, /from '\.\/core\.js'/, 'the action tables come from core.js, not a copy')

  for (const forbidden of ['writeFileSync', 'appendFileSync', 'mkdirSync', 'rmSync', 'unlinkSync', 'rmdirSync', 'createWriteStream', 'copyFileSync', 'renameSync', 'truncateSync', 'chmodSync', 'node:child_process', 'node:worker_threads']) {
    assert.equal(imports.some((line) => line.includes(forbidden)), false,
      `${forbidden} must not be imported: this CLI is read-only by construction`)
  }
})

// ---------------------------------------------------------------------------
// The read-only guard: a mutating verb is refused, and says what to call.
// ---------------------------------------------------------------------------

test('every mutating action in core.js is refused by the CLI', () => {
  // The table is DERIVED from `ACTIONS`, so this cannot go stale: the moment a
  // mutating action is added to the registry, the CLI refuses its name too. The
  // assertion is on the refusal, so a CLI that quietly implemented one of these
  // would fail here rather than at review time.
  const { home } = makeHome()
  try {
    const source = readFileSync(resolve(import.meta.dirname, '..', 'core.js'), 'utf8')
    const mutations = [...source.matchAll(/'(?<action>[a-z]+\.[A-Za-z]+)':\s*\{[^}]*mutating:\s*true/g)]
      .map((match) => match.groups.action)
    assert.ok(mutations.length >= 8, `expected the mutating actions to be found (got ${mutations.length})`)

    for (const action of mutations) {
      const result = runCli(home, [action])
      assert.equal(result.status, 1, `${action} must be refused`)
      assert.match(result.stdout, /read-only/i, `${action}'s refusal must say the CLI is read-only`)
      assert.match(result.stdout, /dsh_console/, `${action}'s refusal must name the tool that can do it`)
      assert.match(result.stdout, new RegExp(`action="${action.replace('.', '\\.')}"`),
        `${action}'s refusal must name the exact tool action`)
    }
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('the refusal is reported as JSON when --json is asked for', () => {
  const { home } = makeHome()
  try {
    const result = runCli(home, ['plugin.remove', '--json'])
    assert.equal(result.status, 1)
    const value = result.json
    assert.equal(value.ok, false)
    assert.equal(value.refused, true)
    assert.equal(value.action, 'plugin.remove')
    assert.equal(value.tool.name, 'dsh_console')
    assert.equal(value.tool.action, 'plugin.remove')
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('the read-only boundary is stated in the usage text', () => {
  const { home } = makeHome()
  try {
    const result = runCli(home, ['--help'])
    assert.equal(result.status, 0)
    assert.match(result.stdout, /READ-ONLY/)
    assert.match(result.stdout, /no --apply/)
    assert.match(result.stdout, /dsh_console/)
    for (const command of ['doctor', 'state', 'services', 'events']) {
      assert.match(result.stdout, new RegExp(`^\\s+${command}\\s`, 'm'), `${command} must be documented`)
    }
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('a non-mutating but action-shaped verb is refused too, never dispatched', () => {
  // `plugin.list` IS read-only, but this CLI has no dispatcher: performing it
  // would mean reimplementing a domain, which is the "one operation, two
  // callers" violation this plugin forbids. The refusal names the tool.
  const { home } = makeHome()
  try {
    for (const verb of ['actions', 'action']) {
      const result = runCli(home, [verb])
      assert.equal(result.status, 2, `${verb} must be refused as bad usage`)
      assert.match(result.stderr, /read-only/)
      assert.match(result.stderr, /dsh_console/)
    }
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('a bare mutating verb is refused, never guessed at when ambiguous', () => {
  // `remove` alone must still reach the refusal: an agent that half-remembers
  // the surface should be told that removing is a tool call, not that its
  // command was unknown.
  const { home } = makeHome()
  try {
    const bare = runCli(home, ['remove'])
    assert.equal(bare.status, 1)
    assert.match(bare.stdout, /plugin\.remove/)
    assert.match(bare.stdout, /dsh_console/)

    // The suffixed forms too, and nothing else: every mutating action's last
    // segment must be refused, because the suffix lookup is what makes a
    // half-remembered verb safe.
    const source = readFileSync(resolve(import.meta.dirname, '..', 'core.js'), 'utf8')
    const suffixes = [...source.matchAll(/'(?<action>[a-z]+\.[A-Za-z]+)':\s*\{[^}]*mutating:\s*true/g)]
      .map((match) => match.groups.action.split('.').at(-1))
    for (const suffix of new Set(suffixes)) {
      const result = runCli(home, [suffix])
      assert.equal(result.status, 1, `${suffix} must be refused`)
      assert.match(result.stdout, /dsh_console/, `${suffix} must name the tool`)
    }
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('the ambiguity fallback refuses to nominate an action, and is driven directly', async () => {
  // The branch the CLI takes when two mutating actions share a last segment —
  // which is reachable the moment someone adds `theme.set` beside
  // `settings.set`, and is unreachable in today's registry. Asserting it through
  // the CLI could never fail while the registry happens to be unambiguous, so it
  // is driven against the module's own rule instead: two matches means no
  // nomination, and that is the difference between a refusal and a guess.
  //
  // The rule is read out of the source as an executable expression, because the
  // CLI is a script with no exports; wrapping it keeps this honest about testing
  // the shipped code rather than a paraphrase of it.
  const source = readFileSync(CLI, 'utf8')
  const rule = /(const match = ADVISORY_OPERATIONS\[command\][\s\S]*?return matches\.length === 1 \? ADVISORY_OPERATIONS\[matches\[0\]\] : undefined)/
  const found = rule.exec(source)
  assert.ok(found, 'the ambiguity rule must exist in the CLI')
  const refuse = new Function('ADVISORY_OPERATIONS', 'command', found[1])
  const table = { 'settings.set': { action: 'settings.set' }, 'theme.set': { action: 'theme.set' } }
  assert.equal(refuse(table, 'set'), undefined, 'an ambiguous bare verb must not nominate one action')
  assert.equal(refuse(table, 'settings.set')?.action, 'settings.set', 'the full name still resolves')
})

// ---------------------------------------------------------------------------
// doctor: one actionable summary, read from real files.
// ---------------------------------------------------------------------------

test('doctor reports the installed bundles with the version installed on disk', () => {
  const { home } = makeHome()
  try {
    const value = runCli(home, ['doctor', '--json']).json
    assert.equal(value.profile.name, 'desktop')
    assert.equal(value.profile.present, true)
    assert.equal(value.bundles.count, 3)
    const byName = Object.fromEntries(value.bundles.installed.map((b) => [b.name, b]))
    // Installed version wins over the declared spec, and the spec is kept.
    assert.equal(byName['vyra-theme-styles'].version, '9.9.9')
    assert.equal(byName['vyra-theme-styles'].versionFrom, 'node_modules package.json')
    assert.match(byName['vyra-theme-styles'].spec, /^github:/)
    // No readable package.json: the version is null and says why, never a guess.
    assert.equal(byName['@deepseek-ai/dsh-base'].version, null)
    assert.match(byName['@deepseek-ai/dsh-base'].versionFrom, /declared spec/)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('doctor reads the model selection from the settings document at the DSH home', () => {
  // The location matters and was got wrong once: `settings.yaml` sits at the DSH
  // HOME beside `profiles/`, not inside the profile directory. A CLI that looked
  // in the profile reported `unknown` for a configured selection.
  const { home, profile } = makeHome()
  try {
    const value = runCli(home, ['doctor', '--json']).json
    assert.equal(value.model.status, 'ok')
    assert.equal(value.model.selection.provider.value, 'cli-claude')
    assert.equal(value.model.selection.model.value, 'default')
    assert.equal(value.model.selection.provider.path, join(home, 'settings.yaml'))
    // And it is NOT the profile's own file.
    assert.equal(existsSync(join(profile, 'settings.yaml')), false)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('doctor reports the provider adapters the patch layer declares', () => {
  const { home } = makeHome()
  try {
    const value = runCli(home, ['doctor', '--json']).json
    assert.deepEqual(value.model.providers.map((p) => p.name), ['ydy-ds', 'local-ollama'])
    assert.match(value.model.providers[0].source, /llm-pi-ai/)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('doctor never reports a theme as a provider', () => {
  // A defect this suite was written against: an entry was treated as a provider
  // because it had a `name:` field, which every patch entry has, so `ui-theme`
  // was reported as a provider. Only a `providers:` map counts.
  const { home } = makeHome()
  try {
    const value = runCli(home, ['doctor', '--json']).json
    assert.equal(value.model.providers.some((p) => p.name === 'ui-theme'), false,
      'a theme entry must never be reported as a provider')
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('doctor reports appearance plugins by name, and says the name test is a shortlist', () => {
  const { home } = makeHome()
  try {
    const value = runCli(home, ['doctor', '--json']).json
    assert.ok(value.appearance.byName.includes('vyra-theme-styles'))
    assert.equal(value.appearance.byName.includes('dsh-plugin'), false)
    // Evidence a package can reach the browser is kept separate from a name
    // match, and the note says which of the two answers "is a theme installed?".
    const manifestNames = value.appearance.byManifest.map((p) => p.name)
    assert.deepEqual(manifestNames, ['vyra-theme-styles'])
    assert.deepEqual(value.appearance.byManifest[0].platforms, ['web'])
    assert.match(value.appearance.note, /appearance\.state/)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('doctor reports the MCP servers the profile patch declares', () => {
  const { home } = makeHome()
  try {
    const value = runCli(home, ['doctor', '--json']).json
    assert.equal(value.mcp.found, true)
    assert.deepEqual(value.mcp.declared, ['filesystem', 'github'])
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('doctor says so explicitly when there is no MCP block, rather than reporting none running', () => {
  const { home, profile } = makeHome()
  try {
    writeFileSync(join(profile, 'cordis.patch.yml'), '- id: ui-theme\n  name: "@deepseek-ai/dsh-client-ui-theme"\n')
    const value = runCli(home, ['doctor', '--json']).json
    assert.equal(value.mcp.found, false)
    assert.deepEqual(value.mcp.declared, [])
    assert.match(value.mcp.reason, /mcpServers/)
    // The distinction that matters: absence of a declaration is not evidence
    // that nothing runs.
    assert.match(value.mcp.note, /mcp\.list/)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('doctor reports a plugin the patch layer disabled as disabled', () => {
  const { home } = makeHome()
  try {
    const value = runCli(home, ['doctor', '--json']).json
    const byName = Object.fromEntries(value.bundles.installed.map((b) => [b.name, b]))
    // `deepseek-v4.1-flash` is the entry the fixture disables, and it is not a
    // dependency — so an installed bundle with no patch entry is `unknown`
    // rather than a confident `enabled`.
    assert.equal(byName['vyra-theme-styles'].enabled, 'unknown')
    const state = runCli(home, ['state', '--json']).json
    const entry = state.enablement.entries.find((e) => e.id === 'deepseek-v4.1-flash')
    assert.ok(entry, 'the disabled entry must be listed')
    assert.equal(entry.status, 'disabled')
    // And the id is the entry's own id, never the literal field name `id`.
    assert.deepEqual(state.enablement.entries.map((e) => e.id),
      ['ui-theme', 'llm-pi-ai', 'deepseek-v4.1-flash'])
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('doctor states its own limitation instead of under-reporting silently', () => {
  // The bar this command is held to: a confidently wrong doctor is worse than an
  // incomplete one, so everything it cannot see from files is written down.
  const { home } = makeHome()
  try {
    const value = runCli(home, ['doctor', '--json']).json
    assert.ok(Array.isArray(value.caveats) && value.caveats.length > 0)
    const text = value.caveats.join(' ')
    assert.match(text, /RUNNING/)
    assert.match(text, /dsh_console/)
    // The bundle note repeats it where the field is read.
    assert.match(value.bundles.note, /dsh_console/)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('doctor reports the console surface and the forbidden boundary from core.js', () => {
  const { home } = makeHome()
  try {
    const value = runCli(home, ['doctor', '--json']).json
    assert.equal(value.console.source, 'core.js')
    assert.equal(value.console.total, 21)
    assert.equal(value.console.mutating.length, 12)
    assert.deepEqual(value.console.forbidden.map((f) => f.name),
      ['sandbox.setMode', 'permission.setPreset', 'approval.answer', 'credentials.set'])
    for (const entry of value.console.forbidden) {
      assert.ok(entry.reason, `${entry.name} must carry its reason`)
      assert.ok(entry.alternative, `${entry.name} must carry its alternative`)
    }
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('doctor does not invent a model selection it cannot read', () => {
  // An honest `unknown` is the required answer here. With no settings document
  // at all, reporting a model would be a fabrication.
  const { home } = makeHome()
  try {
    rmSync(join(home, 'settings.yaml'))
    const value = runCli(home, ['doctor', '--json']).json
    assert.equal(value.model.status, 'unknown')
    assert.equal(value.model.selection, null)
    assert.match(value.model.reason, /no settings document/)
    // It still reports the providers, which come from the profile's own patch.
    assert.deepEqual(value.model.providers.map((p) => p.name), ['ydy-ds', 'local-ollama'])
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('doctor reports unknown when the settings document declares no selection', () => {
  const { home } = makeHome()
  try {
    writeFileSync(join(home, 'settings.yaml'), 'ui-theme:\n  preference: light\n')
    const value = runCli(home, ['doctor', '--json']).json
    assert.equal(value.model.status, 'unknown')
    assert.equal(value.model.selection, null)
    assert.match(value.model.reason, /agent-default-model/)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('doctor reports unknown rather than empty when the manifest is unreadable', () => {
  const { home, profile } = makeHome()
  try {
    writeFileSync(join(profile, 'package.json'), '{ this is not json')
    const value = runCli(home, ['doctor', '--json']).json
    assert.equal(value.bundles.count, 0)
    // The caveat is what keeps "0 bundles" from reading as "nothing installed".
    assert.match(value.caveats.join(' '), /not valid JSON/)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// The documented surface, the output contract and the exit codes.
// ---------------------------------------------------------------------------

test('each command reports the profile it read, and where that came from', () => {
  const { home, profile } = makeHome()
  try {
    for (const command of ['doctor', 'state', 'services', 'events']) {
      const value = runCli(home, [command, '--json']).json
      assert.equal(value.profile.name, 'desktop', `${command} must name the profile`)
      assert.equal(value.profile.dir, profile, `${command} must report the directory it read`)
      assert.equal(value.profile.present, true)
      assert.ok(['--profile', 'DSH_PROFILE', 'default'].includes(value.profile.source),
        `${command} must say how the profile was chosen`)
    }
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('--profile selects the profile, over the environment', () => {
  const { home } = makeHome()
  try {
    mkdirSync(join(home, 'profiles', 'other'), { recursive: true })
    writeFileSync(join(home, 'profiles', 'other', 'package.json'), JSON.stringify({ dependencies: {} }))
    const result = runCli(home, ['doctor', '--json', '--profile=other'])
    assert.equal(result.status, 0)
    assert.equal(result.json.profile.name, 'other')
    assert.equal(result.json.profile.source, '--profile')
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('a missing profile is a real failure, with the path and a non-zero exit', () => {
  // Not a silent empty success: "there is no profile here" and "this profile is
  // empty" call for different actions, and reporting the second when the first
  // is true would send an agent looking for a problem that does not exist.
  const { home } = makeHome()
  try {
    for (const args of [['--profile=ghost', 'doctor'], ['--profile=ghost', 'state'], ['--profile=ghost', 'services'], ['--profile=ghost', 'events']]) {
      const result = runCli(home, args)
      assert.notEqual(result.status, 0, `${args.join(' ')} must fail`)
      assert.match(result.stderr, /ghost/)
      assert.match(result.stderr, /profiles/)
    }
    // With --json the failure is still machine-readable, on stdout, and the
    // process still exits non-zero.
    const json = runCli(home, ['--profile=ghost', 'doctor', '--json'])
    assert.notEqual(json.status, 0)
    assert.equal(json.json.ok, false)
    assert.equal(json.json.profile.present, false)
    assert.match(json.json.error, /ghost/)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('--json writes valid JSON to stdout and nothing else', () => {
  // "Pipeable" is the requirement, so this is what it means: stdout parses as
  // one JSON document and carries no banner, no progress line and no warning.
  const { home } = makeHome()
  try {
    for (const command of ['doctor', 'state', 'services', 'events']) {
      const result = runCli(home, [command, '--json'])
      assert.equal(result.status, 0, `${command}: ${result.stderr}`)
      assert.doesNotThrow(() => JSON.parse(result.stdout), `${command} must emit valid JSON`)
      assert.equal(result.stdout.trimEnd().endsWith('}'), true, `${command} must emit one JSON object`)
      assert.equal(result.stdout.includes('\r\n'), false, `${command} must not emit CRLF`)
    }
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('--json is stable: the same fields every run, and no undefined anywhere', () => {
  // Two properties at once. Stability is what lets an agent parse it without
  // guessing; the absence of `undefined` matters because a key holding
  // `undefined` disappears in JSON, so a caller cannot tell "absent" from
  // "present and empty" — the Task 5 Critical, applied to this output.
  const { home } = makeHome()
  try {
    for (const command of ['doctor', 'state', 'services', 'events']) {
      const first = runCli(home, [command, '--json'])
      const second = runCli(home, [command, '--json'])
      assert.equal(first.stdout, second.stdout, `${command} must be byte-stable across runs`)
      const keys = (value, path = '$') => {
        if (value === null || typeof value !== 'object') return []
        return Object.entries(value).flatMap(([key, entry]) => [
          `${path}.${key}`,
          ...keys(entry, `${path}.${key}`),
        ])
      }
      // Round-tripping proves nothing was lost, which is exactly the evidence
      // `undefined` would destroy; the explicit scan names the offender.
      const reparsed = JSON.parse(first.stdout)
      assert.deepEqual(Object.keys(reparsed).sort(), Object.keys(first.json).sort())
      for (const path of keys(reparsed)) {
        assert.notEqual(path.split('.').at(-1), 'undefined', `${command} emitted a key named undefined`)
      }
      assert.equal(/(^|[\s:[,])undefined([\s,}\]]|$)/m.test(first.stdout), false,
        `${command} emitted a bare undefined`)
    }
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('a bad invocation exits 2 with the usage text, distinct from a real failure', () => {
  const { home } = makeHome()
  try {
    const unknown = runCli(home, ['bogus'])
    assert.equal(unknown.status, 2)
    assert.match(unknown.stderr, /unknown command/)
    assert.match(unknown.stderr, /vyra-console <command>/)

    const badOption = runCli(home, ['doctor', '--nope'])
    assert.equal(badOption.status, 2)
    assert.match(badOption.stderr, /unknown option --nope/)

    const extraArg = runCli(home, ['doctor', 'extra'])
    assert.equal(extraArg.status, 2)
    assert.match(extraArg.stderr, /takes no arguments/)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('--help wins over a command, and no command prints the usage', () => {
  const { home } = makeHome()
  try {
    for (const args of [['--help'], ['doctor', '--help'], [], ['help']]) {
      const result = runCli(home, args)
      assert.equal(result.status, 0, `${args.join(' ') || '(none)'} must print usage and succeed`)
      assert.match(result.stdout, /vyra-console <command>/)
    }
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('the human output states the same facts as the JSON, in a readable form', () => {
  const { home } = makeHome()
  try {
    const human = runCli(home, ['doctor'])
    assert.equal(human.status, 0)
    assert.equal(human.stderr, '', 'a successful human run must not write to stderr')
    for (const expected of [
      'vyra-console doctor',
      'bundles (3 installed',
      'vyra-theme-styles',
      'cli-claude',
      'ydy-ds',
      'mcp:',
      'forbidden',
      'caveats:',
    ]) {
      assert.ok(human.stdout.includes(expected), `the human report must include ${JSON.stringify(expected)}`)
    }
    // The appearance count is labelled for what it measures. The fixture has 3
    // packages and exactly 1 declares a `dsh.client` half, so a renderer that
    // padded the count would be visible here rather than merely wrong.
    assert.match(human.stdout, /can reach browser 1 of 3 packages declare a dsh half/)
    // Nothing reads as a live service list: the note is present.
    assert.match(human.stdout, /dsh_console/)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('services reports declaration evidence per row, never a live service list', () => {
  const { home } = makeHome()
  try {
    const value = runCli(home, ['services', '--json']).json
    const rows = Object.fromEntries(value.services.map((row) => [row.service, row]))
    // dsh-plugin IS installed in the fixture, so pluginManager has evidence.
    assert.equal(rows.pluginManager.declared, true)
    assert.ok(rows.pluginManager.evidence.some((e) => e.includes('dsh-plugin')))
    // dsh-im is NOT installed, so there is no evidence — reported as such.
    assert.equal(rows.im.declared, false)
    assert.deepEqual(rows.im.evidence, [])
    assert.match(value.caveats.join(' '), /unavailable/)
    // A row never claims liveness.
    for (const row of value.services) assert.match(row.note, /running DSH|active/)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('events enumerates log directories and checks each one exists', () => {
  const { home, profile } = makeHome()
  try {
    mkdirSync(join(home, 'logs'), { recursive: true })
    const value = runCli(home, ['events', '--json']).json
    const byPath = Object.fromEntries(value.logs.map((row) => [row.path, row.present]))
    assert.equal(byPath[join(home, 'logs')], true, 'a directory that exists is reported present')
    assert.equal(byPath[join(profile, 'logs')], false, 'a directory that does not exist is reported absent')
    for (const row of value.logs) assert.equal(typeof row.present, 'boolean')
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('the CLI resolves the profile inside DSH_HOME, not a hard-coded home', () => {
  // The fixture only works at all if this is true, so this test states it
  // directly: a CLI that ignored DSH_HOME would read the user's real profile
  // during every other test in this file.
  const { home, profile } = makeHome()
  try {
    assert.ok(profile.startsWith(home), 'the fixture must be self-contained')
    const value = runCli(home, ['doctor', '--json']).json
    assert.ok(value.profile.dir.startsWith(home), `the CLI must resolve inside DSH_HOME (got ${value.profile.dir})`)
    assert.equal(value.files.manifest.path, join(profile, 'package.json'))
    assert.equal(value.files.patch.path, join(profile, 'cordis.patch.yml'))
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('a profile directory with no manifest still answers, and says what is missing', () => {
  // A half-created profile must not crash the diagnostic tool: that is exactly
  // when someone runs it.
  const { home, profile } = makeHome()
  try {
    rmSync(join(profile, 'package.json'))
    const result = runCli(home, ['doctor', '--json'])
    assert.equal(result.status, 0)
    assert.equal(result.json.bundles.count, 0)
    assert.match(result.json.caveats.join(' '), /no package\.json/)
    assert.equal(result.json.files.manifest.present, false)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})
