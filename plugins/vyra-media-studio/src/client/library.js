/** The right-Sidebar file manager, overlay previews, and media tab. */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Lightbox from 'yet-another-react-lightbox'
import Counter from 'yet-another-react-lightbox/plugins/counter'
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen'
import Inline from 'yet-another-react-lightbox/plugins/inline'
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails'
import Video from 'yet-another-react-lightbox/plugins/video'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import {
  ConfirmDialog, CopyDialog, FileMenu, FilePreviewOverlay, GridCard, ListRow, MediaOverlay,
  NativeMedia, RenameDialog,
} from './components.js'
import { insertComposerText } from './composer.js'
import { Icon, IconButton } from './icons.js'
import {
  CARD_MAX, CARD_MIN, DAY, PAGE_SIZE, TYPE_CHIPS, TYPE_LABEL, apiUrl, compareItems,
  detectLinkKind, folderOf, folderSegments, formatBytes, makeLinkItem, mediaSrc, mentionToken,
  parseFileAddress, postJson, readLinks, readPrefs, sessionFileAddress, typeLabel,
  writeLinks, writePrefs,
} from './helpers.js'

const h = React.createElement
const LIGHTBOX_PLUGINS = [Inline, Video, Zoom, Thumbnails, Counter, Fullscreen]
const INITIAL_PREFS = readPrefs()
const MEDIA_KINDS = new Set(['image', 'video', 'audio', 'link'])

function chunks(values, size) {
  const output = []
  for (let index = 0; index < values.length; index += size) output.push(values.slice(index, index + size))
  return output
}

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

/** Library-only menu: adds an in-panel folder jump. */
function libraryMenuActions(item) {
  const actions = menuActions(item)
  if (item.source === 'url' || item.kind === 'link') return actions
  const index = actions.findIndex(action => action.key === 'reveal')
  return [
    ...actions.slice(0, index),
    { key: 'locate', label: '定位到文件夹', icon: 'folder' },
    ...actions.slice(index),
  ]
}

/** Menu entries for a library item. */
function menuActions(item) {
  if (item.source === 'url' || item.kind === 'link') {
    return [
      { key: 'preview', label: '预览 / 打开', icon: 'full' },
      { key: 'copyLink', label: '复制链接', icon: 'clipboard' },
      { key: 'openLink', label: '在浏览器打开', icon: 'external' },
      { key: 'removeLink', label: '移除链接', icon: 'trash', danger: true },
    ]
  }
  return [
    { key: 'preview', label: '预览 / 播放', icon: 'full' },
    { key: 'insert', label: '引用到输入框', icon: 'at' },
    { key: 'copyTo', label: '复制到…', icon: 'copy' },
    { key: 'copyPath', label: '复制文件地址', icon: 'clipboard' },
    { key: 'rename', label: '重命名', icon: 'pencil' },
    { key: 'reveal', label: '打开所在位置', icon: 'reveal' },
    { key: 'open', label: '用系统应用打开', icon: 'app' },
    { key: 'delete', label: '删除', icon: 'trash', danger: true },
  ]
}

