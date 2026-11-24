import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { __test } from '../index.js'

const { resolveOcrEngine, normalizeSettings, parseShortcut, formatShortcut, ocrEngines } = __test

test('parseShortcut 兼容旧的小写紧凑写法', () => {
  assert.deepEqual(parseShortcut('Ctrl+Alt+S'), { mods: ['ctrl', 'alt'], key: 's' })
  // 旧设置里可能是全小写、无分隔、顺序不同；不能因此静默不生效。
  assert.deepEqual(parseShortcut('ctrlaltS'), { mods: ['ctrl', 'alt'], key: 's' })
  assert.deepEqual(parseShortcut('Alt+Ctrl+s'), { mods: ['ctrl', 'alt'], key: 's' })
  assert.deepEqual(parseShortcut('Ctrl+Alt+C'), { mods: ['ctrl', 'alt'], key: 'c' })
  assert.deepEqual(parseShortcut('Ctrl+Shift+L'), { mods: ['ctrl', 'shift'], key: 'l' })
  assert.deepEqual(parseShortcut(''), { mods: [], key: '' })
})

test('formatShortcut 输出工具栏提示用的写法', () => {
  assert.equal(formatShortcut('ctrlaltS'), 'Ctrl+Alt+S')
  assert.equal(formatShortcut('ctrl'), 'Ctrl')
})

test('normalizeSettings 保留纯修饰键快捷键', () => {
  // 旧实现的正则会把 "Ctrl" 这类只含修饰键的值打回默认值。
  const settings = normalizeSettings({ shortcuts: { copyImage: 'Ctrl', text: 'Ctrl+Alt+C' } })
  assert.equal(settings.shortcuts.copyImage, 'Ctrl')
  assert.equal(settings.shortcuts.text, 'Ctrl+Alt+C')
  assert.equal(settings.shortcuts.clipboard, 'Ctrl+Shift+C')
})

test('resolveOcrEngine 支持新配置与旧的 command+args 配置', () => {
  assert.deepEqual(resolveOcrEngine({ id: 'windows', mode: 'winrt' }), {
    id: 'windows', label: 'windows', mode: 'winrt', lang: 'system', command: '', args: [], isDefault: false, timeoutMs: 60000,
  })
  assert.deepEqual(resolveOcrEngine({ id: 'tess', command: 'tesseract', args: ['{input}', '{output}', '-l', '{lang}'] }), {
    id: 'tess', label: 'tess', mode: 'command', lang: 'system', command: 'tesseract', args: ['{input}', '{output}', '-l', '{lang}'], isDefault: false, timeoutMs: 60000,
  })
  // 既没写 mode 也没有 command 的条目是坏的，返回 null 而不是一个不能用的引擎。
  assert.equal(resolveOcrEngine({ id: 'broken' }), null)
  assert.equal(resolveOcrEngine(null), null)
})

test('ocrEngines 把 profile 里 OCR 插件配置的引擎读出来', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'vsr-ocr-cfg-'))
  const saved = process.env.DSH_HOME
  const savedProfile = process.env.DSH_PROFILE
  try {
    const profile = path.join(home, 'profiles', 'probe')
    await mkdir(profile, { recursive: true })
    await writeFile(path.join(profile, 'cordis.patch.yml'), [
      '- id: tool-ocr',
      '  name: "@yuehancn/dsh-tool-ocr"',
      '  config:',
      '    backend: command',
      '    engines:',
      '      - id: tess',
      '        label: Tesseract',
      '        command: tesseract',
      '        args: ["{input}", "{output}", "-l", "chi_sim+eng"]',
      '        isDefault: true',
      '      - id: windows',
      '        mode: winrt',
      '',
      '- id: ui-chat',
      '  name: "@deepseek-ai/dsh-client-ui-chat"',
      '',
    ].join('\n'))
    process.env.DSH_HOME = home
    // 固定 profile 名，避免本机其它 profile 的配置混进结果。
    process.env.DSH_PROFILE = 'probe'
    const engines = await ocrEngines()
    assert.equal(engines.length, 2)
    assert.equal(engines[0].id, 'tess')
    assert.equal(engines[0].command, 'tesseract')
    assert.deepEqual(engines[0].args, ['{input}', '{output}', '-l', 'chi_sim+eng'])
    assert.equal(engines[0].isDefault, true)
    assert.equal(engines[1].mode, 'winrt')
  } finally {
    if (saved === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = saved
    if (savedProfile === undefined) delete process.env.DSH_PROFILE
    else process.env.DSH_PROFILE = savedProfile
    await rm(home, { recursive: true, force: true })
  }
})

test('仓库自带的 OCR 插件源码认得 winrt 后端与输出目录', async () => {
  const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..', '..')
  const source = await readFile(path.join(repo, 'plugins', 'dsh-tool-ocr', 'lib', 'index.js'), 'utf8')
  assert.match(source, /winrt/u)
  assert.match(source, /Windows\.Media\.Ocr/u)
  assert.match(source, /ocr\.ps1/u)
  assert.match(source, /prepareRaster/u)
  assert.ok(!source.includes('\uFFFD'), 'OCR 插件源码里出现了乱码字符')
  assert.ok(homedir().length > 0)
})