/**
 * 本地主题生成 — Folia AI 主题的形状，完全在本机算出来。
 *
 * Folia 把歌词交给 LLM（utils/aiThemePrompts.ts）换一份 { light, dark } 主题；插件没有
 * 模型，这里用同样的 Theme 形状做一版本地算法：封面色板 + 一份很小的歌词情绪词典，
 * 选色相、起名字、写描述，再把歌词里的高频词变成 wordColors。不联网、不读 key。
 *
 * 生成结果挂在模块级 store 里，按歌曲 seed（播放路径）索引；useFoliaCoverTheme 订阅它，
 * 三个 Folia 舞台（歌词样式 / 时计 / 背景）就会一起换主题。
 */

var MP_LOCAL_THEMES = {}
var MP_LOCAL_THEME_VERSION = 0
var MP_LOCAL_THEME_LISTENERS = []
var MP_LOCAL_THEME_INFLIGHT = {}
var MP_LOCAL_THEME_PENDING = {}
var MP_LOCAL_THEME_SIGNATURES = {}

function mpLocalLyricsSignature(text) {
  var value = String(text || '')
  var hash = 0
  for (var index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0
  }
  return String(value.length) + ':' + String(hash)
}

function mpLocalThemeKey(seed) {
  return typeof seed === 'string' && seed !== '' ? seed : ''
}

function mpLocalThemeBump() {
  MP_LOCAL_THEME_VERSION += 1
  for (var index = 0; index < MP_LOCAL_THEME_LISTENERS.length; index += 1) {
    try {
      MP_LOCAL_THEME_LISTENERS[index]()
    } catch (error) {
      // A listener that unmounted mid-notify is not worth failing the generation for.
    }
  }
}

function mpSetLocalTheme(key, theme) {
  if (key === '' || theme === null || theme === undefined) return theme || null
  MP_LOCAL_THEMES[key] = theme
  mpLocalThemeBump()
  return theme
}

function mpGetLocalTheme(key) {
  return key !== '' && MP_LOCAL_THEMES[key] ? MP_LOCAL_THEMES[key] : null
}

function mpSubscribeLocalThemes(listener) {
  MP_LOCAL_THEME_LISTENERS.push(listener)
  return function () {
    MP_LOCAL_THEME_LISTENERS = MP_LOCAL_THEME_LISTENERS.filter(function (item) {
      return item !== listener
    })
  }
}

/** One song's generated theme; `version` makes a stage re-render when it lands. */
function useMpLocalTheme(seed) {
  var key = mpLocalThemeKey(seed)
  var pair = useState(0)
  var setVersion = pair[1]
  useEffect(function () {
    return mpSubscribeLocalThemes(function () {
      setVersion(MP_LOCAL_THEME_VERSION)
    })
  }, [])
  return { key: key, theme: mpGetLocalTheme(key), version: pair[0] }
}

// ── colour helpers (hex ⇄ hsl, small and dependency-free) ────────────────

function mpClampChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function mpHexToRgb(hex) {
  var value = typeof hex === 'string' ? hex.trim() : ''
  var match = /^#?([0-9a-f]{6})$/i.exec(value)
  if (match === null) return { r: 244, g: 244, b: 245 }
  return {
    r: parseInt(match[1].slice(0, 2), 16),
    g: parseInt(match[1].slice(2, 4), 16),
    b: parseInt(match[1].slice(4, 6), 16),
  }
}

function mpRgbToHex(rgb) {
  function channel(value) {
    var hex = mpClampChannel(value).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }
  return '#' + channel(rgb.r) + channel(rgb.g) + channel(rgb.b)
}

function mpRgbToHsl(rgb) {
  var r = rgb.r / 255
  var g = rgb.g / 255
  var b = rgb.b / 255
  var max = Math.max(r, g, b)
  var min = Math.min(r, g, b)
  var lightness = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: lightness }
  var delta = max - min
  var saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  var hue = 0
  if (max === r) hue = (g - b) / delta + (g < b ? 6 : 0)
  else if (max === g) hue = (b - r) / delta + 2
  else hue = (r - g) / delta + 4
  return { h: hue * 60, s: saturation, l: lightness }
}

