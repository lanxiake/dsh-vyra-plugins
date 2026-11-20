// Tests for the pure logic in core.js.
//
// The plugin's verify-run.sh has referenced `test/` since it was written, but the directory was
// never committed, so every run failed on a missing file and nothing here was ever checked.
//
// Only pure functions are covered: prompt assembly, the selection/menu/panel geometry, and the
// mouse state machine. Anything that touches the desktop is verified by hand — see the note at
// the top of verify-run.sh.
import { strict as assert } from 'node:assert'
import test from 'node:test'

import {
  ACTIONS, MAX_TEXT_CHARS, bodyBlocks, buildRequest, explainAuthFailure, menuLayout, menuHitTest,
  panelSideFor, pickModel, placeMenuAtSelection, placePanelAtSelection, reduceMouse, saneRect,
  selectionProblem, systemPrompt, wrapLines,
} from '../core.js'

test('saneRect accepts a real rectangle and rounds it', () => {
  assert.deepEqual(
    saneRect({ left: 10.4, top: 20.6, right: 100, bottom: 50 }),
    { left: 10, top: 21, right: 100, bottom: 50 },
  )
})

test('saneRect rejects anything that would place a window at NaN', () => {
  for (const bad of [
    null, undefined, 0, 'rect', {},
    { left: NaN, top: 0, right: 1, bottom: 1 },
    { left: 0, top: 0, right: Infinity, bottom: 1 },
    { left: 'abc', top: 0, right: 1, bottom: 1 },
    { left: 10, top: 10, right: 5, bottom: 20 },
  ]) {
    assert.equal(saneRect(bad), null, `expected rejection for ${JSON.stringify(bad) ?? String(bad)}`)
  }
})

// The three placements below are the whole point of the fix: the menu and the panel are anchored
// to the selection's rectangle, not to the pointer, so the drag direction cannot move them.

const WORK = { left: 0, top: 0, right: 1920, bottom: 1080 }
const MENU = { width: 260, height: 44 }

test('the menu sits below the selection, centred on it, and never covers it', () => {
  const rect = { left: 400, top: 300, right: 700, bottom: 320 }
  const pos = placeMenuAtSelection(rect, MENU, WORK)
  assert.ok(pos.y >= rect.bottom, 'menu must start at or below the selection bottom')
  assert.equal(pos.x + MENU.width / 2, (rect.left + rect.right) / 2, 'menu must be centred on the selection')
})

test('the menu flips above when there is no room below', () => {
  const rect = { left: 400, top: 1060, right: 700, bottom: 1078 }
  const pos = placeMenuAtSelection(rect, MENU, WORK)
  assert.ok(pos.y + MENU.height <= rect.top, 'menu must end at or above the selection top')
})

test('the menu stays inside the work area even for a selection against an edge', () => {
  for (const rect of [
    { left: 0, top: 0, right: 20, bottom: 20 },
    { left: 1900, top: 1060, right: 1920, bottom: 1080 },
    { left: 0, top: 500, right: 1920, bottom: 520 },
  ]) {
    const pos = placeMenuAtSelection(rect, MENU, WORK)
    assert.ok(pos.x >= WORK.left && pos.x + MENU.width <= WORK.right, 'x within work area')
    assert.ok(pos.y >= WORK.top && pos.y + MENU.height <= WORK.bottom, 'y within work area')
  }
})

const PANEL = { width: 420, height: 300 }

test('the panel prefers below so the answer can be read against the selection', () => {
  const rect = { left: 400, top: 300, right: 700, bottom: 320 }
  assert.equal(panelSideFor(rect, PANEL, WORK), 'below')
  const pos = placePanelAtSelection(rect, PANEL, WORK, 'below')
  assert.ok(pos.y >= rect.bottom, 'panel must not cover the selection')
})

