// Interface driving, driven through a minimal DOM.
//
//   node --test plugins/vyra-dsh-console/test/ui-dom.test.mjs
//
// No browser and no React: what these drive is the DOM path the agent's
// `ui.open` takes when no public service exists — the settings dialog. The
// elements below implement only what that path touches (`querySelector`,
// `querySelectorAll`, `getAttribute`, `closest`, `click`, `dispatchEvent`), so a
// selector this plugin grows without support fails here rather than silently in
// production.
import { strict as assert } from 'node:assert'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const source = readFileSync(join(root, 'client.js'), 'utf8')

// ---------------------------------------------------------------------------
// The minimal DOM.
// ---------------------------------------------------------------------------

/**
 * One element.
 *
 * `attrs` is what `getAttribute` answers and what the selector matcher reads;
 * `on` installs a click handler that the test controls, which is how a trigger
 * is made to open (or fail to open) the dialog.
 */
function el(tag, attrs = {}, children = []) {
  const node = {
    tag,
    attrs: { ...attrs },
    children: [],
    clicks: 0,
    get textContent() {
      // The real DOM concatenates every descendant's text. The account-menu row
      // is matched by its label, so a fixture that only carried its own
      // `data-text` attribute would hide a selector that never matches in the
      // page — which is exactly how the settings row went unfound.
      return (attrs['data-text'] ?? '') + this.children.map((child) => child.textContent).join('')
    },
    parent: undefined,
    click() {
      this.clicks += 1
      this.onClick?.(this)
    },
    addEventListener() {},
    removeEventListener() {},
    getAttribute(name) {
      return Object.hasOwn(this.attrs, name) ? this.attrs[name] : null
    },
    setAttribute(name, value) {
      this.attrs[name] = value
    },
    closest(selector) {
      for (let node_ = this; node_ !== undefined; node_ = node_.parent) {
        if (matches(node_, selector)) return node_
      }
      return null
    },
    matches(selector) {
      return matches(this, selector)
    },
    contains(other) {
      return other === this || descendants(this).includes(other)
    },
    querySelectorAll(selector) {
      return descendants(this).filter((candidate) => matches(candidate, selector))
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] ?? null
    },
  }
  for (const child of children) {
    child.parent = node
    node.children.push(child)
  }
  return node
}

/** Every descendant, depth first. */
function descendants(node) {
  return node.children.flatMap((child) => [child, ...descendants(child)])
}

/** Split a comma list, honour `:not(…)` per alternative, and test one element. */
function matches(node, selector) {
  return splitTopLevel(selector).some((alternative) => one(node, alternative.trim()))
}

/** Split on commas that are not inside brackets or parentheses. */
function splitTopLevel(selector) {
  const parts = []
  let depth = 0
  let current = ''
  for (const char of selector) {
    if (char === '[' || char === '(') depth += 1
    if (char === ']' || char === ')') depth -= 1
    if (char === ',' && depth === 0) {
      parts.push(current)
      current = ''
      continue
    }
    current += char
  }
  parts.push(current)
  return parts
}

/**
 * One compound selector: optional tag, attribute predicates, and `:not(…)`.
 *
 * Supported shapes are exactly the ones `client.js` uses plus the simple tag
 * and descendant forms the fixtures need: `button`, `nav button`,
 * `[attr]`, `[attr="v"]`, `tag[attr="v"]`, and a trailing `:not([attr])`.
 */
function one(node, selector) {
  if (selector === '') return true
  const withoutNot = selector.replace(/:not\((\[[^\]]*\])\)/gu, (_match, inner) => {
    // A `:not` is a veto; record it on the node for this call.
    if (predicate(node, inner)) node.__vetoed = true
    return ''
  })
  const vetoed = node.__vetoed === true
  node.__vetoed = undefined
  if (vetoed) return false

  const parts = withoutNot.trim().split(/\s+/u)
  if (parts.length > 1) {
    // Descendant combinator: the last compound must match, and some ancestor
    // must match the rest.
    const last = parts.at(-1)
    if (!one(node, last)) return false
    const ancestorSelector = parts.slice(0, -1).join(' ')
    for (let parent = node.parent; parent !== undefined; parent = parent.parent) {
      if (one(parent, ancestorSelector)) return true
    }
    return false
  }

  return predicate(node, parts[0])
}

/** Tag, attribute and pseudo predicates of one compound selector. */
function predicate(node, compound) {
  if (compound === '') return true
  let rest = compound
  // `[a-z0-9]`, not `[a-z]`: real tag names carry digits (h1–h6 are the ones
  // this suite cares about), and a matcher that stopped at `h` silently failed
  // to match every heading — which hid a snapshot that omitted them.
  const tag = /^[a-z][a-z0-9]*/u.exec(rest)?.[0]
  if (tag !== undefined) {
    if (node.tag !== tag) return false
    rest = rest.slice(tag.length)
  }
  for (const [, name, value] of rest.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/gu)) {
    if (!Object.hasOwn(node.attrs, name)) return false
    if (value !== undefined && node.attrs[name] !== value) return false
  }
  return true
}

/** A document that behaves like `globalThis.document` for this plugin. */
function makeDocument({ visibility = 'visible' } = {}) {
  const body = el('body')
  const document = {
    visibilityState: visibility,
    documentElement: body,
    body,
    defaultView: {
      KeyboardEvent: class KeyboardEvent {
        constructor(type, init = {}) {
          this.type = type
          this.key = init.key
          this.code = init.code
          this.bubbles = init.bubbles === true
          this.defaultPrevented = false
          this.ctrlKey = init.ctrlKey === true
          this.altKey = init.altKey === true
          this.shiftKey = init.shiftKey === true
          this.metaKey = init.metaKey === true
        }
        preventDefault() {
          this.defaultPrevented = true
        }
      },
    },
    dispatchEvent(event) {
      // The real modal layer listens on the document and closes its top layer.
      if (event.key === 'Escape') document.onEscape?.(event)
      return true
    },
    querySelectorAll(selector) {
      return body.querySelectorAll(selector)
    },
    querySelector(selector) {
      return body.querySelector(selector)
    },
  }
  return document
}

