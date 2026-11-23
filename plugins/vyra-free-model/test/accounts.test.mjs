import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const clientPath = join(here, '..', 'client.js')

/** The same stub React the boot test uses: elements in, markup out. */
function makeReact() {
  const createElement = (type, props, ...children) => ({ type, props: props ?? {}, children: flatten(children) })
  return {
    createElement,
    Fragment: Symbol('Fragment'),
    useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
    useEffect: () => {},
    useMemo: fn => fn(),
    useRef: value => ({ current: value }),
    useCallback: fn => fn,
    useSyncExternalStore: () => undefined,
  }
}

function flatten(children) {
  const out = []
  for (const child of children) {
    if (Array.isArray(child)) out.push(...flatten(child))
    else if (child !== null && child !== undefined && child !== false && child !== true) out.push(child)
  }
  return out
}

function renderToString(node) {
  if (node === null || node === undefined || node === false || node === true) return ''
  if (typeof node === 'string' || typeof node === 'number') return escape(String(node))
  if (Array.isArray(node)) return node.map(renderToString).join('')
  if (typeof node.type === 'function') return renderToString(node.type({ ...node.props, children: node.children }))
  if (typeof node.type === 'symbol') return node.children.map(renderToString).join('')
  const attrs = Object.entries(node.props ?? {})
    .filter(([key, value]) => key !== 'children' && typeof value !== 'function' && value !== undefined && value !== null && value !== false)
    .map(([key, value]) => (value === true ? ` ${key}` : ` ${key}="${escape(String(value))}"`))
    .join('')
  return `<${node.type}${attrs}>${node.children.map(renderToString).join('')}</${node.type}>`
}

