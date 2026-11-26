/** Grid/list cards, thumbnails, dialogs, file menu and preview surfaces. */
import React, { useEffect, useRef, useState } from 'react'
import {
  apiUrl, coverOf, folderOf, formatBytes, formatDate, formatTime,
  isTextExtension, mediaSrc, slideFor, typeLabel, waveBars,
} from './helpers.js'
import { Icon, kindIcon } from './icons.js'
import { RichTextPreview } from './preview.js'

const h = React.createElement
const TEXT_CACHE = new Map()

/** Observe a container and report when it first nears the viewport. */
function useVisible(ref, lazy) {
  const [visible, setVisible] = useState(!lazy)
  useEffect(() => {
    if (!lazy) { setVisible(true); return undefined }
    const element = ref.current
    if (element === null) return undefined
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return undefined }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true)
        observer.disconnect()
      }
    }, { rootMargin: '180px' })
    observer.observe(element)
    return () => observer.disconnect()
  }, [lazy])
  return [visible, setVisible]
}

function useTextWindow(key, url, enabled) {
  const cached = enabled ? TEXT_CACHE.get(key) : undefined
  const [state, setState] = useState(cached ?? { loading: enabled, text: '', failed: false })
  useEffect(() => {
    const hit = TEXT_CACHE.get(key)
    if (hit !== undefined) { setState(hit); return undefined }
    if (!enabled) return undefined
    const controller = new AbortController()
    setState({ loading: true, text: '', failed: false })
    fetch(url, { signal: controller.signal, credentials: 'same-origin' })
      .then(async response => {
        let body
        try { body = await response.json() } catch { body = undefined }
        if (!response.ok || body?.ok !== true) throw new Error(body?.error ?? `HTTP ${response.status}`)
        return body
      })
      .then(body => {
        const entry = { loading: false, text: body.text ?? '', truncated: body.truncated === true, failed: false }
        TEXT_CACHE.set(key, entry)
        setState(entry)
      })
      .catch(error => {
        if (error?.name === 'AbortError') return
        const entry = { loading: false, text: '', truncated: false, failed: true }
        TEXT_CACHE.set(key, entry)
        setState(entry)
      })
    return () => controller.abort()
  }, [key, url, enabled])
  return state
}

/** Real content thumbnail for text-like documents. */
function TextDocThumb({ item, sessionId }) {
  const boxRef = useRef(null)
  const [visible] = useVisible(boxRef, true)
  const key = `snippet:${sessionId}:${item.relativePath}`
  const url = apiUrl('api/vyra-media/text', { sessionId, path: item.relativePath, maxBytes: 600 })
  const state = useTextWindow(key, url, visible)
  const lines = state.text ? state.text.split('\n').slice(0, 7).map(line => line.slice(0, 90)) : []
  return h('div', { ref: boxRef, className: 'vms-doc-poster is-text', style: coverOf(item, 0) },
    lines.length > 0
      ? h('div', { className: 'vms-doc-snippet' }, lines.join('\n'))
      : h('div', { className: 'vms-doc-snippet is-empty' }, state.loading ? '读取中…' : '文本文件'),
    h('div', { className: 'vms-doc-foot' },
      h('span', { className: 'vms-doc-glyph' }, h(Icon, { name: 'document', size: 13 })),
      h('span', { className: 'vms-doc-ext' }, item.ext.toUpperCase() || 'TXT')))
}

/** Designed thumbnail for documents, archives and unknown files. */
export function DocPoster({ item }) {
  const icon = kindIcon(item.kind, item.ext)
  return h('div', { className: 'vms-doc-poster', 'data-kind': item.kind, style: coverOf(item, 0) },
    h('div', { className: 'vms-doc-fold' }),
    h('span', { className: 'vms-doc-glyph is-large' }, h(Icon, { name: icon, size: 24 })),
    h('b', { className: 'vms-doc-ext is-large' }, item.ext.toUpperCase() || 'FILE'),
    h('div', { className: 'vms-doc-lines' }, h('i', null), h('i', null), h('i', null)))
}