// ---------------------------------------------------------------------------
// The bundle, loaded the way the page loads it.
// ---------------------------------------------------------------------------

const reactStub = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  Component: class {
    constructor(props) { this.props = props || {}; this.state = {} }
    setState(next) { Object.assign(this.state, next) }
  },
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect: () => {},
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn,
  useRef: (initial) => ({ current: initial }),
}

/** Load the bundle once, with a refusable `require` and a document supplied per test. */
function loadBundle() {
  let module
  const win = {
    __ModuleLoader__: {
      load: ({ factory }) => {
        module = factory((specifier) => {
          if (specifier === 'react') return reactStub
          throw new Error(`the single-file bundle must not require(${specifier})`)
        })
      },
    },
  }
  // `document` is read at call time by the ops, so it is installed per test.
  new Function('window', 'document', source)(win, undefined)
  return module
}

const bundle = loadBundle()

/**
 * Run one ui op with a document, a ledger and the given services.
 *
 * @param op - the ui action id.
 * @param args - its arguments.
 * @param options.document - the fake document.
 * @param options.sections - `settings.section` ledger rows.
 * @param options.extra - additional services (`layout`, `sidebarRight`, ...).
 */
async function run(op, args, { document, sections = [], extra = {} } = {}) {
  globalThis.document = document
  const services = {
    slots: {
      entries: (key) => (key === 'settings.section' ? sections.map(toEntry) : []),
    },
    shortcuts: { catalog: { getSnapshot: () => extra.commands ?? [] } },
    ...extra.services,
  }
  const outcome = await bundle.__internal.applyOp(services, op, args)
  return outcome
}

/** One ledger entry, in the shape the renderer records. */
function toEntry(row) {
  return {
    options: { id: row.id, order: row.order ?? 0, label: row.label ?? row.id },
    registrant: row.registrant,
  }
}

/** A settings section ledger with two rows, the second being the point of this file. */
const SECTIONS = [
  { id: 'general', order: 0, label: '常规', registrant: 'ui-settings-general' },
  { id: 'dsh-vyra-free-model', order: 36, label: '免费模型', registrant: 'dsh-vyra-free-model' },
]

/**
 * Build a settings dialog already mounted in the document.
 * @returns the dialog element and its nav buttons, in ledger order.
 */
function mountedDialog(document, { selected = 0 } = {}) {
  const buttons = SECTIONS.map((row, index) => el('button', { 'aria-current': index === selected ? 'true' : 'false' }, []))
  const nav = el('nav', {}, buttons)
  const dialog = el('div', { 'data-shortcut-modal': 'settings' }, [nav])
  buttons.forEach((button) => {
    button.onClick = () => {
      for (const other of buttons) other.setAttribute('aria-current', 'false')
      button.setAttribute('aria-current', 'true')
    }
  })
  document.body.children.push(dialog)
  dialog.parent = document.body
  return { dialog, buttons }
}

test.afterEach(() => {
  delete globalThis.document
})

// ---------------------------------------------------------------------------
// Opening the dialog.
// ---------------------------------------------------------------------------

test('a trigger marked with the settings shortcut opens the dialog, and it is verified', async () => {
  const document = makeDocument()
  const trigger = el('button', { 'aria-keyshortcuts': 'Control+Comma', 'aria-haspopup': 'dialog' })
  document.body.children.push(trigger)
  trigger.parent = document.body
  trigger.onClick = () => {
    const { dialog } = mountedDialog(document)
    // Keep the trigger and the dialog siblings, as the shell renders them.
    dialog.parent = document.body
  }

  const result = await run('ui.open', { target: 'settings' }, {
    document,
    sections: SECTIONS,
    extra: { commands: [{ id: 'settings.open', aria: 'Control+Comma', keys: ['Ctrl', ','], label: '设置' }] },
  })
  assert.equal(result.status, 'ok')
  assert.equal(result.how, 'dom')
  assert.equal(result.verified, true)
  assert.equal(trigger.clicks, 1)
})

test('the settings entry inside the account menu is reached in two hops', async () => {
  // The shipped composition gives `settings.launcher` to ui-settings-account,
  // so the settings entry is a MENU ROW — absent from the document until the
  // account menu opens. A single-hop implementation finds nothing here.
  const document = makeDocument()
  const menuTrigger = el('button', { 'aria-haspopup': 'menu', 'aria-expanded': 'false' })
  document.body.children.push(menuTrigger)
  menuTrigger.parent = document.body
  menuTrigger.onClick = () => {
    const row = el('button', { role: 'menuitem', 'aria-keyshortcuts': 'Control+Comma' })
    const menu = el('div', { role: 'menu' }, [row])
    menu.parent = document.body
    document.body.children.push(menu)
    row.onClick = () => {
      menu.parent = undefined
      mountedDialog(document)
    }
  }

  const result = await run('ui.open', { target: 'settings', section: 'dsh-vyra-free-model' }, {
    document,
    sections: SECTIONS,
    extra: { commands: [{ id: 'settings.open', aria: 'Control+Comma', keys: ['Ctrl', ','], label: '设置' }] },
  })
  assert.equal(result.status, 'ok')
  assert.equal(result.verified, true)
  assert.equal(result.resolved.section.id, 'dsh-vyra-free-model')
  assert.equal(menuTrigger.clicks, 1)
})

