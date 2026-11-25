/** Conversation timeline: one collapsible node per user message, with its produced files. */
import React, { useEffect, useMemo, useState } from 'react'
import { COLLATOR } from './helpers.js'
import { sectionOf } from './sections.js'
import { Icon, kindIcon } from './icons.js'

const h = React.createElement

const KIND_BY_EXT = {
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'ico', 'svg', 'tif', 'tiff'],
  video: ['mp4', 'm4v', 'mov', 'webm', 'ogv', 'mkv', 'avi', 'wmv', 'flv'],
  audio: ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'opus', 'wma', 'aiff', 'aif'],
  document: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'markdown', 'csv', 'tsv', 'log', 'rtf'],
  archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz', 'iso'],
  html: ['html', 'htm'],
}

const KIND_LABEL = { image: '图片', video: '视频', audio: '音频', document: '文档', archive: '压缩包', html: 'HTML', code: '代码', other: '其他' }
const COLLAPSE_KEY = 'dsh-vyra-media-studio.timeline.collapsed.v1'

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

function readCollapsed() {
  try {
    const parsed = JSON.parse(localStorage.getItem(COLLAPSE_KEY) ?? '[]')
    return new Set(Array.isArray(parsed) ? parsed.filter(Number.isFinite) : [])
  } catch { return new Set() }
}

function writeCollapsed(set) {
  try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...set])) } catch { /* storage may be unavailable */ }
}

/** One produced file, as a grid tile or a list row. */
function FileEntry({ file, lookup, layout, onOpen, onMenu, dragBind, suppressClick }) {
  const name = (file.display ?? file.path).split('/').pop() ?? file.path
  const [kind, ext] = fileKindOf(name)
  const target = lookup.get(file.path) ?? lookup.get(file.display)
  const missing = target === undefined
  const stats = file.binary === true
    ? '二进制'
    : [file.added > 0 ? `+${file.added}` : '', file.deleted > 0 ? `-${file.deleted}` : ''].filter(Boolean).join(' ')

  // Dragging works from a timeline entry too: the entry resolves to the same
  // library item, so it is the same drag source as a grid card or list row.
  const handlers = {
    onContextMenu: event => {
      event.preventDefault()
      if (missing) return
      onMenu(target, event.clientX, event.clientY)
    },
    ...(dragBind === undefined || missing ? {} : dragBind(target)),
  }
  const title = `${file.display ?? file.path}${missing ? '（已不存在）' : ''}`
  const open = missing ? undefined : () => {
    if (suppressClick !== undefined && suppressClick()) return
    onOpen(target)
  }

  if (layout === 'grid') {
    return h('div', {
      key: `${file.path}:${file.display}`,
      role: 'button',
      tabIndex: 0,
      className: `vms-tl-tile${missing ? ' is-missing' : ''}`,
      'data-kind': kind,
      title,
      onClick: open,
      onKeyDown: event => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        if (open !== undefined) open()
      },
      ...handlers,
    },
    h('span', { className: 'vms-tl-tile-icon' }, h(Icon, { name: kindIcon(kind, ext), size: 20 })),
    h('span', { className: 'vms-tl-tile-name' }, name),
    h('span', { className: 'vms-tl-tile-meta' },
      h('span', { className: 'vms-tl-tag' }, kind === 'other' ? ext || '文件' : KIND_LABEL[kind]),
      stats !== '' && h('span', { className: `vms-tl-diff${file.added > 0 ? ' is-added' : ''}${file.deleted > 0 ? ' is-deleted' : ''}` }, stats)))
  }

  return h('div', {
    key: `${file.path}:${file.display}`,
    role: 'button',
    tabIndex: 0,
    className: `vms-tl-row${missing ? ' is-missing' : ''}`,
    'data-kind': kind,
    title,
    onClick: open,
    onKeyDown: event => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      if (open !== undefined) open()
    },
    ...handlers,
  },
  h('span', { className: 'vms-tl-row-icon' }, h(Icon, { name: kindIcon(kind, ext), size: 16 })),
  h('span', { className: 'vms-tl-row-name' }, name),
  h('span', { className: 'vms-tl-tag' }, kind === 'other' ? (ext || '文件') : KIND_LABEL[kind]),
  h('span', { className: `vms-tl-diff${file.added > 0 ? ' is-added' : ''}${file.deleted > 0 ? ' is-deleted' : ''}` },
    missing ? '已不存在' : (stats || '已修改')))
}

