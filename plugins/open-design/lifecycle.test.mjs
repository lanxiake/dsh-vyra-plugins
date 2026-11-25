#!/usr/bin/env node
/**
 * The domain-packaging test, structured so it can exercise each module before
 * the whole plugin composes.
 *
 * `index.js` pulls in every module, so importing it first would make an
 * unfinished `config.mjs` look like a broken domain table. Each section instead
 * imports the one module it tests; the legacy lifecycle section, which does need
 * the full plugin, runs last.
 *
 * Run as: node lifecycle.test.mjs <plugin-dir>
 */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const pluginRoot = process.argv[2]
const load = (file) => import(pathToFileURL(join(pluginRoot, file)).href)

let failed = 0
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failed += 1
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${ok ? '' : ` (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`)
}

const domains = await load('domains.mjs')
const skillsMod = await load('skills.mjs')
const all = skillsMod.listBundledSkills(pluginRoot)
const craftSkills = all.filter((s) => s.bundle === 'skills')

// ===== Task 1: domain table =====
console.log('\n--- Task 1: domain table ---')
check('nine domains', domains.DOMAINS.length, 9)
check('domain ids unique', new Set(domains.DOMAIN_IDS).size, 9)
check(
  'every domain id matches preset id rule',
  domains.DOMAINS.filter((d) => !/^[a-z][a-z0-9-]{1,39}$/.test(d.id)).length,
  0,
)
check('every domain has a Chinese name', domains.DOMAINS.filter((d) => !/[\u4e00-\u9fa5]/.test(d.name)).length, 0)
check(
  'every domain has non-empty summary and usage',
  domains.DOMAINS.filter((d) => !d.summary || !d.usage).length,
  0,
)

const assigned = domains.DOMAINS.flatMap((d) => d.skills)
check('assigned total is 85', assigned.length, 85)
check('no skill assigned twice', assigned.length - new Set(assigned).size, 0)
check(
  'every real skill is assigned',
  craftSkills.filter((s) => !assigned.includes(s.name)).map((s) => s.name),
  [],
)
check(
  'no phantom skill assigned',
  assigned.filter((n) => !craftSkills.some((s) => s.name === n)),
  [],
)
check('exactly one design-system domain', domains.DOMAINS.filter((d) => d.designSystems === true).length, 1)
check('design systems belong to visual design', domains.DOMAINS.find((d) => d.designSystems === true).id, 'od-visual-design')
// Every domain ships on: an index costs one description line, and a disabled
// domain is invisible to the director rather than merely unused.
check(
  'default enabled is all nine',
  [...domains.DEFAULT_ENABLED].sort(),
  [...domains.DOMAIN_IDS].sort(),
)
check(
  'defaults are a subset of domains',
  domains.DEFAULT_ENABLED.filter((id) => !domains.DOMAIN_IDS.includes(id)),
  [],
)
check('orchestrator id', domains.ORCHESTRATOR.id, 'od-director')
check('orchestrator has Chinese name', /[\u4e00-\u9fa5]/.test(domains.ORCHESTRATOR.name), true)

// ===== Task 2: per-domain rendering =====
console.log('\n--- Task 2: per-domain rendering ---')
const rowRe = /^\| `[^`]+` \|.*\|$/

const visualSkill = skillsMod.renderDomainSkill(domains.getDomain('od-visual-design'), all, { root: pluginRoot })
check('visual skill declares its own name', /^name: od-visual-design$/m.test(visualSkill), true)
check('visual skill has a 中文 display heading', visualSkill.includes('# 视觉设计'), true)
check('visual skill lists 12 craft rows plus 152 systems', visualSkill.split('\n').filter((l) => rowRe.test(l)).length, 164)
check('visual skill carries no other domain skill', visualSkill.includes('gsap-core'), false)

const motionSkill = skillsMod.renderDomainSkill(domains.getDomain('od-motion'), all, { root: pluginRoot })
check('motion skill lists 13 rows', motionSkill.split('\n').filter((l) => rowRe.test(l)).length, 13)
check('motion skill excludes design systems', /open-design-apple/.test(motionSkill), false)
check('no table row spans lines', motionSkill.split('\n').filter((l) => l.startsWith('| `') && !l.endsWith('|')).length, 0)
check('frontmatter description names the domain', /^description: 动效设计领域技能包。.*/m.test(motionSkill), true)

// ===== Task 3: config =====
console.log('\n--- Task 3: config ---')
const cfgMod = await load('config.mjs')

const homeA = mkdtempSync(join(tmpdir(), 'od-cfg-a-'))
const r1c = cfgMod.readConfig(homeA)
check('missing config yields defaults', [...r1c.enabled].sort(), [...domains.DEFAULT_ENABLED].sort())
check('missing config warns', r1c.warnings.length > 0, true)
check('missing config materialises the file', existsSync(cfgMod.configPath(homeA)), true)

