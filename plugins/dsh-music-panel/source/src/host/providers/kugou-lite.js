import crypto from 'node:crypto'
/**
 * KuGou Concept Edition ("lite") client.
 *
 * The concept app uses a different appid (3116), clientver (11440), signature
 * salt and token namespace from the standard KuGou Music client (1005/20489).
 * A standard-edition login must never be reused for concept playback.
 */

import { createDeviceIdentity, normalizePackageSong, signWeb } from './kugou.js'
import { callKugou } from '../services/kugou-api.js'
import { kugouCookies } from './kugou-cookie.js'

const APPID = 3116
const CLIENTVER = 11440
const AND_SALT = 'LnT6xpN3khm36zse0QzvmgTZ3waWdRSA'
const TRACK_KEY_SALT = '185672dd44712f60bb1736df5a377e82'
const SRCAPPID = 2919
const QR_APPID_CREATE = '1001'
const UA_ANDROID = 'Android15-1070-11440-46-0-DiscoveryDRADProtocol-wifi'
const UA_WEB = 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Mobile Safari/537.36'
const GATEWAY_HEADERS = (session, clienttime) => ({
  'User-Agent': UA_ANDROID,
  dfid: session.dfid || '-',
  mid: session.mid,
  clienttime,
  'kg-rc': '1',
  'kg-thash': '5d816a0',
  'kg-rec': '1',
  'kg-rf': 'B9EDA08A64250DEFFBCADDEE00F8F25F',
})

function md5Hex(value) {
  return crypto.createHash('md5').update(String(value || ''), 'utf8').digest('hex')
}

async function fetchJson(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    const text = await response.text()
    let json = null
    try {
      json = text === '' ? null : JSON.parse(text)
    } catch {
      json = null
    }
    return { response, json, text }
  } finally {
    clearTimeout(timer)
  }
}

function normSession(session = {}) {
  return {
    ...session,
    mid: String(session.mid || ''),
    dfid: String(session.dfid || ''),
    token: String(session.token || ''),
    userid: String(session.userid || ''),
    platform: 'lite',
  }
}

function signParams(params, body = '') {
  const ordered = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('')
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  return md5Hex(`${AND_SALT}${ordered}${text}${AND_SALT}`)
}

function signTrackKey(hash, session) {
  return md5Hex(`${String(hash || '').toLowerCase()}${TRACK_KEY_SALT}${APPID}${session.mid}${Number(session.userid) || 0}`)
}

async function liteRequest(path, params = {}, session = {}, options = {}) {
  const s = normSession(session)
  if (!s.mid) throw new Error('酷狗概念版 session 缺少设备标识')
  const clienttime = String(Math.floor(Date.now() / 1000))
  const bodyText = options.body === undefined ? '' : JSON.stringify(options.body)
  const merged = {
    dfid: s.dfid || '-',
    mid: s.mid,
    uuid: '-',
    appid: APPID,
    clientver: CLIENTVER,
    clienttime,
    ...(s.token ? { token: s.token } : {}),
    ...(s.userid && s.userid !== '0' ? { userid: s.userid } : {}),
    ...params,
  }
  const q = new URLSearchParams({ ...merged, signature: signParams(merged, bodyText) })
  const base = options.baseUrl || 'https://gateway.kugou.com'
  const res = await fetchJson(`${base}${path}?${q.toString()}`, {
    method: options.method || 'GET',
    headers: {
      ...GATEWAY_HEADERS(s, merged.clienttime),
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
    },
    ...(options.body === undefined ? {} : { body: bodyText }),
  })
  if (!res.response.ok) throw new Error('酷狗概念版请求失败：HTTP ' + res.response.status)
  if (!res.json) throw new Error('酷狗概念版返回了无法解析的数据')
  const errorCode = Number(res.json.error_code || 0)
  if (Number(res.json.status) === 0 || errorCode !== 0) {
    const code = res.json.error_code || res.json.errcode || res.json.code || res.json.status
    const message = res.json.error_msg || res.json.msg || res.json.error || res.json.message || '酷狗概念版请求失败'
    throw new Error((options.label ? '[' + options.label + '] ' : '') + String(message) + (code !== undefined ? '（code=' + code + '）' : ''))
  }
  return res.json
}

