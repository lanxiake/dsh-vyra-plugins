/**
 * Bridge to the conversation composer. The Library is mounted in the right
 * Sidebar, while the composer lives inside the conversation pane, so a tiny
 * component registered into `conversation.input.left` captures the current
 * session's `inputActions` for the panel to insert `@path` mentions, and
 * renders an invisible anchor the panel uses to find the composer's drop area.
 */
import React, { useEffect } from 'react'

let composers = new Map()

/**
 * @param {string} sessionId - Session identity.
 * @param {object} actions - composer actions supplied by the Host slot.
 * @returns {() => void} detach callback.
 */
export function attachComposer(sessionId, actions) {
  composers = new Map(composers).set(sessionId, actions)
  return () => {
    if (composers.get(sessionId) !== actions) return
    composers = new Map([...composers].filter(([id]) => id !== sessionId))
  }
}

/**
 * Insert text into the session's composer.
 * @param {string} sessionId - Session identity.
 * @param {string} text - text to insert.
 * @returns {boolean} whether the composer accepted the text.
 */
export function insertComposerText(sessionId, text) {
  const composer = composers.get(sessionId)
  if (composer === undefined) throw new Error('当前会话的输入框没有打开')
  if (!composer.insertText(text, composer.captureInsertion())) throw new Error('输入框暂时不接受输入')
  return true
}

/**
 * The composer's actions, or undefined when this session has no composer.
 * @param {string} sessionId - Session identity.
 * @returns {object | undefined} the actions.
 */
export function composerActions(sessionId) {
  return composers.get(sessionId)
}

/** The invisible bridge component; the slot supplies sessionId/inputActions. */
export function ComposerBridge(props) {
  const { sessionId, inputActions } = props
  useEffect(() => attachComposer(sessionId, inputActions), [sessionId, inputActions])
  // The anchor lets the panel measure the composer card for drop targeting.
  return React.createElement('span', {
    'data-vms-dropzone': sessionId,
    'aria-hidden': true,
    style: { display: 'block', width: 0, height: 0 },
  })
}