function mpHslToRgb(hsl) {
  var h = ((hsl.h % 360) + 360) % 360 / 360
  var s = Math.max(0, Math.min(1, hsl.s))
  var l = Math.max(0, Math.min(1, hsl.l))
  function hue(p, q, t) {
    var value = t < 0 ? t + 1 : t > 1 ? t - 1 : t
    if (value < 1 / 6) return p + (q - p) * 6 * value
    if (value < 1 / 2) return q
    if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6
    return p
  }
  var q = l < 0.5 ? l * (1 + s) : l + s - l * s
  var p = 2 * l - q
  return { r: hue(p, q, h + 1 / 3) * 255, g: hue(p, q, h) * 255, b: hue(p, q, h - 1 / 3) * 255 }
}

function mpShiftHex(hex, deltaHue, saturationScale, lightnessScale) {
  var hsl = mpRgbToHsl(mpHexToRgb(hex))
  return mpRgbToHex(mpHslToRgb({
    h: hsl.h + deltaHue,
    s: Math.max(0, Math.min(1, hsl.s * saturationScale)),
    l: Math.max(0, Math.min(1, hsl.l * lightnessScale)),
  }))
}

// ── lyric moods: a small lexicon, a palette, a name and a line of copy ───

var MP_LOCAL_MOODS = {
  night: {
    label: '夜',
    colors: ['#1b2a4a', '#6f8fbf', '#d9b36c'],
    descriptions: [
      '城市睡了，只有耳机里的星群还亮着。',
      '夜色把心事调成很轻的蓝色，像一封没寄出的信。',
    ],
  },
  rain: {
    label: '雨',
    colors: ['#2a3a44', '#7fa6b5', '#c9d6db'],
    descriptions: [
      '雨声落下来的时候，房间忽然变得很空。',
      '把没说完的话交给窗外的雨，让它替我讲完。',
    ],
  },
  love: {
    label: '恋',
    colors: ['#3a1f2a', '#c96a7a', '#f2c9b8'],
    descriptions: [
      '心跳漏了一拍，是这首歌替我说了。',
      '像把整个夏天，都装进了一次对视。',
    ],
  },
  loss: {
    label: '离',
    colors: ['#2a2433', '#8d7aa8', '#c9b7d6'],
    descriptions: [
      '有些人走远了，旋律还停在原地。',
      '告别没有声音，只有副歌一遍遍替我重复。',
    ],
  },
  dream: {
    label: '梦',
    colors: ['#241f3a', '#8f7ad6', '#e0c9ff'],
    descriptions: [
      '闭上眼，世界变成一场缓慢的梦。',
      '在梦里绕过所有路口，还是遇见你。',
    ],
  },
  hope: {
    label: '光',
    colors: ['#2a2415', '#e0a94f', '#ffe1a8'],
    descriptions: [
      '天亮以前，先把这首歌听完，再决定去往哪里。',
      '像一束光，从旋律的缝隙里漏进来。',
    ],
  },
  anger: {
    label: '烈',
    colors: ['#331515', '#d05a4a', '#ffb199'],
    descriptions: [
      '把不甘心调大一点，再大一点，直到胸口发烫。',
      '鼓点落下，替沉默的人发声，也替我说不。',
    ],
  },
  nostalgia: {
    label: '旧',
    colors: ['#2e261d', '#b08b5e', '#e3cfae'],
    descriptions: [
      '旧风扇转着，夏天又回来了一次。',
      '那年的放学路，被前奏重新照亮。',
    ],
  },
  lonely: {
    label: '孤',
    colors: ['#22262e', '#7a8aa0', '#c3ccd6'],
    descriptions: [
      '房间很大，声音很小，刚好装下一个人。',
      '孤独不是空的，它有自己的回声。',
    ],
  },
  calm: {
    label: '静',
    colors: ['#1d2b2a', '#6fa39b', '#c9e0d8'],
    descriptions: [
      '风很慢，歌也很慢，刚好够发呆。',
      '什么都不做，只让旋律经过，像风穿过房间。',
    ],
  },
}