export async function createQRLogin(device = {}) {
  const dev = device.mid ? device : createDeviceIdentity()
  const params = {
    appid: QR_APPID_CREATE,
    type: '1',
    plat: '4',
    qrcode_txt: `https://h5.kugou.com/apps/loginQRCode/html/index.html?appid=${APPID}&`,
    srcappid: String(SRCAPPID),
    dfid: dev.dfid || '-',
    mid: dev.mid,
    uuid: '-',
    clienttime: String(Math.floor(Date.now() / 1000)),
    clientver: String(CLIENTVER),
  }
  const q = new URLSearchParams({ ...params, signature: signWeb(params) })
  const { json: data } = await fetchJson(`https://login-user.kugou.com/v2/qrcode?${q.toString()}`, {
    headers: { 'User-Agent': UA_WEB },
  })
  const key = data && data.data && data.data.qrcode
  if (!key) throw new Error('酷狗概念版二维码获取失败')
  return {
    source: 'kugouLite',
    key: String(key),
    imageDataUrl: data.data.qrcode_img && String(data.data.qrcode_img).startsWith('data:image')
      ? String(data.data.qrcode_img)
      : '',
    url: `https://h5.kugou.com/apps/loginQRCode/html/index.html?qrcode=${encodeURIComponent(key)}`,
    extra: { device: { guid: dev.guid, mid: dev.mid, dfid: dev.dfid } },
  }
}

export async function checkQRLogin(key, device = {}) {
  const dev = device.mid ? device : createDeviceIdentity()
  const params = {
    plat: '4',
    appid: String(APPID),
    srcappid: String(SRCAPPID),
    qrcode: String(key),
    dev: device.dev || '',
    dfid: dev.dfid || '-',
    mid: dev.mid,
    uuid: '-',
    clienttime: String(Math.floor(Date.now() / 1000)),
    clientver: String(CLIENTVER),
  }
  const q = new URLSearchParams({ ...params, signature: signWeb(params) })
  const { json: data } = await fetchJson(`https://login-user.kugou.com/v2/get_userinfo_qrcode?${q.toString()}`, {
    headers: { 'User-Agent': UA_WEB },
  })
  const statusCode = Number(data && data.data && data.data.status)
  const status = { 0: 'expired', 1: 'waiting', 2: 'scanned', 4: 'success' }[statusCode] || 'failed'
  const result = {
    source: 'kugouLite',
    key: `key=${encodeURIComponent(key)}`,
    status,
    message: { expired: '二维码已过期', waiting: '等待扫码中', scanned: '已扫码，请在酷狗概念版中确认', success: '登录成功' }[status] || '状态未知',
    extra: { code: statusCode },
  }
  if (status === 'success' && data.data && data.data.token) {
    result.tokenInfo = {
      token: String(data.data.token),
      userid: String(data.data.userid || ''),
      vip_type: String(data.data.vip_type || ''),
      vip_token: String(data.data.vip_token || ''),
      nickname: String(data.data.nickname || data.data.nick_name || ''),
      avatarUrl: String(data.data.pic || data.data.avatar || data.data.headimg || ''),
    }
  }
  return result
}

function flattenObjects(root) {
  const out = []
  const visit = (value) => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item)
    } else if (value && typeof value === 'object') {
      out.push(value)
      for (const key of Object.keys(value)) visit(value[key])
    }
  }
  visit(root)
  return out
}

function firstNumber(objects, keys) {
  for (const item of objects) {
    for (const key of keys) {
      const raw = item[key]
      if (raw !== undefined && raw !== null && raw !== '') {
        const value = Number(raw)
        if (Number.isFinite(value)) return value
      }
    }
  }
  return 0
}

function firstString(objects, keys) {
  for (const item of objects) {
    for (const key of keys) {
      const raw = item[key]
      if (typeof raw === 'string' && raw.trim() !== '') return raw.trim()
      if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return String(raw)
    }
  }
  return ''
}

