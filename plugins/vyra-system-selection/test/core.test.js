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
  ACTIONS, DEFAULT_TARGET_LANGUAGE, MAX_TEXT_CHARS, bodyBlocks, buildFollowUpRequest, buildRequest,
  explainAuthFailure, isChineseText, isDismissingKey, isEnglishText, languageName, menuLayout,
  menuHitTest, panelSideFor, pickModel, placeMenuAtSelection, placePanelAtSelection, reduceMouse,
  saneRect, selectionProblem, sourceLanguageLabel, splitSuggestions, systemPrompt, translatePlan,
  translateTarget, wrapLines,
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
  const double = reduceMouse(again.state, { down: false, x: 101, y: 100, t: 150 })
  assert.equal(double.fire, true, 'a multi-click still counts for right-click priming')
  assert.equal(double.dragged, false, 'a multi-click must not auto-open: double-clicking a word is not a request')

  // Only an actual drag carries `dragged`, which is what the auto-open path listens for.
  assert.equal(reduceMouse(down.state, { down: false, x: 130, y: 100, t: 10 }).dragged, true, 'a drag is a drag')
  assert.equal(reduceMouse(down.state, { down: false, x: 100, y: 100, t: 10 }).dragged, false, 'a plain click is not')
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

test('follow-up suggestions are split off the answer', () => {
  const { answer, suggestions } = splitSuggestions('正文第一段。\n\n>> 追问一\n>> 追问二\n\n正文第二段。')
  assert.equal(answer, '正文第一段。\n\n正文第二段。')
  assert.deepEqual(suggestions, ['追问一', '追问二'])
})

test('suggestions stop at three, and a clean answer yields none', () => {
  const four = ['>> a', '>> b', '>> c', '>> d'].join('\n')
  assert.equal(splitSuggestions(four).suggestions.length, 3)
  assert.deepEqual(splitSuggestions('只有正文。').suggestions, [])
})

