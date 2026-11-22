/**
 * api: every call into the Host half lives here.
 *
 * The playback engine expects `API`, `getJson`, `postJson`, `streamUrl` and
 * `coverUrl` under these exact names.
 */

var API = 'music/'

function streamUrl(path) {
  return API + 'stream?path=' + encodeURIComponent(path)
}

function coverUrl(path) {
  return API + 'cover?path=' + encodeURIComponent(path)
}

function onlineStreamUrl(provider, id, quality) {
  var level =
    typeof quality === 'string' && quality !== ''
      ? quality
      : (readPrefs().onlineQuality || 'high')
  return (
    API +
    'online/stream?provider=' +
    encodeURIComponent(provider) +
    '&id=' +
    encodeURIComponent(id) +
    '&quality=' +
    encodeURIComponent(level)
  )
}

/**
 * Cover art for a self-hosted Navidrome/Subsonic server.
 *
 * The generic /online/cover route only allows the public provider CDNs, and a
 * Subsonic cover needs the stored salted token, so the Host proxies it from
 * the coverArt id alone.
 */
function subsonicCoverUrl(coverArtId) {
  if (typeof coverArtId !== 'string' || coverArtId === '') return ''
  return API + 'online/subsonic-cover?provider=navidrome&id=' + encodeURIComponent(coverArtId)
}

/**
 * GET one Host route.
 *
 * `options.signal` lets a caller that no longer needs the answer cancel the request
 * (the search behind a lyric upgrade can walk four sources). The Host finishes the
 * request it already started; this only stops the browser waiting for it.
 */
async function getJson(url, options) {
  var signal = options && options.signal ? options.signal : undefined
  var response = await fetch(url, {
    credentials: 'same-origin',
    headers: { accept: 'application/json' },
    ...(signal === undefined ? {} : { signal: signal }),
  })
  var body = null
  try {
    body = await response.json()
  } catch (error) {
    body = null
  }
  if (!response.ok || body === null || body.ok !== true) {
    var message =
      body !== null && body.error && body.error.message ? body.error.message : 'HTTP ' + response.status
    throw new Error(message)
  }
  return body
}

function postJson(url, payload) {
  return fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(payload === undefined ? {} : payload),
  }).then(function (response) {
    return response
      .json()
      .catch(function () {
        return null
      })
      .then(function (body) {
        if (!response.ok || body === null || body.ok !== true) {
          var error = new Error(
            body !== null && body.error && body.error.message
              ? body.error.message
              : 'HTTP ' + response.status,
          )
          error.body = body
          throw error
        }
        return body
      })
  })
}

/** PATCH / DELETE with the same envelope as postJson. */
function sendJson(method, url, payload) {
  return fetch(url, {
    method: method,
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  }).then(function (response) {
    return response
      .json()
      .catch(function () {
        return null
      })
      .then(function (body) {
        if (!response.ok || body === null || body.ok !== true) {
          var error = new Error(
            body !== null && body.error && body.error.message
              ? body.error.message
              : 'HTTP ' + response.status,
          )
          error.body = body
          throw error
        }
        return body
      })
  })
}

/** Cover URL for a library or online track ('' when it has no art). */
function trackCoverSrc(track) {
  if (!track) return ''
  if (track.onlineProvider) {
    // A self-hosted server's artwork needs its stored token, so it is proxied
    // by coverArt id rather than by URL; the generic route only allows the
    // public provider CDNs.
    if (track.onlineProvider === 'navidrome') return subsonicCoverUrl(track.coverArtId)
    // The Host serves the cover cached with a played-through song first; `url` is the
    // fallback while nothing is cached (Folia keys covers by song, not by URL).
    if (typeof track.coverUrl === 'string' && track.coverUrl !== '') {
      return (
        API +
        'online/cover?provider=' +
        encodeURIComponent(track.onlineProvider) +
        '&id=' +
        encodeURIComponent(String(track.onlineId || '')) +
        '&url=' +
        encodeURIComponent(track.coverUrl)
      )
    }
    return ''
  }
  if (track.hasCover === true && track.path) return coverUrl(track.path)
  return ''
}

/** Map one online search / playlist result into the queue's track shape. */
function onlineTrackOf(result) {
  // Native sources historically carried only `sourceRef`; legacy rows carry `provider`.
  // Without one the stream URL and cover proxy are built with `provider=undefined`.
  var provider = result.provider || result.onlineProvider || (result.sourceRef && result.sourceRef.sourceId) || ''
  return {
    path: 'online:' + provider + ':' + result.id,
    title: result.title || result.name || result.songname || '',
    artist: result.artist || (Array.isArray(result.artists) ? result.artists.join(' / ') : ''),
    album: result.album,
    albumId: result.albumId || '',
    // The artist page opens on the id the row already carries (Folia's catalogRef):
    // without it the page can only search by name, which Bodian/Qishui do not offer.
    artistsDetail: Array.isArray(result.artistsDetail) ? result.artistsDetail : [],
    albumDetail: result.albumDetail && typeof result.albumDetail === 'object' ? result.albumDetail : null,
    durationSec: result.durationSec,
    hasCover: false,
    coverUrl: result.coverUrl || '',
    // Navidrome identifies artwork by id (`mf-…` song art, `al-…` album art),
    // which trackCoverSrc resolves through the host proxy.
    coverArtId: result.coverArtId || '',
    onlineUrl: onlineStreamUrl(provider, result.id),
    onlineProvider: provider,
    onlineId: result.id,
    fileId: result.fileId || 0,
    qualityHint: result.qualityHint || '',
    addedAt: Number(result.addedAt || result.createdAt || 0) || 0,
    lastPlayedAt: Number(result.playedAt || result.lastPlayedAt || result.updatedAt || 0) || 0,
    sampleRate: 0,
    size: 0,
    mtime: 0,
  }
}

function onlineCoverSrc(result, provider, kind) {
  if (!result) return ''
  if (typeof result.coverArtId === 'string' && result.coverArtId !== '') return subsonicCoverUrl(result.coverArtId)
  if (typeof result.coverUrl !== 'string' || result.coverUrl === '') return ''
  var pid = provider || result.provider || (result.sourceRef && result.sourceRef.sourceId) || ''
  return (
    API +
    'online/cover?provider=' +
    encodeURIComponent(pid) +
    '&id=' +
    encodeURIComponent(String(result.id || '')) +
    (kind ? '&kind=' + encodeURIComponent(kind) : '') +
    '&url=' +
    encodeURIComponent(result.coverUrl)
  )
}
