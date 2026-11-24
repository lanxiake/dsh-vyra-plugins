#!/usr/bin/env node
/**
 * dsh-vyra-screen-recorder CLI.
 *
 * 截图 / 枚举源直接在命令行调 PowerShell 完成，不依赖 DSH 运行。
 * 录屏把请求写进本地队列，由 DSH 宿主开录，DSH Web 界面负责 WebCodecs
 * 编码并保存到 --out；命令会等到状态文件变成 done/error。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const AGENT_DIR = path.join(HOME, 'dsh-vyra-screen-recorder', 'agent')
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version
const SETTINGS_FILE = path.join(HOME, 'dsh-vyra-screen-recorder', 'settings.json')

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
  shortcuts: { screenshot: 'Ctrl+Alt+S', record: 'Ctrl+Alt+R' },
}

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function libraryRoot(settings) {
  if (process.env.VSR_LIBRARY_DIR) return path.resolve(process.env.VSR_LIBRARY_DIR)
  if (settings.dir) return settings.dir
  return path.join(os.homedir(), 'Videos', 'Vyra Screen Recorder')
}

function recordingsDir(settings) {
  if (process.env.VSR_RECORDINGS_DIR) return process.env.VSR_RECORDINGS_DIR
  if (settings.videoDir) return settings.videoDir
  return path.join(libraryRoot(settings), 'recordings')
}

function screenshotsDir(settings) {
  if (process.env.VSR_SCREENSHOTS_DIR) return process.env.VSR_SCREENSHOTS_DIR
  if (settings.shotDir) return settings.shotDir
  return path.join(libraryRoot(settings), 'screenshots')
}

function timestamp() {
  const now = new Date()
  const pad = value => String(value).padStart(2, '0')
  return String(now.getFullYear()) + pad(now.getMonth() + 1) + pad(now.getDate())
    + '-' + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds())
}

const HELP = `dsh-vyra-screen-recorder ${VERSION}

用法：
  vsr shot    [--out <文件>] [--region x,y,w,h] [--max-edge N] [--quality 1-100] [--no-cursor] [--hide-dsh] [--json]
  vsr sources [--json]
  vsr files   [--json]
  vsr record  [--duration <秒>] [--out <文件>] [--format mp4|webm] [--source desktop|monitor:<n>|window:<hwnd>|region:x,y,w,h]
              [--fps 4-12] [--quality 40-90] [--max-edge N] [--no-audio] [--no-mic] [--json]
  vsr --help | --version

说明：
  - 截图、sources、files 不依赖 DSH 运行。
  - 截图省略 --out 时保存到设置的截图目录。
  - 录屏省略 --out 时由宿主保存到设置的录制目录；默认格式读设置（默认 MP4）。
  - 录屏需要 DSH Web 界面保持打开：宿主抓屏，界面用 WebCodecs 编码。
  - CLI 路径：${path.join(ROOT, 'bin', 'vsr.mjs')}
`

function fail(message, code = 1) {
  console.error('[vsr] ' + message)
  process.exit(code)
}

function clampInt(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.round(number)))
}

function parseArgs(argv) {
  const out = { _: [] }
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index]
    if (!token.startsWith('--')) { out._.push(token); continue }
    const key = token.slice(2)
    if (key.includes('=')) {
      const [name, value] = key.split('=')
      out[name] = value
      continue
    }
    const next = argv[index + 1]
    if (next !== undefined && !next.startsWith('--')) { out[key] = next; index++ }
    else out[key] = true
  }
  return out
}

function runPowerShell(script, args) {
  const result = spawnSync('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden',
    '-File', path.join(ROOT, 'lib', script), ...args,
  ], { encoding: 'utf8', timeout: 120000, windowsHide: true })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || ('PowerShell 退出码 ' + result.status)).trim())
  }
  return result.stdout || ''
}

function readSources() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsr-cli-'))
  try {
    const file = path.join(dir, 'sources.json')
    runPowerShell('sources.ps1', ['-Out', file])
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

function resolveSource(value) {
  const source = value || 'desktop'
  if (source === 'desktop') return { type: 'desktop' }
  if (source.startsWith('monitor:')) {
    const index = Number(source.slice('monitor:'.length))
    const data = readSources()
    const monitor = (data.monitors || []).find(item => item.index === index)
    if (!monitor) fail('找不到显示器 ' + index)
    return { type: 'monitor', x: monitor.x, y: monitor.y, w: monitor.w, h: monitor.h, name: monitor.name }
  }
  if (source.startsWith('window:')) {
    const hwnd = Number(source.slice('window:'.length))
    if (!Number.isSafeInteger(hwnd) || hwnd <= 0) fail('窗口句柄无效：' + source)
    return { type: 'window', hwnd }
  }
  if (source.startsWith('region:')) {
    const parts = source.slice('region:'.length).split(',').map(Number)
    if (parts.length !== 4 || parts.some(item => !Number.isFinite(item))) fail('region 格式是 x,y,w,h')
    return { type: 'region', x: parts[0], y: parts[1], w: parts[2], h: parts[3] }
  }
  fail('未知录制源：' + source)
}

function shot(argv) {
  const options = parseArgs(argv)
  const settings = loadSettings()
  const out = options.out || options._[0]
  const file = out
    ? path.resolve(process.cwd(), String(out))
    : path.join(screenshotsDir(settings), '截图-' + timestamp() + '.jpg')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const args = ['-Out', file]
  if (options.region) args.push('-Region', String(options.region))
  if (options['max-edge']) args.push('-MaxEdge', String(options['max-edge']))
  if (options.quality) args.push('-Quality', String(options.quality))
  if (options['no-cursor']) args.push('-NoCursor')
  if (options['hide-dsh']) args.push('-HideDsh')
  runPowerShell('shot.ps1', args)
  if (options.json) console.log(JSON.stringify({ ok: true, file }))
  else console.log('file=' + file)
}

function listFiles(argv) {
  const options = parseArgs(argv)
  const settings = loadSettings()
  const sources = [
    { kind: 'video', dir: recordingsDir(settings), extensions: ['.mp4', '.webm'] },
    { kind: 'image', dir: screenshotsDir(settings), extensions: ['.jpg', '.jpeg', '.png'] },
  ]
  const files = []
  for (const source of sources) {
    let names = []
    try { names = fs.readdirSync(source.dir) } catch { continue }
    for (const name of names) {
      const lower = name.toLowerCase()
      if (!source.extensions.some(extension => lower.endsWith(extension))) continue
      try {
        const info = fs.statSync(path.join(source.dir, name))
        if (!info.isFile()) continue
        files.push({ name, kind: source.kind, size: info.size, mtime: info.mtimeMs, path: path.join(source.dir, name) })
      } catch { /* ignore */ }
    }
  }
  files.sort((left, right) => right.mtime - left.mtime)
  if (options.json) {
    console.log(JSON.stringify({
      ok: true,
      root: libraryRoot(settings),
      recordings: recordingsDir(settings),
      screenshots: screenshotsDir(settings),
      files,
    }))
    return
  }
  for (const file of files) console.log(file.name + '\t' + file.size + '\t' + file.kind)
}

