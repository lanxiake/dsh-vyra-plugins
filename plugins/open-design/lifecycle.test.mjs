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

console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`)
process.exit(failed === 0 ? 0 : 1)