cfgMod.writeConfig(['od-motion'], homeA)
check('write then read', cfgMod.readConfig(homeA).enabled, ['od-motion'])
check('config is valid JSON with version 1', JSON.parse(readFileSync(cfgMod.configPath(homeA), 'utf8')).version, 1)

const homeB = mkdtempSync(join(tmpdir(), 'od-cfg-b-'))
mkdirSync(join(homeB, 'open-design'), { recursive: true })
writeFileSync(cfgMod.configPath(homeB), '{ not json')
const r2c = cfgMod.readConfig(homeB)
check('corrupt config falls back', [...r2c.enabled].sort(), [...domains.DEFAULT_ENABLED].sort())
check('corrupt config warns', r2c.warnings.length > 0, true)
check('corrupt config backed up', readdirSync(join(homeB, 'open-design')).some((n) => n.endsWith('.bak')), true)

const homeC = mkdtempSync(join(tmpdir(), 'od-cfg-c-'))
mkdirSync(join(homeC, 'open-design'), { recursive: true })
writeFileSync(cfgMod.configPath(homeC), JSON.stringify({ version: 1, enabled: ['od-motion', 'od-nope'] }))
const r3c = cfgMod.readConfig(homeC)
check('unknown id dropped', r3c.enabled, ['od-motion'])
check('unknown id warns', r3c.warnings.some((w) => w.includes('od-nope')), true)

const homeD = mkdtempSync(join(tmpdir(), 'od-cfg-d-'))
mkdirSync(join(homeD, 'open-design'), { recursive: true })
writeFileSync(cfgMod.configPath(homeD), JSON.stringify({ version: 1, enabled: ['od-motion', 'od-motion'] }))
check('duplicate ids collapse', cfgMod.readConfig(homeD).enabled, ['od-motion'])

// An empty list is a real choice, not a missing file.
const homeE = mkdtempSync(join(tmpdir(), 'od-cfg-e-'))
mkdirSync(join(homeE, 'open-design'), { recursive: true })
writeFileSync(cfgMod.configPath(homeE), JSON.stringify({ version: 1, enabled: [] }))
check('empty enabled is preserved, not healed', cfgMod.readConfig(homeE).enabled, [])

for (const dir of [homeA, homeB, homeC, homeD, homeE]) rmSync(dir, { recursive: true, force: true })

// ===== Task 4: director spec + roster =====
console.log('\n--- Task 4: director spec + roster ---')
const agMod = await load('agents.mjs')

// There is exactly one generated agent. A domain agent cannot delegate, so it
// was always a dead end: it either does the cross-domain work itself (and the
// director never had the context) or it stalls waiting for a handoff.
check('no per-domain agent builder', typeof agMod.domainAgentSpec, 'undefined')

// The roster is read from disk, which is the only thing a preset directory has.
const rosterHome = mkdtempSync(join(tmpdir(), 'od-roster-'))
const rosterRoot = join(rosterHome, 'agent-manager', 'presets')
const writeRosterAgent = (id, fields) => {
  mkdirSync(join(rosterRoot, id), { recursive: true })
  writeFileSync(join(rosterRoot, id, 'agent.json'), JSON.stringify({ id, ...fields }))
}
writeRosterAgent('agent-xhs', { name: '小红书卡片设计师', summary: '能做卡片，不能做长文' })
writeRosterAgent('agent-raw', { name: '无描述的人' })
writeRosterAgent('od-director', { name: '设计总监' })
mkdirSync(join(rosterRoot, 'not-a-preset'), { recursive: true })

const roster = agMod.readRoster(rosterRoot)
check('roster skips the director itself', roster.some((r) => r.id === 'od-director'), false)
check('roster skips directories without agent.json', roster.some((r) => r.id === 'not-a-preset'), false)
check('roster prefers summary over description', roster.find((r) => r.id === 'agent-xhs').description, '能做卡片，不能做长文')
check('roster keeps the name when nothing describes it', roster.find((r) => r.id === 'agent-raw').name, '无描述的人')
check('roster is sorted and complete', roster.map((r) => r.id), ['agent-raw', 'agent-xhs'])
check('a missing presets dir is an empty roster', agMod.readRoster(join(rosterHome, 'nope')), [])
rmSync(rosterHome, { recursive: true, force: true })

// The director names every roster entry in its prompt — that text is how the
// model knows a preset exists, since the tool only advertises bare ids.
const sampleRoster = [
  { id: 'agent-xhs', name: '小红书卡片设计师', description: '能做卡片，不能做长文' },
  { id: 'recon-worker', name: '仓库调研员', description: '只读本地仓库' },
]
const director = agMod.orchestratorSpec({ roster: sampleRoster, enabledIds: ['od-motion', 'od-writing'] })
check('director id', director.id, 'od-director')
check('director has delegation', director.capabilities.includes('delegation'), true)
check('director team is the whole roster', director.team, ['agent-xhs', 'recon-worker'])
check('director never lists itself', director.team.includes('od-director'), false)
check(
  'director prompt names each roster id',
  sampleRoster.every((r) => director.systemPrompt.includes(`\`${r.id}\``)),
  true,
)
check('director prompt carries each roster description', director.systemPrompt.includes('能做卡片，不能做长文'), true)
check('director prompt forbids improvising an agent', /不要临时创建/.test(director.systemPrompt), true)
check('director prompt forbids touching the UI', /禁止模拟键鼠/.test(director.systemPrompt), true)
check('director prompt prefers continuing over re-spawning', /send_message/.test(director.systemPrompt), true)
check('director summary within tool limit', director.summary.length <= 600, true)
check('director usage within tool limit', director.usage.length <= 1200, true)

