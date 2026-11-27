/**
 * AI 面板。
 *
 * 版式对齐 liteshell：左侧一条可拖的边、标题栏带模型名与 ⤢、对话区「一步一折叠」、
 * 输入区 Enter 发送。
 *
 * 对话区的结构是这四层，从下往上一层层套：
 *   - `user`    用户说的话
 *   - `interim` 模型在调工具之前那些铺垫，渲染成暗淡小字（不是回答）
 *   - `step`    一次工具调用 + 它的输出，标题就是真正要跑的那条命令，可折叠；
 *                失败的、需要确认的自动展开
 *   - `answer`  真正的回答，卡片样式
 *
 * 事件来自 Host 的 SSE（`ai/events`），形状见 ai.js 的 emit。
 */
import { hostReact } from './react.js'
import { h, Fragment } from './jsx-shim.js'
import { api } from './api.js'
import { Markdown } from './markdown.js'
import { classifyAttachment, attachmentBlocks } from './attachments.js'
import { activeSession } from './sessions.js'
import { notify, state, toast } from './state.js'

/** 面板状态：宽度、展开的步骤、草稿都留着（关掉再打开不该丢）。 */
const panel = {
  width: 520,
  dragging: false,
  steps: new Map(),
  draft: '',
  models: null,
  selected: null,
  items: [],
  historyOpen: false,
  history: [],
  historyQuery: '',
  busy: false,
  error: '',
  /** 待发送的附件：{ name, size, kind, mime?, text?, path? } */
  files: [],
}

const subs = new Set()
const notifyPanel = () => [...subs].forEach((f) => f())
function usePanel() {
  const [, set] = globalThis.__dshSshTerminalReact.useState(0)
  globalThis.__dshSshTerminalReact.useEffect(() => {
    const f = () => set((v) => v + 1)
    subs.add(f)
    return () => subs.delete(f)
  }, [])
  return panel
}

let events = null
function ensureEvents() {
  if (events) return
  events = new EventSource('/api/ssh-terminal/ai/events')
  events.onmessage = (ev) => {
    let m
    try {
      m = JSON.parse(ev.data)
    } catch {
      return
    }
    apply(m)
  }
}

/** 收到一条 Host 事件。 */
function apply(m) {
  const item = panel.items[panel.items.length - 1]
  switch (m.type) {
    case 'text': {
      // 流式文字：接在当前这条上
      const cur = findLast((x) => x.kind === 'answer' || x.kind === 'interim')
      if (cur && cur.streaming) cur.text = m.text
      else panel.items.push({ kind: m.interim ? 'interim' : 'answer', text: m.text, streaming: true })
      break
    }
    case 'tool-start':
      panel.items.push({ kind: 'step', id: m.id, name: m.name, command: m.command, args: m.args, state: 'running', at: Date.now() })
      panel.busy = true
      break
    case 'approval': {
      let step = panel.items.find((x) => x.kind === 'step' && x.id === m.id)
      if (!step) {
        step = { kind: 'step', id: m.id, name: m.name, command: m.command, args: m.args, state: 'asking', at: Date.now() }
        panel.items.push(step)
      }
      step.state = 'asking'
      step.risk = m.risk
      step.tone = m.tone
      step.reason = m.reason
      break
    }
    case 'tool-end': {
      const step = panel.items.find((x) => x.kind === 'step' && x.id === m.id)
      if (step) {
        step.state = m.ok ? 'ok' : 'failed'
        step.output = m.output ?? ''
        step.ms = m.ms
        step.handle = m.handle
      }
      break
    }
    case 'step-done':
      break
    case 'reset':
      // 后端换了对话（新建或恢复）：界面上的进行中状态一并清掉，
      // 否则会留下永远转圈的步骤卡。
      panel.busy = false
      for (const it of panel.items) if (it.streaming) it.streaming = false
      break
    case 'warning':
      panel.items.push({ kind: 'interim', text: `⚠ ${m.text}` })
      break
    case 'done':
      panel.busy = false
      for (const it of panel.items) if (it.streaming) it.streaming = false
      if (m.error) panel.items.push({ kind: 'interim', text: `出错：${m.error}` })
      if (m.finish === 'aborted') panel.items.push({ kind: 'interim', text: '已停止。' })
      break
    case 'approval-timeout': {
      const step = panel.items.find((x) => x.kind === 'step' && x.id === m.id)
      if (step) step.state = 'failed'
      break
    }
    default:
      break
  }
  void item
  notifyPanel()
}

const findLast = (pred) => {
  for (let i = panel.items.length - 1; i >= 0; i--) if (pred(panel.items[i])) return panel.items[i]
  return null
}