export function LibraryBody(props) {
  const { sessionId, useTabInfo, openBrowser } = props
  const { tab } = useTabInfo()
  const [reloadKey, setReloadKey] = useState(0)
  const forceRefresh = useRef(false)
  const [state, setState] = useState({ items: [], root: '', loading: true, error: null, scan: null })
  const [links, setLinks] = useState([])
  const [view, setView] = useState(INITIAL_PREFS.view)
  const [cardSize, setCardSize] = useState(INITIAL_PREFS.cardSize)
  const [detail, setDetail] = useState(INITIAL_PREFS.detail)
  const [query, setQuery] = useState('')
  const [types, setTypes] = useState([])
  const [folder, setFolder] = useState('')
  const [time, setTime] = useState('all')
  const [size, setSize] = useState('all')
  const [sort, setSort] = useState(INITIAL_PREFS.sort)
  const [dir, setDir] = useState(INITIAL_PREFS.dir)
  const [showHidden, setShowHidden] = useState(INITIAL_PREFS.showHidden)
  const [includeBuild, setIncludeBuild] = useState(INITIAL_PREFS.includeBuild)
  const [filterOpen, setFilterOpen] = useState(false)
  const [folderOpen, setFolderOpen] = useState(false)
  const [inlineId, setInlineId] = useState(null)
  const [overlayId, setOverlayId] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [notice, setNotice] = useState('')
  const [diagnostic, setDiagnostic] = useState(null)
  const [meta, setMeta] = useState({})
  const [metaLoading, setMetaLoading] = useState(false)
  const [menu, setMenu] = useState(null)
  const [renameDialog, setRenameDialog] = useState(null)
  const [copyDialog, setCopyDialog] = useState(null)
  const [deleteDialog, setDeleteDialog] = useState(null)
  const metaRef = useRef({})
  const pendingMeta = useRef(new Set())
  const generation = useRef(0)
  const gridRef = useRef(null)

  useEffect(() => { writePrefs({ view, cardSize, detail, sort, dir, showHidden, includeBuild }) },
    [view, cardSize, detail, sort, dir, showHidden, includeBuild])

  useEffect(() => {
    const controller = new AbortController()
    let alive = true
    generation.current += 1
    const currentGeneration = generation.current
    setState(previous => ({ ...previous, loading: true, error: null }))
    setMeta({})
    metaRef.current = {}
    pendingMeta.current.clear()
    setMetaLoading(false)

    const force = forceRefresh.current
    forceRefresh.current = false
    fetch(apiUrl('api/vyra-media/list', {
      sessionId,
      includeHidden: showHidden ? '1' : '',
      includeBuild: includeBuild ? '1' : '',
      refresh: force ? '1' : '',
    }), { signal: controller.signal, credentials: 'same-origin' })
      .then(async response => {
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
        if (!alive || generation.current !== currentGeneration) return
        const entries = body.entries.map(entry => ({
          ...entry,
          id: entry.relativePath,
          title: entry.name,
          fileName: entry.name,
          source: 'local',
          duration: 0,
          width: 0,
          height: 0,
        }))
        setState({ items: entries, root: body.root, loading: false, error: null, scan: body })
      })
      .catch(error => {
        if (!alive || controller.signal.aborted) return
        setState(previous => ({ ...previous, loading: false, error: error?.message || '扫描失败' }))
      })
    return () => { alive = false; controller.abort() }
  }, [sessionId, reloadKey, showHidden, includeBuild])

  useEffect(() => {
    if (state.root !== '') setLinks(readLinks(state.root))
  }, [state.root])

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
    const timer = setTimeout(() => setNotice(''), 2200)
    return () => clearTimeout(timer)
  }, [notice])

  // Ctrl/Cmd + wheel behaves like Explorer's icon-size zoom. A native listener
  // is required so `preventDefault` actually stops the browser page zoom.
  useEffect(() => {
    if (view !== 'grid') return undefined
    const element = gridRef.current
    if (element === null) return undefined
    const onWheel = event => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      setCardSize(value => Math.max(CARD_MIN, Math.min(CARD_MAX, value + (event.deltaY < 0 ? 16 : -16))))
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [view])

  const filterKey = JSON.stringify({ query, types, folder, time, size, sort, dir })
  useEffect(() => {
    setInlineId(null)
    setLimit(PAGE_SIZE)
  }, [filterKey])

  const items = useMemo(() => [...state.items, ...links], [state.items, links])

  const counts = useMemo(() => {
    const next = { image: 0, video: 0, audio: 0, document: 0, archive: 0, code: 0, other: 0, link: 0 }
    for (const item of items) next[item.kind] = (next[item.kind] ?? 0) + 1
    return next
  }, [items])

  const folders = useMemo(() => state.scan?.folders ?? [], [state.scan])

  const metaFor = useCallback(item => {
    const values = meta[item.id]
    if (values !== undefined) return values
    if (item.source === 'url') return { size: item.size, mtimeMs: item.mtimeMs, absolutePath: undefined }
    return undefined
  }, [meta])

  const needAllMeta = time !== 'all' || size !== 'all' || sort === 'time' || sort === 'size'
  const localPaths = useMemo(() => state.items.map(item => item.id), [state.items])

  const ensureMeta = useCallback(paths => {
    const currentGeneration = generation.current
    const missing = [...new Set(paths)].filter(path =>
      metaRef.current[path] === undefined && !pendingMeta.current.has(path))
    if (missing.length === 0) return
    for (const path of missing) pendingMeta.current.add(path)
    setMetaLoading(true)
    const batches = chunks(missing, 150)
    const results = []
    const worker = async () => {
      while (batches.length > 0) {
        const batch = batches.shift()
        try {
          results.push(await postJson('api/vyra-media/stat', { sessionId, paths: batch }))
        } catch {
          /* one failed batch must not block the rest */
        }
      }
    }
    Promise.all([worker(), worker()])
      .then(() => {
        if (generation.current !== currentGeneration) return
        const patch = {}
        for (const result of results) {
          for (const entry of result.entries ?? []) {
            if (entry?.error !== undefined) continue
            patch[entry.path] = {
              size: entry.size,
              mtimeMs: entry.mtimeMs,
              absolutePath: entry.absolutePath,
            }
          }
        }
        metaRef.current = { ...metaRef.current, ...patch }
        setMeta(metaRef.current)
      })
      .finally(() => {
        for (const path of missing) pendingMeta.current.delete(path)
        if (generation.current === currentGeneration) setMetaLoading(false)
      })
  }, [sessionId])

  useEffect(() => {
    if (needAllMeta && localPaths.length > 0) ensureMeta(localPaths)
  }, [needAllMeta, localPaths, ensureMeta])

  const filtered = useMemo(() => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const floor = time === 'today' ? today.getTime() : time === '7d' ? Date.now() - 7 * DAY : time === '30d' ? Date.now() - 30 * DAY : null
    return items.filter(item => {
      if (types.length > 0 && !types.includes(item.kind)) return false
      if (folder !== '' && folderOf(item) !== folder) return false
      const info = metaFor(item)
      // Metadata arrives in batches. While a batch is in flight, keep the
      // item visible instead of flickering an empty result set; the filter
      // applies as soon as its size/mtime is known.
      if (floor !== null && info?.mtimeMs !== undefined && info.mtimeMs < floor) return false
      if (size !== 'all' && info?.size !== undefined) {
        if (size === 'small' && !(info.size < 10_000_000)) return false
        if (size === 'medium' && !(info.size >= 10_000_000 && info.size <= 100_000_000)) return false
        if (size === 'large' && !(info.size > 100_000_000)) return false
      }
      if (tokens.length > 0) {
        const haystack = `${item.title} ${item.fileName} ${folderOf(item)} ${item.ext} ${typeLabel(item.kind)} ${item.url ?? ''}`.toLowerCase()
        if (!tokens.every(token => haystack.includes(token))) return false
      }
      return true
    }).sort((left, right) => compareItems(left, right, sort, dir, meta))
  }, [items, meta, metaFor, query, types, folder, time, size, sort, dir])

  const shown = useMemo(() => filtered.slice(0, limit), [filtered, limit])
  const visiblePaths = useMemo(() => shown.filter(item => item.source === 'local').map(item => item.id), [shown])
  useEffect(() => {
    if (!needAllMeta && visiblePaths.length > 0) ensureMeta(visiblePaths)
  }, [needAllMeta, visiblePaths, ensureMeta])

  const overlayItems = useMemo(() => filtered.slice(0, Math.max(limit, PAGE_SIZE)), [filtered, limit])
  const overlayIdSafe = overlayId !== null && items.some(item => item.id === overlayId) ? overlayId : null
  const overlayItem = overlayIdSafe === null ? undefined : filtered.find(item => item.id === overlayIdSafe)

  const activeFilterCount = types.length + (folder ? 1 : 0) + (time !== 'all' ? 1 : 0) + (size !== 'all' ? 1 : 0)
  const localItems = state.items
  const sizeReady = localItems.length > 0 && localItems.every(item => meta[item.id]?.size !== undefined)
  const totalSize = localItems.reduce((sum, item) => sum + (meta[item.id]?.size ?? 0), 0)

  const refresh = () => {
    forceRefresh.current = true
    setReloadKey(value => value + 1)
  }

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
    setTypes([]); setFolder(''); setTime('all'); setSize('all'); setQuery(''); setSort('name'); setDir('asc')
  }

  const sortBy = key => {
    if (sort === key) setDir(value => value === 'asc' ? 'desc' : 'asc')
    else { setSort(key); setDir('asc') }
  }

  const insertReference = item => {
    try {
      insertComposerText(sessionId, mentionToken(item.relativePath))
      setNotice('已引用到输入框')
    } catch (error) {
      setNotice(error?.message ?? '引用失败')
    }
  }

  const absolutePathOf = async item => {
    const cached = metaRef.current[item.id]?.absolutePath
    if (cached !== undefined) return cached
    const result = await postJson('api/vyra-media/stat', { sessionId, paths: [item.id] })
    const entry = result.entries?.find(value => value.path === item.id)
    if (entry?.absolutePath === undefined) throw new Error('找不到文件地址')
    const patch = { ...(metaRef.current?.[item.id] ?? {}), ...entry }
    metaRef.current = { ...metaRef.current, [item.id]: patch }
    setMeta(metaRef.current)
    return entry.absolutePath
  }

  const copyAddress = async item => {
    try {
      const absolute = await absolutePathOf(item)
      await navigator.clipboard.writeText(absolute)
      setNotice('已复制文件地址')
    } catch (error) {
      setNotice(`复制失败：${error?.message ?? error}`)
    }
  }

  const runAction = async (key, item) => {
    if (key === 'preview') { setOverlayId(item.id); return }
    if (key === 'insert') { insertReference(item); return }
    if (key === 'copyPath') { await copyAddress(item); return }
    if (key === 'copyLink') {
      try { await navigator.clipboard.writeText(item.url); setNotice('已复制链接') } catch { setNotice('复制失败') }
      return
    }
    if (key === 'copyTo') { setCopyDialog({ item, error: '' }); return }
    if (key === 'rename') { setRenameDialog({ item, error: '' }); return }
    if (key === 'delete') { setDeleteDialog({ item, step: 0, error: '' }); return }
    if (key === 'removeLink') { removeLink(item); return }
    if (key === 'openLink') { openBrowser(item.url); return }
    if (key === 'reveal' || key === 'open') {
      try {
        await postJson(`api/vyra-media/${key}`, { sessionId, path: item.relativePath })
        setNotice(key === 'reveal' ? '已打开文件所在位置' : '已用系统应用打开')
      } catch (error) {
        setNotice(`操作失败：${error?.message ?? error}`)
      }
    }
  }

  const submitRename = async name => {
    const item = renameDialog?.item
    if (item === undefined) return
    try {
      await postJson('api/vyra-media/rename', { sessionId, path: item.relativePath, name })
      setRenameDialog(null)
      if (overlayIdSafe === item.id) setOverlayId(null)
      setNotice('已重命名')
      refresh()
    } catch (error) {
      setRenameDialog(previous => previous === null ? previous : { ...previous, error: error?.message ?? String(error) })
    }
  }

  const submitCopy = async toFolder => {
    const item = copyDialog?.item
    if (item === undefined) return
    try {
      const result = await postJson('api/vyra-media/copy', { sessionId, path: item.relativePath, toFolder })
      setCopyDialog(null)
      setNotice(`已复制到 ${result.relativePath}`)
      refresh()
    } catch (error) {
      setCopyDialog(previous => previous === null ? previous : { ...previous, error: error?.message ?? String(error) })
    }
  }

  const submitDelete = async permanent => {
    const item = deleteDialog?.item
    if (item === undefined) return
    try {
      const result = await postJson('api/vyra-media/delete', { sessionId, path: item.relativePath, permanent })
      setDeleteDialog(null)
      if (overlayIdSafe === item.id) setOverlayId(null)
      setNotice(result.recycled ? '已移到回收站' : '已永久删除')
      refresh()
    } catch (error) {
      if (permanent !== true && error?.canPermanent === true) {
        setDeleteDialog(previous => previous === null ? previous : { ...previous, step: 1, error: error?.message ?? String(error) })
        return
      }
      setDeleteDialog(previous => previous === null ? previous : { ...previous, error: error?.message ?? String(error) })
    }
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

  const segments = folderSegments(folder)
  const mediaOverlayItems = useMemo(() => overlayItems.filter(item => MEDIA_KINDS.has(item.kind)), [overlayItems])
  const mediaOverlayIndex = overlayItem === undefined ? 0 : Math.max(0, mediaOverlayItems.findIndex(item => item.id === overlayItem.id))

  return h('div', { className: 'vms-root' },
    h('header', { className: 'vms-head' },
      h('div', { className: 'vms-title-row' },
        h('div', { className: 'vms-title' },
          h('h2', null, '文件管理'),
          h('p', null,
            h('span', null, `${items.length} 个文件`), h('span', null, '·'),
            h('span', null, `${folders.length} 个文件夹`), h('span', null, '·'),
            h('span', { className: 'vms-mono' }, sizeReady ? formatBytes(totalSize) : '—'))),
        h('div', { className: 'vms-actions' },
          h('button', { type: 'button', className: 'vms-ghost-btn', onClick: () => setAddOpen(value => !value) }, h(Icon, { name: 'plus', size: 13 }), '链接'),
          h(IconButton, { name: 'refresh', label: '重新扫描', onClick: refresh }),
          h('div', { className: 'vms-seg' },
            h('button', { type: 'button', className: `vms-seg-btn${view === 'grid' ? ' is-active' : ''}`, 'aria-pressed': view === 'grid', title: '网格视图', onClick: () => setView('grid') }, h(Icon, { name: 'grid', size: 14 })),
            h('button', { type: 'button', className: `vms-seg-btn${view === 'list' ? ' is-active' : ''}`, 'aria-pressed': view === 'list', title: '列表视图', onClick: () => setView('list') }, h(Icon, { name: 'list', size: 14 }))))),
      h('div', { className: 'vms-search-row' },
        h('label', { className: 'vms-search' },
          h(Icon, { name: 'search', size: 14 }),
          h('input', { value: query, placeholder: '搜索名称、路径、类型或链接…', onChange: event => setQuery(event.target.value) })),
        view === 'grid' && h('div', { className: 'vms-zoom' },
          h(IconButton, { name: 'zoomOut', label: '缩小缩略图', onClick: () => setCardSize(value => Math.max(CARD_MIN, value - 16)) }),
          h('input', {
            type: 'range', min: CARD_MIN, max: CARD_MAX, step: 4, value: cardSize,
            'aria-label': '缩略图大小', className: 'vms-zoom-range',
            onChange: event => setCardSize(Number(event.target.value)),
          }),
          h(IconButton, { name: 'zoomIn', label: '放大缩略图', onClick: () => setCardSize(value => Math.min(CARD_MAX, value + 16)) })),
        view === 'list' && h('div', { className: 'vms-seg vms-detail-seg' },
          h('button', { type: 'button', className: `vms-seg-text${detail === 'compact' ? ' is-active' : ''}`, 'aria-pressed': detail === 'compact', onClick: () => setDetail('compact') }, '简洁'),
          h('button', { type: 'button', className: `vms-seg-text${detail === 'detailed' ? ' is-active' : ''}`, 'aria-pressed': detail === 'detailed', onClick: () => setDetail('detailed') }, '详细')),
        h('button', { type: 'button', className: `vms-filter-btn${filterOpen ? ' is-open' : ''}`, 'aria-expanded': filterOpen, onClick: () => setFilterOpen(value => !value) },
          h(Icon, { name: 'filter', size: 14 }), h('span', null, '筛选'),
          activeFilterCount > 0 && h('i', { className: 'vms-filter-count' }, activeFilterCount))),
      h('div', { className: 'vms-type-row' },
        h('button', { type: 'button', className: `vms-type-chip${types.length === 0 ? ' is-active' : ''}`, onClick: () => setTypes([]) },
          h(Icon, { name: 'grid', size: 12 }), '全部', h('b', null, items.length)),
        TYPE_CHIPS.map(kind => h('button', {
          key: kind, type: 'button', 'data-kind': kind,
          className: `vms-type-chip${types.includes(kind) ? ' is-active' : ''}`,
          onClick: () => setTypes(previous => previous.includes(kind) ? previous.filter(entry => entry !== kind) : [...previous, kind]),
        }, h(Icon, { name: kind === 'other' ? 'file' : kind, size: 12 }), TYPE_LABEL[kind], h('b', null, counts[kind] ?? 0)))),
      h('div', { className: 'vms-folder-row' },
        h('div', { className: 'vms-crumb' },
          h('button', { type: 'button', className: `vms-crumb-seg${folder === '' ? ' is-active' : ''}`, onClick: () => setFolder('') }, '全部文件夹'),
          segments.map((segment, index) => h(React.Fragment, { key: `${segment}:${index}` },
            h(Icon, { name: 'chevronRight', size: 11, className: 'vms-crumb-sep' }),
            h('button', {
              type: 'button',
              className: `vms-crumb-seg${index === segments.length - 1 ? ' is-active' : ''}`,
              onClick: () => setFolder(segments.slice(0, index + 1).join('/')),
            }, segment)))),
        h('button', { type: 'button', className: `vms-ghost-btn vms-folder-btn${folderOpen ? ' is-open' : ''}`, 'aria-expanded': folderOpen, onClick: () => setFolderOpen(value => !value) },
          h(Icon, { name: 'folder', size: 13 }), '文件夹', h(Icon, { name: 'chevron', size: 11 })),
        folderOpen && h('div', { className: 'vms-folder-pop' },
          h('button', { type: 'button', className: `vms-folder-item${folder === '' ? ' is-active' : ''}`, onClick: () => { setFolder(''); setFolderOpen(false) } }, '全部文件夹'),
          folders.map(value => h('button', {
            key: value, type: 'button',
            className: `vms-folder-item${folder === value ? ' is-active' : ''}`,
            style: { paddingLeft: `${10 + (value.split('/').length - 1) * 14}px` },
            onClick: () => { setFolder(value); setFolderOpen(false) },
          }, h(Icon, { name: 'folder', size: 11 }), value.split('/').pop())))),
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
            h('option', { value: 'name' }, '按名称'), h('option', { value: 'time' }, '按时间'),
            h('option', { value: 'size' }, '按大小'), h('option', { value: 'type' }, '按类型'))),
        h('button', { type: 'button', className: 'vms-dir-btn', 'data-dir': dir, onClick: () => setDir(value => value === 'asc' ? 'desc' : 'asc') },
          h('span', { className: 'vms-mono' }, dir === 'asc' ? '升序' : '降序'), h(Icon, { name: 'chevron', size: 12 })),
        h('label', { className: 'vms-check' }, h('input', { type: 'checkbox', checked: showHidden, onChange: event => setShowHidden(event.target.checked) }), '显示隐藏文件'),
        h('label', { className: 'vms-check' }, h('input', { type: 'checkbox', checked: includeBuild, onChange: event => setIncludeBuild(event.target.checked) }), '包含依赖/构建目录（慢）'),
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
        h('b', null, '文件列表加载失败'),
        h('p', null, state.error),
        diagnostic !== null && h('pre', { className: 'vms-diagnostic' }, JSON.stringify(diagnostic, null, 2)),
        h('button', { type: 'button', className: 'vms-primary-btn', onClick: refresh }, '重试')),
      !state.loading && !state.error && filtered.length === 0 && h('div', { className: 'vms-empty' },
        h('span', { className: 'vms-empty-art' }, h(Icon, { name: 'search', size: 20 })),
        h('b', null, '没有匹配的文件'),
        h('p', null, items.length === 0 ? '这个工作区还没有文件。' : '试试减少筛选条件，或换一个文件夹。'),
        items.length > 0 && h('button', { type: 'button', className: 'vms-primary-btn', onClick: clearFilters }, '清除筛选')),
      !state.error && filtered.length > 0 && (view === 'grid'
        ? h('div', { ref: gridRef, className: 'vms-grid', style: { '--vms-card-min': `${cardSize}px` } }, shown.map((item, index) => h(GridCard, {
          key: item.id, item, index, sessionId,
          meta: metaFor(item),
          active: inlineId === item.id,
          onOpen: entry => setOverlayId(entry.id),
          onInline: entry => setInlineId(current => current === entry.id ? null : entry.id),
          onMenu: (entry, x, y) => setMenu({ item: entry, x, y }),
        })))
        : h('div', { className: 'vms-rows' },
          detail === 'detailed' && h('div', { className: 'vms-list-head' },
            h('span', null, ''),
            h('button', { type: 'button', className: sort === 'name' ? 'is-active' : '', onClick: () => sortBy('name') }, `名称${sort === 'name' ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}`),
            h('button', { type: 'button', className: sort === 'time' ? 'is-active' : '', onClick: () => sortBy('time') }, `修改日期${sort === 'time' ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}`),
            h('button', { type: 'button', className: sort === 'type' ? 'is-active' : '', onClick: () => sortBy('type') }, `类型${sort === 'type' ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}`),
            h('button', { type: 'button', className: sort === 'size' ? 'is-active' : '', onClick: () => sortBy('size') }, `大小${sort === 'size' ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}`),
            h('span', null, '')),
          shown.map(item => h(ListRow, {
            key: item.id, item, sessionId, detail, meta: metaFor(item),
            onOpen: entry => setOverlayId(entry.id),
            onMenu: (entry, x, y) => setMenu({ item: entry, x, y }),
          })))),
      metaLoading && h('div', { className: 'vms-meta-banner' }, h('i', null), '正在读取文件信息…'),
      filtered.length > limit && h('div', { className: 'vms-more' },
        h('button', { type: 'button', className: 'vms-ghost-btn', onClick: () => setLimit(value => value + PAGE_SIZE) }, `显示更多（还剩 ${filtered.length - limit}）`))),
    h('footer', { className: 'vms-status' },
      h('span', null, state.error
        ? '扫描失败'
        : filtered.length === items.length
          ? `找到 ${items.length} 个文件 · 扫描 ${folders.length} 个文件夹${state.scan?.truncated ? ' · 结果已截断' : ''}`
          : `筛选出 ${filtered.length} / ${items.length} 个文件`),
      h('span', { className: 'vms-status-right' }, h('i', null), '本地工作区')),
    menu !== null && h(FileMenu, {
      state: menu,
      actions: libraryMenuActions(menu.item),
      onSelect: runAction,
      onClose: () => setMenu(null),
    }),
    renameDialog !== null && h(RenameDialog, {
      item: renameDialog.item,
      error: renameDialog.error,
      onClose: () => setRenameDialog(null),
      onSubmit: submitRename,
    }),
    copyDialog !== null && h(CopyDialog, {
      item: copyDialog.item,
      folders,
      error: copyDialog.error,
      onClose: () => setCopyDialog(null),
      onSubmit: submitCopy,
    }),
    deleteDialog !== null && h(ConfirmDialog, {
      title: deleteDialog.step === 0 ? '移到回收站' : '永久删除',
      message: deleteDialog.step === 0
        ? `确定把「${deleteDialog.item.name}」移到系统回收站吗？${deleteDialog.error !== '' ? `（上次失败：${deleteDialog.error}）` : ''}`
        : `移到回收站失败：${deleteDialog.error}。永久删除后将无法恢复，确定继续吗？`,
      confirmLabel: deleteDialog.step === 0 ? '移到回收站' : '永久删除',
      danger: deleteDialog.step === 1,
      onClose: () => setDeleteDialog(null),
      onConfirm: () => submitDelete(deleteDialog.step === 1),
    }),
    overlayItem !== undefined && (MEDIA_KINDS.has(overlayItem.kind)
      ? h(MediaOverlay, {
        items: mediaOverlayItems.length > 0 ? mediaOverlayItems : [overlayItem],
        initialIndex: mediaOverlayIndex,
        sessionId,
        meta,
        Lightbox,
        plugins: LIGHTBOX_PLUGINS,
        onClose: () => setOverlayId(null),
        onOpenItem: handleOverlayTab,
        onOpenBrowser: openBrowser,
        onRemoveLink: removeLink,
        onAction: runAction,
        onMenu: (entry, x, y) => setMenu({ item: entry, x, y }),
      })
      : h(FilePreviewOverlay, {
        item: overlayItem,
        meta: metaFor(overlayItem),
        sessionId,
        onClose: () => setOverlayId(null),
        onAction: runAction,
        onMenu: (entry, x, y) => setMenu({ item: entry, x, y }),
        onOpenItem: handleOverlayTab,
      })),
    notice !== '' && h('div', { className: 'vms-toast' }, h(Icon, { name: 'check', size: 13 }), notice))
}