test('a click that opens nothing is an error, never a success', async () => {
  const document = makeDocument()
  const trigger = el('button', { 'aria-keyshortcuts': 'Control+Comma' })
  document.body.children.push(trigger)
  trigger.parent = document.body
  // No onClick: the click happens and nothing follows.

  const result = await run('ui.open', { target: 'settings' }, {
    document,
    sections: SECTIONS,
    extra: { commands: [{ id: 'settings.open', aria: 'Control+Comma', keys: ['Ctrl', ','], label: '设置' }] },
  })
  assert.equal(result.status, 'error')
  assert.equal(result.verified, false)
  assert.match(result.reason, /did not open/u)
})

test('another dialog being open refuses the request instead of closing it', async () => {
  const document = makeDocument()
  document.body.children.push(el('div', { 'data-shortcut-modal': 'shortcut-edit' }))

  const result = await run('ui.open', { target: 'settings' }, { document, sections: SECTIONS })
  assert.equal(result.status, 'error')
  assert.match(result.reason, /another dialog/u)
})

test('an unknown section is refused before anything is clicked', async () => {
  const document = makeDocument()
  const trigger = el('button', { 'aria-keyshortcuts': 'Control+Comma' })
  document.body.children.push(trigger)
  trigger.parent = document.body

  const result = await run('ui.open', { target: 'settings', section: 'free-model' }, {
    document,
    sections: SECTIONS,
    extra: { commands: [{ id: 'settings.open', aria: 'Control+Comma', keys: ['Ctrl', ','], label: '设置' }] },
  })
  assert.equal(result.status, 'error')
  assert.equal(trigger.clicks, 0, 'a typo must not open the dialog on the wrong page')
  assert.ok(result.candidates.some((candidate) => candidate.id === 'dsh-vyra-free-model'))
})

// ---------------------------------------------------------------------------
// Selecting a section.
// ---------------------------------------------------------------------------

test('a section is selected by its position in the ledger, not by its label', async () => {
  const document = makeDocument()
  const { buttons } = mountedDialog(document)

  const result = await run('ui.open', { target: 'settings', section: 'dsh-vyra-free-model' }, {
    document,
    sections: SECTIONS,
  })
  assert.equal(result.status, 'ok')
  assert.equal(result.how, 'noop', 'the dialog was already open')
  assert.equal(buttons[1].clicks, 1, 'the second ledger row is the second nav button')
  assert.equal(result.resolved.section.label, '免费模型')
  assert.equal(result.resolved.section.registrant, 'dsh-vyra-free-model')
})

test('a section the dialog does not render is reported rather than assumed selected', async () => {
  const document = makeDocument()
  // A dialog with ONE cell while the ledger claims two: the interface is behind
  // its own registration, which is exactly the case a click-only implementation
  // would report as success.
  const nav = el('nav', {}, [el('button', { 'aria-current': 'true' })])
  const dialog = el('div', { 'data-shortcut-modal': 'settings' }, [nav])
  dialog.parent = document.body
  document.body.children.push(dialog)

  const result = await run('ui.open', { target: 'settings', section: 'dsh-vyra-free-model' }, {
    document,
    sections: SECTIONS,
  })
  assert.equal(result.status, 'error')
  assert.match(result.reason, /not rendering/u)
})

test('re-opening the page it is already on reports noop, not a second click', async () => {
  const document = makeDocument()
  const { buttons } = mountedDialog(document, { selected: 1 })

  const result = await run('ui.open', { target: 'settings', section: 'dsh-vyra-free-model' }, {
    document,
    sections: SECTIONS,
  })
  assert.equal(result.status, 'ok')
  assert.equal(result.how, 'noop')
  assert.equal(buttons[1].clicks, 0, 'an already-selected section is not clicked again')
})

// ---------------------------------------------------------------------------
// Closing.
// ---------------------------------------------------------------------------

test('closing sends Escape and verifies the dialog is gone', async () => {
  const document = makeDocument()
  const { dialog } = mountedDialog(document)
  document.onEscape = () => {
    document.body.children = document.body.children.filter((child) => child !== dialog)
  }

  const result = await run('ui.close', { target: 'settings' }, { document, sections: SECTIONS })
  assert.equal(result.status, 'ok')
  assert.equal(result.verified, true)
})

test('a dialog that does not close is reported, not assumed closed', async () => {
  const document = makeDocument()
  mountedDialog(document)

  const result = await run('ui.close', { target: 'settings' }, { document, sections: SECTIONS })
  assert.equal(result.status, 'error')
  assert.match(result.reason, /did not close/u)
})

test('closing an absent dialog is a noop', async () => {
  const document = makeDocument()
  const result = await run('ui.close', { target: 'settings' }, { document, sections: SECTIONS })
  assert.equal(result.status, 'ok')
  assert.equal(result.how, 'noop')
})

// ---------------------------------------------------------------------------
// Listing and state.
// ---------------------------------------------------------------------------

test('ui.list reports every surface with the plugin that contributed it', async () => {
  const document = makeDocument()
  const result = await run('ui.list', {}, {
    document,
    sections: SECTIONS,
    extra: {
      services: {
        layout: { panelInfo: { getSnapshot: () => ({ activePanelId: 'plugins' }) } },
        sidebarRightTabs: { entries: () => [{ kind: 'browser', id: 'dsh-client-ui-sidebar-browser' }] },
      },
      commands: [{ id: 'settings.open', aria: 'Control+Comma', keys: ['Ctrl', ','], label: '设置', aliases: [] }],
    },
  })
  assert.equal(result.status, 'ok')
  assert.deepEqual(result.settings.sections.map((row) => row.id), ['general', 'dsh-vyra-free-model'])
  assert.equal(result.settings.sections[1].registrant, 'dsh-vyra-free-model')
  assert.equal(result.main.active, 'plugins')
  assert.equal(result.rightbar.tabs[0].kind, 'browser')
  assert.equal(result.commands[0].id, 'settings.open')
  assert.equal(result.modal, null)
})

