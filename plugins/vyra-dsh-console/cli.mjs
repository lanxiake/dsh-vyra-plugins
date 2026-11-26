#!/usr/bin/env node
/**
 * The read-only `vyra-console` CLI: the diagnostic path an agent uses instead of
 * burning tool calls, and the fallback when the DSH process holding the answer is
 * not the one the agent is talking to.
 *
 * ── The binding constraint: this file never writes ──────────────────────────
 *
 * There is no `--apply` here, and that is deliberate rather than unfinished
 * (`docs/superpowers/specs/2026-11-23-vyra-dsh-console-design.md` §5). Every
 * change to this installation goes through the host's own services, because only
 * they use the same profile lock, activation and rollback path as the Web UI.
 * A CLI that edited `package.json` or `cordis.patch.yml` would bypass all three:
 * it would race the running process, it could not activate anything, and a
 * half-written profile would have no rollback. So this file reads and prints;
 * for anything else it prints the `dsh_console` call that would do it, or
 * refuses.
 *
 * Read-only is an invariant here, not a convention, and it holds by construction:
 *
 *   - every import below is a `node:` builtin, and the only `node:fs` bindings
 *     are `existsSync`, `readFileSync` and `statSync` (plus the read-only
 *     `node:path`/`node:os` helpers). There is no `writeFileSync`, `mkdirSync`,
 *     `rmSync`, `unlinkSync` or `createWriteStream` to call, and no
 *     `node:child_process` at all — so there is no way to shell out to something
 *     that writes either. `readdirSync` was imported here at first and never
 *     called; it is gone, because an unused import that this very paragraph
 *     advertises as load-bearing is a claim the code does not support;
 *   - ADVISORY_OPERATIONS below carries every action id from `core.js`'s ACTIONS
 *     whose `mutating` or `destructive` flag is true. A verb typed at this CLI
 *     that matches one is REFUSED, so the whole `plugin.setEnabled`,
 *     `plugin.install`, `plugin.remove`, `model.select`, `settings.set`,
 *     `mcp.restart` and `appearance.*` surface answers with the tool call
 *     instead of doing anything.
 *
 * `test/cli.test.mjs` proves both: it hashes the fixture profile tree before and
 * after running every command in every output mode and asserts the digest is
 * unchanged, and it asserts the advisory table still lists every mutating action
 * `ACTIONS` declares — so a new mutating action cannot arrive without the CLI
 * noticing.
 *
 * ── What `doctor` can honestly report ───────────────────────────────────────
 *
 * The authoritative picture of a running installation — the Loader entry list,
 * each plugin's enabled state, the resolved model selection, live MCP server
 * status — lives in the DSH process and is reachable only through the
 * `dsh_console` tool. This process has no service container. So `doctor` reports
 * what the profile's own files actually say, cites the file each fact came from,
 * and — this is the part that matters — prints an explicit `unknown` with a
 * reason for anything it cannot establish. A confidently wrong `doctor` is worse
 * than an incomplete one: an agent acts on it.
 */

// Read-only `node:fs`, and nothing else from it. The absence of a write binding
// is the first half of the read-only proof spelled out in the header: with no
// writer reachable from this module, no path through it can touch the profile.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// A same-plugin relative import, exactly as `index.js`, `tool.js` and every
// domain does. It pulls in no third-party package — `core.js` is plain ESM with
// no imports at all — so this adds no dependency to a plugin that has no
// `node_modules` of its own, and no build step.
//
// `ACTIONS` and `FORBIDDEN` are imported rather than restated because a second
// copy of either would drift from the table `dispatch()` actually enforces. The
// CLI's job is to describe that boundary; describing a boundary it invented
// would be worse than describing none, because it would be believed.
import { ACTIONS, FORBIDDEN } from './core.js'

/**
 * The DSH home directory: `$DSH_HOME` when set, else `~/.dsh`.
 *
 * The env var is honoured because this repository's own code already does
 * (`plugins/dsh-sync/src/index.js:296`: `process.env.DSH_HOME ? join(resolve(DSH_HOME), …)
 * : join(homedir(), '.dsh', …)`), and because a test needs to point the CLI at a
 * fixture without touching the real `~/.dsh`.
 *
 * It is read PER CALL rather than captured at module load: a value captured at
 * import time cannot be changed afterwards, which would make the one thing this
 * CLI most needs to be testable — where it looks — untestable.
 */
function dshHome() {
  const configured = process.env.DSH_HOME
  return configured !== undefined && configured !== '' ? configured : join(homedir(), '.dsh')
}

/**
 * Where the profile came from, so `doctor` can say which knob moved it.
 *
 * `--profile` wins over `DSH_PROFILE` wins over `desktop` — the same order the
 * market CLI uses, so an agent that has learned one has learned both.
 */
function resolveProfile(options) {
  const name = options.profile ?? process.env.DSH_PROFILE ?? 'desktop'
  return {
    name,
    dir: join(dshHome(), 'profiles', name),
    source: options.profile !== undefined ? '--profile' : (process.env.DSH_PROFILE !== undefined ? 'DSH_PROFILE' : 'default'),
  }
}

/**
 * The mutating half of `ACTIONS`, as the advisory table.
 *
 * Derived from `ACTIONS`, never hand-written, so it cannot go stale: adding a
 * mutating action to `core.js` adds it here on the next read. The two messages
 * are the whole point of the table — they name the tool call that WOULD perform
 * the change, so refusing is a route forward rather than a dead end.
 */
const TOOL_CALL = 'dsh_console'
const ADVISORY_OPERATIONS = Object.fromEntries(
  Object.entries(ACTIONS)
    .filter(([, spec]) => spec.mutating === true || spec.destructive === true)
    .map(([name, spec]) => [name, {
      action: name,
      destructive: spec.destructive === true,
      requiresClient: spec.requiresClient === true,
      message: `refused: ${name} changes this installation, and ${TOOL_CALL} is the only writer. `
        + `Call ${TOOL_CALL} with action="${name}".`,
    }]),
)

function usage() {
  return `vyra-console <command> [options]

A READ-ONLY view of this DSH installation. There is no --apply: every change
goes through the ${TOOL_CALL} tool, which uses the same profile lock, activation
and rollback path as the web UI.

Commands:
  doctor                   One summary: profile files, bundles, model, appearance, MCP
  state                    The model selection and other config the profile declares
  services                 The services this plugin's actions need, and whether the profile declares them
  events                   Where this DSH installation writes its logs

Options:
  --profile=<name>         DSH profile (default: DSH_PROFILE or desktop)
  --json                   Machine-readable output on stdout, diagnostics on stderr
  --help                   This text

Exit codes:
  0   success
  1   a real failure (a missing profile directory, an unreadable manifest)
  2   bad usage (an unknown command or option)

The read-only rule is enforced, not just documented: a command word that names a
mutating action is refused. ${Object.keys(ADVISORY_OPERATIONS).length} such actions are known.

Examples:
  vyra-console doctor --json
  vyra-console state --profile=desktop
  vyra-console events`
}

