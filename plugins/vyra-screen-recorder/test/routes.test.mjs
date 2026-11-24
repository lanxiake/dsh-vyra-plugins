/** 宿主路由：OCR 取字、剪贴板、默认程序打开的端到端（真的换 PowerShell 子进程）。 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { __test } from '../index.js'

const { handleOcr, handleOcrStatus, handleClipboard, clipboardDir, allowedTarget } = __test
const windows = process.platform === 'win32'
const timeout = 180000

/** 假 req：GET 无体，POST 时把 buffer 当作请求体。 */
class FakeRequest {
  constructor(method, url, body) {
    this.method = method
    this.url = url
    this.body = body
    this.handlers = {}
  }
  on(event, handler) {
    if (this.body !== undefined && event === 'data') handler(Buffer.from(this.body))
    if (event === 'end') handler()
    return this
  }
  destroy() {}
}

/** 假 res：收集状态码与 JSON。 */
function fakeResponse() {
  const res = {
    status: 0,
    headers: {},
    payload: '',
    writeHead(status, headers) { res.status = status; res.headers = headers || {} },
    end(chunk) { if (chunk !== undefined) res.payload += chunk.toString() },
    json() { return JSON.parse(res.payload) },
  }
  return res
}

async function call(handler, request) {
  const res = fakeResponse()
  await handler(request, res)
  return res
}

/** 造一张带中英文的截图，走系统 API 生成 PNG（不需要额外依赖）。 */
async function makeSample(file) {
  const { execFileSync } = await import('node:child_process')
  const dir = path.dirname(file)
  const script = [
    'Add-Type -AssemblyName System.Drawing',
    '$bmp = New-Object System.Drawing.Bitmap 800, 180',
    '$g = [System.Drawing.Graphics]::FromImage($bmp)',
    '$g.Clear([System.Drawing.Color]::White)',
    "$font = New-Object System.Drawing.Font('Microsoft YaHei', 20)",
    '[void]$g.DrawString("Vyra Screen Recorder 2026", $font, [System.Drawing.Brushes]::Black, 20, 20)',
    "[void]$g.DrawString('截图取字测试', $font, [System.Drawing.Brushes]::Black, 20, 90)",
    '$g.Dispose()',
    `$bmp.Save('${file.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png)`,
    '$bmp.Dispose()',
  ].join('\n')
  const scriptFile = path.join(dir, 'make.ps1')
  // Windows PowerShell 5.1 无 BOM 时按 ANSI 读脚本，中文会变乱码——测试夹具
  // 也要带 BOM，否则测的是编码而不是 OCR。
  await writeFile(scriptFile, '\uFEFF' + script, 'utf8')
  execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptFile], { windowsHide: true })
}

test('POST /ocr 用系统 OCR 读出截图里的中英文', { skip: !windows, timeout }, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'vsr-ocr-route-'))
  const saved = process.env.DSH_HOME
  process.env.DSH_HOME = dir
  try {
    const image = path.join(dir, 'shot.png')
    await makeSample(image)
    const body = await readFile(image)
    const res = await call(handleOcr, new FakeRequest('POST', '/plugins/vyra-screen-recorder/ocr', body))
    assert.equal(res.status, 200, res.payload)
    const data = res.json()
    assert.equal(data.ok, true)
    assert.match(data.text, /Vyra/u)
    assert.match(data.text, /截图取字测试/u)
    assert.ok(Array.isArray(data.lines) && data.lines.length >= 1)
    assert.equal(typeof data.ms, 'number')
    assert.equal(data.engine, 'windows')
    // 位置信息是原图坐标，客户端据此描框。
    assert.ok(data.lines[0].w > 0 && data.lines[0].h > 0)
  } finally {
    if (saved === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = saved
    await rm(dir, { recursive: true, force: true })
  }
})

test('GET /ocr/status 报告系统 OCR 与语言', { skip: !windows, timeout }, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'vsr-ocr-status-'))
  const saved = process.env.DSH_HOME
  process.env.DSH_HOME = dir
  try {
    const res = await call(handleOcrStatus, new FakeRequest('GET', '/plugins/vyra-screen-recorder/ocr/status'))
    assert.equal(res.status, 200, res.payload)
    const data = res.json()
    assert.equal(data.ok, true)
    assert.equal(data.winrt, true)
    assert.ok(data.languages.some(tag => /zh/u.test(tag)), JSON.stringify(data.languages))
    assert.equal(data.active, 'windows')
  } finally {
    if (saved === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = saved
    await rm(dir, { recursive: true, force: true })
  }
})

test('POST /clipboard 图片与文字都能写进剪贴板', { skip: !windows, timeout }, async (t) => {
  // 剪贴板是系统级独占资源：别的程序（浏览器、远程桌面）卡住它时，
  // 连 Set-Clipboard 都会失败。那不是插件的问题，跳过而不是假失败。
  const { execFileSync } = await import('node:child_process')
  try {
    execFileSync('powershell.exe', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'Set-Clipboard -Value "vsr-env-probe"',
    ], { encoding: 'utf8', windowsHide: true, timeout: 15000, stdio: 'ignore' })
  } catch {
    t.skip('系统剪贴板当前被其他程序独占（Set-Clipboard 都失败），跳过')
    return
  }
  const dir = await mkdtemp(path.join(tmpdir(), 'vsr-clip-route-'))
  const saved = process.env.DSH_HOME
  process.env.DSH_HOME = dir
  try {
    const image = path.join(dir, 'piece.png')
    await makeSample(image)
    const png = await readFile(image)

    const imageRes = await call(handleClipboard, new FakeRequest('POST', '/plugins/vyra-screen-recorder/clipboard?kind=image&name=piece.png', png))
    assert.equal(imageRes.status, 200, imageRes.payload)
    const stored = imageRes.json().path
    assert.ok(stored.startsWith(clipboardDir()), stored)

    // 剪贴板里确实有图：另起一个进程读回来，确认不是只有本进程可见。
    const hasImage = execFileSync('powershell.exe', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
      'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::ContainsImage()',
    ], { encoding: 'utf8', windowsHide: true }).trim()
    assert.equal(hasImage, 'True')

    const textRes = await call(handleClipboard, new FakeRequest('POST', '/plugins/vyra-screen-recorder/clipboard?kind=text', Buffer.from('复制的文字', 'utf8')))
    assert.equal(textRes.status, 200, textRes.payload)
    // 读回时用 UTF-8 输出，否则 PowerShell 按控制台编码写出来对不上。
    const copied = execFileSync('powershell.exe', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
      '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-Clipboard -Raw',
    ], { encoding: 'utf8', windowsHide: true })
    assert.equal(copied.trim(), '复制的文字')
  } finally {
    if (saved === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = saved
    await rm(dir, { recursive: true, force: true })
  }
})

test('POST /clipboard 只接受录制目录或剪贴板临时目录里的路径', { skip: !windows, timeout }, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'vsr-clip-guard-'))
  const saved = process.env.DSH_HOME
  process.env.DSH_HOME = dir
  try {
    const outside = path.join(dir, 'outside.png')
    await writeFile(outside, 'x')
    const res = await call(handleClipboard, new FakeRequest('POST',
      '/plugins/vyra-screen-recorder/clipboard?kind=image&path=' + encodeURIComponent(outside)))
    assert.equal(res.status, 400)
    assert.match(res.json().error, /路径不在录制目录内/u)
    assert.equal(await allowedTarget(outside), false)
  } finally {
    if (saved === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = saved
    await rm(dir, { recursive: true, force: true })
  }
})