export function MediaThumb({ item, sessionId, lazy = true }) {
  const boxRef = useRef(null)
  const [visible] = useVisible(boxRef, lazy)
  const [failed, setFailed] = useState(false)

  if (item.kind === 'image') {
    return failed
      ? h(VideoFallback, { item, icon: 'fileError' })
      : h('img', {
        className: 'vms-poster', src: mediaSrc(sessionId, item), alt: '',
        loading: 'lazy', decoding: 'async', onError: () => setFailed(true),
      })
  }
  if (item.kind === 'video') {
    if (failed) return h(VideoFallback, { item })
    return h('div', { ref: boxRef, className: 'vms-thumb-box' },
      visible && h('video', {
        className: 'vms-thumb-video', src: mediaSrc(sessionId, item), preload: 'metadata',
        muted: true, playsInline: true, tabIndex: -1,
        onLoadedMetadata: event => { try { event.currentTarget.currentTime = 0.15 } catch { /* image-only file */ } },
        onError: () => setFailed(true),
      }),
      !visible && h('div', { className: 'vms-thumb-placeholder' }, h(Icon, { name: 'video', size: 18 })))
  }
  if (item.kind === 'audio') return h(AudioPoster, { item })
  if (item.kind === 'document' && isTextExtension(item.ext)) return h(TextDocThumb, { item, sessionId })
  return h(DocPoster, { item })
}

export function VideoFallback({ item, icon = 'video' }) {
  return h('div', { className: 'vms-video-fallback' },
    h(Icon, { name: icon, size: 18 }),
    h('span', null, (item.ext || item.kind).toUpperCase()))
}

export function AudioPoster({ item }) {
  const bars = waveBars(item.id, 30, 20, 90)
  return h('div', { className: 'vms-audio-poster', style: coverOf(item, 0) },
    h('div', { className: 'vms-poster-top' },
      h('span', { className: 'vms-poster-glyph' }, h(Icon, { name: 'audio', size: 14 })),
      h('span', { className: 'vms-poster-mono' }, item.ext.toUpperCase())),
    h('div', { className: 'vms-poster-wave' },
      bars.map(bar => h('i', { key: bar.key, style: { height: `${bar.height}%` } }))),
    h('div', { className: 'vms-poster-bottom' }, item.size ? formatBytes(item.size) : '音频'))
}


export function KindBadge({ kind }) {
  return h('span', { className: 'vms-kind-badge', 'data-kind': kind },
    h('i', null), typeLabel(kind))
}

export function DurationBadge({ item }) {
  if ((item.kind === 'video' || item.kind === 'audio') && item.duration) {
    return h('span', { className: 'vms-duration' }, formatTime(item.duration))
  }
  if (item.kind === 'image') {
    return h('span', { className: 'vms-duration' }, item.width && item.height ? `${item.width}×${item.height}` : item.ext.toUpperCase())
  }
  return h('span', { className: 'vms-duration' }, item.ext.toUpperCase() || 'FILE')
}

/**
 * What a move of the seek handle should do.
 *
 * Dragging updates the label and nothing else; the media is told the new
 * position once, on release. Seeking on every input event re-buffers per step,
 * which turns a drag over a long file into a stutter.
 * @param {object} args - drag state and the handle's value.
 * @returns {'label-only'|'seek'|'ignore'} what the caller should do.
 */
export function seekIntent({ dragging, released, value }) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'ignore'
  if (dragging === true && released !== true) return 'label-only'
  return 'seek'
}

/**
 * A timeline for a <video>/<audio> element, draggable while it plays.
 *
 * The bar tracks the media's own events, but a drag does not seek on every
 * pixel: moving the handle only updates the label, and the element is told the
 * new position on release. Seeking on every input event re-buffers on each
 * step, which on a long file turns a drag into a stutter.
 *
 * @param {object} props - the element to drive and where to draw.
 */
