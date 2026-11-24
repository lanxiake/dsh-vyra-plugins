/**
 * 第三轮反馈回归：
 *   1. 移除截图浮层与设置里的「隐藏 DSH 界面」
 *   2. 选区之外压暗、选区保持原样（标注阶段也保持）
 *   3. 设置页真正渲染出各张卡片，并主动回到顶部
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const source = readFileSync(path.join(here, '..', 'src', 'client.body.js'), 'utf8')
const built = readFileSync(path.join(here, '..', 'client.js'), 'utf8')

test('截图不再有「隐藏 DSH 界面」', () => {
  assert.doesNotMatch(source, /hideDshOnShot/, '设置里仍有「隐藏 DSH」项')
  assert.doesNotMatch(source, /toggleHideDsh/, '浮层里仍有切换按钮')
  assert.doesNotMatch(source, /vsr-shot-hide/, '仍残留隐藏按钮样式')
  assert.doesNotMatch(source, /&hideDsh=1/, '抓图仍会带隐藏参数')
})

test('选区之外压暗，选区本身保持原亮度', () => {
  // 遮罩必须先画、并且把选区抠出来，否则整图一起变暗。
  const dim = /ctx\.fillStyle = 'rgba\(0,0,0,\.45\)'\s*\n\s*ctx\.fillRect\(0, 0, disp\.w, disp\.h\)\s*\n\s*ctx\.clearRect\(sel\.x, sel\.y, sel\.w, sel\.h\)/.exec(source)
  assert.ok(dim, '缺少"整屏压暗 + 抠出选区"的绘制')
  // 标注要在遮罩之后画，否则笔画会被压暗。
  const dimAt = source.indexOf("ctx.fillStyle = 'rgba(0,0,0,.45)'")
  const strokeAt = source.indexOf('for (const stroke of strokes) drawStroke(ctx, stroke)')
  assert.ok(dimAt > 0 && strokeAt > dimAt, '标注必须在遮罩之后绘制')
  // 标注阶段也要保持压暗。
  assert.match(source, /if \(sel && !isRegion\) \{[\s\S]{0,120}rgba\(0,0,0,\.45\)/, '标注阶段不再压暗')
})

test('设置页渲染出各张卡片', () => {
  for (const title of ['存储位置', '录制', '快捷键', '文字识别', '文件']) {
    assert.ok(source.includes("'" + title + "'"), '设置页缺少卡片：' + title)
  }
  // 已移除的截图卡片不应再作为独立卡片存在。
  assert.doesNotMatch(source, /h\('h3', null, L\('截图', 'Screenshot'\)\)/, '「截图」卡片仍存在')
})

test('设置页出现时主动回到顶部', () => {
  // 宿主面板的滚动位置会保留，停在底部时看起来像前面的卡片没了。
  assert.match(source, /scrollIntoView\(\{ block: 'start' \}\)/, '设置页没有回到顶部')
  assert.match(source, /ref: topRef/, '根节点没有挂 ref')
})

test('构建产物包含本轮改动', () => {
  assert.ok(!built.includes('hideDshOnShot'), '构建产物仍含隐藏 DSH 配置')
  assert.ok(built.includes('rgba(0,0,0,.45)'), '构建产物缺少选区压暗')
  assert.ok(built.includes("scrollIntoView({ block: 'start' })"), '构建产物缺少回顶部')
})