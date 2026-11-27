/**
 * 在用户终端里代跑命令（runInShell）的测试。
 *
 * 用两份假 shell 分别覆盖两种现实：
 *  1. **只执行、不回显**——最小协议：写进去的一整行被解析执行，先吐开始标记、再吐命令
 *     输出、最后吐收尾标记与退出码。
 *  2. **会回显**——真 pty 会把写进去的那一行原样回显（还可能带提示符、还可能被拆成
 *     几段 data 到达）。这是最容易出错的一路，单独压一压。
 *
 * 所有控制字符都从 CC() 取，源码里不写行内转义（这个仓库的编辑链路会把它折叠掉）。
 */
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { TerminalManager, stripEcho } from '../terminals.js'

const CC = (n) => String.fromCharCode(n)
const BEL = CC(7)
const ESC = CC(27)
const CTRL_U = CC(21)
const CR = CC(13)
const LF = CC(10)
const OPEN = ESC + ']1338;'
const CLOSE = ESC + ']1339;'

const results = []
const test = async (name, fn) => {
  try {
    await fn()
    results.push(`✓ ${name}`)
  } catch (e) {
    results.push(`✗ ${name}\n  ${e instanceof Error ? e.stack : e}`)
    process.exitCode = 1
  }
}

/**
 * 假 shell。
 * @param {(cmd: string) => {out: string, code: number}} run 执行一条命令
 * @param {{echo?: boolean, chunked?: boolean}} [opts] echo: 回显写进来的那一行；chunked: 逐段吐
 */
