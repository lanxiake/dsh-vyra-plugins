/**
 * Render the settings page to a standalone HTML file so it can be looked at.
 *
 * The stub React walks the element tree the same way the tests do, so what this
 * prints is what the component function actually produces — not a mock-up.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
const expanded = process.env.PREVIEW_EXPANDED === '1'

const flatten = children => {
  const out = []
  for (const child of children) {
    if (Array.isArray(child)) out.push(...flatten(child))
    else if (child !== null && child !== undefined && child !== false && child !== true) out.push(child)
  }
  return out
}

const makeReact = () => ({
  createElement: (type, props, ...children) => ({ type, props: props ?? {}, children: flatten(children) }),
  Fragment: Symbol('Fragment'),
  useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect: () => {},
  useMemo: fn => fn(),
  useRef: value => ({ current: value }),
  useCallback: fn => fn,
  useSyncExternalStore: () => undefined,
})

const escapeHtml = text => String(text)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function render(node) {
  if (node === null || node === undefined || node === false || node === true) return ''
  if (typeof node === 'string' || typeof node === 'number') return escapeHtml(node)
  if (Array.isArray(node)) return node.map(render).join('')
  if (typeof node.type === 'function') return render(node.type({ ...node.props, children: node.children }))
  if (typeof node.type === 'symbol') return node.children.map(render).join('')
  const attrs = Object.entries(node.props ?? {})
    .filter(([key, value]) => key !== 'children' && typeof value !== 'function'
      && value !== undefined && value !== null && value !== false)
    // React maps className to class; this renderer has to do it explicitly, or
    // the preview shows attributes no browser applies.
    .map(([key, value]) => (key === 'className' ? ['class', value] : [key, value]))
    .map(([key, value]) => (value === true ? ` ${key}` : ` ${key}="${escapeHtml(value)}"`))
    .join('')
  return `<${node.type}${attrs}>${node.children.map(render).join('')}</${node.type}>`
}

let registered
const window = {
  __ModuleLoader__: {
    load(definition) {
      registered = definition.factory(name => {
        if (name === 'react') return makeReact()
        if (name === 'react-dom') return { createPortal: node => node }
        throw new Error(`unexpected require(${name})`)
      })
    },
  },
  localStorage: { getItem: () => null, setItem: () => {} },
  document: {
    documentElement: { lang: 'zh-CN' }, baseURI: 'http://127.0.0.1/',
    head: { appendChild() {} },
    createElement: tag => ({ tagName: tag, setAttribute() {}, remove() {} }),
  },
  location: { origin: 'http://127.0.0.1' },
  setTimeout, clearTimeout,
  fetch: () => Promise.reject(new Error('offline')),
}
const context = { window, document: window.document, localStorage: window.localStorage,
  location: window.location, setTimeout, clearTimeout, fetch: window.fetch, console, URL, TextDecoder, structuredClone }
context.globalThis = context
vm.createContext(context)
vm.runInContext(source, context, { filename: 'client.js' })

const { h, ModelBlock, AccountsBlock, ForwardBlock, EndpointsBlock, LoginModal, Card, BlockTitle, ToolCard, WorkbenchCard, CommunityLinks, CSS } = registered.__test

const models = [
  { id: 'kilo-auto/free', name: '自动选择（推荐）', contextWindow: 256000, vision: false, probe: null },
  { id: 'particle-ai/particle-1:free', name: 'particle-1', contextWindow: 256000, vision: true, probe: { state: 'ok' } },
  { id: 'nvidia/nemotron-3.5-super-vl:free', name: 'nemotron-3.5-super-vl', contextWindow: 1000000, vision: true, probe: { state: 'ok' } },
  { id: 'baidu/ernie-5.5-flash-preview:free', name: 'ernie-5.5-flash-preview', contextWindow: 1024000, vision: false, probe: { state: 'limited', reason: '上游限流' } },
  { id: 'liquid/lfm-3-1.7b:free', name: 'lfm-3-1.7b', contextWindow: 262144, vision: false, probe: { state: 'unavailable', reason: 'Model is unavailable' } },
]

const body = process.env.PREVIEW_MODAL === '1' ? render(h(LoginModal, { dialog: { label: 'TRAE', url: 'https://example.com/oauth/authorize?state=abc123&client=trae' }, onOpen: () => {}, onCopy: () => {}, onClose: () => {} })) : render(h('div', { className: 'vfm_page' },
  h('header', { className: 'vfm_head' },
    h('div', { className: 'vfm_headtext' },
      h('h2', { className: 'vfm_title' }, '免费模型'),
      h('p', { className: 'vfm_sub' }, '装上就能用。选个模型，需要更多额度时登录一次国内账号。')),
    h('div', { className: 'vfm_headacts' },
      h(CommunityLinks),
      h('button', { type: 'button', className: 'vfm_btn', 'data-kind': 'quiet' }, '先关掉'))),
  h(ModelBlock, {
    models, extraModels: [{ id: 'buddy:buddy/hy4flash', name: 'CodeBuddy（腾讯） · Hy4 flash', contextWindow: 1000000, vision: true, source: 'buddy' }],
    auto: { id: 'baidu/ernie-5.5-flash-preview:free', name: 'Baidu: ERNIE-5.5-Flash-Preview (free)', contextWindow: 1024000, vision: false },
    selected: '', onSelect: () => {}, laneOk: true, onRecheck: () => {}, busy: false,
    autoSwitch: true, onToggleAutoSwitch: () => {},
    collapsed: true, defaultOpen: expanded,
  }),
  h(AccountsBlock, {
    providers: [
      { id: 'qodercn', label: 'Qoder 中国版', claimable: true, accounts: [{ id: 'a1', nickname: '小明', expiresAt: 0 }] },
      { id: 'qoder', label: 'Qoder 国际版', claimable: true, accounts: [] },
      { id: 'trae', label: 'TRAE', claimable: true, accounts: [] },
      { id: 'zcode', label: 'ZCode', claimable: true, accounts: [] },
      { id: 'minimax', label: 'MiniMax', claimable: true, accounts: [] },
      { id: 'lobsterai', label: '有道 LobsterAI', claimable: true, accounts: [] },
      { id: 'loomy', label: '讯飞 Loomy', claimable: true, accounts: [] },
      { id: 'cline', label: 'Cline', claimable: false, accounts: [] },
      { id: 'buddy', label: 'CodeBuddy（腾讯）', kind: 'buddy', claimable: true, accounts: [{ id: 'b1', nickname: '腾讯号', expiresAt: 0 }] },
      { id: 'workbuddy', label: 'WorkBuddy（国际版）', kind: 'buddy', claimable: true, accounts: [] },
    ],
    status: {},
    credits: { qodercn: { accounts: [{ id: 'a1', credits: 128, unit: '积分' }] }, buddy: { accounts: [{ id: 'b1', credits: 320, unit: '积分' }] } },
    onLogin: () => {}, onClaim: () => {},
    collapsed: true, defaultOpen: expanded,
  }),
  h(EndpointsBlock, {
    endpoints: [{ id: 'e1', name: '豆包（火山方舟）', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', hasKey: true, models: [{ id: 'doubao-x' }], modelsAt: 0 }],
    onSummary: () => {}, collapsed: true, defaultOpen: expanded,
  }),
  h(WorkbenchCard)
))

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>dsh-vyra-free-model settings preview</title>
<style>
  :root{
    --dsw-alias-bg-base:#0f1115; --dsw-alias-bg-layer-1:#171a21; --dsw-alias-bg-layer-2:#1e222b;
    --dsw-alias-bg-overlay:#242934; --dsw-alias-border-l1:#2a2f3a; --dsw-alias-border-l2:#3a4150;
    --dsw-alias-brand-primary:#4c8dff; --dsw-alias-label-primary:#e8ecf3; --dsw-alias-label-secondary:#9aa4b5;
    --dsw-alias-state-error-primary:#ef5b5b; --dsw-alias-state-idle-primary:#5b6575;
    --dsw-alias-state-success-primary:#3ecfa0; --dsw-alias-state-warn-primary:#f5c542;
  }
  /* The section fills its container, so the fixture must not impose a width of
     its own or the measurements describe the fixture instead of the page. */
  body{margin:0;padding:28px 24px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);
    font-family:system-ui,-apple-system,"Segoe UI","Noto Sans SC",sans-serif}
  ${CSS}
</style></head>
<body>${body}</body></html>`

const output = process.env.PREVIEW_MODAL === '1' ? '../.preview-modal.html' : (expanded ? '../.preview-expanded.html' : '../.preview.html')
writeFileSync(new URL(output, import.meta.url), html)
console.log(`wrote ${output}, ${html.length} bytes`)