test('ui.state reports what is open right now', async () => {
  const document = makeDocument()
  const { dialog } = mountedDialog(document, { selected: 1 })
  // The shell's nav label is the section's text; the state maps it back to an id.
  // Appended as a child, because `textContent` is now derived from descendants
  // exactly as it is in the page.
  const secondCell = dialog.children[0].children[1]
  const label = el('span', { 'data-text': '免费模型' })
  label.parent = secondCell
  secondCell.children.push(label)

  const result = await run('ui.state', {}, {
    document,
    sections: SECTIONS,
    extra: { services: { layout: { panelInfo: { getSnapshot: () => ({ activePanelId: null }) } } } },
  })
  assert.equal(result.status, 'ok')
  assert.equal(result.modal, 'settings')
  assert.equal(result.settings.open, true)
  assert.equal(result.settings.section.id, 'dsh-vyra-free-model')
})

// ---------------------------------------------------------------------------
// Main panel and right drawer: the service paths.
// ---------------------------------------------------------------------------

test('a main panel is selected through the layout service', async () => {
  const document = makeDocument()
  const selected = []
  const result = await run('ui.open', { target: 'main', id: 'plugins' }, {
    document,
    extra: {
      services: {
        layout: { selectPanel: (id) => selected.push(id) },
        slots: { entries: (key) => (key === 'sidebar.panellist' ? [{ options: { id: 'plugins', order: 0, label: '插件' } }] : []) },
      },
    },
  })
  assert.equal(result.status, 'ok')
  assert.equal(result.how, 'service')
  assert.deepEqual(selected, ['plugins'])
})

test('an unregistered main panel is refused with candidates and selects nothing', async () => {
  const document = makeDocument()
  const selected = []
  const result = await run('ui.open', { target: 'main', id: 'plugin' }, {
    document,
    extra: {
      services: {
        layout: { selectPanel: (id) => selected.push(id) },
        slots: { entries: (key) => (key === 'sidebar.panellist' ? [{ options: { id: 'plugins', order: 0, label: '插件' } }] : []) },
      },
    },
  })
  assert.equal(result.status, 'error')
  assert.deepEqual(selected, [])
  assert.equal(result.candidates[0].id, 'plugins')
})

test('a right drawer tab with no session is unavailable, with a way forward', async () => {
  const document = makeDocument()
  const result = await run('ui.open', { target: 'rightbar', kind: 'browser' }, {
    document,
    extra: {
      services: {
        sidebarRightTabs: { get: () => ({ id: 'browser' }), entries: () => [{ kind: 'browser', id: 'x' }] },
        sidebarRight: { openTab: () => { throw new Error('sidebarRight: no session surface is mounted') } },
      },
    },
  })
  assert.equal(result.status, 'unavailable')
  assert.match(result.hint, /session/u)
})

test('an unknown right drawer kind is refused with the kinds that exist', async () => {
  const document = makeDocument()
  const result = await run('ui.open', { target: 'rightbar', kind: 'nope' }, {
    document,
    extra: {
      services: {
        sidebarRightTabs: { get: () => undefined, entries: () => [{ kind: 'browser', id: 'b' }] },
        sidebarRight: { openTab: () => { throw new Error('should not be called') } },
      },
    },
  })
  assert.equal(result.status, 'error')
  assert.equal(result.candidates[0].id, 'browser')
})

// ---------------------------------------------------------------------------
// Commands.
// ---------------------------------------------------------------------------

test('a command is invoked through the service when one is provided', async () => {
  const document = makeDocument()
  const invoked = []
  const result = await run('ui.invoke', { id: 'settings.open' }, {
    document,
    extra: {
      services: { shortcuts: {
        catalog: { getSnapshot: () => [{ id: 'settings.open', label: '设置', keys: ['Ctrl', ','], aria: 'Control+Comma' }] },
        invoke: (id) => invoked.push(id),
      } },
    },
  })
  assert.equal(result.status, 'ok')
  assert.equal(result.how, 'service')
  assert.deepEqual(invoked, ['settings.open'])
})

test('with no service the command is reported unavailable and names the keys', async () => {
  // The Windows/macOS desktop installs the native keyboard bridge, whose DOM
  // listener returns before dispatching — so an uninvokable command must SAY so
  // instead of pretending, and tell the user which keys to press.
  const document = makeDocument()
  const result = await run('ui.invoke', { id: 'settings.open' }, {
    document,
    extra: {
      services: { shortcuts: {
        catalog: { getSnapshot: () => [{ id: 'settings.open', label: '设置', keys: ['Ctrl', ','], aria: 'Control+Comma' }] },
      } },
    },
  })
  assert.equal(result.status, 'unavailable')
  assert.match(result.hint, /Ctrl/u)
  assert.equal(result.resolved.command.id, 'settings.open')
})

test('an unknown command is refused with the commands that exist', async () => {
  const document = makeDocument()
  const result = await run('ui.invoke', { id: 'nope' }, {
    document,
    extra: { services: { shortcuts: { catalog: { getSnapshot: () => [{ id: 'settings.open', label: '设置' }] } } } },
  })
  assert.equal(result.status, 'error')
  assert.equal(result.candidates[0].id, 'settings.open')
})

