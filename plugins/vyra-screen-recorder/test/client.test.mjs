import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const code = readFileSync(path.join(here, '..', 'client.js'), 'utf8')

function fakeElement() {
  return {
    id: '',
    style: {},
    textContent: '',
    className: '',
    setAttribute() {},
    appendChild() {},
    addEventListener() {},
    removeEventListener() {},
  }
}

test('client.js 注册录屏/截图工具条和浮层', () => {
  let factory = null
  const sandbox = {
    console,
    TextEncoder,
    TextDecoder,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    fetch: async () => ({ ok: true, text: async () => '{"ok":true,"recording":false}' }),
    navigator: { language: 'zh-CN' },
    localStorage: { getItem: () => null, setItem() {} },
    window: {
      __ModuleLoader__: { load: (value) => { factory = value.factory } },
      addEventListener() {},
      removeEventListener() {},
      innerWidth: 1280,
      innerHeight: 800,
    },
    document: {
      getElementById: () => null,
      createElement: () => fakeElement(),
      head: { appendChild() {} },
      body: { style: {}, appendChild() {} },
      querySelector: () => null,
      querySelectorAll: () => [],
    },
  }
  vm.createContext(sandbox)
  vm.runInContext(code, sandbox)
  assert.equal(typeof factory, 'function')

  const React = {
    Fragment: 'Fragment',
    createElement: () => null,
    useEffect() {},
    useMemo: (fn) => fn(),
    useRef: (value) => ({ current: value }),
    useState: (value) => [value, () => {}],
  }
  const ReactDOM = { createPortal: () => null }
  const module = factory((name) => {
    if (name === 'react') return React
    if (name === 'react-dom') return ReactDOM
    throw new Error('unknown module ' + name)
  })

  assert.equal(module.inject.length, 1)
  assert.equal(module.inject[0], 'slots')
  assert.equal(typeof module.apply, 'function')

  const registered = []
  const disposers = []
  const ctx = {
    effect: (fn) => {
      const dispose = fn()
      if (typeof dispose === 'function') disposers.push(dispose)
    },
    slots: {
      inject: (_name, callback) => callback(),
      register: (options) => { registered.push(options); return () => {} },
    },
  }
  module.apply(ctx)
  assert.deepEqual(registered.map(item => item.name), [
    'conversation.input.left',
    'shell.overlay',
    'settings.section',
    'settings.section.icon',
    'plugins.bundle.config',
  ])
  assert.equal(registered[0].id, 'vyra-screen-recorder.tools')
  assert.equal(registered[1].id, 'vyra-screen-recorder.overlay')
  assert.equal(registered[2].id, 'vyra-screen-recorder')
  assert.equal(registered[4].key, 'vyra-screen-recorder')
  assert.equal(typeof module.__test.attachFile, 'function')
  for (const dispose of disposers) {
    try { dispose() } catch { /* ignore */ }
  }
})
