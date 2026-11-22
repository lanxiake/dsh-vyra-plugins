/**
 * Folia's 「一轮不重复」 (shuffle in rounds), ported from
 * A_other/upstream/folia-major-main/src/components/app/playback/shuffle/shuffleRound.ts
 * and shuffleRoundState.ts.
 *
 * 打乱播放按轮洗：一轮里听过的歌排到没听过的后面；列表循环下整轮听完自动重洗，正在播的
 * 那首钉在最前。只对「还是那次洗出来的顺序」的队列生效，用户拖动/增删后不再算一轮。
 *
 * 纯函数 + 一个本机存档（music.shuffleRound.v1，清空插件数据时随 music. 前缀一起清）。
 */

var SHUFFLE_ROUND_STATE_KEY = 'music.shuffleRound.v1'

/** The playback identity Folia's getPlaybackSongKey gives a song. */
function shuffleRoundKeyOf(item) {
  if (item === null || item === undefined || typeof item !== 'object') return ''
  if (typeof item.onlineProvider === 'string' && item.onlineProvider !== '' && item.onlineId) {
    return 'online:' + item.onlineProvider + ':' + item.onlineId
  }
  return String(item.path || '')
}

/** A queue song that could be played: Folia counts only these toward a finished round. */
function shuffleRoundPlayable(item) {
  return item !== null && item !== undefined && typeof item === 'object' && shuffleRoundKeyOf(item) !== ''
}

function shuffleRoundRandomCopy(list, random) {
  var queue = list.slice()
  for (var index = queue.length - 1; index > 0; index -= 1) {
    var swap = Math.floor(random() * (index + 1))
    var held = queue[index]
    queue[index] = queue[swap]
    queue[swap] = held
  }
  return queue
}

var SHUFFLE_ROUND_FNV_OFFSET = 0x811c9dc5
function shuffleRoundFnv(hash, key) {
  var next = hash
  for (var index = 0; index < key.length; index += 1) {
    next = Math.imul(next ^ key.charCodeAt(index), 0x01000193)
  }
  // 分隔符：["ab", "c"] 与 ["a", "bc"] 不撞。
  return Math.imul(next ^ 0xff, 0x01000193)
}

function shuffleRoundHashKeys(keys) {
  return keys.length + ':' + (keys.reduce(shuffleRoundFnv, SHUFFLE_ROUND_FNV_OFFSET) >>> 0).toString(16)
}

/** 一批歌的指纹：与顺序无关，歌多一首、少一首、换一首都会变。 */
function shuffleRoundFingerprint(keys) {
  return shuffleRoundHashKeys(keys.slice().sort())
}

/** 一队歌的顺序哈希：同一批歌换了顺序也会变。 */
function shuffleRoundOrderHash(keys) {
  return shuffleRoundHashKeys(keys)
}

/** 这队歌是不是记着的那一轮洗出来的、而且还是洗出来的顺序。 */
function isShuffleRoundQueue(state, keys) {
  return state !== null && state !== undefined && state.orderHash === shuffleRoundOrderHash(keys)
}

/**
 * 按轮洗一队歌。pinnedIndex（正在播的）钉在最前、算作已听；没有就传 -1。
 * 同一批歌接着 state 那一轮；整轮都听过（或换了一批歌）就从头开始。
 */
function shuffleForRound(options) {
  var opts = options !== null && options !== undefined ? options : {}
  var songs = Array.isArray(opts.songs) ? opts.songs : []
  var keyOf = typeof opts.keyOf === 'function' ? opts.keyOf : shuffleRoundKeyOf
  var pinnedIndex = Number(opts.pinnedIndex)
  if (!isFinite(pinnedIndex)) pinnedIndex = -1
  var state = opts.state === undefined ? null : opts.state
  var counts = typeof opts.counts === 'function' ? opts.counts : function () { return true }
  var random = typeof opts.random === 'function' ? opts.random : Math.random
  var keys = songs.map(keyOf)
  var fingerprint = shuffleRoundFingerprint(keys)
  var pinned = pinnedIndex >= 0 && pinnedIndex < songs.length ? songs[pinnedIndex] : null
  var pinnedKey = pinned === null ? null : keys[pinnedIndex]
  var played = new Set(state !== null && state !== undefined && state.fingerprint === fingerprint ? state.played : [])
  if (pinnedKey !== null) played.add(pinnedKey)
  var rest = songs.filter(function (_, index) { return index !== pinnedIndex })
  var counted = songs.filter(counts).map(keyOf)
  var newRound = counted.length > 0 && counted.every(function (key) { return played.has(key) })
  var ordered
  if (newRound) {
    played.clear()
    if (pinnedKey !== null) played.add(pinnedKey)
    ordered = shuffleRoundRandomCopy(rest, random)
  } else {
    var fresh = rest.filter(function (song) { return !played.has(keyOf(song)) })
    var heard = rest.filter(function (song) { return played.has(keyOf(song)) })
    ordered = shuffleRoundRandomCopy(fresh, random).concat(shuffleRoundRandomCopy(heard, random))
  }
  var queue = pinned === null ? ordered : [pinned].concat(ordered)
  return {
    queue: queue,
    state: {
      fingerprint: fingerprint,
      orderHash: shuffleRoundOrderHash(queue.map(keyOf)),
      played: keys.filter(function (key) { return played.has(key) }),
    },
    newRound: newRound,
  }
}

