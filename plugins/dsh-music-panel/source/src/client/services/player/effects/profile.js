/**
 * Folia's automix profile, for the volume balance.
 *
 * Folia measures a track once (whole file, or only its head for a library
 * server) and keeps programLoudness / peak / leadIn. This store is the small
 * client-side equivalent: a whole-track measurement made from the bytes the
 * player already fetched, keyed by song path. It never fabricates a head or a
 * profile for a track whose bytes were not read.
 */

var PROFILE_STORE_KEY = 'music.profile.v1'
var PROFILE_MAX_RECORDS = 200
var profileVersionCache = null

function profileVersion() {
  if (profileVersionCache !== null) return profileVersionCache
  if (typeof __mpProfileBundle !== 'function') return null
  try {
    var api = __mpProfileBundle()
    profileVersionCache = typeof api.TRACK_PROFILE_VERSION === 'number' ? api.TRACK_PROFILE_VERSION : null
  } catch (error) {
    profileVersionCache = null
  }
  return profileVersionCache
}

function readProfileStore() {
  try {
    var raw = window.localStorage.getItem(PROFILE_STORE_KEY)
    var parsed = raw === null ? null : JSON.parse(raw)
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch (error) {
    return {}
  }
}

var profileStoreData = readProfileStore()

function writeProfileStore() {
  try {
    window.localStorage.setItem(PROFILE_STORE_KEY, JSON.stringify(profileStoreData))
  } catch (error) {
    // Quota/private mode: the in-memory copy still works for this session.
  }
}

/** The stored whole-track profile for a path, or null. */
function profileFor(path) {
  var entry = path ? profileStoreData[path] : null
  if (!entry || typeof entry.programLoudness !== 'number') return null
  var version = profileVersion()
  if (version !== null && typeof entry.version === 'number' && entry.version !== version) return null
  return Object.assign({}, entry, {
    programLoudness: entry.programLoudness,
    peak: typeof entry.peak === 'number' ? entry.peak : null,
    leadIn: typeof entry.leadIn === 'number' ? entry.leadIn : 0,
    partial: entry.partial === true,
    at: Number(entry.at) || 0,
  })
}

/** A whole-track measurement, or a head-only one when partial is true. */
function noteProfile(path, measured) {
  if (!path || !measured || typeof measured.programLoudness !== 'number') return
  if (!(measured.programLoudness > -90)) return
  var version = typeof measured.version === 'number' ? measured.version : profileVersion()
  profileStoreData[path] = Object.assign({}, measured, {
    ...(version === null ? {} : { version: version }),
    programLoudness: measured.programLoudness,
    peak: typeof measured.peak === 'number' ? measured.peak : null,
    leadIn: typeof measured.leadIn === 'number' ? measured.leadIn : 0,
    partial: measured.partial === true,
    at: Date.now(),
  })
  var keys = Object.keys(profileStoreData)
  if (keys.length > PROFILE_MAX_RECORDS) {
    keys
      .sort(function (a, b) { return (profileStoreData[a].at || 0) - (profileStoreData[b].at || 0) })
      .slice(0, keys.length - PROFILE_MAX_RECORDS)
      .forEach(function (key) { delete profileStoreData[key] })
  }
  writeProfileStore()
}

/** Forget every analysis record (设置 · 存储与备份 · 清除分析数据). */
function clearProfileStore() {
  profileStoreData = {}
  try {
    window.localStorage.removeItem(PROFILE_STORE_KEY)
  } catch (error) {
    // Blocked storage: the in-memory copy is already empty.
  }
}

/** Test-only: forget the in-memory copy. */
function resetProfileStoreForTests() {
  profileStoreData = {}
}
