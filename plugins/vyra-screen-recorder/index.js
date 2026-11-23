/**
 * vyra-screen-recorder — 宿主侧：屏幕抓取 / 录屏 / 系统声音。
 *
 * 为什么在宿主侧抓屏
 * -----------------
 * DSH 桌面版是 Electron，主进程把 display-capture 拒绝掉了；浏览器里的
 * getDisplayMedia / chromeMediaSource 都拿不到流（实测 NotAllowedError，
 * 旧路径甚至会让渲染进程崩溃）。所以抓屏放在宿主进程：
 *
 *   截图：lib/shot.ps1     → GDI 抓一块屏幕 → JPEG
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
 */
import { spawn } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { mkdtemp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'vyra-screen-recorder'
export const inject = ['webServer']

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const PREFIX = '/plugins/vyra-screen-recorder'
const LIB = path.join(ROOT, 'lib')
const POWERSHELL = process.env.VSR_POWERSHELL || 'powershell.exe'
const SAVE_LIMIT = 512 * 1024 * 1024
const MAX_SECONDS = 600
const SESSION_PREFIX = 'vyra-screen-recorder-'

let recording = null
let agentJob = null

function log(...args) {
  try { console.log('[vyra-screen-recorder]', ...args) } catch { /* ignore */ }
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

function recordingsDir() {
  return process.env.VSR_RECORDINGS_DIR || path.join(dshHome(), 'vyra-screen-recorder', 'recordings')
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

// ------------------------------------------------------------- agent queue
// CLI 录屏：CLI 把 req-<id>.json 写进 ~/.dsh/vyra-screen-recorder/agent，
// 宿主轮询后开录/停录；状态写 state-<id>.json。编码由 DSH Web 界面完成，
// 完成后 POST /agent/save 把 WebM 写到请求里的 --out。

function agentDir() {
  return path.join(dshHome(), 'vyra-screen-recorder', 'agent')
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
  const skillSource = path.join(ROOT, 'skills', 'vyra-screen-recorder', 'SKILL.md')
  const skillText = await readFile(skillSource, 'utf8')
  const skillDir = path.join(dshHome(), 'skills', 'vyra-screen-recorder')
  await mkdir(skillDir, { recursive: true })
  await writeFile(path.join(skillDir, 'SKILL.md'), skillText)

  const binDir = path.join(dshHome(), 'vyra-screen-recorder', 'bin')
  await mkdir(binDir, { recursive: true })
  const cli = path.join(ROOT, 'bin', 'vsr.mjs')
  await writeFile(path.join(binDir, 'vsr.cmd'), '@echo off\r\nnode "' + cli + '" %*\r\n')
  await writeFile(path.join(binDir, 'vsr'), '#!/bin/sh\nexec node "' + cli.replace(/\\/g, '/') + '" "$@"\n')
  await mkdir(agentDir(), { recursive: true })
}

async function beginAgentJob(request) {
  const duration = clamp(request.duration, 2, MAX_SECONDS, 10)
  const result = await startSession({
    source: request.source,
    fps: request.fps,
    quality: request.quality,
    maxEdge: request.maxEdge,
    maxSeconds: duration,
    includeSystemAudio: request.includeSystemAudio !== false,
  })
  agentJob = {
    id: request.id,
    request,
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
  const fps = clamp(payload && payload.fps, 4, 12, 8)
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

  const framesArgs = [
    '-OutDir', dir,
    '-Fps', String(fps),
    '-Quality', String(quality),
    '-MaxEdge', String(maxEdge),
    '-MaxSeconds', String(maxSeconds),
    '-StopFile', path.join(dir, 'frames.stop'),
  ]
  if (source.type === 'window') framesArgs.push('-Hwnd', String(source.hwnd))
  else if (source.type === 'region') framesArgs.push('-Region', [source.x, source.y, source.w, source.h].join(','))

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
    const frames = runPowerShell('frames.ps1', framesArgs)
    session.framesChild = frames
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
  const dir = await mkdtemp(path.join(tmpdir(), SESSION_PREFIX + 'shot-'))
  const file = path.join(dir, 'shot.jpg')
  try {
    const args = ['-Out', file, '-Quality', '88']
    if (region) args.push('-Region', region)
    const child = runPowerShell('shot.ps1', args)
    let stderr = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', chunk => { stderr += chunk })
    const exited = await new Promise(resolve => {
      const timer = setTimeout(() => { try { child.kill() } catch { /* ignore */ } resolve(false) }, 20000)
      child.once('exit', code => { clearTimeout(timer); resolve(code === 0) })
      child.once('error', () => { clearTimeout(timer); resolve(false) })
    })
    if (!exited) throw new Error('截图超时' + (stderr ? '：' + stderr.slice(0, 200) : ''))
    const buffer = await readFile(file)
    if (buffer.length === 0) throw new Error('截图是空的')
    res.writeHead(200, {
      'content-type': 'image/jpeg',
      'content-length': buffer.length,
      'cache-control': 'no-store',
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
  const name = safeName(url.searchParams.get('name'), 'recording.webm')
  try {
    const body = await readBody(req, SAVE_LIMIT)
    if (body.length === 0) throw new Error('没有收到数据')
    const dir = recordingsDir()
    await mkdir(dir, { recursive: true })
    const file = path.join(dir, name)
    await writeFile(file, body)
    sendJson(res, 200, { ok: true, file, dir, bytes: body.length })
  } catch (error) {
    sendJson(res, 500, { ok: false, error: String(error && error.message || error) })
  }
}

async function handleServe(req, res) {
  if (req.method !== 'GET') { sendJson(res, 405, { ok: false, error: '只接受 GET' }); return }
  const url = new URL(req.url || PREFIX, 'http://localhost')
  const name = safeName(url.searchParams.get('name'), '')
  if (!name) { sendJson(res, 400, { ok: false, error: '文件名无效' }); return }
  const full = path.join(recordingsDir(), name)
  if (!existsSync(full)) { sendJson(res, 404, { ok: false, error: '文件不存在' }); return }
  try {
    const info = await stat(full)
    const type = name.toLowerCase().endsWith('.webm') ? 'video/webm'
      : name.toLowerCase().endsWith('.jpg') || name.toLowerCase().endsWith('.jpeg') ? 'image/jpeg'
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
  const root = path.resolve(recordingsDir())
  const full = path.resolve(target)
  const relative = path.relative(root, full)
  if (!full || relative.startsWith('..') || path.isAbsolute(relative)) {
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

async function handleAgentStatus(req, res) {
  if (req.method !== 'GET') { sendJson(res, 405, { ok: false, error: '只接受 GET' }); return }
  if (agentJob === null) { sendJson(res, 200, { ok: true, job: null }); return }
  sendJson(res, 200, {
    ok: true,
    job: {
      id: agentJob.id,
      status: agentJob.status,
      startedAt: agentJob.startedAt,
      includeMic: agentJob.request.includeMic !== false,
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
    const requested = String(agentJob.request.out || '').trim()
    const file = requested
      ? path.resolve(requested)
      : path.join(recordingsDir(), 'agent-' + id + '.webm')
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
  { kind: 'prefix', path: PREFIX + '/agent/status', handler: handleAgentStatus },
  { kind: 'prefix', path: PREFIX + '/agent/save', handler: handleAgentSave },
  { kind: 'prefix', path: PREFIX + '/agent/error', handler: handleAgentError },
  { kind: 'prefix', path: PREFIX + '/reveal', handler: handleReveal },
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

export function apply(ctx) {
  cleanupOldSessions().catch(() => {})
  void installAgentAssets().catch(error => log('安装技能/CLI 失败：', (error && error.message) || error))
  try {
    const agentTimer = setInterval(() => { void agentTick() }, 500)
    ctx.effect(() => () => {
      clearInterval(agentTimer)
      if (agentJob !== null) {
        if (agentJob.timer !== null) clearTimeout(agentJob.timer)
        agentJob = null
      }
    }, 'vyra-screen-recorder: agent queue')
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
      }, 'vyra-screen-recorder: capture routes')
    })
  } catch (error) {
    log('apply 失败：', error && error.message)
  }
}

export const __test = { safeName, normalizeSource, clamp, readFrames, countFrames }
