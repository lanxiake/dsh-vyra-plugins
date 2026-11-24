import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { GUIDE_SKILL, installGuideSkill } from '../index.js'

/** Run the installer against a throwaway DSH_HOME. */
function withHome(run) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'vfm-guide-'))
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = home
  const logger = { warn() {} }
  try {
    return run(home, logger)
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
    fs.rmSync(home, { recursive: true, force: true })
  }
}

test('initialize 时安装 vyra-dsh-guide 技能，内容不变不重写', () => {
  withHome((home, logger) => {
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
  })
})

test('技能文件永远以 LF 落地，即使打包源被 core.autocrlf 转成了 CRLF', () => {
  // On Windows the source under the package directory may itself be CRLF; the
  // installer has to normalise, or every boot rewrites the file (and `---`
  // front matter stops matching `^---\n`).
  const source = fs.readFileSync(new URL('../skills/vyra-dsh-guide/SKILL.md', import.meta.url), 'utf8')
  assert.equal(/\r/.test(source.replace(/\r\n/g, '')), false, 'the source has a stray CR, not a CRLF pair')

  withHome((home, logger) => {
    installGuideSkill(logger)
    const file = path.join(home, 'skills', GUIDE_SKILL, 'SKILL.md')
    const written = fs.readFileSync(file)
    assert.equal(written.includes(0x0d), false, 'the installed skill must contain no carriage return')
    assert.match(written.toString('utf8'), /^---\n/)
  })
})

test('已经装成 CRLF 的旧副本被认为已是最新，不会反复重写', () => {
  // Content is compared after normalising, so a copy that only differs by its
  // line endings is not "stale": rewriting it every boot would bump its mtime
  // and make the harness reload a skill that did not move.
  withHome((home, logger) => {
    const dir = path.join(home, 'skills', GUIDE_SKILL)
    fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, 'SKILL.md')
    const lf = fs.readFileSync(new URL('../skills/vyra-dsh-guide/SKILL.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
    // What an older build left behind on a Windows machine.
    const crlf = lf.replace(/\n/g, '\r\n')
    fs.writeFileSync(file, crlf)
    const before = fs.statSync(file).mtimeMs

    const answer = installGuideSkill(logger)
    assert.equal(answer.ok, true)
    assert.equal(answer.changed, false)
    assert.equal(fs.readFileSync(file, 'utf8'), crlf, 'the untouched copy is left alone')
    assert.equal(fs.statSync(file).mtimeMs, before, 'and is not rewritten')

    // A fresh install is what actually puts LF on disk.
    fs.rmSync(dir, { recursive: true, force: true })
    assert.equal(installGuideSkill(logger).changed, true)
    assert.equal(fs.readFileSync(file, 'utf8'), lf)
  })
})