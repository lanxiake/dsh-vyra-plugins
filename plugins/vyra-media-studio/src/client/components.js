/** Grid/list cards, thumbnails, native players, and lightbox slides. */
import React, { useEffect, useRef, useState } from 'react'
import {
  coverOf, domainOf, folderOf, formatBytes, formatDate, formatTime, mediaSrc,
  typeLabel, waveBars,
} from './helpers.js'
import { Icon } from './icons.js'

const h = React.createElement

export function MediaThumb({ item, sessionId, lazy = true }) {
  const boxRef = useRef(null)
  const [visible, setVisible] = useState(!lazy)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!lazy) return undefined
    const element = boxRef.current
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
  }, [lazy, item.id])

  if (item.kind === 'image') {
    return failed
      ? React.createElement(VideoFallback, { item, icon: 'fileError' })
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
  return h(LinkPoster, { item })
}

export function VideoFallback({ item, icon = 'video' }) {
  return h('div', { className: 'vms-video-fallback' },
    h(Icon, { name: icon, size: 18 }),
    h('span', null, item.kind === 'link' ? domainOf(item) : item.ext.toUpperCase()))
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

export function LinkPoster({ item }) {
  const direct = item.kind === 'video' || item.kind === 'audio' || item.kind === 'image'
  return h('div', { className: `vms-link-poster${direct ? ' is-direct' : ''}` },
    h('div', { className: 'vms-link-bar' }, h('i', null), h('i', null), h('i', null), h('span', null, domainOf(item))),
    h('div', { className: 'vms-link-body' },
      h('span', { className: 'vms-link-glyph' }, h(Icon, { name: item.kind === 'link' ? 'link' : item.kind, size: 16 })),
      h('b', null, item.title),
      h('span', { className: 'vms-link-tag' }, direct ? 'REMOTE MEDIA' : 'WEB LINK')))
}

export function KindBadge({ kind }) {
  return h('span', { className: 'vms-kind-badge', 'data-kind': kind },
    h('i', null), typeLabel(kind))
}

export function DurationBadge({ item }) {
  if (item.kind === 'video' || item.kind === 'audio') {
    return item.duration ? h('span', { className: 'vms-duration' }, formatTime(item.duration)) : null
  }
  if (item.kind === 'image') {
    return h('span', { className: 'vms-duration' }, item.width && item.height ? `${item.width}×${item.height}` : item.ext.toUpperCase())
  }
  return h('span', { className: 'vms-duration' }, '网页')
}

export function InlineMedia({ item, sessionId, onExpand }) {
  const src = mediaSrc(sessionId, item)
  if (item.kind === 'audio') {
    return h('div', {
      className: 'vms-inline-audio', style: coverOf(item, 0),
      onClick: event => event.stopPropagation(),
    },
    h('div', { className: 'vms-inline-audio-head' },
      h('span', { className: 'vms-inline-audio-glyph' }, h(Icon, { name: 'audio', size: 14 })),
      h('b', null, item.title)),
    h('audio', { className: 'vms-inline-audio-native', src, controls: true, autoPlay: true, preload: 'auto' }),
    h('button', { type: 'button', className: 'vms-inline-expand', 'aria-label': '放大', onClick: onExpand }, h(Icon, { name: 'full', size: 12 })))
  }
  return h('div', { className: 'vms-inline-video', onClick: event => event.stopPropagation() },
    h('video', { src, controls: true, autoPlay: true, playsInline: true, preload: 'auto' }),
    h('button', { type: 'button', className: 'vms-inline-expand', 'aria-label': '放大', onClick: onExpand }, h(Icon, { name: 'full', size: 12 })))
}

export function GridCard({ item, index, sessionId, active, onOpen, onInline }) {
  const canPlay = item.kind === 'video' || item.kind === 'audio'
  const meta = `${folderOf(item) || '根目录'} · ${formatBytes(item.size)} · ${formatDate(item.mtimeMs)}`
  return h('article', {
    className: 'vms-card', tabIndex: 0, 'data-playing': active ? '' : undefined,
    'aria-label': `${item.title}，${typeLabel(item.kind)}`,
    onClick: () => onOpen(item),
    onKeyDown: event => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      onOpen(item)
    },
  },
  h('div', { className: 'vms-card-media' },
    h(MediaThumb, { item, sessionId, lazy: true }),
    h('span', { className: 'vms-card-index' }, String(index + 1).padStart(2, '0')),
    h(KindBadge, { kind: item.kind }),
    h(DurationBadge, { item }),
    canPlay && !active && h('button', {
      type: 'button', className: 'vms-play-btn', 'aria-label': `播放 ${item.title}`,
      onClick: event => { event.stopPropagation(); onInline(item) },
    }, h(Icon, { name: 'play', size: 17 })),
    h('div', { className: 'vms-card-actions' },
      canPlay && h('button', { type: 'button', className: 'vms-mini-action', title: '原地播放', 'aria-label': '原地播放', onClick: event => { event.stopPropagation(); onInline(item) } }, h(Icon, { name: 'play', size: 12 })),
      h('button', { type: 'button', className: 'vms-mini-action', title: '放大查看', 'aria-label': '放大查看', onClick: event => { event.stopPropagation(); onOpen(item) } }, h(Icon, { name: item.kind === 'link' ? 'external' : 'full', size: 12 }))),
    active && canPlay && h(InlineMedia, { item, sessionId, onExpand: () => onOpen(item) }),
    !active && item.kind === 'link' && h('button', {
      type: 'button', className: 'vms-play-btn', 'aria-label': '打开链接',
      onClick: event => { event.stopPropagation(); onOpen(item) },
    }, h(Icon, { name: 'external', size: 17 }))),
  h('div', { className: 'vms-card-info' },
    h('h3', { title: item.title }, item.title),
    h('p', null, meta),
    active && h('span', { className: 'vms-playing-note' }, h('i', null), '正在播放')))
}