function firstBoolean(objects, keys) {
  for (const item of objects) {
    for (const key of keys) {
      const raw = item[key]
      if (raw === true || raw === 1 || raw === '1' || raw === 'true') return true
    }
  }
  return false
}

/** Concept membership status, including concept-vs-super VIP. */
function vipTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value > 1e12 ? value : value * 1000
  const text = String(value || '').trim()
  if (text === '') return 0
  if (/^\d+$/.test(text)) {
    const number = Number(text)
    return number > 1e12 ? number : number * 1000
  }
  const parsed = Date.parse(text.replace(' ', 'T') + '+08:00')
  return Number.isFinite(parsed) ? parsed : 0
}

export async function getVip(session = {}) {
  const s = normSession(session)
  if (!s.token) return { vip: false, superVip: false, type: 0, expiresAt: '' }
  try {
    const data = await liteRequest('/v1/get_union_vip', {
      busi_type: 'concept',
      opt_product_types: 'dvip,qvip',
      product_type: 'svip',
    }, s, { baseUrl: 'https://kugouvip.kugou.com' })
    const objects = flattenObjects(data)
    const now = Date.now()
    let active = null
    for (const item of objects) {
      if (Number(item.is_vip) !== 1) continue
      const endText = firstString([item], ['vip_end_time', 'vip_expire_time', 'expire_time', 'end_time'])
      const endAt = vipTimestamp(endText)
      if (endAt <= now) continue
      if (active === null || endAt > active.endAt) {
        active = { endAt, endText, product: String(item.product_type || ''), type: Number(item.vip_type) || 0 }
      }
    }
    if (active !== null) {
      return {
        vip: true,
        superVip: active.product === 'svip' || active.product === 'super',
        type: active.type,
        expiresAt: active.endText,
      }
    }
    return { vip: false, superVip: false, type: 0, expiresAt: '' }
  } catch {
    return { vip: false, superVip: false, type: 0, expiresAt: '' }
  }
}

async function ensureAuth(session) {
  const data = await liteRequest('/v1/user_verify', { module_id: '51' }, session, {
    headers: { 'x-router': 'trackercdngz.kugou.com' },
  })
  const auth = data && data.data && data.data.auth
  if (!auth) throw new Error('酷狗概念版没有返回播放授权')
  return String(auth)
}

async function songAuth(session, song) {
  const auth = await ensureAuth(session)
  const hash = String(song.hash || '').toLowerCase()
  const data = await liteRequest('/v1/authorization', {
    authorization: auth,
    module_id: '51',
    album_audio_id: '0',
    clientver: '11561',
    hash,
  }, session, { label: 'authorization', headers: { 'x-router': 'trackercdngz.kugou.com' } })
  const row = data && data.data ? data.data : data
  return {
    auth: String(row.auth || row.authorization || auth),
    openTime: Number(row.open_time || row.openTime || 0) || 0,
  }
}

function kgReplayGainOf(payload) {
  if (!payload || typeof payload !== 'object') return null
  const row = payload.data && typeof payload.data === 'object' ? payload.data : payload
  const gain = Number(row.volume)
  const peakDb = Number(row.volume_peak)
  const trackGain = Number.isFinite(gain) ? gain : null
  const trackPeak = Number.isFinite(peakDb) ? Math.pow(10, peakDb / 20) : null
  if (trackGain === null && trackPeak === null) return null
  return {
    ...(trackGain === null ? {} : { trackGain }),
    ...(trackPeak === null ? {} : { trackPeak }),
  }
}

