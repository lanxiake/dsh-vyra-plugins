/**
 * dsh-vyra-screen-recorder — 宿主侧：屏幕抓取 / 录屏 / 系统声音。
 *
 * 为什么在宿主侧抓屏
 * -----------------
 * DSH 桌面版是 Electron，主进程把 display-capture 拒绝掉了；浏览器里的
 * getDisplayMedia / chromeMediaSource 都拿不到流（实测 NotAllowedError，
 * 旧路径甚至会让渲染进程崩溃）。所以抓屏放在宿主进程：
 *
 *   截图：lib/shot-server.ps1 → 常驻抓屏服务，GDI 抓一块屏幕 → JPEG
 *         （lib/shot.ps1 是冷启动回退路径）
 *   录屏：lib/frames.ps1   → 按帧率抓 JPEG 帧 + frames.jsonl 时间戳
 *   声音：lib/audio.ps1    → WASAPI 回环录默认播放设备 → WAV
 *
 * 编码不在这里做：视频帧和 WAV 交给浏览器用 WebCodecs（VP9 + Opus）编码，
 * 再用内置 webm-muxer 封装。这样不需要 Python / ffmpeg，也不用下载编码器。
 * 产物由客户端 POST 回 /record/save 落盘，并挂进输入框附件。
 *
 * 路由
 * ----
 *   GET  /plugins/vyra-screen-recorder/sources
 *   GET  /plugins/vyra-screen-recorder/shot
 *   POST /plugins/vyra-screen-recorder/record/start
 *   POST /plugins/vyra-screen-recorder/record/stop
 *   GET  /plugins/vyra-screen-recorder/record/status
 *   GET  /plugins/vyra-screen-recorder/record/frame?session=&file=
 *   GET  /plugins/vyra-screen-recorder/record/audio?session=
 *   POST /plugins/vyra-screen-recorder/record/save?name=
 *   POST /plugins/vyra-screen-recorder/record/discard
 *   GET  /plugins/vyra-screen-recorder/reveal?path=
 *   POST /plugins/vyra-screen-recorder/ocr          截图浮层取字（与 dsh-tool-ocr 共用引擎配置）
 *   GET  /plugins/vyra-screen-recorder/ocr/status   本机可用的 OCR 引擎
 *   POST /plugins/vyra-screen-recorder/clipboard    图片/文字/文件列表放进剪贴板
 *   GET  /plugins/vyra-screen-recorder/open?path=   用默认程序打开
 */
import { spawn } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { mkdtemp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'dsh-vyra-screen-recorder'
export const inject = ['webServer']

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const PREFIX = '/plugins/vyra-screen-recorder'
const LIB = path.join(ROOT, 'lib')
const POWERSHELL = process.env.VSR_POWERSHELL || 'powershell.exe'
const SAVE_LIMIT = 512 * 1024 * 1024
const MAX_SECONDS = 600
/**
 * The capture rate ceiling.
 *
 * 12 was chosen when the frames were assumed to be a slideshow; a scroll or a
 * cursor move at 12 fps is visibly choppy. The capture loop paces itself to a
 * target time, so a rate it cannot sustain degrades into dropped frames rather
 * than a broken file — the setting is an upper bound, not a promise.
 */
const MAX_FPS = 30
const SESSION_PREFIX = 'dsh-vyra-screen-recorder-'

let recording = null
let agentJob = null

function log(...args) {
  try { console.log('[dsh-vyra-screen-recorder]', ...args) } catch { /* ignore */ }
}

function sendJson(res, status, value) {
  const body = Buffer.from(JSON.stringify(value))
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': body.length,
    'cache-control': 'no-store',
  })
  res.end(body)
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', chunk => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('请求体过大'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function dshHome() {
  return process.env.DSH_HOME || path.join(homedir(), '.dsh')
}

const DEFAULT_SETTINGS = {
  dir: '',
  videoDir: '',
  shotDir: '',
  format: 'mp4',
  fps: 8,
  quality: 65,
  maxEdge: 1920,
  maxSeconds: 600,
  includeSystemAudio: true,
  includeMic: true,
  hideDshOnShot: false,
  shortcuts: {
    screenshot: 'Ctrl+Alt+S',
    record: 'Ctrl+Alt+R',
    copyImage: 'Ctrl',
    clipboard: 'Ctrl+Shift+C',
    text: 'Ctrl+Alt+C',
    save: 'Ctrl+S',
  },
  ocr: { engine: 'auto', lang: 'system', scale: 2 },
}

function settingsPath() {
  return path.join(dshHome(), 'dsh-vyra-screen-recorder', 'settings.json')
}

const SHORTCUT_MODIFIERS = ['Ctrl', 'Alt', 'Shift', 'Meta']

/**
 * 解析 "Ctrl+Alt+S" / "ctrlaltS" 这类快捷键串。
 *
 * 旧设置里存的是客户端 comboFromEvent 的输出（修饰键大小写敏感、键名可能
 * 大写），用户手改过的又可能全小写、没分隔符；统一拆成小写原子，
 * 客户端渲染 "Ctrl+Alt+S"、匹配时按同一套规则比较。纯修饰键（"Ctrl"）是
 * 合法的——截图浮层里的「复制图片」默认就是单个 Ctrl。
 *
 * @param {unknown} value - 配置或设置里的快捷键串。
 * @returns {{mods: string[], key: string}} 规范化后的按键组合。
 */
function parseShortcut(value) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (text === '') return { mods: [], key: '' }
  const parts = text.split(/[+\s]+/).filter(Boolean)
  const tokens = parts.length > 1 ? parts : (text.match(/ctrl|alt|shift|meta|[^+]?[A-Za-z0-9]/gi) || [])
  const mods = []
  let key = ''
  for (const token of tokens) {
    const lower = token.toLowerCase()
    if (lower === 'control' || lower === 'ctrl') { if (!mods.includes('ctrl')) mods.push('ctrl'); continue }
    if (lower === 'option' || lower === 'alt') { if (!mods.includes('alt')) mods.push('alt'); continue }
    if (lower === 'shift') { if (!mods.includes('shift')) mods.push('shift'); continue }
    if (lower === 'meta' || lower === 'cmd' || lower === 'win' || lower === 'command') { if (!mods.includes('meta')) mods.push('meta'); continue }
    if (token.length === 1) { key = lower; continue }
    if (lower === 'space' || lower === 'spacebar') { key = ' '; continue }
    key = lower
  }
  const order = ['ctrl', 'alt', 'shift', 'meta']
  mods.sort((left, right) => order.indexOf(left) - order.indexOf(right))
  return { mods, key }
}

/** 把规范化后的组合渲染成客户端提示用的写法。 */
function formatShortcut(value) {
  const { mods, key } = parseShortcut(value)
  const names = { ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift', meta: 'Meta' }
  const parts = mods.map(mod => names[mod])
  if (key === ' ') parts.push('Space')
  else if (key.length === 1) parts.push(key.toUpperCase())
  else if (key !== '') parts.push(key.charAt(0).toUpperCase() + key.slice(1))
  return parts.join('+')
}

/** 只接受能解析出按键的组合；解析不出（或为空）就用默认值。 */
function normalizeShortcut(value, fallback) {
  const parsed = parseShortcut(value)
  if (parsed.mods.length === 0 && parsed.key === '') return fallback
  return formatShortcut(value) || fallback
}

function absoluteDir(value) {
  return typeof value === 'string' && value.trim() && path.isAbsolute(value.trim()) ? value.trim() : ''
}

function normalizeSettings(raw) {
  const value = raw && typeof raw === 'object' ? raw : {}
  const dir = absoluteDir(value.dir)
  const shortcuts = value.shortcuts && typeof value.shortcuts === 'object' ? value.shortcuts : {}
  const ocr = value.ocr && typeof value.ocr === 'object' ? value.ocr : {}
  return {
    dir,
    videoDir: absoluteDir(value.videoDir),
    shotDir: absoluteDir(value.shotDir),
    format: value.format === 'webm' ? 'webm' : 'mp4',
    fps: clamp(value.fps, 4, MAX_FPS, DEFAULT_SETTINGS.fps),
    quality: clamp(value.quality, 40, 90, DEFAULT_SETTINGS.quality),
    maxEdge: clamp(value.maxEdge, 320, 2560, DEFAULT_SETTINGS.maxEdge),
    maxSeconds: clamp(value.maxSeconds, 10, MAX_SECONDS, DEFAULT_SETTINGS.maxSeconds),
    includeSystemAudio: value.includeSystemAudio !== false,
    includeMic: value.includeMic !== false,
    hideDshOnShot: value.hideDshOnShot === true,
    shortcuts: {
      screenshot: normalizeShortcut(shortcuts.screenshot, DEFAULT_SETTINGS.shortcuts.screenshot),
      record: normalizeShortcut(shortcuts.record, DEFAULT_SETTINGS.shortcuts.record),
      copyImage: normalizeShortcut(shortcuts.copyImage, DEFAULT_SETTINGS.shortcuts.copyImage),
      clipboard: normalizeShortcut(shortcuts.clipboard, DEFAULT_SETTINGS.shortcuts.clipboard),
      text: normalizeShortcut(shortcuts.text, DEFAULT_SETTINGS.shortcuts.text),
      save: normalizeShortcut(shortcuts.save, DEFAULT_SETTINGS.shortcuts.save),
    },
    ocr: {
      engine: typeof ocr.engine === 'string' && ocr.engine.trim() ? ocr.engine.trim() : DEFAULT_SETTINGS.ocr.engine,
      lang: typeof ocr.lang === 'string' && ocr.lang.trim() ? ocr.lang.trim() : DEFAULT_SETTINGS.ocr.lang,
      scale: clamp(ocr.scale, 1, 4, DEFAULT_SETTINGS.ocr.scale),
    },
  }
}

async function loadSettings() {
  try {
    const raw = JSON.parse(await readFile(settingsPath(), 'utf8'))
    return normalizeSettings(raw)
  } catch {
    return normalizeSettings(DEFAULT_SETTINGS)
  }
}

async function saveSettings(patch) {
  const current = await loadSettings()
  const value = patch && typeof patch === 'object' ? patch : {}
  const merged = normalizeSettings({
    ...current,
    ...value,
    shortcuts: { ...current.shortcuts, ...(value.shortcuts && typeof value.shortcuts === 'object' ? value.shortcuts : {}) },
  })
  await mkdir(path.dirname(settingsPath()), { recursive: true })
  await writeFile(settingsPath(), JSON.stringify(merged, null, 2), { mode: 0o600 })
  return merged
}

function libraryRoot(settings) {
  const env = process.env.VSR_LIBRARY_DIR
  if (env) return path.resolve(env)
  if (settings && settings.dir) return settings.dir
  return path.join(homedir(), 'Videos', 'Vyra Screen Recorder')
}

function recordingsDir(settings) {
  if (process.env.VSR_RECORDINGS_DIR) return process.env.VSR_RECORDINGS_DIR
  if (settings && settings.videoDir) return settings.videoDir
  return path.join(libraryRoot(settings), 'recordings')
}

function screenshotsDir(settings) {
  if (process.env.VSR_SCREENSHOTS_DIR) return process.env.VSR_SCREENSHOTS_DIR
  if (settings && settings.shotDir) return settings.shotDir
  return path.join(libraryRoot(settings), 'screenshots')
}

async function ensureLibrary(settings) {
  await mkdir(recordingsDir(settings), { recursive: true })
  await mkdir(screenshotsDir(settings), { recursive: true })
}

function timestampName() {
  const now = new Date()
  const pad = value => String(value).padStart(2, '0')
  return String(now.getFullYear()) + pad(now.getMonth() + 1) + pad(now.getDate())
    + '-' + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds())
}

