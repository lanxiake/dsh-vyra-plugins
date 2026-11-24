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
check(
  'default enabled is the four',
  [...domains.DEFAULT_ENABLED].sort(),
  ['od-motion', 'od-presentation', 'od-visual-design', 'od-writing'].sort(),
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

// ===== Task 4: agent specs =====
console.log('\n--- Task 4: agent specs ---')
const agMod = await load('agents.mjs')

const motionSpec = agMod.domainAgentSpec(domains.getDomain('od-motion'))
check('domain agent id matches domain', motionSpec.id, 'od-motion')
check('domain agent name is Chinese', /[\u4e00-\u9fa5]/.test(motionSpec.name), true)
check(
  'domain agent skills match domain',
  [...motionSpec.skills].sort(),
  [...domains.getDomain('od-motion').skills].sort(),
)
check('domain agent has no delegation', motionSpec.capabilities.includes('delegation'), false)
check('domain agent has no team', motionSpec.team, [])
check('domain agent includes the skills capability', motionSpec.capabilities.includes('skills'), true)
check('domain agent summary states what it cannot do', /不能做/.test(motionSpec.summary), true)
check('summary within tool limit', motionSpec.summary.length <= 600, true)
check('usage within tool limit', motionSpec.usage.length <= 1200, true)
check('system prompt points at the domain index skill', motionSpec.systemPrompt.includes('od-motion'), true)

const visualSpec = agMod.domainAgentSpec(domains.getDomain('od-visual-design'))
check('visual agent omits the 152 design systems from skills', visualSpec.skills.includes('open-design-apple'), false)
check('visual agent points at the index for design systems', /设计系统/.test(visualSpec.systemPrompt), true)

const director = agMod.orchestratorSpec(['od-motion', 'od-writing'])
check('director id', director.id, 'od-director')
check('director has delegation', director.capabilities.includes('delegation'), true)
check('director team is the enabled set', [...director.team].sort(), ['od-motion', 'od-writing'])
check('director never lists itself', director.team.includes('od-director'), false)
check('director summary within tool limit', director.summary.length <= 600, true)
check('director usage within tool limit', director.usage.length <= 1200, true)

const emptyDirector = agMod.orchestratorSpec([])
check('director with nothing enabled has an empty team', emptyDirector.team, [])
check('director with nothing enabled still explains the state', /没有启用/.test(emptyDirector.systemPrompt), true)

// Directory layout must match what agent_manager writes (core.js:404).
const files = agMod.agentDirFiles(motionSpec)
for (const required of ['agent.json', 'package.json', 'cordis.patch.yml', 'locale/en.json', 'locale/zh.json', 'icon.svg', 'README.md']) {
  check(`agent dir has ${required}`, Object.keys(files).includes(required), true)
}
check('agent.json round-trips', JSON.parse(files['agent.json']).id, 'od-motion')
const pkg = JSON.parse(files['package.json'])
check('bundle name is @local/agent-preset-<id>', pkg.name, '@local/agent-preset-od-motion')
check('package is private', pkg.private, true)
check('package declares the patch', pkg.dsh.bundle.patch, './cordis.patch.yml')
const patch = JSON.parse(files['cordis.patch.yml']) // JSON is valid YAML
check('patch inserts one row', patch.length, 1)
check('patch row is an agent-preset', patch[0].insert[0].name, '@deepseek-ai/dsh-agent-preset')
check('patch row carries the spec id', patch[0].insert[0].config.id, 'od-motion')
check('icon is svg', /^<svg/.test(files['icon.svg']), true)

// ===== Task 5: sync =====
console.log('\n--- Task 5: sync ---')
const syncMod = await load('sync.mjs')

// Defaults: four skill dirs, four domain agents + director.
const homeS = mkdtempSync(join(tmpdir(), 'od-sync-'))
const s1 = syncMod.sync({ dshHome: homeS, root: pluginRoot, installAgents: false })
check('sync no error', s1.error, null)
check('sync enabled four', [...s1.enabled].sort(), [...domains.DEFAULT_ENABLED].sort())
check('four skill dirs written', s1.skillsWritten.length, 4)
check('visual skill dir exists', existsSync(join(homeS, 'skills', 'od-visual-design', 'SKILL.md')), true)
check('motion skill dir exists', existsSync(join(homeS, 'skills', 'od-motion', 'SKILL.md')), true)
check('disabled domain has no skill dir', existsSync(join(homeS, 'skills', 'od-video')), false)

// With agents on: four domain agents + director.
const s1b = syncMod.sync({ dshHome: homeS, root: pluginRoot })
check('five agent dirs written', s1b.agentsWritten.length, 5)
check('report lists five agents for the host to register', s1b.agents.length, 5)
check('director preset exists', existsSync(join(homeS, 'agent-manager', 'presets', 'od-director', 'agent.json')), true)
const dirSpec = JSON.parse(readFileSync(join(homeS, 'agent-manager', 'presets', 'od-director', 'agent.json'), 'utf8'))
check('director team is the enabled four', [...dirSpec.team].sort(), [...domains.DEFAULT_ENABLED].sort())
check('director has delegation', dirSpec.capabilities.includes('delegation'), true)
const motionAgent = JSON.parse(readFileSync(join(homeS, 'agent-manager', 'presets', 'od-motion', 'agent.json'), 'utf8'))
check('domain agent has no delegation on disk', motionAgent.capabilities.includes('delegation'), false)

// Idempotent.
const snap = readFileSync(join(homeS, 'skills', 'od-motion', 'SKILL.md'), 'utf8')
const s2 = syncMod.sync({ dshHome: homeS, root: pluginRoot })
check('second sync writes no skills', s2.skillsWritten.length, 0)
check('second sync writes no agents', s2.agentsWritten.length, 0)
check('second sync keeps content', readFileSync(join(homeS, 'skills', 'od-motion', 'SKILL.md'), 'utf8') === snap, true)

// Disabling removes the directory and the agent, and shrinks the director.
cfgMod.writeConfig(['od-writing'], homeS)
const s3 = syncMod.sync({ dshHome: homeS, root: pluginRoot })
check('disable removes the motion skill dir', existsSync(join(homeS, 'skills', 'od-motion')), false)
check('disable removes the motion agent', existsSync(join(homeS, 'agent-manager', 'presets', 'od-motion')), false)
check(
  'disable shrinks the director team',
  JSON.parse(readFileSync(join(homeS, 'agent-manager', 'presets', 'od-director', 'agent.json'), 'utf8')).team,
  ['od-writing'],
)
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
check('disable-all leaves only the director agent', s4.agents.length, 1)
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
check('apply registers five bundles', installed.length, 5)
check('registration targets the director too', installed.some((i) => i.dir.includes('od-director')), true)
check('registration enables the bundle', installed.every((i) => i.opts.enabled === true), true)

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
check('describe sees the regenerated agents',
  after.agents.filter((a) => a.present).length, 3)

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
check('regenerateAgents wrote the writing agent',
  existsSync(join(homeSt, 'agent-manager', 'presets', 'od-writing', 'agent.json')), true)

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


// ===== Task 11: route mounting uses ctx.inject =====
console.log('\n--- Task 11: route mounting ---')

// A service that is not declared as a dependency is invisible to ctx.get() in
// Cordis, so grouping it that way mounts nothing and the panel 404s. Assert the
// dependency is declared, with a fake ctx that records what apply() asks for.
const injectHome = mkdtempSync(join(tmpdir(), 'od-inject-'))
const askedFor = []
let mountedThrough = null

const officialCtx = {
  logger: () => ({ info() {}, warn() {} }),
  get: () => undefined, // ctx.get must NOT be how webServer is obtained
  inject(deps, callback) {
    askedFor.push(...deps)
    if (deps.includes('webServer')) {
      mountedThrough = { register: () => () => {} }
      callback({ webServer: mountedThrough })
    }
  },
  effect() {},
  on() {},
}

await m.apply(officialCtx, { dshHome: injectHome, installAgents: false })
check('apply declares webServer as a dependency', askedFor.includes('webServer'), true)
check('apply mounted routes through the injected context', mountedThrough !== null, true)

// A host without ctx.inject must not throw.
const bare = await m.apply({ logger: () => ({ info() {}, warn() {} }), get() {}, effect() {}, on() {} }, {
  dshHome: mkdtempSync(join(tmpdir(), 'od-bare-')),
  installAgents: false,
})
check('apply survives a host without ctx.inject', bare.error, null)

rmSync(injectHome, { recursive: true, force: true })

console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`)
process.exit(failed === 0 ? 0 : 1)