export function SeekBar({ mediaRef, className }) {
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [dragging, setDragging] = useState(false)
  // React reads this in the handlers below; a ref keeps them stable during a drag.
  const draggingRef = useRef(false)

  useEffect(() => {
    const media = mediaRef.current
    if (media === null || media === undefined) return undefined
    const sync = () => { if (!draggingRef.current) setPosition(media.currentTime ?? 0) }
    const syncDuration = () => setDuration(Number.isFinite(media.duration) ? media.duration : 0)
    const syncAll = () => { syncDuration(); sync() }
    syncAll()
    media.addEventListener('timeupdate', sync)
    media.addEventListener('durationchange', syncDuration)
    media.addEventListener('loadedmetadata', syncAll)
    media.addEventListener('seeked', sync)
    media.addEventListener('ended', sync)
    // Listeners must come back off: the overlay reuses one element per slide.
    return () => {
      media.removeEventListener('timeupdate', sync)
      media.removeEventListener('durationchange', syncDuration)
      media.removeEventListener('loadedmetadata', syncAll)
      media.removeEventListener('seeked', sync)
      media.removeEventListener('ended', sync)
    }
  }, [mediaRef])

  const seekTo = value => {
    const media = mediaRef.current
    if (media !== null && media !== undefined) {
      try { media.currentTime = value } catch { /* metadata may not be loaded yet */ }
    }
    setPosition(value)
  }

  const max = duration > 0 ? duration : 0
  const shown = dragging ? position : position
  return h('div', {
    className: `vms-seekbar${className === undefined ? '' : ` ${className}`}`,
    // The card underneath opens the preview on click; a drag on the bar is not
    // a click on the card.
    onClick: event => event.stopPropagation(),
  },
  h('input', {
    type: 'range',
    className: 'vms-seek-range',
    min: 0,
    max: max === 0 ? 0 : max,
    step: 'any',
    value: Math.min(shown, max === 0 ? 0 : max),
    disabled: max === 0,
    'aria-label': '播放进度',
    onPointerDown: () => { draggingRef.current = true; setDragging(true) },
    onChange: event => {
      const next = Number(event.target.value)
      setPosition(next)
      if (seekIntent({ dragging: draggingRef.current, value: next }) === 'seek') seekTo(next)
    },
    onPointerUp: event => {
      const next = Number(event.currentTarget.value)
      draggingRef.current = false
      setDragging(false)
      if (seekIntent({ dragging: false, released: true, value: next }) === 'seek') seekTo(next)
    },
    onPointerCancel: () => { draggingRef.current = false; setDragging(false) },
    onKeyUp: event => {
      // Keyboard seeking is a discrete step: apply it immediately.
      const step = event.key.startsWith('Arrow') || event.key === 'Home' || event.key === 'End'
      const next = Number(event.currentTarget.value)
      if (step && seekIntent({ dragging: false, value: next }) === 'seek') seekTo(next)
    },
  }),
  h('span', { className: 'vms-seek-time vms-mono' },
    `${formatTime(shown)} / ${duration > 0 ? formatTime(duration) : '--:--'}`))
}

export function InlineMedia({ item, sessionId, onExpand }) {
  const src = mediaSrc(sessionId, item)
  const mediaRef = useRef(null)
  if (item.kind === 'audio') {
    return h('div', {
      className: 'vms-inline-audio', style: coverOf(item, 0),
      onClick: event => event.stopPropagation(),
    },
    h('div', { className: 'vms-inline-audio-head' },
      h('span', { className: 'vms-inline-audio-glyph' }, h(Icon, { name: 'audio', size: 14 })),
      h('b', null, item.title)),
    h('audio', { ref: mediaRef, className: 'vms-inline-audio-native', src, controls: true, autoPlay: true, preload: 'auto' }),
    h(SeekBar, { mediaRef }),
    h('button', { type: 'button', className: 'vms-inline-expand', 'aria-label': '放大', onClick: onExpand }, h(Icon, { name: 'full', size: 12 })))
  }
  return h('div', { className: 'vms-inline-video', onClick: event => event.stopPropagation() },
    h('video', { ref: mediaRef, src, controls: true, autoPlay: true, playsInline: true, preload: 'auto' }),
    h(SeekBar, { mediaRef }),
    h('button', { type: 'button', className: 'vms-inline-expand', 'aria-label': '放大', onClick: onExpand }, h(Icon, { name: 'full', size: 12 })))
}

function MoreButton({ item, onMenu }) {
  return h('button', {
    type: 'button', className: 'vms-mini-action', title: '更多操作', 'aria-label': '更多操作',
    onClick: event => {
      event.stopPropagation()
      const rect = event.currentTarget.getBoundingClientRect()
      onMenu(item, rect.left - 170, rect.bottom + 4)
    },
  }, h(Icon, { name: 'more', size: 12 }))
}