export async function resolveStream(song, session = {}, prefer = ['flac', '320', '128']) {
  const s = normSession(session)
  const hash = String(song.hash || '').toLowerCase()
  if (!hash) throw new Error('缺少歌曲 hash')
  if (song.variant === 'cloud') {
    const answer = await callKugou('lite', 'user_cloud_url', { hash, id: String(song.fileId || '') })
    const url = findPlaybackUrl(answer.body)
    if (url) return { url, quality: 'standard', replayGain: kgReplayGainOf(answer.body) }
    throw new Error('酷狗概念版云盘没有返回播放地址')
  }
  const albumId = Number(song.albumId) || 0
  const albumAudioId = Number(song.albumAudioId) || 0
  const attempts = []
  // A half album identity is worse than none: the concept endpoint can resolve a
  // URL for another file, which then answers 404 at the CDN. Folia's precise
  // identity needs album_audio_id; without it, ask by hash alone.
  if (albumAudioId) {
    attempts.push({ album_id: albumId ? String(albumId) : '0', album_audio_id: String(albumAudioId) })
  }
  attempts.push({ album_id: '0', album_audio_id: '0' })
  const qualities = prefer.filter((item) => ['flac', '320', '128'].includes(item))
  try {
    for (const quality of qualities.length ? qualities : ['128']) {
      for (const attempt of attempts) {
        try {
          const answer = await callKugou('lite', 'song_url', {
            hash,
            quality,
            album_id: attempt.album_id,
            album_audio_id: attempt.album_audio_id,
            cookie: kugouCookies({ ...s, dfid: s.dfid }, 'lite'),
          })
          const url = findPlaybackUrl(answer.body)
          if (url && !/\/p_0_/.test(url)) {
            return { url, quality, bitrate: Number(answer.body?.bitrate) || 0, replayGain: kgReplayGainOf(answer.body) }
          }
        } catch {
          // Try the next variant for this quality.
        }
      }
    }
  } catch {
    // Fall through to the legacy concept signed endpoint.
  }
  const auth = await songAuth(s, song)
  for (const quality of qualities.length ? qualities : ['128']) {
    for (const attempt of attempts) {
      const params = {
        album_id: attempt.album_id,
        area_code: '1',
        module: '',
        hash,
        need_m: '0',
        ssa_flag: 'is_fromtrack',
        version: '11430',
        open_time: String(auth.openTime),
        ptype: '0',
        need_ogg: '1',
        page_id: '967177915',
        auth: auth.auth,
        mtype: '0',
        quality,
        album_audio_id: attempt.album_audio_id,
        behavior: 'play',
        pid: '411',
        module_id: '51',
        cmd: '26',
        ppage_id: '356753938,823673182,967485191',
        clientver: '11561',
        pidversion: '3001',
        cdnBackup: '1',
        dfid: s.dfid || '-',
        key: signTrackKey(hash, s),
      }
      const data = await liteRequest('/v5/url', params, s, {
        label: 'v5_url',
        headers: { 'x-router': 'trackercdn.kugou.com' },
      })
      const url = findPlaybackUrl(data)
      if (!url) continue
      const full = Number(data.is_full_audio) !== 0 && !/\/p_0_/.test(url)
      if (!full) continue
      return { url, quality, bitrate: Number(data.bitrate) || 0, replayGain: kgReplayGainOf(data) }
    }
  }
  throw new Error('酷狗概念版取链失败')
}

/**
 * KuGou's old mobile play-info endpoint. Folia keeps this as a last resort because
 * /song/url can hand back an address whose object has since disappeared from the
 * CDN (a 404 even though the hash still exists). The legacy endpoint resolves the
 * current object for the same hash.
 */
export async function resolveLegacyStream(hash) {
  const value = String(hash || '').trim().toLowerCase()
  if (value === '') return null
  const endpoint = 'https://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=' + encodeURIComponent(value)
  const { response, json } = await fetchJson(endpoint, {
    headers: {
      'User-Agent': UA_WEB,
      Referer: 'https://m.kugou.com/',
    },
  }, 10000)
  if (!response.ok || json === null || typeof json !== 'object') return null
  const url = findPlaybackUrl(json.url) || findPlaybackUrl(json.backup_url)
  if (url === '' || /\/p_0_/.test(url)) return null
  return { url, quality: 'standard', bitrate: 128, replayGain: kgReplayGainOf(json) }
}