test('the panel goes above only when it cannot fit below', () => {
  const rect = { left: 400, top: 1000, right: 700, bottom: 1020 }
  assert.equal(panelSideFor(rect, PANEL, WORK), 'above')
  const pos = placePanelAtSelection(rect, PANEL, WORK, 'above')
  assert.ok(pos.y + PANEL.height <= rect.top)
})

test('a growing panel keeps its top edge, so streaming does not slide it across the selection', () => {
  const rect = { left: 400, top: 200, right: 700, bottom: 220 }
  const tops = [120, 300, 600].map(
    (height) => placePanelAtSelection(rect, { width: PANEL.width, height }, WORK, 'below').y,
  )
  assert.equal(new Set(tops).size, 1, `top edge moved while the panel grew: ${tops.join(', ')}`)
})

test('selectionProblem reports empty, oversized and non-string input', () => {
  assert.equal(selectionProblem('   '), '没有取到文本')
  assert.equal(selectionProblem(null), '没有取到文本')
  assert.ok(selectionProblem('x'.repeat(MAX_TEXT_CHARS + 1)))
  assert.equal(selectionProblem('hello'), null)
})

test('every action has a system prompt, and the target language reaches the translate one', () => {
  assert.match(systemPrompt('translate', { targetLanguage: '英文' }), /英文/)
  assert.ok(systemPrompt('summarize').length > 0)
  assert.throws(() => systemPrompt('nope'))
})

test('buildRequest carries the selection as a user message', () => {
  const request = buildRequest('explain', '  什么是闭包  ')
  assert.equal(request.messages[0].content[0].text, '什么是闭包')
  assert.ok(request.system.includes('讲解'))
})

test('the menu lays the actions out in one row, each as wide as its own label', () => {
  const actions = [{ label: '翻译' }, { label: '复制这一段' }, { label: '总结' }]
  // A deterministic stand-in for GDI measurement: wide labels make wide items.
  const layout = menuLayout(actions, 1, (label) => label.length * 10)
  assert.equal(layout.items.length, 3)
  for (const item of layout.items) {
    assert.ok(item.label.left > item.icon.left, 'the icon sits left of its label')
    assert.equal(menuHitTest(layout, item.x + item.w / 2, item.y + item.h / 2), layout.items.indexOf(item))
  }
  assert.ok(layout.items[1].w > layout.items[0].w, 'a longer label makes a wider item')
  assert.ok(layout.items[1].x > layout.items[0].x + layout.items[0].w, 'items do not overlap')
  assert.ok(layout.height < 48, 'one row, not an icon-over-label grid')
  assert.equal(menuHitTest(layout, -10, -10), -1)
})

test('reduceMouse fires on a drag and on a multi-click, but not on a plain click', () => {
  const down = reduceMouse(null, { down: true, x: 100, y: 100, t: 0 })
  assert.equal(down.fire, false)
  assert.equal(reduceMouse(down.state, { down: false, x: 100, y: 100, t: 10 }).fire, false, 'plain click is a caret')
  assert.equal(reduceMouse(down.state, { down: false, x: 130, y: 100, t: 10 }).fire, true, 'drag is a selection')

  // A second quick release at the same spot is a double-click selection.
  const first = reduceMouse(down.state, { down: false, x: 100, y: 100, t: 10 })
  const again = reduceMouse(first.state, { down: true, x: 101, y: 100, t: 100 })
  assert.equal(reduceMouse(again.state, { down: false, x: 101, y: 100, t: 150 }).fire, true)
})

test('wrapLines breaks at the width and keeps character offsets', () => {
  const measure = (part) => part.length * 10
  const lines = wrapLines('abcdefgh', 30, measure)
  assert.deepEqual(lines.map((line) => line.text), ['abc', 'def', 'gh'])
  assert.deepEqual(lines.map((line) => [line.start, line.end]), [[0, 3], [3, 6], [6, 8]])
})