/**
 * 切歌时这一轮该做什么：不是记着的那一队（或这首不在队里）就什么都不做；记下这首听过；
 * 列表循环下这一轮能播的都听过了就整队重洗。除了正在播的这首再没有能播的歌时不重洗，
 * 否则洗完又是「整轮听完」，会无限重洗。
 */
function decideShuffleRoundStep(input) {
  var it = input !== null && input !== undefined ? input : {}
  var state = it.state === undefined ? null : it.state
  var keys = Array.isArray(it.keys) ? it.keys : []
  var currentKey = String(it.currentKey || '')
  var countedKeys = Array.isArray(it.countedKeys) ? it.countedKeys : []
  var loopMode = it.loopMode === 'all' || it.loopMode === 'one' ? it.loopMode : 'off'
  if (!isShuffleRoundQueue(state, keys) || keys.indexOf(currentKey) < 0) return { kind: 'none' }
  var played = state.played.indexOf(currentKey) >= 0 ? state.played : state.played.concat([currentKey])
  var heard = new Set(played)
  var complete = countedKeys.length > 0 && countedKeys.every(function (key) { return heard.has(key) })
  var othersCounted = countedKeys.some(function (key) { return key !== currentKey })
  if (complete && loopMode === 'all' && othersCounted) return { kind: 'reshuffle' }
  return played === state.played ? { kind: 'none' } : { kind: 'write', state: Object.assign({}, state, { played: played }) }
}

function readShuffleRoundState() {
  if (typeof window === 'undefined' || !window.localStorage) return null
  try {
    var raw = window.localStorage.getItem(SHUFFLE_ROUND_STATE_KEY)
    if (raw === null || raw === '') return null
    var parsed = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object') return null
    if (typeof parsed.fingerprint !== 'string' || typeof parsed.orderHash !== 'string' || !Array.isArray(parsed.played)) return null
    if (!parsed.played.every(function (key) { return typeof key === 'string' })) return null
    return { fingerprint: parsed.fingerprint, orderHash: parsed.orderHash, played: parsed.played }
  } catch (error) {
    return null
  }
}

function writeShuffleRoundState(state) {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    window.localStorage.setItem(SHUFFLE_ROUND_STATE_KEY, JSON.stringify(state))
  } catch (error) {
    console.warn('[ShuffleRound] Could not save the round', error)
  }
}

/** 按轮洗一队歌并记下这一轮。currentSong 在队里时钉在最前；不给时整队都洗。 */
function shuffleQueueInRounds(queue, currentSong) {
  var currentKey = currentSong ? shuffleRoundKeyOf(currentSong) : null
  var pinnedIndex = currentKey === null
    ? -1
    : queue.findIndex(function (song) { return shuffleRoundKeyOf(song) === currentKey })
  var shuffled = shuffleForRound({
    songs: queue,
    keyOf: shuffleRoundKeyOf,
    pinnedIndex: pinnedIndex,
    state: readShuffleRoundState(),
    counts: shuffleRoundPlayable,
  })
  writeShuffleRoundState(shuffled.state)
  return shuffled.queue
}

/** Whether the saved round belongs to this exact queue order (no user edits since the shuffle). */
function shuffleRoundQueueState(queue) {
  var state = readShuffleRoundState()
  var keys = queue.map(shuffleRoundKeyOf)
  return isShuffleRoundQueue(state, keys) ? state : null
}
