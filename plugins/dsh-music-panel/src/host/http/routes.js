/**
 * The `/music/*` HTTP surface.
 *
 *   GET  /music/config             effective settings + resolved DSH home
 *   POST /music/config             validate and persist roots/depth/extensions
 *   GET  /music/library?refresh=1  scan the configured roots
 *   GET  /music/stream?path=...    range-capable audio stream
 *   GET  /music/cover?path=...     embedded front cover (404 when absent)
 *   GET  /music/lyrics?path=...    sidecar .lrc as timed lines
 *   GET  /music/playlists          user playlists
 *   POST /music/play               record one playback for a track
 *   GET  /music/state              last playback state (resume)
 *   POST /music/state              persist last playback state
 *   POST /music/playback           add actually-listened seconds
 *   POST /music/position           remember one track's resume point
 *   GET  /music/stats?range=...    aggregated play time / plays (all|week|month)
 *   GET  /music/eq/presets?q=...   AutoEQ device presets (search + source filter)
 *
 * Every path parameter is re-resolved against the configured roots, so a
 * crafted `?path=` can never read outside the folders the user granted.
 *
 * @module dsh-music-panel/routes
 */

import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { copyFile, mkdir, readdir, readFile, realpath, rename, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SUPPORTED_EXTENSIONS, extensionOf, mimeOf } from '../stores/config.js'
import { fail, isLoopback, isSameOrigin, queryOf, readJson, sendJson } from './http.js'
import { isAllowedCoverUrl } from './url-safety.js'
import { readLyricsFor, lyricFormatHintForName } from '../services/lyrics/lyrics.js'
import { describeLocalSources, needsAutoMatch, resolveLocalLyrics } from '../services/lyrics/local-lyrics.js'
import { createLocalLyricMatcher } from '../services/lyrics/local-match.js'
import { backupLyrics, serializeLrc, shiftLrc, writeEmbeddedLyrics } from '../services/lyrics/lyrics-write.js'
import { readCover } from '../services/media/meta.js'
import { readTags, writeTags } from '../services/media/tags.js'
import { readReplayGain } from '../services/media/replaygain.js'
import { searchOnline } from '../services/online-metadata.js'
import { fetchLyricById, searchLyricCandidates } from '../services/lyrics/lyrics-search.js'
import { takeControls } from '../services/playback/control.js'
import { createTrash } from '../services/media/trash.js'
import { clearData, clearDataCategory, inspectData, CLEARABLE_CATEGORIES } from '../services/media/plugin-data.js'
import { eqPresetRow, loadEqPresets, searchEqPresets } from '../stores/eq-presets.js'
import * as providers from '../providers/index.js'
import { createOnlineRoutes, onlineSongId } from './routes/online.js'
import { omni } from '../providers/sources/index.js'
import { createLyricMatchService } from '../services/lyrics/lyrics-match-service.js'

export { onlineSongId }

/** Route prefix owned by this plugin. */
export const PREFIX = '/music'
const PLUGIN_ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

/** `relative()` handles case-insensitive drives poorly on Windows; normalize. */
function isInside(root, target) {
  const rel = relative(root.toLowerCase(), target.toLowerCase())
  if (rel === '') return true
  return !rel.startsWith('..') && !isAbsolute(rel)
}

/**
 * Turn an untrusted `?path=` into a real file inside one of the roots.
 *
 * @param {string | null} raw
 * @param {readonly string[]} roots
 * @returns {Promise<string | null>}
 */
export async function resolveTrack(raw, roots) {
  if (typeof raw !== 'string' || raw === '') return null
  let real
  try {
    real = await realpath(resolve(raw))
  } catch {
    return null
  }
  if (!SUPPORTED_EXTENSIONS.includes(extensionOf(real))) return null
  const lowered = real.toLowerCase()
  for (const root of roots) {
    let realRoot
    try {
      realRoot = await realpath(resolve(root))
    } catch {
      continue
    }
    if (isInside(realRoot, lowered)) return real
  }
  return null
}

/**
 * Parse one `Range: bytes=...` header against the known size.
 *
 * @returns {null | { invalid: true } | { start: number, end: number }}
 */
export function parseRange(header, size) {
  if (typeof header !== 'string' || header === '') return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (match === null) return null
  let start = match[1] === '' ? null : Number(match[1])
  let end = match[2] === '' ? null : Number(match[2])
  if (start === null && end === null) return null
  if (start === null) {
    start = Math.max(size - end, 0)
    end = size - 1
  } else if (end === null) {
    end = size - 1
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
    return { invalid: true }
  }
  return { start, end: Math.min(end, size - 1) }
}

function pipeFile(stream, req, res) {
  stream.on('error', () => {
    if (!res.writableEnded) {
      try {
        res.destroy()
      } catch {
        // Already gone.
      }
    }
  })
  req.on('close', () => {
    if (!stream.destroyed) stream.destroy()
  })
  stream.pipe(res)
}

async function sendStream(req, res, file) {
  const info = await stat(file)
  const size = info.size
  const common = {
    'content-type': mimeOf(file),
    'accept-ranges': 'bytes',
    'cache-control': 'private, max-age=0, must-revalidate',
  }
  if (size === 0) {
    res.writeHead(200, { ...common, 'content-length': 0 })
    res.end()
    return
  }

  if (req.method === 'HEAD') {
    res.writeHead(200, { ...common, 'content-length': size })
    res.end()
    return
  }

  const range = parseRange(req.headers.range, size)
  if (range !== null && range.invalid === true) {
    res.writeHead(416, { ...common, 'content-range': `bytes */${size}` })
    res.end()
    return
  }
  if (range === null) {
    res.writeHead(200, { ...common, 'content-length': size })
    pipeFile(createReadStream(file), req, res)
    return
  }
  // Chromium treats a first 206 that carries the entire body as an unseekable
  // stream; a range covering the whole file is answered with 200 instead.
  if (range.start === 0 && range.end === size - 1) {
    res.writeHead(200, { ...common, 'content-length': size })
    pipeFile(createReadStream(file), req, res)
    return
  }
  res.writeHead(206, {
    ...common,
    'content-length': range.end - range.start + 1,
    'content-range': `bytes ${range.start}-${range.end}/${size}`,
  })
  pipeFile(createReadStream(file, { start: range.start, end: range.end }), req, res)
}

async function sendCover(res, file) {
  const info = await stat(file)
  const cover = await readCover(file, info.mtimeMs)
  if (cover === null) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
    res.end('no cover')
    return
  }
  res.writeHead(200, {
    'content-type': cover.mime,
    'content-length': cover.data.length,
    'cache-control': 'private, max-age=86400, immutable',
    etag: `"${info.size.toString(16)}-${Math.round(info.mtimeMs).toString(16)}"`,
  })
  res.end(cover.data)
}

/**
 * Validate user-provided roots before persisting them: every entry must exist
 * and be a directory. Missing entries are reported, not silently dropped.
 *
 * @param {unknown[]} list
 */
async function validateRoots(list) {
  const good = []
  const bad = []
  for (const raw of list) {
    if (typeof raw !== 'string' || raw.trim() === '') continue
    const abs = resolve(raw.trim())
    try {
      const info = await stat(abs)
      if (info.isDirectory()) good.push(abs)
      else bad.push(abs)
    } catch {
      bad.push(abs)
    }
  }
  return { good, bad }
}

