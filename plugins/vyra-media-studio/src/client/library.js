/** The right-Sidebar media library, overlay (lightbox), and media tab. */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import Lightbox from 'yet-another-react-lightbox'
import Counter from 'yet-another-react-lightbox/plugins/counter'
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen'
import Inline from 'yet-another-react-lightbox/plugins/inline'
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails'
import Video from 'yet-another-react-lightbox/plugins/video'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import {
  GridCard, ListRow, NativeMedia, lightboxRenderSlide, renderLightboxThumbnail,
} from './components.js'
import { Icon, IconButton } from './icons.js'
import {
  COLLATOR, DAY, PAGE_SIZE, TYPE_LABEL, apiUrl, compareItems, detectLinkKind,
  domainOf, folderOf, formatBytes, makeLinkItem, mediaSrc, parseFileAddress,
  readLinks, sessionFileAddress, slideFor, typeLabel, writeLinks,
} from './helpers.js'

const h = React.createElement
const LIGHTBOX_PLUGINS = [Inline, Video, Zoom, Thumbnails, Counter, Fullscreen]

export function AddLinkForm({ onSubmit, onClose }) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  return h('form', {
    className: 'vms-add-link',
    onSubmit: event => {
      event.preventDefault()
      const value = url.trim()
      if (detectLinkKind(value) === undefined) { setError('请输入 http(s) 开头的链接'); return }
      onSubmit(value, title)
    },
  },
  h('div', { className: 'vms-add-head' }, h('b', null, '添加链接'), h(IconButton, { name: 'close', label: '关闭', onClick: onClose })),
  h('input', { className: 'vms-input', autoFocus: true, value: url, placeholder: 'https://example.com/video.mp4', onChange: event => { setUrl(event.target.value); setError('') } }),
  h('input', { className: 'vms-input', value: title, placeholder: '标题（可选）', onChange: event => setTitle(event.target.value) }),
  h('p', { className: 'vms-hint' }, 'mp4 / webm / mp3 / wav 等直链会直接播放；其他链接保存为网页卡片。'),
  error !== '' && h('p', { className: 'vms-form-error' }, error),
  h('div', { className: 'vms-add-actions' },
    h('button', { type: 'button', className: 'vms-ghost-btn', onClick: onClose }, '取消'),
    h('button', { type: 'submit', className: 'vms-primary-btn' }, '添加')))
}

