/**
 * Long-press drag for files and folders.
 *
 * A press held for {@link LONG_PRESS_MS} starts a drag. While dragging, a drop
 * panel appears inside the file manager with two kinds of destinations:
 *  - "插入到输入框" inserts an `@path` reference into the composer,
 *  - the folder list moves the entry into that folder.
 *
 * Because the destinations live in the panel itself, the gesture works in the
 * grid, the flat list and the tree alike.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'

const h = React.createElement
const LONG_PRESS_MS = 250
const MOVE_TOLERANCE = 6

/**
 * @param {object} options - drag callbacks and destinations.
 * @param {(item: object, toFolder: string) => void} options.onMove - move into a folder.
 * @param {(item: object) => void} options.onReference - insert a composer mention.
 * @param {string[]} [options.folders] - every workspace folder.
 * @param {string} [options.currentFolder] - the folder the panel is scoped to.
 * @returns {{ bind: (item: object) => object, dragging: object | null, suppressNextClick: () => boolean, panel: React.ReactElement | null }}
 */
export function useDragDrop({ onMove, onReference, folders = [], currentFolder = '' }) {
  const [dragging, setDragging] = useState(null)
  const [hover, setHover] = useState('')
  const state = useRef({ timer: 0, item: null, startX: 0, startY: 0, active: false, suppress: false })

  const finish = useCallback(destination => {
    const current = state.current
    const item = current.item
    current.active = false
    current.item = null
    setDragging(null)
    setHover('')
    if (item === null) return
    if (destination === 'reference') onReference(item)
    else onMove(item, destination)
  }, [onMove, onReference])

  useEffect(() => {
    if (dragging === null) return undefined
    const onPointerMove = event => {
      const element = document.elementFromPoint(event.clientX, event.clientY)
      const zone = element?.closest?.('[data-vms-drop]')
      setHover(zone === null || zone === undefined ? '' : (zone.getAttribute('data-vms-drop') ?? ''))
    }
    const onPointerUp = event => {
      const element = document.elementFromPoint(event.clientX, event.clientY)
      const zone = element?.closest?.('[data-vms-drop]')
      finish(zone === null || zone === undefined ? undefined : (zone.getAttribute('data-vms-drop') ?? ''))
    }
    const onKey = event => {
      if (event.key !== 'Escape') return
      state.current.active = false
      state.current.item = null
      setDragging(null)
      setHover('')
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onKey)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onKey)
      window.removeEventListener('keydown', onKey)
    }
  }, [dragging, finish])

  const bind = useCallback(item => ({
    onPointerDown: event => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) return
      const current = state.current
      if (current.active) return
      current.item = item
      current.startX = event.clientX
      current.startY = event.clientY
      current.suppress = false
      const cleanup = () => {
        if (current.timer !== 0) window.clearTimeout(current.timer)
        current.timer = 0
        window.removeEventListener('pointerup', cancel)
        window.removeEventListener('pointercancel', cancel)
        window.removeEventListener('pointermove', earlyMove)
      }
      const cancel = () => cleanup()
      const earlyMove = event2 => {
        if (current.active) return
        if (Math.abs(event2.clientX - current.startX) > MOVE_TOLERANCE
          || Math.abs(event2.clientY - current.startY) > MOVE_TOLERANCE) cleanup()
      }
      window.addEventListener('pointerup', cancel)
      window.addEventListener('pointercancel', cancel)
      window.addEventListener('pointermove', earlyMove)
      current.timer = window.setTimeout(() => {
        current.timer = 0
        current.active = true
        current.suppress = true
        setDragging(item)
      }, LONG_PRESS_MS)
    },
    onDragStart: event => event.preventDefault(),
  }), [])

  const suppressNextClick = useCallback(() => {
    if (!state.current.suppress) return false
    state.current.suppress = false
    return true
  }, [])

  let panel = null
  if (dragging !== null) {
    const own = dragging.relativePath ?? ''
    const blocked = new Set()
    if (dragging.isFolder === true) {
      blocked.add(own)
      for (const folder of folders) {
        if (folder === own || folder.startsWith(`${own}/`)) blocked.add(folder)
      }
    }
    const destinations = ['', ...folders].filter(folder => !blocked.has(folder))
    panel = h('div', { className: 'vms-drop-panel', role: 'dialog', 'aria-label': '拖动目标' },
      h('div', { className: 'vms-drop-head' },
        h('b', null, dragging.title ?? dragging.name ?? ''),
        h('span', null, '拖到目标后松手')),
      h('button', {
        type: 'button',
        className: `vms-drop-zone is-reference${hover === 'reference' ? ' is-over' : ''}`,
        'data-vms-drop': 'reference',
        onClick: () => finish('reference'),
      }, '插入到输入框'),
      h('div', { className: 'vms-drop-folders' },
        destinations.map(folder => h('button', {
          key: folder || '.',
          type: 'button',
          className: `vms-drop-zone${folder === currentFolder ? ' is-current' : ''}${hover === folder ? ' is-over' : ''}`,
          'data-vms-drop': folder,
          onClick: () => finish(folder),
        }, folder === '' ? '工作区根目录' : folder))))
  }

  return { bind, dragging, suppressNextClick, panel }
}