export function ListRow({ item, sessionId, onOpen, onPlay }) {
  const canPlay = item.kind === 'video' || item.kind === 'audio'
  return h('div', {
    className: 'vms-row', tabIndex: 0, 'data-kind': item.kind,
    onClick: () => onOpen(item),
    onKeyDown: event => { if (event.key === 'Enter') { event.preventDefault(); onOpen(item) } },
  },
  h('div', { className: 'vms-row-thumb' },
    h(MediaThumb, { item, sessionId, lazy: true }),
    h('span', { className: 'vms-row-duration' }, canPlay ? formatTime(item.duration) : typeLabel(item.kind))),
  h('div', { className: 'vms-row-main' }, h('b', null, item.title), h('small', null, folderOf(item) || '根目录')),
  h('div', { className: 'vms-row-kind', 'data-kind': item.kind }, h('i', null), typeLabel(item.kind)),
  h('div', { className: 'vms-row-meta' }, item.kind === 'image' ? (item.width && item.height ? `${item.width}×${item.height}` : item.ext.toUpperCase()) : item.kind === 'link' ? domainOf(item) : formatTime(item.duration)),
  h('div', { className: 'vms-row-size' }, formatBytes(item.size)),
  h('div', { className: 'vms-row-time' }, formatDate(item.mtimeMs)),
  h('button', {
    type: 'button', className: 'vms-row-play', title: canPlay ? '播放' : '查看',
    onClick: event => { event.stopPropagation(); if (canPlay) onPlay(item); else onOpen(item) },
  }, h(Icon, { name: canPlay ? 'play' : item.kind === 'link' ? 'external' : 'full', size: 12 })))
}

export function NativeMedia({ item, sessionId, visible = true }) {
  const src = mediaSrc(sessionId, item)
  const videoRef = useRef(null)
  const [failed, setFailed] = useState(false)
  const [failure, setFailure] = useState(null)

  // Ask the route directly so a 4xx/5xx body — the actual reason — is shown
  // instead of the element's generic decode failure.
  useEffect(() => {
    if (item.source === 'url') { setFailure(null); return undefined }
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
      h('span', null, item.source === 'url' ? '在线媒体加载失败' : '当前浏览器无法播放此媒体'),
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
      h('audio', { src, controls: true, autoPlay: true, preload: 'metadata', onError: () => setFailed(true) }))
  }

  return h('div', { className: 'vms-native-video' },
    h('video', {
      ref: videoRef, src, controls: true, autoPlay: true, playsInline: true, preload: 'metadata',
      poster: item.poster, onError: () => setFailed(true),
    }))
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

export function LinkSlide({ slide, onOpen }) {
  const [copied, setCopied] = useState(false)
  return h('div', { className: 'vms-link-slide' },
    h('span', { className: 'vms-link-slide-glyph' }, h(Icon, { name: 'link', size: 24 })),
    h('b', null, slide.title),
    h('code', null, slide.url),
    h('div', { className: 'vms-link-slide-actions' },
      h('button', {
        type: 'button', className: 'vms-primary-btn',
        onClick: () => onOpen ? onOpen(slide.url) : window.open(slide.url, '_blank', 'noopener,noreferrer'),
      }, h(Icon, { name: 'external', size: 13 }), '在浏览器中打开'),
      h('button', {
        type: 'button', className: 'vms-ghost-btn',
        onClick: async () => {
          try { await navigator.clipboard.writeText(slide.url); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch { /* clipboard denied */ }
        },
      }, h(Icon, { name: copied ? 'check' : 'copy', size: 13 }), copied ? '已复制' : '复制链接')))
}

/** Custom lightbox slide for audio and links; other slides use the library defaults. */
export function lightboxRenderSlide(onOpen) {
  return function renderSlide({ slide, offset }) {
    if (slide.type === 'vms-audio') return h(AudioSlide, { slide, offset })
    if (slide.type === 'vms-link') return h(LinkSlide, { slide, onOpen })
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
  if (slide.type === 'vms-link') {
    return h('span', { className: 'vms-lightbox-thumb-icon is-link' }, h(Icon, { name: 'link', size: 14 }))
  }
  return undefined
}