export function MediaTab(props) {
  const { sessionId, useTabInfo, openLibrary } = props
  const { tab } = useTabInfo()
  const parsed = parseFileAddress(tab.contentId)
  const [notice, setNotice] = useState('')
  const [menu, setMenu] = useState(null)
  const [renameDialog, setRenameDialog] = useState(null)
  const [deleteDialog, setDeleteDialog] = useState(null)
  useEffect(() => {
    if (notice === '') return undefined
    const timer = setTimeout(() => setNotice(''), 2000)
    return () => clearTimeout(timer)
  }, [notice])

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

  const act = async key => {
    if (key === 'insert') {
      try { insertComposerText(sessionId, mentionToken(parsed.path)); setNotice('已引用到输入框') }
      catch (error) { setNotice(error?.message ?? '引用失败') }
      return
    }
    if (key === 'copyPath') {
      try {
        const result = await postJson('api/vyra-media/stat', { sessionId, paths: [parsed.path] })
        const entry = result.entries?.find(value => value.path === parsed.path)
        if (entry?.absolutePath === undefined) throw new Error('找不到文件地址')
        await navigator.clipboard.writeText(entry.absolutePath)
        setNotice('已复制文件地址')
      } catch (error) {
        setNotice(`复制失败：${error?.message ?? error}`)
      }
      return
    }
    try {
      await postJson(`api/vyra-media/${key}`, { sessionId, path: parsed.path })
      setNotice(key === 'reveal' ? '已打开文件所在位置' : '已用系统应用打开')
    } catch (error) {
      setNotice(`操作失败：${error?.message ?? error}`)
    }
  }

  const submitTabRename = async nextName => {
    try {
      await postJson('api/vyra-media/rename', { sessionId, path: parsed.path, name: nextName })
      setRenameDialog(null)
      setNotice('已重命名，重新打开标签页后显示新名称')
    } catch (error) {
      setRenameDialog(previous => previous === null ? previous : { ...previous, error: error?.message ?? String(error) })
    }
  }

  const submitTabDelete = async permanent => {
    try {
      const result = await postJson('api/vyra-media/delete', { sessionId, path: parsed.path, permanent })
      setDeleteDialog(null)
      setNotice(result.recycled ? '已移到回收站' : '已永久删除')
    } catch (error) {
      if (permanent !== true && error?.canPermanent === true) {
        setDeleteDialog(previous => previous === null ? previous : { ...previous, step: 1, error: error?.message ?? String(error) })
        return
      }
      setDeleteDialog(previous => previous === null ? previous : { ...previous, error: error?.message ?? String(error) })
    }
  }

  const tabMenuAction = key => {
    if (key === 'insert') return act('insert')
    if (key === 'copyPath') return act('copyPath')
    if (key === 'reveal') return act('reveal')
    if (key === 'open') return act('open')
    if (key === 'rename') { setRenameDialog({ item, error: '' }); return undefined }
    if (key === 'delete') { setDeleteDialog({ item, step: 0, error: '' }); return undefined }
    return undefined
  }

  return h('div', { className: 'vms-root vms-media-tab' },
    h('header', { className: 'vms-media-tab-head' },
      h('div', { className: 'vms-media-tab-title' },
        h('span', { className: 'vms-kind-dot', 'data-kind': kind }),
        h('b', null, name),
        h('span', null, `${folder} · ${typeLabel(kind)}`)),
      h('div', { className: 'vms-media-tab-actions' },
        h('button', { type: 'button', className: 'vms-ghost-btn', onClick: () => act('insert') }, h(Icon, { name: 'at', size: 12 }), '引用'),
        h('button', { type: 'button', className: 'vms-ghost-btn', onClick: () => act('reveal') }, h(Icon, { name: 'reveal', size: 12 }), '所在位置'),
        h('button', { type: 'button', className: 'vms-ghost-btn', onClick: () => act('copyPath') }, h(Icon, { name: 'clipboard', size: 12 }), '地址'),
        h('button', { type: 'button', className: 'vms-ghost-btn', onClick: openLibrary }, h(Icon, { name: 'grid', size: 12 }), '文件管理'),
        h('a', { className: 'vms-icon-btn', href: mediaSrc(sessionId, item), download: name, title: '下载原文件', 'aria-label': '下载原文件' }, h(Icon, { name: 'download', size: 15 })))),
    h('div', { className: 'vms-media-tab-body' },
      h(NativeMedia, { item, sessionId, visible: tab.visible })),
    notice !== '' && h('div', { className: 'vms-toast' }, h(Icon, { name: 'check', size: 13 }), notice))
}