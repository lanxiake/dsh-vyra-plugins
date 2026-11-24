/**
 * Pointer long-press drag for files and folders.
 *
 * A press held for {@link LONG_PRESS_MS} starts a drag that follows the pointer
 * with a floating ghost. Releasing over a folder target moves the entry there;
 * releasing over the composer inserts an `@path` reference. A quick click or a
 * scroll never starts a drag.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'

const h = React.createElement
const LONG_PRESS_MS = 250
const MOVE_TOLERANCE = 6

/** The composer's drop area: the smallest ancestor that looks like a composer card. */
export function composerDropRect() {
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

/**
 * @param {object} options - drag callbacks.
 * @param {(item: object, toFolder: string) => void} options.onMove - move into a folder.
 * @param {(item: object) => void} options.onReference - insert a composer mention.
 * @returns {{ bind: (item: object) => object, ghost: React.ReactElement | null, dragging: object | null }}
 */
export function useDragDrop({ onMove, onReference }) {
  const [dragging, setDragging] = useState(null)
  const [ghostAt, setGhostAt] = useState({ x: 0, y: 0 })
  const [overFolder, setOverFolder] = useState('')
  const state = useRef({
    timer: 0,
    item: null,
    pointerId: -1,
    startX: 0,
    startY: 0,
    active: false,
    suppressClick: false,
  })

  const finish = useCallback((clientX, clientY) => {
    const current = state.current
    current.active = false
    setDragging(null)
    setOverFolder('')
    const item = current.item
    current.item = null
    if (item === null) return
    if (typeof document === 'undefined') return

    const element = document.elementFromPoint(clientX, clientY)
    const folderTarget = element?.closest?.('[data-vms-drop-folder]')
    if (folderTarget !== null && folderTarget !== undefined) {
      const toFolder = folderTarget.getAttribute('data-vms-drop-folder') ?? ''
      const currentFolder = item.isFolder ? (item.folder ?? '') : (item.folder ?? '')
      if (toFolder !== currentFolder) onMove(item, toFolder)
      return
    }
    const rect = composerDropRect()
    if (rect !== undefined && clientX >= rect.left && clientX <= rect.right
      && clientY >= rect.top && clientY <= rect.bottom) {
      onReference(item)
    }
  }, [onMove, onReference])

  useEffect(() => {
    if (dragging === null) return undefined
    const onMovePointer = event => {
      setGhostAt({ x: event.clientX, y: event.clientY })
      const element = document.elementFromPoint(event.clientX, event.clientY)
      const folderTarget = element?.closest?.('[data-vms-drop-folder]')
      setOverFolder(folderTarget === null || folderTarget === undefined
        ? ''
        : (folderTarget.getAttribute('data-vms-drop-folder') ?? ''))
    }
    const onUp = event => {
      window.removeEventListener('pointermove', onMovePointer)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      finish(event.clientX, event.clientY)
    }
    const onKey = event => {
      if (event.key !== 'Escape') return
      window.removeEventListener('pointermove', onMovePointer)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      state.current.active = false
      state.current.item = null
      setDragging(null)
      setOverFolder('')
    }
    window.addEventListener('pointermove', onMovePointer)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointermove', onMovePointer)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('keydown', onKey)
    }
  }, [dragging, finish])

  const bind = useCallback(item => ({
    onPointerDown: event => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) return
      const current = state.current
      if (current.active) return
      current.item = item
      current.pointerId = event.pointerId
      current.startX = event.clientX
      current.startY = event.clientY
      current.suppressClick = false
      const start = () => {
        current.timer = 0
        current.active = true
        current.suppressClick = true
        setDragging(item)
        setGhostAt({ x: current.startX, y: current.startY })
      }
      current.timer = window.setTimeout(start, LONG_PRESS_MS)
      const cancel = () => {
        if (current.timer !== 0) window.clearTimeout(current.timer)
        current.timer = 0
        window.removeEventListener('pointerup', cancel)
        window.removeEventListener('pointercancel', cancel)
        window.removeEventListener('pointermove', onEarlyMove)
      }
      const onEarlyMove = event2 => {
        if (current.active) return
        if (Math.abs(event2.clientX - current.startX) > MOVE_TOLERANCE
          || Math.abs(event2.clientY - current.startY) > MOVE_TOLERANCE) cancel()
      }
      window.addEventListener('pointerup', cancel)
      window.addEventListener('pointercancel', cancel)
      window.addEventListener('pointermove', onEarlyMove)
    },
    onDragStart: event => event.preventDefault(),
  }), [])

  const suppressNextClick = useCallback(() => {
    if (!state.current.suppressClick) return false
    state.current.suppressClick = false
    return true
  }, [])

  const ghost = dragging === null ? null : h('div', {
    className: 'vms-drag-ghost',
    style: { left: `${ghostAt.x + 12}px`, top: `${ghostAt.y + 12}px` },
  },
  h('span', { className: 'vms-drag-name' }, dragging.title ?? dragging.name ?? ''),
  overFolder !== '' && h('span', { className: 'vms-drag-target' }, `移动到 ${overFolder}`))

  return { bind, ghost, dragging, suppressNextClick }
}