// ---------------------------------------------------------------------------
// The background rule, as it actually is.
//
// An earlier version REFUSED every ui op while the tab was hidden. On a real
// desktop that deadlocked the agent: operating DSH needed its window forward,
// forwarding it needed a shell command, and running the command gave focus back
// to the terminal — so every retry was refused for being in the background. A
// page that is hidden still renders and still dispatches clicks, and opening a
// settings page for the user to switch to is the ordinary use. Visibility is
// therefore REPORTED, never enforced.
// ---------------------------------------------------------------------------

test('a background page still acts, and says it was not visible', async () => {
  const document = makeDocument({ visibility: 'hidden' })
  // A hidden page has no settings dialog to find yet; the window has no focus
  // to give. What matters is that the op RUNS and reports its result.
  document.defaultView.focus = () => {}
  const result = await run('ui.list', {}, { document, sections: SECTIONS })
  assert.equal(result.status, 'ok', 'a hidden page must not be refused')
  assert.equal(result.visible, false, 'and must say the user cannot see it yet')
  assert.equal(result.settings.sections.length, SECTIONS.length)
})

test('a visible page reports visible: true', async () => {
  const document = makeDocument()
  const result = await run('ui.state', {}, { document, sections: SECTIONS })
  assert.equal(result.status, 'ok')
  assert.equal(result.visible, true)
})

test('ui.open in the background still opens, and points the user at the result', async () => {
  const document = makeDocument({ visibility: 'hidden' })
  const trigger = el('button', { 'aria-keyshortcuts': 'Control+Comma', 'aria-haspopup': 'dialog' })
  document.body.children.push(trigger)
  trigger.parent = document.body
  trigger.onClick = () => {
    mountedDialog(document)
  }

  const result = await run('ui.open', { target: 'settings', section: 'dsh-vyra-free-model' }, {
    document,
    sections: SECTIONS,
    extra: { commands: [{ id: 'settings.open', aria: 'Control+Comma', keys: ['Ctrl', ','], label: '设置' }] },
  })
  assert.equal(result.status, 'ok', 'a background page must still open the dialog')
  assert.equal(result.verified, true, 'and the state change is real even if unseen')
  assert.equal(result.visible, false)
  assert.match(result.hint, /switch to it|background/u, 'and must tell the user to look')
})

test('ui.open tries to reveal the window when it is hidden', async () => {
  const document = makeDocument({ visibility: 'hidden' })
  let focused = 0
  document.defaultView.focus = () => {
    focused += 1
    document.visibilityState = 'visible'
  }
  const trigger = el('button', { 'aria-keyshortcuts': 'Control+Comma' })
  document.body.children.push(trigger)
  trigger.parent = document.body
  trigger.onClick = () => mountedDialog(document)

  const result = await run('ui.open', { target: 'settings' }, {
    document,
    sections: SECTIONS,
    extra: { commands: [{ id: 'settings.open', aria: 'Control+Comma', keys: ['Ctrl', ','], label: '设置' }] },
  })
  assert.equal(focused, 1, 'a hidden page must attempt to bring itself forward')
  assert.equal(result.status, 'ok')
  assert.equal(result.visible, true, 'and report whether that worked')
})

// ---------------------------------------------------------------------------
// The dispatch boundary still holds for the new ops.
// ---------------------------------------------------------------------------

test('an unknown ui-shaped op is refused, never dispatched', async () => {
  globalThis.document = makeDocument()
  const result = await bundle.__internal.applyOp({ slots: { entries: () => [] } }, 'ui.nope', {})
  assert.equal(result.status, 'error')
  assert.match(result.reason, /unknown appearance op/u)
})

test('an inherited prototype name is not a ui op', async () => {
  globalThis.document = makeDocument()
  for (const op of ['toString', 'constructor', 'valueOf']) {
    const result = await bundle.__internal.applyOp({ slots: { entries: () => [] } }, op, {})
    assert.equal(result.status, 'error', `${op} must not resolve`)
  }
})

// ---------------------------------------------------------------------------
// Regressions from the first real run on a desktop profile.
//
// Three symptoms were reported, and two were real defects:
//
//   - `ui.list` answered `{"status":"ok"}` with no body;
//   - `ui.open` answered `ok` without `verified`;
//   - the settings dialog "did not open after clicking the available triggers".
//
// The first two were one bug: the browser sent only `outcome.value`, and the ui
// ops put their payload at the top level. The third was another: only the FIRST
// `aria-haspopup="menu"` button was tried, and the account menu is not the first
// menu in the sidebar.
// ---------------------------------------------------------------------------

test('the account menu is found even when other menus come first', async () => {
  // What the sidebar actually looks like: session and workspace menus precede the
  // account menu, and only the last one holds the settings row.
  const document = makeDocument()
  const build = (label, rows) => {
    const trigger = el('button', { 'aria-haspopup': 'menu', 'aria-expanded': 'false' })
    trigger.onClick = () => {
      const items = rows.map((row) => {
        const item = el('button', { role: 'menuitem' }, [el('span', { 'data-text': row.text })])
        item.onClick = row.run
        return item
      })
      const menu = el('div', { role: 'menu' }, items)
      menu.parent = document.body
      document.body.children.push(menu)
    }
    trigger.parent = document.body
    document.body.children.push(trigger)
    return trigger
  }

  build('session', [{ text: '重命名' }])
  build('workspace', [{ text: '新建工作区' }])
  const account = build('account', [
    { text: '查看资料' },
    {
      text: '设置',
      run: () => {
        document.body.children = document.body.children.filter((child) => child.attrs?.role !== 'menu')
        mountedDialog(document)
      },
    },
  ])

  const result = await run('ui.open', { target: 'settings', section: 'dsh-vyra-free-model' }, {
    document,
    sections: SECTIONS,
    extra: { commands: [{ id: 'settings.open', aria: 'Control+Comma', keys: ['Ctrl', ','], label: '设置' }] },
  })
  assert.equal(result.status, 'ok', `expected the dialog to open: ${JSON.stringify(result)}`)
  assert.equal(result.verified, true)
  assert.equal(result.resolved.section.id, 'dsh-vyra-free-model')
})