export function MediaOverlay({ items, initialIndex, sessionId, onClose, onOpenItem, onOpenBrowser, onRemoveLink }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const current = items[currentIndex] ?? items[0]
  const slides = useMemo(() => items.map((item, index) => slideFor(item, index, sessionId)), [items, sessionId])
  const renderSlide = useMemo(() => lightboxRenderSlide(onOpenBrowser), [onOpenBrowser])

  useEffect(() => {
    const onKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); onClose() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (current === undefined) return null
  const src = mediaSrc(sessionId, current)
  return h('div', { className: 'vms-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': current.title },
    h('div', { className: 'vms-overlay-backdrop', onClick: onClose }),
    h('div', { className: 'vms-sheet' },
      h('header', { className: 'vms-sheet-head' },
        h('div', { className: 'vms-sheet-title' },
          h('span', { className: 'vms-kind-dot', 'data-kind': current.kind }),
          h('h2', null, current.title),
          h('span', { className: 'vms-sheet-path' }, `${folderOf(current) || '根目录'} · ${typeLabel(current.kind)} · ${formatBytes(current.size)}`)),
        h('div', { className: 'vms-sheet-actions' },
          current.source === 'url' && h(IconButton, { name: 'trash', label: '移除链接', onClick: () => onRemoveLink(current) }),
          h('button', { type: 'button', className: 'vms-ghost-btn', onClick: () => onOpenItem(current) },
            h(Icon, { name: current.kind === 'link' || current.source === 'url' ? 'external' : 'full', size: 12 }),
            h('span', null, current.kind === 'link' ? '在浏览器打开' : current.source === 'url' ? '新窗口播放' : '在标签页打开')),
          current.kind !== 'link' && h('a', { className: 'vms-icon-btn', href: src, download: current.fileName || undefined, title: '下载原文件', 'aria-label': '下载原文件' }, h(Icon, { name: 'download', size: 15 })),
          h(IconButton, { name: 'close', label: '关闭预览', onClick: onClose }))),
      h('div', { className: 'vms-lightbox-stage' },
        h(Lightbox, {
          open: true,
          index: initialIndex,
          close: () => {},
          slides,
          plugins: LIGHTBOX_PLUGINS,
          on: { view: ({ index }) => setCurrentIndex(index) },
          inline: { className: 'vms-lightbox' },
          carousel: { finite: true, padding: 0 },
          animation: { swipe: 260, navigation: 260 },
          controller: { aria: true, touchAction: 'pan-y' },
          zoom: { maxZoomPixelRatio: 3, scrollToZoom: true },
          video: { controls: true, playsInline: true, autoPlay: true },
          thumbnails: {
            position: 'bottom', width: 58, height: 34, border: 0, borderRadius: 6,
            gap: 5, padding: 0, imageFit: 'cover', vignette: false, hidden: false, showToggle: false,
          },
          render: { slide: renderSlide, thumbnail: renderLightboxThumbnail },
          labels: {
            Close: '关闭', Next: '下一个', Previous: '上一个',
            'Zoom in': '放大', 'Zoom out': '缩小', 'Enter fullscreen': '全屏',
            'Exit fullscreen': '退出全屏', 'Show thumbnails': '显示缩略图',
            'Hide thumbnails': '隐藏缩略图',
          },
        })))
  )
}

export function LibraryBody(props) {
  const { sessionId, useTabInfo, openBrowser } = props
  const { tab } = useTabInfo()
  const [reloadKey, setReloadKey] = useState(0)
  const [state, setState] = useState({ items: [], root: '', loading: true, error: null, scan: null })
  const [links, setLinks] = useState([])
  const [view, setView] = useState('grid')
  const [query, setQuery] = useState('')
  const [types, setTypes] = useState([])
  const [folder, setFolder] = useState('')
  const [time, setTime] = useState('all')
  const [size, setSize] = useState('all')
  const [sort, setSort] = useState('time')
  const [dir, setDir] = useState('desc')
  const [filterOpen, setFilterOpen] = useState(false)
  const [inlineId, setInlineId] = useState(null)
  const [overlayId, setOverlayId] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [notice, setNotice] = useState('')
  const [diagnostic, setDiagnostic] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    let alive = true
    setState(previous => ({ ...previous, loading: true, error: null }))
    fetch(apiUrl('api/vyra-media/list', { sessionId }), { signal: controller.signal, credentials: 'same-origin' })
      .then(async response => {
        // The route answers JSON for its own failures; keep the code and reason
        // so the panel can show what actually went wrong.
        let body
        try { body = await response.json() } catch { body = undefined }
        if (!response.ok || body?.ok !== true) {
          const reason = body?.error ?? (await response.text().catch(() => '')) ?? ''
          const code = body?.code ?? `http-${response.status}`
          throw new Error(`${code}：${reason || `HTTP ${response.status}`}`)
        }
        return body
      })
      .then(body => {
        if (!alive) return
        const entries = body.entries.map(entry => {
          const slash = entry.relativePath.lastIndexOf('/')
          return {
            ...entry,
            id: entry.relativePath,
            folder: slash === -1 ? '' : entry.relativePath.slice(0, slash),
            title: entry.name,
            fileName: entry.name,
            source: 'local',
            duration: 0,
            width: 0,
            height: 0,
          }
        })
        setState({ items: entries, root: body.root, loading: false, error: null, scan: body })
      })
      .catch(error => {
        if (!alive || controller.signal.aborted) return
        setState(previous => ({ ...previous, loading: false, error: error?.message || '扫描失败' }))
      })
    return () => { alive = false; controller.abort() }
  }, [sessionId, reloadKey])

  useEffect(() => {
    if (state.root !== '') setLinks(readLinks(state.root))
  }, [state.root])

  // When the scan fails, ask the Host what it can see. The capability report
  // names a missing service or method instead of leaving a bare HTTP 500.
  useEffect(() => {
    if (!state.error) { setDiagnostic(null); return undefined }
    const controller = new AbortController()
    fetch(apiUrl('api/vyra-media/diagnose', { sessionId }), { signal: controller.signal, credentials: 'same-origin' })
      .then(response => response.json())
      .then(setDiagnostic)
      .catch(() => { /* the panel already shows the primary failure */ })
    return () => controller.abort()
  }, [state.error, sessionId])

  useEffect(() => {
    if (notice === '') return undefined
    const timer = setTimeout(() => setNotice(''), 2000)
    return () => clearTimeout(timer)
  }, [notice])

  const filterKey = JSON.stringify({ query, types, folder, time, size, sort, dir })
  useEffect(() => {
    setInlineId(null)
    setLimit(PAGE_SIZE)
  }, [filterKey])

  const items = useMemo(() => [...state.items, ...links], [state.items, links])

  const counts = useMemo(() => {
    const next = { video: 0, image: 0, audio: 0, link: 0 }
    for (const item of items) next[item.kind] += 1
    return next
  }, [items])

  const folders = useMemo(() => [...new Set(items.map(item => folderOf(item)).filter(Boolean))].sort(COLLATOR.compare), [items])

  const filtered = useMemo(() => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const floor = time === 'today' ? today.getTime() : time === '7d' ? Date.now() - 7 * DAY : time === '30d' ? Date.now() - 30 * DAY : null
    return items.filter(item => {
      if (types.length > 0 && !types.includes(item.kind)) return false
      if (folder !== '' && folderOf(item) !== folder) return false
      if (floor !== null && item.mtimeMs < floor) return false
      if (size !== 'all') {
        if (item.size === undefined) return false
        if (size === 'small' && !(item.size < 10_000_000)) return false
        if (size === 'medium' && !(item.size >= 10_000_000 && item.size <= 100_000_000)) return false
        if (size === 'large' && !(item.size > 100_000_000)) return false
      }
      if (tokens.length > 0) {
        const haystack = `${item.title} ${item.fileName} ${folderOf(item)} ${item.ext} ${item.url ?? ''}`.toLowerCase()
        if (!tokens.every(token => haystack.includes(token))) return false
      }
      return true
    }).sort((left, right) => compareItems(left, right, sort, dir))
  }, [items, query, types, folder, time, size, sort, dir])

  const shown = filtered.slice(0, limit)
  const overlayItems = filtered.slice(0, Math.max(limit, PAGE_SIZE))
  const overlayIdSafe = overlayId !== null && items.some(item => item.id === overlayId) ? overlayId : null
  const overlayIndex = overlayIdSafe === null ? -1 : overlayItems.findIndex(item => item.id === overlayIdSafe)
  const overlayItem = overlayIdSafe === null ? undefined : overlayItems[overlayIndex >= 0 ? overlayIndex : 0]

  const activeFilterCount = types.length + (folder ? 1 : 0) + (time !== 'all' ? 1 : 0) + (size !== 'all' ? 1 : 0)
  const totalSize = items.reduce((sum, item) => sum + (item.size ?? 0), 0)

  const openResource = item => {
    if (item.source === 'local') {
      tab.actions.openResource(sessionFileAddress(sessionId, item.relativePath))
      return
    }
    if (item.kind === 'link') openBrowser(item.url)
    else window.open(item.url, '_blank', 'noopener,noreferrer')
  }

  const handleOverlayTab = item => {
    setOverlayId(null)
    openResource(item)
  }

  const addLink = (url, title) => {
    const item = makeLinkItem(url, title)
    setLinks(previous => {
      const next = previous.filter(entry => entry.id !== item.id)
      next.unshift(item)
      writeLinks(state.root, next)
      return next
    })
    setAddOpen(false)
    setNotice('已添加链接')
  }

  const removeLink = item => {
    setLinks(previous => {
      const next = previous.filter(entry => entry.id !== item.id)
      writeLinks(state.root, next)
      return next
    })
    setOverlayId(null)
    setNotice('已移除链接')
  }

  const clearFilters = () => {
    setTypes([]); setFolder(''); setTime('all'); setSize('all'); setQuery(''); setSort('time'); setDir('desc')
  }

  const chips = []
  for (const kind of types) chips.push({ key: `type:${kind}`, label: TYPE_LABEL[kind] })
  if (folder) chips.push({ key: 'folder', label: folder })
  if (time !== 'all') chips.push({ key: 'time', label: { today: '今天', '7d': '近 7 天', '30d': '近 30 天' }[time] })
  if (size !== 'all') chips.push({ key: 'size', label: { small: '小于 10 MB', medium: '10–100 MB', large: '大于 100 MB' }[size] })

  const removeChip = key => {
    if (key.startsWith('type:')) setTypes(previous => previous.filter(kind => kind !== key.slice(5)))
    else if (key === 'folder') setFolder('')
    else if (key === 'time') setTime('all')
    else if (key === 'size') setSize('all')
  }

  return h('div', { className: 'vms-root' },
    h('header', { className: 'vms-head' },
      h('div', { className: 'vms-title-row' },
        h('div', { className: 'vms-title' },
          h('h2', null, '媒体库'),
          h('p', null,
            h('span', null, `${items.length} 个媒体`), h('span', null, '·'),
            h('span', null, `${folders.length} 个文件夹`), h('span', null, '·'),
            h('span', { className: 'vms-mono' }, formatBytes(totalSize)))),
        h('div', { className: 'vms-actions' },
          h('button', { type: 'button', className: 'vms-ghost-btn', onClick: () => setAddOpen(value => !value) }, h(Icon, { name: 'plus', size: 13 }), '链接'),
          h(IconButton, { name: 'refresh', label: '重新扫描', onClick: () => setReloadKey(value => value + 1) }),
          h('div', { className: 'vms-seg' },
            h('button', { type: 'button', className: `vms-seg-btn${view === 'grid' ? ' is-active' : ''}`, 'aria-pressed': view === 'grid', title: '网格视图', onClick: () => setView('grid') }, h(Icon, { name: 'grid', size: 14 })),
            h('button', { type: 'button', className: `vms-seg-btn${view === 'list' ? ' is-active' : ''}`, 'aria-pressed': view === 'list', title: '列表视图', onClick: () => setView('list') }, h(Icon, { name: 'list', size: 14 }))))),
      h('div', { className: 'vms-search-row' },
        h('label', { className: 'vms-search' },
          h(Icon, { name: 'search', size: 14 }),
          h('input', { value: query, placeholder: '搜索名称、文件夹或链接…', onChange: event => setQuery(event.target.value) })),
        h('button', { type: 'button', className: `vms-filter-btn${filterOpen ? ' is-open' : ''}`, 'aria-expanded': filterOpen, onClick: () => setFilterOpen(value => !value) },
          h(Icon, { name: 'filter', size: 14 }), h('span', null, '筛选'),
          activeFilterCount > 0 && h('i', { className: 'vms-filter-count' }, activeFilterCount))),
      h('div', { className: 'vms-type-row' },
        h('button', { type: 'button', className: `vms-type-chip${types.length === 0 ? ' is-active' : ''}`, onClick: () => setTypes([]) },
          h(Icon, { name: 'grid', size: 12 }), '全部', h('b', null, items.length)),
        ['video', 'image', 'audio', 'link'].map(kind => h('button', {
          key: kind, type: 'button', 'data-kind': kind,
          className: `vms-type-chip${types.includes(kind) ? ' is-active' : ''}`,
          onClick: () => setTypes(previous => previous.includes(kind) ? previous.filter(entry => entry !== kind) : [...previous, kind]),
        }, h(Icon, { name: kind, size: 12 }), TYPE_LABEL[kind], h('b', null, counts[kind])))),
      filterOpen && h('div', { className: 'vms-filter-panel' },
        h('label', { className: 'vms-field' }, h('span', null, '文件夹'),
          h('select', { value: folder, onChange: event => setFolder(event.target.value) },
            h('option', { value: '' }, '全部文件夹'),
            folders.map(value => h('option', { key: value, value }, value)))),
        h('label', { className: 'vms-field' }, h('span', null, '时间'),
          h('select', { value: time, onChange: event => setTime(event.target.value) },
            h('option', { value: 'all' }, '全部时间'), h('option', { value: 'today' }, '今天'),
            h('option', { value: '7d' }, '近 7 天'), h('option', { value: '30d' }, '近 30 天'))),
        h('label', { className: 'vms-field' }, h('span', null, '大小'),
          h('select', { value: size, onChange: event => setSize(event.target.value) },
            h('option', { value: 'all' }, '全部大小'), h('option', { value: 'small' }, '小于 10 MB'),
            h('option', { value: 'medium' }, '10–100 MB'), h('option', { value: 'large' }, '大于 100 MB'))),
        h('label', { className: 'vms-field' }, h('span', null, '排序'),
          h('select', { value: sort, onChange: event => setSort(event.target.value) },
            h('option', { value: 'time' }, '按时间'), h('option', { value: 'name' }, '按名称'),
            h('option', { value: 'size' }, '按大小'), h('option', { value: 'type' }, '按类型'))),
        h('button', { type: 'button', className: 'vms-dir-btn', 'data-dir': dir, onClick: () => setDir(value => value === 'asc' ? 'desc' : 'asc') },
          h('span', { className: 'vms-mono' }, dir === 'asc' ? '升序' : '降序'), h(Icon, { name: 'chevron', size: 12 })),
        h('button', { type: 'button', className: 'vms-reset-btn', onClick: clearFilters }, '清除全部')),
      chips.length > 0 && h('div', { className: 'vms-chips' },
        chips.map(chip => h('span', { key: chip.key, className: 'vms-chip' }, chip.label,
          h('button', { type: 'button', 'aria-label': '移除筛选', onClick: () => removeChip(chip.key) }, '×'))))),
    addOpen && h(AddLinkForm, { onSubmit: addLink, onClose: () => setAddOpen(false) }),
    h('div', { className: 'vms-scroll' },
      state.loading && state.items.length > 0 && h('div', { className: 'vms-scan-banner' }, h('i', null), '正在扫描工作区，跳过构建目录…'),
      state.loading && state.items.length === 0 && h('div', { className: 'vms-skeleton-grid' },
        Array.from({ length: 6 }, (_, index) => h('div', { key: index, className: 'vms-skeleton' }))),
      !state.loading && state.error && h('div', { className: 'vms-empty' },
        h('span', { className: 'vms-empty-art' }, h(Icon, { name: 'alert', size: 20 })),
        h('b', null, '媒体库加载失败'),
        h('p', null, state.error),
        diagnostic !== null && h('pre', { className: 'vms-diagnostic' }, JSON.stringify(diagnostic, null, 2)),
        h('button', { type: 'button', className: 'vms-primary-btn', onClick: () => setReloadKey(value => value + 1) }, '重试')),
      !state.loading && !state.error && filtered.length === 0 && h('div', { className: 'vms-empty' },
        h('span', { className: 'vms-empty-art' }, h(Icon, { name: 'search', size: 20 })),
        h('b', null, '没有匹配的媒体'),
        h('p', null, items.length === 0 ? '这个工作区还没有媒体文件。' : '试试减少筛选条件，或换一个文件夹。'),
        items.length > 0 && h('button', { type: 'button', className: 'vms-primary-btn', onClick: clearFilters }, '清除筛选')),
      !state.error && filtered.length > 0 && (view === 'grid'
        ? h('div', { className: 'vms-grid' }, shown.map((item, index) => h(GridCard, {
          key: item.id, item, index, sessionId,
          active: inlineId === item.id,
          onOpen: entry => setOverlayId(entry.id),
          onInline: entry => setInlineId(current => current === entry.id ? null : entry.id),
        })))
        : h('div', { className: 'vms-rows' }, shown.map(item => h(ListRow, {
          key: item.id, item, sessionId,
          onOpen: entry => setOverlayId(entry.id),
          onPlay: entry => setOverlayId(entry.id),
        })))),
      filtered.length > limit && h('div', { className: 'vms-more' },
        h('button', { type: 'button', className: 'vms-ghost-btn', onClick: () => setLimit(value => value + PAGE_SIZE) }, `显示更多（还剩 ${filtered.length - limit}）`))),
    h('footer', { className: 'vms-status' },
      h('span', null, state.error
        ? '扫描失败'
        : filtered.length === items.length
          ? `找到 ${items.length} 个媒体 · 扫描 ${state.scan?.scannedDirectories ?? 0} 个目录`
          : `筛选出 ${filtered.length} / ${items.length} 个媒体`),
      h('span', { className: 'vms-status-right' }, h('i', null), '本地媒体')),
    overlayItem !== undefined && h(MediaOverlay, {
      items: overlayItems.length > 0 ? overlayItems : [overlayItem],
      initialIndex: overlayIndex >= 0 ? overlayIndex : 0,
      sessionId,
      onClose: () => setOverlayId(null),
      onOpenItem: handleOverlayTab,
      onOpenBrowser: openBrowser,
      onRemoveLink: removeLink,
    }),
    notice !== '' && h('div', { className: 'vms-toast' }, h(Icon, { name: 'check', size: 13 }), notice))
}