/** 一步工具调用的卡片。输出超过 8 行默认折起来，失败的一律摊开。 */
function StepCard({ step }) {
  const key = step.id
  const open = panel.steps.has(key) ? panel.steps.get(key) : step.state !== 'ok'
  const toggle = () => {
    panel.steps.set(key, !open)
    notifyPanel()
  }
  const lines = String(step.output ?? '').split('\n')
  const long = lines.length > 8 || String(step.output ?? '').length > 600
  const title = step.command || step.name
  const badge = step.state === 'asking' ? '待确认' : step.state === 'running' ? '运行中…' : step.state === 'failed' ? '失败' : '完成'

  return h(
    'div',
    { className: `sx-agent-step ${step.state} ${step.tone ?? ''}` },
    h(
      'button',
      { className: 'sx-step-h', onClick: toggle, type: 'button', 'aria-expanded': open },
      h('span', { className: 'sx-step-caret' }, open ? '▾' : '▸'),
      h('span', { className: 'sx-step-tag' }, step.name),
      h('span', { className: 'sx-step-title', title }, title),
      h('span', { className: 'sx-step-badge' }, badge)
    ),
    open &&
      h(
        'div',
        { className: 'sx-step-b' },
        step.state === 'asking' && h(ApprovalBody, { step }),
        step.reason && step.state === 'asking' && h('div', { className: 'sx-step-reason' }, step.reason),
        step.output &&
          h(
            'pre',
            { className: `sx-step-out ${long ? 'long' : ''}` },
            long ? `${lines.slice(0, 40).join('\n')}\n…（共 ${lines.length} 行，只显示前 40 行）` : step.output
          ),
        step.ms != null && h('div', { className: 'sx-step-foot' }, `exit=${step.state === 'failed' ? '非 0' : '0'} · ${step.ms}ms`)
      )
  )
}

/** 需要确认的一步：命令可以改，改完要重新过一遍风险判定（Host 会重判）。 */
function ApprovalBody({ step }) {
  const [text, setText] = globalThis.__dshSshTerminalReact.useState(step.command)
  const connId = activeSession()?.connId
  const reply = async (approved) => {
    step.state = approved ? 'running' : 'failed'
    if (!approved) step.output = '（用户拒绝了这一步）'
    notifyPanel()
    await api('ai/approve', { id: connId, step: step.id, approved }).catch(() => {})
  }
  return h(
    'div',
    { className: 'sx-approve' },
    h('textarea', {
      className: 'sx-input sx-approve-cmd',
      value: text,
      spellCheck: false,
      onChange: (e) => setText(e.target.value),
    }),
    h(
      'div',
      { className: 'sx-approve-btns' },
      h('button', { className: 'sx-btn sm', onClick: () => reply(false) }, '拒绝'),
      h('button', { className: 'sx-btn sm pri', onClick: () => reply(true) }, '执行')
    )
  )
}

/** 历史抽屉：按日期分组，点一条**真正接着聊**（后端把上下文恢复回去）。 */
function HistoryPane() {
  const connId = activeSession()?.connId
  const groups = new Map()
  for (const it of panel.history) {
    const d = new Date(it.at)
    const today = new Date()
    const label = d.toDateString() === today.toDateString() ? '今天' : d.toDateString()
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label).push(it)
  }
  const q = panel.historyQuery.toLowerCase()

  /** 把一条历史的显示还原到面板上（只还原消息，不猜工具卡）。 */
  const showHistory = (it) => {
    panel.items = (it.messages ?? [])
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .flatMap((m) =>
        (m.content ?? [])
          .filter((b) => b.type === 'text')
          .map((b) => ({ kind: m.role === 'assistant' ? 'answer' : 'user', text: b.text }))
      )
  }

  return h(
    'div',
    { className: 'sx-ai-history' },
    h('input', {
      className: 'sx-input sm',
      placeholder: '搜索历史…',
      value: panel.historyQuery,
      onInput: (e) => ((panel.historyQuery = e.target.value), notifyPanel()),
    }),
    h(
      'button',
      {
        className: 'sx-btn sm',
        onClick: async () => {
          // 新对话要**同时**清掉后端上下文：只清界面的话，下一句还会带着旧对话发出去。
          panel.items = []
          panel.historyOpen = false
          notifyPanel()
          await api('ai/new', { connection: connId }).catch(() => {})
        },
      },
      '＋ 新对话'
    ),
    [...groups.entries()].map(([label, list]) =>
      h(
        'div',
        { key: label, className: 'sx-ai-hgroup' },
        h('div', { className: 'sx-ai-hlabel' }, label),
        list
          .filter((it) => !q || String(it.title ?? '').toLowerCase().includes(q))
          .map((it) =>
            h(
              'div',
              {
                key: it.id,
                className: 'sx-ai-hitem',
                title: `${new Date(it.at).toLocaleString()}${it.model ? ` · ${it.model.model}` : ''}`,
                onClick: async () => {
                  // 先恢复后端上下文，成功后再换界面——顺序反了就出现「界面看着接上了、
                  // 模型其实全忘了」的假象。
                  try {
                    await api('ai/restore', { connection: connId, id: it.id })
                    showHistory(it)
                    panel.historyOpen = false
                    toast('已接上这段对话', 'success')
                  } catch (e) {
                    toast(`恢复失败：${e.message}`, 'error')
                  }
                  notifyPanel()
                },
              },
              h('span', { className: 'sx-ai-htitle' }, it.title || '未命名'),
              h(
                'span',
                {
                  className: 'sx-ai-hdel',
                  title: '删除这条历史',
                  onClick: async (e) => {
                    e.stopPropagation()
                    try {
                      await api('ai/delete', { connection: connId, id: it.id })
                      panel.history = panel.history.filter((x) => x.id !== it.id)
                      notifyPanel()
                    } catch (err) {
                      toast(`删除失败：${err.message}`, 'error')
                    }
                  },
                },
                '×'
              )
            )
          )
      )
    )
  )
}

