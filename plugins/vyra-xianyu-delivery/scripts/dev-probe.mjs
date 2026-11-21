#!/usr/bin/env node
// 调试探针：直接调正在运行的闲鱼插件 RPC，不用开面板。
//
// 用法：
//   node scripts/dev-probe.mjs                 # 自动找端口 + status + events
//   node scripts/dev-probe.mjs events
//   node scripts/dev-probe.mjs chats
//   node scripts/dev-probe.mjs tick
//   node scripts/dev-probe.mjs cards
//   node scripts/dev-probe.mjs settings
//
// 端口来自 DSH 的 webServer：逐个探测本机监听端口里的
// /api/xianyu-delivery/rpc，命中即用。可以用 --port=61178 指定。
import { execFileSync } from 'node:child_process'

const op = process.argv[2] || 'status'
const explicitPort = process.argv.find((a) => a.startsWith('--port='))?.slice(7)

function listeningPorts() {
  try {
    const out = execFileSync('netstat', ['-ano'], { encoding: 'utf8' })
    const ports = new Set()
    for (const line of out.split(/\r?\n/)) {
      const m = line.match(/TCP\s+\S+:(\d+)\s+\S+\s+LISTENING/i)
      if (m && /127.0.0.1/.test(line)) ports.add(Number(m[1]))
    }
    return [...ports]
  } catch {
    return []
  }
}

async function call(port, body, ms = 120000) {
  const res = await fetch(`http://127.0.0.1:${port}/api/xianyu-delivery/rpc`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(ms),
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

async function findPort() {
  if (explicitPort) return Number(explicitPort)
  for (const port of listeningPorts()) {
    try {
      const { body } = await call(port, { op: 'status' }, 800)
      if (body?.ok) return port
    } catch {
      // 不是这个端口
    }
  }
  throw new Error('没找到闲鱼插件的 RPC 端口（插件没加载？）')
}

const port = await findPort()
const body = op === 'tick' ? { op } : op === 'status' ? { op } : { op }
const { body: result } = await call(port, body)
console.log(`port ${port} · ${op}`)
console.log(JSON.stringify(result, null, 2).slice(0, 6000))