export function MediaTab(props) {
  const { sessionId, useTabInfo, openLibrary } = props
  const { tab } = useTabInfo()
  const parsed = parseFileAddress(tab.contentId)
  const kind = tab.kind === 'audio' ? 'audio' : 'video'
  if (parsed === undefined) {
    return h('div', { className: 'vms-root vms-media-tab' },
      h('div', { className: 'vms-empty' }, h(Icon, { name: 'alert', size: 20 }), h('b', null, '无法识别这个媒体地址')))
  }
  const name = decodeURIComponent(parsed.path.split('/').pop() ?? '媒体')
  const slash = parsed.path.lastIndexOf('/')
  const folder = slash === -1 ? '根目录' : parsed.path.slice(0, slash)
  const item = {
    id: tab.contentId, kind, title: name, fileName: name, folder, relativePath: parsed.path,
    source: 'local', ext: name.split('.').pop()?.toLowerCase() ?? '', size: undefined, mtimeMs: 0,
    duration: 0, width: 0, height: 0,
  }
  return h('div', { className: 'vms-root vms-media-tab' },
    h('header', { className: 'vms-media-tab-head' },
      h('div', { className: 'vms-media-tab-title' },
        h('span', { className: 'vms-kind-dot', 'data-kind': kind }),
        h('b', null, name),
        h('span', null, `${folder} · ${typeLabel(kind)}`)),
      h('div', { className: 'vms-media-tab-actions' },
        h('button', { type: 'button', className: 'vms-ghost-btn', onClick: openLibrary }, h(Icon, { name: 'grid', size: 12 }), '媒体库'),
        h('a', { className: 'vms-icon-btn', href: mediaSrc(sessionId, item), download: name, title: '下载原文件', 'aria-label': '下载原文件' }, h(Icon, { name: 'download', size: 15 })))),
    h('div', { className: 'vms-media-tab-body' },
      h(NativeMedia, { item, sessionId, visible: tab.visible })))
}