function listSources(argv) {
  const options = parseArgs(argv)
  const data = readSources()
  if (options.json) { console.log(JSON.stringify(data)); return }
  console.log('virtual ' + data.virtual.w + 'x' + data.virtual.h + ' @ ' + data.virtual.x + ',' + data.virtual.y)
  for (const monitor of data.monitors || []) {
    console.log('monitor:' + monitor.index + '  ' + monitor.w + 'x' + monitor.h + ' @ ' + monitor.x + ',' + monitor.y + (monitor.primary ? '  (primary)' : ''))
  }
  for (const win of data.windows || []) {
    console.log('window:' + win.hwnd + '  ' + win.w + 'x' + win.h + '  ' + (win.process || '') + '  ' + win.title)
  }
}

function readState(id) {
  try { return JSON.parse(fs.readFileSync(path.join(AGENT_DIR, 'state-' + id + '.json'), 'utf8')) } catch { return null }
}

function writeAtomic(file, text) {
  const temporary = file + '.tmp-' + process.pid
  fs.writeFileSync(temporary, text)
  fs.renameSync(temporary, file)
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function record(argv) {
  const options = parseArgs(argv)
  const settings = loadSettings()
  const out = options.out || options._[0]
  const outFile = out ? path.resolve(process.cwd(), String(out)) : ''
  const lower = outFile.toLowerCase()
  const format = options.format === 'webm' ? 'webm'
    : options.format === 'mp4' ? 'mp4'
      : lower.endsWith('.webm') ? 'webm'
        : lower.endsWith('.mp4') ? 'mp4'
          : (settings.format === 'webm' ? 'webm' : 'mp4')
  const duration = clampInt(options.duration, 2, 600, 10)
  const source = resolveSource(options.source)
  const id = 'vsr-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
  const request = {
    id,
    action: 'record',
    source,
    duration,
    format,
    fps: clampInt(options.fps, 4, 12, settings.fps),
    quality: clampInt(options.quality, 40, 90, settings.quality),
    maxEdge: clampInt(options['max-edge'], 320, 2560, settings.maxEdge),
    includeSystemAudio: options['no-audio'] ? false : settings.includeSystemAudio !== false,
    includeMic: options['no-mic'] ? false : settings.includeMic !== false,
    out: outFile,
    createdAt: Date.now(),
  }
  fs.mkdirSync(AGENT_DIR, { recursive: true })
  if (outFile) fs.mkdirSync(path.dirname(outFile), { recursive: true })
  writeAtomic(path.join(AGENT_DIR, 'req-' + id + '.json'), JSON.stringify(request))
  console.error('[vsr] 已提交录屏请求：' + duration + ' 秒，源 ' + source.type + '。录屏需要 DSH Web 界面保持打开。')

  const deadline = Date.now() + (duration + 300) * 1000
  let lastStatus = ''
  while (Date.now() < deadline) {
    const state = readState(id)
    if (state !== null) {
      if (state.status !== lastStatus) {
        lastStatus = state.status
        if (state.status !== 'done') console.error('[vsr] ' + state.status + (state.error ? '：' + state.error : ''))
      }
      if (state.status === 'done') {
        try { fs.unlinkSync(path.join(AGENT_DIR, 'req-' + id + '.json')) } catch { /* ignore */ }
        try { fs.unlinkSync(path.join(AGENT_DIR, 'state-' + id + '.json')) } catch { /* ignore */ }
        if (options.json) console.log(JSON.stringify({ ok: true, file: state.file, bytes: state.bytes }))
        else console.log('file=' + state.file)
        return
      }
      if (state.status === 'error') fail(state.error || '录屏失败')
    }
    await sleep(300)
  }
  fail('等待编码超时。请确认 DSH Web 界面已打开，然后重试。')
}

const [command, ...rest] = process.argv.slice(2)
if (!command || command === 'help' || command === '--help' || command === '-h') {
  console.log(HELP)
} else if (command === '--version' || command === '-V' || command === 'version') {
  console.log(VERSION)
} else if (command === 'shot') {
  shot(rest)
} else if (command === 'sources') {
  listSources(rest)
} else if (command === 'files') {
  listFiles(rest)
} else if (command === 'record') {
  await record(rest)
} else {
  fail('未知命令：' + command + '\n\n' + HELP)
}