// Enabled domains are skills now, listed separately from the people.
check('director separates skills from agents', /技能领域/.test(director.systemPrompt), true)
check('director lists the enabled domains', director.systemPrompt.includes('od-motion'), true)
check('director does not list a disabled domain', director.systemPrompt.includes('od-video'), false)

const emptyDirector = agMod.orchestratorSpec({ roster: [], enabledIds: [] })
check('director with no roster has an empty team', emptyDirector.team, [])
check('director with nothing enabled still explains the state', /没有启用/.test(emptyDirector.systemPrompt), true)
check('director with no roster says so', /还没有任何可委派/.test(emptyDirector.systemPrompt), true)

// Directory layout must match what agent_manager writes (core.js:404).
const files = agMod.agentDirFiles(director)
for (const required of ['agent.json', 'package.json', 'cordis.patch.yml', 'locale/en.json', 'locale/zh.json', 'icon.svg', 'README.md']) {
  check(`agent dir has ${required}`, Object.keys(files).includes(required), true)
}
check('agent.json round-trips', JSON.parse(files['agent.json']).id, 'od-director')
const pkg = JSON.parse(files['package.json'])
check('bundle name is @local/agent-preset-<id>', pkg.name, '@local/agent-preset-od-director')
check('package is private', pkg.private, true)
check('package declares the patch', pkg.dsh.bundle.patch, './cordis.patch.yml')
const patch = JSON.parse(files['cordis.patch.yml']) // JSON is valid YAML
check('patch inserts one row', patch.length, 1)
check('patch row is an agent-preset', patch[0].insert[0].name, '@deepseek-ai/dsh-agent-preset')
check('patch row carries the spec id', patch[0].insert[0].config.id, 'od-director')
check('icon is svg', /^<svg/.test(files['icon.svg']), true)

// ===== Task 5: sync =====
console.log('\n--- Task 5: sync ---')
const syncMod = await load('sync.mjs')

// Defaults: four skill dirs.
const homeS = mkdtempSync(join(tmpdir(), 'od-sync-'))
const s1 = syncMod.sync({ dshHome: homeS, root: pluginRoot, installAgents: false })
check('sync no error', s1.error, null)
check('sync enables every domain by default', [...s1.enabled].sort(), [...domains.DEFAULT_ENABLED].sort())
check('nine skill dirs written', s1.skillsWritten.length, 9)
check('visual skill dir exists', existsSync(join(homeS, 'skills', 'od-visual-design', 'SKILL.md')), true)
check('motion skill dir exists', existsSync(join(homeS, 'skills', 'od-motion', 'SKILL.md')), true)
check('every enabled domain has a skill dir', domains.DOMAIN_IDS.filter((id) => !existsSync(join(homeS, 'skills', id, 'SKILL.md'))), [])

// With agents on: exactly one — the director.
const s1b = syncMod.sync({ dshHome: homeS, root: pluginRoot })
check('one agent dir written', s1b.agentsWritten.length, 1)
check('report lists one agent for the host to register', s1b.agents, ['od-director'])
check('no domain agent dir exists',
  domains.DOMAIN_IDS.filter((id) => existsSync(join(homeS, 'agent-manager', 'presets', id))), [])
check('director preset exists', existsSync(join(homeS, 'agent-manager', 'presets', 'od-director', 'agent.json')), true)
const dirSpec = JSON.parse(readFileSync(join(homeS, 'agent-manager', 'presets', 'od-director', 'agent.json'), 'utf8'))
check('director has delegation', dirSpec.capabilities.includes('delegation'), true)
// The roster is empty here because nothing else is installed in this home.
check('empty home means an empty roster', dirSpec.team, [])

// A preset installed by the Agent manager joins the roster and the whitelist,
// without being listed in the domain config.
const otherDir = join(homeS, 'agent-manager', 'presets', 'xhs-designer')
mkdirSync(otherDir, { recursive: true })
writeFileSync(join(otherDir, 'agent.json'), JSON.stringify({
  id: 'xhs-designer', name: '小红书卡片设计师', summary: '能做卡片轮播，不能做长文',
}))
const s1c = syncMod.sync({ dshHome: homeS, root: pluginRoot })
check('an installed preset joins the roster', s1c.roster.map((r) => r.id), ['xhs-designer'])
const withRoster = JSON.parse(readFileSync(join(homeS, 'agent-manager', 'presets', 'od-director', 'agent.json'), 'utf8'))
check('the installed preset lands on the director team', withRoster.team, ['xhs-designer'])
check('the director prompt names it', withRoster.systemPrompt.includes('xhs-designer'), true)
check('a new roster row rewrites the director', s1c.agentsWritten, ['od-director'])
rmSync(otherDir, { recursive: true, force: true })