function parseArgs(argv) {
  const options = { profile: undefined, json: false, help: false }
  const positional = []
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith('--')) { positional.push(arg); continue }
    const eq = arg.indexOf('=')
    const key = eq === -1 ? arg.slice(2) : arg.slice(2, eq)
    let value = eq === -1 ? undefined : arg.slice(eq + 1)
    if (value === undefined && key === 'profile') {
      value = argv[i + 1]
      i += 1
    }
    switch (key) {
      case 'profile': options.profile = value; break
      case 'json': options.json = true; break
      case 'help': options.help = true; break
      default: throw new UsageError(`unknown option --${key}`)
    }
  }
  return { command: positional.shift(), args: positional, options }
}

/** A bad invocation: reported with the usage text, and exits 2 rather than 1. */
class UsageError extends Error {}

/**
 * An IO failure with a message worth reading.
 *
 * `includeStack` is false because `readFileSync`/`statSync` errors already
 * carry a coded message ("ENOENT: no such file or directory, open '...'") that
 * matters more than the frames below it.
 */
function Failure(message) {
  const error = new Error(message)
  error.includeStack = false
  return error
}

/**
 * Read one file in the profile, never throwing.
 *
 * `{ present: false }` and `{ present: true, unreadable: true }` are deliberately
 * different answers and are reported differently: "there is no settings document"
 * and "there is one and I could not read it" call for different actions from
 * whoever is reading the output, and collapsing them into one `null` would hide
 * exactly the case — a permissions problem, a half-written file — that a doctor
 * command exists to surface.
 */
function readProfileFile(dir, name) {
  const path = join(dir, name)
  try {
    const text = readFileSync(path, 'utf8')
    return { present: true, path, text }
  } catch (error) {
    if (error?.code === 'ENOENT') return { present: false, path }
    return { present: true, unreadable: true, path, error: String(error?.message ?? error) }
  }
}

/**
 * The keys at the top level of the profile's `cordis.patch.yml`, with each key's
 * own top-level block text.
 *
 * Deliberately a structural scan rather than a YAML parse, and the reason is a
 * hard constraint rather than a preference: this plugin is plain ESM with no
 * `node_modules`, and a static `import 'yaml'` would throw `ERR_MODULE_NOT_FOUND`
 * and take the CLI down with it — the same rule `index.js` documents for
 * schemastery. Node ships no YAML parser.
 *
 * The scan reads the INDENTATION of the file, so every number it produces is
 * reported as text and quoted in the output as exactly that: the substring found
 * at that position. When the indentation is not what a patch layer looks like,
 * callers report `unknown` rather than a narrower reading.
 *
 * @returns every top-level key, in file order, as `{ index, key, block }`.
 */