function fakeShell(run, opts = {}) {
  const stream = new EventEmitter()
  const emit = (s) => {
    if (opts.chunked) {
      for (const piece of String(s).match(/[\s\S]{1,3}/g) ?? []) {
        stream.emit('data', Buffer.from(piece, 'utf8'))
      }
    } else {
      stream.emit('data', Buffer.from(String(s), 'utf8'))
    }
  }
  stream.setWindow = () => {}
  stream.close = () => stream.emit('close')
  let line = ''
  stream.write = (chunk) => {
    for (const ch of chunk.toString('utf8')) {
      if (ch === CTRL_U) {
        line = ''
        continue
      }
      if (ch !== CR) {
        line += ch
        continue
      }
      handle(line)
      line = ''
    }
    return true
  }

  function handle(script) {
    const openAt = script.indexOf(OPEN)
    if (openAt < 0) {
      if (opts.echo) emit(script + LF)
      return
    }
    const afterOpen = script.indexOf(BEL, openAt)
    if (afterOpen < 0) return
    const nonce = script.slice(openAt + OPEN.length, afterOpen)
    // 命令 = 开始标记的 printf 之后、收尾 printf 之前
    const rest = script.slice(afterOpen + 1).replace(/^'?;?\s*/, '')
    const closeAt = rest.indexOf(`; printf '${CLOSE}`)
    const cmd = (closeAt < 0 ? rest : rest.slice(0, closeAt)).replace(/^;?\s*/, '').trim()

    if (opts.echo) emit(script + LF) // pty 回显：这一行的原文
    emit(OPEN + nonce + BEL) // 开头的 printf 执行结果
    const { out, code } = run(cmd)
    if (out) emit(out)
    emit(CLOSE + nonce + ' ' + code + BEL) // 收尾的 printf
  }

  return stream
}

const session = (stream) => ({ shell: async () => stream })

/** 收下 SSE，用来断言「用户到底看到了什么」。 */
function collect(tm) {
  const seen = []
  const sink = {
    writeHead() {},
    write(chunk) {
      const m = /^data: (.*)\n\n$/.exec(chunk)
      if (!m) return true
      const obj = JSON.parse(m[1])
      if (obj.d) seen.push(Buffer.from(obj.d, 'base64').toString('utf8'))
      return true
    },
    on() {},
  }
  tm.subscribe(sink)
  return () => seen.join('')
}

const ECHOES = [{ name: '不回显', echo: false }, { name: '会回显', echo: true }]

for (const { name, echo } of ECHOES) {
  await test(`[${name}] 命令的输出被读回来，退出码对`, async () => {
    const tm = new TerminalManager()
    const stream = fakeShell((cmd) => (cmd === 'false' ? { out: '', code: 1 } : { out: `hello${LF}world${LF}`, code: 0 }), { echo })
    const id = await tm.open(session(stream), 'c1', 80, 24)
    const r = await tm.runInShell(id, 'echo hello')
    assert.equal(r.stdout, 'hello\nworld', 'stdout')
    assert.equal(r.code, 0, 'exit code')
    assert.equal((await tm.runInShell(id, 'false')).code, 1)
  })

  await test(`[${name}] 多行输出与末尾数字`, async () => {
    const tm = new TerminalManager()
    const stream = fakeShell(() => ({ out: `a${LF}b${LF}621${LF}`, code: 0 }), { echo })
    const id = await tm.open(session(stream), 'c1', 80, 24)
    const r = await tm.runInShell(id, 'wc -l x')
    assert.equal(r.stdout, 'a\nb\n621')
    assert.equal(r.code, 0, '输出末尾的数字不能被当成退出码')
  })

  await test(`[${name}] 标记不漏给终端`, async () => {
    const tm = new TerminalManager()
    const stream = fakeShell(() => ({ out: 'RESULT' + LF, code: 0 }), { echo })
    const id = await tm.open(session(stream), 'c1', 80, 24)
    const visible = collect(tm)
    await tm.runInShell(id, 'echo RESULT')
    const text = visible()
    assert.ok(!text.includes('1338'), '开始标记不能漏给终端')
    assert.ok(!text.includes('1339'), '收尾标记不能漏给终端')
  })
}

await test('回显被拆成 3 个字符一段时也能认出来', async () => {
  const tm = new TerminalManager()
  const stream = fakeShell(() => ({ out: `hello${LF}`, code: 0 }), { echo: true, chunked: true })
  const id = await tm.open(session(stream), 'c1', 80, 24)
  const r = await tm.runInShell(id, 'echo hello')
  assert.equal(r.stdout, 'hello')
})

await test('stripEcho：整段回显 / 部分回显 / 回显已结束', () => {
  const echo = 'echo hi'
  assert.deepEqual(stripEcho(echo + LF + 'out', echo), { rest: '\nout', pending: false })
  // 只到一半：整段都是回显
  assert.equal(stripEcho('ec', echo).pending, true)
  // 对不上：回显已经结束，剩下的都是输出
  assert.deepEqual(stripEcho('xxout', echo).rest, 'xxout')
  // 前面带提示符与 Ctrl-U 也要认
  assert.deepEqual(stripEcho(CTRL_U + '$ ' + echo + LF, echo).rest, '\n')
})

await test('命令里带换行：直接拒绝，不去污染终端', async () => {
  const tm = new TerminalManager()
  const id = await tm.open(session(fakeShell(() => ({ out: '', code: 0 }))), 'c1', 80, 24)
  await assert.rejects(() => tm.runInShell(id, `echo a${LF}echo b`), /不能有换行/)
})

await test('全屏程序占着终端（vim）时拒绝执行', async () => {
  const tm = new TerminalManager()
  const stream = fakeShell(() => ({ out: '', code: 0 }))
  const id = await tm.open(session(stream), 'c1', 80, 24)
  stream.emit('data', Buffer.from(ESC + '[?1049h', 'utf8'))
  await assert.rejects(() => tm.runInShell(id, 'ls'), /全屏程序/)
  stream.emit('data', Buffer.from(ESC + '[?1049l', 'utf8'))
  assert.equal((await tm.runInShell(id, 'ls')).code, 0)
})

await test('超时发 Ctrl-C 并报超时，而不是一直等', async () => {
  const tm = new TerminalManager()
  const stream = fakeShell(() => ({ out: '', code: 0 }))
  stream.write = (chunk) => (String(chunk).includes(OPEN) ? true : true)
  const id = await tm.open(session(stream), 'c1', 80, 24)
  await assert.rejects(() => tm.runInShell(id, 'sleep 999', { timeoutMs: 50 }), (e) => e.timedOut === true)
})

await test('终端断开时代执行的那条立刻失败', async () => {
  const tm = new TerminalManager()
  const stream = fakeShell(() => ({ out: '', code: 0 }))
  stream.write = () => true
  const id = await tm.open(session(stream), 'c1', 80, 24)
  const p = tm.runInShell(id, 'sleep 100', { timeoutMs: 10_000 })
  await new Promise((r) => setTimeout(r, 10))
  stream.emit('close')
  await assert.rejects(() => p, /已断开/)
})

await test('并发调用被排队', async () => {
  const tm = new TerminalManager()
  const order = []
  const id = await tm.open(
    session(
      fakeShell(() => {
        order.push('run')
        // 有没有输出都行，退出码一定要对——这条用例测的是排队。
        return { out: '', code: 0 }
      })
    ),
    'c1',
    80,
    24
  )
  const [a, b] = await Promise.all([tm.runInShell(id, 'echo 1'), tm.runInShell(id, 'echo 2')])
  assert.equal(a.code, 0)
  assert.equal(b.code, 0)
  assert.deepEqual(order, ['run', 'run'])
})

await test('空命令直接拒绝', async () => {
  const tm = new TerminalManager()
  const id = await tm.open(session(fakeShell(() => ({ out: '', code: 0 }))), 'c1', 80, 24)
  await assert.rejects(() => tm.runInShell(id, '   '), /为空/)
})

console.log(results.join('\n'))
console.log(`\n${results.filter((r) => r.startsWith('✓')).length}/${results.length} passed`)
process.exit(process.exitCode ?? 0)
