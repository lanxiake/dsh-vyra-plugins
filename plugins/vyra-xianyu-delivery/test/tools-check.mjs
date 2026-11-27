// 工具定义自检：名称、参数 schema、输出 render 都必须齐全，否则主 Agent 看不到。
// 跑法：node plugins/vyra-xianyu-delivery/test/tools-check.mjs
import assert from 'node:assert/strict'
import { createXianyuTools } from '../lib/tools.js'

const tools = createXianyuTools({
  cli: {},
  store: {},
  dispatcher: {},
  getAccount: () => 'acc',
})

assert.equal(tools.length, 12, '工具数量应为 12（10 个闲鱼能力 + 绑定客服 + 保存客服）')

const names = new Set()
for (const tool of tools) {
  assert.match(tool.name, /^xianyu_[a-z_]+$/, `工具名不规范：${tool.name}`)
  assert.ok(!names.has(tool.name), `重复工具名：${tool.name}`)
  names.add(tool.name)
  assert.equal(typeof tool.description, 'string')
  assert.ok(tool.description.length >= 10, `${tool.name} 描述太短`)
  assert.equal(tool.parameters.type, 'object')
  assert.equal(typeof tool.output.render, 'function')
  assert.equal(typeof tool.execute, 'function')
}

for (const required of [
  'xianyu_list_chats',
  'xianyu_read_history',
  'xianyu_send_message',
  'xianyu_list_items',
  'xianyu_get_item',
  'xianyu_list_orders',
  'xianyu_order_detail',
  'xianyu_list_cards',
  'xianyu_add_card',
  'xianyu_deliver',
]) {
  assert.ok(names.has(required), `缺少工具：${required}`)
}

console.log('tools-check ok')