function TimelineNode({ node, lookup, layout, collapsed, onToggle, onOpen, onMenu, dragBind, suppressClick }) {
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

  const open = !collapsed
  return h('div', { className: `vms-tl-node${open ? '' : ' is-collapsed'}` },
    h('span', { className: 'vms-tl-dot', 'aria-hidden': true }),
    h('div', { className: 'vms-tl-body' },
      h('button', {
        type: 'button',
        className: 'vms-tl-head',
        'aria-expanded': open,
        title: open ? '收起这一轮' : '展开这一轮',
        onClick: onToggle,
      },
      h('span', { className: 'vms-tl-clock' }, clockOf(node.time)),
      h('span', { className: 'vms-tl-prompt', title: node.prompt }, node.prompt || '（无提示词）'),
      h('span', { className: 'vms-tl-count' }, `${files.length} 个文件`),
      h('span', { className: 'vms-tl-chevron' }, h(Icon, { name: 'chevronRight', size: 15 }))),
      open && files.length > 0 && (layout === 'grid'
        ? h('div', { className: 'vms-tl-tiles' },
          files.map(file => h(FileEntry, { key: `${file.path}:${file.display}`, file, lookup, layout, onOpen, onMenu, dragBind, suppressClick })))
        : groups.map(([dir, entries]) => h('div', { key: dir || '.', className: 'vms-tl-group' },
          h('div', { className: 'vms-tl-dir' },
            h(Icon, { name: 'folder', size: 14 }),
            dir === '' ? '工作区根目录' : dir),
          h('div', { className: 'vms-tl-rows' },
            entries.map(file => h(FileEntry, { key: `${file.path}:${file.display}`, file, lookup, layout, onOpen, onMenu, dragBind, suppressClick }))))))))
}

/**
 * Drop turns that produced no file change. An empty turn is only noise on an
 * axis whose job is "what did this conversation change"; a turn whose `files`
 * is missing counts as empty rather than throwing.
 * @param {Array<object> | undefined} nodes - turn nodes, newest first.
 * @returns {Array<object>} the turns that produced at least one file.
 */
export function filterNodesWithFiles(nodes) {
  return (Array.isArray(nodes) ? nodes : [])
    .filter(node => Array.isArray(node.files) && node.files.length > 0)
}

/**
 * The conversation timeline.
 * @param {object} props - timeline inputs.
 */
export function SessionTimeline({ nodes, items, diagnostics, layout = 'list', onOpen, onMenu, onFallback, dragBind, suppressClick }) {
  const [collapsed, setCollapsed] = useState(() => readCollapsed())
  const [sectionsOpen, setSectionsOpen] = useState(() => new Set())

  useEffect(() => { writeCollapsed(collapsed) }, [collapsed])

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
    const usable = filterNodesWithFiles(nodes).filter(node => typeof node.time === 'number')
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
    const probe = Array.isArray(diagnostics?.probe) ? diagnostics.probe : []
    const reason = diagnostics?.reason
    const failure = diagnostics?.error
    const headlines = {
      'no-session-events': '读不到这条会话的事件日志',
      'request-failed': '时间线请求失败',
      'no-workspace-root': '这条会话没有工作区目录',
    }
    const hints = {
      'no-session-events': '宿主没有通过任何服务暴露会话日志，下面是每个数据源的探测结果。',
      'request-failed': '插件路由返回了错误，括号里是宿主给出的原因。',
      'no-workspace-root': '没有工作区就无法扫描产出文件；消息本身仍然会列出。',
    }
    return h('div', { className: 'vms-tl-empty' },
      h(Icon, { name: 'clock', size: 20 }),
      h('b', null, headlines[reason] ?? '这条会话还没有产出文件'),
      h('p', null, hints[reason] ?? '发送一条消息后，这里会按时间列出每次对话及其产出的文件。'),
      failure !== undefined && h('code', { className: 'vms-tl-error' }, failure),
      probe.length > 0 && h('ul', { className: 'vms-tl-probe' },
        probe.map(source => h('li', { key: source.name },
          h('code', null, source.name),
          h('span', null, source.error === undefined ? `${source.count} 条事件` : `不可用：${source.error}`)))),
      onFallback !== undefined && h('button', { type: 'button', className: 'vms-ghost-btn', onClick: onFallback }, '改为按文件列表查看'))
  }

  return h('div', { className: `vms-timeline is-${layout}` },
    sections.map((group, index) => {
      // The newest day stays open; older days can be collapsed to skim the axis.
      const open = index === 0 || sectionsOpen.has(group.section.key)
      return h('div', { key: group.section.key, className: `vms-tl-section${open ? '' : ' is-collapsed'}` },
        h('button', {
          type: 'button',
          className: 'vms-tl-section-head',
          'aria-expanded': open,
          onClick: () => setSectionsOpen(previous => {
            const next = new Set(previous)
            if (next.has(group.section.key)) next.delete(group.section.key)
            else next.add(group.section.key)
            return next
          }),
        },
        h('span', { className: 'vms-tl-section-chevron' }, h(Icon, { name: 'chevronRight', size: 14 })),
        h('span', null, group.section.label),
        h('span', { className: 'vms-tl-section-count' }, `${group.nodes.length} 轮`)),
        open && h('div', { className: 'vms-tl-axis' },
          group.nodes.map(node => h(TimelineNode, {
            key: node.seq,
            node,
            lookup,
            layout,
            collapsed: collapsed.has(node.seq),
            onToggle: () => setCollapsed(previous => {
              const next = new Set(previous)
              if (next.has(node.seq)) next.delete(node.seq)
              else next.add(node.seq)
              return next
            }),
            onOpen,
            onMenu,
            dragBind,
            suppressClick,
          }))))
    }))
}