function escape(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function loadBundle() {
  const source = readFileSync(clientPath, 'utf8')
  let registeredModule
  const window = {
    __ModuleLoader__: {
      load(definition) {
        registeredModule = definition.factory(name => {
          if (name === 'react') return makeReact()
          if (name === 'react-dom') return { createPortal: node => node }
          throw new Error(`unexpected require(${name})`)
        })
      },
    },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    document: { documentElement: { lang: 'zh-CN' }, baseURI: 'http://127.0.0.1/' },
    location: { origin: 'http://127.0.0.1' },
    setTimeout, clearTimeout,
    fetch: () => Promise.reject(new Error('no network in tests')),
  }
  const context = { window, document: window.document, localStorage: window.localStorage,
    location: window.location, setTimeout, clearTimeout, fetch: window.fetch, console, URL, TextDecoder, structuredClone }
  context.globalThis = context
  vm.createContext(context)
  vm.runInContext(source, context, { filename: 'client.js' })
  assert.ok(registeredModule !== undefined)
  return registeredModule
}

const bundle = loadBundle()
const { h, AccountsBlock, PROVIDERS, providerRow, LoginModal, EndpointsBlock, ModelBlock, probeLabel } = bundle.__test

// The bundle runs in its own vm realm, so its arrays are not this realm's
// Array: spread them before comparing structure.
test('the reachable providers are shown, in the spec order', () => {
  assert.deepEqual([...PROVIDERS].map(entry => entry.id),
    ['qodercn', 'qoder', 'trae', 'zcode', 'minimax', 'lobsterai', 'loomy', 'cline', 'raccoon'])
})

test('the more bucket holds only raccoon', () => {
  assert.deepEqual([...PROVIDERS].filter(entry => entry.more === true).map(entry => entry.id), ['raccoon'])
})

test('the unreachable channel never appears', () => {
  for (const id of ['gemini']) {
    assert.equal(PROVIDERS.some(entry => entry.id === id), false, `${id} must not be offered`)
  }
})

test('every provider carries a display label and nothing internal', () => {
  for (const entry of PROVIDERS) {
    assert.equal(typeof entry.label, 'string')
    assert.ok(entry.label.length > 0)
    assert.equal(entry.label.includes('oauth'), false)
    assert.equal(entry.label.includes('OAuth'), false)
  }
})

test('a logged-out card offers a login button', () => {
  const out = renderToString(h(AccountsBlock, {
    providers: PROVIDERS, status: {}, onLogin: () => {}, onClaim: () => {},
  }))
  assert.ok(out.includes('登录'))
  assert.ok(out.includes('Qoder'))
  assert.ok(out.includes('TRAE'))
})

test('a logged-in card shows its name and offers a re-claim', () => {
  const providers = PROVIDERS.map(entry => entry.id === 'qodercn'
    ? { ...entry, claimable: true, accounts: [{ id: 'a1', nickname: '小明', enabled: true, expiresAt: 0 }] }
    : entry)
  const out = renderToString(h(AccountsBlock, {
    providers,
    status: {},
    onLogin: () => {}, onClaim: () => {},
  }))
  assert.ok(out.includes('小明'))
  assert.ok(out.includes('重新领取'))
})

test('a pending card says it is waiting instead of lying about success', () => {
  const out = renderToString(h(AccountsBlock, {
    providers: PROVIDERS,
    status: { trae: { state: 'pending' } },
    onLogin: () => {}, onClaim: () => {},
  }))
  assert.ok(out.includes('登录中'))
})

test('an expired login is shown as expired, not as logged in', () => {
  const providers = PROVIDERS.map(entry => entry.id === 'zcode'
    ? { ...entry, accounts: [{ id: 'z1', nickname: '老账号', enabled: true, expiresAt: 1 }] }
    : entry)
  const out = renderToString(h(AccountsBlock, {
    providers,
    status: {},
    onLogin: () => {}, onClaim: () => {},
  }))
  assert.ok(out.includes('已过期'))
})

test('an owned-elsewhere account area explains where to go', () => {
  const out = renderToString(h(AccountsBlock, {
    providers: PROVIDERS, status: {}, ownedElsewhere: true, onLogin: () => {}, onClaim: () => {},
  }))
  assert.ok(out.includes('Our Free Model'))
})

test('a failed automatic claim is surfaced with a retry', () => {
  const out = renderToString(h(AccountsBlock, {
    providers: PROVIDERS, status: {}, claimFailedAt: 1700000000000, onLogin: () => {}, onClaim: () => {},
  }))
  assert.ok(out.includes('上次自动领取没成功'))
  assert.ok(out.includes('重试'))
})

test('the provider rows default the more bucket to hidden', () => {
  const out = renderToString(h(AccountsBlock, { providers: PROVIDERS, status: {}, onLogin: () => {}, onClaim: () => {} }))
  assert.equal(out.includes('商汤'), false)
  assert.ok(out.includes('更多'))
})

test('one provider row renders its own state without the others', () => {
  const html = renderToString(providerRow(PROVIDERS[0], { accounts: [{ id: 'a1', nickname: 'A' }] }, {}))
  assert.ok(html.includes('Qoder'))
  assert.ok(html.includes('A'))
  assert.equal(html.includes('TRAE'), false)
})

// ── the new lanes ───────────────────────────────────────────────────────────

test('the sign-in dialog shows the URL with copy and open', () => {
  const html = renderToString(h(LoginModal, {
    dialog: { label: 'TRAE', url: 'https://example.com/auth' },
    onOpen: () => {}, onCopy: () => {}, onClose: () => {},
  }))
  assert.ok(html.includes('https://example.com/auth'))
  assert.ok(html.includes('打开授权页'))
  assert.ok(html.includes('复制链接'))
  assert.ok(html.includes('vfm_modalbackdrop'))
})

test('a failed sign-in shows its reason instead of a silent button', () => {
  const html = renderToString(providerRow(
    { id: 'trae', label: 'TRAE' },
    { message: '网络错误' },
    { onLogin: () => {} },
  ))
  assert.ok(html.includes('登录失败'))
  assert.ok(html.includes('网络错误'))
})

test('the Tencent products are listed beside the channel accounts', () => {
  const providers = [
    { id: 'trae', label: 'TRAE', claimable: true, accounts: [] },
    { id: 'buddy', label: 'CodeBuddy（腾讯）', kind: 'buddy', claimable: true, accounts: [{ id: 'b1', nickname: '腾讯号' }] },
    { id: 'workbuddy', label: 'WorkBuddy（国际版）', kind: 'buddy', claimable: true, accounts: [] },
  ]
  const html = renderToString(h(AccountsBlock, { providers, status: {}, defaultOpen: true }))
  assert.ok(html.includes('CodeBuddy（腾讯）'))
  assert.ok(html.includes('WorkBuddy（国际版）'))
  assert.ok(html.includes('腾讯号'))
})

test('a saved endpoint shows its address and key state, never the key', () => {
  const html = renderToString(h(EndpointsBlock, {
    endpoints: [{ id: 'e1', name: '豆包', baseUrl: 'https://ark.example/v3', hasKey: true, models: [{ id: 'x' }] }],
    defaultOpen: true,
  }))
  assert.ok(html.includes('https://ark.example/v3'))
  assert.ok(html.includes('已保存 Key'))
  assert.ok(html.includes('1 个模型'))
})

test('probe states read as words, not colours alone', () => {
  assert.equal(probeLabel({ state: 'ok' }), '可用')
  assert.equal(probeLabel({ state: 'limited' }), '限流')
  assert.equal(probeLabel({ state: 'unavailable' }), '不可用')
  assert.equal(probeLabel(null), '未检测')
})

test('the model list states where the models come from', () => {
  const html = renderToString(h(ModelBlock, { models: [{ id: 'a/free', name: 'A', contextWindow: 1000, vision: false }] }))
  assert.ok(html.includes('kilo.ai'))
  assert.ok(html.includes('对话框顶部的选择器'))
})