// A leftover domain agent from an earlier version is reported for removal and
// kept OUT of the roster: naming an agent that is about to be deleted is worse
// than having nobody.
const staleSibling = join(homeS, 'agent-manager', 'presets', 'od-video')
mkdirSync(staleSibling, { recursive: true })
writeFileSync(join(staleSibling, 'agent.json'), JSON.stringify({ id: 'od-video', name: '视频制作' }))
const s1s = syncMod.sync({ dshHome: homeS, root: pluginRoot })
check('a leftover domain agent is reported stale', s1s.stale, ['od-video'])
check('a stale domain agent stays out of the roster', s1s.roster.some((r) => r.id === 'od-video'), false)
check('a stale domain agent stays out of the team',
  JSON.parse(readFileSync(join(homeS, 'agent-manager', 'presets', 'od-director', 'agent.json'), 'utf8')).team,
  [])
check('the stale directory is untouched by sync', existsSync(staleSibling), true)
check('removeStalePresets deletes it', syncMod.removeStalePresets(join(homeS, 'agent-manager', 'presets'), ['od-video']), ['od-video'])
check('the stale directory is gone', existsSync(staleSibling), false)
check('removing one that is already gone is harmless',
  syncMod.removeStalePresets(join(homeS, 'agent-manager', 'presets'), ['od-video']), [])

// The host registry contributes presets with no spec on disk (`standard`, ...).
const s1d = syncMod.sync({
  dshHome: homeS, root: pluginRoot,
  systemPresets: [{ id: 'standard', name: '标准', description: '内置通用模式' }],
})
check('system presets reach the roster', s1d.roster.map((r) => r.id), ['standard'])
check('system presets reach the team',
  JSON.parse(readFileSync(join(homeS, 'agent-manager', 'presets', 'od-director', 'agent.json'), 'utf8')).team,
  ['standard'])

// Idempotent.
const snap = readFileSync(join(homeS, 'skills', 'od-motion', 'SKILL.md'), 'utf8')
const s2 = syncMod.sync({ dshHome: homeS, root: pluginRoot, systemPresets: [{ id: 'standard', name: '标准', description: '内置通用模式' }] })
check('second sync writes no skills', s2.skillsWritten.length, 0)
check('second sync writes no agents', s2.agentsWritten.length, 0)
check('second sync keeps content', readFileSync(join(homeS, 'skills', 'od-motion', 'SKILL.md'), 'utf8') === snap, true)

// Disabling a domain no longer touches agents; it only removes the skill dir.
cfgMod.writeConfig(['od-writing'], homeS)
const s3 = syncMod.sync({ dshHome: homeS, root: pluginRoot })
check('disable removes the motion skill dir', existsSync(join(homeS, 'skills', 'od-motion')), false)
check('disable does not remove the director', existsSync(join(homeS, 'agent-manager', 'presets', 'od-director')), true)
check('disable reported the removals', s3.removed.includes('od-motion'), true)

// Legacy single-aggregator directory is cleaned up.
const homeL = mkdtempSync(join(tmpdir(), 'od-legacy-'))
mkdirSync(join(homeL, 'skills', 'opendesign'), { recursive: true })
writeFileSync(join(homeL, 'skills', 'opendesign', 'SKILL.md'), 'old')
syncMod.sync({ dshHome: homeL, root: pluginRoot, installAgents: false })
check('legacy aggregator removed', existsSync(join(homeL, 'skills', 'opendesign')), false)

// Turning everything off is legal: no skill dirs, only the director.
cfgMod.writeConfig([], homeL)
const s4 = syncMod.sync({ dshHome: homeL, root: pluginRoot })
check('disable-all writes no skill dirs', s4.skillsWritten.length, 0)
check('disable-all leaves only the director agent', s4.agents, ['od-director'])
check('disable-all leaves no domain agent dirs',
  domains.DOMAIN_IDS.filter((id) => existsSync(join(homeL, 'agent-manager', 'presets', id))), [])

// A skills root that is a file must degrade, not throw.
const homeBroken = mkdtempSync(join(tmpdir(), 'od-broken-'))
writeFileSync(join(homeBroken, 'skills'), 'not a directory')
const s5 = syncMod.sync({ dshHome: homeBroken, root: pluginRoot, installAgents: false })
check('broken skills root reports an error', typeof s5.error, 'string')

for (const dir of [homeS, homeL, homeBroken]) rmSync(dir, { recursive: true, force: true })

// ===== Task 6: CLI =====
console.log('\n--- Task 6: CLI ---')
const cliMod = await load('cli.mjs')
const cliHome = mkdtempSync(join(tmpdir(), 'od-cli-'))
const run = (args) => cliMod.run(args, { dshHome: cliHome, root: pluginRoot, installAgents: false })

