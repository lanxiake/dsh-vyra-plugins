/**
 * 第二轮使用反馈的回归测试。
 *
 *   1. 快捷键截图直接整屏，不弹选源框
 *   2. 取字必须手动触发（不自动识别）
 *   3. 截完可以直接编辑：选区阶段结束后进入标注，画布不被遮挡
 *   4. 截图/录屏不再自动挂进输入框，截图改放剪贴板
 *   5. 设置页不会因为加载失败/加载中而整页空白
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const source = readFileSync(path.join(here, '..', 'src', 'client.body.js'), 'utf8')

/** 取某个函数的函数体（到下一个顶层 `    }` 为止）。 */
function functionBody(name) {
  const start = source.indexOf('function ' + name + '(')
  if (start < 0) return ''
  return source.slice(start, source.indexOf('\n    }', start) + 6)
}

test('快捷键截图不弹选源框，直接整屏抓图进选区', () => {
  const quick = functionBody('takeScreenshotQuick')
  assert.ok(quick, '缺少 takeScreenshotQuick')
  assert.match(quick, /fetchShot\(/, '快捷键截图应当直接抓屏')
  assert.doesNotMatch(quick, /openPicker/, '快捷键截图不应再弹选源框')

  // 快捷键绑定的必须是 quick 版本。
  const shortcut = /if \(matchesShortcut\(event, settings\.shortcuts\.screenshot\)\) \{([\s\S]*?)\n          \}/.exec(source)
  assert.ok(shortcut, '找不到截图快捷键处理')
  assert.match(shortcut[1], /takeScreenshotQuick\(\)/, '截图快捷键仍走选源流程')

  // 工具条按钮保留选源路径。
  const button = functionBody('takeScreenshot')
  assert.match(button, /openPicker\('shot'\)/, '按钮应当仍可先选源')
})

test('取字不再自动触发', () => {
  // 删掉的自动取字 effect：不能有人在选区变化后自动调 extractText。
  const autoExtract = /useEffect\(\(\) => \{[\s\S]{0,400}?void extractText\(\)[\s\S]{0,200}?\}, \[phase, isRegion, sel && sel\.x/
  assert.doesNotMatch(source, autoExtract, '仍存在选区变化后自动取字的 effect')
  // 取字只由按钮和快捷键触发。
  assert.match(source, /onClick: \(\) => \{ void extractText\(\) \}/, '「文」按钮应手动触发取字')
})

test('选区结束后进入标注，画布可编辑', () => {
  // onUp 在 select 阶段结束时必须切到 annotate。
  const onUp = functionBody('onUp')
  assert.match(onUp, /if \(!isRegion\) setPhase\('annotate'\)/, '松手后没有进入标注阶段')
  // 标注阶段落笔要有 draft，且工具条提供画笔/矩形/箭头/文字。
  for (const tool of ['pen', 'rect', 'arrow', 'text']) {
    assert.ok(source.includes("['" + tool + "'"), '缺少标注工具：' + tool)
  }
})

test('取字面板不会盖住画布操作区', () => {
  const panel = /\.vsr-text-panel \{([^}]*)\}/.exec(source)
  assert.ok(panel, '找不到取字面板样式')
  // 高度要留出画布空间，不能占掉大半屏。
  assert.match(panel[1], /max-height:\s*min\(30vh/, '取字面板高度仍可能盖住画布')
  assert.match(panel[1], /calc\(100vh - 320px\)/, '取字面板缺少视口高度约束')
})

test('截图不再挂进输入框，改为复制到剪贴板', () => {
  const save = functionBody('saveScreenshot')
  assert.doesNotMatch(save, /attachFile\(/, '截图仍在自动挂附件')
  assert.match(save, /putClipboard\('image'/, '截图没有复制到剪贴板')
})

test('录屏不再自动挂进输入框', () => {
  const stop = functionBody('stopRecording')
  assert.doesNotMatch(stop, /attachFile\(/, '录屏仍在自动挂附件')
  assert.doesNotMatch(stop, /已挂进输入框/, '录屏仍提示已挂进输入框')
})

test('设置页不会因为加载而整页空白', () => {
  // 不允许再有 `if (loading) return 只有加载提示` 的早返回。
  assert.doesNotMatch(source, /if \(loading\) \{\s*return h\('div', \{ className: 'vsr-settings' \}/, '仍在用 loading 早返回吞掉设置卡片')
  // 六个卡片标题都必须在渲染树里。
  for (const title of ['存储位置', '录制', '快捷键', '文字识别', '截图', '文件']) {
    assert.ok(source.includes("'" + title + "'"), '设置页缺少卡片：' + title)
  }
  // 文件列表失败不能连累设置卡片。
  const refresh = functionBody('refreshLibrary')
  assert.match(refresh, /try \{/, 'refreshLibrary 没有隔离错误，失败会连累整页')
})

test('构建产物包含本轮改动', () => {
  const built = readFileSync(path.join(here, '..', 'client.js'), 'utf8')
  assert.ok(built.includes('takeScreenshotQuick'), '构建产物缺少快速截图')
  assert.ok(!built.includes('if (loading) {\r\n        return'), '构建产物里仍有 loading 早返回')
})