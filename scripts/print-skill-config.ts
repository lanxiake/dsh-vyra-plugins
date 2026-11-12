/**
 * Copy or link the skills in `skills/` into a DSH profile's skill roots.
 *
 * DSH discovers skills through `dsh-skill-filesystem`'s `customSkillDirs`. This
 * script prints the profile patch a user pastes into their own profile, rather
 * than editing their Harness home for them.
 *
 * @module vyra-plugins/print-skill-config
 */

import { readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const skillsDir = resolve(root, 'skills')

/** Directory names directly under `skills/` that contain a `SKILL.md`. */
function skillNames(): string[] {
  return readdirSync(skillsDir).filter((entry) => {
    try {
      return statSync(resolve(skillsDir, entry, 'SKILL.md')).isFile()
    } catch {
      return false
    }
  }).sort()
}

const names = skillNames()
const absolute = skillsDir.replaceAll('\\', '/')

console.log(`# ${names.length} skill(s) in ${absolute}`)
for (const name of names) console.log(`#   ${name}`)
console.log()
console.log('# Add to your profile cordis.patch.yml (or pass with --patch):')
console.log('- id: skill-filesystem')
console.log('  config:')
console.log('    customSkillDirs:')
console.log(`      - '${absolute}'`)