const listOut = run(['domains', 'list'])
check('list exits 0', listOut.exitCode, 0)
check('list shows all nine domains', domains.DOMAINS.filter((d) => listOut.stdout.includes(d.id)).length, 9)
check('list marks enabled state', /✅/.test(listOut.stdout), true)

check('enable unknown id exits 1', run(['domains', 'enable', 'od-nope']).exitCode, 1)
check('enable unknown id names the culprit', run(['domains', 'enable', 'od-nope']).stderr.includes('od-nope'), true)
check('enable with no ids exits 1', run(['domains', 'enable']).exitCode, 1)

check('enable video exits 0', run(['domains', 'enable', 'od-video']).exitCode, 0)
check('video now enabled', cfgMod.readConfig(cliHome).enabled.includes('od-video'), true)
check('video skill dir created', existsSync(join(cliHome, 'skills', 'od-video', 'SKILL.md')), true)

check('disable video exits 0', run(['domains', 'disable', 'od-video']).exitCode, 0)
check('video now disabled', cfgMod.readConfig(cliHome).enabled.includes('od-video'), false)
check('video skill dir removed', existsSync(join(cliHome, 'skills', 'od-video')), false)

check('enable-all exits 0', run(['domains', 'enable-all']).exitCode, 0)
check('enable-all enables nine', cfgMod.readConfig(cliHome).enabled.length, 9)
check('all nine skill dirs exist after enable-all',
  domains.DOMAIN_IDS.filter((id) => !existsSync(join(cliHome, 'skills', id, 'SKILL.md'))), [])

check('disable-all exits 0', run(['domains', 'disable-all']).exitCode, 0)
check('disable-all enables none', cfgMod.readConfig(cliHome).enabled.length, 0)
check('disable-all leaves no skill dirs',
  domains.DOMAIN_IDS.filter((id) => existsSync(join(cliHome, 'skills', id))), [])

check('agents list exits 0', run(['agents', 'list']).exitCode, 0)
check('agents list names the director', run(['agents', 'list']).stdout.includes('od-director'), true)
check('unknown command exits 1', run(['frobnicate']).exitCode, 1)
check('no command prints usage', /odx/.test(run([]).stdout), true)

const jsonOut = run(['domains', 'list', '--json'])
check('json output parses', Array.isArray(JSON.parse(jsonOut.stdout)), true)
check('json has nine rows', JSON.parse(jsonOut.stdout).length, 9)
check('json rows carry enabled', typeof JSON.parse(jsonOut.stdout)[0].enabled, 'boolean')

check('sync exits 0', run(['sync']).exitCode, 0)

rmSync(cliHome, { recursive: true, force: true })


// ===== Task 7: host wiring =====
console.log('\n--- Task 7: host wiring ---')
const m = await load('index.js')

// Without a pluginManager the plugin must still lay down skills, and say so.
const applyHome = mkdtempSync(join(tmpdir(), 'od-apply-'))
const applyLogs = []
const applyReport = await m.apply(
  { logger: () => ({ info: (s) => applyLogs.push(s), warn: (s) => applyLogs.push(s) }), get: () => undefined, on() {} },
  { dshHome: applyHome },
)
check('apply without pluginManager succeeds', applyReport.error, null)
check('apply created skill dirs', existsSync(join(applyHome, 'skills', 'od-visual-design', 'SKILL.md')), true)
check('apply created agent dirs', existsSync(join(applyHome, 'agent-manager', 'presets', 'od-director', 'agent.json')), true)
check('apply warns that presets are unregistered', applyLogs.some((l) => l.includes('pluginManager')), true)

// With a pluginManager, every generated agent is registered.
const installed = []
const applyHome2 = mkdtempSync(join(tmpdir(), 'od-apply2-'))
await m.apply(
  {
    logger: () => ({ info() {}, warn() {} }),
    get: (service) =>
      service === 'pluginManager'
        ? { installBundle: async (dir, opts) => { installed.push({ dir, opts }); return { application: 'applied' } } }
        : undefined,
    on() {},
  },
  { dshHome: applyHome2 },
)
check('apply registers one bundle', installed.length, 1)
check('registration targets the director too', installed.some((i) => i.dir.includes('od-director')), true)
check('registration enables the bundle', installed.every((i) => i.opts.enabled === true), true)