function findPlaybackUrl(root) {
  if (typeof root === 'string') return /^https?:\/\//.test(root) ? root : ''
  if (Array.isArray(root)) {
    for (const item of root) {
      const hit = findPlaybackUrl(item)
      if (hit) return hit
    }
    return ''
  }
  if (root && typeof root === 'object') {
    for (const key of ['url', 'play_url', 'playUrl', 'backup_url', 'backupUrl']) {
      const hit = findPlaybackUrl(root[key])
      if (hit) return hit
    }
    for (const value of Object.values(root)) {
      const hit = findPlaybackUrl(value)
      if (hit) return hit
    }
  }
  return ''
}

export async function getProfile(session = {}) {
  const s = normSession(session)
  if (!s.token) return null
  // The lite gateway exposes account identity through the Web user page; avoid
  // leaking token in a URL and keep only public profile fields.
  try {
    const data = await liteRequest('/v1/user_verify', { module_id: '51' }, s, {
      headers: { 'x-router': 'trackercdngz.kugou.com' },
    })
    const row = data && data.data ? data.data : {}
    return { nickname: String(row.nickname || row.nick_name || ''), avatarUrl: String(row.pic || row.avatar || '') }
  } catch {
    return { nickname: '', avatarUrl: '' }
  }
}

/** Minimal concept playlist support; signs every request with the lite identity. */
export async function getMyPlaylists(session = {}) {
  const s = normSession(session)
  let data = null
  try {
    const answer = await callKugou('lite', 'user_playlist', {
      userid: s.userid,
      page: 1,
      pagesize: 60,
      cookie: kugouCookies({ ...s, dfid: s.dfid }, 'lite'),
    })
    data = answer.body
  } catch {
    data = null
  }
  if (!data) {
    const body = { userid: s.userid, token: s.token, total_ver: 979, type: 2, page: 1, pagesize: 60 }
    data = await liteRequest('/v7/get_all_list', {
      plat: '1',
      userid: s.userid,
      token: s.token,
    }, s, {
      method: 'POST',
      body,
      headers: { 'x-router': 'cloudlist.service.kugou.com' },
    })
  }
  return flattenObjects(data)
    .map((item) => {
      if (item.hash || item.Hash || item.FileHash) return null
      const globalCollectionId = String(item.global_collection_id || item.globalCollectionId || '')
      const listId = String(item.listid || item.list_id || item.specialid || '')
      const id = String(globalCollectionId || listId || item.id || '')
      const name = String(item.specialname || item.listname || item.name || '')
      if (!id || !name) return null
      return {
        source: 'kugouLite',
        id,
        listId,
        globalCollectionId,
        name,
        cover: String(item.imgurl || item.cover || item.pic || '').replace(/\{size\}/g, '240'),
        trackCount: Number(item.song_count || item.songcount || item.count || 0) || 0,
        creator: String(item.nickname || item.username || ''),
        kind: item.is_def === 2 || item.is_like ? 'like' : 'own',
        isLike: item.is_def === 2 || item.is_like === true,
        isDefault: item.is_def === 2 || item.is_like === true,
      }
    })
    .filter(Boolean)
}

function playlistMutationSucceeded(answer) {
  const status = Number(answer?.body?.status)
  const errorCode = Number(answer?.body?.error_code)
  return status === 1 || errorCode === 0
}

export async function addSongToPlaylist(song, playlistId, session = {}) {
  const s = normSession(session)
  const targetId = String(playlistId || '').trim()
  if (targetId === '') throw new Error('缺少歌单 id')
  const hash = String(song?.hash || song?.id || '').trim().toLowerCase()
  if (hash === '') throw new Error('缺少歌曲 hash')
  const playlists = await getMyPlaylists(s)
  const target = playlists.find((item) => String(item.id) === targetId || String(item.listId) === targetId) || null
  if (target === null) throw new Error('没有找到目标歌单')
  const listId = String(target.listId || '').trim()
  if (listId === '') throw new Error('目标歌单缺少 listid')
  const title = String(song?.title || '未知歌曲').replace(/[|,]/g, ' ')
  const albumId = Number(song?.albumId) || 0
  const mixSongId = Number(song?.mixSongId || song?.albumAudioId) || 0
  const answer = await callKugou('lite', 'playlist_tracks_add', {
    listid: listId,
    data: [title, hash, String(albumId), String(mixSongId)].join('|'),
    cookie: kugouCookies({ ...s, dfid: s.dfid }, 'lite'),
    userid: String(s.userid || ''),
    token: String(s.token || ''),
  })
  if (!playlistMutationSucceeded(answer)) throw new Error('酷狗没有确认加入歌单')
  return true
}

