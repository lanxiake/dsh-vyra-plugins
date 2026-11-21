#!/usr/bin/env node
/**
 * 拉取指定会话的历史消息，输出原始 JSON，用于排查 itemId 提取失败。
 *
 * 用法：node test/dump-history.mjs <cid>
 * 示例：node test/dump-history.mjs 69360436252
 */

import { createCli, defaultPrefix } from '../lib/cli.js'

const cid = process.argv[2]
if (!cid) {
  console.error('用法: node test/dump-history.mjs <cid>')
  process.exit(1)
}

const cli = createCli({ command: 'uv', prefix: defaultPrefix() })

try {
  const history = await cli.history(cid, 5)
  console.log(JSON.stringify(history, null, 2))

  // 提取 itemId 看能不能找到
  for (const m of history) {
    const raw = JSON.stringify(m?.message || {})
    const direct = raw.match(/"itemId"\s*:\s*"?(\d{6,})"?/)
    const fromUrl = raw.match(/itemId=(\d{6,})/)
    if (direct || fromUrl) {
      console.log('\n✓ 找到 itemId:', direct?.[1] || fromUrl?.[1])
      break
    }
  }
} catch (err) {
  console.error('拉取失败:', err.message)
  process.exit(1)
}