// A leftover domain agent from an earlier version is reported, never removed
// here: `removeBundle` runs `pnpm remove` and reloads the profile, and doing
// that from inside this plugin's own apply() deadlocks boot. `odx presets
// prune` removes it from outside the boot path.
const staleHome = mkdtempSync(join(tmpdir(), 'od-stale-'))
const staleDir = join(staleHome, 'agent-manager', 'presets', 'od-motion')
mkdirSync(staleDir, { recursive: true })
writeFileSync(join(staleDir, 'agent.json'), JSON.stringify({ id: 'od-motion' }))
const staleLogs = []
const removedBundles = []
await m.apply(
  {
    logger: () => ({ info: (s) => staleLogs.push(s), warn: (s) => staleLogs.push(s) }),
    get: (service) =>
      service === 'pluginManager'
        ? {
            installBundle: async () => ({ application: 'applied' }),
            removeBundle: async (name) => { removedBundles.push(name); return { application: 'applied' } },
          }
        : undefined,
    on() {},
  },
  { dshHome: staleHome },
)
check('apply never uninstalls a bundle mid-boot', removedBundles, [])
check('the stale directory is left alone', existsSync(staleDir), true)
check('the stale agent is named in the log', staleLogs.some((l) => l.includes('od-motion')), true)

rmSync(staleHome, { recursive: true, force: true })

// enabled: false mounts nothing.
const applyHome3 = mkdtempSync(join(tmpdir(), 'od-apply3-'))
const off = await m.apply(
  { logger: () => ({ info() {}, warn() {} }), get: () => undefined, on() {} },
  { dshHome: applyHome3, enabled: false },
)
check('enabled:false installs nothing', off.installed, 0)
check('enabled:false writes no skill dirs', existsSync(join(applyHome3, 'skills')), false)

// A failing registry never breaks the mount.
const applyHome4 = mkdtempSync(join(tmpdir(), 'od-apply4-'))
const flakyLogs = []
const flaky = await m.apply(
  {
    logger: () => ({ info() {}, warn: (s) => flakyLogs.push(s) }),
    get: (service) =>
      service === 'pluginManager' ? { installBundle: async () => { throw new Error('boom') } } : undefined,
    on() {},
  },
  { dshHome: applyHome4 },
)
check('a throwing registry does not fail apply', flaky.error, null)
check('a throwing registry is logged', flakyLogs.some((l) => l.includes('boom')), true)

for (const dir of [applyHome, applyHome2, applyHome3, applyHome4]) rmSync(dir, { recursive: true, force: true })


// ===== Task 8: settings page state =====
console.log('\n--- Task 8: settings page state ---')
const stateMod = await load('state.mjs')

const homeSt = mkdtempSync(join(tmpdir(), 'od-state-'))
const view = stateMod.describe({ dshHome: homeSt, root: pluginRoot })
check('describe lists nine domains', view.domains.length, 9)
check('describe marks defaults enabled',
  view.domains.filter((d) => d.enabled).map((d) => d.id).sort(),
  [...domains.DEFAULT_ENABLED].sort())
check('describe carries skill names for a domain',
  view.domains.find((d) => d.id === 'od-motion').skills.includes('gsap-core'), true)
check('describe flags the design-system domain',
  view.domains.filter((d) => d.designSystems).map((d) => d.id), ['od-visual-design'])

// Agents start absent because nothing has been synced yet.
check('describe reports agents as absent before sync',
  view.agents.every((a) => a.present === false), true)
check('describe lists the director', view.agents[0].id, 'od-director')

// Toggling writes config and syncs in one call.
const toggleOn = stateMod.applyToggle({ enabled: ['od-motion', 'od-video'], dshHome: homeSt, root: pluginRoot })
check('applyToggle succeeds', toggleOn.ok, true)
check('applyToggle synced two skill dirs', toggleOn.report.skillsWritten.length, 2)
check('video skill dir now exists', existsSync(join(homeSt, 'skills', 'od-video', 'SKILL.md')), true)
const after = stateMod.describe({ dshHome: homeSt, root: pluginRoot })
check('describe reflects the new set',
  after.domains.filter((d) => d.enabled).map((d) => d.id).sort(), ['od-motion', 'od-video'])
check('describe sees the regenerated agent',
  after.agents.filter((a) => a.present).length, 1)

// Turning everything off is allowed and leaves only the director.
const toggleOff = stateMod.applyToggle({ enabled: [], dshHome: homeSt, root: pluginRoot })
check('applyToggle accepts an empty set', toggleOff.ok, true)
check('empty set leaves no domain skill dirs',
  domains.DOMAIN_IDS.filter((id) => existsSync(join(homeSt, 'skills', id))), [])

// Unknown ids are rejected whole and change nothing.
const beforeReject = cfgMod.readConfig(homeSt).enabled
const rejected = stateMod.applyToggle({ enabled: ['od-motion', 'od-nope'], dshHome: homeSt, root: pluginRoot })
check('applyToggle rejects unknown ids', rejected.ok, false)
check('rejection names the culprit', rejected.unknown, ['od-nope'])
check('rejection writes nothing', cfgMod.readConfig(homeSt).enabled, beforeReject)

// A malformed body is rejected.
check('applyToggle rejects a non-array', stateMod.applyToggle({ enabled: 'nope', dshHome: homeSt }).ok, false)

