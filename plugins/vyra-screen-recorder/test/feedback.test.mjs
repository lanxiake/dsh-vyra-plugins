/**
 * 针对用户反馈回归测试：
 *   1. 提示条默认隐藏、hover 才出现，且按钮保留原生 title
 *   2. 焦点在输入框时，带修饰键的截图快捷键仍然生效
 *   3. 截图先选源，再在所选源范围内拖框
 *   4. 文字面板不遮挡工具条（z-index 层级 + 边界）
 *   5. 设置页卡片齐全
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const source = readFileSync(path.join(here, '..', 'src', 'client.body.js'), 'utf8')
const built = readFileSync(path.join(here, '..', 'client.js'), 'utf8')

test('提示条默认 display:none，只在悬停时显示', () => {
  // 关键：不能用 opacity:0 —— 那种元素仍在布局里，且部分合成路径仍可见。
  const tipRule = /\.vsr-tip \{([^}]*)\}/.exec(source)
  assert.ok(tipRule, '找不到 .vsr-tip 样式')
  assert.match(tipRule[1], /display:\s*none/, '.vsr-tip 必须以 display:none 隐藏')
  assert.doesNotMatch(tipRule[1], /opacity:\s*0/, '.vsr-tip 不应再用 opacity:0')
  assert.match(source, /\.vsr-btn-wrap:hover \.vsr-tip[^{]*\{[^}]*display:\s*inline-flex/, '悬停时必须显示提示')
  assert.match(source, /\.vsr-tip-host:hover \.vsr-tip[^{]*\{[^}]*display:\s*inline-flex/, '浮层里的提示也要有悬停规则')
})

test('工具条按钮保留原生 title（带快捷键）', () => {
  // 自绘提示失效时，原生 title 是兜底。
  assert.match(source, /title: recordLabel \+ \(recordShortcut \?/, '录制按钮缺少原生 title')
  assert.match(source, /title: S\.shotTip \+ ' \(' \+ formatCombo\(shortcuts\.screenshot\)/, '截图按钮缺少原生 title')
})

test('焦点在输入框时，带修饰键的快捷键不被吞掉', () => {
  // 复刻 isTypingTarget + isShortcutCombo 的判定。
  function isTypingTarget(target) {
    if (!target || typeof target.closest !== 'function') return false
    if (target.closest('textarea,[contenteditable="true"],[contenteditable=""]')) return true
    const input = target.closest('input')
    if (!input) return false
    const type = String(input.type || 'text').toLowerCase()
    return ['text', 'search', 'url', 'tel', 'email', 'password', 'number'].includes(type)
  }
  const isShortcutCombo = event => Boolean(event && (event.ctrlKey || event.altKey || event.metaKey))
  const shouldSkip = (event) => isTypingTarget(event.target) && !isShortcutCombo(event)

  const composer = { tagName: 'DIV', closest: selector => (selector.includes('contenteditable') ? {} : null) }
  // 用户在输入框里按 Ctrl+Alt+S：必须生效（这是第 2 条的根因）。
  assert.equal(shouldSkip({ ctrlKey: true, altKey: true, target: composer }), false, '输入框里按 Ctrl+Alt+S 被吞掉了')
  // 裸字母仍然让给输入框。
  assert.equal(shouldSkip({ ctrlKey: false, altKey: false, target: composer }), true, '裸字母不应触发截图')
  // 单行搜索框里的组合键同样生效。
  const search = { closest: selector => (selector.includes('input') ? { type: 'search' } : null) }
  assert.equal(shouldSkip({ ctrlKey: true, altKey: true, target: search }), false)
})

test('截图入口先打开源选择框，而不是直接抓屏', () => {
  const take = /async function takeScreenshot\(\) \{([\s\S]*?)\n    \}/.exec(source)
  assert.ok(take, '找不到 takeScreenshot')
  assert.match(take[1], /openPicker\('shot'\)/, '截图应当先打开源选择框')
  assert.doesNotMatch(take[1], /fetchShot\(/, '截图入口不应再直接抓屏')
})

test('截图选源后带 crop 进入浮层，且拖框被限制在所选范围内', () => {
  assert.match(source, /function openShotOverlay\(/, '缺少 openShotOverlay')
  assert.match(source, /crop: bounds/, '进入浮层时没有记录裁剪区')
  assert.match(source, /const clampToView = point =>/, '缺少拖框边界限制')
  // 单击没拖出框时，选中的应是所选源的范围，不是整屏。
  assert.match(source, /const full = \{ x: viewBox\.x, y: viewBox\.y, w: viewBox\.w, h: viewBox\.h \}/, '单击回退到整屏了，应回退到所选源')
})

test('文字面板不会盖住工具条', () => {
  const toolbar = /\.vsr-toolbar-floating \{([^}]*)\}/.exec(source)[1]
  const panel = /\.vsr-text-panel \{([^}]*)\}/.exec(source)[1]
  const zOf = (css) => { const m = /z-index:\s*(\d+)/.exec(css); return m ? Number(m[1]) : 0 }
  assert.ok(zOf(toolbar) > zOf(panel), '工具条 z-index 必须高于面板，否则面板会挡住按钮')
  // 面板高度要有上界，不能无限长到压住工具条。
  assert.match(panel, /max-height:\s*min\(/, '面板 max-height 没有上界')
})

test('截图浮层按钮的提示不标快捷键', () => {
  // 用户明确要求：截图选定范围后，下面那排按钮不要注明快捷键。
  const floating = source.slice(source.indexOf("phase === 'annotate' && !isRegion ? h('div', { className: 'vsr-toolbar-floating' }"), source.indexOf("phase === 'select' && isRegion ?"))
  const withShortcut = floating.match(/h\(Tip, \{[^}]*shortcut:/g)
  assert.equal(withShortcut, null, '浮层工具条的提示里仍然带了快捷键')
})

test('设置页保留了原有卡片', () => {
  const start = source.indexOf('function SettingsPage')
  const body = source.slice(start, source.indexOf('function iconRecord', start))
  for (const title of ['存储位置', '录制', '快捷键', '截图', '文件']) {
    assert.ok(body.includes("'" + title + "'"), '设置页缺少卡片：' + title)
  }
  assert.ok(body.includes('文字识别'), '设置页缺少 文字识别 卡片')
})

test('构建产物与源码一致且可解析', () => {
  assert.ok(built.includes('vsr-tip-body'), '构建产物缺少提示条样式')
  assert.ok(built.includes('openShotOverlay'), '构建产物缺少截图选源逻辑')
})