function safeName(value, fallback) {
  const base = path.basename(String(value || ''))
    .replace(/[<>:"\/\|?*\u0000-\u001f]/g, '-')
    .replace(/^\.+/, '')
    .trim()
  if (!base) return fallback
  return base.slice(0, 120)
}

function clamp(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.round(number)))
}

/** Run one of the native helpers that ship beside this file. */
function runPowerShell(script, args) {
  if (process.platform !== 'win32') {
    throw new Error('目前只支持 Windows')
  }
  const file = path.join(LIB, script)
  if (!existsSync(file)) throw new Error('缺少脚本：' + file)
  return spawn(POWERSHELL, [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden',
    '-File', file, ...args,
  ], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
}

/**
 * Where the Windows.Graphics.Capture helper lives, when this install has one.
 *
 * `wgcrec` captures a WINDOW's composed surface, so another window covering it
 * does not appear in the video. The PowerShell path reads screen pixels through
 * GDI and cannot do that: whatever is on top gets recorded, which is what made
 * every attempt to film the app while a terminal was in front produce the
 * terminal.
 *
 * It is optional on purpose. The helper is compiled by `scripts/build-wgcrec.mjs`
 * and may be absent on a machine without the .NET SDK; the recorder then falls
 * back to the GDI path and says so, rather than failing to record at all.
 *
 * @returns the executable path, or undefined when this install has none.
 */
function wgcRecorderPath() {
  const candidates = [
    path.join(ROOT, 'native', 'wgcrec', 'bin', 'Release', 'net8.0-windows10.0.19041.0', 'wgcrec.exe'),
    path.join(ROOT, 'native', 'wgcrec', 'bin', 'Release', 'net8.0-windows10.0.19041.0', 'publish', 'wgcrec.exe'),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return undefined
}

/**
 * Start frame capture for one session.
 *
 * A window source goes through `wgcrec` when it is available, because that is
 * the only path that records the window rather than the screen rectangle it
 * occupies. Everything else — a region, a monitor, a desktop capture — keeps the
 * GDI path, which is what those sources mean.
 *
 * @returns `{ child, how }` — the process and which path was taken.
 */
function startFrames(session, { dir, source, fps, quality, maxEdge, maxSeconds }) {
  const stopFile = path.join(dir, 'frames.stop')
  const wgc = source.type === 'window' ? wgcRecorderPath() : undefined
  if (wgc !== undefined) {
    return {
      child: spawn(wgc, [
        String(source.hwnd), dir, String(fps), String(quality),
        String(maxEdge), String(maxSeconds), stopFile,
      ], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }),
      how: 'wgc',
    }
  }
  const args = [
    '-OutDir', dir,
    '-Fps', String(fps),
    '-Quality', String(quality),
    '-MaxEdge', String(maxEdge),
    '-MaxSeconds', String(maxSeconds),
    '-StopFile', stopFile,
  ]
  if (source.type === 'window') args.push('-Hwnd', String(source.hwnd))
  else if (source.type === 'region') args.push('-Region', [source.x, source.y, source.w, source.h].join(','))
  return { child: runPowerShell('frames.ps1', args), how: 'gdi' }
}

/** 收集子进程 stdout 的整行文本。 */
function lineReader(child, onLine) {
  let buffer = ''
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', chunk => {
    buffer += chunk
    let index = buffer.indexOf('\n')
    while (index >= 0) {
      const line = buffer.slice(0, index).trim()
      buffer = buffer.slice(index + 1)
      if (line) onLine(line)
      index = buffer.indexOf('\n')
    }
  })
}

/** 等子进程打印 READY；打印 ERROR 或提前退出则失败。 */
function waitReady(child, label, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false
    let stderr = ''
    const finish = (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (error) reject(error)
      else resolve()
    }
    const timer = setTimeout(() => finish(new Error(label + ' 启动超时')), timeoutMs)
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', chunk => { stderr += chunk })
    lineReader(child, line => {
      if (line === 'READY') finish()
      else if (line.startsWith('ERROR')) finish(new Error(line.replace(/^ERROR:\s*/, '')))
    })
    child.once('exit', code => {
      if (!settled) finish(new Error(label + ' 提前退出（' + code + '）' + (stderr ? '：' + stderr.slice(0, 300) : '')))
    })
    child.once('error', error => finish(error))
  })
}

// ------------------------------------------------------- 常驻截图服务
// 一次 PowerShell 冷启动 + 加载 C# 要 2 秒以上；截图必须接近原生速度，
// 所以把类型和进程都留住。请求串行排队，崩溃或超时后自动重启/回退。

let shotServer = null
let shotServerRetryAt = 0

function stopShotServer() {
  const server = shotServer
  shotServer = null
  if (server === null) return
  server.stopping = true
  try { server.child.stdin.write('quit\n') } catch { /* ignore */ }
  try { server.child.kill() } catch { /* ignore */ }
  for (const pending of server.pending.splice(0)) pending.finish('截图服务已停止')
}

function startShotServer() {
  if (shotServer !== null) return shotServer
  if (process.platform !== 'win32') return null
  const file = path.join(LIB, 'shot-server.ps1')
  if (!existsSync(file)) return null
  if (Date.now() < shotServerRetryAt) return null

  const child = spawn(POWERSHELL, [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden',
    '-File', file,
  ], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
  const server = {
    child,
    pending: [],
    buffer: '',
    ready: false,
    stopping: false,
    readyReject: null,
    readyPromise: null,
  }
  server.readyPromise = new Promise((resolve, reject) => {
    server.readyResolve = resolve
    server.readyReject = reject
  })
  // 预热失败不该把 rejection 抛成未处理异常；真正请求时会看到 readyPromise 失败。
  server.readyPromise.catch(() => {})
  child.stdin.setDefaultEncoding('utf8')
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', chunk => {
    const text = String(chunk).trim()
    if (text) log('shot-server stderr：' + text.slice(0, 300))
  })
  child.stdout.on('data', chunk => {
    server.buffer += chunk
    let index = server.buffer.indexOf('\n')
    while (index >= 0) {
      const line = server.buffer.slice(0, index).trim()
      server.buffer = server.buffer.slice(index + 1)
      if (line === 'READY') {
        server.ready = true
        server.readyResolve()
      } else if (line) {
        const pending = server.pending.shift()
        if (pending !== undefined) pending.finish(line)
      }
      index = server.buffer.indexOf('\n')
    }
  })
  child.once('exit', code => {
    if (shotServer === server) shotServer = null
    const error = new Error('截图服务退出（' + code + '）')
    if (!server.ready) {
      if (!server.stopping) shotServerRetryAt = Date.now() + 60000
      server.readyReject(error)
    }
    for (const pending of server.pending.splice(0)) pending.finish(error.message)
  })
  child.once('error', () => {
    if (shotServer === server) shotServer = null
    if (!server.stopping) shotServerRetryAt = Date.now() + 60000
    server.readyReject(new Error('截图服务启动失败'))
    for (const pending of server.pending.splice(0)) pending.finish('截图服务启动失败')
  })

  shotServer = server
  return server
}

/** 发一条截图请求，返回 OK/ERR 行。 */
function sendShotRequest(server, request) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const index = server.pending.indexOf(entry)
      if (index >= 0) server.pending.splice(index, 1)
      stopShotServer()
      reject(new Error('截图超时'))
    }, 8000)
    const entry = {
      finish(line) {
        clearTimeout(timer)
        if (line.startsWith('OK')) resolve(line)
        else reject(new Error(line.replace(/^ERR\s*/, '') || '截图失败'))
      },
    }
    server.pending.push(entry)
    try {
      server.child.stdin.write(JSON.stringify(request) + '\n')
    } catch (error) {
      clearTimeout(timer)
      const index = server.pending.indexOf(entry)
      if (index >= 0) server.pending.splice(index, 1)
      stopShotServer()
      reject(error)
    }
  })
}

/**
 * 用常驻服务抓图；返回 OK 行，服务不可用时返回 null 让调用方回退一次性脚本。
 */
