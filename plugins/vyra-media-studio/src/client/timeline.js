/** Produced-files timeline: per-turn changes grouped by calendar day. */
import React, { useMemo, useState } from 'react'
import { COLLATOR, folderOf, formatTime, typeLabel } from './helpers.js'
import { sectionOf } from './sections.js'
import { Icon, kindIcon } from './icons.js'

const h = React.createElement

function fileKindOf(name) {
  const dot = name.lastIndexOf('.')
  const ext = dot <= 0 ? '' : name.slice(dot + 1).toLowerCase()
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'ico', 'svg', 'tif', 'tiff'].includes(ext)) return ['image', ext]
  if (['mp4', 'm4v', 'mov', 'webm', 'ogv', 'mkv', 'avi', 'wmv', 'flv'].includes(ext)) return ['video', ext]
  if (['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'opus', 'wma', 'aiff', 'aif'].includes(ext)) return ['audio', ext]
  if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'markdown', 'csv', 'tsv', 'log', 'rtf'].includes(ext)) return ['document', ext]
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz', 'iso'].includes(ext)) return ['archive', ext]
  if (ext !== '') return ['code', ext]
  return ['other', ext]
}

/** `src/a.ts` → `src`, used to fold a turn's files by directory. */
function dirOf(path) {
  const slash = path.lastIndexOf('/')
  return slash === -1 ? '' : path.slice(0, slash)
}

function TurnBlock({ turn, items, lookup, onOpen, onMenu }) {
  const byDirectory = useMemo(() => {
    const groups = new Map()
    for (const file of items) {
      const dir = dirOf(file.display ?? file.path)
      const list = groups.get(dir)
      if (list === undefined) groups.set(dir, [file])
      else list.push(file)
    }
    return [...groups.entries()].sort((left, right) => COLLATOR.compare(left[0], right[0]))
  }, [items])

  return h('section', { className: 'vms-tl-turn' },
    h('header', { className: 'vms-tl-head' },
      h('b', null, turn.turn === undefined ? '本轮产出' : `第 ${turn.turn} 轮`),
      turn.time !== undefined && h('span', { className: 'vms-tl-time' }, formatTime(new Date(turn.time).getTime() / 1000)),
      h('span', { className: 'vms-tl-count' }, `${items.length} 个文件`)),
    byDirectory.map(([dir, files]) => h('div', { key: dir || '.', className: 'vms-tl-group' },
      h('div', { className: 'vms-tl-dir' }, h(Icon, { name: 'folder', size: 11 }), dir === '' ? '工作区根目录' : dir),
      files.map(file => {
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
      }))))
}

/**
 * The timeline itself.
 * @param {object} props - timeline inputs.
 */
export function SessionTimeline({ turns, items, onOpen, onMenu, onFallback }) {
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

  const ordered = useMemo(() => {
    const usable = turns
      .filter(turn => Array.isArray(turn.files) && turn.files.length > 0 && typeof turn.time === 'number')
      .sort((left, right) => right.time - left.time)
    const sections = []
    for (const turn of usable) {
      const section = sectionOf(turn.time)
      const last = sections[sections.length - 1]
      if (last !== undefined && last.section.key === section.key) last.turns.push(turn)
      else sections.push({ section, turns: [turn] })
    }
    return sections
  }, [turns])

  if (ordered.length === 0) {
    return h('div', { className: 'vms-tl-empty' },
      h(Icon, { name: 'clock', size: 20 }),
      h('b', null, '还没有可显示的产出台账'),
      h('p', null, '这个会话的 Host 没有记录到每轮改动的文件摘要。'),
      onFallback !== undefined && h('button', { type: 'button', className: 'vms-ghost-btn', onClick: onFallback }, '改为按修改时间查看'))
  }

  return h('div', { className: 'vms-timeline' },
    ordered.map(group => h('div', { key: group.section.key, className: 'vms-tl-section' },
      h('div', { className: 'vms-tl-section-head' }, group.section.label),
      group.turns.map(turn => h(TurnBlock, {
        key: turn.seq,
        turn,
        items: turn.files,
        lookup,
        onOpen,
        onMenu,
      })))))
}