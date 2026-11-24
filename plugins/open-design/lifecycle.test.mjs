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

console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`)
process.exit(failed === 0 ? 0 : 1)