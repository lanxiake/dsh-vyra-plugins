/**
 * Load the browser bundle outside DSH with the real React/ReactDOM and a
 * minimal window/document/context stub, then check the registration contract.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import ReactDOM from 'react-dom'

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
  assert.equal(loaded.name, 'vyra-media-studio')
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
    'vyra-media-studio.composer-bridge',
    'vyra-media-studio/audio',
    'vyra-media-studio/library',
    'vyra-media-studio/video',
  ])
  assert.ok(bodies.every(body => typeof body.component === 'function'))
  assert.equal(opened.length, 0)
})