test('wrapLines breaks after a space and honours explicit line breaks', () => {
  const measure = (part) => part.length * 10
  assert.deepEqual(wrapLines('ab cd ef', 50, measure).map((line) => line.text), ['ab ', 'cd ef'])
  assert.deepEqual(wrapLines('ab\n\ncd', 50, measure).map((line) => line.text), ['ab', '', 'cd'])
})

test('copy sits before summarize, because it is the action people actually use', () => {
  const order = ACTIONS.map((action) => action.id)
  assert.ok(order.indexOf('copy') < order.indexOf('summarize'), `unexpected menu order: ${order.join(', ')}`)
})

test('markdown becomes blocks the panel can style', () => {
  const blocks = bodyBlocks('# 标题\n\n正文第一行\n正文第二行\n\n- 一条\n- 二条\n\n1. 第一\n2. 第二')
  assert.deepEqual(blocks.map((block) => block.kind), ['heading', 'paragraph', 'bullet', 'bullet', 'number', 'number'])
  assert.equal(blocks[0].text, '标题')
  assert.equal(blocks[1].text, '正文第一行\n正文第二行', 'consecutive prose lines stay one paragraph')
  assert.equal(blocks[2].text, '一条')
  assert.equal(blocks[4].marker, '1.')
})

test('inline markers are stripped, because the panel draws no emphasis', () => {
  const blocks = bodyBlocks('这是 **重点** 和 `代码`，还有 [链接](https://example.com)。')
  assert.equal(blocks[0].text, '这是 重点 和 代码，还有 链接。')
})

test('a fenced code block keeps its lines and loses the fence', () => {
  const blocks = bodyBlocks('前\n\n```\nconst a = 1\nconst b = 2\n```\n\n后')
  assert.deepEqual(blocks.map((block) => block.kind), ['paragraph', 'code', 'paragraph'])
  assert.equal(blocks[1].text, 'const a = 1\nconst b = 2')
})

test('an empty answer still yields one block to measure', () => {
  const blocks = bodyBlocks('')
  assert.equal(blocks.length, 0, 'an empty answer has nothing to draw')
})

test('a 401 names the failure and the setting to fix', () => {
  const hint = explainAuthFailure('Authentication Fails, Your api key: ****imOx is invalid')
  assert.match(hint.short, /401/)
  assert.match(hint.body, /设置 → 模型/)
  assert.equal(explainAuthFailure('no model selected'), null)
  assert.equal(explainAuthFailure('HTTP 500'), null)
})

test('pickModel returns a real model, never a provider with an empty model', async () => {
  // The defect this covers: the action path used to take the first provider and pair it with
  // `model: ''`, so every action reported "no model selected" and the menu buttons did nothing.
  const picked = await pickModel([{ id: 'p1' }, { id: 'p2' }], async (provider) =>
    provider === 'p1' ? [{ id: 'm-one' }, { id: 'm-two' }] : [{ id: 'other' }])
  assert.deepEqual(picked, { provider: 'p1', model: 'm-one' }, 'the first provider with a model wins')
})

test('pickModel skips a provider whose catalog is empty, unreadable or malformed', async () => {
  const picked = await pickModel([{ id: 'empty' }, { id: 'throws' }, { id: 'bad' }, { id: 'good' }], async (provider) => {
    if (provider === 'empty') return []
    if (provider === 'throws') throw new Error('catalog unreachable')
    if (provider === 'bad') return [{ id: '' }, { name: 'no id' }]
    return [{ id: 'ok' }]
  })
  assert.deepEqual(picked, { provider: 'good', model: 'ok' }, 'the first usable provider is chosen')
})

test('pickModel answers null when no provider offers a model', async () => {
  assert.equal(await pickModel([], async () => []), null)
  assert.equal(await pickModel([{ id: 'a' }], async () => []), null)
  // A provider list with no usable id is not a provider.
  assert.equal(await pickModel([{ name: 'no id' }], async () => [{ id: 'x' }]), null)
})