// ---------------------------------------------------------------------------
// The "more" menu, which is what the sidebar actually shows.
//
// The More button is a `panelRow` with `aria-haspopup="menu"`, and its settings
// row carries NO aria-keyshortcuts: MenuRow only renders that attribute when the
// shell passes a binding down, and this menu does not. A row matcher that
// required the mark found nothing, so every attempt clicked More, opened a menu,
// and gave up — while ALSO leaving that menu open, which then blocked the retry.
// ---------------------------------------------------------------------------

test('the settings row is found by its label when it carries no keycap', async () => {
  const document = makeDocument()
  const more = el('button', { 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-label': '更多' })
  more.parent = document.body
  document.body.children.push(more)
  more.onClick = () => {
    // A menu with several unrelated rows and a settings row that has no
    // aria-keyshortcuts — exactly what MenuRow renders without a binding.
    const rows = ['新建会话', '设置', '意见反馈', '登录'].map((text) => {
      const item = el('button', { role: 'menuitem' }, [el('span', { 'data-text': text })])
      if (text === '设置') {
        item.onClick = () => {
          for (const child of [...document.body.children]) {
            if (child.attrs?.role === 'menu') document.body.children.splice(document.body.children.indexOf(child), 1)
          }
          mountedDialog(document)
        }
      }
      return item
    })
    const menu = el('div', { role: 'menu' }, rows)
    menu.parent = document.body
    document.body.children.push(menu)
  }

  const result = await run('ui.open', { target: 'settings', section: 'dsh-vyra-free-model' }, {
    document,
    sections: SECTIONS,
    // The catalogue HAS the shortcut, but the row does not carry it — the
    // mismatch that broke the real run.
    extra: { commands: [{ id: 'settings.open', aria: 'Control+,', keys: ['Ctrl', '+', ','], label: '打开设置' }] },
  })
  assert.equal(result.status, 'ok', `expected the row to be found by label: ${JSON.stringify(result)}`)
  assert.equal(result.verified, true)
  assert.equal(result.resolved.section.id, 'dsh-vyra-free-model')
  assert.equal(more.clicks, 1, 'the More button is the trigger that was clicked')
})

test('a menu left open does not block the next attempt', async () => {
  // The failure the courtesy check caused: one attempt opened a menu and gave
  // up, and every retry then answered "another dialog or menu is open". A
  // transient popup must never be a lock.
  const document = makeDocument()
  const stray = el('div', { role: 'menu' }, [el('button', { role: 'menuitem' }, [el('span', { 'data-text': '新建会话' })])])
  stray.parent = document.body
  document.body.children.push(stray)
  // The page dismisses menus on Escape, as the real Menu surface does.
  document.onEscape = () => {
    document.body.children = document.body.children.filter((child) => child.attrs?.role !== 'menu')
  }

  const more = el('button', { 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-label': '更多' })
  more.parent = document.body
  document.body.children.push(more)
  more.onClick = () => {
    const row = el('button', { role: 'menuitem' }, [el('span', { 'data-text': '设置' })])
    row.onClick = () => mountedDialog(document)
    const menu = el('div', { role: 'menu' }, [row])
    menu.parent = document.body
    document.body.children.push(menu)
  }

  const result = await run('ui.open', { target: 'settings' }, { document, sections: SECTIONS })
  assert.equal(result.status, 'ok', `a stray menu must be dismissed, not refused: ${JSON.stringify(result)}`)
  assert.equal(result.verified, true)
})

test('a real dialog still blocks, and says so', async () => {
  // The courtesy rule is not gone: a dialog this plugin did not open is still
  // the user's, and closing it would be worse than failing.
  const document = makeDocument()
  const dialog = el('div', { 'data-shortcut-modal': 'shortcut-edit' })
  dialog.parent = document.body
  document.body.children.push(dialog)

  const result = await run('ui.open', { target: 'settings' }, { document, sections: SECTIONS })
  assert.equal(result.status, 'error')
  assert.match(result.reason, /another dialog/u)
})
// ---------------------------------------------------------------------------
// The element layer: snapshot + act.
//
// The problem it solves: driving an unfamiliar interface by coordinates means
// guessing, and a guess that lands 8px off clicks a different control. The
// pattern — and this is taken from lumii's app-ui-control, where the same
// problem was solved for a different shell — is to hand the caller NAMED
// ELEMENTS with a handle, then act on the handle.
// ---------------------------------------------------------------------------

/** An element rich enough for the snapshot walk: box, tag and field state. */
function uiEl(tag, attrs = {}, children = [], box = { left: 10, top: 20, width: 100, height: 30 }) {
  const node = el(tag, attrs, children)
  node.tagName = tag.toUpperCase()
  node.getBoundingClientRect = () => ({
    left: box.left,
    top: box.top,
    width: box.width,
    height: box.height,
    right: box.left + box.width,
    bottom: box.top + box.height,
  })
  node.isConnected = true
  node.dispatchEvent = (event) => {
    for (const fn of node.listeners?.[event.type] ?? []) fn(event)
    return true
  }
  return node
}

test('ui.snapshot names the interactive elements and their state', async () => {
  const document = makeDocument()
  const button = uiEl('button', {}, [el('span', { 'data-text': '保存' })])
  const input = uiEl('input', { type: 'text', placeholder: '搜索' })
  input.value = 'hello'
  const heading = uiEl('h2', {}, [el('span', { 'data-text': '设置' })])
  const hidden = uiEl('button', {}, [el('span', { 'data-text': '隐藏' })])
  hidden.style = { display: 'none' }
  for (const node of [button, input, heading, hidden]) {
    node.parent = document.body
    document.body.children.push(node)
  }

  const result = await run('ui.snapshot', {}, { document })
  assert.equal(result.status, 'ok')
  const byName = Object.fromEntries(result.elements.map((element) => [element.name, element]))

  assert.equal(byName['保存'].role, 'button')
  assert.equal(byName['搜索'].role, 'textbox')
  assert.equal(byName['搜索'].value, 'hello', 'a filled field reports its value')
  assert.equal(byName['搜索'].placeholder, '搜索')
  assert.equal(byName['设置'].role, 'heading', 'headings are named so sections can be told apart')
  assert.equal(byName['隐藏'], undefined, 'a display:none element is not offered')

  for (const element of result.elements) {
    assert.match(element.ref, /^e\d+$/u, 'every element carries a handle')
    assert.equal(typeof element.x, 'number')
    assert.equal(typeof element.y, 'number')
  }
  assert.match(result.snapshotId, /^s_/u)
})

test('ui.act clicks the element the ref names', async () => {
  const document = makeDocument()
  let clicked = 0
  const button = uiEl('button', {}, [el('span', { 'data-text': '打开' })])
  // A click that does nothing is now reported as an error, so the fixture has to
  // do what the real control does: change the page. Adding a row is the smallest
  // observable effect.
  button.onClick = () => {
    clicked += 1
    const row = uiEl('button', {}, [el('span', { 'data-text': '已打开' })])
    row.parent = document.body
    document.body.children.push(row)
  }
  button.parent = document.body
  document.body.children.push(button)

  const snap = await run('ui.snapshot', {}, { document })
  const target = snap.elements.find((element) => element.name === '打开')
  const result = await run('ui.act', { action: 'click', ref: target.ref, snapshotId: snap.snapshotId }, { document })
  assert.equal(result.status, 'ok', JSON.stringify(result))
  assert.equal(result.verified, true)
  assert.equal(clicked, 1)
})

test('a click that changes nothing is reported, not assumed to have worked', async () => {
  // The failure that made every real attempt look successful while the dialog
  // stayed shut: `.click()` returns, `ok` goes out, and nothing happened.
  const document = makeDocument()
  const button = uiEl('button', {}, [el('span', { 'data-text': '无反应' })])
  button.parent = document.body
  document.body.children.push(button)

  const snap = await run('ui.snapshot', {}, { document })
  const target = snap.elements.find((element) => element.name === '无反应')
  const result = await run('ui.act', { action: 'click', ref: target.ref, snapshotId: snap.snapshotId }, { document })
  assert.equal(result.status, 'error')
  assert.equal(result.verified, false)
  assert.match(result.reason, /changed nothing/u)
})

test('a ref from an older snapshot is refused rather than mis-clicked', async () => {
  const document = makeDocument()
  const first = uiEl('button', {}, [el('span', { 'data-text': 'A' })])
  first.parent = document.body
  document.body.children.push(first)
  const snapA = await run('ui.snapshot', {}, { document })

  document.body.children = []
  const second = uiEl('button', {}, [el('span', { 'data-text': 'B' })])
  second.parent = document.body
  document.body.children.push(second)
  const snapB = await run('ui.snapshot', {}, { document })
  assert.notEqual(snapA.snapshotId, snapB.snapshotId, 'a changed page has a new snapshot id')

  const result = await run('ui.act', { action: 'click', ref: 'e1', snapshotId: snapA.snapshotId }, { document })
  assert.equal(result.status, 'error')
  assert.equal(result.code, 'stale_snapshot')
})

test('ui.act types into a field and reports the value', async () => {
  const document = makeDocument()
  const input = uiEl('input', { type: 'text' })
  input.parent = document.body
  document.body.children.push(input)

  // A ref must be used with the snapshot it came from. Reporting a DIFFERENT
  // snapshot id is the case that has to fail: the page may have changed since,
  // and acting on a stale handle is how a click lands on the wrong control.
  const snap = await run('ui.snapshot', {}, { document })
  const stale = await run('ui.act', { action: 'type', ref: 'e1', snapshotId: 's_not-the-current-one', text: 'abc' }, { document })
  assert.equal(stale.status, 'error')
  assert.equal(stale.code, 'stale_snapshot')

  const result = await run('ui.act', { action: 'type', ref: 'e1', snapshotId: snap.snapshotId, text: 'abc' }, { document })
  assert.equal(result.status, 'ok', JSON.stringify(result))
  assert.equal(result.resolved.value, 'abc')
})

test('typing into a button is refused with the reason', async () => {
  const document = makeDocument()
  const button = uiEl('button', {}, [el('span', { 'data-text': '保存' })])
  button.parent = document.body
  document.body.children.push(button)
  const snap = await run('ui.snapshot', {}, { document })

  const result = await run('ui.act', { action: 'type', ref: 'e1', snapshotId: snap.snapshotId, text: 'x' }, { document })
  assert.equal(result.status, 'error')
  assert.equal(result.code, 'not_editable')
})

test('a locked button is listed but not actionable', async () => {
  const document = makeDocument()
  const button = uiEl('button', { disabled: '' })
  button.disabled = true
  button.parent = document.body
  document.body.children.push(button)
  const snap = await run('ui.snapshot', {}, { document })
  const disabled = snap.elements.find((element) => element.disabled === true)
  assert.ok(disabled, 'the element is still listed, marked disabled')

  const result = await run('ui.act', { action: 'click', ref: disabled.ref, snapshotId: snap.snapshotId }, { document })
  assert.equal(result.status, 'error')
  assert.equal(result.code, 'not_interactive')
})

test('ui.list can include the element set in one call', async () => {
  const document = makeDocument()
  const button = uiEl('button', {}, [el('span', { 'data-text': '确定' })])
  button.parent = document.body
  document.body.children.push(button)

  const plain = await run('ui.list', {}, { document, sections: SECTIONS })
  assert.equal(plain.elements, undefined, 'the walk is opt-in: most callers want the ledger only')

  const withElements = await run('ui.list', { elements: true }, { document, sections: SECTIONS })
  assert.ok(Array.isArray(withElements.elements))
  assert.ok(withElements.elements.some((element) => element.name === '确定'))
  assert.match(withElements.snapshotId, /^s_/u)
})

test('a key outside the whitelist is refused', async () => {
  const document = makeDocument()
  const result = await run('ui.act', { action: 'key', key: 'F12' }, { document })
  assert.equal(result.status, 'error')
  assert.match(result.reason, /Enter/u)
})

// ---------------------------------------------------------------------------
// The search must not walk every menu.
//
// The page has many `aria-haspopup="menu"` buttons — panel overflow, transcript
// actions, the session view menu. Trying each in DOM order costs a full
// verification window per miss, and five misses is the channel's whole timeout:
// the caller is told "no interface is connected" while the browser is still
// walking the list, retries, and finds the previous attempt had worked. That is
// the "had to click several times" report.
// ---------------------------------------------------------------------------

test('the account menu is tried before unrelated menus', async () => {
  const document = makeDocument()
  const order = []

  const build = (label, holdsSettings) => {
    const trigger = el('button', { 'aria-haspopup': 'menu', 'aria-label': label })
    trigger.onClick = () => {
      order.push(label)
      const text = holdsSettings ? '设置' : '新建会话'
      const item = el('button', { role: 'menuitem' }, [el('span', { 'data-text': text })])
      if (holdsSettings) item.onClick = () => mountedDialog(document)
      const menu = el('div', { role: 'menu' }, [item])
      menu.parent = document.body
      document.body.children.push(menu)
    }
    trigger.parent = document.body
    document.body.children.push(trigger)
    return trigger
  }

  // Three decoys ahead of it in DOM order, exactly as the real page has.
  build('视图选项', false)
  build('更多操作', false)
  build('更多会话视图', false)
  build('账号菜单', true)

  const result = await run('ui.open', { target: 'settings' }, { document, sections: SECTIONS })
  assert.equal(result.status, 'ok', JSON.stringify(result))
  assert.equal(order[order.length - 1], '账号菜单', 'the menu that holds the row is the one that opened it')
})

// ---------------------------------------------------------------------------
// The dialog must reach the caller even when the page is crowded.
//
// A settings dialog is portalled to document.body, so it sits at the END of
// document order. On the real page 554 elements preceded the first dialog
// control, and a 120-element budget stopped long before it — the caller got a
// list of background chrome, all marked occluded, and no way to reach the thing
// it had just opened.
// ---------------------------------------------------------------------------

test('elements inside a dialog sort ahead of the background', async () => {
  const document = makeDocument()
  // A crowded background, the way a transcript makes one.
  for (let index = 0; index < 200; index += 1) {
    const filler = uiEl('button', {}, [el('span', { 'data-text': `背景 ${index}` })])
    filler.parent = document.body
    document.body.children.push(filler)
  }
  // The dialog, portalled last.
  const card = uiEl('button', {}, [el('span', { 'data-text': '模型' })])
  card.parent = document.body
  document.body.children.push(card)
  const dialog = el('div', { 'data-shortcut-modal': 'settings' }, [card])
  dialog.parent = document.body
  card.parent = dialog
  document.body.children.push(dialog)

  const result = await run('ui.snapshot', { limit: 10 }, { document })
  assert.equal(result.status, 'ok')
  assert.equal(result.elements[0].name, '模型', 'the dialog control comes first, not after 200 background buttons')
  assert.equal(result.elements[0].inDialog, true)
  assert.equal(result.truncated, true)
  assert.ok(result.total > 10, 'the caller is told how much it did not get')
})

test('a truncated snapshot says how to ask for the rest', async () => {
  const document = makeDocument()
  for (let index = 0; index < 30; index += 1) {
    const node = uiEl('button', {}, [el('span', { 'data-text': `B${index}` })])
    node.parent = document.body
    document.body.children.push(node)
  }

  const first = await run('ui.snapshot', { limit: 10 }, { document })
  assert.equal(first.truncated, true)
  assert.deepEqual(first.next, { offset: 10 }, 'the next call is stated, not inferred')

  const second = await run('ui.snapshot', { limit: 10, offset: first.next.offset }, { document })
  assert.equal(second.elements[0].name, 'B10', 'the window continues where the first ended')
  assert.equal(second.offset, 10)
  // Refs stay tied to the position in the whole list, so an element is addressable
  // from whichever window it arrives in.
  assert.equal(second.elements[0].ref, 'e11')
})

test('a covered element sorts behind a reachable one', async () => {
  const document = makeDocument()
  // The fake document has no elementFromPoint, so `occluded` cannot fire here;
  // what this pins is that the tier function does not throw and that a plain
  // list keeps its order when nothing is covered.
  const a = uiEl('button', {}, [el('span', { 'data-text': 'A' })])
  const b = uiEl('button', {}, [el('span', { 'data-text': 'B' })])
  for (const node of [a, b]) {
    node.parent = document.body
    document.body.children.push(node)
  }
  const result = await run('ui.snapshot', {}, { document })
  assert.deepEqual(result.elements.map((element) => element.name), ['A', 'B'])
})