export function GridCard({ item, sessionId, active, meta, selected, onOpen, onInline, onMenu, onToggleSelect, dragBind, suppressClick }) {
  const canPlay = item.kind === 'video' || item.kind === 'audio'
  const detail = meta === undefined
    ? `${folderOf(item) || '根目录'} · ${typeLabel(item.kind)}`
    : `${folderOf(item) || '根目录'} · ${typeLabel(item.kind)} · ${formatBytes(meta.size)}`
  return h('article', {
    className: 'vms-card', tabIndex: 0, 'data-playing': active ? '' : undefined, 'data-selected': selected ? '' : undefined,
    'aria-label': `${item.title}，${typeLabel(item.kind)}`,
    onClick: event => {
      if (suppressClick !== undefined && suppressClick()) return
      if (event.ctrlKey || event.metaKey) { event.preventDefault(); onToggleSelect(item); return }
      onOpen(item)
    },
    ...(dragBind === undefined ? {} : dragBind(item)),
    onContextMenu: event => { event.preventDefault(); onMenu(item, event.clientX, event.clientY) },
    onKeyDown: event => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      onOpen(item)
    },
  },
  h('div', { className: 'vms-card-media' },
    h(MediaThumb, { item, sessionId, lazy: true }),
    selected && h('span', { className: 'vms-select-badge' }, h(Icon, { name: 'check', size: 11 })),
    h(KindBadge, { kind: item.kind }),
    h(DurationBadge, { item }),
    canPlay && !active && h('button', {
      type: 'button', className: 'vms-play-btn', 'aria-label': `播放 ${item.title}`,
      onClick: event => { event.stopPropagation(); onInline(item) },
    }, h(Icon, { name: 'play', size: 17 })),
    !canPlay && h('button', {
      type: 'button', className: 'vms-play-btn', 'aria-label': `查看 ${item.title}`,
      onClick: event => { event.stopPropagation(); onOpen(item) },
    }, h(Icon, { name: 'full', size: 17 })),
    h('div', { className: 'vms-card-actions' },
      canPlay && h('button', { type: 'button', className: 'vms-mini-action', title: '原地播放', 'aria-label': '原地播放', onClick: event => { event.stopPropagation(); onInline(item) } }, h(Icon, { name: 'play', size: 12 })),
      h('button', { type: 'button', className: 'vms-mini-action', title: '放大查看', 'aria-label': '放大查看', onClick: event => { event.stopPropagation(); onOpen(item) } }, h(Icon, { name: 'full', size: 12 })),
      h(MoreButton, { item, onMenu })),
    active && canPlay && h(InlineMedia, { item, sessionId, onExpand: () => onOpen(item) })),
  h('div', { className: 'vms-card-info' },
    h('h3', { title: item.title }, item.title),
    h('p', null, detail),
    active && h('span', { className: 'vms-playing-note' }, h('i', null), '正在播放')))
}

export function ListRow({ item, sessionId, detail = 'compact', meta, selected, onOpen, onMenu, onToggleSelect, dragBind, suppressClick }) {
  const canPlay = item.kind === 'video' || item.kind === 'audio'
  const detailed = detail === 'detailed'
  const shortType = canPlay ? formatTime(item.duration) : (item.ext.toUpperCase() || typeLabel(item.kind))
  return h('div', {
    className: 'vms-row', tabIndex: 0, 'data-kind': item.kind, 'data-detail': detailed ? 'detailed' : 'compact', 'data-selected': selected ? '' : undefined,
    onClick: event => {
      if (suppressClick !== undefined && suppressClick()) return
      if (event.ctrlKey || event.metaKey) { event.preventDefault(); onToggleSelect(item); return }
      onOpen(item)
    },
    ...(dragBind === undefined ? {} : dragBind(item)),
    onContextMenu: event => { event.preventDefault(); onMenu(item, event.clientX, event.clientY) },
    onKeyDown: event => { if (event.key === 'Enter') { event.preventDefault(); onOpen(item) } },
  },
  h('div', { className: 'vms-row-thumb' },
    h(MediaThumb, { item, sessionId, lazy: true }),
    h('span', { className: 'vms-row-duration' }, shortType)),
  h('div', { className: 'vms-row-main' },
    h('b', null,
      h('span', { className: 'vms-row-icon', 'data-kind': item.kind }, h(Icon, { name: kindIcon(item.kind, item.ext), size: 12 })),
      h('span', { className: 'vms-row-title' }, item.title)),
    h('small', null,
      h('span', { className: 'vms-row-chip', 'data-kind': item.kind }, typeLabel(item.kind)),
      h('span', { className: 'vms-row-path' }, folderOf(item) || '根目录'))),
  detailed && h('div', { className: 'vms-row-time' }, formatDate(meta?.mtimeMs)),
  detailed && h('div', { className: 'vms-row-kind', 'data-kind': item.kind }, h('i', null), typeLabel(item.kind)),
  detailed && h('div', { className: 'vms-row-size' }, formatBytes(meta?.size)),
  h('button', {
    type: 'button', className: 'vms-row-play', title: '更多操作', 'aria-label': '更多操作',
    onClick: event => {
      event.stopPropagation()
      const rect = event.currentTarget.getBoundingClientRect()
      onMenu(item, rect.left - 170, rect.bottom + 4)
    },
  }, h(Icon, { name: 'more', size: 14 })))
}

