// 刷新守卫：令牌过期时最多自动刷新一次，失败后进入冷却，
// 不会因为轮询反复拉起浏览器。用一个假的 worker 计数来验证。
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createCli } from '../lib/cli.js'

const dir = mkdtempSync(join(tmpdir(), 'xy-refresh-'))
const counter = join(dir, 'count.txt')
writeFileSync(counter, '0')

// 假 worker：refresh 永远失败；其它命令报令牌过期。
const fake = `
const fs = require('fs');
const [op] = process.argv.slice(1);
const file = ${JSON.stringify(counter)};
const n = Number(fs.readFileSync(file, 'utf8')) + 1;
fs.writeFileSync(file, String(n));
fs.appendFileSync(file + '.log', op + '\\n');
console.log(JSON.stringify(op === 'refresh'
  ? { ok: false, error: 'refresh failed (fake)' }
  : { ok: false, error: 'FAIL_SYS_TOKEN_EXOIRED' }));
`

const cli = createCli({ command: process.execPath, prefix: ['-e', fake], timeout: 20000 })

const calls = []
for (let i = 0; i < 3; i += 1) {
  try {
    await cli.status()
    calls.push('ok')
  } catch (err) {
    calls.push(String(err.message || err).slice(0, 40))
  }
}

const ops = existsSync(`${counter}.log`) ? readFileSync(`${counter}.log`, 'utf8').trim().split('\n') : []
const refreshes = ops.filter((op) => op === 'refresh').length

const hasCookies = (() => {
  try {
    const p = join(process.env.HOME || process.env.USERPROFILE, '.goofish-cli', 'cookies.json')
    return readFileSync(p).length > 2
  } catch {
    return false
  }
})()

if (!hasCookies) {
  // 没登录时一次都不该尝试刷新。
  if (refreshes !== 0) throw new Error(`未登录却尝试刷新 ${refreshes} 次`)
  console.log('refresh-guard ok (no cookies: 0 refresh)')
} else {
  // 有一个 cookie 时，只允许第一次刷新，之后进入冷却。
  if (refreshes > 1) throw new Error(`重复刷新 ${refreshes} 次，冷却没生效`)
  console.log(`refresh-guard ok (refresh attempts: ${refreshes})`)
}
console.log('calls:', calls.join(' | '))