/** 模型下拉：DSH 里配好的全部提供商。 */
function ModelPicker() {
  if (!panel.models?.groups?.length) {
    return h('span', { className: 'sx-dim' }, panel.selected ? `${panel.selected.provider} / ${panel.selected.model}` : '未选择模型')
  }
  const current = panel.selected
  return h(
    'select',
    {
      className: 'sx-input sm sx-ai-model',
      value: current ? `${current.provider}::${current.model}` : '',
      onChange: (e) => {
        const [provider, model] = e.target.value.split('::')
        panel.selected = { provider, model }
        notifyPanel()
      },
    },
    panel.models.groups.map((g) =>
      h(
        'optgroup',
        { key: g.id, label: g.name },
        g.models.map((m) => h('option', { key: m.id, value: `${g.id}::${m.id}` }, m.name))
      )
    )
  )
}

export function AiPanel() {
  const p = usePanel()
  const connId = activeSession()?.connId

  globalThis.__dshSshTerminalReact.useEffect(() => {
    ensureEvents()
    if (!p.models) {
      api('ai/models')
        .then((r) => {
          panel.models = r
          panel.selected = r.current
          notifyPanel()
        })
        .catch(() => {})
    }
  }, [])

  globalThis.__dshSshTerminalReact.useEffect(() => {
    if (!p.historyOpen || !connId) return
    api('ai/history', undefined, { connection: connId })
      .then((r) => {
        panel.history = r.items ?? []
        notifyPanel()
      })
      .catch(() => {})
  }, [p.historyOpen, connId])

  const send = async () => {
    const text = panel.draft.trim()
    const files = panel.files
    if ((!text && !files.length) || !connId) return
    panel.draft = ''
    panel.files = []
    panel.items.push({ kind: 'user', text: text || `（${files.length} 个附件）` })
    panel.busy = true
    notifyPanel()
    try {
      // 附件先按类型整理成内容块；协议层只接受"有限大小、已知类型"的东西
      const blocks = []
      for (const f of files) blocks.push(...attachmentBlocks(f))
      await api('ai/send', { connection: connId, text, blocks })
    } catch (e) {
      panel.items.push({ kind: 'interim', text: `发送失败：${e.message}` })
      panel.busy = false
      notifyPanel()
    }
  }

  /** 把一张图片读成 base64（不含 data: 前缀）；读不了就返回空串，由上层如实说明。 */
  const readImageData = (file) =>
    new Promise((resolve) => {
      try {
        const reader = new FileReader()
        reader.onload = () => {
          const result = String(reader.result ?? '')
          // "data:image/png;base64,XXXX" → "XXXX"
          const comma = result.indexOf(',')
          resolve(comma >= 0 ? result.slice(comma + 1) : '')
        }
        reader.onerror = () => resolve('')
        reader.readAsDataURL(file)
      } catch {
        resolve('')
      }
    })

  /** 拖进来的文件：按类型读文本或只留路径，超限直接说明原因。 */
  const addFiles = async (fileList) => {
    for (const f of fileList) {
      const kind = classifyAttachment({ name: f.name, size: f.size })
      if (kind.kind === 'reject') {
        panel.items.push({ kind: 'interim', text: `附件 ${f.name} 没有加上：${kind.reason}` })
        continue
      }
      const entry = { name: f.name, size: f.size, kind: kind.kind, mime: kind.mime }
      if (kind.kind === 'text') {
        try {
          entry.text = await f.text()
        } catch {
          entry.kind = 'link-only'
        }
      }
      if (kind.kind === 'image') {
        // 图片要带真字节：模型看得见图，才谈得上"看看这个报错"。
        entry.data = await readImageData(f)
        if (!entry.data) panel.items.push({ kind: 'interim', text: `附件 ${f.name} 读取失败，已跳过图片内容` })
      }
      panel.files.push(entry)
    }
    notifyPanel()
  }

  const stop = () => api('ai/stop', { id: connId }).catch(() => {})

  const startDrag = (e) => {
    e.preventDefault()
    panel.dragging = true
    const move = (ev) => {
      panel.width = Math.max(320, Math.min(900, window.innerWidth - ev.clientX))
      notifyPanel()
    }
    const up = () => {
      panel.dragging = false
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  if (!connId) return null

  return h(
    'div',
    { className: 'sx-ai', style: { width: panel.width } },
    h('div', { className: 'sx-ai-grip', onMouseDown: startDrag, title: '拖动调整宽度' }),
    h(
      'div',
      { className: 'sx-dhead' },
      h('button', { className: 'sx-btn sm', title: '历史对话', onClick: () => ((panel.historyOpen = !panel.historyOpen), notifyPanel()) }, '☰'),
      h('span', { className: 'sx-dtitle' }, 'AI 助手'),
      h(ModelPicker),
      h('button', { className: 'sx-btn sm', title: '占满整行', onClick: () => ((panel.width = window.innerWidth - 40), notifyPanel()) }, '⤢'),
      h('button', { className: 'sx-btn sm', title: '收起', onClick: () => ((state.aiOpen = false), notify()) }, '×')
    ),
    p.historyOpen && h(HistoryPane),
    h(
      'div',
      {
        className: 'sx-ai-body',
        onDragOver: (e) => {
          e.preventDefault()
          e.currentTarget.classList.add('drop')
        },
        onDragLeave: (e) => e.currentTarget.classList.remove('drop'),
        onDrop: (e) => {
          e.preventDefault()
          e.currentTarget.classList.remove('drop')
          if (e.dataTransfer?.files?.length) void addFiles([...e.dataTransfer.files])
        },
      },
      p.items.map((it, i) => {
        if (it.kind === 'user') return h('div', { key: i, className: 'sx-ai-user' }, it.text)
        if (it.kind === 'interim') return h('div', { key: i, className: 'sx-ai-interim' }, it.text)
        if (it.kind === 'step') return h(StepCard, { key: it.id ?? i, step: it })
        return h(
          'div',
          { key: i, className: `sx-ai-answer ${it.streaming ? 'streaming' : ''}` },
          it.streaming ? h('div', { className: 'sx-ai-dots' }, '▍') : h(Markdown, { text: it.text })
        )
      }),
      p.error && h('div', { className: 'sx-ai-interim err' }, p.error)
    ),
    h(
      'div',
      { className: 'sx-ai-input' },
      p.files.length > 0 &&
        h(
          'div',
          { className: 'sx-ai-files' },
          p.files.map((f, i) =>
            h(
              'span',
              { key: i, className: 'sx-ai-file' },
              `${f.kind === 'image' ? '🖼' : f.kind === 'text' ? '📄' : '📎'} ${f.name}`,
              h(
                'button',
                {
                  className: 'sx-ai-file-x',
                  title: '移除',
                  onClick: () => {
                    panel.files.splice(i, 1)
                    notifyPanel()
                  },
                },
                '×'
              )
            )
          )
        ),
      h('textarea', {
        className: 'sx-input',
        placeholder: '让 AI 在这台服务器上做事…（Enter 发送，Shift+Enter 换行）',
        value: p.draft,
        rows: 2,
        onInput: (e) => ((panel.draft = e.target.value), notifyPanel()),
        onKeyDown: (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            send()
          }
        },
      }),
      h(
        'div',
        { className: 'sx-ai-actions' },
        p.busy ? h('button', { className: 'sx-btn sm dng', onClick: stop }, '停止') : h('button', { className: 'sx-btn sm pri', onClick: send, disabled: !p.draft.trim() && !p.files.length }, '发送')
      )
    )
  )
}

/** 供外部（入口）读取面板状态。 */
export const aiPanelState = panel
