/**
 * Load the browser bundle outside DSH with the real React/ReactDOM and a
 * minimal window/document/context stub, then check the registration contract.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import React from 'react'
import ReactDOM from 'react-dom'
import { renderToString } from 'react-dom/server'
import { FileTree, buildTree, findTreeNode } from './src/client/tree.js'
import { CodeView, CsvView, HtmlView, MarkdownView } from './src/client/preview.js'

const noop = () => {}
const styleElements = []
globalThis.document = {
  baseURI: 'http://127.0.0.1:3000/',
  createElement: tag => {
    const element = { tag, dataset: {}, textContent: '', remove: noop }
    styleElements.push(element)
    return element
  },
  head: { appendChild: noop },
}

let loaded
globalThis.window = {
  __ModuleLoader__: {
    load(spec) {
      loaded = spec.factory(name => {
        if (name === 'react') return React
        if (name === 'react-dom') return ReactDOM
        if (name === 'react-dom/client') return ReactDOM
        throw new Error(`unexpected require ${name}`)
      })
    },
  },
}

await import('./client.js')

test('client bundle loads and registers the library plus media tabs', () => {
  assert.equal(loaded.name, 'dsh-vyra-file-manager')
  assert.deepEqual(loaded.inject, ['slots', 'sidebarRightTabs', 'sidebarRight'])

  const types = []
  const bodies = []
  const opened = []
  const ctx = {
    effect(callback) {
      const dispose = callback()
      if (typeof dispose === 'function') dispose()
    },
    sidebarRightTabs: {
      register(definition) { types.push(definition); return noop },
    },
    slots: {
      inject(_name, callback) { return callback() },
      register(spec, component) { bodies.push({ spec, component }); return noop },
    },
    sidebarRight: {
      openTab(kind, options) { opened.push({ kind, options }) },
    },
  }

  loaded.apply(ctx)

  assert.equal(styleElements.length, 1)
  assert.match(styleElements[0].textContent, /\.vms-root/u)
  assert.match(styleElements[0].textContent, /\.yarl__container/u)
  assert.equal(types.length, 3)
  const library = types.find(definition => definition.kind === 'media')
  const video = types.find(definition => definition.kind === 'video')
  const audio = types.find(definition => definition.kind === 'audio')
  assert.ok(library)
  assert.ok(video)
  assert.ok(audio)
  assert.equal(library.title(), '文件管理')
  assert.equal(library.guide.length, 1)
  assert.equal(library.guide[0].title(), '文件管理')
  assert.ok(video.patterns.includes('*.mp4'))
  assert.ok(video.patterns.includes('*.webm'))
  assert.ok(audio.patterns.includes('*.mp3'))
  assert.ok(audio.patterns.includes('*.wav'))
  assert.equal(video.keepMounted, true)

  const sessionAddress = 'dsh-resource://file/session/s-1/%E4%BD%9C%E5%93%81/a.mp4'
  assert.equal(video.canOpen(sessionAddress), true)
  assert.equal(video.canOpen('dsh-resource://file/absolute/C:/a.mp4'), false)
  assert.equal(video.title(sessionAddress), 'a.mp4')

  assert.deepEqual(bodies.map(body => body.spec.key ?? body.spec.id).sort(), [
    'dsh-vyra-file-manager.composer-bridge',
    'dsh-vyra-file-manager/audio',
    'dsh-vyra-file-manager/library',
    'dsh-vyra-file-manager/video',
  ])
  assert.ok(bodies.every(body => typeof body.component === 'function'))
  assert.equal(opened.length, 0)
})

test('library and media tab render without undeclared references', () => {
  const bodies = []
  const ctx = {
    effect(callback) { const dispose = callback(); if (typeof dispose === 'function') dispose() },
    sidebarRightTabs: { register() { return noop } },
    slots: { inject(_name, callback) { return callback() }, register(spec, component) { bodies.push({ spec, component }); return noop } },
    sidebarRight: { openTab() {} },
  }
  loaded.apply(ctx)
  const library = bodies.find(body => body.spec.key === 'dsh-vyra-file-manager/library').component
  const media = bodies.find(body => body.spec.key === 'dsh-vyra-file-manager/video').component
  const useTabInfo = () => ({
    tab: {
      kind: 'media',
      visible: true,
      contentId: 'dsh-resource://file/session/s-1/clip.mp4',
      actions: { openResource() {} },
    },
  })
  const html = renderToString(React.createElement(library, { sessionId: 's-1', useTabInfo, openBrowser() {} }))
  assert.match(html, /文件管理/u)
  const mediaHtml = renderToString(React.createElement(media, { sessionId: 's-1', useTabInfo, openLibrary() {} }))
  assert.match(mediaHtml, /clip.mp4/u)
})

test('tree and highlighted code render', () => {
  const items = [
    { id: 'docs/a.md', kind: 'document', title: 'a.md', name: 'a.md', fileName: 'a.md', folder: 'docs', relativePath: 'docs/a.md', source: 'local', ext: 'md', size: 10, mtimeMs: 1 },
    { id: 'root.txt', kind: 'document', title: 'root.txt', name: 'root.txt', fileName: 'root.txt', folder: '', relativePath: 'root.txt', source: 'local', ext: 'txt', size: 5, mtimeMs: 1 },
  ]
  const tree = renderToString(React.createElement(FileTree, {
    items,
    folders: ['docs', 'empty'],
    scope: '',
    expanded: new Set(['docs']),
    forceExpanded: new Set(),
    detail: 'detailed',
    meta: { 'docs/a.md': { size: 10, mtimeMs: 1 } },
    sessionId: 's-1',
    selected: new Set(['docs/a.md']),
    showEmptyFolders: true,
    onToggleFolder: noop,
    onOpen: noop,
    onToggleSelect: noop,
    onMenu: noop,
  }))
  assert.match(tree, /docs/u)
  assert.match(tree, /a.md/u)
  assert.match(tree, /empty/u)
  assert.match(tree, /data-selected/u)
  const code = renderToString(React.createElement(CodeView, { text: 'const a = 1', ext: 'js' }))
  assert.match(code, /hljs-keyword/u)
  assert.match(code, /const/u)
})

test('markdown, csv and sandboxed html previews render', () => {
  const markdown = renderToString(React.createElement(MarkdownView, {
    text: '# Hi\n\n**bold**\n\n\`\`\`js\nconst a = 1\n\`\`\`',
    sessionId: 's-1',
    folder: 'docs',
    ext: 'md',
  }))
  assert.match(markdown, /<h1>Hi<\/h1>/u)
  assert.match(markdown, /<strong>bold<\/strong>/u)
  assert.match(markdown, /hljs-keyword/u)
  const csv = renderToString(React.createElement(CsvView, { text: 'name,size\na,1', ext: 'csv' }))
  assert.match(csv, /<table/u)
  assert.match(csv, /name<\/th>/u)
  const html = renderToString(React.createElement(HtmlView, {
    text: '<h1>Hello</h1><script>alert(1)</script>',
    sessionId: 's-1',
    folder: 'docs',
  }))
  assert.match(html, /sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads"/u)
  assert.doesNotMatch(html, /allow-same-origin/u)
  assert.match(html, /Content-Security-Policy/u)
  assert.match(html, /沙箱/u)
})

test('tree model keeps empty folders and counts matching files', () => {
  const items = [
    { id: 'docs/a.md', title: 'a.md', folder: 'docs', relativePath: 'docs/a.md' },
    { id: 'docs/sub/b.txt', title: 'b.txt', folder: 'docs/sub', relativePath: 'docs/sub/b.txt' },
  ]
  const root = buildTree(items, ['docs', 'docs/sub', 'empty'], true)
  assert.equal(root.count, 2)
  assert.ok(root.folders.has('empty'))
  assert.equal(findTreeNode(root, 'docs/sub').count, 1)
  const pruned = buildTree(items, ['docs', 'docs/sub', 'empty'], false)
  assert.equal(pruned.folders.has('empty'), false)
})

test('type chips replace link with html and html has an icon', async () => {
  const { TYPE_CHIPS, TYPE_LABEL, HTML_EXT } = await import('./src/client/helpers.js')
  const { kindIcon } = await import('./src/client/icons.js')
  assert.ok(TYPE_CHIPS.includes('html'))
  assert.ok(!TYPE_CHIPS.includes('link'))
  assert.equal(TYPE_LABEL.html, 'HTML')
  assert.equal(TYPE_LABEL.link, undefined)
  assert.ok(HTML_EXT.has('html') && HTML_EXT.has('htm'))
  // kindIcon falls back to the raw kind, which must resolve to a real icon.
  assert.equal(kindIcon('html', 'html'), 'html')
})

test('copying files uses the clipboard route, not the link menu', async () => {
  const source = await readFile(new URL('./src/client/library.js', import.meta.url), 'utf8')
  assert.match(source, /'copyFiles'/u)
  assert.match(source, /api\/vyra-media\/clipboard/u)
  assert.doesNotMatch(source, /copyLink/u)
})

const makeSidebar = (tabs, { expanded = true, sessionId = 's-1' } = {}) => {
  const opened = []
  const sidebar = {
    mounted: { getSnapshot: () => sessionId, subscribe: () => () => {} },
    openTabs: { subscribe: () => () => {} },
    isExpanded: () => expanded,
    tabsIn: () => tabs,
    openTab: (kind, options) => { opened.push({ kind, options }) },
  }
  return { sidebar, opened }
}

test('replaceSoleGuide swaps a lone guide tab for the file manager', async () => {
  const { replaceSoleGuide } = await import('./src/client/default-tab.js')
  const { sidebar, opened } = makeSidebar([{ id: 't1', kind: 'guide' }])
  assert.equal(replaceSoleGuide({ sidebar, kinds: new Map([['media', {}]]), libraryKind: 'media' }), true)
  assert.deepEqual(opened, [{ kind: 'media', options: { replaceTab: 't1' } }])
})

test('replaceSoleGuide yields to the workspace-files tab from another plugin', async () => {
  const { replaceSoleGuide } = await import('./src/client/default-tab.js')
  const { sidebar, opened } = makeSidebar([{ id: 't1', kind: 'guide' }])
  assert.equal(replaceSoleGuide({ sidebar, kinds: new Map([['files', {}], ['media', {}]]), libraryKind: 'media' }), false)
  assert.equal(opened.length, 0)
})

test('replaceSoleGuide does nothing when the session already has other tabs', async () => {
  const { replaceSoleGuide } = await import('./src/client/default-tab.js')
  const { sidebar, opened } = makeSidebar([{ id: 't1', kind: 'guide' }, { id: 't2', kind: 'media' }])
  assert.equal(replaceSoleGuide({ sidebar, kinds: new Map([['media', {}]]), libraryKind: 'media' }), false)
  assert.equal(opened.length, 0)
})

test('replaceSoleGuide does nothing while the sidebar is collapsed', async () => {
  const { replaceSoleGuide } = await import('./src/client/default-tab.js')
  const { sidebar, opened } = makeSidebar([{ id: 't1', kind: 'guide' }], { expanded: false })
  assert.equal(replaceSoleGuide({ sidebar, kinds: new Map([['media', {}]]), libraryKind: 'media' }), false)
  assert.equal(opened.length, 0)
})

test('installDefaultTab reacts to the sidebar once, after a microtask', async () => {
  const { installDefaultTab } = await import('./src/client/default-tab.js')
  const listeners = []
  const opened = []
  const sidebar = {
    mounted: { getSnapshot: () => 's-1', subscribe: fn => { listeners.push(fn); return () => {} } },
    openTabs: { subscribe: fn => { listeners.push(fn); return () => {} } },
    isExpanded: () => true,
    tabsIn: () => [{ id: 't1', kind: 'guide' }],
    openTab: (kind, options) => { opened.push({ kind, options }) },
  }
  let enabled = true
  const dispose = installDefaultTab({ sidebar, kinds: new Map([['media', {}]]), libraryKind: 'media', enabled: () => enabled })
  listeners[0]()
  assert.equal(opened.length, 0, 'must defer past the synchronous call')
  await Promise.resolve()
  assert.deepEqual(opened, [{ kind: 'media', options: { replaceTab: 't1' } }])

  // The preference being off keeps the swap from happening again.
  opened.length = 0
  enabled = false
  listeners[0]()
  await Promise.resolve()
  assert.equal(opened.length, 0)
  dispose()
})