function scanYamlTopLevelKeys(text) {
  const lines = text.split(/\r?\n/)
  const rows = []
  for (let index = 0; index < lines.length; index += 1) {
    // A patch entry is a flush-left sequence item whose value is a mapping:
    //
    //   - id: ui-theme
    //     name: "@deepseek-ai/dsh-client-ui-theme"
    //
    // The entry's identity is the VALUE of `id` (`ui-theme`), not the field name
    // `id` — reading the first `key:` off the line yields the literal string
    // `"id"` for every entry in the file, which is how a parser silently reports
    // a whole profile as one plugin. That was a real defect in this file, caught
    // by running it against the real profile rather than a fixture.
    const item = /^-\s+id\s*:\s*(.+)$/.exec(lines[index])
    if (item === null) continue
    const key = item[1].trim().replace(/\s+#.*$/, '').replace(/^["']|["']$/g, '')
    if (key === '') continue
    // The block runs until the next flush-left line that begins a new patch
    // entry. Two things stop it, and both are needed: a `- ` item (the next
    // entry), or a flush-left `key: value` (the file's trailing shape). NOT every
    // flush-left dash — a top-level `log:`-style mapping holding a sequence
    // (`log:\n- a\n- b`) is one key, and splitting it would invent entries that
    // are not there. Unlike a YAML parser this cannot see a quoted or literal
    // block containing a flush-left line, so the block is documentation for a
    // human reader, never a value anything is decided from.
    let end = index + 1
    while (end < lines.length) {
      const line = lines[end]
      if (/^-\s+(?:id\s*:|[A-Za-z0-9_.@/-]+\s*:|\{)/.test(line)) break
      if (/^[A-Za-z0-9_.@/-]+\s*:/.test(line)) break
      end += 1
    }
    // One line per key, so the output is stable byte-for-byte across runs — the
    // file's own blank lines and comment breaks between entries are structural
    // noise, not part of any key's value.
    rows.push({ index, key, block: lines.slice(index, end).filter((line) => line.trim() !== '').join('\n') })
  }
  return rows
}

/** The key of a `key: value` line, or undefined. */
function yamlKeyOf(line) {
  return /^([A-Za-z0-9_.@/-]+)\s*:/.exec(line)?.[1]
}

/** The value of a `key: value` line at exactly `indent` spaces, or undefined. */
function yamlValue(text, key, indent) {
  const pattern = new RegExp(`^ {${indent}}${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*(.*)$`, 'm')
  const found = pattern.exec(text)
  if (found === null) return undefined
  const raw = found[1].trim()
  if (raw === '' || raw.startsWith('#')) return undefined
  return raw.replace(/^["']|["']$/g, '')
}

/**
 * The keys of a nested mapping at exactly `indent` spaces, in file order.
 *
 * The shape a `providers:` block actually uses, confirmed against this
 * installation's own `cordis.patch.yml`:
 *
 *     - id: llm-pi-ai
 *       config:
 *         providers:
 *           ydy-ds:            <- the provider's NAME is this key
 *             displayName: ydy-ds
 *           local-ollama:
 *             displayName: local-ollama
 *
 * An earlier version of this function looked for `- name` sequence items under
 * `providers:` and therefore found nothing at all in a real profile — it would
 * have reported "no providers declared" on an installation that declares two.
 * The keys are the names; nothing below them is read, because only the name is
 * being counted here.
 */
function yamlMapKeys(text, indent) {
  const pattern = new RegExp(`^ {${indent}}([A-Za-z0-9_.@/-]+)\\s*:`)
  const keys = []
  for (const line of text.split('\n')) {
    const found = pattern.exec(line)
    if (found !== null) keys.push(found[1])
  }
  return [...new Set(keys)]
}

/**
 * The recorded plugin enablement decisions, from the profile's OWN patch file.
 *
 * This asks "what did this installation record?", never "is this plugin
 * running?" — the running state is the Loader's, in the DSH process, and is only
 * reachable through `dsh_console`'s `plugin.list`. `disabled` is the patch
 * convention for a plugin switched off; a plugin a bundle layer disables is not
 * visible here at all, and `doctor` says so rather than implying completeness.
 */
function readEnabledState(dir) {
  const file = readProfileFile(dir, 'cordis.patch.yml')
  if (!file.present) return { status: 'unknown', reason: `no cordis.patch.yml in ${dir}`, file: file.path }
  if (file.unreadable) return { status: 'unknown', reason: `cordis.patch.yml is unreadable: ${file.error}`, file: file.path }
  const entries = []
  for (const { key, block } of scanYamlTopLevelKeys(file.text)) {
    // The `disabled:` key sits at whatever indentation the entry body uses
    // (`  disabled: true` in this installation's own patch layer, deeper inside a
    // nested entry in `dsh-expert-orchestrator`'s), so it is found by key rather
    // than by column. The `- ` of a nested sequence item is NOT a comment marker
    // in YAML, so the line is matched as written.
    const disabledLine = block.split('\n').find((line) => yamlKeyOf(line.trim()) === 'disabled')
    // Only the literal boolean means disabled. `!!js` is an expression evaluated
    // by the Loader, and reading an unevaluated expression here would be exactly
    // the confident guess this command must not make, so it is `unknown`.
    const status = disabledLine === undefined
      ? 'enabled'
      : (/^disabled\s*:\s*true\s*$/i.test(disabledLine.trim()) ? 'disabled' : 'unknown')
    entries.push({
      id: key,
      name: yamlValue(block, 'name', 2),
      status,
      source: 'cordis.patch.yml',
      note: 'recorded in the patch layer; the running Loader state is only visible through ' + TOOL_CALL,
    })
  }
  return { status: 'ok', file: file.path, entries }
}

/**
 * The text of one top-level `key:` mapping in a settings document, or undefined.
 *
 * A settings document is a top-level MAPPING, not a sequence of `- id:` entries
 * — `agent-default-model:` sits at column 0 and its fields are indented under it
 * — so this reads flush-left `key:` lines rather than reusing
 * {@link scanYamlTopLevelKeys}, which looks for sequence items. Reading the wrong
 * one of the two shapes is what made this command report `unknown` for a
 * selection that was plainly written in the file.
 *
 * The block ends at the next flush-left non-comment line.
 */
function findTopLevelMapping(text, key) {
  const lines = text.split(/\r?\n/)
  const start = lines.findIndex((line) => yamlKeyOf(line) === key)
  if (start === -1) return undefined
  let end = start + 1
  while (end < lines.length) {
    const line = lines[end]
    if (line.trim() !== '' && !/^\s/.test(line) && !line.startsWith('#')) break
    end += 1
  }
  return lines.slice(start, end).join('\n')
}

/**
 * What this installation declares about the model, split into the two questions
 * that actually have different answers.
 *
 *   - `selection` — the default selection an Agent is created with. The PRIMARY
 *     source is the profile's own `agent-default-model` patch entry, whose
 *     `config.provider` / `config.model` (and optional `config.reasoningEffort`)
 *     is where a current DSH keeps this. The real desktop profile reads:
 *
 *       - id: agent-default-model
 *         name: "@deepseek-ai/dsh-agent-default-model"
 *         config:
 *           provider: cli-claude
 *           model: default
 *
 *     `settings.yaml` at the DSH home is kept as a SECONDARY, LEGACY fallback.
 *     It is no longer a live source: the shipped settings service imports it once
 *     into the profile's entry configs and then RENAMES it away, so on any
 *     current installation it does not exist. From
 *     `@deepseek-ai/dsh-settings/src/index.ts` (extracted from the installed
 *     `app.asar`): `:201` documents "Entry ids of the removed `settings.yaml`
 *     sections", and `:242-247` is `importLegacyDocument()` —
 *     `join(profile.home, 'settings.yaml')`, `await rename(path, imported)`,
 *     then `this.update(ns, values)` for each section, and `update` → `write` →
 *     `configEditor.edit(entry, …)` lands it in the patch entry's `config`.
 *     So the earlier version of this function, which read only `settings.yaml`,
 *     answered a permanent `unknown` on every current install while the value sat
 *     in a file it was already parsing. The header of this file used to justify
 *     that with a third-party plugin's regex over `settings.yaml`; the shipped
 *     service is the authority and contradicts it.
 *   - `providers` — the provider adapters declared in the profile's patch layer.
 *     Only the `providers:` map counts (see below). This counts declarations, not
 *     availability: nothing here proves a provider answered.
 *
 * `reasoningEffort` IS read, as an optional third field: the shipped
 * `@deepseek-ai/dsh-agent-default-model` declares `reasoningEffort: z.string().volatile()`
 * and spreads it into the selection only when defined, so its presence in a
 * `config` is meaningful and its absence is normal.
 *
 * `note` sets the honesty bar for the whole section: this is a declared
 * *default*, and the session actually answering may run another route entirely.
 * `dsh_console`'s `model.list` reports what is live.
 */
function readModelSelection(profileDir, patchFile) {
  const settingsFile = join(dshHome(), 'settings.yaml')
  const file = readProfileFile(dshHome(), 'settings.yaml')
  const patchRows = patchFile.present && !patchFile.unreadable
    ? scanYamlTopLevelKeys(patchFile.text)
    : []

  // Only the `providers:` map is read, and nothing is inferred from a package
  // name or from an entry merely having a `name:` field. An earlier version of
  // this function assumed "an entry whose second line is `name:` supplies one
  // provider", which every patch entry satisfies — it reported `ui-theme` as a
  // provider on the fixture, which is exactly the confidently-wrong answer this
  // command exists to avoid. The map is a declaration by the profile's own
  // author; a guess about a package name is not.
  const providers = []
  const seen = new Set()
  for (const row of patchRows) {
    if (!/^ {4}providers:\s*$/m.test(row.block)) continue
    for (const name of yamlMapKeys(row.block, 6)) {
      if (seen.has(name)) continue
      seen.add(name)
      providers.push({
        name,
        source: `providers map of the "${row.key}" entry in cordis.patch.yml`,
        path: patchFile.path,
      })
    }
  }
  const providersNote = providers.length > 0
    ? 'declared provider adapters'
    : 'no providers map is declared in this profile\'s patch layer; adapters registered by a bundle layer are '
      + 'not visible here'

  // Every return path carries the same provider block, so a caller never has to
  // ask whether the field is present. It is built once, here, rather than
  // repeated into six literals where one would eventually be forgotten.
  const providerBlock = { providers, providersNote }

  // ── PRIMARY: the profile's own `agent-default-model` patch entry ──────────
  //
  // The entry keys off `id`, and its `config:` block is at indent 2 with the
  // fields at indent 4 — measured off the real desktop profile, not assumed.
  // `config:` is required for a match: an entry with the right id and no config
  // declares nothing, and reading `provider:`/`model:` from an entry body that
  // has none would be inventing them.
  const entry = patchRows.find((row) => row.key === 'agent-default-model')
  const configBlock = entry === undefined ? undefined : findNestedMapping(entry.block, 'config', 2)
  if (configBlock !== undefined) {
    const provider = yamlValue(configBlock, 'provider', 4)
    const model = yamlValue(configBlock, 'model', 4)
    const effort = yamlValue(configBlock, 'reasoningEffort', 4)
    if (provider !== undefined || model !== undefined || effort !== undefined) {
      const from = { source: 'cordis.patch.yml', path: patchFile.path }
      return {
        status: 'ok',
        selection: {
          provider: provider === undefined ? null : { value: provider, ...from },
          model: model === undefined ? null : { value: model, ...from },
          reasoningEffort: effort === undefined ? null : { value: effort, ...from },
        },
        selectionSource: {
          kind: 'patch-entry',
          detail: `config of the "agent-default-model" entry in ${patchFile.path}`,
        },
        ...providerBlock,
        note: `declared default only; the session answering now may run another route, which `
          + `${TOOL_CALL}'s model.list reports`,
      }
    }
  }

  // ── SECONDARY, LEGACY: `settings.yaml` at the DSH home ────────────────────
  //
  // Reached only when the patch entry declared nothing. Kept because a profile
  // that has not yet been visited by the settings service may still hold one, and
  // because reporting "neither source has it" requires having looked at both.
  const legacy = legacySelection(file, settingsFile)
  if (legacy.found) {
    const from = { source: 'settings.yaml (legacy)', path: settingsFile }
    return {
      status: 'ok',
      selection: {
        provider: legacy.provider === undefined ? null : { value: legacy.provider, ...from },
        model: legacy.model === undefined ? null : { value: legacy.model, ...from },
        reasoningEffort: null,
      },
      selectionSource: {
        kind: 'legacy-settings-document',
        detail: `legacy ${settingsFile}; the settings service imports this into the profile's entry config `
          + `and then renames it away, so the patch entry is the live source when it declares one`,
      },
      ...providerBlock,
      note: `declared default only; the session answering now may run another route, which `
        + `${TOOL_CALL}'s model.list reports`,
    }
  }

  // Neither source yields a value. Both are NAMED in the reason, so a reader can
  // tell this apart from "the one place I looked was empty".
  const reason = [
    'neither source declares a default model:',
    `the "agent-default-model" entry in ${patchFile.path} `
      + (entry === undefined ? 'does not exist' : 'has no usable config'),
    `and ${settingsFile} ` + legacy.detail,
  ].join(' ')
  return {
    status: 'unknown',
    reason,
    settingsFile,
    legacy,
    selection: null,
    ...providerBlock,
  }
}

/**
 * The `config:` mapping of a patch entry block, at a known indent.
 *
 * The block's own `config:` is the key; its fields are indented beneath it. The
 * end is the block's end, since an entry block never contains a second top-level
 * `config:`. Returns `undefined` when the entry has no `config:` at all, which is
 * a different answer from a `config:` that is present and empty — the caller
 * distinguishes them in its `reason`.
 */
function findNestedMapping(block, key, indent) {
  const lines = block.split('\n')
  const pattern = new RegExp(`^ {${indent}}${key}\\s*:\\s*$`)
  const start = lines.findIndex((line) => pattern.test(line))
  if (start === -1) return undefined
  let end = start + 1
  while (end < lines.length && (lines[end].trim() === '' || /^\s/.test(lines[end]))) end += 1
  return lines.slice(start, end).join('\n')
}

/**
 * What a legacy `settings.yaml` says, if anything — the secondary path.
 *
 * Never throws and never decides the result on its own: the caller has already
 * consulted the authoritative patch entry, and this only supplies a value when
 * that entry declared none. `detail` explains the outcome in the words the
 * `reason` text uses, so an unreadable file and an absent one do not read alike.
 */
function legacySelection(file, settingsFile) {
  if (!file.present) return { found: false, detail: 'does not exist (the settings service imports and renames it away)' }
  if (file.unreadable) return { found: false, detail: `is unreadable: ${file.error}` }
  const block = findTopLevelMapping(file.text, 'agent-default-model')
  if (block === undefined) return { found: false, detail: 'declares no top-level agent-default-model' }
  const provider = yamlValue(block, 'provider', 2)
  const model = yamlValue(block, 'model', 2)
  if (provider === undefined && model === undefined) {
    return { found: false, detail: 'declares agent-default-model but neither provider nor model' }
  }
  return { found: true, detail: 'carries a legacy selection', provider, model, path: settingsFile }
}

/**
 * Which installed packages look appearance-related, by name and by a read of
 * their own manifest.
 *
 * Two different answers, kept apart on purpose: a name is evidence a package is
 * CONCERNED with appearance, and the package's own `dsh.client` block is
 * evidence it can reach the browser realm where theme and layout actually live.
 * Neither proves the plugin is running or that any theme is applied — the
 * applied theme is Client state and is only reachable through `dsh_console`'s
 * `appearance.state`.
 *
 * The name test is on installed package names rather than on hard-coded ids, so
 * a theme this repository has never heard of is still found.
 */
function readAppearance(dir, dependencies) {
  const token = /(theme|skin|style|appearance|font|layout|locale)/i
  const byName = Object.keys(dependencies).filter((name) => token.test(name))
  const byManifest = []
  for (const name of Object.keys(dependencies)) {
    const pkg = readProfileFile(join(dir, 'node_modules', name), 'package.json')
    if (!pkg.present || pkg.unreadable) continue
    let parsed
    try { parsed = JSON.parse(pkg.text) } catch { continue }
    const platforms = []
    if (parsed?.dsh?.client !== undefined) {
      platforms.push(typeof parsed.dsh.client?.platform === 'string' ? parsed.dsh.client.platform : 'declared')
    }
    if (parsed?.dsh?.server !== undefined) platforms.push('server')
    if (platforms.length > 0) {
      byManifest.push({ name, platforms, path: pkg.path })
    }
  }
  return {
    byName,
    byManifest,
    note: `name and manifest evidence from the profile's own files; a running theme is Client state and `
      + `is only reported by ${TOOL_CALL}'s appearance.state`,
  }
}

/**
 * The MCP server definitions the profile declares.
 *
 * One source only: the `mcpServers:` block of the profile's patch layer. The
 * entries are the block's keys in file order — the shape `cordis.patch.yml`
 * uses elsewhere for a map keyed by name. When the file has no such block the
 * answer is an empty declared list with `found: false`, which is a different
 * statement from "this installation runs no MCP servers": what is running is the
 * mcpManager's, and is only reachable through `dsh_console`'s `mcp.list`.
 */
function readMcpServers(dir, patchFile) {
  if (!patchFile.present || patchFile.unreadable) {
    return {
      found: false,
      declared: [],
      reason: patchFile.present
        ? `cordis.patch.yml is unreadable: ${patchFile.error}`
        : `no cordis.patch.yml in ${dir}`,
      source: patchFile.path,
      note: `server definitions only; live status is reported by ${TOOL_CALL}'s mcp.list`,
    }
  }
  const lines = patchFile.text.split(/\r?\n/)
  const start = lines.findIndex((line) => /^mcpServers:\s*(#.*)?$/.test(line))
  if (start === -1) {
    return {
      found: false,
      declared: [],
      reason: 'this profile declares no top-level mcpServers block',
      source: patchFile.path,
      note: `server definitions only; live status is reported by ${TOOL_CALL}'s mcp.list`,
    }
  }
  const names = []
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i]
    if (line.trim() === '') continue
    if (!/^\s/.test(line)) break
    const name = /^ {2}([A-Za-z0-9_.@/-]+)\s*:/.exec(line)?.[1]
    if (name !== undefined) names.push(name)
  }
  return {
    found: true,
    declared: [...new Set(names)],
    source: patchFile.path,
    note: `server definitions only; live status is reported by ${TOOL_CALL}'s mcp.list`,
  }
}

/**
 * The installed bundles, from the profile manifest and the packages on disk.
 *
 * `version` is the version INSTALLED when `node_modules/<name>/package.json`
 * says so, and otherwise `null` with `versionFrom` naming the declared spec —
 * never a guess. Both the dependency key and the installed package name are
 * reported because they differ for the aliased installs this repository's own
 * profile uses (`"@iasiv5/dsh-skins": "git+…#path:/plugins/dsh-skins"` installs
 * under `@iasiv5/dsh-skins`), and an agent comparing the two lists would
 * otherwise see a mismatch that is in fact a rename.
 */
function readBundles(dir, dependencies, enablement) {
  const statusOf = (name) => {
    const entry = enablement.status === 'ok'
      ? enablement.entries.find((row) => row.id === name || row.name === name)
      : undefined
    return entry?.status ?? 'unknown'
  }
  return Object.keys(dependencies).map((name) => {
    let installedName = null
    let version = null
    const pkg = readProfileFile(join(dir, 'node_modules', name), 'package.json')
    if (pkg.present && !pkg.unreadable) {
      try {
        const parsed = JSON.parse(pkg.text)
        installedName = typeof parsed?.name === 'string' ? parsed.name : name
        version = typeof parsed?.version === 'string' ? parsed.version : null
      } catch { /* an unparseable manifest falls through to the declared spec */ }
    }
    return {
      name,
      spec: String(dependencies[name]),
      installedName,
      version,
      versionFrom: version === null ? 'declared spec; no readable installed package.json' : 'node_modules package.json',
      enabled: statusOf(name),
      enabledSource: enablement.status === 'ok' ? enablement.file : enablement.reason,
    }
  })
}

/**
 * This plugin's own action registry and authority boundary.
 *
 * Read straight out of `core.js`, so it is the same table `dispatch()` enforces
 * rather than a description of it that could drift. The only excluded action is
 * `console.actions` itself, which would be the CLI reporting on itself — and
 * reporting it as "excluded" is more honest than omitting it silently.
 */
function readConsoleSurface() {
  const mutating = Object.entries(ACTIONS).filter(([, spec]) => spec.mutating === true || spec.destructive === true)
  return {
    source: 'core.js',
    total: Object.keys(ACTIONS).length,
    readOnly: Object.keys(ACTIONS).length - mutating.length - 1,
    mutating: mutating.map(([name]) => name),
    forbidden: Object.entries(FORBIDDEN).map(([name, entry]) => ({ name, reason: entry.reason, alternative: entry.alternative })),
    excluded: {
      console: ['console.actions'],
      reason: `reported by ${TOOL_CALL} action=console.actions`,
    },
  }
}

/**
 * Where this DSH installation writes logs.
 *
 * Enumerated rather than guessed, and every path is checked: a row that is
 * absent from this machine is reported as absent instead of being printed as
 * though it were there. `logs` is the profile-relative one — the same "profile
 * directory" the rest of this CLI reads — and the others are the installation-
 * level ones this repository's own plugins write to (`dsh-im`, `dsh-sync` and
 * friends use `join(homedir(), '.dsh', ...)`).
 */
function readEvents(profileDir) {
  const root = dshHome()
  const candidates = [
    join(profileDir, 'logs'),
    join(root, 'logs'),
    join(root, 'im'),
    join(root, 'sync'),
  ]
  return candidates.map((path) => {
    let present = false
    try {
      present = statSync(path).isDirectory()
    } catch {
      present = false
    }
    return {
      path,
      present,
      source: present ? 'directory present on this machine' : 'not present on this machine',
    }
  })
}

/**
 * The one summary `doctor` exists to produce.
 *
 * Every section carries the file it came from, and every section that could not
 * be established carries an explicit `unknown` with a reason rather than being
 * omitted or filled in. The `caveats` list states the limitation once, in the
 * output an agent actually reads, instead of leaving it to this source file:
 * a doctor that quietly under-reports invites an agent to treat silence as
 * evidence, and a doctor that guesses is worse still.
 */
function buildDoctor(profile, patchFile) {
  const manifestFile = readProfileFile(profile.dir, 'package.json')

  let manifest = null
  let manifestError = null
  if (manifestFile.unreadable) {
    manifestError = `package.json is unreadable: ${manifestFile.error}`
  } else if (!manifestFile.present) {
    manifestError = `no package.json in ${profile.dir}`
  } else {
    try {
      manifest = JSON.parse(manifestFile.text)
    } catch (error) {
      manifestError = `package.json is not valid JSON: ${String(error?.message ?? error)}`
    }
  }

  const dependencies = (manifest !== null && manifest.dependencies !== null && typeof manifest.dependencies === 'object')
    ? manifest.dependencies
    : {}
  const bundleNames = (manifest !== null && Array.isArray(manifest.dsh?.profile?.bundles))
    ? manifest.dsh.profile.bundles.filter((name) => typeof name === 'string')
    : []

  const enablement = readEnabledState(profile.dir)
  const bundles = readBundles(profile.dir, dependencies, enablement)

  const caveats = [
    `Reading files cannot see what is RUNNING. A bundle removed from package.json while its plugin is still `
      + `loaded, a plugin disabled inside a bundle layer, and a live MCP connection are all invisible here. `
      + `Use ${TOOL_CALL} for the running state (plugin.list, model.list, mcp.list, appearance.state).`,
  ]
  if (manifestError !== null) {
    caveats.push(`The profile manifest could not be read, so the bundle and appearance sections are empty by `
      + `necessity rather than because nothing is installed: ${manifestError}.`)
  }
  if (enablement.status !== 'ok') {
    caveats.push(`Recorded enablement is unknown for every bundle: ${enablement.reason}.`)
  }

  return {
    profile: { name: profile.name, dir: profile.dir, source: profile.source, present: existsSync(profile.dir) },
    files: {
      manifest: { path: manifestFile.path, present: manifestFile.present, unreadable: manifestFile.unreadable === true },
      patch: { path: patchFile.path, present: patchFile.present, unreadable: patchFile.unreadable === true },
    },
    bundles: {
      count: bundles.length,
      declared: bundleNames.length === 0 ? null : { count: bundleNames.length, source: 'package.json dsh.profile.bundles' },
      installed: bundles,
      note: 'enabled is what the profile RECORDS; the running Loader state is only visible through ' + TOOL_CALL,
    },
    model: readModelSelection(profile.dir, patchFile),
    appearance: readAppearance(profile.dir, dependencies),
    mcp: readMcpServers(profile.dir, patchFile),
    console: readConsoleSurface(),
    caveats,
  }
}

/** The model and configuration the profile declares, on its own. */
function buildState(profile, patchFile) {
  const manifestFile = readProfileFile(profile.dir, 'package.json')
  let bundleNames = null
  if (manifestFile.present && !manifestFile.unreadable) {
    try {
      const manifest = JSON.parse(manifestFile.text)
      if (Array.isArray(manifest.dsh?.profile?.bundles)) {
        bundleNames = { count: manifest.dsh.profile.bundles.length, source: 'package.json dsh.profile.bundles' }
      }
    } catch { /* reported below as unknown rather than as an empty list */ }
  }
  return {
    profile: { name: profile.name, dir: profile.dir, source: profile.source, present: existsSync(profile.dir) },
    model: readModelSelection(profile.dir, patchFile),
    enablement: readEnabledState(profile.dir),
    bundles: bundleNames,
    note: `declared configuration only; the running state is reported by ${TOOL_CALL}`,
  }
}

/**
 * The services this plugin's actions need, and whether the profile declares them.
 *
 * This is the honest half of a question this process cannot answer in full: a
 * profile's `package.json` records the PACKAGES it installed, which is evidence
 * a service is configured, and says nothing about which of them is running. Both
 * halves are stated per row so nothing reads as a live service list.
 *
 * `dsh-im`'s profile entry is checked explicitly under the well-known id `im`
 * because that is the one service whose id differs from every package name that
 * could provide it, and a name test alone would have reported it missing on an
 * installation that has it.
 */
function buildServices(profile) {
  const patchFile = readProfileFile(profile.dir, 'cordis.patch.yml')
  const manifestFile = readProfileFile(profile.dir, 'package.json')

  let dependencies = {}
  let manifestError = null
  if (manifestFile.unreadable) {
    manifestError = `package.json is unreadable: ${manifestFile.error}`
  } else if (!manifestFile.present) {
    manifestError = `no package.json in ${profile.dir}`
  } else {
    try {
      const parsed = JSON.parse(manifestFile.text)
      if (parsed.dependencies !== null && typeof parsed.dependencies === 'object') dependencies = parsed.dependencies
    } catch (error) {
      manifestError = `package.json is not valid JSON: ${String(error?.message ?? error)}`
    }
  }

  const names = Object.keys(dependencies)
  const declaredIds = patchFile.present && !patchFile.unreadable
    ? scanYamlTopLevelKeys(patchFile.text).map((row) => row.key)
    : null

  const evidenceFor = (name) => {
    const fromPackage = names.filter((pkg) => pkg === name || pkg.split('/').at(-1) === name)
    if (declaredIds?.includes(name)) fromPackage.push(`cordis.patch.yml entry id "${name}"`)
    if (name === 'im' && declaredIds?.includes('im')) fromPackage.push('cordis.patch.yml entry id "im"')
    return fromPackage
  }

  const rows = Object.entries(ACTION_SERVICES).map(([service, spec]) => ({
    service,
    evidence: evidenceFor(spec.package),
    declared: evidenceFor(spec.package).length > 0,
    requiredBy: spec.actions,
    // Whether a package could declare this service at all. Carried as data rather
    // than re-derived by the renderers from the note text: "no evidence" and "no
    // package exists to give evidence" are different facts and must not look the
    // same in the output.
    declarable: spec.package !== null,
    // A row with no package cannot be evidenced by an installation. Saying which
    // of the two reasons applies stops "declared: false" from reading as
    // "missing", which would be a false alarm rather than a report.
    note: spec.package === null
      ? 'provided by the host, or Client-realm; no installable package declares it, so there is nothing to look for'
      : 'declared means the profile installs it; only the running DSH knows whether it is active',
  }))

  const uncovered = uncoveredActions()

  return {
    profile: { name: profile.name, dir: profile.dir, source: profile.source, present: existsSync(profile.dir) },
    services: rows,
    undeclaredCount: rows.filter((row) => !row.declared).length,
    manifestError,
    caveats: [
      `This is the declaration half only. Which services are actually provided is process state, and is `
        + `reported by ${TOOL_CALL}: an action on a profile without its service answers "unavailable".`,
      // Reported rather than assumed: if this is ever non-empty the command is
      // under-describing the surface, and a reader must be able to see that here
      // instead of inferring it from a count that does not add up.
      uncovered.length === 0
        ? `Every one of the ${Object.keys(ACTIONS).length} registered actions appears in a row above, `
          + `or is listed as needing no service.`
        : `INCOMPLETE: ${uncovered.length} registered action(s) appear in no row: ${uncovered.join(', ')}.`,
    ],
  }
}

/**
 * Which package provides each service this plugin's actions resolve.
 *
 * The service names are the `ctx.get('…')` keys the domains use
 * (`domains/catalog.js`, `domains/plugin.js`, `domains/model.js`,
 * `domains/settings.js`, `domains/appearance.js`); the package names are the ones
 * this installation's own profile lists.
 *
 * `package: null` means the service is NOT provided by an installable package and
 * therefore cannot appear in a profile's `package.json` — so a row for it can
 * never carry evidence, and saying so is the honest report rather than an
 * omission. Two different reasons land here:
 *   - `settings`, `skills` and `mcpManager` are provided by the host itself
 *     (settings is schema-derived from the Loader's entries), so no package
 *     declares them;
 *   - `theme`, `layout` and `locale` are Client-realm services: they exist only
 *     in the browser, which is why the appearance actions go through the channel
 *     and answer `unavailable` when no interface is connected.
 *
 * EVERY action in `core.js`'s ACTIONS must appear in exactly one row here (or be
 * accounted for as service-free). A row missing its actions reads as "this action
 * needs nothing", which is the silence the CLI's own rule forbids.
 */
const ACTION_SERVICES = {
  pluginManager: { package: 'dsh-plugin', actions: ['plugin.list', 'plugin.setEnabled', 'plugin.install', 'plugin.remove'] },
  agentDefaultModel: { package: 'agent-default-model', actions: ['model.list', 'model.select'] },
  settings: { package: null, actions: ['settings.list', 'settings.get', 'settings.set'] },
  skills: { package: null, actions: ['skill.list'] },
  mcpManager: { package: null, actions: ['mcp.list', 'mcp.restart', 'mcp.probe'] },
  theme: { package: null, actions: ['appearance.setTheme', 'appearance.setFontSize'] },
  layout: {
    package: null,
    actions: ['appearance.toggleSidebar', 'appearance.openRightbar', 'appearance.closeRightbar'],
  },
  locale: { package: null, actions: ['appearance.setLocale'] },
  // The interface's own surfaces: the slot ledger, the frame's panel selection,
  // the right drawer and the command catalogue. All Client-realm, so none of
  // them can ever be declared by a profile package.
  slots: { package: null, actions: ['ui.list', 'ui.state', 'ui.open', 'ui.close'] },
  shortcuts: { package: null, actions: ['ui.invoke'] },
  im: { package: 'im', actions: [] },
}

/**
 * Actions that resolve no service at all, so no row above can list them.
 *
 * `appearance.state` READS the Client-realm services the appearance rows name,
 * but it is served by the appearance domain itself rather than by a service this
 * plugin looks up; `console.actions` reads only the frozen ACTIONS/FORBIDDEN
 * tables. Named explicitly so the completeness check below can distinguish
 * "needs nothing" from "was forgotten".
 */
const SERVICE_FREE_ACTIONS = ['console.actions', 'appearance.state']

/**
 * Actions that fan out over every inventory service rather than resolving one.
 *
 * `console.map` reads `pluginManager`, `mcpManager`, `skills` and `tools` and
 * reports each independently, so attributing it to any single row would be
 * false — it appears under none of them because it depends on all of them.
 * Listed here rather than in `ACTION_SERVICES` so the completeness check still
 * sees it accounted for, and so the `doctor` surface keeps naming it.
 */
const MULTI_SERVICE_ACTIONS = ['console.map']

/**
 * Which registered actions no row above accounts for.
 *
 * The failure this guards against is silence: when `services` covered 13 of the
 * 21 actions, the 7 `appearance.*` ones appeared nowhere while `doctor` reported
 * all 21, so the command quietly under-reported the surface it exists to
 * describe. A reader cannot tell an omission from "needs nothing", which is
 * exactly what the CLI's own honesty rule forbids.
 *
 * @returns the unexplained action ids, empty when the table is complete.
 */
function uncoveredActions() {
  const covered = new Set([...SERVICE_FREE_ACTIONS, ...MULTI_SERVICE_ACTIONS])
  for (const spec of Object.values(ACTION_SERVICES)) {
    for (const action of spec.actions) covered.add(action)
  }
  return Object.keys(ACTIONS).filter((name) => !covered.has(name))
}

function run(command, options) {
  const profile = resolveProfile(options)
  const patchFile = readProfileFile(profile.dir, 'cordis.patch.yml')

  // A missing profile directory is a real failure: reporting an empty summary
  // with exit 0 would tell an agent that a profile exists and is empty, which is
  // a different and much more misleading statement than "there is no profile
  // here". Both `--json` and human output carry the path, so the check is on the
  // command, not on the format.
  if (!existsSync(profile.dir)) {
    const message = `no such DSH profile "${profile.name}" (looked in ${profile.dir}; --profile or DSH_PROFILE selects one)`
    if (options.json) {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        command,
        profile: { name: profile.name, dir: profile.dir, source: profile.source, present: false },
        error: message,
      }, null, 2)}\n`)
    } else {
      process.stderr.write(`vyra-console: ${message}\n`)
    }
    return 1
  }

  if (command === 'doctor') {
    const value = buildDoctor(profile, patchFile)
    if (options.json) { writeJson(value); return 0 }
    writeHuman(doctorLines(value))
    return 0
  }
  if (command === 'state') {
    const value = buildState(profile, patchFile)
    if (options.json) { writeJson(value); return 0 }
    writeHuman(stateLines(value))
    return 0
  }
  if (command === 'services') {
    const value = buildServices(profile)
    if (options.json) { writeJson(value); return 0 }
    writeHuman(serviceLines(value))
    return 0
  }
  if (command === 'events') {
    const value = {
      profile: { name: profile.name, dir: profile.dir, source: profile.source, present: true },
      logs: readEvents(profile.dir),
      source: 'enumerated and checked on this machine',
      note: `log directories only; this CLI reads no log contents, and ${TOOL_CALL} has no log action`,
    }
    if (options.json) { writeJson(value); return 0 }
    writeHuman(eventLines(value))
    return 0
  }

  throw new UsageError(`unknown command "${command}"`)
}

/** The one and only write this process makes: the JSON result, to stdout. */
function writeJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

function writeHuman(lines) {
  const text = lines.filter((line) => line !== undefined).join('\n').trimEnd()
  if (text !== '') process.stdout.write(`${text}\n`)
}

/** A `key=value` pair for the human report; `null` reads as a stated absence. */
function pair(value, source) {
  if (value === null || value === undefined) return 'unknown'
  return source === undefined ? String(value) : `${value} (${source})`
}

function doctorLines(value) {
  const lines = [
    `vyra-console doctor — profile "${value.profile.name}"`,
    `  dir              ${value.profile.dir} (from ${value.profile.source})`,
    `  present          ${value.profile.present}`,
    '',
  ]

  if (value.bundles.count === 0) {
    lines.push('bundles: none (see caveats)', '')
  } else {
    lines.push(`bundles (${value.bundles.count} installed, from package.json dependencies):`)
    for (const bundle of value.bundles.installed) {
      const version = bundle.version === null ? `version unknown (${bundle.spec})` : bundle.version
      lines.push(`  ${bundle.name}  ${version}  ${bundle.enabled}`)
    }
    lines.push('')
  }

  lines.push('model:')
  if (value.model.status !== 'ok') {
    lines.push(`  unknown: ${value.model.reason}`)
  } else {
    const selection = value.model.selection
    lines.push(`  default provider ${pair(selection?.provider?.value, selection?.provider?.source)}`)
    lines.push(`  default model    ${pair(selection?.model?.value, selection?.model?.source)}`)
    // Shown only when declared: the shipped schema makes it optional, so a
    // missing one is normal and must not be dressed up as a documented default.
    if (selection?.reasoningEffort != null) {
      lines.push(`  reasoning effort ${pair(selection.reasoningEffort.value, selection.reasoningEffort.source)}`)
    }
    if (value.model.selectionSource !== undefined) {
      lines.push(`  read from        ${value.model.selectionSource.detail}`)
    }
    lines.push(`  note             ${value.model.note}`)
  }
  lines.push(`  providers        ${value.model.providers.length === 0 ? 'none' : value.model.providers.map((p) => p.name).join(', ')}`)
  lines.push(`  ${value.model.providersNote}`)
  lines.push('')

  lines.push('appearance:')
  lines.push(`  by package name   ${value.appearance.byName.length === 0 ? 'none found' : value.appearance.byName.join(', ')}`)
  // Labelled for what it MEASURES — packages whose own manifest declares a
  // `dsh.client`/`dsh.server` half — not as a count of installed packages, which
  // is what "packages installed 29 of 34" read as and did not mean.
  lines.push(`  can reach browser ${value.appearance.byManifest.length} of ${value.bundles.count} packages declare a dsh half`)
  lines.push('  note              "by package name" is a NAME test, so it is a shortlist rather than an answer:')
  lines.push('                    a theme whose package name does not say so is not in it.')
  lines.push(`  ${value.appearance.note}`)
  lines.push('')

  lines.push('mcp:')
  lines.push(`  declared          ${value.mcp.found ? (value.mcp.declared.length === 0 ? 'none' : value.mcp.declared.join(', ')) : 'unknown'}`)
  if (!value.mcp.found) lines.push(`  reason            ${value.mcp.reason}`)
  lines.push(`  source            ${value.mcp.source}`)
  lines.push(`  ${value.mcp.note}`)
  lines.push('')

  lines.push('console:')
  lines.push(`  actions           ${value.console.total} (${value.console.readOnly} read-only, ${value.console.mutating.length} mutating, 1 self-description)`)
  lines.push(`  forbidden         ${value.console.forbidden.map((f) => f.name).join(', ')}`)
  lines.push(`  mutating actions  ${value.console.mutating.join(', ')}`)
  lines.push('')

  lines.push('caveats:')
  for (const caveat of value.caveats) lines.push(`  - ${caveat}`)
  return lines
}

function stateLines(value) {
  const lines = [
    `vyra-console state — profile "${value.profile.name}"`,
    `  dir              ${value.profile.dir} (from ${value.profile.source})`,
    '',
    'model:',
  ]
  if (value.model.status !== 'ok') {
    lines.push(`  unknown: ${value.model.reason}`)
  } else {
    lines.push(`  default provider ${pair(value.model.selection?.provider?.value, value.model.selection?.provider?.source)}`)
    lines.push(`  default model    ${pair(value.model.selection?.model?.value, value.model.selection?.model?.source)}`)
    if (value.model.selection?.reasoningEffort != null) {
      lines.push(`  reasoning effort ${pair(value.model.selection.reasoningEffort.value, value.model.selection.reasoningEffort.source)}`)
    }
    if (value.model.selectionSource !== undefined) {
      lines.push(`  read from        ${value.model.selectionSource.detail}`)
    }
  }
  lines.push('', 'recorded enablement:')
  if (value.enablement.status !== 'ok') {
    lines.push(`  unknown: ${value.enablement.reason}`)
  } else if (value.enablement.entries.length === 0) {
    lines.push('  none recorded')
  } else {
    for (const entry of value.enablement.entries) lines.push(`  ${entry.id}  ${entry.status}`)
  }
  lines.push('', `bundles: ${value.bundles === null ? 'unknown' : `${value.bundles.count} declared`}`)
  lines.push(`note: ${value.note}`)
  return lines
}

function serviceLines(value) {
  const lines = [
    `vyra-console services — profile "${value.profile.name}"`,
    `  dir              ${value.profile.dir} (from ${value.profile.source})`,
    '',
  ]
  if (value.manifestError !== null) lines.push(`  manifest: ${value.manifestError}`, '')
  for (const row of value.services) {
    // Three states, not two. A service no package can declare is never going to
    // acquire evidence on any profile, so printing "unknown" for it would report
    // a permanent property of the service as a gap in this installation.
    const label = row.declared ? 'declared' : (row.declarable ? 'unknown' : 'host/client')
    const evidence = row.evidence.length > 0
      ? row.evidence.join('; ')
      : (row.declarable ? 'no evidence in this profile' : 'no package declares it')
    lines.push(`  ${label.padEnd(11)}  ${row.service}  (${evidence})`)
  }
  lines.push('')
  for (const caveat of value.caveats) lines.push(`  - ${caveat}`)
  return lines
}

function eventLines(value) {
  const lines = [
    `vyra-console events — profile "${value.profile.name}"`,
    '',
  ]
  for (const row of value.logs) {
    lines.push(`  ${row.present ? 'present' : 'absent '}  ${row.path}`)
  }
  lines.push('', `note: ${value.note}`)
  return lines
}

/**
 * Refuse a command word that names a mutating action, before anything is read.
 *
 * This is the read-only guard with teeth: the file was imported for the action
 * tables alone, and the tables say which verbs change this installation. The
 * refusal names the tool call that would perform it, so the caller is sent
 * somewhere useful rather than merely stopped — the same shape as `core.js`'s
 * `FORBIDDEN` entries, which pair a reason with an alternative.
 */
function refuseMutation(command) {
  const match = ADVISORY_OPERATIONS[command]
  if (match !== undefined) return match
  // The bare last segment, so `vyra-console remove` is refused rather than
  // reported as an unknown command — an agent that half-remembers the surface
  // should still be told that removing is a tool call.
  //
  // Two matches means the bare word is genuinely ambiguous (`set` could be
  // `settings.set` today and something else tomorrow), and picking the first
  // would silently nominate one of them. Nothing is returned in that case, so it
  // falls through to "unknown command" instead of a guess — verified today as
  // unambiguous with zero collisions across all 12 mutating actions.
  const matches = Object.keys(ADVISORY_OPERATIONS).filter((action) => action.split('.').at(-1) === command)
  return matches.length === 1 ? ADVISORY_OPERATIONS[matches[0]] : undefined
}

function main() {
  const { command, args, options } = parseArgs(process.argv.slice(2))

  if (command === undefined || command === 'help' || command === '--help' || options.help) {
    process.stdout.write(`${usage()}\n`)
    return 0
  }

  if (args.length > 0) {
    throw new UsageError(`${command} takes no arguments (got ${args.map((arg) => `"${arg}"`).join(', ')})`)
  }

  if (command === 'actions' || command === 'action') {
    throw new UsageError(`this CLI is read-only and does not perform actions; call ${TOOL_CALL} action=console.actions for the action list`)
  }

  const refusal = refuseMutation(command)
  if (refusal !== undefined) {
    const lines = [
      refusal.message,
      refusal.destructive ? 'This action is irreversible.' : 'This action changes state.',
      refusal.requiresClient ? 'It is performed by the browser half of the plugin.' : undefined,
      `For the read-only view, run: vyra-console doctor`,
      `Every read-only action and the boundary: ${TOOL_CALL} action=console.actions`,
    ]
    if (options.json) {
      // An intentional refusal is a real failure, so it exits non-zero: the
      // difference from a mutating action is that this one names the way to
      // perform it.
      process.stdout.write(`${JSON.stringify({
        ok: false,
        command,
        refused: true,
        reason: 'this CLI is read-only',
        action: refusal.action,
        destructive: refusal.destructive,
        requiresClient: refusal.requiresClient,
        tool: { name: TOOL_CALL, action: refusal.action },
      }, null, 2)}\n`)
      return 1
    }
    writeHuman(lines)
    return 1
  }

  return run(command, options)
}

try {
  process.exitCode = main()
} catch (error) {
  // A usage error is a different kind of failure from an IO error, and the exit
  // code separates them for a caller: 2 means "ask again differently", 1 means
  // "the answer is not here". The message is the whole point either way, so the
  // usage text follows a bad invocation rather than a stack trace.
  if (error instanceof UsageError) {
    process.stderr.write(`vyra-console: ${error.message}\n\n${usage()}\n`)
    process.exitCode = 2
  } else {
    process.stderr.write(`vyra-console: ${String(error?.message ?? error)}\n`)
    process.exitCode = 1
  }
}
