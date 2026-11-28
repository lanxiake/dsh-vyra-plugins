// 用 git 的原始字节（不经 PowerShell 重定向）比对 client.js 是否与源码同步。
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const repo = new URL('../../..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1').replace(/\//g, '\\')
const rel = 'plugins/vyra-ssh-terminal/client.js'

const headBuf = execFileSync('git', ['cat-file', '-p', `HEAD:${rel}`], { cwd: repo, maxBuffer: 64 << 20 })
const workBuf = readFileSync(new URL('../client.js', import.meta.url))

const norm = (b) => b.toString('utf8').replace(/\r\n/g, '\n')
const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16)

const a = norm(headBuf)
const b = norm(workBuf)

console.log('HEAD   :', headBuf.length, 'bytes,', a.split('\n').length, 'lines, hash', hash(a))
console.log('working:', workBuf.length, 'bytes,', b.split('\n').length, 'lines, hash', hash(b))
console.log(a === b ? '>> 内容一致（提交的是最新产物）' : '>> 内容不同！提交的产物与源码不同步')

if (a !== b) {
  const la = a.split('\n')
  const lb = b.split('\n')
  const setB = new Set(lb.map((l) => l.trim()).filter(Boolean))
  const setA = new Set(la.map((l) => l.trim()).filter(Boolean))
  const onlyHead = la.map((l, i) => ({ l: l.trim(), i: i + 1 })).filter((x) => x.l && !setB.has(x.l))
  const onlyWork = lb.map((l, i) => ({ l: l.trim(), i: i + 1 })).filter((x) => x.l && !setA.has(x.l))
  console.log(`\n只在 HEAD 里的行 (${onlyHead.length}):`)
  for (const x of onlyHead.slice(0, 8)) console.log(`  L${x.i}: ${x.l.slice(0, 120)}`)
  console.log(`\n只在工作区里的行 (${onlyWork.length}):`)
  for (const x of onlyWork.slice(0, 8)) console.log(`  L${x.i}: ${x.l.slice(0, 120)}`)
}