var MP_LOCAL_MOOD_WORDS = {
  night: ['夜', '深夜', '午夜', '星', '月亮', '月', 'night', 'midnight', 'star', 'moon', 'dark'],
  rain: ['雨', '下雨', '泪', '湿', '伞', 'rain', 'tear', 'storm', 'wet', 'cloud'],
  love: ['爱', '喜欢', '心动', '拥抱', '吻', 'love', 'heart', 'kiss', 'hold'],
  loss: ['离开', '失去', '再见', '遗忘', '走远', 'gone', 'lost', 'leave', 'farewell', 'goodbye'],
  dream: ['梦', '幻', '飞', '天空', 'dream', 'light', 'sky', 'fly', 'illusion'],
  hope: ['希望', '明天', '太阳', '未来', '光', 'hope', 'tomorrow', 'sun', 'future', 'rise'],
  anger: ['恨', '痛', '吵', '崩', '燃', 'hate', 'pain', 'fight', 'burn', 'scream'],
  nostalgia: ['从前', '回忆', '夏天', '青春', '旧', '那年', 'memory', 'summer', 'youth', 'past', 'old'],
  lonely: ['一个人', '寂寞', '孤独', '空', 'alone', 'empty', 'lonely', 'silence'],
  calm: ['风', '海', '静', '慢', '云', 'wind', 'sea', 'calm', 'slow', 'cloud'],
}

var MP_LOCAL_STOPWORDS = {
  the: 1, a: 1, an: 1, and: 1, or: 1, but: 1, to: 1, of: 1, in: 1, on: 1, at: 1,
  for: 1, with: 1, from: 1, by: 1, is: 1, are: 1, was: 1, were: 1, be: 1, been: 1,
  it: 1, its: 1, this: 1, that: 1, these: 1, those: 1, i: 1, you: 1, he: 1, she: 1,
  we: 1, they: 1, me: 1, my: 1, your: 1, our: 1, his: 1, her: 1, their: 1, them: 1,
  do: 1, does: 1, did: 1, not: 1, no: 1, so: 1, if: 1, as: 1, just: 1, all: 1,
  '的': 1, '了': 1, '是': 1, '我': 1, '你': 1, '他': 1, '她': 1, '它': 1, '在': 1,
  '有': 1, '和': 1, '就': 1, '都': 1, '也': 1, '不': 1, '人': 1, '这': 1, '那': 1,
  '一个': 1, '什么': 1, '我们': 1, '你们': 1, '他们': 1, '自己': 1, '因为': 1, '所以': 1,
}

function mpLocalCountWord(text, word) {
  var value = String(word || '')
  if (value === '') return 0
  if (/^[\x00-\x7f]+$/.test(value)) {
    var escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    var match = String(text || '').toLowerCase().match(new RegExp('(^|[^a-z])' + escaped + '([^a-z]|$)', 'g'))
    return match === null ? 0 : match.length
  }
  return String(text || '').split(value).length - 1
}

function mpLocalMoodOf(text) {
  var lower = String(text || '').toLowerCase()
  var best = 'calm'
  var bestScore = 0
  Object.keys(MP_LOCAL_MOOD_WORDS).forEach(function (mood) {
    var score = 0
    MP_LOCAL_MOOD_WORDS[mood].forEach(function (word) {
      score += mpLocalCountWord(lower, word.toLowerCase())
    })
    if (score > bestScore) {
      bestScore = score
      best = mood
    }
  })
  return best
}

