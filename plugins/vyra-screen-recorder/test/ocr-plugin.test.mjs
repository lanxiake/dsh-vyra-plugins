/**
 * dsh-tool-ocr 的 winrt 后端冒烟测试。
 *
 * 只在有 @deepseek-ai/schemastery 与 @deepseek-ai/dsh-tools 的安装里跑：
 * 仓库工作区没有这两个依赖时整组跳过（插件运行在 DSH profile 的依赖里）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const plugin = path.join(here, '..', 'plugins', 'dsh-tool-ocr')
const windows = process.platform === 'win32'

async function loadPlugin() {
  try {
    const schemastery = await import('@deepseek-ai/schemastery')
    const tools = await import('@deepseek-ai/dsh-tools')
    return { z: schemastery.default ?? schemastery, defineTool: tools.defineTool }
  } catch {
    return null
  }
}

const deps = await loadPlugin()
const skip = deps === null ? '需要 @deepseek-ai/schemastery 与 @deepseek-ai/dsh-tools（DSH profile 环境）' : (!windows ? '只在 Windows 上跑' : false)

/** 造一张带中英文的 PNG 截图，供 OCR 识别。 */
async function makeSample(file) {
  const { execFileSync } = await import('node:child_process')
  const script = [
    'Add-Type -AssemblyName System.Drawing',
    '$bmp = New-Object System.Drawing.Bitmap 900, 200',
    '$g = [System.Drawing.Graphics]::FromImage($bmp)',
    '$g.Clear([System.Drawing.Color]::White)',
    "$font = New-Object System.Drawing.Font('Microsoft YaHei', 22)",
    '$g.DrawString("Hello Vyra Screen Recorder", $font, [System.Drawing.Brushes]::Black, 20, 20)',
    "$g.DrawString('这是一段中文测试文字', $font, [System.Drawing.Brushes]::Black, 20, 90)",
    '$g.Dispose()',
    `$bmp.Save('${file.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png)`,
    '$bmp.Dispose()',
  ].join('\n')
  const dir = path.dirname(file)
  const scriptFile = path.join(dir, 'make.ps1')
  const { writeFile } = await import('node:fs/promises')
  await writeFile(scriptFile, script, 'utf8')
  execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptFile], { windowsHide: true })
}

function collectTools(config) {
  const registered = []
  const ctx = { tools: { register: definition => { registered.push(definition); return () => {} } } }
  // 插件用 schemastery 校验配置；直接喂解析后的对象即可，apply 只读字段。
  deps.pluginApply(ctx, config)
  return registered
}

test('winrt 后端：ocr_read 用系统 OCR 读出中英文', { skip, timeout: 180000 }, async () => {
  const mod = await import(path.join(plugin, 'lib', 'index.js'))
  deps.pluginApply = mod.apply
  const dir = await mkdtemp(path.join(tmpdir(), 'ocr-winrt-'))
  try {
    const image = path.join(dir, 'sample.png')
    await makeSample(image)
    const tools = collectTools({ ...mod.Config({ backend: 'winrt' }), outputDir: dir, timeoutMs: 60000 })
    const read = tools.find(tool => tool.name === 'ocr_read')
    assert.ok(read, '没有注册 ocr_read')
    const exec = { signal: undefined }
    const value = await read.execute({ path: image }, exec)
    assert.equal(value.engine, 'windows')
    assert.match(value.text, /Vyra/u)
    assert.match(value.text, /这是一段中文测试文字/u)
    // 中文按字拆开的空格必须已经去掉，复制出去就能用。
    assert.ok(!/这 是/u.test(value.text), '中文里仍有逐字空格：' + value.text)
    const saved = await readFile(path.join(dir, 'sample.windows.txt'), 'utf8')
    assert.equal(saved, value.text)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('winrt 后端：ocr_status 报告可用的 Windows 语言', { skip, timeout: 120000 }, async () => {
  const mod = await import(path.join(plugin, 'lib', 'index.js'))
  deps.pluginApply = mod.apply
  const tools = collectTools({ ...mod.Config({ backend: 'winrt' }) })
  const status = tools.find(tool => tool.name === 'ocr_status')
  const value = await status.execute({}, { signal: undefined })
  assert.equal(value.backend, 'winrt')
  const windows = value.engines.find(engine => engine.id === 'windows')
  assert.ok(windows, '状态里没有 windows 引擎')
  assert.equal(windows.available, true, JSON.stringify(windows))
  assert.match(windows.version, /zh-Hans-CN/u)
})