/**
 * Pointer drag for files and folders, matching the OS file manager.
 *
 * Mouse behaves like Explorer: press and move starts a drag immediately.
 * Touch has no hover, so it waits {@link LONG_PRESS_MS} to tell a drag from a
 * scroll. Drop targets are the real ones on screen — folder rows, breadcrumb
 * segments, folder popup entries and the composer card.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from './icons.js'

const h = React.createElement
const LONG_PRESS_MS = 250
const MOUSE_THRESHOLD = 4

/** The composer card, located through the bridge anchor the plugin registers. */
function composerDropRect() {
  if (typeof document === 'undefined') return undefined
  const marker = document.querySelector('[data-vms-dropzone]')
  if (marker === null) return undefined
  let element = marker
  let rect = element.getBoundingClientRect()
  while (element.parentElement !== null && (rect.width < 240 || rect.height < 64)) {
    element = element.parentElement
    rect = element.getBoundingClientRect()
    if (rect.width > 1400 || rect.height > 700) break
  }
  return rect.width > 0 && rect.height > 0 ? rect : undefined
}

/** The nearest drop target under the pointer. */
function targetAt(clientX, clientY) {
  if (typeof document === 'undefined') return undefined
  const element = document.elementFromPoint(clientX, clientY)
  const folder = element?.closest?.('[data-vms-drop-folder]')
  if (folder !== null && folder !== undefined) {
    return { kind: 'folder', folder: folder.getAttribute('data-vms-drop-folder') ?? '' }
  }
  const rect = composerDropRect()
  if (rect !== undefined && clientX >= rect.left && clientX <= rect.right
    && clientY >= rect.top && clientY <= rect.bottom) return { kind: 'composer' }
  return undefined
}

/**
 * @param {object} options - drag callbacks.
 * @param {(item: object, toFolder: string) => void} options.onMove - move into a folder.
 * @param {(item: object) => void} options.onReference - insert a composer mention.
 * @returns {{ bind: (item: object) => object, dragging: object | null, suppressNextClick: () => boolean, ghost: React.ReactElement | null, dropKey: string }}
 */
export function useDragDrop({ onMove, onReference }) {
  const [dragging, setDragging] = useState(null)
  const [point, setPoint] = useState({ x: 0, y: 0 })
  const [dropKey, setDropKey] = useState('')
  const state = useRef({ timer: 0, item: null, startX: 0, startY: 0, active: false, suppress: false, touch: false })

  const finish = useCallback(target => {
    const current = state.current
    const item = current.item
    current.active = false
    current.item = null
    setDragging(null)
    setDropKey('')
    if (item === null || target === undefined) return
    if (target.kind === 'composer') onReference(item)
    else onMove(item, target.folder)
  }, [onMove, onReference])

  useEffect(() => {
    if (dragging === null) return undefined
    // `pointermove` fires only while the button stays down; the window listener
    // is what lets the ghost follow across the panel and the composer.
    const onMovePointer = event => {
      setPoint({ x: event.clientX, y: event.clientY })
      const target = targetAt(event.clientX, event.clientY)
      setDropKey(target === undefined ? '' : target.kind === 'composer' ? 'composer' : `folder:${target.folder}`)
    }
    const onUp = event => finish(targetAt(event.clientX, event.clientY))
    const onKey = event => {
      if (event.key !== 'Escape') return
      state.current.active = false
      state.current.item = null
      setDragging(null)
      setDropKey('')
    }
    window.addEventListener('pointermove', onMovePointer)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onKey)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointermove', onMovePointer)
      window.removeEventListener('pointerup', onUp)
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
      // A pen or touch has no hover, so it needs the long-press delay; a mouse
      // starts dragging as soon as it moves.
      current.touch = event.pointerType === 'touch' || event.pointerType === 'pen'

      const begin = () => {
        current.timer = 0
        current.active = true
        setDragging(item)
        setPoint({ x: current.startX, y: current.startY })
      }
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
        const moved = Math.abs(event2.clientX - current.startX) > MOUSE_THRESHOLD
          || Math.abs(event2.clientY - current.startY) > MOUSE_THRESHOLD
        if (!current.touch) {
          // Mouse: moving past the threshold begins the drag rather than
          // cancelling it. This was the bug that made dragging do nothing.
          if (moved) { cleanup(); begin() }
          return
        }
        // Touch: a scroll gesture cancels the pending long press.
        if (moved) cleanup()
      }
      window.addEventListener('pointerup', cancel)
      window.addEventListener('pointercancel', cancel)
      window.addEventListener('pointermove', earlyMove)
      if (current.touch) current.timer = window.setTimeout(begin, LONG_PRESS_MS)
    },
    onDragStart: event => event.preventDefault(),
  }), [])

  const suppressNextClick = useCallback(() => {
    if (!state.current.suppress) return false
    state.current.suppress = false
    return true
  }, [])

  // A drag that actually started must not also fire the row's click.
  useEffect(() => {
    if (dragging !== null) state.current.suppress = true
  }, [dragging])

  const ghost = dragging === null ? null : h('div', {
    className: `vms-drag-ghost${dropKey === 'composer' ? ' is-composer' : ''}`,
    style: { left: `${point.x + 12}px`, top: `${point.y + 12}px` },
  },
  h(Icon, { name: dropKey === 'composer' ? 'at' : 'move', size: 14 }),
  h('span', { className: 'vms-drag-name' }, dragging.title ?? dragging.name ?? ''),
  dropKey.startsWith('folder:') && h('span', { className: 'vms-drag-target' },
    `移到 ${dropKey.slice(7) || '工作区根目录'}`),
  dropKey === 'composer' && h('span', { className: 'vms-drag-target' }, '插入引用'))

  return { bind, dragging, suppressNextClick, ghost, dropKey }
}