async function captureShotFast(request) {
  const server = startShotServer()
  if (server === null) return null
  try {
    await server.readyPromise
    return await sendShotRequest(server, request)
  } catch (error) {
    log('常驻截图失败，改用一次性脚本：', (error && error.message) || error)
    return null
  }
}

function waitExit(child, timeoutMs) {
  return new Promise(resolve => {
    if (child === null || child === undefined || child.exitCode !== null) { resolve(true); return }
    const timer = setTimeout(() => {
      try { child.kill() } catch { /* ignore */ }
      resolve(false)
    }, timeoutMs)
    child.once('exit', () => { clearTimeout(timer); resolve(true) })
  })
}

async function readMeta(dir) {
  const file = path.join(dir, 'meta.json')
  for (let attempt = 0; attempt < 20; attempt++) {
    try { return JSON.parse(await readFile(file, 'utf8')) } catch { await new Promise(r => setTimeout(r, 100)) }
  }
  return null
}

async function readFrames(dir) {
  let text = ''
  try { text = await readFile(path.join(dir, 'frames.jsonl'), 'utf8') } catch { return [] }
  const out = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const row = JSON.parse(trimmed)
      if (Number.isInteger(row.i) && Number.isFinite(row.t) && typeof row.file === 'string') out.push(row)
    } catch { /* 半行（进程被强杀时）忽略 */ }
  }
  return out
}

async function countFrames(dir) {
  try {
    const files = await readdir(dir)
    return files.filter(file => file.endsWith('.jpg')).length
  } catch { return 0 }
}

// ------------------------------------------------------------------- OCR
// 截图浮层的「提取文字」不自己另开一套 OCR 配置：它读 dsh-tool-ocr 在
// profile patch 里配的引擎（command 型）或直接用系统自带的
// Windows.Media.Ocr（lib/ocr.ps1），所以用户在设置页配一个引擎，Agent 的
// ocr_read 和这里的取字走的是同一套。

const OCR_DEFAULT_TIMEOUT = 60000
const OCR_MAX_TIMEOUT = 120000

/**
 * 把一条 dsh-tool-ocr 的 `engines` 条目统一成宿主内部形状。
 *
 * 兼容两种写法：显式 `mode: winrt`（不写 command），以及老版本只有
 * `command` + `args` 的外部引擎。既没 command 又没 mode 的条目当成坏配置，
 * 返回 null，让调用方回退到系统 OCR。
 *
 * @param {unknown} raw - 用户写的引擎条目。
 * @returns {{id: string, label: string, mode: 'command'|'winrt', lang: string, command: string, args: string[], timeoutMs: number}|null}
 */
function resolveOcrEngine(raw) {
  if (!raw || typeof raw !== 'object') return null
  const value = raw
  const id = typeof value.id === 'string' && value.id.trim() ? value.id.trim() : ''
  if (!id) return null
  const command = typeof value.command === 'string' ? value.command.trim() : ''
  const mode = value.mode === 'winrt' || value.mode === 'command' ? value.mode : (command ? 'command' : '')
  if (!mode) return null
  if (mode === 'command' && !command) return null
  return {
    id,
    label: typeof value.label === 'string' && value.label.trim() ? value.label.trim() : id,
    mode,
    lang: typeof value.lang === 'string' && value.lang.trim() ? value.lang.trim() : 'system',
    command,
    args: Array.isArray(value.args) ? value.args.filter(item => typeof item === 'string') : [],
    isDefault: value.isDefault === true,
    timeoutMs: clamp(value.timeoutMs, 1000, OCR_MAX_TIMEOUT, OCR_DEFAULT_TIMEOUT),
  }
}

/** 把 profile 的 patch 文件切成顶层条目（每行 "- " 开头算一条）。 */
function splitPatchRows(text) {
  const rows = []
  let current = null
  for (const line of String(text).split(/\r?\n/)) {
    if (/^-\s/.test(line)) {
      if (current !== null) rows.push(current)
      current = line + '\n'
      continue
    }
    if (current !== null) current += line + '\n'
  }
  if (current !== null) rows.push(current)
  return rows
}

/** 从一行 patch 里取出 `engines:` 下的条目。只认 id/mode/command/args/lang 这几个键。 */
function parseEngineRows(row) {
  const lines = row.split(/\r?\n/)
  const start = lines.findIndex(line => /^\s{0,8}engines:\s*$/.test(line))
  if (start < 0) return []
  const engineIndent = (lines.slice(start + 1).find(line => /^\s*-\s/.test(line)) || '').match(/^(\s*)/)[1].length
  if (engineIndent === 0) return []
  const entries = []
  let entry = null
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === '') continue
    const indent = line.match(/^(\s*)/)[1].length
    if (indent < engineIndent) break
    const isItem = /^\s*-\s/.test(line) && indent === engineIndent
    const body = isItem ? line.replace(/^\s*-\s*/, '') : line
    if (isItem) {
      if (entry !== null) entries.push(entry)
      entry = {}
    }
    if (entry === null) continue
    const match = /^([A-Za-z]+):\s*(.*)$/.exec(body.trim())
    if (match === null) continue
    const [, key, rest] = match
    const raw = rest.replace(/\s+#.*$/, '').trim()
    if (raw === '') continue
    if (key === 'id' || key === 'label' || key === 'command' || key === 'mode' || key === 'lang') {
      entry[key] = raw.replace(/^["']|["']$/g, '')
    } else if (key === 'args') {
      // 支持行内数组：args: ["{input}", "{output}"]
      const inner = raw.replace(/^\[|\]$/g, '')
      entry.args = (inner.match(/"[^"]*"|'[^']*'|[^,\s]+/g) || []).map(item => item.replace(/^["']|["']$/g, ''))
    } else if (key === 'isDefault') {
      entry.isDefault = raw === 'true'
    } else if (key === 'timeoutMs') {
      const number = Number(raw)
      if (Number.isFinite(number)) entry.timeoutMs = number
    }
  }
  if (entry !== null) entries.push(entry)
  return entries
}

/**
 * 找 OCR 插件的配置：优先用 DSH 正在跑的 Loader 条目（configEditor），
 * 拿不到时退回去读当前 profile 的 patch 文件。两者都没有就返回空数组。
 *
 * @returns {Promise<Array<object>>} 原始引擎条目（可能为空）。
 */
async function rawOcrEngines(ctx) {
  try {
    const editor = ctx && typeof ctx.get === 'function' ? ctx.get('configEditor') : null
    if (editor && typeof editor.entries === 'function') {
      const entries = editor.entries()
      if (Array.isArray(entries)) {
        const target = entries.find(entry => entry && entry.name === '@yuehancn/dsh-tool-ocr')
        const config = target && target.config
        const value = config && typeof config.toJSON === 'function' ? config.toJSON() : config
        if (value && Array.isArray(value.engines)) return value.engines
      }
    }
  } catch { /* 拿不到就走文件 */ }

  const home = dshHome()
  const candidates = []
  for (const name of ['DSH_PROFILE', 'DSH_PROFILE_NAME', 'DSH_PROFILE_ID']) {
    if (process.env[name]) candidates.push(path.join(home, 'profiles', process.env[name], 'cordis.patch.yml'))
  }
  const profilesDir = path.join(home, 'profiles')
  try {
    const dirs = await readdir(profilesDir, { withFileTypes: true })
    for (const entry of dirs.slice().sort((left, right) => left.name.localeCompare(right.name))) {
      if (!entry.isDirectory()) continue
      candidates.push(path.join(profilesDir, entry.name, 'cordis.patch.yml'))
    }
  } catch { /* 没有 profiles 目录 */ }
  candidates.push(path.join(home, 'cordis.patch.yml'))

  for (const file of candidates) {
    let text = ''
    try { text = await readFile(file, 'utf8') } catch { continue }
    for (const row of splitPatchRows(text)) {
      if (!/['"]?@?[a-z-]*\/?dsh-tool-ocr['"]?/.test(row)) continue
      const engines = parseEngineRows(row)
      if (engines.length > 0) return engines
    }
  }
  return []
}

/** 归一化后的引擎列表（过滤坏条目）。 */
async function ocrEngines(ctx) {
  const raw = await rawOcrEngines(ctx)
  return raw.map(resolveOcrEngine).filter(Boolean)
}

/**
 * 选这次取字用哪个引擎：设置页指定的 id → 配置里 isDefault 的 → 系统 OCR。
 *
 * @param {Array<object>} engines - 归一化后的引擎。
 * @param {string} preferred - 设置页 ocr.engine（"auto" 表示不指定）。
 * @returns {object} 引擎描述，mode 为 "winrt" 时用系统 OCR。
 */
function pickOcrEngine(engines, preferred) {
  const wanted = typeof preferred === 'string' && preferred !== 'auto' ? preferred : ''
  if (wanted) {
    const found = engines.find(engine => engine.id === wanted)
    if (found) return found
  }
  const fallback = engines.find(engine => engine.isDefault === true) || engines[0]
  if (fallback) return fallback
  return { id: 'windows', label: 'Windows OCR', mode: 'winrt', lang: 'system', command: '', args: [], timeoutMs: OCR_DEFAULT_TIMEOUT }
}

/** 展开 {input}/{output}/{lang} 模板。 */
function expandOcrArgs(template, values) {
  return template.map(arg => arg.split('{input}').join(values.input).split('{output}').join(values.output).split('{lang}').join(values.lang))
}

function runChild(file, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(POWERSHELL, [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden',
      '-File', file, ...args,
    ], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      try { child.kill() } catch { /* ignore */ }
      reject(new Error('执行超时（' + Math.round(timeoutMs / 1000) + ' 秒）'))
    }, timeoutMs)
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.once('error', error => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(error)
    })
    child.once('exit', code => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (code !== 0) {
        const detail = (stderr || stdout).trim().split(/\r?\n/).filter(Boolean).pop() || ''
        reject(new Error(detail || ('退出码 ' + code)))
        return
      }
      resolve({ stdout, stderr })
    })
  })
}