/**
 * Add/remove one song in the account's built-in "我喜欢" playlist.
 * The concept client uses the same cloudlist mutations as the standard client; the
 * only identity difference is the lite signed cookie.
 */
export async function setLiked(song, on, session = {}) {
  const s = normSession(session)
  const hash = String(song?.hash || song?.id || '').trim().toLowerCase()
  if (hash === '') throw new Error('缺少歌曲 hash')
  const playlists = await getMyPlaylists(s)
  const like = playlists.find((item) => item.isLike === true) || null
  if (like === null) throw new Error('没有找到「我喜欢」歌单')
  const listId = String(like.listId || '').trim()
  if (listId === '') throw new Error('「我喜欢」歌单缺少 listid')
  const cookie = kugouCookies({ ...s, dfid: s.dfid }, 'lite')
  const userid = String(s.userid || '')
  const token = String(s.token || '')

  if (on === true) {
    const title = String(song?.title || '未知歌曲').replace(/[|,]/g, ' ')
    const albumId = Number(song?.albumId) || 0
    const mixSongId = Number(song?.mixSongId || song?.albumAudioId) || 0
    const answer = await callKugou('lite', 'playlist_tracks_add', {
      listid: listId,
      data: [title, hash, String(albumId), String(mixSongId)].join('|'),
      cookie,
      userid,
      token,
    })
    if (!playlistMutationSucceeded(answer)) throw new Error('酷狗没有确认加入「我喜欢」')
    return true
  }

  const collectionId = String(like.globalCollectionId || like.id || '')
  const songs = collectionId === '' ? [] : await getMyPlaylistSongs(collectionId, s)
  const hit = songs.find((item) => String(item.hash || '').toLowerCase() === hash)
  // The target state is already reached: clear a stale local heart without calling
  // the delete endpoint with an unrelated playlist row id.
  if (!hit) return true
  const fileId = String(hit.fileId || '')
  if (fileId === '') throw new Error('未找到「我喜欢」中的歌曲行号')
  const answer = await callKugou('lite', 'playlist_tracks_del', {
    listid: listId,
    fileids: fileId,
    cookie,
    userid,
    token,
  })
  if (!playlistMutationSucceeded(answer)) throw new Error('酷狗没有确认从「我喜欢」移除')
  return true
}

export async function getMyPlaylistSongsPage(listId, limit = 100, offset = 0, session = {}) {
  const size = Math.max(1, Math.min(200, parseInt(limit, 10) || 100))
  const at = Math.max(0, parseInt(offset, 10) || 0)
  const s = normSession(session)
  try {
    const page = Math.floor(at / size) + 1
    const answer = await callKugou('lite', 'playlist_track_all', {
      id: String(listId),
      page,
      pagesize: size,
      cookie: kugouCookies({ ...s, dfid: s.dfid }, 'lite'),
    })
    const data = answer.body?.data ?? {}
    const rows = Array.isArray(data.songs) ? data.songs : []
    const songs = []
    for (const row of rows) {
      const song = normalizePackageSong(row)
      if (!song.id) continue
      songs.push({ ...song, singer: song.artists.join(' / '), durationSec: song.interval })
    }
    const total = Number(data.count) || 0
    return {
      songs,
      trackCount: total || songs.length,
      hasMore: total > 0 ? at + songs.length < total : rows.length >= size,
      nextOffset: at + songs.length,
    }
  } catch {
    const all = await getMyPlaylistSongs(listId, session)
    const songs = all.slice(at, at + size)
    return {
      songs,
      trackCount: all.length,
      hasMore: at + songs.length < all.length,
      nextOffset: at + songs.length,
    }
  }
}