/**
 * Right-click / kebab menu for one file.
 * @param {object} props - menu state and actions.
 */
export function FileMenu({ state, actions, onSelect, onClose }) {
  useEffect(() => {
    if (state === null) return undefined
    const onKey = event => { if (event.key === 'Escape') onClose() }
    const onPointer = event => {
      const target = event.target
      if (typeof target?.closest === 'function' && target.closest('.vms-menu') !== null) return
      onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer, true)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer, true)
    }
  }, [state, onClose])

  if (state === null) return null
  const width = 196
  const height = actions.length * 32 + 12
  const left = Math.max(8, Math.min(state.x, (typeof window === 'undefined' ? 1200 : window.innerWidth) - width - 8))
  const top = Math.max(8, Math.min(state.y, (typeof window === 'undefined' ? 800 : window.innerHeight) - height - 8))
  return h('div', {
    className: 'vms-menu', role: 'menu',
    style: { left: `${left}px`, top: `${top}px` },
    onPointerDown: event => event.stopPropagation(),
  },
  h('div', { className: 'vms-menu-head' }, h(Icon, { name: kindIcon(state.item.kind, state.item.ext), size: 13 }), h('b', null, state.item.title)),
  actions.map(action => h('button', {
    key: action.key, type: 'button', className: `vms-menu-item${action.danger ? ' is-danger' : ''}`,
    role: 'menuitem',
    onClick: () => { onClose(); onSelect(action.key, state.item) },
  }, h(Icon, { name: action.icon, size: 13 }), h('span', null, action.label))))
}