// Regenerating agents does not change the enabled set.
cfgMod.writeConfig(['od-writing'], homeSt)
const regen = stateMod.regenerateAgents({ dshHome: homeSt, root: pluginRoot })
check('regenerateAgents succeeds', regen.ok, true)
check('regenerateAgents keeps the enabled set', cfgMod.readConfig(homeSt).enabled, ['od-writing'])
check('regenerateAgents wrote the director',
  existsSync(join(homeSt, 'agent-manager', 'presets', 'od-director', 'agent.json')), true)

const counts = stateMod.skillCounts(pluginRoot)
check('skillCounts craft', counts.craft, 85)
check('skillCounts systems', counts.systems, 152)
check('skillCounts total', counts.total, 237)

rmSync(homeSt, { recursive: true, force: true })


// ===== Task 9: HTTP routes =====
console.log('\n--- Task 9: HTTP routes ---')
const routesMod = await load('routes.mjs')
const homeRt = mkdtempSync(join(tmpdir(), 'od-routes-'))
const opts = { dshHome: homeRt, root: pluginRoot }

const get0 = routesMod.handle('config', 'GET', undefined, opts)
check('GET config is 200', get0.status, 200)
check('GET config lists nine domains', get0.body.domains.length, 9)
check('GET config carries counts', get0.body.counts.total, 237)
check('GET config carries agents', Array.isArray(get0.body.agents), true)

const patchOk = routesMod.handle('config', 'PATCH', { enabled: ['od-video'] }, opts)
check('PATCH config is 200', patchOk.status, 200)
check('PATCH returns the refreshed view',
  patchOk.body.domains.filter((d) => d.enabled).map((d) => d.id), ['od-video'])
check('PATCH reports what it wrote', patchOk.body.applied.skillsWritten, ['od-video'])
check('PATCH actually synced', existsSync(join(homeRt, 'skills', 'od-video', 'SKILL.md')), true)

const patchBad = routesMod.handle('config', 'PATCH', { enabled: ['od-nope'] }, opts)
check('PATCH unknown id is 400', patchBad.status, 400)
check('PATCH unknown id explains', patchBad.body.unknown, ['od-nope'])

check('GET on a wrong route is 404', routesMod.handle('nope', 'GET', undefined, opts).status, 404)
check('DELETE config is 405', routesMod.handle('config', 'DELETE', undefined, opts).status, 405)
check('GET agents is 405', routesMod.handle('agents', 'GET', undefined, opts).status, 405)

const regen2 = routesMod.handle('agents', 'POST', {}, opts)
check('POST agents is 200', regen2.status, 200)
check('POST agents leaves the director in place',
  regen2.body.agents.some((a) => a.id === 'od-director' && a.present), true)

// A web server that records registrations.
const registered = []
const fakeServer = { register: (spec) => { registered.push(spec); return () => {} } }
const disposers = routesMod.mountRoutes(fakeServer, opts)
check('mountRoutes registers two routes', registered.length, 2)
check('route paths are exact', registered.every((r) => r.kind === 'exact'), true)
check('route paths are namespaced',
  registered.map((r) => r.path).sort(), ['/open-design/agents', '/open-design/config'])
check('mountRoutes returns disposers', disposers.length, 2)
check('mountRoutes tolerates a missing server', routesMod.mountRoutes(undefined, opts).length, 0)

rmSync(homeRt, { recursive: true, force: true })


// ===== Task 10: client bundle =====
console.log('\n--- Task 10: client bundle ---')
const clientSource = readFileSync(join(pluginRoot, 'client.js'), 'utf8')

