import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { GUIDE_SKILL, installGuideSkill } from '../index.js'

test('initialize 时安装 vyra-dsh-guide 技能，内容不变不重写', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'vfm-guide-'))
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = home
  const logger = { warn() {} }
  try {
    const first = installGuideSkill(logger)
    assert.equal(first.ok, true)
    assert.equal(first.changed, true)
    const file = path.join(home, 'skills', GUIDE_SKILL, 'SKILL.md')
    const text = fs.readFileSync(file, 'utf8')
    assert.match(text, /^---\nname: vyra-dsh-guide/)
    assert.match(text, /plugin_manager/)
    assert.match(text, /vyra-plugin-market/)
    assert.match(text, /优先/)

    const second = installGuideSkill(logger)
    assert.equal(second.ok, true)
    assert.equal(second.changed, false)

    fs.writeFileSync(file, 'stale')
    const third = installGuideSkill(logger)
    assert.equal(third.changed, true)
    assert.equal(fs.readFileSync(file, 'utf8'), text)
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
    fs.rmSync(home, { recursive: true, force: true })
  }
})
