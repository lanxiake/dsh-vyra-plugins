// Domain packaging tests: config, sync, agents, CLI.
// Run as: node lifecycle.test.mjs <plugin-dir>
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const pluginRoot = process.argv[2]
const m = await import(pathToFileURL(join(pluginRoot, 'index.js')).href)

let failed = 0
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failed += 1
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${ok ? '' : ` (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`)
}

// ===== Task 1: domain table =====
const domains = await import(pathToFileURL(join(pluginRoot, 'domains.mjs')).href)

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

// The partition: 85 craft skills, exactly once each.
const craftSkills = m.listBundledSkills().filter((s) => s.bundle === 'skills')
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

// Exactly one domain owns the design systems.
check('exactly one design-system domain', domains.DOMAINS.filter((d) => d.designSystems === true).length, 1)
check('design systems belong to visual design', domains.DOMAINS.find((d) => d.designSystems === true).id, 'od-visual-design')

// Defaults: the four high-frequency domains.
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

// The orchestrator exists and names all nine.
check('orchestrator id', domains.ORCHESTRATOR.id, 'od-director')
check('orchestrator has Chinese name', /[\u4e00-\u9fa5]/.test(domains.ORCHESTRATOR.name), true)

// ===== Task 2: per-domain rendering =====
const skillsMod = await import(pathToFileURL(join(pluginRoot, 'skills.mjs')).href)
const all = skillsMod.listBundledSkills(pluginRoot)

const visual = domains.getDomain('od-visual-design')
const visualSkill = skillsMod.renderDomainSkill(visual, all, { root: pluginRoot })
check('visual skill declares its own name', /^name: od-visual-design$/m.test(visualSkill), true)
check('visual skill has a 中文 display heading', visualSkill.includes('# 视觉设计'), true)
check(
  'visual skill lists its 12 craft rows plus 152 systems',
  visualSkill.split('\n').filter((l) => /^\| `[^`]+` \|.*\|$/.test(l)).length,
  12 + 152,
)
check('visual skill carries no other domain skill', visualSkill.includes('gsap-core'), false)

const motion = domains.getDomain('od-motion')
const motionSkill = skillsMod.renderDomainSkill(motion, all, { root: pluginRoot })
check(
  'motion skill lists 13 rows',
  motionSkill.split('\n').filter((l) => /^\| `[^`]+` \|.*\|$/.test(l)).length,
  13,
)
check('motion skill excludes design systems', /open-design-apple/.test(motionSkill), false)
check(
  'no table row spans lines',
  motionSkill.split('\n').filter((l) => l.startsWith('| `') && !l.endsWith('|')).length,
  0,
)
check('frontmatter description is the domain name plus description', /^description: 动效设计领域技能包。.*/m.test(motionSkill), true)

console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`)
process.exit(failed === 0 ? 0 : 1)