/**
 * 内置编辑器：双击远程文本文件就地改，Ctrl+S 存回服务器。
 *
 * 这里不做「下载 → 改 → 再传」的往返：`files/read` 与 `files/write` 直接走 SFTP，
 * 写的时候服务端先写临时文件、沿用原权限、再 rename——中途断线不会把原文件截成半截。
 *
 * 保存前会比对 mtime：如果这期间别人也改过同一个文件，先问一句再决定要不要覆盖。
 */
import { hostReact } from './react.js'
import { h } from './jsx-shim.js'
import { api } from './api.js'
import { notify } from './state.js'
import { toast } from './state.js'

const editor = {
  open: false,
  connection: null,
  path: '',
  text: '',
  saved: '',
  mtime: null,
  busy: false,
  error: '',
  force: false,
}

const subs = new Set()
const notifyEditor = () => [...subs].forEach((f) => f())
function useEditorState() {
  const [, set] = globalThis.__dshSshTerminalReact.useState(0)
  globalThis.__dshSshTerminalReact.useEffect(() => {
    const f = () => set((v) => v + 1)
    subs.add(f)
    return () => subs.delete(f)
  }, [])
  return editor
}

export const editorState = editor

export function isEditorOpen() {
  return editor.open
}

/** 打开一个文件。闸门不过就如实说明原因，不静默失败。 */
export async function openEditor(connectionId, path) {
  editor.open = true
  editor.connection = connectionId
  editor.path = path
  editor.text = ''
  editor.saved = ''
  editor.mtime = null
  editor.busy = true
  editor.error = ''
  editor.force = false
  notifyEditor()
  try {
    const r = await api('files/read', undefined, { connection: connectionId, path })
    editor.text = r.text
    editor.saved = r.text
    editor.mtime = r.mtime
  } catch (e) {
    editor.error = e.message
  }
  editor.busy = false
  notifyEditor()
}

export function closeEditor() {
  editor.open = false
  notifyEditor()
}

/**
 * 保存。
 * @param {boolean} [force] 用户已经看过"文件被改过"的提示，坚持覆盖
 */
export async function saveEditor(force = false) {
  if (editor.busy) return
  editor.busy = true
  editor.error = ''
  notifyEditor()
  try {
    const r = await api('files/write', {
      connection: editor.connection,
      path: editor.path,
      text: editor.text,
      // 已经坚持要覆盖过一次，就不再带旧 mtime（否则会一直被挡）
      mtime: force || editor.force ? undefined : editor.mtime,
    })
    editor.saved = editor.text
    editor.mtime = r.mtime
    editor.force = false
    toast('已保存到服务器', 'success')
  } catch (e) {
    if (e.code === 'mtime_changed') {
      editor.force = true
      editor.error = '这个文件在你编辑期间被改过了。再按一次 Ctrl+S 就会覆盖。'
    } else {
      editor.error = e.message
    }
  }
  editor.busy = false
  notifyEditor()
}

export function EditorPanel() {
  const st = useEditorState()
  if (!st.open) return null
  const dirty = st.text !== st.saved
  const cid = st.connection

  globalThis.__dshSshTerminalReact.useEffect(() => {
    if (!st.open) return
    const onKey = (e) => {
      // Ctrl+S：存回服务器（浏览器默认的"另存网页"要拦掉）
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (dirty) void saveEditor(editor.force)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        closeEditor()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [st.open, dirty])

  const unreachable = () => (cid ? openEditor(cid, st.path) : undefined)

  return h(
    'div',
    { className: 'sx-overlay', onMouseDown: (e) => e.target === e.currentTarget && closeEditor() },
    h(
      'div',
      { className: 'sx-dialog sx-editor' },
      h(
        'div',
        { className: 'sx-editor-head' },
        h('span', { className: 'sx-editor-path', title: st.path }, st.path),
        dirty && h('span', { className: 'sx-editor-dirty' }, '未保存'),
        h('span', { className: 'sx-editor-spacer' }),
        h('button', { className: 'sx-btn sm pri', disabled: st.busy || !dirty, onClick: () => saveEditor(editor.force) }, '保存 (Ctrl+S)'),
        h('button', { className: 'sx-btn sm', onClick: closeEditor }, '关闭')
      ),
      st.error &&
        h(
          'div',
          { className: 'sx-editor-error' },
          st.error,
          h('button', { className: 'sx-btn sm', onClick: unreachable, style: { marginLeft: 8 } }, '重新读取')
        ),
      st.busy && !st.text
        ? h('div', { className: 'sx-hint' }, '读取中…')
        : h('textarea', {
            className: 'sx-editor-body',
            value: st.text,
            spellCheck: false,
            // 行号列不画：等宽 + 关闭折行更接近终端里的观感，行数多时也不卡
            wrap: 'off',
            readOnly: st.busy,
            onInput: (e) => {
              editor.text = e.target.value
              notifyEditor()
            },
            onKeyDown: (e) => {
              // Tab 插入两个空格，而不是把焦点跳走——编辑配置时几乎总要缩进
              if (e.key === 'Tab') {
                e.preventDefault()
                const el = e.currentTarget
                const start = el.selectionStart
                const value = `${el.value.slice(0, start)}  ${el.value.slice(el.selectionEnd)}`
                editor.text = value
                notifyEditor()
                requestAnimationFrame(() => {
                  el.selectionStart = el.selectionEnd = start + 2
                })
              }
            },
          })
    )
  )
}