export async function getMyPlaylistSongs(listId, session = {}) {
  const s = normSession(session)
  try {
    const collected = []
    for (let page = 1; page <= 1000; page += 1) {
      const answer = await callKugou('lite', 'playlist_track_all', {
        id: String(listId),
        page,
        pagesize: 100,
        cookie: kugouCookies({ ...s, dfid: s.dfid }, 'lite'),
      })
      const data = answer.body?.data ?? {}
      const rows = Array.isArray(data.songs) ? data.songs : []
      if (rows.length === 0) break
      for (const row of rows) {
        const song = normalizePackageSong(row)
        if (!song.id) continue
        collected.push({
          ...song,
          singer: song.artists.join(' / '),
          durationSec: song.interval,
        })
      }
      const total = Number(data.count) || 0
      if (total > 0 && collected.length >= total) break
      if (rows.length < 100) break
    }
    if (collected.length > 0) return collected
  } catch {
    // Fall through to the legacy concept (pubsongs) reader.
  }
  const songs = new Map()
  const pageSize = 200
  for (let page = 0; page < 1000; page += 1) {
    const begin = page * pageSize
    const data = await liteRequest('/pubsongs/v2/get_other_list_file_nofilt', {
      area_code: '1',
      begin_idx: String(begin),
      plat: '1',
      type: '1',
      mode: '1',
      personal_switch: '1',
      extend_fields: 'abtags,hot_cmt,popularization',
      pagesize: String(pageSize),
      global_collection_id: String(listId),
    }, s)
    let added = 0
    for (const item of flattenObjects(data)) {
      const hash = String(item.hash || item.Hash || item.FileHash || '')
      if (!hash) continue
      const singerInfo = Array.isArray(item.singerinfo) ? item.singerinfo : []
      const singers = singerInfo.map((entry) => String(entry && entry.name ? entry.name : '')).filter(Boolean)
      const rawName = String(item.name || item.SongName || item.songname || item.AudioName || item.filename || '')
      let singer = singers.join(' / ')
      let title = rawName
      if (rawName.includes(' - ')) {
        const at = rawName.indexOf(' - ')
        if (singers.length > 0) title = rawName.slice(at + 3).trim()
        else {
          singer = rawName.slice(0, at).trim()
          title = rawName.slice(at + 3).trim()
        }
      }
      const album = String((item.albuminfo && item.albuminfo.name) || item.album_name || item.AlbumName || item.albumname || '')
      const rawTimelen = Number(item.timelen || item.Duration || item.duration || 0) || 0
      const interval = rawTimelen > 10000 ? Math.round(rawTimelen / 1000) : rawTimelen
      const cover = String(item.cover || (item.trans_param && item.trans_param.union_cover) || '').replace(/\{size\}/g, '240')
      const id = hash.toLowerCase()
      if (songs.has(id)) continue
      songs.set(id, {
        id,
        hash: id,
        // The concept search row carries mixsongid, which is a song id, not the
        // album audio id. Passing it to song_url was the second half of the A→B bug.
        albumAudioId: Number(item.album_audio_id ?? item.albumAudioId ?? 0) || 0,
        mixSongId: Number(item.mixsongid ?? item.MixSongID ?? 0) || 0,
        albumId: Number(item.album_id ?? item.AlbumID ?? item.albumId ?? (item.albuminfo && (item.albuminfo.id ?? item.albuminfo.album_id)) ?? 0) || 0,
        title,
        singer,
        artists: singers.length > 0 ? singers : singer === '' ? [] : [singer],
        album,
        interval,
        durationSec: interval,
        cover,
        privilege: Number(item.privilege) || 0,
        payType: Number((item.relate_goods || []).find((row) => row && row.pay_type)?.pay_type) || 0,
        fileId: item.fileid || 0,
      })
      added += 1
    }
    if (added === 0) break
    if (added < pageSize) break
  }
  return [...songs.values()].filter((item) => item.title)
}


export async function debugVip(session) { return liteRequest('/v1/get_union_vip', { busi_type: 'concept', opt_product_types: 'dvip,qvip', product_type: 'svip' }, session, { baseUrl: 'https://kugouvip.kugou.com' }) }