/**
 * @param {{
 *   settings: { read: () => Promise<any>, write: (patch: any) => Promise<any>, home: string, file: string },
 *   library: { scan: (options?: { refresh?: boolean }) => Promise<any> },
 *   playlists: {
 *     list: () => Promise<any[]>,
 *     create: (name?: string) => Promise<any | null>,
 *     update: (id: string, patch: { name?: string, add?: string[], remove?: string[] }) => Promise<any | null>,
 *     remove: (id: string) => Promise<boolean>,
 *   },
 *   stats: { recordPlay: (path: string) => Promise<{ plays: number }> },
 *   favorites: { list: () => Promise<Array<{path:string,addedAt:number}>>, toggle: (path: string) => Promise<{ favorite: boolean, favorites: Array<object> }> },
 *   playback: { read: () => Promise<object | null>, write: (state: unknown) => Promise<object | null> },
 * }} deps
 */
const debugReports = []

export function createRoutes({
  settings,
  library,
  playlists,
  stats,
  playback,
  favorites,
  providerStore,
  accountStore,
  accountReads,
  mediaCache,
  kugouSessions,
  resetData,
  lyricState,
  lyricOmni,
  audioFocus,
  cacheDirFor,
  watcher,
  getLibraryRevision,
}) {
  /** '' in settings means the plugin's own data directory. */
  const settingsDir = typeof settings.dir === 'string' && settings.dir !== '' ? settings.dir : ''
  const defaultCacheDir = settingsDir === '' ? '' : join(settingsDir, 'cache')
  const cacheDirOf = typeof cacheDirFor === 'function'
    ? cacheDirFor
    : (config) => (config !== null && typeof config === 'object' && typeof config.cacheDir === 'string' && config.cacheDir !== ''
      ? config.cacheDir
      : defaultCacheDir)
  const libraryRevisionOf = typeof getLibraryRevision === 'function' ? getLibraryRevision : () => 0
  const LYRIC_EXPORT_EXT = { lrc: 'lrc', vtt: 'vtt', ttml: 'ttml', qrc: 'qrc', yrc: 'yrc', krc: 'krc' }
  /** A lyric record key as a file name: the local song's name, or provider-id for online. */
  function lyricExportName(key) {
    const raw = String(key)
    const name = raw.startsWith('online:')
      ? raw.split(':').slice(1).join('-')
      : basename(raw, extname(raw))
    const safe = name.replace(/[\\/:*?"<>|]/g, '_').trim()
    return safe === '' ? 'lyrics' : safe.slice(0, 120)
  }
  // The per-song lyric record (choice, matched lyric, instrumental mark). Routes stay
  // usable without one — a test or an older wiring simply never remembers anything.
  const lyricRecords = lyricState === undefined || lyricState === null
    ? {
        get: async () => null,
        readPayload: async () => null,
        writePayload: async () => null,
        patch: async () => null,
      }
    : lyricState
  const localLyricMatcher = createLocalLyricMatcher({
    lyricState: lyricRecords,
    omni: lyricOmni ?? omni,
    providerStore,
  })
  const lyricPriorityOf = (params) => (String(params.get('priority') || '') === 'online' ? 'online' : 'local')
  const lyricFormatOrderOf = (params) => {
    const raw = String(params.get('formatOrder') || '').trim()
    return raw === '' ? undefined : raw.split(',').map((format) => format.trim()).filter(Boolean)
  }
  const lyricPreferredOf = (params) => {
    const preferred = String(params.get('preferred') || '').trim()
    return preferred === '' ? undefined : preferred
  }
  /** The resolved lyric plus the flags the player's source switcher needs. */
  async function localLyricPayload(file, options = {}) {
    const priority = options.priority === 'online' ? 'online' : 'local'
    const state = await lyricRecords.get(file)
    const resolved = await resolveLocalLyrics(file, {
      lyricState: lyricRecords,
      priority,
      formatOrder: options.formatOrder,
    })
    const autoMatch = needsAutoMatch({
      state,
      hasSidecar: resolved.available.sidecar,
      hasEmbedded: resolved.available.embedded,
      priority,
    })
    const offsetMs = stats !== undefined ? (await stats.get(file))?.lyricOffsetMs ?? 0 : 0
    return {
      ok: true,
      lines: resolved.lines,
      timed: resolved.timed,
      source: resolved.source,
      file: resolved.file,
      offsetMs,
      // Folia's raw shape for the client's own parser: the very text the source holds
      // (LRC / enhanced LRC / TTML / VTT / QRC / YRC / KRC / .fia), plus a format hint
      // for the formats that cannot be detected from the text alone.
      raw: resolved.raw ?? '',
      translation: resolved.translation ?? '',
      formatHint: resolved.formatHint ?? '',
      pureMusic: resolved.pureMusic === true,
      matched: resolved.matched ?? null,
      explicitSource: state?.source ?? null,
      markedPureMusic: state?.markedPureMusic === true,
      noAutoMatch: state?.noAutoMatch === true,
      needsAutoMatch: autoMatch,
    }
  }

  const trash = createTrash({
    dir: join(settings.dir || settings.home || '.', 'trash'),
    getRoots: async () => (await settings.read()).roots,
  })
  const vipCache = new Map()
  const profileCache = new Map()
  function invalidateProviderCaches(provider) {
    profileCache.delete(provider)
    vipCache.delete(provider)
  }
  async function profileState(provider) {
    const cached = profileCache.get(provider)
    if (cached && Date.now() - cached.at < 5 * 60 * 1000) return cached.profile
    let profile = null
    try {
      const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
      const session = providerStore === undefined ? {} : await providerStore.session(provider)
      profile = await providers.providerProfile(provider, cookie, session)
    } catch (error) {
      if (kugouSessions !== undefined) await kugouSessions.markExpiredFromError(provider, error)
      profile = null
    }
    profileCache.set(provider, { at: Date.now(), profile })
    return profile
  }
  async function vipInfoState(provider) {
    const cached = vipCache.get(provider)
    if (cached && Date.now() - cached.at < 5 * 60 * 1000) return cached
    let info = { vip: null, expiresAt: '' }
    try {
      const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
      const session = providerStore === undefined ? {} : await providerStore.session(provider)
      info = await providers.providerVipInfo(provider, cookie, session)
    } catch (error) {
      if (kugouSessions !== undefined) await kugouSessions.markExpiredFromError(provider, error)
      info = { vip: null, expiresAt: '' }
    }
    const row = { at: Date.now(), vip: info.vip, expiresAt: info.expiresAt || '' }
    vipCache.set(provider, row)
    return row
  }
  async function vipState(provider) {
    return (await vipInfoState(provider)).vip
  }
  const online = createOnlineRoutes({
    settings,
    providerStore,
    accountStore,
    accountReads,
    mediaCache,
    kugouSessions,
    lyricState: lyricRecords,
    profileState,
    vipInfoState,
    vipState,
    invalidateProviderCaches,
  })
  // The "匹配歌词" window: candidates scored exactly like the automatic pick.
  const lyricMatch = createLyricMatchService({ omni, providerStore })
  return async function handle(req, res) {
    try {
      if (!isLoopback(req)) return fail(res, 403, 'NOT_LOOPBACK', '仅允许本机访问（远程访问已禁用音乐面板）')
      if (!isSameOrigin(req)) return fail(res, 403, 'BAD_ORIGIN', '跨站请求被拒绝')

      const url = new URL(req.url ?? '/', 'http://localhost')
      const pathname = url.pathname.startsWith(PREFIX) ? url.pathname.slice(PREFIX.length) || '/' : url.pathname
      const method = (req.method ?? 'GET').toUpperCase()
      const params = queryOf(req)

      // Model tools enqueue playback actions here; the open panel drains them.
      if (pathname === '/control/pending' && method === 'GET') {
        return sendJson(res, 200, { ok: true, actions: takeControls() })
      }

      // Audio focus: Folia's Windows voice-input pause plus a ducking API other
      // plugins use for TTS / voice previews. Both are local-origin only, like
      // the rest of the /music surface.
      if (pathname === '/audio-focus/status' && method === 'GET') {
        if (audioFocus === undefined || audioFocus === null) {
          return fail(res, 503, 'AUDIO_FOCUS_UNAVAILABLE', '音频焦点服务不可用')
        }
        return sendJson(res, 200, { ok: true, ...audioFocus.status() })
      }
      if (pathname === '/audio-focus/config' && method === 'POST') {
        if (audioFocus === undefined || audioFocus === null) {
          return fail(res, 503, 'AUDIO_FOCUS_UNAVAILABLE', '音频焦点服务不可用')
        }
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        if (body?.voiceInputPause !== undefined && typeof body.voiceInputPause !== 'boolean') {
          return fail(res, 400, 'BAD_REQUEST', 'voiceInputPause 必须是布尔值')
        }
        if (body?.duckLevel !== undefined && !Number.isFinite(Number(body.duckLevel))) {
          return fail(res, 400, 'BAD_REQUEST', 'duckLevel 必须是数字')
        }
        if (body?.duckFadeMs !== undefined && !Number.isFinite(Number(body.duckFadeMs))) {
          return fail(res, 400, 'BAD_REQUEST', 'duckFadeMs 必须是数字')
        }
        return sendJson(res, 200, {
          ok: true,
          ...audioFocus.configure({
            voiceInputPause: body?.voiceInputPause,
            duckLevel: body?.duckLevel,
            duckFadeMs: body?.duckFadeMs,
          }),
        })
      }
      if (pathname === '/audio-focus/duck' && method === 'POST') {
        if (audioFocus === undefined || audioFocus === null) {
          return fail(res, 503, 'AUDIO_FOCUS_UNAVAILABLE', '音频焦点服务不可用')
        }
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const reason = String(body?.reason ?? '').trim()
        if (reason === '') return fail(res, 400, 'BAD_REQUEST', '缺少 reason')
        if (typeof body?.active !== 'boolean') {
          return fail(res, 400, 'BAD_REQUEST', 'active 必须是布尔值')
        }
        const next = body.active
          ? audioFocus.beginDuck({
              reason,
              level: body.level,
              fadeMs: body.fadeMs,
              ttlMs: body.ttlMs,
            })
          : audioFocus.endDuck(reason)
        return sendJson(res, 200, { ok: true, ...next })
      }

      // ── AutoEQ device presets (read-only library) ───────────────────────
      if (pathname === '/eq/presets' && method === 'GET') {
        try {
          const payload = await loadEqPresets()
          const query = (params.get('q') || '').trim()
          const source = (params.get('source') || '').trim()
          const limit = Number(params.get('limit')) || 40
          const offset = Number(params.get('offset')) || 0
          return sendJson(res, 200, {
            ok: true,
            total: payload.presets.length,
            generated: payload.generated,
            bands: payload.bands,
            sources: payload.sources,
            results: searchEqPresets(payload, query, { limit, source, offset }).map(eqPresetRow),
          })
        } catch (error) {
          return fail(res, 500, 'EQ_DATA_MISSING', 'AutoEQ 预设数据不可用，请重新安装插件')
        }
      }

      // Lyric style thumbnails shipped with the plugin. The ids are the
      // renderer ids, so the client asks for exactly the style it draws.
      if (pathname.startsWith('/assets/lyric-style-thumbs/') && method === 'GET') {
        const name = pathname.slice('/assets/lyric-style-thumbs/'.length)
        if (!/^[a-z]+\.webp$/.test(name)) {
          return fail(res, 404, 'NOT_FOUND', '资源不存在')
        }
        try {
          const file = await readFile(fileURLToPath(new URL('../assets/lyric-style-thumbs/' + name, import.meta.url)))
          res.writeHead(200, {
            'content-type': 'image/webp',
            'content-length': file.length,
            'cache-control': 'public, max-age=31536000, immutable',
          })
          res.end(file)
          return
        } catch {
          return fail(res, 404, 'ASSET_MISSING', '歌词样式缩略图缺失，请重新安装插件')
        }
      }

      // icu-folia data (Folia's jieba/HMM tables), gzipped and shipped with the plugin.
      // Served with Content-Encoding so the browser decodes it transparently.
      if (pathname.startsWith('/assets/icu-folia/') && method === 'GET') {
        const name = pathname.slice('/assets/icu-folia/'.length)
        if (name !== 'dict.json.gz' && name !== 'hmm.json.gz') {
          return fail(res, 404, 'NOT_FOUND', '资源不存在')
        }
        try {
          const file = await readFile(fileURLToPath(new URL('../assets/icu-folia/' + name, import.meta.url)))
          res.writeHead(200, {
            'content-type': 'application/json; charset=utf-8',
            'content-encoding': 'gzip',
            'content-length': file.length,
            'cache-control': 'public, max-age=31536000, immutable',
          })
          res.end(file)
          return
        } catch {
          return fail(res, 404, 'ASSET_MISSING', 'icu-folia 数据缺失，请重新安装插件')
        }
      }

      // ── online providers (NetEase / QQ / KuGou) ─────────────────────────

      // The whole /online/* surface lives in ./routes/online.js.
      if (pathname.startsWith('/online/')) {
        await online(req, res, { url, pathname, method, params })
        return
      }

      if (pathname === '/config' && method === 'GET') {
        const config = await settings.read()
        return sendJson(res, 200, {
          ok: true,
          config,
          home: settings.home,
          file: settings.file,
          effectiveCacheDir: cacheDirOf(config),
          defaultCacheDir,
        })
      }

      // Folder browser backing the library picker (read-only directory listing).
      if (pathname === '/browse' && method === 'GET') {
        const requested = (params.get('path') || '').trim()

        // Empty path is a virtual root: list drives so other disks are reachable.
        if (requested === '') {
          const dirs = []
          if (process.platform === 'win32') {
            for (let code = 65; code <= 90; code += 1) {
              const drive = String.fromCharCode(code) + ':\\'
              try {
                await stat(drive)
                dirs.push({ name: drive.slice(0, 2), path: drive })
              } catch {
                // Drive letter not present.
              }
            }
          } else {
            dirs.push({ name: '/', path: '/' })
          }
          return sendJson(res, 200, { ok: true, path: '', parent: null, dirs })
        }

        const target = requested
        if (!isAbsolute(target)) return fail(res, 400, 'BAD_PATH', '需要绝对路径')

        let entries
        try {
          entries = await readdir(target, { withFileTypes: true })
        } catch {
          return fail(res, 404, 'NOT_FOUND', '目录不存在或不可读')
        }

        const dirs = entries
          .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
          .map((entry) => ({ name: entry.name, path: join(target, entry.name) }))
          .sort((left, right) => left.name.localeCompare(right.name))

        const up = dirname(target)
        // A drive root goes back to the virtual root (drive list), not nowhere.
        const parent = up === target ? '' : up
        return sendJson(res, 200, { ok: true, path: target, parent, dirs })
      }

      if (pathname === '/config' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const rawRoots = Array.isArray(body?.roots) ? body.roots : null
        const patch = {}
        let skippedRoots = []
        if (rawRoots !== null) {
          const current = await settings.read()
          const known = new Set(Array.isArray(current.roots) ? current.roots : [])
          const { bad } = await validateRoots(rawRoots)
          // A root that was accepted before may be offline now (external drive, renamed
          // folder). That must not block editing another root; the scanner already warns
          // per missing root. Only a newly added non-folder is rejected.
          const addedMissing = bad.filter((root) => !known.has(root))
          const allowMissing = body?.allowMissingRoots === true
          if (addedMissing.length > 0 && !allowMissing) {
            return sendJson(res, 400, {
              ok: false,
              error: { code: 'BAD_ROOT', message: '目录不存在或不是文件夹' },
              bad: addedMissing,
            })
          }
          const blocked = new Set(addedMissing)
          // A backup imported on another machine can name folders that do not exist yet;
          // with allowMissingRoots they are dropped (and reported) instead of failing the
          // whole restore.
          patch.roots = rawRoots.filter((root) => !blocked.has(root))
          skippedRoots = addedMissing
        }
        // The folder row's visible/hidden switch lives here (normalizeConfig checks it is a
        // subset of roots); it used to be read by the scanner but never written by the route.
        if (Array.isArray(body?.hiddenRoots)) patch.hiddenRoots = body.hiddenRoots
        if (body?.depth !== undefined) patch.depth = body.depth
        if (Array.isArray(body?.extensions)) patch.extensions = body.extensions
        if (typeof body?.onlineQuality === 'string') patch.onlineQuality = body.onlineQuality
        if (body?.cacheDir !== undefined) {
          if (typeof body.cacheDir !== 'string' || (body.cacheDir.trim() !== '' && !isAbsolute(body.cacheDir.trim()))) {
            return fail(res, 400, 'BAD_CACHE_DIR', '缓存目录需要绝对路径')
          }
          patch.cacheDir = body.cacheDir.trim()
          // Prove the target is writable before switching: a directory that cannot be
          // created would make /online/cache fail and the page silently show zeros.
          const cacheTarget = patch.cacheDir === '' ? defaultCacheDir : patch.cacheDir
          try {
            await mkdir(cacheTarget, { recursive: true })
            const probe = join(cacheTarget, '.write-test-' + process.pid + '-' + Date.now())
            await writeFile(probe, '')
            await unlink(probe)
          } catch {
            return fail(res, 400, 'BAD_CACHE_DIR', '缓存目录不可写')
          }
        }
        if (body?.watchFolders !== undefined) patch.watchFolders = body.watchFolders === true
        const config = await settings.write(patch)
        // The cache store and the watchers follow the new settings without a restart.
        if (mediaCache !== undefined && typeof mediaCache.setDir === 'function') mediaCache.setDir(cacheDirOf(config))
        if (watcher !== undefined && typeof watcher.sync === 'function') void watcher.sync()
        return sendJson(res, 200, {
          ok: true,
          config,
          skippedRoots,
          home: settings.home,
          file: settings.file,
          effectiveCacheDir: cacheDirOf(config),
          defaultCacheDir,
        })
      }

      if (pathname === '/library' && (method === 'GET' || method === 'HEAD')) {
        const config = await settings.read()
        const result = await library.scan({ refresh: params.get('refresh') === '1' })
        return sendJson(res, 200, { ok: true, config, ...result })
      }

      // A cheap number the panel polls while 自动扫描已导入文件夹 is on; a change means the
      // watcher finished a rescan and the client should re-read the library.
      if (pathname === '/library/revision' && method === 'GET') {
        return sendJson(res, 200, { ok: true, revision: Number(libraryRevisionOf()) || 0 })
      }

      if (pathname === '/stream' && (method === 'GET' || method === 'HEAD')) {
        const config = await settings.read()
        const file = await resolveTrack(params.get('path'), config.roots)
        if (file === null) return fail(res, 404, 'NOT_FOUND', '文件不在已配置的音乐目录内')
        return await sendStream(req, res, file)
      }

      if (pathname === '/cover' && method === 'GET') {
        const config = await settings.read()
        const file = await resolveTrack(params.get('path'), config.roots)
        if (file === null) return fail(res, 404, 'NOT_FOUND', '文件不在已配置的音乐目录内')
        return await sendCover(res, file)
      }

      // Online lyric lookup (NetEase), then save the chosen LRC next to the track.
      if (pathname === '/lyrics/search' && method === 'GET') {
        const query = (params.get('q') || '').trim()
        if (query === '') return fail(res, 400, 'NO_QUERY', '缺少搜索词')
        try {
          const candidates = await searchLyricCandidates(query)
          return sendJson(res, 200, { ok: true, candidates })
        } catch (error) {
          return fail(
            res,
            502,
            'SEARCH_FAILED',
            error instanceof Error ? error.message : '歌词搜索失败',
          )
        }
      }

      if (pathname === '/lyrics/fetch' && method === 'GET') {
        const id = (params.get('id') || '').trim()
        if (id === '') return fail(res, 400, 'NO_ID', '缺少歌曲 id')
        try {
          const lyric = await fetchLyricById(id)
          return sendJson(res, 200, { ok: true, lrc: lyric.lrc, translation: lyric.translation })
        } catch (error) {
          return fail(
            res,
            502,
            'LYRIC_FAILED',
            error instanceof Error ? error.message : '歌词获取失败',
          )
        }
      }

      if (pathname === '/lyrics/save' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const config = await settings.read()
        const file = await resolveTrack(body?.path, config.roots)
        if (file === null) return fail(res, 404, 'NOT_FOUND', '文件不在已配置的音乐目录内')
        const lrc = typeof body?.lrc === 'string' ? body.lrc : ''
        if (lrc.trim() === '') return fail(res, 400, 'EMPTY', '歌词为空')
        let backup = ''
        try {
          const existing = await readLyricsFor(file)
          const raw = typeof existing?.raw === 'string' && existing.raw.trim() !== '' ? existing.raw : ''
          if (raw !== '') backup = await backupLyrics(file, raw)
        } catch {
          backup = ''
        }
        try {
          const target = await writeEmbeddedLyrics(file, lrc)
          return sendJson(res, 200, { ok: true, target, backup })
        } catch (error) {
          const code =
            error !== null && typeof error === 'object' && typeof error.code === 'string'
              ? error.code
              : 'WRITE_FAILED'
          return fail(res, 500, code, String(error?.message ?? error))
        }
      }

      // Diagnostic reports from the client's lyric pipeline (in memory, last 40).
      // Used to see what the running browser actually received.
      if (pathname === '/debug/report' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        debugReports.push({ at: Date.now(), report: body })
        while (debugReports.length > 40) debugReports.shift()
        return sendJson(res, 200, { ok: true })
      }

      if (pathname === '/debug/report' && method === 'GET') {
        return sendJson(res, 200, { ok: true, reports: debugReports })
      }

      if (pathname === '/lyrics' && method === 'GET') {
        const config = await settings.read()
        const file = await resolveTrack(params.get('path'), config.roots)
        if (file === null) return fail(res, 404, 'NOT_FOUND', '文件不在已配置的音乐目录内')
        return sendJson(res, 200, await localLyricPayload(file, { priority: lyricPriorityOf(params), formatOrder: lyricFormatOrderOf(params) }))
      }

      // Folia's `matchLyrics` for one local file: ask the lyric sources, keep the record.
      // The player calls this when the resolved lyric says `needsAutoMatch`.
      if (pathname === '/lyrics/auto' && method === 'GET') {
        const config = await settings.read()
        const file = await resolveTrack(params.get('path'), config.roots)
        if (file === null) return fail(res, 404, 'NOT_FOUND', '文件不在已配置的音乐目录内')
        const state = await lyricRecords.get(file)
        if (params.get('force') !== '1' && state?.noAutoMatch === true) {
          return sendJson(res, 200, { ok: true, matched: state?.matched ?? null, pureMusic: state?.pureMusic === true, skipped: true })
        }
        const result = await localLyricMatcher.match(file, { state, preferred: lyricPreferredOf(params) })
        return sendJson(res, 200, { ok: true, ...result })
      }

      // The source switcher: Folia's `lyricsSource` on the song's record.
      if (pathname === '/lyrics/choice' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const config = await settings.read()
        const file = await resolveTrack(body?.path, config.roots)
        if (file === null) return fail(res, 404, 'NOT_FOUND', '文件不在已配置的音乐目录内')
        const requested = body?.source === null || body?.source === undefined || body?.source === 'auto'
          ? null
          : String(body.source)
        if (requested !== null && !['local', 'embedded', 'online', 'imported'].includes(requested)) {
          return fail(res, 400, 'BAD_SOURCE', '未知的歌词来源')
        }
        const state = await lyricRecords.get(file)
        // Choosing the online lyric with none on the record asks for one, the way Folia's
        // online choice resumes matching instead of showing nothing.
        if (requested === 'online' && (state === null || (state.matched === null && state.pureMusic !== true))) {
          await localLyricMatcher.match(file, { state, preferred: lyricPreferredOf(new URLSearchParams()) })
        }
        await lyricRecords.patch(file, { source: requested })
        return sendJson(res, 200, await localLyricPayload(file, {
          priority: lyricPriorityOf(params),
          formatOrder: lyricFormatOrderOf(params),
        }))
      }

      if (pathname === '/lyrics/pure-music' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const config = await settings.read()
        const file = await resolveTrack(body?.path, config.roots)
        if (file === null) return fail(res, 404, 'NOT_FOUND', '文件不在已配置的音乐目录内')
        // Folia's `setLocalSongPureMusicMark`: the mark is stored as a matched pure-music
        // verdict pinned to the online source, so neither the priority nor a stale match
        // can put lyrics back on screen. Removing it returns the song to automatic.
        if (body?.marked === true) {
          await lyricRecords.clearPayload?.(file)
          await lyricRecords.patch(file, {
            markedPureMusic: true,
            pureMusic: true,
            source: 'online',
            matched: null,
          })
        } else {
          await lyricRecords.patch(file, {
            markedPureMusic: false,
            pureMusic: false,
            source: null,
            matched: null,
          })
        }
        return sendJson(res, 200, await localLyricPayload(file, { priority: lyricPriorityOf(params), formatOrder: lyricFormatOrderOf(params) }))
      }

      // Folia's `applyLocalSongMatchSelection`: the manually picked result can bring the
      // lyrics, the metadata and the cover, and the listener chooses which of the three.
      // Lyrics go onto the song's record; metadata and the cover are written into the
      // file's tags (the plugin's own way of owning them).
      if (pathname === '/lyrics/match-apply' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const config = await settings.read()
        // Online songs have no file to retag: the pick lands on the song's lyric record
        // (the same `online:<provider>:<id>` key the lyric route reads).
        const onlineKey =
          typeof body?.path === 'string' && body.path.startsWith('online:') ? body.path : ''
        const file = onlineKey === '' ? await resolveTrack(body?.path, config.roots) : null
        if (onlineKey === '' && file === null) {
          return fail(res, 404, 'NOT_FOUND', '文件不在已配置的音乐目录内')
        }
        const applyLyrics = body?.applyLyrics !== false
        const applyMetadata = body?.applyMetadata === true
        const applyCover = body?.applyCover === true
        const noAutoMatch = body?.noAutoMatch === true
        const lrc = typeof body?.lrc === 'string' ? body.lrc : ''
        const provider = String(body?.provider ?? '')
        const songId = String(body?.id ?? '')
        const recordKey = onlineKey !== '' ? onlineKey : file
        let lyricsApplied = false
        let lyricsEmbedded = false
        let embedWarning = ''
        if (noAutoMatch) {
          await lyricRecords.patch(recordKey, { noAutoMatch: true })
        } else if (applyLyrics && lrc.trim() !== '') {
          await lyricRecords.writePayload(recordKey, { text: lrc, formatHint: '' })
          await lyricRecords.patch(recordKey, {
            matched: {
              source: provider || 'local',
              id: songId,
              title: String(body?.title ?? ''),
              artist: String(body?.artist ?? ''),
              album: String(body?.album ?? ''),
              coverUrl: String(body?.coverUrl ?? ''),
              score: Number(body?.score) || 0,
              wordLevel: body?.wordLevel === true,
              at: Date.now(),
            },
            source: 'online',
            pureMusic: false,
            markedPureMusic: false,
            imported: null,
            noAutoMatch: false,
          })
          lyricsApplied = true
        }
        if (onlineKey !== '') {
          // Nothing to write into tags for an online song.
          return sendJson(res, 200, {
            ok: true,
            lyricsApplied,
            lyricsEmbedded: false,
            metadataApplied: false,
            coverApplied: false,
            noAutoMatch,
          })
        }
        if (body?.embedTags === true && applyLyrics && lrc.trim() !== '') {
          const embeddedLrc = typeof body?.embeddedLrc === 'string' && body.embeddedLrc.trim() !== ''
            ? body.embeddedLrc
            : lrc
          try {
            const existing = await readLyricsFor(file)
            const raw = typeof existing?.raw === 'string' && existing.raw.trim() !== '' ? existing.raw : ''
            if (raw !== '') await backupLyrics(file, raw)
            await writeEmbeddedLyrics(file, embeddedLrc)
            // The file is now the authoritative local lyric; stop resolving to the
            // online record on the next play.
            await lyricRecords.patch(recordKey, { source: 'embedded' }).catch(() => {})
            lyricsEmbedded = true
          } catch (error) {
            embedWarning = error instanceof Error ? error.message : String(error)
          }
        }
        let metadataApplied = false
        let coverApplied = false
        let warning = embedWarning
        if (applyMetadata || applyCover) {
          try {
            // The tag writer rewrites the whole editable set, so the file's own values are
            // read first and only the chosen fields are replaced.
            const existing = await readTags(file)
            const tags = { ...existing.tags }
            if (applyMetadata) {
              if (String(body?.title ?? '') !== '') tags.title = String(body.title)
              if (String(body?.artist ?? '') !== '') tags.artist = String(body.artist)
              if (String(body?.album ?? '') !== '') tags.album = String(body.album)
            }
            const coverUrl = applyCover && typeof body?.coverUrl === 'string' ? body.coverUrl : ''
            await writeTags(file, tags, coverUrl)
            metadataApplied = applyMetadata
            coverApplied = coverUrl !== ''
          } catch (error) {
            // An unsupported container keeps the lyrics: say what was skipped.
            warning = warning === ''
              ? (error instanceof Error ? error.message : String(error))
              : warning + '；' + (error instanceof Error ? error.message : String(error))
          }
        }
        return sendJson(res, 200, {
          ok: true,
          lyricsApplied,
          lyricsEmbedded,
          metadataApplied,
          coverApplied,
          noAutoMatch,
          ...(warning === '' ? {} : { warning }),
        })
      }

      if (pathname === '/lyrics/no-auto-match' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const config = await settings.read()
        const file = await resolveTrack(body?.path, config.roots)
        if (file === null) return fail(res, 404, 'NOT_FOUND', '文件不在已配置的音乐目录内')
        await lyricRecords.patch(file, { noAutoMatch: body?.on === true })
        return sendJson(res, 200, await localLyricPayload(file, { priority: lyricPriorityOf(params), formatOrder: lyricFormatOrderOf(params) }))
      }

      // Imported lyrics live on the record (Folia's `localLyricsContent`), not in the file:
      // every audio format can take one, and a rescan does not lose it.
      if (pathname === '/lyrics/import' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const config = await settings.read()
        const file = await resolveTrack(body?.path, config.roots)
        if (file === null) return fail(res, 404, 'NOT_FOUND', '文件不在已配置的音乐目录内')
        const text = typeof body?.text === 'string' ? body.text : ''
        if (text.trim() === '') return fail(res, 400, 'EMPTY', '歌词为空')
        const name = typeof body?.name === 'string' ? body.name : ''
        const payload = await lyricRecords.writePayload(file, {
          text,
          formatHint: lyricFormatHintForName(name),
        })
        if (payload === null) return fail(res, 400, 'EMPTY', '歌词为空')
        await lyricRecords.patch(file, { imported: { name, at: Date.now() }, source: 'local', markedPureMusic: false })
        return sendJson(res, 200, await localLyricPayload(file, { priority: lyricPriorityOf(params), formatOrder: lyricFormatOrderOf(params) }))
      }

      if (pathname === '/lyrics/calibrate' && method === 'POST') {
        if (stats === undefined) return fail(res, 503, 'UNAVAILABLE', '统计未启用')
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const config = await settings.read()
        const file = await resolveTrack(body?.path, config.roots)
        if (file === null) return fail(res, 404, 'NOT_FOUND', '文件不在已配置的音乐目录内')
        const offsetMs = Math.max(-60_000, Math.min(60_000, Math.round(Number(body?.offsetMs) || 0)))

        if (body?.write === true) {
          const lyrics = await readLyricsFor(file)
          if (lyrics.lines.length === 0) {
            // A TTML / VTT / KRC sidecar has lyrics but no LRC timeline to shift: say that
            // instead of claiming the track has none.
            return (lyrics.raw ?? '') === ''
              ? fail(res, 404, 'NO_LYRICS', '没有可写回的歌词')
              : fail(res, 400, 'UNSUPPORTED_FORMAT', '该歌词格式不能写回偏移')
          }
          const raw = typeof lyrics.raw === 'string' && lyrics.raw.trim() !== '' ? lyrics.raw : serializeLrc(lyrics.lines)
          const shifted = shiftLrc(raw, offsetMs)
          const backup = await backupLyrics(file, raw)
          try {
            const target = await writeEmbeddedLyrics(file, shifted)
            const entry = await stats.setLyricOffset(file, 0)
            return sendJson(res, 200, { ok: true, target, backup, offsetMs: entry.lyricOffsetMs })
          } catch (error) {
            const code = error !== null && typeof error === 'object' && typeof error.code === 'string'
              ? error.code
              : 'WRITE_FAILED'
            return fail(res, 500, code, String(error?.message ?? error))
          }
        }

        const entry = await stats.setLyricOffset(file, offsetMs)
        return sendJson(res, 200, { ok: true, offsetMs: entry.lyricOffsetMs })
      }

      if (pathname === '/favorites' && method === 'GET') {
        const list = favorites === undefined ? [] : await favorites.list()
        return sendJson(res, 200, { ok: true, favorites: list })
      }

      if (pathname === '/favorites' && method === 'POST') {
        if (favorites === undefined) return fail(res, 503, 'UNAVAILABLE', '收藏未启用')
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const config = await settings.read()
        const file = await resolveTrack(body?.path, config.roots)
        if (file === null) return fail(res, 404, 'NOT_FOUND', '文件不在已配置的音乐目录内')
        const result = await favorites.toggle(file)
        return sendJson(res, 200, { ok: true, favorite: result.favorite, favorites: result.favorites })
      }

      // Reveal a track in the OS file manager. Only files already inside the
      // configured roots reach this point; args are passed to spawn without a
      // shell, so the path cannot inject commands.
      // Move files into the plugin trash instead of deleting them, so duplicate
      // cleanup stays recoverable.
      if (pathname === '/remove' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const config = await settings.read()
        const list = Array.isArray(body?.paths) ? body.paths : []
        if (list.length === 0) return fail(res, 400, 'NO_PATHS', '没有要删除的文件')
        const moved = []
        const failed = []
        for (const raw of list) {
          if (typeof raw !== 'string') continue
          const file = await resolveTrack(raw, config.roots)
          if (file === null) {
            failed.push({ path: raw, error: '不在音乐目录内' })
            continue
          }
          let info
          try {
            info = await stat(file)
          } catch {
            failed.push({ path: raw, error: '文件不存在' })
            continue
          }
          if (!info.isFile()) {
            failed.push({ path: raw, error: '不是文件' })
            continue
          }
          try {
            await trash.moveIn(file, raw)
            moved.push(raw)
          } catch (error) {
            failed.push({
              path: raw,
              error: error instanceof Error ? error.message : '移动失败',
            })
          }
        }
        return sendJson(res, 200, { ok: true, moved, failed, trash: trash.dir })
      }

      if (pathname === '/trash' && method === 'GET') {
        try {
          return sendJson(res, 200, { ok: true, entries: await trash.list() })
        } catch (error) {
          return fail(res, 500, 'TRASH_FAILED', String(error?.message ?? error))
        }
      }

      if (pathname === '/trash/restore' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        try {
          const result = await trash.restore(typeof body?.id === 'string' ? body.id : '')
          return sendJson(res, 200, { ok: true, path: result.path })
        } catch (error) {
          const code = error?.code === 'BAD_ID' ? 400 : error?.code === 'NOT_FOUND' ? 404 : error?.code === 'NO_PATH' ? 409 : 500
          return fail(res, code, String(error?.code ?? 'RESTORE_FAILED'), String(error?.message ?? error))
        }
      }

      if (pathname === '/data' && method === 'GET') {
        try {
          return sendJson(res, 200, { ok: true, ...(await inspectData(settings.dir)) })
        } catch (error) {
          return fail(res, 500, 'DATA_FAILED', String(error?.message ?? error))
        }
      }

      if (pathname === '/data/clear' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const category = typeof body?.category === 'string' ? body.category : ''
        if (category !== '') {
          if (!CLEARABLE_CATEGORIES.includes(category)) {
            return fail(res, 400, 'BAD_CATEGORY', '该类别不能单独清空')
          }
          const config = await settings.read()
          try {
            const cleared = await clearDataCategory(settings.dir, category, Array.isArray(config.roots) ? config.roots : [])
            // Every store memoizes its file; clearing the files must also drop the memory copy,
            // or the next write puts the whole old payload back (and a restart reads the .bak).
            const forget = {
              favorites: favorites,
              playlists: playlists,
              stats: stats,
              playback: playback,
              lyrics: lyricRecords,
            }[category]
            if (forget !== undefined && forget !== null && typeof forget.invalidate === 'function') forget.invalidate()
            return sendJson(res, 200, { ok: true, ...cleared, category })
          } catch (error) {
            return fail(res, 500, 'CLEAR_FAILED', String(error?.message ?? error))
          }
        }
        if (body?.confirm !== 'clear-all') {
          return fail(res, 400, 'CONFIRM_REQUIRED', '缺少清空确认')
        }
        if (typeof resetData !== 'function') {
          return fail(res, 503, 'RESET_UNAVAILABLE', '数据重置不可用')
        }
        try {
          const config = await settings.read()
          const cleared = await clearData(settings.dir, Array.isArray(config.roots) ? config.roots : [])
          await resetData()
          return sendJson(res, 200, { ok: true, ...cleared })
        } catch (error) {
          return fail(res, 500, 'RESET_FAILED', String(error?.message ?? error))
        }
      }

      // Folia's 批量导出歌词: every cached lyric text as a file under <data>/exports/.
      if (pathname === '/data/export-lyrics' && method === 'POST') {
        try {
          const keys = typeof lyricRecords.listKeys === 'function' ? await lyricRecords.listKeys() : []
          const stamp = new Date().toISOString().slice(0, 19).replace(/[:]/g, '').replace('T', '-')
          const dir = join(settings.dir, 'exports', 'lyrics-' + stamp)
          const used = new Set()
          let count = 0
          for (const key of keys) {
            if (typeof lyricRecords.readPayload !== 'function') break
            const payload = await lyricRecords.readPayload(key)
            if (payload === null || typeof payload.text !== 'string' || payload.text.trim() === '') continue
            const ext = LYRIC_EXPORT_EXT[payload.formatHint] || 'lrc'
            const base = lyricExportName(key)
            let name = base + '.' + ext
            let copy = 2
            while (used.has(name.toLowerCase())) {
              name = base + ' (' + String(copy) + ').' + ext
              copy += 1
            }
            used.add(name.toLowerCase())
            await mkdir(dir, { recursive: true })
            await writeFile(join(dir, name), payload.text, 'utf8')
            count += 1
          }
          if (count === 0) {
            await rm(dir, { recursive: true, force: true }).catch(() => {})
            return sendJson(res, 200, { ok: true, dir: null, count: 0 })
          }
          return sendJson(res, 200, { ok: true, dir, count })
        } catch (error) {
          return fail(res, 500, 'EXPORT_FAILED', String(error?.message ?? error))
        }
      }

      if (pathname === '/reveal' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const config = await settings.read()
        const file = await resolveTrack(body?.path, config.roots)
        if (file === null) return fail(res, 404, 'NOT_FOUND', '文件不在已配置的音乐目录内')
        try {
          // Explorer parses its command line itself: the reliable form is
          // `/select,"C:\path\file.mp3"` with quotes hugging the comma. Node
          // would re-quote/escape that argument, so pass it verbatim.
          const opener =
            process.platform === 'win32'
              ? { name: 'explorer.exe', args: ['/select,"' + file + '"'], verbatim: true }
              : process.platform === 'darwin'
                ? { name: 'open', args: ['-R', file], verbatim: false }
                : { name: 'xdg-open', args: [dirname(file)], verbatim: false }
          const child = spawn(opener.name, opener.args, {
            detached: true,
            stdio: 'ignore',
            windowsVerbatimArguments: opener.verbatim,
          })
          // Without this listener an ENOENT would surface as an unhandled error.
          child.on('error', () => {})
          child.unref()
          return sendJson(res, 200, { ok: true })
        } catch (error) {
          return fail(res, 500, 'REVEAL_FAILED', String(error?.message ?? error))
        }
      }

      // Open the plugin's own directory (cache or data) in the OS file manager. Only these
      // two locations are addressable: the path never comes from the request.
      if (pathname === '/reveal-dir' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const kind = body?.kind === 'cache'
          ? 'cache'
          : body?.kind === 'data'
            ? 'data'
            : body?.kind === 'exports'
              ? 'exports'
              : ''
        if (kind === '') return fail(res, 400, 'BAD_REQUEST', '未知的目录')
        const config = await settings.read()
        const target = kind === 'cache'
          ? cacheDirOf(config)
          : kind === 'exports'
            ? join(settings.dir, 'exports')
            : settings.dir
        if (kind === 'cache') {
          if (mediaCache !== undefined && typeof mediaCache.ensure === 'function') await mediaCache.ensure()
          else await mkdir(target, { recursive: true })
        } else if (kind === 'exports') {
          await mkdir(target, { recursive: true })
        }
        try {
          const opener =
            process.platform === 'win32'
              ? { name: 'explorer.exe', args: [target] }
              : process.platform === 'darwin'
                ? { name: 'open', args: [target] }
                : { name: 'xdg-open', args: [target] }
          const child = spawn(opener.name, opener.args, { detached: true, stdio: 'ignore' })
          child.on('error', () => {})
          child.unref()
          return sendJson(res, 200, { ok: true, path: target })
        } catch (error) {
          return fail(res, 500, 'REVEAL_FAILED', String(error?.message ?? error))
        }
      }

      // Editable tags: read the full field set, or rewrite it in place.
      if (pathname === '/tags' && method === 'GET') {
        const config = await settings.read()
        const file = await resolveTrack(params.get('path'), config.roots)
        if (file === null) return fail(res, 404, 'NOT_FOUND', '文件不在已配置的音乐目录内')
        try {
          const result = await readTags(file)
          return sendJson(res, 200, { ok: true, format: result.format, tags: result.tags })
        } catch (error) {
          if (error?.code === 'UNSUPPORTED_FORMAT') {
            return fail(res, 400, 'UNSUPPORTED_FORMAT', String(error.message))
          }
          return fail(res, 500, 'TAGS_READ_FAILED', String(error?.message ?? error))
        }
      }
      if (pathname === '/replaygain' && method === 'GET') {
        const config = await settings.read()
        const file = await resolveTrack(params.get('path'), config.roots)
        if (file === null) return fail(res, 404, 'NOT_FOUND', '文件不在已配置的音乐目录内')
        const gain = await readReplayGain(file)
        return sendJson(res, 200, {
          ok: true,
          trackGain: gain.trackGain,
          albumGain: gain.albumGain,
          trackPeak: gain.trackPeak,
          albumPeak: gain.albumPeak,
        })
      }

      // Which lyric sources a file actually has, for the source switcher.
      if (pathname === '/lyrics/sources' && method === 'GET') {
        const config = await settings.read()
        const file = await resolveTrack(params.get('path'), config.roots)
        if (file === null) return fail(res, 404, 'NOT_FOUND', '文件不在已配置的音乐目录内')
        const state = await lyricRecords.get(file)
        const sources = await describeLocalSources(file, state, lyricFormatOrderOf(params))
        const resolved = await resolveLocalLyrics(file, {
          lyricState: lyricRecords,
          priority: lyricPriorityOf(params),
        })
        return sendJson(res, 200, {
          ok: true,
          embedded: sources.embedded,
          local: sources.local,
          online: sources.online,
          active: resolved.source,
          source: state?.source ?? null,
          matchedSource: state?.matched?.source ?? null,
          pureMusic: resolved.pureMusic === true,
          markedPureMusic: state?.markedPureMusic === true,
          noAutoMatch: state?.noAutoMatch === true,
          offsetMs: stats !== undefined ? (await stats.get(file))?.lyricOffsetMs ?? 0 : 0,
        })
      }

      if (pathname === '/tags' && method === 'PUT') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const config = await settings.read()
        const file = await resolveTrack(body?.path, config.roots)
        if (file === null) return fail(res, 404, 'NOT_FOUND', '文件不在已配置的音乐目录内')
        try {
          const result = await writeTags(
            file,
            body?.tags,
            typeof body?.coverUrl === 'string' ? body.coverUrl : '',
          )
          return sendJson(res, 200, { ok: true, format: result.format, tags: result.tags })
        } catch (error) {
          const code = error?.code
          if (
            code === 'UNSUPPORTED_FORMAT' ||
            code === 'INVALID_TAGS' ||
            code === 'INVALID_COVER'
          ) {
            return fail(res, 400, code, String(error.message))
          }
          return fail(res, 500, 'TAGS_WRITE_FAILED', String(error?.message ?? error))
        }
      }

      // Multi-source online metadata lookup (NetEase / QQ / iTunes / MusicBrainz).
      if (pathname === '/lyric-match/sources' && method === 'GET') {
        return sendJson(res, 200, { ok: true, sources: lyricMatch.sources() })
      }

      if (pathname === '/lyric-match/search' && method === 'GET') {
        const source = (params.get('source') || '').trim()
        const query = (params.get('q') || '').trim()
        const target = {
          title: (params.get('title') || '').trim(),
          artist: (params.get('artist') || '').trim(),
          album: (params.get('album') || '').trim(),
          durationMs: Number(params.get('duration')) > 0 ? Number(params.get('duration')) * 1000 : 0,
        }
        const result = await lyricMatch.search({ source, query, target })
        return sendJson(res, 200, { ok: true, ...result })
      }

      if (pathname === '/lyric-match/preview' && method === 'GET') {
        const source = (params.get('source') || '').trim()
        const id = (params.get('id') || '').trim()
        if (source === '' || id === '') return fail(res, 400, 'BAD_REQUEST', '缺少 source / id')
        try {
          const preview = await lyricMatch.preview({ source, id, platform: (params.get('platform') || 'ncm') })
          return sendJson(res, 200, { ok: true, ...preview })
        } catch (error) {
          return fail(res, 502, 'PREVIEW_FAILED', error instanceof Error ? error.message : '歌词预览失败')
        }
      }

      if (pathname === '/online-search' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        try {
          const result = await searchOnline({
            title: typeof body?.title === 'string' ? body.title : '',
            artist: typeof body?.artist === 'string' ? body.artist : '',
            album: typeof body?.album === 'string' ? body.album : '',
          })
          return sendJson(res, 200, { ok: true, results: result.results, sources: result.sources })
        } catch (error) {
          return fail(res, 500, 'ONLINE_SEARCH_FAILED', String(error?.message ?? error))
        }
      }

      if (pathname === '/playlists' && method === 'GET') {
        return sendJson(res, 200, { ok: true, playlists: await playlists.list() })
      }
      if (pathname === '/playlists' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const created = await playlists.create(body?.name)
        if (created === null) return fail(res, 400, 'LIMIT', '播放列表数量已达上限')
        return sendJson(res, 200, { ok: true, playlist: created })
      }

      const playlistMatch = /^\/playlists\/([^/]+)$/.exec(pathname)
      if (playlistMatch !== null) {
        const id = decodeURIComponent(playlistMatch[1])
        if (method === 'PATCH') {
          let body
          try {
            body = await readJson(req)
          } catch {
            return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
          }
          const updated = await playlists.update(id, body !== null && typeof body === 'object' ? body : {})
          if (updated === null) return fail(res, 404, 'NOT_FOUND', '没有这个播放列表')
          return sendJson(res, 200, { ok: true, playlist: updated })
        }
        if (method === 'DELETE') {
          const removed = await playlists.remove(id)
          if (!removed) return fail(res, 404, 'NOT_FOUND', '没有这个播放列表')
          return sendJson(res, 200, { ok: true })
        }
      }

      if (pathname === '/state' && method === 'GET') {
        const state = playback === undefined ? null : await playback.read()
        return sendJson(res, 200, { ok: true, state })
      }

      if (pathname === '/state' && method === 'POST') {
        if (playback === undefined) return fail(res, 503, 'UNAVAILABLE', '播放状态持久化未启用')
        let body
        try {
          // A full 500-track queue with online metadata is larger than the
          // tiny config-body cap used by the other routes.
          body = await readJson(req, 1024 * 1024)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const state = await playback.write(body)
        if (state === null) return fail(res, 400, 'BAD_STATE', '播放状态格式不正确')
        return sendJson(res, 200, { ok: true, state })
      }

      if (pathname === '/playback' && method === 'POST') {
        if (stats === undefined) return fail(res, 503, 'UNAVAILABLE', '统计未启用')
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const config = await settings.read()
        const file = await resolveTrack(body?.path, config.roots)
        if (file === null) return fail(res, 404, 'NOT_FOUND', '文件不在已配置的音乐目录内')
        const seconds = Number(body?.seconds)
        if (!Number.isFinite(seconds) || seconds <= 0) {
          return fail(res, 400, 'BAD_SECONDS', 'seconds 必须是正数')
        }
        const entry = await stats.addPlayTime(file, seconds)
        if (entry === null) return fail(res, 400, 'BAD_SECONDS', 'seconds 必须是正数')
        if (body?.positionSec !== undefined) {
          await stats.setPosition(file, body.positionSec)
        }
        return sendJson(res, 200, {
          ok: true,
          path: file,
          playSeconds: entry.playSeconds,
          plays: entry.plays,
        })
      }

      if (pathname === '/position' && method === 'GET') {
        if (stats === undefined) return sendJson(res, 200, { ok: true, lastPositionSec: null })
        const config = await settings.read()
        const file = await resolveTrack(params.get('path'), config.roots)
        if (file === null) return fail(res, 404, 'NOT_FOUND', '文件不在已配置的音乐目录内')
        const entry = await stats.get(file)
        return sendJson(res, 200, { ok: true, path: file, lastPositionSec: entry === null ? null : entry.lastPositionSec })
      }

      if (pathname === '/position' && method === 'POST') {
        if (stats === undefined) return fail(res, 503, 'UNAVAILABLE', '统计未启用')
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const config = await settings.read()
        const file = await resolveTrack(body?.path, config.roots)
        if (file === null) return fail(res, 404, 'NOT_FOUND', '文件不在已配置的音乐目录内')
        const entry = await stats.setPosition(file, body?.seconds)
        if (entry === null) return fail(res, 400, 'BAD_POSITION', 'seconds 必须是非负数')
        return sendJson(res, 200, { ok: true, path: file, lastPositionSec: entry.lastPositionSec })
      }

      if (pathname === '/stats' && method === 'GET') {
        if (stats === undefined || typeof stats.summarize !== 'function') {
          return sendJson(res, 200, { ok: true, range: 'all', tracks: {} })
        }
        const requested = String(params.get('range') || 'all')
        const range = requested === 'week' || requested === 'month' ? requested : 'all'
        return sendJson(res, 200, { ok: true, range, tracks: await stats.summarize(range) })
      }

      if (pathname === '/play' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const config = await settings.read()
        const file = await resolveTrack(body?.path, config.roots)
        if (file === null) return fail(res, 404, 'NOT_FOUND', '文件不在已配置的音乐目录内')
        const entry = await stats.recordPlay(file)
        return sendJson(res, 200, { ok: true, plays: entry.plays })
      }

      return fail(res, 404, 'NO_ROUTE', `未知接口：${method} ${pathname}`)
    } catch (error) {
      // A request that raced the app quitting may already have a destroyed socket; a
      // failed 500 write must not turn into an unhandled rejection that stops the Host.
      try {
        return fail(res, 500, 'INTERNAL', String(error?.message ?? error))
      } catch {
        try {
          res.destroy()
        } catch {
          // The socket is gone already.
        }
        return
      }
    }
  }
}