/** A generic centered dialog with a title, body and action row. */
export function Dialog({ title, children, onClose }) {
  useEffect(() => {
    const onKey = event => { if (event.key === 'Escape') { event.preventDefault(); onClose() } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return h('div', { className: 'vms-dialog-layer', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { className: 'vms-dialog-backdrop', onClick: onClose }),
    h('div', { className: 'vms-dialog' },
      h('div', { className: 'vms-dialog-head' }, h('b', null, title), h('button', { type: 'button', className: 'vms-icon-btn', 'aria-label': '关闭', onClick: onClose }, h(Icon, { name: 'close' }))),
      children))
}

export function RenameDialog({ item, error, onClose, onSubmit }) {
  const [value, setValue] = useState(item.name)
  const submit = event => {
    event.preventDefault()
    const next = value.trim()
    if (next === '') return
    onSubmit(next)
  }
  return h(Dialog, { title: '重命名', onClose },
    h('form', { className: 'vms-dialog-form', onSubmit: submit },
      h('label', { className: 'vms-dialog-field' }, h('span', null, '新文件名'),
        h('input', { className: 'vms-input', autoFocus: true, value, onChange: event => setValue(event.target.value) })),
      error !== '' && h('p', { className: 'vms-form-error' }, error),
      h('div', { className: 'vms-dialog-actions' },
        h('button', { type: 'button', className: 'vms-ghost-btn', onClick: onClose }, '取消'),
        h('button', { type: 'submit', className: 'vms-primary-btn' }, '保存'))))
}

export function CopyDialog({ item, folders, error, action = 'copy', onClose, onSubmit }) {
  const [folder, setFolder] = useState(item.folder ?? '')
  const moving = action === 'move'
  return h(Dialog, { title: moving ? '移动到文件夹' : '复制到文件夹', onClose },
    h('form', { className: 'vms-dialog-form', onSubmit: event => { event.preventDefault(); onSubmit(folder) } },
      h('label', { className: 'vms-dialog-field' }, h('span', null, `${moving ? '移动' : '复制'}「${item.name}」到`),
        h('select', { className: 'vms-input', value: folder, onChange: event => setFolder(event.target.value) },
          h('option', { value: '' }, '工作区根目录'),
          folders.map(value => h('option', { key: value, value }, value))),
        h('small', { className: 'vms-dialog-hint' }, moving ? '目标已有同名项时会拒绝移动。' : '重名时会自动生成“文件名 (2).扩展名”。')),
      error !== '' && h('p', { className: 'vms-form-error' }, error),
      h('div', { className: 'vms-dialog-actions' },
        h('button', { type: 'button', className: 'vms-ghost-btn', onClick: onClose }, '取消'),
        h('button', { type: 'submit', className: 'vms-primary-btn' }, moving ? '移动' : '复制'))))
}

export function BatchCopyDialog({ count, folders, error, onClose, onSubmit }) {
  const [folder, setFolder] = useState('')
  return h(Dialog, { title: '批量复制到文件夹', onClose },
    h('form', { className: 'vms-dialog-form', onSubmit: event => { event.preventDefault(); onSubmit(folder) } },
      h('label', { className: 'vms-dialog-field' }, h('span', null, `复制选中的 ${count} 项到`),
        h('select', { className: 'vms-input', value: folder, onChange: event => setFolder(event.target.value) },
          h('option', { value: '' }, '工作区根目录'),
          folders.map(value => h('option', { key: value, value }, value))),
        h('small', { className: 'vms-dialog-hint' }, '重名时会自动生成“名称 (2).扩展名”；文件夹会递归复制。')),
      error !== '' && h('p', { className: 'vms-form-error' }, error),
      h('div', { className: 'vms-dialog-actions' },
        h('button', { type: 'button', className: 'vms-ghost-btn', onClick: onClose }, '取消'),
        h('button', { type: 'submit', className: 'vms-primary-btn' }, '复制'))))
}

export function ConfirmDialog({ title, message, confirmLabel, danger, onClose, onConfirm }) {
  return h(Dialog, { title, onClose },
    h('div', { className: 'vms-dialog-form' },
      h('p', { className: 'vms-dialog-text' }, message),
      h('div', { className: 'vms-dialog-actions' },
        h('button', { type: 'button', className: 'vms-ghost-btn', onClick: onClose }, '取消'),
        h('button', { type: 'button', className: `vms-primary-btn${danger ? ' is-danger' : ''}`, onClick: onConfirm }, confirmLabel))))
}

export function FilePreviewOverlay({ item, meta, sessionId, onClose, onAction, onMenu, onOpenItem }) {
  const isPdf = item.ext === 'pdf'
  const isText = isTextExtension(item.ext)
  const src = mediaSrc(sessionId, item)
  const size = meta?.size ?? item.size
  return h('div', { className: 'vms-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': item.title },
    h('div', { className: 'vms-overlay-backdrop', onClick: onClose }),
    h('div', { className: 'vms-sheet' },
      h('header', { className: 'vms-sheet-head' },
        h('div', { className: 'vms-sheet-title' },
          h('span', { className: 'vms-kind-dot', 'data-kind': item.kind }),
          h('h2', null, item.title),
          h('span', { className: 'vms-sheet-path' },
            `${folderOf(item) || '根目录'} · ${typeLabel(item.kind)} · ${formatBytes(size)}`)),
        h('div', { className: 'vms-sheet-actions' },
          h('button', { type: 'button', className: 'vms-ghost-btn', onClick: () => onAction('insert', item) }, h(Icon, { name: 'at', size: 13 }), '引用到输入框'),
          h('button', { type: 'button', className: 'vms-ghost-btn', onClick: () => onOpenItem(item) }, h(Icon, { name: 'external', size: 13 }), '在标签页打开'),
          h('a', { className: 'vms-icon-btn', href: src, download: item.fileName || undefined, title: '下载原文件', 'aria-label': '下载原文件' }, h(Icon, { name: 'download', size: 15 })),
          h('button', {
            type: 'button', className: 'vms-icon-btn', title: '更多操作', 'aria-label': '更多操作',
            onClick: event => {
              const rect = event.currentTarget.getBoundingClientRect()
              onMenu(item, rect.left - 170, rect.bottom + 4)
            },
          }, h(Icon, { name: 'more', size: 15 })),
          h('button', { type: 'button', className: 'vms-icon-btn', title: '关闭预览', 'aria-label': '关闭预览', onClick: onClose }, h(Icon, { name: 'close', size: 15 })))),
      h('div', { className: `vms-sheet-stage${isPdf ? ' is-pdf' : isText ? ' is-text' : ''}` },
        isPdf && h('iframe', { className: 'vms-pdf-frame', src, title: item.title }),
        isText && h(RichTextPreview, { item, sessionId }),
        !isPdf && !isText && h('div', { className: 'vms-generic-preview' },
          h('span', { className: 'vms-generic-glyph' }, h(Icon, { name: kindIcon(item.kind, item.ext), size: 44 })),
          h('b', null, item.title),
          h('p', null, `${typeLabel(item.kind)} · ${formatBytes(size)}`),
          h('small', null, '这种文件浏览器无法直接预览，请用系统应用打开。'),
          h('button', { type: 'button', className: 'vms-primary-btn', onClick: () => onAction('open', item) }, h(Icon, { name: 'app', size: 13 }), '用系统应用打开')))))
}

export function MediaOverlay({ items, initialIndex, sessionId, meta, onClose, onOpenItem, onOpenBrowser, onAction, onMenu, Lightbox, plugins }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const current = items[currentIndex] ?? items[0]
  const slides = React.useMemo(() => items.map((item, index) => slideFor(item, index, sessionId)), [items, sessionId])

  useEffect(() => {
    const onKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); onClose() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (current === undefined) return null
  const src = mediaSrc(sessionId, current)
  const size = meta?.[current.id]?.size ?? current.size
  return h('div', { className: 'vms-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': current.title },
    h('div', { className: 'vms-overlay-backdrop', onClick: onClose }),
    h('div', { className: 'vms-sheet' },
      h('header', { className: 'vms-sheet-head' },
        h('div', { className: 'vms-sheet-title' },
          h('span', { className: 'vms-kind-dot', 'data-kind': current.kind }),
          h('h2', null, current.title),
          h('span', { className: 'vms-sheet-path' }, `${folderOf(current) || '根目录'} · ${typeLabel(current.kind)} · ${formatBytes(size)}`)),
        h('div', { className: 'vms-sheet-actions' },
          h('button', { type: 'button', className: 'vms-ghost-btn', onClick: () => onAction('insert', current) }, h(Icon, { name: 'at', size: 13 }), '引用到输入框'),
          h('button', { type: 'button', className: 'vms-ghost-btn', onClick: () => onOpenItem(current) },
            h(Icon, { name: 'full', size: 12 }),
            h('span', null, '在标签页打开')),
          h('a', { className: 'vms-icon-btn', href: src, download: current.fileName || undefined, title: '下载原文件', 'aria-label': '下载原文件' }, h(Icon, { name: 'download', size: 15 })),
          h('button', {
            type: 'button', className: 'vms-icon-btn', title: '更多操作', 'aria-label': '更多操作',
            onClick: event => {
              const rect = event.currentTarget.getBoundingClientRect()
              onMenu(current, rect.left - 170, rect.bottom + 4)
            },
          }, h(Icon, { name: 'more', size: 15 })),
          h('button', { type: 'button', className: 'vms-icon-btn', title: '关闭预览', 'aria-label': '关闭预览', onClick: onClose }, h(Icon, { name: 'close', size: 15 })))),
      h('div', { className: 'vms-lightbox-stage' },
        h(Lightbox, {
          open: true,
          index: initialIndex,
          close: () => {},
          slides,
          plugins,
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
          render: { slide: lightboxRenderSlide(onOpenBrowser), thumbnail: renderLightboxThumbnail },
          labels: {
            Close: '关闭', Next: '下一个', Previous: '上一个',
            'Zoom in': '放大', 'Zoom out': '缩小', 'Enter fullscreen': '全屏',
            'Exit fullscreen': '退出全屏', 'Show thumbnails': '显示缩略图',
            'Hide thumbnails': '隐藏缩略图',
          },
        })))
  )
}

export function NativeMedia({ item, sessionId, visible = true }) {
  const src = mediaSrc(sessionId, item)
  const videoRef = useRef(null)
  const audioRef = useRef(null)
  const [failed, setFailed] = useState(false)
  const [failure, setFailure] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch(src, { method: 'HEAD', signal: controller.signal, credentials: 'same-origin' })
      .then(response => {
        if (response.ok) { setFailure(null); return }
        const code = response.headers.get('x-vyra-media-error') ?? `http-${response.status}`
        return response.text().then(text => setFailure(text ? `${code}：${text}` : code))
      })
      .catch(() => { /* aborted or offline: the media element reports its own failure */ })
    return () => controller.abort()
  }, [src, item.source])

  useEffect(() => {
    if (item.kind === 'video' && !visible && videoRef.current) videoRef.current.pause()
  }, [item.kind, visible])

  if (failed) {
    return h('div', { className: 'vms-media-error' },
      h(Icon, { name: 'alert', size: 18 }),
      h('span', null, '当前浏览器无法播放此媒体'),
      failure !== null && h('code', { className: 'vms-error-detail' }, failure),
      h('a', { href: src, download: item.fileName || undefined, className: 'vms-error-download' },
        h(Icon, { name: 'download', size: 13 }), '下载原文件'))
  }

  if (item.kind === 'audio') {
    return h('div', { className: 'vms-native-audio', style: coverOf(item, 0) },
      h('div', { className: 'vms-native-audio-art' }, h(Icon, { name: 'audio', size: 46 })),
      h('div', { className: 'vms-native-audio-title' },
        h('b', null, item.title),
        h('span', null, `${folderOf(item) || '根目录'} · ${item.ext.toUpperCase()}`)),
      h('audio', { ref: audioRef, src, controls: true, autoPlay: true, preload: 'metadata', onError: () => setFailed(true) }),
      h(SeekBar, { mediaRef: audioRef }))
  }

  return h('div', { className: 'vms-native-video' },
    h('video', {
      ref: videoRef, src, controls: true, autoPlay: true, playsInline: true, preload: 'metadata',
      poster: item.poster, onError: () => setFailed(true),
    }),
    h(SeekBar, { mediaRef: videoRef }))
}

export function AudioSlide({ slide, offset }) {
  const audioRef = useRef(null)
  useEffect(() => {
    const audio = audioRef.current
    if (audio === null) return
    if (offset === 0) audio.play().catch(() => {})
    else audio.pause()
  }, [offset])
  return h('div', {
    className: 'vms-audio-slide',
    style: { '--vms-cover-a': slide['--vms-cover-a'], '--vms-cover-b': slide['--vms-cover-b'] },
  },
  h('div', { className: 'vms-audio-slide-art' }, h(Icon, { name: 'audio', size: 48 })),
  h('div', { className: 'vms-audio-slide-wave' },
    waveBars(slide.src, 46, 12, 100).map(bar => h('i', { key: bar.key, style: { height: `${bar.height}%`, animationDelay: `${bar.delay}s` } }))),
  h('div', { className: 'vms-audio-slide-title' },
    h('b', null, slide.title),
    h('span', null, `${slide.folder} · ${slide.ext} · ${formatBytes(slide.size)}`)),
  h('audio', { ref: audioRef, src: slide.src, controls: true, preload: 'metadata' }))
}


/** Custom lightbox slide for audio and links; other slides use the library defaults. */
export function lightboxRenderSlide(onOpen) {
  return function renderSlide({ slide, offset }) {
    if (slide.type === 'vms-audio') return h(AudioSlide, { slide, offset })
    return undefined
  }
}

/** Custom thumbnail for media the library cannot turn into a static image URL. */
export function renderLightboxThumbnail({ slide }) {
  if (slide.type === 'video') {
    const src = slide.sources?.[0]?.src
    if (!src) return undefined
    return h('video', {
      className: 'vms-lightbox-thumb-video', src, muted: true, playsInline: true, preload: 'metadata',
      onLoadedMetadata: event => { try { event.currentTarget.currentTime = 0.15 } catch { /* ignore */ } },
    })
  }
  if (slide.type === 'vms-audio') {
    return h('span', {
      className: 'vms-lightbox-thumb-icon',
      style: { '--vms-cover-a': slide['--vms-cover-a'], '--vms-cover-b': slide['--vms-cover-b'] },
    }, h(Icon, { name: 'audio', size: 14 }))
  }
  return undefined
}