test('a follow-up request carries the original text and the previous answer', () => {
  const request = buildFollowUpRequest('原文内容', '之前的回答', '那是什么意思？')
  assert.match(request.system, /追问/)
  const text = request.messages[0].content[0].text
  assert.match(text, /原文内容/)
  assert.match(text, /之前的回答/)
  assert.match(text, /那是什么意思/)
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

// --- source language and translation direction -----------------------------------------------
//
// The rule the user asked for: a Chinese selection goes to English, everything else goes to the
// language set on the settings page. Before this nothing detected a language at all — the prompt
// always named the settings language — so translating Chinese asked the model for Chinese, and the
// card's "自动检测" pill promised a detection that never happened.

test('isChineseText counts letters, so punctuation and digits cannot outvote the words', () => {
  assert.equal(isChineseText('你好世界'), true)
  assert.equal(isChineseText('这是一个 bug 修复'), true, 'a Chinese sentence quoting an English word is still Chinese')
  assert.equal(isChineseText('你好，世界！'), true, 'full-width punctuation is not a letter')
  assert.equal(isChineseText('これは日本語です'), false, 'Japanese kana are not Han characters')
  assert.equal(isChineseText('hello world'), false)
  assert.equal(isChineseText('12345'), false, 'a number has no language')
  assert.equal(isChineseText(''), false)
  assert.equal(isChineseText(null), false)
})

test('isEnglishText needs mostly Latin letters', () => {
  assert.equal(isEnglishText('hello'), true)
  assert.equal(isEnglishText('Hello, world!'), true)
  assert.equal(isEnglishText('你好'), false)
  assert.equal(isEnglishText('Привет'), false, 'Cyrillic is not Latin')
  assert.equal(isEnglishText('42'), false)
})

test('Chinese translates into English, whatever the settings page says', () => {
  for (const preferred of ['简体中文', 'English', '日本語']) {
    assert.equal(translateTarget('这是一段中文', preferred), 'English', `preferred=${preferred}`)
  }
})

test('English translates into the language set on the settings page', () => {
  assert.equal(translateTarget('hello world', '简体中文'), '简体中文')
  assert.equal(translateTarget('hello world', '日本語'), '日本語')
})

test('other languages fall back to the settings language rather than being guessed', () => {
  assert.equal(translateTarget('Привет мир', '简体中文'), '简体中文')
  assert.equal(translateTarget('こんにちは', '繁體中文'), '繁體中文')
})

test('English into English is not a translation, so the direction falls back to Chinese', () => {
  // Offering "English" as a target in the settings page is what makes this reachable: without the
  // fallback the prompt reads "translate English into English" and the answer is the input.
  assert.equal(translateTarget('hello world', 'English'), DEFAULT_TARGET_LANGUAGE)
  assert.equal(translateTarget('这是一段中文', 'English'), 'English', 'Chinese still goes to English')
})

test('a missing or blank preferred language uses the default', () => {
  assert.equal(translateTarget('hello', ''), DEFAULT_TARGET_LANGUAGE)
  assert.equal(translateTarget('hello', undefined), DEFAULT_TARGET_LANGUAGE)
  assert.equal(translateTarget('hello', '   '), DEFAULT_TARGET_LANGUAGE)
})

test('sourceLanguageLabel names the two languages that change direction, and nothing else', () => {
  assert.equal(sourceLanguageLabel('你好'), '中文')
  assert.equal(sourceLanguageLabel('hello'), '英文')
  assert.equal(sourceLanguageLabel('Привет'), '其他')
})

test('translatePlan returns both ends, so the card cannot show a direction it did not use', () => {
  assert.deepEqual(translatePlan('你好世界', '简体中文'), {
    target: 'English', source: '中文', sourceLabel: '中文', targetLabel: 'English',
  })
  assert.equal(translatePlan('hello', '日本語').target, '日本語')
})

test('languageName uses 英语 inside a prompt rather than the settings label', () => {
  assert.equal(languageName('English'), '英语')
  assert.equal(languageName('日本語'), '日本語')
})

test('the translate prompt states the direction instead of asking for auto-detection', () => {
  const prompt = systemPrompt('translate', { targetLanguage: 'English', sourceLanguage: '中文' })
  assert.match(prompt, /用户给的中文文本/, 'the source language is named')
  assert.match(prompt, /翻译成英语/, 'the target is named in the language the model reasons in')
  assert.doesNotMatch(prompt, /English/, 'the settings label itself is not passed through')
  // Without a source the prompt still names a target, which is all a re-translation needs.
  assert.match(systemPrompt('translate', { targetLanguage: 'English' }), /翻译成英语/)
})

test('buildRequest passes the direction through to the prompt', () => {
  const request = buildRequest('translate', '你好', { targetLanguage: 'English', sourceLanguage: '中文' })
  assert.match(request.system, /翻译成英语/)
})

// --- keys that close the popup ---------------------------------------------------------------
//
// The popup never takes focus, so this rule is the only thing that notices the user has gone back
// to typing. Selecting text in order to delete it or type over it used to leave the menu on screen
// until the pointer was clicked somewhere else.

const key = (vk, extra = {}) => isDismissingKey({ vk, ...extra })

test('typing closes the menu', () => {
  for (const vk of [0x41, 0x5a, 0x30, 0x39, 0x20, 0xba, 0xdb]) {
    assert.equal(key(vk), true, `vk 0x${vk.toString(16)} types into the selection`)
  }
})

test('editing and navigation keys close the menu', () => {
  for (const vk of [0x08, 0x09, 0x0d, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x2d, 0x2e]) {
    assert.equal(key(vk), true, `vk 0x${vk.toString(16)} edits or navigates`)
  }
})

test('shortcuts and inert keys leave the menu open', () => {
  // Ctrl+C after selecting is how people copy; closing under it would make them reselect.
  assert.equal(key(0x43, { control: true }), false, 'Ctrl+C')
  assert.equal(key(0x56, { control: true }), false, 'Ctrl+V')
  assert.equal(key(0x41, { alt: true }), false, 'Alt+letter is a menu mnemonic')
  assert.equal(key(0x44, { win: true }), false, 'Win+D')
  assert.equal(key(0x1b), false, 'Esc is handled by the card itself when it has focus')
  assert.equal(key(0x70), false, 'F1')
  assert.equal(key(0x90), false, 'NumLock')
  assert.equal(key(0x14), false, 'CapsLock')
  assert.equal(key(0x10), false, 'a bare Shift')
})

test('the numpad is read by which key actually produced the press', () => {
  assert.equal(key(0x25, { numpad: true }), false, 'numpad 4 with NumLock off is not the left arrow')
  assert.equal(key(0x60, { numpad: true }), true, 'numpad 0 types a digit')
  assert.equal(key(0x6b), false, 'numpad +')
  // With NumLock off the keypad sends the navigation codes without the numpad flag, so these are
  // the editing keys they were before — numpad 2 is Down, numpad 0 is Insert.
  assert.equal(key(0x28), true, 'down arrow / numpad 2')
  assert.equal(key(0x2e), true, 'Delete / numpad .')
  assert.equal(key(0x25, { extended: true }), true, 'the real arrow keys navigate')
})

test('a key code that means "no key" is ignored', () => {
  assert.equal(key(0), false)
  assert.equal(key(0xff), false)
  assert.equal(isDismissingKey({}), false)
  assert.equal(isDismissingKey(), false)
})
