/* dsh-vyra-media-studio prototype — no build, no dependencies. */
(() => {
  'use strict'

  const $ = (id) => document.getElementById(id)
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]
  const panel = $('panel')
  const overlay = $('overlay')
  panel.appendChild(overlay)

  const DAY = 86_400_000
  const now = Date.now()
  const MB = 1_000_000

  const items = [
    {
      id: '包装/片头/片头_动态字幕_v3.mp4',
      kind: 'video',
      title: '片头_动态字幕_v3.mp4',
      fileName: '片头_动态字幕_v3.mp4',
      folder: '包装/片头',
      relativePath: '包装/片头/片头_动态字幕_v3.mp4',
      size: 64.2 * MB,
      mtimeMs: now - 2.2 * 3600_000,
      duration: 6,
      width: 960,
      height: 540,
      source: 'local',
      ext: 'mp4',
      src: 'assets/media/opening_4k.mp4',
      poster: 'assets/media/opening_4k.jpg',
      tone: 'blue',
    },
    {
      id: '作品/开箱/新品开箱_正片_v7.mp4',
      kind: 'video',
      title: '新品开箱_正片_v7.mp4',
      fileName: '新品开箱_正片_v7.mp4',
      folder: '作品/开箱',
      relativePath: '作品/开箱/新品开箱_正片_v7.mp4',
      size: 486 * MB,
      mtimeMs: now - 2 * DAY - 4 * 3600_000,
      duration: 8,
      width: 960,
      height: 540,
      source: 'local',
      ext: 'mp4',
      src: 'assets/media/product_demo.mp4',
      poster: 'assets/media/product_demo.jpg',
      tone: 'amber',
    },
    {
      id: '作品/花絮/幕后花絮_横版.mp4',
      kind: 'video',
      title: '幕后花絮_横版.mp4',
      fileName: '幕后花絮_横版.mp4',
      folder: '作品/花絮',
      relativePath: '作品/花絮/幕后花絮_横版.mp4',
      size: 38.7 * MB,
      mtimeMs: now - 1 * DAY - 2 * 3600_000,
      duration: 5,
      width: 960,
      height: 540,
      source: 'local',
      ext: 'mp4',
      src: 'assets/media/vlog_bts.mp4',
      poster: 'assets/media/vlog_bts.jpg',
      tone: 'mint',
    },
    {
      id: '素材/分镜/竖版故事_04.mp4',
      kind: 'video',
      title: '竖版故事_04.mp4',
      fileName: '竖版故事_04.mp4',
      folder: '素材/分镜',
      relativePath: '素材/分镜/竖版故事_04.mp4',
      size: 12.4 * MB,
      mtimeMs: now - 6 * DAY,
      duration: 4,
      width: 540,
      height: 960,
      source: 'local',
      ext: 'mp4',
      src: 'assets/media/story_vertical.mp4',
      poster: 'assets/media/story_vertical.jpg',
      tone: 'mono',
    },
    {
      id: '链接/https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
      kind: 'video',
      title: '在线参考片_花.mp4',
      fileName: 'flower.mp4',
      folder: '链接',
      relativePath: '',
      size: 5.8 * MB,
      mtimeMs: now - 1 * DAY - 6 * 3600_000,
      duration: 5,
      width: 960,
      height: 540,
      source: 'url',
      ext: 'mp4',
      src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
      poster: '',
      tone: 'remote',
    },
    {
      id: '素材/封面/封面_横版_01.jpg',
      kind: 'image',
      title: '封面_横版_01.jpg',
      fileName: '封面_横版_01.jpg',
      folder: '素材/封面',
      relativePath: '素材/封面/封面_横版_01.jpg',
      size: 12.8 * MB,
      mtimeMs: now - 3 * 3600_000,
      duration: 0,
      width: 1600,
      height: 900,
      source: 'local',
      ext: 'jpg',
      src: 'assets/media/cover_horizontal_01.jpg',
      poster: 'assets/media/cover_horizontal_01.jpg',
      tone: 'blue',
    },
    {
      id: '素材/封面/封面_竖版_02.jpg',
      kind: 'image',
      title: '封面_竖版_02.jpg',
      fileName: '封面_竖版_02.jpg',
      folder: '素材/封面',
      relativePath: '素材/封面/封面_竖版_02.jpg',
      size: 9.4 * MB,
      mtimeMs: now - 1 * DAY,
      duration: 0,
      width: 900,
      height: 1200,
      source: 'local',
      ext: 'jpg',
      src: 'assets/media/cover_vertical_02.jpg',
      poster: 'assets/media/cover_vertical_02.jpg',
      tone: 'amber',
    },
    {
      id: '素材/封面/产品细节_微距_03.jpg',
      kind: 'image',
      title: '产品细节_微距_03.jpg',
      fileName: '产品细节_微距_03.jpg',
      folder: '素材/封面',
      relativePath: '素材/封面/产品细节_微距_03.jpg',
      size: 18.2 * MB,
      mtimeMs: now - 4 * DAY,
      duration: 0,
      width: 1400,
      height: 1050,
      source: 'local',
      ext: 'jpg',
      src: 'assets/media/detail_03.jpg',
      poster: 'assets/media/detail_03.jpg',
      tone: 'mint',
    },
    {
      id: '素材/分镜/分镜板_15s_04.jpg',
      kind: 'image',
      title: '分镜板_15s_04.jpg',
      fileName: '分镜板_15s_04.jpg',
      folder: '素材/分镜',
      relativePath: '素材/分镜/分镜板_15s_04.jpg',
      size: 6.1 * MB,
      mtimeMs: now - 9 * DAY,
      duration: 0,
      width: 1600,
      height: 900,
      source: 'local',
      ext: 'jpg',
      src: 'assets/media/storyboard_04.jpg',
      poster: 'assets/media/storyboard_04.jpg',
      tone: 'mono',
    },
    {
      id: '素材/封面/封面_AB测试_05.jpg',
      kind: 'image',
      title: '封面_AB测试_05.jpg',
      fileName: '封面_AB测试_05.jpg',
      folder: '素材/封面',
      relativePath: '素材/封面/封面_AB测试_05.jpg',
      size: 3.7 * MB,
      mtimeMs: now - 18 * DAY,
      duration: 0,
      width: 1200,
      height: 800,
      source: 'local',
      ext: 'jpg',
      src: 'assets/media/thumbnail_05.jpg',
      poster: 'assets/media/thumbnail_05.jpg',
      tone: 'paper',
    },
    {
      id: '音频/BGM/BGM_轻快_02.mp3',
      kind: 'audio',
      title: 'BGM_轻快_02.mp3',
      fileName: 'BGM_轻快_02.mp3',
      folder: '音频/BGM',
      relativePath: '音频/BGM/BGM_轻快_02.mp3',
      size: 7.8 * MB,
      mtimeMs: now - 3 * DAY,
      duration: 24,
      width: 0,
      height: 0,
      source: 'local',
      ext: 'mp3',
      src: 'assets/media/bgm_light.mp3',
      poster: '',
      tone: 'mint',
    },
    {
      id: '音频/音效/转场音效_终版.wav',
      kind: 'audio',
      title: '转场音效_终版.wav',
      fileName: '转场音效_终版.wav',
      folder: '音频/音效',
      relativePath: '音频/音效/转场音效_终版.wav',
      size: 48.2 * MB,
      mtimeMs: now - 8 * DAY,
      duration: 3,
      width: 0,
      height: 0,
      source: 'local',
      ext: 'wav',
      src: 'assets/media/sfx_transition.wav',
      poster: '',
      tone: 'amber',
    },
    {
      id: '链接/https://www.bilibili.com/video/BV1xx411c7mD',
      kind: 'link',
      title: '参考：B站爆款结构拆解',
      fileName: 'B站爆款结构拆解',
      folder: '链接',
      relativePath: '',
      size: undefined,
      mtimeMs: now - 3 * DAY,
      duration: 0,
      width: 0,
      height: 0,
      source: 'url',
      ext: 'html',
      src: '',
      url: 'https://www.bilibili.com/video/BV1xx411c7mD',
      poster: '',
      tone: 'violet',
    },
  ]

  const itemById = new Map(items.map((item) => [item.id, item]))
  const itemForTab = items.find((item) => item.id.includes('opening_4k')) ?? items[0]

  const state = {
    view: 'grid',
    query: '',
    types: [],
    folder: '',
    time: 'all',
    size: 'all',
    sort: 'time',
    dir: 'desc',
    filterOpen: false,
    theme: 'dark',
    focus: false,
    inlineId: null,
    inlineMedia: null,
    overlayId: null,
    overlayZoom: 1,
    overlayPan: { x: 0, y: 0 },
    media: null,
    volume: 1,
    muted: false,
    loop: false,
    speed: 1,
    lastFocus: null,
    tabItemId: itemForTab.id,
  }

  const TYPE_LABELS = { all: '全部', video: '视频', image: '图片', audio: '音频', link: '链接' }
  const TYPE_ICONS = { all: 'i-grid', video: 'i-video', image: 'i-image', audio: 'i-audio', link: 'i-link' }
  const TYPE_ORDER = { video: 0, image: 1, audio: 2, link: 3 }
  const COLLATOR = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' })

  const COVERS = [
    ['#1d3f5c', '#081520'],
    ['#4a2a12', '#160a05'],
    ['#123f35', '#061a15'],
    ['#2a2148', '#0d0918'],
    ['#3c2f16', '#140f06'],
    ['#24343f', '#0a1015'],
  ]

  function icon(name) {
    return `<svg aria-hidden="true"><use href="#${name}"/></svg>`
  }

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
  }

  function formatBytes(bytes) {
    if (bytes === undefined) return '—'
    if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(2)} GB`
    if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
    if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`
    return `${bytes} B`
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) seconds = 0
    const total = Math.round(seconds)
    const h = Math.floor(total / 3600)
    const m = Math.floor((total % 3600) / 60)
    const s = total % 60
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  function formatDate(ms) {
    if (!ms) return '—'
    const date = new Date(ms)
    const today = new Date()
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
    const hh = String(date.getHours()).padStart(2, '0')
    const mm = String(date.getMinutes()).padStart(2, '0')
    if (ms >= start) return `今天 ${hh}:${mm}`
    if (ms >= start - DAY) return `昨天 ${hh}:${mm}`
    if (date.getFullYear() === today.getFullYear()) return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  function domainOf(item) {
    try { return new URL(item.url || item.src).hostname.replace(/^www\./, '') } catch { return '链接' }
  }

  function dirOf(item) {
    return item.folder || '根目录'
  }

  function kindLabel(item) {
    return TYPE_LABELS[item.kind] ?? '媒体'
  }

  function mediaMeta(item) {
    if (item.kind === 'link') return `${domainOf(item)} · 网页`
    if (item.kind === 'image') return `${item.width}×${item.height} · ${formatBytes(item.size)}`
    return `${formatTime(item.duration)} · ${formatBytes(item.size)}`
  }

  function cardMeta(item) {
    return `${dirOf(item)} · ${formatBytes(item.size)} · ${formatDate(item.mtimeMs)}`
  }

  function coverVars(item, index) {
    const pair = COVERS[index % COVERS.length]
    return `--cover-a:${pair[0]};--cover-b:${pair[1]};`
  }

  function seeded(seed) {
    let a = 0
    for (const char of seed) a = (a * 31 + char.charCodeAt(0)) | 0
    return () => {
      a |= 0
      a = (a + 0x6D2B79F5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  function waveBars(seed, count, min = 24, max = 92) {
    const rand = seeded(seed)
    return Array.from({ length: count }, (_, index) => {
      const height = Math.round(min + rand() * (max - min))
      const delay = (rand() * 0.8).toFixed(2)
      return `<i style="--h:${height}%;--d:${delay}s"></i>`
    }).join('')
  }

  function getFiltered() {
    const query = state.query.trim().toLowerCase()
    const tokens = query ? query.split(/\s+/).filter(Boolean) : []
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const timeFloor = state.time === 'today'
      ? startOfToday.getTime()
      : state.time === '7d'
        ? now - 7 * DAY
        : state.time === '30d'
          ? now - 30 * DAY
          : null

    return items.filter((item) => {
      if (state.types.length > 0 && !state.types.includes(item.kind)) return false
      if (state.folder && item.folder !== state.folder) return false
      if (timeFloor !== null && item.mtimeMs < timeFloor) return false
      if (state.size !== 'all') {
        if (item.size === undefined) return false
        if (state.size === 'small' && !(item.size < 10 * MB)) return false
        if (state.size === 'medium' && !(item.size >= 10 * MB && item.size <= 100 * MB)) return false
        if (state.size === 'large' && !(item.size > 100 * MB)) return false
      }
      if (tokens.length > 0) {
        const haystack = `${item.title} ${item.fileName} ${item.folder} ${item.ext} ${item.url ?? ''}`.toLowerCase()
        if (!tokens.every((token) => haystack.includes(token))) return false
      }
      return true
    }).sort(compareItems)
  }

  function compareItems(a, b) {
    const factor = state.dir === 'asc' ? 1 : -1
    let result = 0
    if (state.sort === 'name') result = COLLATOR.compare(a.title, b.title)
    else if (state.sort === 'size') result = (a.size ?? -1) - (b.size ?? -1)
    else if (state.sort === 'type') result = (TYPE_ORDER[a.kind] - TYPE_ORDER[b.kind]) || COLLATOR.compare(a.title, b.title)
    else result = a.mtimeMs - b.mtimeMs
    if (result === 0) result = COLLATOR.compare(a.title, b.title)
    return result * factor
  }

  function typeCounts() {
    const counts = { video: 0, image: 0, audio: 0, link: 0 }
    for (const item of items) counts[item.kind] += 1
    return counts
  }

  function folderCount() {
    return new Set(items.map((item) => item.folder).filter(Boolean)).size
  }

  function activeFilterCount() {
    return state.types.length
      + (state.folder ? 1 : 0)
      + (state.time !== 'all' ? 1 : 0)
      + (state.size !== 'all' ? 1 : 0)
  }

  function timeLabel(value) {
    return { today: '今天', '7d': '近 7 天', '30d': '近 30 天' }[value] ?? ''
  }

  function sizeLabel(value) {
    return { small: '小于 10 MB', medium: '10–100 MB', large: '大于 100 MB' }[value] ?? ''
  }

  function renderHeader() {
    const counts = typeCounts()
    const totalSize = items.reduce((sum, item) => sum + (item.size ?? 0), 0)
    $('countText').textContent = `${items.length} 个媒体`
    $('folderText').textContent = `${folderCount()} 个文件夹`
    $('sizeText').textContent = formatBytes(totalSize)

    const row = $('typeRow')
    const allActive = state.types.length === 0
    row.innerHTML = [
      `<button class="type-chip${allActive ? ' is-active' : ''}" data-kind="all">${icon('i-grid')}<span>全部</span><b>${items.length}</b></button>`,
      ...['video', 'image', 'audio', 'link'].map((kind) =>
        `<button class="type-chip${state.types.includes(kind) ? ' is-active' : ''}" data-kind="${kind}">${icon(TYPE_ICONS[kind])}<span>${TYPE_LABELS[kind]}</span><b>${counts[kind]}</b></button>`),
    ].join('')

    const count = activeFilterCount()
    const badge = $('filterCount')
    badge.hidden = count === 0
    badge.textContent = String(count)
    $('filterBtn').setAttribute('aria-expanded', String(state.filterOpen))
    $('filterPanel').hidden = !state.filterOpen
    $('folderSelect').value = state.folder
    $('timeSelect').value = state.time
    $('sizeSelect').value = state.size
    $('sortSelect').value = state.sort
    $('dirLabel').textContent = state.dir === 'asc' ? '升序' : '降序'
    $('dirBtn').dataset.dir = state.dir

    const chips = []
    for (const kind of state.types) chips.push({ key: `type:${kind}`, label: TYPE_LABELS[kind] })
    if (state.folder) chips.push({ key: 'folder', label: state.folder })
    if (state.time !== 'all') chips.push({ key: 'time', label: timeLabel(state.time) })
    if (state.size !== 'all') chips.push({ key: 'size', label: sizeLabel(state.size) })
    $('activeFilters').innerHTML = chips.map((chip) =>
      `<span class="chip">${esc(chip.label)}<button data-filter="${chip.key}" aria-label="移除筛选">×</button></span>`).join('')
  }

  function renderFolderOptions() {
    const folders = [...new Set(items.map((item) => item.folder).filter(Boolean))].sort(COLLATOR.compare)
    $('folderSelect').innerHTML = [
      `<option value="">全部文件夹</option>`,
      ...folders.map((folder) => `<option value="${esc(folder)}">${esc(folder)}</option>`),
    ].join('')
  }

  function cardThumb(item, index) {
    if (item.kind === 'video') {
      if (item.source === 'url') {
        return `<div class="link-poster direct">
          <div class="lp-bar"><i></i><i></i><i></i><span class="lp-domain">${esc(domainOf(item))}</span></div>
          <div class="lp-body"><span class="lp-glyph">${icon('i-video')}</span><b class="lp-title">${esc(item.title)}</b><span class="lp-tag">REMOTE MEDIA</span></div>
        </div>`
      }
      return `<img class="poster" src="${esc(item.poster)}" alt="" loading="lazy" decoding="async">`
    }
    if (item.kind === 'image') {
      return `<img class="poster" src="${esc(item.poster)}" alt="" loading="lazy" decoding="async">`
    }
    if (item.kind === 'audio') {
      return `<div class="audio-poster" style="${coverVars(item, index)}">
        <div class="ap-top"><span class="ap-glyph">${icon('i-audio')}</span><span class="mono">${esc(item.ext.toUpperCase())}</span></div>
        <div class="ap-wave">${waveBars(item.id, 30)}</div>
        <div class="ap-bottom">${formatTime(item.duration)} · ${formatBytes(item.size)}</div>
      </div>`
    }
    return `<div class="link-poster">
      <div class="lp-bar"><i></i><i></i><i></i><span class="lp-domain">${esc(domainOf(item))}</span></div>
      <div class="lp-body"><span class="lp-glyph">${icon('i-link')}</span><b class="lp-title">${esc(item.title)}</b><span class="lp-tag">WEB LINK</span></div>
    </div>`
  }

  function cardActions(item) {
    const canPlay = item.kind === 'video' || item.kind === 'audio'
    return `<div class="card-actions">
      ${canPlay ? `<button class="mini-act" data-action="play" aria-label="原地播放" title="原地播放">${icon('i-play')}</button>` : ''}
      <button class="mini-act" data-action="open" aria-label="放大查看" title="放大查看">${icon(item.kind === 'link' ? 'i-external' : 'i-full')}</button>
    </div>`
  }

  function durationBadge(item) {
    if (item.kind === 'video') return `<span class="duration">${formatTime(item.duration)}</span>`
    if (item.kind === 'audio') return `<span class="duration">${formatTime(item.duration)}</span>`
    if (item.kind === 'image') return `<span class="duration">${item.width}×${item.height}</span>`
    return `<span class="duration">网页</span>`
  }

  function makeCard(item, index) {
    const card = document.createElement('article')
    card.className = 'card'
    card.dataset.id = item.id
    card.dataset.kind = item.kind
    card.tabIndex = 0
    card.setAttribute('aria-label', `${item.title}，${kindLabel(item)}`)
    card.style.setProperty('--i', String(index))

    const canPlay = item.kind === 'video' || item.kind === 'audio'
    card.innerHTML = `
      <div class="card-media">
        ${cardThumb(item, index)}
        <span class="card-index">${String(index + 1).padStart(2, '0')}</span>
        <span class="kind-badge" data-kind="${item.kind}"><i></i>${kindLabel(item)}</span>
        ${durationBadge(item)}
        ${canPlay ? `<button class="play-btn" data-action="play" aria-label="播放 ${esc(item.title)}">${icon('i-play')}</button>` : ''}
        ${cardActions(item)}
      </div>
      <div class="card-info">
        <h3 title="${esc(item.title)}">${esc(item.title)}</h3>
        <p>${esc(cardMeta(item))}</p>
        <span class="card-playing-note"><i class="live-dot"></i>正在播放</span>
      </div>`
    return card
  }

  function rowThumb(item, index) {
    if (item.kind === 'video' && item.poster) return `<img src="${esc(item.poster)}" alt="" loading="lazy">`
    if (item.kind === 'image') return `<img src="${esc(item.poster)}" alt="" loading="lazy">`
    if (item.kind === 'video') return `<div style="width:100%;height:100%;display:grid;place-items:center;background:linear-gradient(145deg,#0f241d,#081310);color:#6fd6b5">${icon('i-video')}</div>`
    if (item.kind === 'audio') return `<div style="width:100%;height:100%;display:grid;place-items:center;${coverVars(item, index)}background:linear-gradient(145deg,var(--cover-a),var(--cover-b));color:rgba(255,255,255,.8)">${icon('i-audio')}</div>`
    return `<div style="width:100%;height:100%;display:grid;place-items:center;background:linear-gradient(145deg,#1a1826,#0e0d16);color:#c7b8ff">${icon('i-link')}</div>`
  }

  function makeRow(item, index) {
    const row = document.createElement('div')
    row.className = 'row'
    row.dataset.id = item.id
    row.dataset.kind = item.kind
    row.tabIndex = 0
    row.style.setProperty('--i', String(index))
    const canPlay = item.kind === 'video' || item.kind === 'audio'
    row.innerHTML = `
      <div class="row-thumb">${rowThumb(item, index)}<span class="row-dur">${item.kind === 'video' || item.kind === 'audio' ? formatTime(item.duration) : kindLabel(item)}</span></div>
      <div class="row-main"><b>${esc(item.title)}</b><small>${esc(dirOf(item))}</small></div>
      <div class="row-kind" data-kind="${item.kind}"><i></i>${kindLabel(item)}</div>
      <div class="row-meta">${item.kind === 'image' ? `${item.width}×${item.height}` : item.kind === 'link' ? esc(domainOf(item)) : formatTime(item.duration)}</div>
      <div class="row-size">${formatBytes(item.size)}</div>
      <div class="row-time">${formatDate(item.mtimeMs)}</div>
      <button class="row-play" data-action="${canPlay ? 'play' : 'open'}" aria-label="${canPlay ? '原地播放' : '查看'}">${icon(canPlay ? 'i-play' : item.kind === 'link' ? 'i-external' : 'i-full')}</button>`
    return row
  }

  function renderCards() {
    const filtered = getFiltered()
    const grid = $('grid')
    const list = $('list')
    grid.innerHTML = ''
    list.innerHTML = ''
    for (const [index, item] of filtered.entries()) {
      grid.appendChild(makeCard(item, index))
      list.appendChild(makeRow(item, index))
    }
    // The first paint may animate; later filter/search redraws snap into place.
    if (state.hasRendered) {
      grid.classList.add('no-anim')
      list.classList.add('no-anim')
    } else {
      state.hasRendered = true
    }
    grid.hidden = state.view !== 'grid'
    list.hidden = state.view !== 'list'
    $('empty').hidden = filtered.length > 0
    if (filtered.length === 0) grid.hidden = true
    if (filtered.length === 0) list.hidden = true
    $('statusText').textContent = filtered.length === items.length
      ? '已扫描 34 个目录 · 跳过 3.2k 个构建目录'
      : `筛选出 ${filtered.length} / ${items.length} 个媒体 · 已扫描 34 个目录`
    $('gridBtn').classList.toggle('is-active', state.view === 'grid')
    $('listBtn').classList.toggle('is-active', state.view === 'list')
    $('gridBtn').setAttribute('aria-pressed', String(state.view === 'grid'))
    $('listBtn').setAttribute('aria-pressed', String(state.view === 'list'))
  }

  function renderAll() {
    stopInline()
    renderFolderOptions()
    renderHeader()
    renderCards()
  }

  function findItem(id) {
    return itemById.get(id)
  }

  function pauseInline() {
    if (state.inlineMedia) {
      try { state.inlineMedia.pause() } catch { /* ignore */ }
    }
  }

  function stopInline() {
    if (state.inlineMedia) {
      try {
        state.inlineMedia.pause()
        state.inlineMedia.removeAttribute('src')
        state.inlineMedia.load?.()
      } catch { /* ignore */ }
      state.inlineMedia.remove()
    }
    state.inlineMedia = null
    const active = document.querySelector('.card[data-playing]')
    if (active) {
      active.removeAttribute('data-playing')
      active.querySelector('.inline-media')?.remove()
      active.querySelector('.inline-bar')?.remove()
      active.querySelector('.inline-audio')?.remove()
    }
    state.inlineId = null
  }

  function inlineBar(media, item) {
    const bar = document.createElement('div')
    bar.className = 'inline-bar'
    const playBtn = document.createElement('button')
    playBtn.type = 'button'
    playBtn.setAttribute('aria-label', '播放/暂停')
    playBtn.innerHTML = icon('i-pause')
    const seek = document.createElement('input')
    seek.type = 'range'
    seek.className = 'inline-seek'
    seek.min = '0'
    seek.max = '1000'
    seek.value = '0'
    seek.setAttribute('aria-label', '播放进度')
    const time = document.createElement('span')
    time.className = 'inline-time mono'
    time.textContent = '00:00'
    const expand = document.createElement('button')
    expand.type = 'button'
    expand.setAttribute('aria-label', '放大')
    expand.innerHTML = icon('i-full')
    bar.append(playBtn, seek, time, expand)

    const sync = () => {
      const duration = Number.isFinite(media.duration) && media.duration > 0 ? media.duration : item.duration
      seek.value = String(duration ? (media.currentTime / duration) * 1000 : 0)
      time.textContent = formatTime(media.currentTime)
      playBtn.innerHTML = icon(media.paused ? 'i-play' : 'i-pause')
    }
    playBtn.addEventListener('click', (event) => {
      event.stopPropagation()
      if (media.paused) media.play().catch(() => {})
      else media.pause()
    })
    seek.addEventListener('click', (event) => event.stopPropagation())
    seek.addEventListener('input', () => {
      const duration = Number.isFinite(media.duration) && media.duration > 0 ? media.duration : item.duration
      media.currentTime = (Number(seek.value) / 1000) * duration
    })
    expand.addEventListener('click', (event) => {
      event.stopPropagation()
      openOverlay(item, media.currentTime)
    })
    media.addEventListener('play', sync)
    media.addEventListener('pause', sync)
    media.addEventListener('timeupdate', sync)
    media.addEventListener('error', () => {
      toast('视频加载失败，检查链接或网络')
      stopInline()
    })
    sync()
    return bar
  }

  function buildInlineAudio(item, card) {
    const media = document.createElement('audio')
    media.src = item.src
    media.autoplay = true
    media.loop = state.loop
    media.volume = state.volume
    media.muted = state.muted
    media.playbackRate = state.speed
    media.style.display = 'none'

    const box = document.createElement('div')
    box.className = 'inline-audio'
    box.dataset.playing = 'true'
    box.style.cssText = coverVars(item, items.indexOf(item))
    box.innerHTML = `
      <div class="ia-top"><span class="ia-glyph">${icon('i-audio')}</span><b>${esc(item.title)}</b></div>
      <div class="ia-bars">${waveBars(item.id, 34, 18, 96)}</div>
      <div class="ia-controls">
        <button type="button" data-inline="toggle" aria-label="播放/暂停">${icon('i-pause')}</button>
        <input type="range" min="0" max="1000" value="0" aria-label="播放进度">
        <span class="mono">00:00 / ${formatTime(item.duration)}</span>
        <button type="button" data-inline="expand" aria-label="放大">${icon('i-full')}</button>
      </div>`
    const playBtn = box.querySelector('[data-inline="toggle"]')
    const seek = box.querySelector('input')
    const time = box.querySelector('.mono')
    const sync = () => {
      const duration = Number.isFinite(media.duration) && media.duration > 0 ? media.duration : item.duration
      seek.value = String(duration ? (media.currentTime / duration) * 1000 : 0)
      time.textContent = formatTime(media.currentTime)
      playBtn.innerHTML = icon(media.paused ? 'i-play' : 'i-pause')
      box.dataset.playing = String(!media.paused)
    }
    playBtn.addEventListener('click', (event) => {
      event.stopPropagation()
      if (media.paused) media.play().catch(() => {})
      else media.pause()
    })
    seek.addEventListener('click', (event) => event.stopPropagation())
    seek.addEventListener('input', () => {
      const duration = Number.isFinite(media.duration) && media.duration > 0 ? media.duration : item.duration
      media.currentTime = (Number(seek.value) / 1000) * duration
    })
    box.querySelector('[data-inline="expand"]').addEventListener('click', (event) => {
      event.stopPropagation()
      openOverlay(item, media.currentTime)
    })
    media.addEventListener('timeupdate', sync)
    media.addEventListener('play', sync)
    media.addEventListener('pause', sync)
    media.addEventListener('error', () => {
      toast('音频加载失败')
      stopInline()
    })
    card.querySelector('.card-media').append(box, media)
    state.inlineMedia = media
    media.play().catch(() => {})
    sync()
  }

  function playInline(item) {
    if (!item || (item.kind !== 'video' && item.kind !== 'audio')) return
    const card = document.querySelector(`.card[data-id="${CSS.escape(item.id)}"]`)
    if (!card) return
    if (state.inlineId === item.id && state.inlineMedia) {
      if (state.inlineMedia.paused) state.inlineMedia.play().catch(() => {})
      else state.inlineMedia.pause()
      return
    }
    stopInline()
    state.inlineId = item.id
    card.setAttribute('data-playing', '')
    card.querySelector('.card-media')?.classList.add('has-inline')

    if (item.kind === 'audio') {
      buildInlineAudio(item, card)
      return
    }

    const media = document.createElement('video')
    media.className = 'inline-media'
    media.src = item.src
    media.autoplay = true
    media.playsInline = true
    media.preload = 'auto'
    media.loop = state.loop
    media.volume = state.volume
    media.muted = state.muted
    media.playbackRate = state.speed
    media.addEventListener('click', (event) => {
      event.stopPropagation()
      openOverlay(item, media.currentTime)
    })
    const mediaBox = card.querySelector('.card-media')
    mediaBox.appendChild(media)
    mediaBox.appendChild(inlineBar(media, item))
    state.inlineMedia = media
    media.play().catch(() => {})
  }

  /* ── overlay ─────────────────────────────────────────────────────────── */
  const ov = {
    title: $('ovTitle'),
    folder: $('ovFolder'),
    kindDot: $('ovKindDot'),
    stage: $('ovStage'),
    media: $('ovMedia'),
    tools: $('ovStageTools'),
    hint: $('ovHint'),
    controls: $('ovControls'),
    play: $('ovPlay'),
    current: $('ovCurrent'),
    duration: $('ovDuration'),
    seek: $('ovSeek'),
    mute: $('ovMute'),
    volume: $('ovVolume'),
    speed: $('ovSpeed'),
    loop: $('ovLoop'),
    pip: $('ovPip'),
    full: $('ovFull'),
    prev: $('ovPrev'),
    next: $('ovNext'),
    meta: $('ovMeta'),
    index: $('ovIndex'),
    film: $('filmstrip'),
    openTab: $('ovOpenTab'),
  }

  function overlayItems() {
    return getFiltered()
  }

  function currentOverlayItem() {
    return state.overlayId ? findItem(state.overlayId) : null
  }

  function openOverlay(item, startAt = 0) {
    if (!item) return
    if (overlay.hidden) state.lastFocus = document.activeElement
    stopInline()
    state.overlayId = item.id
    state.overlayZoom = 1
    state.overlayPan = { x: 0, y: 0 }
    renderOverlay(item, startAt)
    overlay.hidden = false
    panel.classList.add('overlay-open')
    requestAnimationFrame(() => $('ovClose').focus())
  }

  function closeOverlay() {
    const media = state.media
    if (media) {
      try {
        media.pause()
        media.removeAttribute('src')
        media.load?.()
      } catch { /* ignore */ }
    }
    state.media = null
    state.overlayId = null
    overlay.hidden = true
    panel.classList.remove('overlay-open')
    ov.media.innerHTML = ''
    ov.tools.innerHTML = ''
    ov.hint.textContent = ''
    if (state.lastFocus && typeof state.lastFocus.focus === 'function') state.lastFocus.focus()
  }

  function syncControls() {
    const media = state.media
    if (!media) return
    const duration = Number.isFinite(media.duration) && media.duration > 0 ? media.duration : currentOverlayItem()?.duration ?? 0
    ov.current.textContent = formatTime(media.currentTime)
    ov.duration.textContent = formatTime(duration)
    ov.seek.value = String(duration ? (media.currentTime / duration) * 1000 : 0)
    ov.play.innerHTML = icon(media.paused ? 'i-play' : 'i-pause')
    ov.play.setAttribute('aria-label', media.paused ? '播放' : '暂停')
    ov.mute.innerHTML = icon(media.muted || media.volume === 0 ? 'i-mute' : 'i-volume')
    ov.loop.setAttribute('aria-pressed', String(media.loop))
    ov.speed.value = String(media.playbackRate)
    ov.volume.value = String(Math.round(media.volume * 100))
  }

  function showStageError(message) {
    ov.hint.textContent = message
    toast(message)
  }

  function setStageBackdrop(src) {
    if (!src) return
    const backdrop = document.createElement('div')
    backdrop.className = 'stage-backdrop'
    backdrop.style.backgroundImage = `url("${src}")`
    ov.stage.insertBefore(backdrop, ov.media)
  }

  function buildVideoOverlay(item, startAt) {
    if (item.poster) setStageBackdrop(item.poster)
    const media = document.createElement('video')
    media.src = item.src
    media.playsInline = true
    media.preload = 'metadata'
    media.autoplay = true
    if (item.poster) media.poster = item.poster
    media.volume = state.volume
    media.muted = state.muted
    media.loop = state.loop
    media.playbackRate = state.speed
    media.addEventListener('click', () => {
      if (media.paused) media.play().catch(() => {})
      else media.pause()
    })
    media.addEventListener('loadedmetadata', () => {
      if (startAt > 0) media.currentTime = startAt
      syncControls()
    })
    media.addEventListener('timeupdate', syncControls)
    media.addEventListener('play', syncControls)
    media.addEventListener('pause', syncControls)
    media.addEventListener('ended', syncControls)
    media.addEventListener('error', () => showStageError(item.source === 'url' ? '在线视频加载失败：可能是网络、防盗链或格式不支持' : '视频加载失败：格式或文件不可读'))
    ov.media.innerHTML = ''
    ov.media.appendChild(media)
    ov.hint.textContent = item.source === 'url' ? '在线直链 · 浏览器直接加载' : '本地文件 · Range 流式读取'
    state.media = media
    media.play().catch(() => syncControls())
    syncControls()
  }

  function buildAudioOverlay(item, startAt) {
    const media = document.createElement('audio')
    media.src = item.src
    media.autoplay = true
    media.volume = state.volume
    media.muted = state.muted
    media.loop = state.loop
    media.playbackRate = state.speed

    const stage = document.createElement('div')
    stage.className = 'audio-stage'
    stage.style.cssText = coverVars(item, items.indexOf(item))
    stage.innerHTML = `
      <div class="audio-art">${icon('i-audio')}</div>
      <div class="audio-waves playing">${waveBars(item.id, 48, 12, 100)}</div>
      <div class="audio-title"><b>${esc(item.title)}</b><span>${esc(dirOf(item))} · ${esc(item.ext.toUpperCase())} · ${formatBytes(item.size)}</span></div>`
    stage.appendChild(media)
    ov.media.innerHTML = ''
    ov.media.appendChild(stage)
    ov.hint.textContent = '音频 · 可在右侧栏内继续播放'
    state.media = media

    media.addEventListener('loadedmetadata', () => {
      if (startAt > 0) media.currentTime = startAt
      syncControls()
    })
    media.addEventListener('timeupdate', syncControls)
    media.addEventListener('play', () => {
      stage.querySelector('.audio-waves')?.classList.add('playing')
      syncControls()
    })
    media.addEventListener('pause', () => {
      stage.querySelector('.audio-waves')?.classList.remove('playing')
      syncControls()
    })
    media.addEventListener('error', () => showStageError('音频加载失败：格式或文件不可读'))
    media.play().catch(() => syncControls())
    syncControls()
  }

  function buildImageOverlay(item) {
    setStageBackdrop(item.src)
    const wrap = document.createElement('div')
    wrap.className = 'image-wrap'
    const img = document.createElement('img')
    img.src = item.src
    img.alt = item.title
    img.draggable = false
    wrap.appendChild(img)
    ov.media.innerHTML = ''
    ov.media.appendChild(wrap)
    ov.hint.textContent = '滚轮缩放 · 拖动平移 · ←/→ 切换'
    ov.tools.innerHTML = `
      <button type="button" data-zoom="out" aria-label="缩小">${icon('i-zoom-out')}</button>
      <button type="button" data-zoom="fit" aria-label="适应窗口">${icon('i-fit')}</button>
      <button type="button" data-zoom="actual" aria-label="实际大小">1:1</button>
      <button type="button" data-zoom="in" aria-label="放大">${icon('i-zoom-in')}</button>`
    state.media = null
    state.overlayZoom = 1
    state.overlayPan = { x: 0, y: 0 }
    applyImageTransform(wrap, img)

    let dragging = false
    let start = { x: 0, y: 0 }
    let origin = { x: 0, y: 0 }
    wrap.addEventListener('pointerdown', (event) => {
      if (state.overlayZoom <= 1) return
      dragging = true
      wrap.classList.add('dragging')
      wrap.setPointerCapture(event.pointerId)
      start = { x: event.clientX, y: event.clientY }
      origin = { ...state.overlayPan }
    })
    wrap.addEventListener('pointermove', (event) => {
      if (!dragging) return
      state.overlayPan = { x: origin.x + event.clientX - start.x, y: origin.y + event.clientY - start.y }
      applyImageTransform(wrap, img)
    })
    const endDrag = () => { dragging = false; wrap.classList.remove('dragging') }
    wrap.addEventListener('pointerup', endDrag)
    wrap.addEventListener('pointercancel', endDrag)
    wrap.addEventListener('dblclick', () => {
      state.overlayZoom = state.overlayZoom > 1.2 ? 1 : 2.2
      if (state.overlayZoom === 1) state.overlayPan = { x: 0, y: 0 }
      applyImageTransform(wrap, img)
    })
    wrap.addEventListener('wheel', (event) => {
      event.preventDefault()
      const next = state.overlayZoom * (event.deltaY < 0 ? 1.12 : 0.9)
      state.overlayZoom = Math.min(6, Math.max(1, next))
      if (state.overlayZoom === 1) state.overlayPan = { x: 0, y: 0 }
      applyImageTransform(wrap, img)
    }, { passive: false })
    ov.tools.onclick = (event) => {
      const action = event.target.closest('[data-zoom]')?.dataset.zoom
      if (!action) return
      if (action === 'in') state.overlayZoom = Math.min(6, state.overlayZoom * 1.25)
      if (action === 'out') state.overlayZoom = Math.max(1, state.overlayZoom / 1.25)
      if (action === 'fit') { state.overlayZoom = 1; state.overlayPan = { x: 0, y: 0 } }
      if (action === 'actual') {
        const rect = ov.stage.getBoundingClientRect()
        const ratio = img.naturalWidth / img.naturalHeight
        const rendered = ratio > rect.width / rect.height ? rect.width : rect.height * ratio
        state.overlayZoom = img.naturalWidth ? Math.min(6, Math.max(1, img.naturalWidth / rendered)) : 2
        state.overlayPan = { x: 0, y: 0 }
      }
      applyImageTransform(wrap, img)
    }
  }

  function applyImageTransform(wrap, img) {
    img.style.transform = `translate(${state.overlayPan.x}px, ${state.overlayPan.y}px) scale(${state.overlayZoom})`
    img.style.cursor = state.overlayZoom > 1 ? 'grab' : 'default'
    wrap.style.cursor = state.overlayZoom > 1 ? 'grab' : 'default'
  }

  function buildLinkOverlay(item) {
    const stage = document.createElement('div')
    stage.className = 'link-stage'
    stage.innerHTML = `
      <span class="ls-glyph">${icon('i-link')}</span>
      <b>${esc(item.title)}</b>
      <code>${esc(item.url || '')}</code>
      <div class="ls-actions">
        <button type="button" class="primary" data-link="open">${icon('i-external')}在浏览器中打开</button>
        <button type="button" data-link="copy">${icon('i-copy')}复制链接</button>
      </div>`
    ov.media.innerHTML = ''
    ov.media.appendChild(stage)
    ov.hint.textContent = '普通网页链接 · 交给 Browser tab'
    ov.tools.innerHTML = ''
    state.media = null
    stage.querySelector('[data-link="open"]').addEventListener('click', () => {
      window.open(item.url, '_blank', 'noopener,noreferrer')
      toast('已在新窗口打开链接')
    })
    stage.querySelector('[data-link="copy"]').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(item.url)
        toast('链接已复制')
      } catch {
        toast('复制失败，请手动选择链接')
      }
    })
  }

  function renderOverlay(item, startAt) {
    const isMedia = item.kind === 'video' || item.kind === 'audio'
    ov.title.textContent = item.title
    ov.folder.textContent = `${dirOf(item)} · ${kindLabel(item)}`
    ov.kindDot.style.background = item.kind === 'audio' ? 'var(--mint)' : item.kind === 'image' ? 'var(--accent)' : item.kind === 'link' ? '#b7a6ff' : 'var(--tape)'
    ov.controls.className = `controls${item.kind === 'image' ? ' is-image' : ''}${item.kind === 'link' ? ' is-link' : ''}`
    ov.stage.querySelector('.stage-backdrop')?.remove()
    ov.media.innerHTML = ''
    ov.tools.innerHTML = ''
    ov.hint.textContent = ''
    state.media = null

    if (item.kind === 'video') buildVideoOverlay(item, startAt)
    else if (item.kind === 'audio') buildAudioOverlay(item, startAt)
    else if (item.kind === 'image') buildImageOverlay(item)
    else buildLinkOverlay(item)

    ov.meta.textContent = item.kind === 'link'
      ? `${domainOf(item)} · 网页链接`
      : item.kind === 'image'
        ? `${item.width}×${item.height} · ${item.ext.toUpperCase()} · ${formatBytes(item.size)}`
        : item.kind === 'audio'
          ? `${item.ext.toUpperCase()} · ${formatTime(item.duration)} · ${formatBytes(item.size)}`
          : `${item.width}×${item.height} · ${formatTime(item.duration)} · ${formatBytes(item.size)}`
    const filtered = overlayItems()
    const index = filtered.findIndex((entry) => entry.id === item.id)
    ov.index.textContent = index >= 0 ? `${index + 1} / ${filtered.length}` : '不在当前筛选'
    renderFilmstrip(item)
    if (isMedia) syncControls()
  }

  function renderFilmstrip(activeItem) {
    const filtered = overlayItems()
    ov.film.innerHTML = ''
    for (const item of filtered) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = `film-thumb${item.id === activeItem.id ? ' is-active' : ''}`
      button.dataset.id = item.id
      button.title = item.title
      if (item.kind === 'audio') {
        button.classList.add('audio-thumb')
        button.style.cssText = coverVars(item, items.indexOf(item))
        button.innerHTML = icon('i-audio')
      } else if (item.kind === 'link') {
        button.classList.add('link-thumb')
        button.innerHTML = icon('i-link')
      } else if (item.kind === 'video' && !item.poster) {
        button.classList.add('link-thumb')
        button.style.background = 'linear-gradient(145deg,#0f241d,#081310)'
        button.style.color = '#6fd6b5'
        button.innerHTML = icon('i-video')
      } else {
        button.innerHTML = `<img src="${esc(item.poster)}" alt="" loading="lazy">`
        const dot = document.createElement('span')
        dot.className = 'ft-kind'
        dot.style.background = item.kind === 'video' ? 'var(--tape)' : 'var(--accent)'
        button.appendChild(dot)
      }
      button.addEventListener('click', () => openOverlay(item))
      ov.film.appendChild(button)
    }
    ov.film.querySelector('.is-active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  function navigateOverlay(delta) {
    const current = currentOverlayItem()
    if (!current) return
    const filtered = overlayItems()
    if (filtered.length === 0) return
    const index = filtered.findIndex((item) => item.id === current.id)
    const next = filtered[(index + delta + filtered.length) % filtered.length]
    openOverlay(next)
  }

  function togglePlay() {
    const media = state.media
    if (!media) return
    if (media.paused) media.play().catch(() => syncControls())
    else media.pause()
  }

  /* ── filters and view ────────────────────────────────────────────────── */
  function setType(kind) {
    if (kind === 'all') state.types = []
    else if (state.types.includes(kind)) state.types = state.types.filter((entry) => entry !== kind)
    else state.types = [...state.types, kind]
    renderAll()
  }

  function clearFilters() {
    state.types = []
    state.folder = ''
    state.time = 'all'
    state.size = 'all'
    state.sort = 'time'
    state.dir = 'desc'
    state.query = ''
    $('search').value = ''
    renderAll()
  }

  function clearOne(key) {
    if (key.startsWith('type:')) state.types = state.types.filter((kind) => kind !== key.slice(5))
    if (key === 'folder') state.folder = ''
    if (key === 'time') state.time = 'all'
    if (key === 'size') state.size = 'all'
    renderAll()
  }

  /* ── toasts ─────────────────────────────────────────────────────────── */
  function toast(message) {
    const box = document.createElement('div')
    box.className = 'toast'
    box.innerHTML = `${icon('i-check')}<span>${esc(message)}</span>`
    $('toasts').appendChild(box)
    setTimeout(() => {
      box.classList.add('out')
      setTimeout(() => box.remove(), 200)
    }, 2200)
  }

  /* ── events ─────────────────────────────────────────────────────────── */
  function bind() {
    $('typeRow').addEventListener('click', (event) => {
      const chip = event.target.closest('.type-chip')
      if (chip) setType(chip.dataset.kind)
    })

    $('search').addEventListener('input', () => {
      state.query = $('search').value
      renderAll()
    })

    $('filterBtn').addEventListener('click', () => {
      state.filterOpen = !state.filterOpen
      renderHeader()
    })

    $('folderSelect').addEventListener('change', () => { state.folder = $('folderSelect').value; renderAll() })
    $('timeSelect').addEventListener('change', () => { state.time = $('timeSelect').value; renderAll() })
    $('sizeSelect').addEventListener('change', () => { state.size = $('sizeSelect').value; renderAll() })
    $('sortSelect').addEventListener('change', () => { state.sort = $('sortSelect').value; renderAll() })
    $('dirBtn').addEventListener('click', () => { state.dir = state.dir === 'asc' ? 'desc' : 'asc'; renderAll() })
    $('resetBtn').addEventListener('click', clearFilters)
    $('emptyReset').addEventListener('click', clearFilters)

    $('activeFilters').addEventListener('click', (event) => {
      const key = event.target.closest('[data-filter]')?.dataset.filter
      if (key) clearOne(key)
    })

    $('gridBtn').addEventListener('click', () => { state.view = 'grid'; renderAll() })
    $('listBtn').addEventListener('click', () => { state.view = 'list'; renderAll() })

    $('scanBtn').addEventListener('click', () => {
      const banner = $('scanBanner')
      banner.hidden = false
      $('scanBtn').disabled = true
      setTimeout(() => {
        banner.hidden = true
        $('scanBtn').disabled = false
        $('statusText').textContent = '已扫描 34 个目录 · 跳过 3.2k 个构建目录 · 刚刚'
        toast('扫描完成，发现 13 个媒体')
      }, 720)
    })

    const libraryClick = (event) => {
      const host = event.target.closest('.card, .row')
      if (!host) return
      const item = findItem(host.dataset.id)
      if (!item) return
      const action = event.target.closest('[data-action]')?.dataset.action
      if (action === 'play') {
        event.preventDefault()
        // Inline playback is a card affordance; list rows open the full player.
        if (state.view === 'grid') playInline(item)
        else openOverlay(item)
        return
      }
      if (action === 'open') {
        event.preventDefault()
        openOverlay(item)
        return
      }
      openOverlay(item)
    }
    $('grid').addEventListener('click', libraryClick)
    $('list').addEventListener('click', libraryClick)
    $('grid').addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      const card = event.target.closest('.card')
      if (!card) return
      event.preventDefault()
      const item = findItem(card.dataset.id)
      if (!item) return
      if (event.key === ' ' && (item.kind === 'video' || item.kind === 'audio')) playInline(item)
      else openOverlay(item)
    })
    $('list').addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return
      const row = event.target.closest('.row')
      if (!row) return
      const item = findItem(row.dataset.id)
      if (item) openOverlay(item)
    })

    $('themeBtn').addEventListener('click', () => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark'
      document.documentElement.dataset.theme = state.theme
      $('themeBtn').innerHTML = icon(state.theme === 'dark' ? 'i-sun' : 'i-moon')
      toast(state.theme === 'dark' ? '已切换到深色主题' : '已切换到浅色主题')
    })

    $('focusBtn').addEventListener('click', () => {
      state.focus = !state.focus
      $('app').classList.toggle('focus', state.focus)
      toast(state.focus ? '专注模式：仅保留右侧预览区' : '已退出专注模式')
      $('focusBtn').setAttribute('aria-pressed', String(state.focus))
    })

    $('tabOpening').addEventListener('click', () => {
      const item = findItem(state.tabItemId)
      if (item) openOverlay(item)
    })
    document.querySelector('.tab-close')?.addEventListener('click', (event) => {
      event.stopPropagation()
      $('tabOpening').hidden = true
      toast('已关闭预览标签')
    })

    document.querySelector('[data-open-demo="opening"]')?.addEventListener('click', () => openOverlay(itemForTab))

    $('ovClose').addEventListener('click', closeOverlay)
    $('overlay').addEventListener('click', (event) => {
      if (event.target.matches('[data-close-overlay]')) closeOverlay()
    })
    $('ovPlay').addEventListener('click', togglePlay)
    $('ovSeek').addEventListener('input', () => {
      const media = state.media
      if (!media) return
      const duration = Number.isFinite(media.duration) && media.duration > 0 ? media.duration : currentOverlayItem()?.duration ?? 0
      if (duration) media.currentTime = (Number(ov.seek.value) / 1000) * duration
    })
    $('ovVolume').addEventListener('input', () => {
      if (!state.media) return
      state.volume = Number(ov.volume.value) / 100
      state.media.volume = state.volume
      state.media.muted = state.volume === 0
      state.muted = state.volume === 0
      syncControls()
    })
    $('ovMute').addEventListener('click', () => {
      if (!state.media) return
      state.media.muted = !state.media.muted
      state.muted = state.media.muted
      syncControls()
    })
    $('ovSpeed').addEventListener('change', () => {
      state.speed = Number(ov.speed.value)
      if (state.media) state.media.playbackRate = state.speed
      syncControls()
    })
    $('ovLoop').addEventListener('click', () => {
      state.loop = !state.loop
      if (state.media) state.media.loop = state.loop
      syncControls()
    })
    $('ovPip').addEventListener('click', async () => {
      const media = state.media
      if (!(media instanceof HTMLVideoElement) || !document.pictureInPictureEnabled) {
        toast('当前浏览器不支持画中画')
        return
      }
      try {
        if (document.pictureInPictureElement) await document.exitPictureInPicture()
        else await media.requestPictureInPicture()
      } catch {
        toast('画中画打开失败')
      }
    })
    $('ovFull').addEventListener('click', async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen()
        else await ov.stage.requestFullscreen()
      } catch {
        toast('当前环境不支持全屏')
      }
    })
    $('ovPrev').addEventListener('click', () => navigateOverlay(-1))
    $('ovNext').addEventListener('click', () => navigateOverlay(1))
    $('ovOpenTab').addEventListener('click', () => {
      const item = currentOverlayItem()
      if (!item) return
      if (item.kind === 'link') {
        window.open(item.url, '_blank', 'noopener,noreferrer')
        toast('已在新窗口打开链接')
        return
      }
      state.tabItemId = item.id
      const tab = $('tabOpening')
      tab.hidden = false
      tab.querySelector('.tab-kind').textContent = item.ext.toUpperCase().slice(0, 4)
      tab.querySelector('span:nth-child(2)').textContent = item.title.replace(/\.[^.]+$/, '')
      document.querySelectorAll('.panel-tab').forEach((node) => {
        node.classList.remove('is-active')
        node.setAttribute('aria-selected', 'false')
      })
      tab.classList.add('is-active')
      tab.setAttribute('aria-selected', 'true')
      closeOverlay()
      toast('已在右侧栏打开独立预览标签')
    })

    document.addEventListener('keydown', (event) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable
      if (!overlay.hidden) {
        if (event.key === 'Escape') { event.preventDefault(); closeOverlay(); return }
        if (typing) return
        if (event.key === ' ' || event.code === 'Space') { event.preventDefault(); togglePlay(); return }
        if (event.key === 'ArrowLeft') { event.preventDefault(); navigateOverlay(-1); return }
        if (event.key === 'ArrowRight') { event.preventDefault(); navigateOverlay(1); return }
        if (event.key.toLowerCase() === 'm') { $('ovMute').click(); return }
        if (event.key.toLowerCase() === 'l') { $('ovLoop').click(); return }
        if (event.key.toLowerCase() === 'f') { $('ovFull').click(); return }
        if (event.key === 'Tab') {
          const focusable = $$('button, input, select, [tabindex]:not([tabindex="-1"])', overlay).filter((node) => !node.disabled && node.offsetParent !== null)
          if (focusable.length === 0) return
          const first = focusable[0]
          const last = focusable[focusable.length - 1]
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
        }
        return
      }
      if (event.key === '/' && !typing) {
        event.preventDefault()
        $('search').focus()
        $('search').select()
      }
      if (event.key === 'Escape' && document.activeElement === $('search')) $('search').blur()
    })
  }

  function init() {
    document.documentElement.dataset.theme = state.theme
    $('themeBtn').innerHTML = icon('i-sun')
    renderFolderOptions()
    renderAll()
    bind()
  }

  init()
})()
