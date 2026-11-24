/** Conversation timeline: one node per user message, with the files it produced. */
import React, { useMemo } from 'react'
import { COLLATOR, formatTime } from './helpers.js'
import { sectionOf } from './sections.js'
import { Icon, kindIcon } from './icons.js'

const h = React.createElement

const KIND_BY_EXT = {
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'ico', 'svg', 'tif', 'tiff'],
  video: ['mp4', 'm4v', 'mov', 'webm', 'ogv', 'mkv', 'avi', 'wmv', 'flv'],
  audio: ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'opus', 'wma', 'aiff', 'aif'],
  document: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'markdown', 'csv', 'tsv', 'log', 'rtf'],
  archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz', 'iso'],
}

function fileKindOf(name) {
  const dot = name.lastIndexOf('.')
  const ext = dot <= 0 ? '' : name.slice(dot + 1).toLowerCase()
  for (const [kind, extensions] of Object.entries(KIND_BY_EXT)) {
    if (extensions.includes(ext)) return [kind, ext]
  }
  return ext === '' ? ['other', ext] : ['code', ext]
}

function dirOf(path) {
  const slash = path.lastIndexOf('/')
  return slash === -1 ? '' : path.slice(0, slash)
}

function clockOf(ms) {
  const date = new Date(ms)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function TimelineNode({ node, lookup, onOpen, onMenu }) {
  const files = Array.isArray(node.files) ? node.files : []
  const groups = useMemo(() => {
    const map = new Map()
    for (const file of files) {
      const dir = dirOf(file.display ?? file.path)
      const list = map.get(dir)
      if (list === undefined) map.set(dir, [file])
      else list.push(file)
    }
    return [...map.entries()].sort((left, right) => COLLATOR.compare(left[0], right[0]))
  }, [files])

  return h('div', { className: 'vms-tl-node' },
    h('span', { className: 'vms-tl-dot', 'aria-hidden': true }),
    h('div', { className: 'vms-tl-body' },
      h('header', { className: 'vms-tl-head' },
        h('span', { className: 'vms-tl-clock' }, clockOf(node.time)),
        h('span', { className: 'vms-tl-prompt', title: node.prompt }, node.prompt || '（无提示词）'),
        h('span', { className: 'vms-tl-count' },
          files.length === 0 ? '无产出' : `${files.length} 个文件`)),
      files.length > 0 && groups.map(([dir, entries]) => h('div', { key: dir || '.', className: 'vms-tl-group' },
        h('div', { className: 'vms-tl-dir' },
          h(Icon, { name: 'folder', size: 11 }),
          dir === '' ? '工作区根目录' : dir),
        entries.map(file => {
          const name = (file.display ?? file.path).split('/').pop() ?? file.path
          const [kind, ext] = fileKindOf(name)
          const target = lookup.get(file.path) ?? lookup.get(file.display)
          return h('button', {
            key: `${file.path}:${file.display}`,
            type: 'button',
            className: `vms-tl-file${target === undefined ? ' is-missing' : ''}`,
            title: file.display ?? file.path,
            onClick: target === undefined ? undefined : () => onOpen(target),
            onContextMenu: event => {
              event.preventDefault()
              if (target === undefined) return
              onMenu(target, event.clientX, event.clientY)
            },
          },
          h(Icon, { name: kindIcon(kind, ext), size: 13 }),
          h('span', { className: 'vms-tl-name' }, name),
          file.binary === true
            ? h('span', { className: 'vms-tl-stat' }, '二进制')
            : h('span', { className: 'vms-tl-stat' },
              file.added > 0 ? `+${file.added}` : '',
              file.deleted > 0 ? ` −${file.deleted}` : '',
              file.added === 0 && file.deleted === 0 ? '已修改' : ''),
          target === undefined && h('span', { className: 'vms-tl-missing' }, '已不存在'))
        })))))
}

/**
 * The conversation timeline.
 * @param {object} props - timeline inputs.
 */
export function SessionTimeline({ nodes, items, onOpen, onMenu, onFallback }) {
  const lookup = useMemo(() => {
    const map = new Map()
    for (const item of items) {
      if (item.source !== 'local') continue
      map.set(item.relativePath, item)
      map.set(item.id, item)
      map.set(item.title, item)
    }
    return map
  }, [items])

  const sections = useMemo(() => {
    const usable = (Array.isArray(nodes) ? nodes : [])
      .filter(node => typeof node.time === 'number')
    const grouped = []
    for (const node of usable) {
      const section = sectionOf(node.time)
      const last = grouped[grouped.length - 1]
      if (last !== undefined && last.section.key === section.key) last.nodes.push(node)
      else grouped.push({ section, nodes: [node] })
    }
    return grouped
  }, [nodes])

  if (sections.length === 0) {
    return h('div', { className: 'vms-tl-empty' },
      h(Icon, { name: 'clock', size: 20 }),
      h('b', null, '这条会话还没有消息'),
      h('p', null, '发送一条消息后，这里会按时间列出每次对话及其产出的文件。'),
      onFallback !== undefined && h('button', { type: 'button', className: 'vms-ghost-btn', onClick: onFallback }, '改为按文件列表查看'))
  }

  return h('div', { className: 'vms-timeline' },
    sections.map(group => h('div', { key: group.section.key, className: 'vms-tl-section' },
      h('div', { className: 'vms-tl-section-head' }, group.section.label),
      h('div', { className: 'vms-tl-axis' },
        group.nodes.map(node => h(TimelineNode, {
          key: node.seq,
          node,
          lookup,
          onOpen,
          onMenu,
        }))))))
}