/**
 * 对一张图片取字，返回文字与每行的位置（客户端用它给识别结果描框）。
 *
 * @param {string} imagePath - 要识别的图片。
 * @param {object} engine - pickOcrEngine 的结果。
 * @param {{lang: string, scale: number}} options - 语言与放大倍数。
 * @returns {Promise<{text: string, lines: Array<object>, engine: string, lang: string}>}
 */
async function runOcr(imagePath, engine, options) {
  const lang = options && options.lang && options.lang !== 'system' ? options.lang : (engine.lang !== 'system' ? engine.lang : '')
  if (engine.mode === 'winrt') {
    const args = ['-Path', imagePath, '-Scale', String((options && options.scale) || 2)]
    if (lang) args.push('-Lang', lang)
    const { stdout } = await runChild(path.join(LIB, 'ocr.ps1'), args, engine.timeoutMs || OCR_DEFAULT_TIMEOUT)
    const line = stdout.trim().split(/\r?\n/).filter(item => item.trim().startsWith('{')).pop()
    if (!line) throw new Error('系统 OCR 没有返回结果')
    let payload = null
    try { payload = JSON.parse(line) } catch { throw new Error('系统 OCR 返回的不是 JSON') }
    if (payload.ok !== true) throw new Error(payload.error || '系统 OCR 失败')
    return {
      text: String(payload.text || ''),
      lines: Array.isArray(payload.lines) ? payload.lines : [],
      engine: engine.id,
      lang: String(payload.lang || lang || ''),
    }
  }
  const dir = await mkdtemp(path.join(tmpdir(), SESSION_PREFIX + 'ocr-'))
  const output = path.join(dir, 'text.txt')
  try {
    const args = expandOcrArgs(engine.args.length > 0 ? engine.args : ['{input}', '{output}'], { input: imagePath, output, lang })
    const { stdout } = await runChild(engine.command, args, engine.timeoutMs || OCR_DEFAULT_TIMEOUT)
    let text = ''
    try { text = await readFile(output, 'utf8') } catch { text = stdout || '' }
    return { text: String(text).trim(), lines: [], engine: engine.id, lang }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

/** 用 Windows OCR 报一下本机装了哪些识别语言。 */
async function winrtLanguages() {
  if (process.platform !== 'win32') return []
  const script = path.join(LIB, 'ocr-langs.ps1')
  if (!existsSync(script)) return []
  try {
    const { stdout } = await runChild(script, [], 20000)
    return stdout.trim().split(/\r?\n/).map(item => item.trim()).filter(item => /^[A-Za-z-]+$/.test(item))
  } catch {
    return []
  }
}

// ------------------------------------------------------------- clipboard
// 剪贴板内容只认宿主自己生成的临时文件，不接受客户端传来的任意路径——
// 否则任何能打开页面的程序都能让插件把任意文件放进剪贴板/资源管理器。

function clipboardDir() {
  return path.join(tmpdir(), 'vyra-screen-recorder-clipboard')
}

async function writeClipboardFile(name, buffer, extension) {
  const stamp = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
  const file = path.join(clipboardDir(), safeName(name || ('shot-' + stamp + extension), 'shot' + extension))
  await mkdir(clipboardDir(), { recursive: true })
  await writeFile(file, buffer)
  return file
}

/** 允许 reveal/open 的路径：录制库、剪贴板临时目录，或调用方刚上传的文件。 */
function allowedTarget(full) {
  const settingsPromise = loadSettings()
  return settingsPromise.then(settings => {
    const roots = [libraryRoot(settings), recordingsDir(settings), screenshotsDir(settings), clipboardDir()].map(item => path.resolve(item))
    return roots.some(root => {
      const relative = path.relative(root, full)
      return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
    })
  })
}
// CLI 录屏：CLI 把 req-<id>.json 写进 ~/.dsh/dsh-vyra-screen-recorder/agent，
// 宿主轮询后开录/停录；状态写 state-<id>.json。编码由 DSH Web 界面完成，
// 完成后 POST /agent/save 把 WebM 写到请求里的 --out。

function agentDir() {
  return path.join(dshHome(), 'dsh-vyra-screen-recorder', 'agent')
}

async function writeJsonAtomic(file, value) {
  const temporary = file + '.tmp-' + process.pid
  await writeFile(temporary, JSON.stringify(value))
  await rename(temporary, file)
}

async function writeAgentState(id, value) {
  await mkdir(agentDir(), { recursive: true })
  await writeJsonAtomic(path.join(agentDir(), 'state-' + id + '.json'), value)
}

/** 插件初始化时把技能和 CLI shim 装进 DSH_HOME。 */
async function installAgentAssets() {
  const skillSource = path.join(ROOT, 'skills', 'dsh-vyra-screen-recorder', 'SKILL.md')
  const skillText = await readFile(skillSource, 'utf8')
  const skillDir = path.join(dshHome(), 'skills', 'dsh-vyra-screen-recorder')
  await mkdir(skillDir, { recursive: true })
  await writeFile(path.join(skillDir, 'SKILL.md'), skillText)

  const binDir = path.join(dshHome(), 'dsh-vyra-screen-recorder', 'bin')
  await mkdir(binDir, { recursive: true })
  const cli = path.join(ROOT, 'bin', 'vsr.mjs')
  // 用 DSH 自己的 Node 运行时（process.execPath），不依赖用户 PATH 上的 node。
  const node = process.execPath
  await writeFile(path.join(binDir, 'vsr.cmd'),
    '@echo off\r\nset ELECTRON_RUN_AS_NODE=1\r\n"' + node + '" "' + cli + '" %*\r\n')
  await writeFile(path.join(binDir, 'vsr'),
    '#!/bin/sh\nexport ELECTRON_RUN_AS_NODE=1\nexec "' + node.replace(/\\/g, '/') + '" "' + cli.replace(/\\/g, '/') + '" "$@"\n')
  await mkdir(agentDir(), { recursive: true })
  await ensureLibrary(await loadSettings())
}

async function beginAgentJob(request) {
  const settings = await loadSettings()
  const duration = clamp(request.duration, 2, MAX_SECONDS, settings.maxSeconds)
  const format = request.format === 'webm' ? 'webm' : (request.format === 'mp4' ? 'mp4' : settings.format)
  const result = await startSession({
    source: request.source,
    fps: request.fps !== undefined ? request.fps : settings.fps,
    quality: request.quality !== undefined ? request.quality : settings.quality,
    maxEdge: request.maxEdge !== undefined ? request.maxEdge : settings.maxEdge,
    maxSeconds: duration,
    includeSystemAudio: request.includeSystemAudio !== false,
  })
  agentJob = {
    id: request.id,
    request,
    format,
    status: 'recording',
    startedAt: result.startedAt,
    timer: null,
    encodingAt: 0,
    manifest: null,
  }
  await writeAgentState(request.id, {
    status: 'recording',
    startedAt: result.startedAt,
    duration,
    format,
    includeMic: request.includeMic !== false,
    out: request.out,
  })
  agentJob.timer = setTimeout(() => { void finishAgentJob() }, duration * 1000)
  log('agent recording started', request.id, duration + 's')
}

async function finishAgentJob() {
  if (agentJob === null || agentJob.status !== 'recording') return
  const job = agentJob
  job.status = 'stopping'
  if (job.timer !== null) { clearTimeout(job.timer); job.timer = null }
  try {
    const manifest = await stopSession()
    job.status = 'encoding'
    job.encodingAt = Date.now()
    job.manifest = manifest
    await writeAgentState(job.id, {
      status: 'encoding',
      manifest,
      format: job.format,
      includeMic: job.request.includeMic !== false,
      out: job.request.out,
    })
    log('agent recording stopped, waiting for UI encode', job.id)
  } catch (error) {
    await failAgentJob('停止录制失败：' + String((error && error.message) || error))
  }
}

async function failAgentJob(message) {
  const job = agentJob
  agentJob = null
  if (job !== null && job.timer !== null) clearTimeout(job.timer)
  if (job !== null) {
    try { await writeAgentState(job.id, { status: 'error', error: message }) } catch { /* ignore */ }
  }
  await discardSession().catch(() => {})
  log('agent job failed', message)
}

async function agentTick() {
  if (agentJob !== null) {
    if (agentJob.status === 'encoding' && Date.now() - agentJob.encodingAt > 300000) {
      await failAgentJob('编码超时：请确认 DSH Web 界面已打开')
    }
    return
  }
  let names = []
  try { names = await readdir(agentDir()) } catch { return }
  for (const name of names.filter(item => /^req-.*\.json$/.test(item)).sort()) {
    const id = name.slice(4, -5)
    if (existsSync(path.join(agentDir(), 'state-' + id + '.json'))) continue
    let request = null
    try { request = JSON.parse(await readFile(path.join(agentDir(), name), 'utf8')) } catch { continue }
    if (request === null || request.id !== id) continue
    try {
      await beginAgentJob(request)
    } catch (error) {
      await writeAgentState(id, { status: 'error', error: String((error && error.message) || error) }).catch(() => {})
    }
    return
  }
}

function regionOf(value) {
  const x = clamp(value.x, -100000, 100000, 0)
  const y = clamp(value.y, -100000, 100000, 0)
  const w = Math.round(Number(value.w))
  const h = Math.round(Number(value.h))
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 16 || h < 16) throw new Error('区域太小')
  return { x, y, w: Math.min(100000, w), h: Math.min(100000, h) }
}

function normalizeSource(source) {
  const value = source && typeof source === 'object' ? source : { type: 'desktop' }
  const type = value.type
  if (type === 'window') {
    const hwnd = Number(value.hwnd)
    if (!Number.isSafeInteger(hwnd) || hwnd <= 0) throw new Error('窗口句柄无效')
    return { type: 'window', hwnd, title: String(value.title || '') }
  }
  if (type === 'region') return { type: 'region', ...regionOf(value) }
  if (type === 'monitor') return { type: 'region', ...regionOf(value), name: String(value.name || '') }
  return { type: 'desktop' }
}

async function startSession(payload) {
  if (agentJob !== null) throw new Error('Agent 正在录屏或编码')
  if (recording !== null) {
    if (!recording.stopped) throw new Error('已经有一路录制在进行')
    await discardSession()
  }
  if (process.platform !== 'win32') throw new Error('目前只支持 Windows')

  const source = normalizeSource(payload && payload.source)
  const fps = clamp(payload && payload.fps, 4, MAX_FPS, 8)
  const quality = clamp(payload && payload.quality, 40, 90, 65)
  const maxEdge = clamp(payload && payload.maxEdge, 0, 2560, 1920)
  const maxSeconds = clamp(payload && payload.maxSeconds, 2, MAX_SECONDS, MAX_SECONDS)
  const includeSystemAudio = !(payload && payload.includeSystemAudio === false)

  const dir = await mkdtemp(path.join(tmpdir(), SESSION_PREFIX))
  const sessionId = path.basename(dir)
  const session = {
    id: sessionId,
    dir,
    source,
    fps,
    startedAt: 0,
    audioReadyAt: 0,
    framesChild: null,
    audioChild: null,
    stopped: false,
    manifest: null,
  }

  if (includeSystemAudio) {
    try {
      const audio = runPowerShell('audio.ps1', [
        '-Out', path.join(dir, 'audio.wav'),
        '-MaxSeconds', String(maxSeconds),
        '-StopFile', path.join(dir, 'audio.stop'),
      ])
      session.audioChild = audio
      lineReader(audio, line => { if (line.startsWith('DONE')) log('audio', line) })
      await waitReady(audio, '系统声音', 15000)
      session.audioReadyAt = Date.now()
    } catch (error) {
      log('系统声音不可用：', error && error.message)
      if (session.audioChild) { try { session.audioChild.kill() } catch { /* ignore */ } }
      session.audioChild = null
      session.audioReadyAt = 0
    }
  }

  try {
    const started = startFrames(session, { dir, source, fps, quality, maxEdge, maxSeconds })
    const frames = started.child
    session.framesChild = frames
    session.capture = started.how
    lineReader(frames, line => { if (line.startsWith('DONE') || line.startsWith('ERROR')) log('frames', line) })
    await waitReady(frames, '录屏', 20000)
  } catch (error) {
    if (session.audioChild) { try { session.audioChild.kill() } catch { /* ignore */ } }
    await rm(dir, { recursive: true, force: true }).catch(() => {})
    throw error
  }

  session.startedAt = Date.now()
  recording = session

  const meta = await readMeta(dir)
  return {
    ok: true,
    sessionId,
    startedAt: session.startedAt,
    width: meta ? meta.width : 0,
    height: meta ? meta.height : 0,
    fps,
    hasAudio: session.audioChild !== null,
    source,
  }
}

async function stopSession() {
  if (recording === null) throw new Error('当前没有录制')
  const session = recording
  if (!session.stopped) {
    await writeFile(path.join(session.dir, 'frames.stop'), '1').catch(() => {})
    await writeFile(path.join(session.dir, 'audio.stop'), '1').catch(() => {})
    await waitExit(session.framesChild, 15000)
    await waitExit(session.audioChild, 15000)
    session.stopped = true
  }

  const meta = await readMeta(session.dir)
  const frames = await readFrames(session.dir)
  if (frames.length === 0) throw new Error('没有录到画面')

  let audio = null
  const audioFile = path.join(session.dir, 'audio.wav')
  try {
    const info = await stat(audioFile)
    if (info.size > 44) audio = { name: 'audio.wav', bytes: info.size }
  } catch { /* no audio */ }

  const last = frames[frames.length - 1]
  const durationMs = last.t + Math.round(1000 / session.fps)
  const manifest = {
    ok: true,
    sessionId: session.id,
    startedAt: session.startedAt,
    audioOffsetMs: session.audioReadyAt ? session.audioReadyAt - session.startedAt : 0,
    width: meta ? meta.width : 0,
    height: meta ? meta.height : 0,
    fps: session.fps,
    durationMs,
    frames,
    audio,
  }
  session.manifest = manifest
  return manifest
}

async function discardSession() {
  if (recording === null) return { ok: true, discarded: false }
  const session = recording
  recording = null
  if (!session.stopped) {
    await writeFile(path.join(session.dir, 'frames.stop'), '1').catch(() => {})
    await writeFile(path.join(session.dir, 'audio.stop'), '1').catch(() => {})
    await waitExit(session.framesChild, 3000)
    await waitExit(session.audioChild, 3000)
  }
  await rm(session.dir, { recursive: true, force: true }).catch(() => {})
  return { ok: true, discarded: true }
}

async function cleanupOldSessions() {
  try {
    const base = tmpdir()
    const entries = await readdir(base, { withFileTypes: true })
    const now = Date.now()
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith(SESSION_PREFIX)) continue
      if (recording !== null && entry.name === recording.id) continue
      const dir = path.join(base, entry.name)
      try {
        const info = await stat(dir)
        if (now - info.mtimeMs > 24 * 60 * 60 * 1000) await rm(dir, { recursive: true, force: true })
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}

async function handleSources(req, res) {
  if (req.method !== 'GET') { sendJson(res, 405, { ok: false, error: '只接受 GET' }); return }
  const dir = await mkdtemp(path.join(tmpdir(), SESSION_PREFIX + 'sources-'))
  const out = path.join(dir, 'sources.json')
  try {
    const child = runPowerShell('sources.ps1', ['-Out', out])
    let stderr = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', chunk => { stderr += chunk })
    const exited = await new Promise(resolve => {
      const timer = setTimeout(() => { try { child.kill() } catch { /* ignore */ } resolve(false) }, 15000)
      child.once('exit', code => { clearTimeout(timer); resolve(code === 0) })
      child.once('error', () => { clearTimeout(timer); resolve(false) })
    })
    if (!exited) throw new Error('枚举录制源超时' + (stderr ? '：' + stderr.slice(0, 200) : ''))
    const data = JSON.parse(await readFile(out, 'utf8'))
    sendJson(res, 200, data)
  } catch (error) {
    sendJson(res, 500, { ok: false, error: String(error && error.message || error) })
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

async function handleShot(req, res) {
  if (req.method !== 'GET') { sendJson(res, 405, { ok: false, error: '只接受 GET' }); return }
  const url = new URL(req.url || PREFIX, 'http://localhost')
  const region = url.searchParams.get('region') || ''
  const hideDsh = url.searchParams.get('hideDsh') === '1'
  const dir = await mkdtemp(path.join(tmpdir(), SESSION_PREFIX + 'shot-'))
  const file = path.join(dir, 'shot.jpg')
  try {
    let stdout = ''
    // 快路径：常驻服务里类型已加载，只剩抓图 + 编码。
    const fast = await captureShotFast({
      out: file,
      quality: 88,
      region,
      hideDsh,
      dshPid: hideDsh ? process.ppid : 0,
    })
    if (fast !== null) {
      stdout = fast
    } else {
      const args = ['-Out', file, '-Quality', '88']
      if (region) args.push('-Region', region)
      if (hideDsh) args.push('-HideDsh', '-DshPid', String(process.ppid))
      const child = runPowerShell('shot.ps1', args)
      let stderr = ''
      child.stderr.setEncoding('utf8')
      child.stderr.on('data', chunk => { stderr += chunk })
      child.stdout.setEncoding('utf8')
      child.stdout.on('data', chunk => { stdout += chunk })
      const exited = await new Promise(resolve => {
        const timer = setTimeout(() => { try { child.kill() } catch { /* ignore */ } resolve(false) }, 20000)
        child.once('exit', code => { clearTimeout(timer); resolve(code === 0) })
        child.once('error', () => { clearTimeout(timer); resolve(false) })
      })
      if (!exited) throw new Error('截图超时' + (stderr ? '：' + stderr.slice(0, 200) : ''))
    }
    const buffer = await readFile(file)
    if (buffer.length === 0) throw new Error('截图是空的')
    const hiddenMatch = /hidden=(\d+)/.exec(stdout)
    const hidden = hiddenMatch !== null && Number(hiddenMatch[1]) > 0
    res.writeHead(200, {
      'content-type': 'image/jpeg',
      'content-length': buffer.length,
      'cache-control': 'no-store',
      'x-vsr-hidden': hidden ? '1' : '0',
    })
    res.end(buffer)
  } catch (error) {
    sendJson(res, 500, { ok: false, error: String(error && error.message || error) })
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

async function handleStart(req, res) {
  if (req.method !== 'POST') { sendJson(res, 405, { ok: false, error: '只接受 POST' }); return }
  try {
    const body = await readBody(req, 1024 * 1024)
    const payload = body.length ? JSON.parse(body.toString('utf8')) : {}
    const result = await startSession(payload)
    sendJson(res, 200, result)
  } catch (error) {
    sendJson(res, 400, { ok: false, error: String(error && error.message || error) })
  }
}

async function handleStop(req, res) {
  if (req.method !== 'POST') { sendJson(res, 405, { ok: false, error: '只接受 POST' }); return }
  try {
    const manifest = await stopSession()
    sendJson(res, 200, manifest)
  } catch (error) {
    sendJson(res, 400, { ok: false, error: String(error && error.message || error) })
  }
}

async function handleStatus(req, res) {
  if (recording === null) {
    sendJson(res, 200, { ok: true, recording: false, sessionId: null, frames: 0, seconds: 0 })
    return
  }
  const alive = recording.framesChild !== null && recording.framesChild.exitCode === null
  const frames = await countFrames(recording.dir)
  const seconds = recording.startedAt ? Math.max(0, Math.round((Date.now() - recording.startedAt) / 1000)) : 0
  sendJson(res, 200, {
    ok: true,
    recording: alive && !recording.stopped,
    finished: !alive || recording.stopped,
    sessionId: recording.id,
    startedAt: recording.startedAt,
    frames,
    seconds,
  })
}

async function handleFrame(req, res) {
  if (recording === null) { sendJson(res, 404, { ok: false, error: '没有录制会话' }); return }
  const url = new URL(req.url || PREFIX, 'http://localhost')
  const sessionId = url.searchParams.get('session') || ''
  const file = url.searchParams.get('file') || ''
  if (sessionId !== recording.id) { sendJson(res, 404, { ok: false, error: '会话不存在' }); return }
  if (!/^[a-z0-9._-]+\.jpg$/i.test(file)) { sendJson(res, 400, { ok: false, error: '文件名无效' }); return }
  const full = path.join(recording.dir, file)
  if (!existsSync(full)) { sendJson(res, 404, { ok: false, error: '帧不存在' }); return }
  try {
    const info = await stat(full)
    res.writeHead(200, {
      'content-type': 'image/jpeg',
      'content-length': info.size,
      'cache-control': 'no-store',
    })
    createReadStream(full).pipe(res)
  } catch (error) {
    sendJson(res, 500, { ok: false, error: String(error && error.message || error) })
  }
}

async function handleAudio(req, res) {
  if (recording === null) { sendJson(res, 404, { ok: false, error: '没有录制会话' }); return }
  const url = new URL(req.url || PREFIX, 'http://localhost')
  const sessionId = url.searchParams.get('session') || ''
  if (sessionId !== recording.id) { sendJson(res, 404, { ok: false, error: '会话不存在' }); return }
  const full = path.join(recording.dir, 'audio.wav')
  if (!existsSync(full)) { sendJson(res, 404, { ok: false, error: '没有音频' }); return }
  try {
    const info = await stat(full)
    res.writeHead(200, {
      'content-type': 'audio/wav',
      'content-length': info.size,
      'cache-control': 'no-store',
    })
    createReadStream(full).pipe(res)
  } catch (error) {
    sendJson(res, 500, { ok: false, error: String(error && error.message || error) })
  }
}

async function handleSave(req, res) {
  if (req.method !== 'POST') { sendJson(res, 405, { ok: false, error: '只接受 POST' }); return }
  const url = new URL(req.url || PREFIX, 'http://localhost')
  const kind = url.searchParams.get('kind') === 'image' ? 'image' : 'video'
  const fallback = kind === 'image' ? '截图.jpg' : '录屏.webm'
  const name = safeName(url.searchParams.get('name'), fallback)
  try {
    const body = await readBody(req, SAVE_LIMIT)
    if (body.length === 0) throw new Error('没有收到数据')
    const settings = await loadSettings()
    await ensureLibrary(settings)
    const dir = kind === 'image' ? screenshotsDir(settings) : recordingsDir(settings)
    const file = path.join(dir, name)
    await writeFile(file, body)
    sendJson(res, 200, { ok: true, file, dir, bytes: body.length, kind })
  } catch (error) {
    sendJson(res, 500, { ok: false, error: String(error && error.message || error) })
  }
}

async function handleServe(req, res) {
  if (req.method !== 'GET') { sendJson(res, 405, { ok: false, error: '只接受 GET' }); return }
  const url = new URL(req.url || PREFIX, 'http://localhost')
  const name = safeName(url.searchParams.get('name'), '')
  if (!name) { sendJson(res, 400, { ok: false, error: '文件名无效' }); return }
  const settings = await loadSettings()
  const kind = url.searchParams.get('kind')
  const candidates = kind === 'image' ? [screenshotsDir(settings)]
    : kind === 'video' ? [recordingsDir(settings)]
      : [recordingsDir(settings), screenshotsDir(settings)]
  const full = candidates.map(dir => path.join(dir, name)).find(candidate => existsSync(candidate))
  if (!full) { sendJson(res, 404, { ok: false, error: '文件不存在' }); return }
  try {
    const info = await stat(full)
    const lower = name.toLowerCase()
    const type = lower.endsWith('.webm') ? 'video/webm'
      : lower.endsWith('.mp4') ? 'video/mp4'
        : lower.endsWith('.jpg') || lower.endsWith('.jpeg') ? 'image/jpeg'
          : 'application/octet-stream'
    res.writeHead(200, { 'content-type': type, 'content-length': info.size, 'cache-control': 'no-store' })
    createReadStream(full).pipe(res)
  } catch (error) {
    sendJson(res, 500, { ok: false, error: String(error && error.message || error) })
  }
}

async function handleReveal(req, res) {
  if (req.method !== 'GET') { sendJson(res, 405, { ok: false, error: '只接受 GET' }); return }
  const url = new URL(req.url || PREFIX, 'http://localhost')
  const target = url.searchParams.get('path') || ''
  const full = path.resolve(target)
  const allowed = Boolean(target) && await allowedTarget(full)
  if (!allowed) {
    sendJson(res, 400, { ok: false, error: '只能打开录制目录内的路径' })
    return
  }
  try {
    const info = await stat(full)
    const args = info.isDirectory() ? [full] : ['/select,' + full]
    const child = spawn('explorer.exe', args, { detached: true, stdio: 'ignore', windowsHide: true })
    child.unref()
    sendJson(res, 200, { ok: true, path: full })
  } catch (error) {
    sendJson(res, 400, { ok: false, error: String(error && error.message || error) })
  }
}

// ------------------------------------------------------------ OCR routes

let ocrContext = null

async function handleOcrStatus(req, res) {
  if (req.method !== 'GET') { sendJson(res, 405, { ok: false, error: '只接受 GET' }); return }
  try {
    const settings = await loadSettings()
    const engines = await ocrEngines(ocrContext)
    const languages = await winrtLanguages()
    const active = pickOcrEngine(engines, settings.ocr.engine)
    sendJson(res, 200, {
      ok: true,
      engines: [
        ...engines.map(engine => ({
          id: engine.id,
          label: engine.label,
          mode: engine.mode,
          command: engine.command,
        })),
        ...(languages.length > 0
          ? [{ id: 'windows', label: 'Windows OCR（系统自带）', mode: 'winrt', command: 'Windows.Media.Ocr' }]
          : []),
      ],
      active: active.id,
      winrt: languages.length > 0,
      languages,
      lang: settings.ocr.lang,
    })
  } catch (error) {
    sendJson(res, 500, { ok: false, error: String((error && error.message) || error) })
  }
}

async function handleOcr(req, res) {
  if (req.method !== 'POST') { sendJson(res, 405, { ok: false, error: '只接受 POST' }); return }
  try {
    const body = await readBody(req, 64 * 1024 * 1024)
    if (body.length === 0) throw new Error('没有收到图片')
    const settings = await loadSettings()
    const engines = await ocrEngines(ocrContext)
    const url = new URL(req.url || PREFIX, 'http://localhost')
    const requested = url.searchParams.get('engine') || ''
    const active = pickOcrEngine(engines, requested || settings.ocr.engine)
    const dir = await mkdtemp(path.join(tmpdir(), SESSION_PREFIX + 'ocrimg-'))
    try {
      const image = path.join(dir, 'region.png')
      await writeFile(image, body)
      const startedAt = Date.now()
      const result = await runOcr(image, active, { lang: settings.ocr.lang, scale: settings.ocr.scale })
      sendJson(res, 200, {
        ok: true,
        text: result.text,
        lines: result.lines,
        engine: result.engine,
        engineLabel: active.label,
        lang: result.lang,
        ms: Date.now() - startedAt,
      })
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {})
    }
  } catch (error) {
    sendJson(res, 500, { ok: false, error: String((error && error.message) || error) })
  }
}

// ------------------------------------------------------ clipboard routes

async function handleClipboard(req, res) {
  if (req.method !== 'POST') { sendJson(res, 405, { ok: false, error: '只接受 POST' }); return }
  if (process.platform !== 'win32') { sendJson(res, 400, { ok: false, error: '目前只支持 Windows' }); return }
  const url = new URL(req.url || PREFIX, 'http://localhost')
  const kind = url.searchParams.get('kind') || 'image'
  const stored = url.searchParams.get('path') || ''
  try {
    let target = ''
    if (kind === 'image' || kind === 'files') {
      if (stored) {
        const full = path.resolve(stored)
        if (!await allowedTarget(full)) throw new Error('路径不在录制目录内')
        target = full
      } else {
        const body = await readBody(req, SAVE_LIMIT)
        if (body.length === 0) throw new Error('没有收到文件')
        target = await writeClipboardFile(url.searchParams.get('name') || '', body, '.png')
      }
    } else if (kind === 'text') {
      const body = await readBody(req, 8 * 1024 * 1024)
      if (body.length === 0) throw new Error('没有收到文字')
      target = await writeClipboardFile('ocr-text.txt', body, '.txt')
    } else {
      throw new Error('未知的剪贴板类型：' + kind)
    }
    await runChild(path.join(LIB, 'clipboard.ps1'), ['-Kind', kind, '-Path', target], 20000)
    sendJson(res, 200, { ok: true, kind, path: target })
  } catch (error) {
    sendJson(res, 400, { ok: false, error: String((error && error.message) || error) })
  }
}

async function handleOpen(req, res) {
  if (req.method !== 'GET') { sendJson(res, 405, { ok: false, error: '只接受 GET' }); return }
  if (process.platform !== 'win32') { sendJson(res, 400, { ok: false, error: '目前只支持 Windows' }); return }
  const url = new URL(req.url || PREFIX, 'http://localhost')
  const target = url.searchParams.get('path') || ''
  try {
    if (!target) throw new Error('缺少 path')
    const full = path.resolve(target)
    if (!await allowedTarget(full)) throw new Error('只能打开录制目录内的文件')
    await stat(full)
    await runChild(path.join(LIB, 'clipboard.ps1'), ['-Kind', 'open', '-Path', full], 20000)
    sendJson(res, 200, { ok: true, path: full })
  } catch (error) {
    sendJson(res, 400, { ok: false, error: String((error && error.message) || error) })
  }
}

async function handleSettings(req, res) {
  if (req.method === 'GET') {
    try {
      const settings = await loadSettings()
      await ensureLibrary(settings)
      sendJson(res, 200, {
        ok: true,
        settings,
        paths: {
          root: libraryRoot(settings),
          recordings: recordingsDir(settings),
          screenshots: screenshotsDir(settings),
          settings: settingsPath(),
        },
      })
    } catch (error) {
      sendJson(res, 500, { ok: false, error: String((error && error.message) || error) })
    }
    return
  }
  if (req.method !== 'POST') { sendJson(res, 405, { ok: false, error: '只接受 GET/POST' }); return }
  try {
    const body = await readBody(req, 1024 * 1024)
    const payload = body.length ? JSON.parse(body.toString('utf8')) : {}
    const settings = await saveSettings(payload)
    await ensureLibrary(settings)
    sendJson(res, 200, {
      ok: true,
      settings,
      paths: {
        root: libraryRoot(settings),
        recordings: recordingsDir(settings),
        screenshots: screenshotsDir(settings),
        settings: settingsPath(),
      },
    })
  } catch (error) {
    sendJson(res, 400, { ok: false, error: String((error && error.message) || error) })
  }
}

async function handleLibrary(req, res) {
  if (req.method !== 'GET') { sendJson(res, 405, { ok: false, error: '只接受 GET' }); return }
  try {
    const settings = await loadSettings()
    const sources = [
      { kind: 'video', dir: recordingsDir(settings), extensions: ['.webm', '.mp4'] },
      { kind: 'image', dir: screenshotsDir(settings), extensions: ['.jpg', '.jpeg', '.png'] },
    ]
    const files = []
    for (const source of sources) {
      let names = []
      try { names = await readdir(source.dir) } catch { continue }
      for (const name of names) {
        const lower = name.toLowerCase()
        if (!source.extensions.some(extension => lower.endsWith(extension))) continue
        try {
          const info = await stat(path.join(source.dir, name))
          if (!info.isFile()) continue
          files.push({
            name,
            kind: source.kind,
            size: info.size,
            mtime: info.mtimeMs,
            path: path.join(source.dir, name),
            dir: source.dir,
          })
        } catch { /* ignore */ }
      }
    }
    files.sort((left, right) => right.mtime - left.mtime)
    sendJson(res, 200, { ok: true, root: libraryRoot(settings), files: files.slice(0, 300) })
  } catch (error) {
    sendJson(res, 500, { ok: false, error: String((error && error.message) || error) })
  }
}

async function handleLibraryDelete(req, res) {
  if (req.method !== 'POST') { sendJson(res, 405, { ok: false, error: '只接受 POST' }); return }
  try {
    const body = await readBody(req, 1024 * 1024)
    const payload = body.length ? JSON.parse(body.toString('utf8')) : {}
    const kind = payload.kind === 'image' ? 'image' : 'video'
    const name = safeName(payload.name, '')
    if (!name) throw new Error('文件名无效')
    const settings = await loadSettings()
    const dir = kind === 'image' ? screenshotsDir(settings) : recordingsDir(settings)
    const full = path.join(dir, name)
    const relative = path.relative(dir, full)
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('路径无效')
    await rm(full, { force: true })
    sendJson(res, 200, { ok: true, deleted: full })
  } catch (error) {
    sendJson(res, 400, { ok: false, error: String((error && error.message) || error) })
  }
}

/**
 * Stop the running agent recording early.
 *
 * Until now the only way a recording ended was its timer: `vsr record --duration`
 * writes a request, `beginAgentJob` arms a timeout, and the job stops when that
 * timer fires. A caller that finishes its work in four seconds then had to
 * either wait out the whole duration or encode minutes of dead air.
 *
 * Stopping is the same path the timer takes — `finishAgentJob()` — so the
 * manifest, the encode hand-off and the state file are identical whether the
 * recording ended by time or by request. That matters: the browser half polls
 * `status === 'encoding'` and does not care which one happened.
 *
 * @param req - POST only.
 * @param res - `{ ok: true, stopped: boolean }`; `stopped` is false when there was
 *   nothing in the recording phase, which is not an error (the caller may have
 *   raced the timer).
 */
async function handleAgentStop(req, res) {
  if (req.method !== 'POST') { sendJson(res, 405, { ok: false, error: '只接受 POST' }); return }
  const url = new URL(req.url || PREFIX, 'http://localhost')
  const id = url.searchParams.get('id') || ''
  if (agentJob === null || agentJob.id !== id) {
    sendJson(res, 200, { ok: true, stopped: false, reason: '没有这个 Agent 录制' })
    return
  }
  if (agentJob.status !== 'recording') {
    // Already stopping or encoding: the caller wants the same end state, and
    // reporting failure here would make a harmless race look like a bug.
    sendJson(res, 200, { ok: true, stopped: false, reason: '录制不在 recording 阶段：' + agentJob.status })
    return
  }
  try {
    await finishAgentJob()
    sendJson(res, 200, { ok: true, stopped: true })
  } catch (error) {
    sendJson(res, 500, { ok: false, error: String((error && error.message) || error) })
  }
}

/**
 * Start an agent recording over HTTP.
 *
 * The existing path is a request FILE (`req-<id>.json`) that `agentTick` picks
 * up. That works for a CLI that cannot reach this process, but it is a poll wide
 * and a write deep for a caller already inside it — a pipeline that has to start
 * capturing now and act on the next frame does not want to lose 250 ms to a
 * directory scan, nor to depend on the DSH home being writable.
 *
 * The job this creates is the same shape `beginAgentJob` builds, so every later
 * step — status, stop, save, error — is shared with the file path.
 *
 * @param req - POST with `{ id, out, fps, maxSeconds, format }`.
 * @param res - `{ ok: true, id, startedAt }`, or a refusal naming the reason.
 */
async function handleAgentStart(req, res) {
  if (req.method !== 'POST') { sendJson(res, 405, { ok: false, error: '只接受 POST' }); return }
  if (agentJob !== null) {
    sendJson(res, 409, { ok: false, error: '已经有一路 Agent 录制在进行：' + agentJob.id })
    return
  }
  let data = {}
  try {
    const body = await readBody(req, 64 * 1024)
    data = body.length ? JSON.parse(body.toString('utf8')) : {}
  } catch (error) {
    sendJson(res, 400, { ok: false, error: '请求体不是合法 JSON：' + String((error && error.message) || error) })
    return
  }
  const id = typeof data.id === 'string' && data.id !== '' ? data.id : 'agent-' + Date.now().toString(36)
  const source = normalizeSource(data.source ?? { type: 'window' })
  const maxSeconds = clamp(data.maxSeconds ?? data.duration, 2, MAX_SECONDS, 120)
  try {
    await beginAgentJob({
      id,
      source,
      duration: maxSeconds,
      format: data.format,
      fps: data.fps,
      quality: data.quality,
      maxEdge: data.maxEdge,
      includeSystemAudio: data.includeSystemAudio,
      includeMic: data.includeMic,
      silent: data.silent === true,
      out: typeof data.out === 'string' ? data.out : '',
    })
    sendJson(res, 200, { ok: true, id, startedAt: agentJob.startedAt })
  } catch (error) {
    sendJson(res, 500, { ok: false, error: String((error && error.message) || error) })
  }
}

/**
 * Report how one agent recording ended.
 *
 * A caller that started a recording needs to know whether the video was WRITTEN
 * or DISCARDED, and the job cannot say: both outcomes clear it. The verdict is
 * in `state-<id>.json`, which `handleAgentSave` and `handleAgentError` write.
 * Exposing it lets a pipeline wait for a real answer instead of inferring one
 * from the job's disappearance — an inference that reported failed encodes as
 * saved takes.
 *
 * @param req - GET with `?id=`.
 * @param res - `{ ok: true, status }` where status is `done`, `error` or
 *   `pending`; `file`/`bytes` travel with `done`, `error` with `error`.
 */
async function handleAgentOutcome(req, res) {
  if (req.method !== 'GET') { sendJson(res, 405, { ok: false, error: '只接受 GET' }); return }
  const url = new URL(req.url || PREFIX, 'http://localhost')
  const id = url.searchParams.get('id') || ''
  if (id === '') { sendJson(res, 400, { ok: false, error: '需要 id 参数' }); return }
  // A running job has no file yet, and saying so is more useful than "pending"
  // alone: the caller learns the recording is alive rather than lost.
  const live = agentJob !== null && agentJob.id === id ? agentJob.status : null
  try {
    const text = await readFile(path.join(agentDir(), 'state-' + id + '.json'), 'utf8')
    const state = JSON.parse(text)
    const status = state && typeof state.status === 'string' ? state.status : 'pending'
    sendJson(res, 200, {
      ok: true,
      status,
      job: live,
      file: state.file,
      dir: state.dir,
      bytes: state.bytes,
      error: state.error,
    })
  } catch {
    // No state file yet: either the recording is still running or the id is not
    // this recorder's. Both are "nothing to report", not an error.
    sendJson(res, 200, { ok: true, status: 'pending', job: live })
  }
}

async function handleAgentStatus(req, res) {
  if (req.method !== 'GET') { sendJson(res, 405, { ok: false, error: '只接受 GET' }); return }
  if (agentJob === null) { sendJson(res, 200, { ok: true, job: null }); return }
  sendJson(res, 200, {
    ok: true,
    job: {
      id: agentJob.id,
      status: agentJob.status,
      startedAt: agentJob.startedAt,
      format: agentJob.format,
      includeMic: agentJob.request.includeMic !== false,
      // Silent hides this plugin's own recording pill. The pill is drawn in the
      // page, so on a capture that reads the screen it lands in the video; a
      // walkthrough that is going to be published should not carry it.
      silent: agentJob.request.silent === true,
      // What the capture was actually pointed at, so a caller can check the
      // take is of the window it meant rather than of whatever happened to be
      // in that screen rectangle.
      source: agentJob.request.source ?? null,
      title: agentJob.request.source && agentJob.request.source.title ? agentJob.request.source.title : null,
      frameCount: agentJob.manifest && agentJob.manifest.frames ? agentJob.manifest.frames.length : null,
      out: agentJob.request.out,
      manifest: agentJob.manifest,
    },
  })
}

async function handleAgentSave(req, res) {
  if (req.method !== 'POST') { sendJson(res, 405, { ok: false, error: '只接受 POST' }); return }
  const url = new URL(req.url || PREFIX, 'http://localhost')
  const id = url.searchParams.get('id') || ''
  if (agentJob === null || agentJob.id !== id || agentJob.status !== 'encoding') {
    sendJson(res, 400, { ok: false, error: '没有等待编码的 Agent 录制' })
    return
  }
  try {
    const body = await readBody(req, SAVE_LIMIT)
    if (body.length === 0) throw new Error('没有收到视频数据')
    const settings = await loadSettings()
    await ensureLibrary(settings)
    const requested = String(agentJob.request.out || '').trim()
    const actualFormat = url.searchParams.get('format') === 'webm' ? 'webm' : 'mp4'
    let file = requested
      ? path.resolve(requested)
      : path.join(recordingsDir(settings), '录屏-' + timestampName() + '.' + actualFormat)
    if (requested) {
      const extension = path.extname(file).toLowerCase()
      const wanted = '.' + actualFormat
      if (extension !== wanted) file = file.slice(0, extension ? -extension.length : file.length) + wanted
    }
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, body)
    await writeAgentState(id, { status: 'done', file, dir: path.dirname(file), bytes: body.length })
    const job = agentJob
    agentJob = null
    if (job !== null && job.timer !== null) clearTimeout(job.timer)
    await discardSession().catch(() => {})
    log('agent recording saved', file, body.length)
    sendJson(res, 200, { ok: true, file, dir: path.dirname(file), bytes: body.length })
  } catch (error) {
    sendJson(res, 500, { ok: false, error: String((error && error.message) || error) })
  }
}

async function handleAgentError(req, res) {
  if (req.method !== 'POST') { sendJson(res, 405, { ok: false, error: '只接受 POST' }); return }
  const url = new URL(req.url || PREFIX, 'http://localhost')
  const id = url.searchParams.get('id') || ''
  let message = '编码失败'
  try {
    const body = await readBody(req, 1024 * 1024)
    const data = body.length ? JSON.parse(body.toString('utf8')) : {}
    if (data && data.error) message = String(data.error)
  } catch { /* 用默认错误 */ }
  if (agentJob === null || agentJob.id !== id) {
    sendJson(res, 400, { ok: false, error: '没有这个 Agent 录制' })
    return
  }
  const job = agentJob
  agentJob = null
  if (job !== null && job.timer !== null) clearTimeout(job.timer)
  await writeAgentState(id, { status: 'error', error: message }).catch(() => {})
  await discardSession().catch(() => {})
  sendJson(res, 200, { ok: true })
}

const ROUTES = [
  { kind: 'prefix', path: PREFIX + '/sources', handler: handleSources },
  { kind: 'prefix', path: PREFIX + '/shot', handler: handleShot },
  { kind: 'prefix', path: PREFIX + '/record/start', handler: handleStart },
  { kind: 'prefix', path: PREFIX + '/record/stop', handler: handleStop },
  { kind: 'prefix', path: PREFIX + '/record/status', handler: handleStatus },
  { kind: 'prefix', path: PREFIX + '/record/frame', handler: handleFrame },
  { kind: 'prefix', path: PREFIX + '/record/audio', handler: handleAudio },
  { kind: 'prefix', path: PREFIX + '/record/save', handler: handleSave },
  { kind: 'prefix', path: PREFIX + '/record/serve', handler: handleServe },
  { kind: 'prefix', path: PREFIX + '/record/discard', handler: async (req, res) => {
    try { sendJson(res, 200, await discardSession()) } catch (error) { sendJson(res, 500, { ok: false, error: String(error) }) }
  } },
  { kind: 'prefix', path: PREFIX + '/agent/start', handler: handleAgentStart },
  { kind: 'prefix', path: PREFIX + '/agent/status', handler: handleAgentStatus },
  { kind: 'prefix', path: PREFIX + '/agent/outcome', handler: handleAgentOutcome },
  { kind: 'prefix', path: PREFIX + '/agent/stop', handler: handleAgentStop },
  { kind: 'prefix', path: PREFIX + '/agent/save', handler: handleAgentSave },
  { kind: 'prefix', path: PREFIX + '/agent/error', handler: handleAgentError },
  { kind: 'prefix', path: PREFIX + '/settings', handler: handleSettings },
  { kind: 'prefix', path: PREFIX + '/library/delete', handler: handleLibraryDelete },
  { kind: 'prefix', path: PREFIX + '/library', handler: handleLibrary },
  { kind: 'prefix', path: PREFIX + '/reveal', handler: handleReveal },
  { kind: 'prefix', path: PREFIX + '/ocr/status', handler: handleOcrStatus },
  { kind: 'prefix', path: PREFIX + '/ocr', handler: handleOcr },
  { kind: 'prefix', path: PREFIX + '/clipboard', handler: handleClipboard },
  { kind: 'prefix', path: PREFIX + '/open', handler: handleOpen },
]

function resolveWebServer(scope) {
  try {
    if (scope && scope.webServer && typeof scope.webServer.register === 'function') return scope.webServer
    if (scope && typeof scope.get === 'function') {
      const service = scope.get('webServer')
      if (service && typeof service.register === 'function') return service
    }
    if (scope && typeof scope.reflect?.get === 'function') {
      const service = scope.reflect.get('webServer')
      if (service && typeof service.register === 'function') return service
    }
  } catch { /* ignore */ }
  return null
}

/**
 * Build the Windows.Graphics.Capture helper, in the background.
 *
 * Runs the same script an operator would run by hand. A failure is logged and
 * swallowed: the recorder works without this helper, and an install must not
 * fail because a machine has no .NET SDK.
 *
 * @returns the executable path when it is available afterwards.
 */
async function buildWgcHelper() {
  const script = path.join(ROOT, 'scripts', 'build-wgcrec.mjs')
  if (!existsSync(script)) return wgcRecorderPath()
  const child = spawn(process.execPath, [script], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  child.stdout?.setEncoding('utf8')
  child.stderr?.setEncoding('utf8')
  child.stdout?.on('data', (chunk) => { output += chunk })
  child.stderr?.on('data', (chunk) => { output += chunk })
  await new Promise((resolve) => child.on('close', resolve))
  const built = wgcRecorderPath()
  log('wgcrec', built === undefined ? 'unavailable; GDI capture will be used' : 'ready at ' + built)
  if (built === undefined && output.trim() !== '') log('wgcrec output:', output.trim().slice(0, 400))
  return built
}

export function apply(ctx) {
  ocrContext = ctx
  cleanupOldSessions().catch(() => {})
  void installAgentAssets().catch(error => log('安装技能/CLI 失败：', (error && error.message) || error))
  // Build the occlusion-proof capture helper once, in the background. It is
  // optional: without it the GDI path records the screen rectangle, with it the
  // window's own surface. Building here rather than at first use means a
  // recording never waits on a compile.
  void buildWgcHelper().catch(error => log('wgcrec 构建失败：', (error && error.message) || error))
  // 预热常驻截图服务：PowerShell 冷启动和 C# 加载都放后台，第一次截图就快。
  try { startShotServer() } catch (error) { log('截图服务预热失败：', (error && error.message) || error) }
  try {
    ctx.effect(() => () => stopShotServer(), 'dsh-vyra-screen-recorder: shot server')
  } catch { /* ignore */ }
  try {
    const agentTimer = setInterval(() => { void agentTick() }, 500)
    ctx.effect(() => () => {
      clearInterval(agentTimer)
      if (agentJob !== null) {
        if (agentJob.timer !== null) clearTimeout(agentJob.timer)
        agentJob = null
      }
    }, 'dsh-vyra-screen-recorder: agent queue')
  } catch (error) {
    log('agent queue 启动失败：', (error && error.message) || error)
  }
  try {
    ctx.inject(['webServer'], (scope) => {
      const webServer = resolveWebServer(scope)
      if (webServer === null) {
        log('拿不到 webServer.register，路由未挂载')
        return
      }
      const effect = typeof scope.effect === 'function' ? scope.effect.bind(scope) : ctx.effect.bind(ctx)
      effect(() => {
        const disposers = []
        for (const route of ROUTES) {
          try {
            disposers.push(webServer.register({ kind: route.kind, path: route.path, handler: route.handler }))
          } catch (error) {
            log('挂载路由失败：' + route.path, error && error.message)
          }
        }
        return () => {
          for (const dispose of disposers) {
            try { dispose() } catch { /* ignore */ }
          }
          discardSession().catch(() => {})
        }
      }, 'dsh-vyra-screen-recorder: capture routes')
    })
  } catch (error) {
    log('apply 失败：', error && error.message)
  }
}

export const __test = {
  safeName, normalizeSource, clamp, readFrames, countFrames,
  normalizeSettings, recordingsDir, screenshotsDir,
  captureShotFast, startShotServer, stopShotServer,
  parseShortcut, formatShortcut, resolveOcrEngine, splitPatchRows, parseEngineRows,
  pickOcrEngine, runOcr, ocrEngines, winrtLanguages, allowedTarget, clipboardDir,
  handleOcr, handleOcrStatus, handleClipboard,
  handleAgentStop, handleAgentStart, handleAgentOutcome,
}