/** Meaningful lyric words: CJK 2–4 grams and Latin words, frequency-ranked. */
function mpLocalWords(text) {
  var counts = {}
  function add(word) {
    if (!word || word.length < 2) return
    var key = word.toLowerCase()
    if (MP_LOCAL_STOPWORDS[key] === 1) return
    counts[key] = (counts[key] || 0) + 1
  }
  var latin = String(text || '').match(/[A-Za-z][A-Za-z'-]{1,}/g) || []
  latin.forEach(function (word) {
    add(word.replace(/^[-']+|[-']+$/g, ''))
  })
  var runs = String(text || '').match(/[\u4e00-\u9fff]+/g) || []
  runs.forEach(function (run) {
    for (var size = 2; size <= 4; size += 1) {
      for (var start = 0; start + size <= run.length; start += 1) {
        add(run.slice(start, start + size))
      }
    }
  })
  var list = Object.keys(counts).map(function (word) {
    return { word: word, count: counts[word] }
  })
  list.sort(function (a, b) {
    if (b.count !== a.count) return b.count - a.count
    return b.word.length - a.word.length
  })
  var picked = []
  for (var index = 0; index < list.length && picked.length < 14; index += 1) {
    var candidate = list[index].word
    var overlaps = false
    for (var seen = 0; seen < picked.length; seen += 1) {
      if (picked[seen].indexOf(candidate) >= 0 || candidate.indexOf(picked[seen]) >= 0) {
        overlaps = true
        break
      }
    }
    if (!overlaps) picked.push(candidate)
  }
  return picked
}

function mpLocalWordColors(text, theme) {
  var words = mpLocalWords(text)
  var bases = [theme.accentColor, theme.secondaryColor, theme.primaryColor]
  return words.map(function (word, index) {
    var base = bases[index % bases.length] || theme.accentColor
    return {
      word: word,
      color: mpShiftHex(base, (index * 53) % 320 - 160, 0.95, index % 2 === 0 ? 1.06 : 0.9),
    }
  })
}

function mpLocalThemeName(mood, theme) {
  var label = (MP_LOCAL_MOODS[mood] || MP_LOCAL_MOODS.calm).label
  var base = theme && typeof theme.name === 'string' && theme.name !== '' ? theme.name : '本地主题'
  var name = label + '·' + base
  return name.length > 10 ? name.slice(0, 10) : name
}

function mpLocalThemeDescription(mood, random) {
  var descriptions = (MP_LOCAL_MOODS[mood] || MP_LOCAL_MOODS.calm).descriptions
  var index = Math.floor(random() * descriptions.length) % descriptions.length
  return descriptions[index]
}

/** Build one dark Theme from cover colours + lyric mood. Returns null without Folia's generator. */
function mpBuildLocalTheme(input) {
  if (typeof FOLIA_STYLES === 'undefined' || FOLIA_STYLES === null || typeof FOLIA_STYLES.generateBuiltinDualTheme !== 'function') {
    return null
  }
  var source = input || {}
  var mood = mpLocalMoodOf(source.lyricsText)
  var moodColors = (MP_LOCAL_MOODS[mood] || MP_LOCAL_MOODS.calm).colors
  var coverColors = Array.isArray(source.coverColors)
    ? source.coverColors.filter(function (color) { return typeof color === 'string' && color !== '' })
    : []
  var random = typeof mpSeededRandom === 'function'
    ? mpSeededRandom(String(source.key || '') + '|' + mood + '|' + String(source.variation || 0))
    : Math.random
  var dual = FOLIA_STYLES.generateBuiltinDualTheme({
    coverColors: coverColors.concat(moodColors),
    random: random,
  })
  var theme = dual && dual.dark ? dual.dark : null
  if (theme === null) return null
  theme.name = mpLocalThemeName(mood, theme)
  theme.description = mpLocalThemeDescription(mood, random)
  theme.provider = 'Local'
  theme.wordColors = mpLocalWordColors(source.lyricsText, theme)
  theme.lyricsIcons = []
  return theme
}

/** Generate for a song: cover colours first, then the local build. Resolves to the Theme. */
function mpGenerateLocalThemeForSong(input) {
  var source = input || {}
  var key = mpLocalThemeKey(source.key)
  var signature = mpLocalLyricsSignature(source.lyricsText)
  function build(colors) {
    var theme = mpBuildLocalTheme({
      key: key,
      coverColors: colors,
      lyricsText: source.lyricsText,
      songTitle: source.songTitle,
      variation: source.variation,
    })
    var stored = mpSetLocalTheme(key, theme)
    if (stored !== null) MP_LOCAL_THEME_SIGNATURES[key] = signature
    return stored
  }
  if (source.cover && typeof FOLIA_STYLES !== 'undefined' && FOLIA_STYLES !== null && typeof FOLIA_STYLES.extractColors === 'function') {
    return FOLIA_STYLES.extractColors(source.cover, 5).then(build, function () {
      return build([])
    })
  }
  return Promise.resolve().then(function () {
    return build([])
  })
}

/** Auto path: generate when lyrics changed (or nothing exists yet), serialized per song. */
function mpEnsureLocalTheme(input) {
  var key = mpLocalThemeKey(input && input.key)
  if (key === '') return
  var signature = mpLocalLyricsSignature(input.lyricsText)
  if (MP_LOCAL_THEMES[key] && MP_LOCAL_THEME_SIGNATURES[key] === signature) return
  if (MP_LOCAL_THEME_INFLIGHT[key]) {
    MP_LOCAL_THEME_PENDING[key] = input
    return
  }
  MP_LOCAL_THEME_INFLIGHT[key] = true
  function finish() {
    delete MP_LOCAL_THEME_INFLIGHT[key]
    var pending = MP_LOCAL_THEME_PENDING[key]
    delete MP_LOCAL_THEME_PENDING[key]
    if (pending) mpEnsureLocalTheme(pending)
  }
  mpGenerateLocalThemeForSong(input).then(finish, finish)
}