check('client registers through the module loader', clientSource.includes('__ModuleLoader__.load'), true)
check('client id is the package name', /id: 'open-design'/.test(clientSource), true)
// dsh-doc forbids requiring Harness Client packages; only React may be required.
const requires = [...clientSource.matchAll(/require\((['"])(.+?)\1\)/g)].map((m) => m[2])
check('client requires nothing but react',
  requires.filter((name) => name !== 'react'), [])
check('client registers a settings section', clientSource.includes("'settings.section'"), true)
check('client uses the switch role', clientSource.includes("role: 'switch'"), true)
check('client sets aria-checked', clientSource.includes("'aria-checked'"), true)
check('client uses host theme tokens', clientSource.includes('--dsw-alias-'), true)
// Artwork may be literal; the panel itself must not hard-code colours.
check('client defines no literal hex colours outside artwork',
  /#[0-9a-fA-F]{3,8}['"]/.test(clientSource.replace(/background: '#fff'/, '')), false)
check('client talks to the host routes', clientSource.includes('/open-design'), true)
check('client mentions the restart caveat', clientSource.includes('新建会话'), true)

const clientPkg = JSON.parse(readFileSync(join(pluginRoot, 'package.json'), 'utf8').replace(/^\uFEFF/u, ''))
check('package declares dsh.client', clientPkg.dsh.client !== undefined, true)
check('package exports ./client', clientPkg.exports['./client'], './client.js')
check('client bundle ships', clientPkg.files.includes('client.js'), true)


// ===== Task 11: route mounting =====
console.log('\n--- Task 11: route mounting ---')

// The route row declares `inject: [webServer]` in cordis.patch.yml. That is the
// whole mechanism: with the declaration the Loader hands the service to apply()
// as ctx.webServer. Without it nothing resolves and the panel 404s — which is
// how three earlier attempts failed, each fixing one layer and missing this one.
const patchSource = readFileSync(join(pluginRoot, 'cordis.patch.yml'), 'utf8')
check('patch row declares inject: [webServer]', /inject:\s*\[\s*webServer\s*\]/u.test(patchSource), true)

const routesHome = mkdtempSync(join(tmpdir(), 'od-mount-'))
const registeredPaths = []
const serverCtx = {
  logger: () => ({ info() {}, warn() {} }),
  webServer: {
    register(spec) {
      registeredPaths.push(spec.path)
      return () => {}
    },
  },
  get() {},
  effect() {},
  on() {},
}
await m.apply(serverCtx, { dshHome: routesHome, installAgents: false })
check(
  'apply mounts both routes from ctx.webServer',
  registeredPaths.sort(),
  ['/open-design/agents', '/open-design/config'],
)

const noServerHome = mkdtempSync(join(tmpdir(), 'od-noserver-'))
const bare = await m.apply(
  { logger: () => ({ info() {}, warn() {} }), get() {}, effect() {}, on() {} },
  { dshHome: noServerHome, installAgents: false },
)
check('apply survives a host without webServer', bare.error, null)
const diag = await import(pathToFileURL(join(pluginRoot, 'diagnostics.mjs')).href)
check('mount failure is recorded', diag.readMountRecord(noServerHome)?.ok, false)

rmSync(routesHome, { recursive: true, force: true })
rmSync(noServerHome, { recursive: true, force: true })

// ===== Task 12: preset plugin rows =====
console.log('\n--- Task 12: preset plugin rows ---')

// A preset whose `plugins` array is empty mounts nothing: the agent loses read,
// shell, skill loading and tools, and can only reach host-global ones. That was
// the shipped state, and it is why a director with a read-only task ended up
// unable to open the repository.
const soleSpec = agMod.orchestratorSpec({
  roster: [{ id: 'xhs-designer', name: '小红书卡片设计师', description: '能做卡片轮播' }],
  enabledIds: ['od-visual-design'],
})
check('director spec carries rows', Array.isArray(soleSpec.rows), true)
check('director rows are not empty', soleSpec.rows.length > 5, true)

const soleFiles = agMod.agentDirFiles(soleSpec)
const solePlugins = JSON.parse(soleFiles['cordis.patch.yml'])[0].insert[0].config.plugins
check('patch plugins is not empty', solePlugins.length > 5, true)

// Every row a preset needs to do work, and the one row that lets it delegate.
const ids = new Set()
const collect = (rows) => {
  for (const row of rows) {
    ids.add(row.id)
    if (row.group && Array.isArray(row.config)) collect(row.config)
  }
}
collect(solePlugins)
check('has file tools', ids.has('tool-fs'), true)
check('has shell tool', ids.has('tool-pwsh'), true)
check('has skill loader', ids.has('tool-skill'), true)
check('has todo', ids.has('tool-todo'), true)
check('has persona', ids.has('persona'), true)
check('has the subagent tool', ids.has('tool-subagent'), true)

// The delegation whitelist travels with the row, and is the whole roster.
const subagentRow = solePlugins
  .find((row) => row.group && row.id === 'delegation')
  .config.find((row) => row.id === 'tool-subagent')
check('director binds allowedAgentPresets to the roster', subagentRow.config.allowedAgentPresets, ['xhs-designer'])

// Users may install a preset without a delegation capability; the director can
// still spawn it, because the whitelist is ours and the child's own rows decide
// what it can do.
const twoSpec = agMod.orchestratorSpec({
  roster: [
    { id: 'standard', name: '标准', description: '内置通用模式' },
    { id: 'recon-worker', name: '仓库调研员', description: '只读本地仓库' },
  ],
  enabledIds: [],
})
check('every roster row is reachable', twoSpec.team, ['standard', 'recon-worker'])

// With nobody to delegate to, the delegation group is omitted entirely — a
// whitelist of zero ids is rejected by the host schema (`min(1)`).
const emptyIds = new Set()
const collectEmpty = (rows) => {
  for (const row of rows) {
    emptyIds.add(row.id)
    if (row.group && Array.isArray(row.config)) collectEmpty(row.config)
  }
}
collectEmpty(agMod.agentDirFiles(agMod.orchestratorSpec({ roster: [], enabledIds: [] }))['cordis.patch.yml'] === ''
  ? [] : JSON.parse(agMod.agentDirFiles(agMod.orchestratorSpec({ roster: [], enabledIds: [] }))['cordis.patch.yml'])[0].insert[0].config.plugins)
check('director without members omits delegation', emptyIds.has('delegation'), false)
check('director without members still has file tools', emptyIds.has('tool-fs'), true)
console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`)
process.exit(failed === 0 ? 0 : 1)