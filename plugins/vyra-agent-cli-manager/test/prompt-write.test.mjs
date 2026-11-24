// Checks the two things this repository changed about the Agent CLI Manager:
// the DeepSeek Harness catalog entry, and the prompt write route it needed.
//
//   node --test plugins/vyra-agent-cli-manager/test/
//
// The plugin's own vitest suite lives in the source repository this package is
// built from; this covers the surface this repository edits directly, so a
// published build can be checked without that checkout.
import { strict as assert } from 'node:assert'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { CLI_CATALOG, catalogEntry } from '../lib/cli/catalog.js'
import { listSkills, readPrompt } from '../lib/cli/assets.js'
import { cliHandler } from '../lib/cli/cli-routes.js'
import { PromptWriteError, promptWriteRequestOf, writePrompt } from '../lib/cli/prompt-write.js'

/** A disk the modules read through, over a real temporary directory. */
function disk() {
  return {
    readFile: async (path) => { try { return await readFile(path, 'utf8') } catch { return undefined } },
    listDirectory: async (path) => { try { return await readdir(path) } catch { return undefined } },
    writeFile: (path, text) => writeFile(path, text, 'utf8'),
    ensureDirectory: (path) => mkdir(path, { recursive: true }),
  }
}

test('the catalog carries DeepSeek Harness as a manageable CLI', () => {
  const dsh = catalogEntry('dsh')
  assert.ok(dsh !== undefined, 'the harness is a catalog entry')
  assert.equal(dsh.name, 'DeepSeek Harness')
  assert.deepEqual(dsh.versionArgs, ['--version'])
  assert.deepEqual(dsh.skillsDirs, ['.dsh/skills', '.agents/skills'], 'skills come from the harness roots')
  assert.equal(dsh.promptFile, '.dsh/AGENTS.md')
  // The harness is the application this plugin runs inside, so it has nothing to install,
  // upgrade or uninstall from here.
  assert.equal(dsh.npmPackage, undefined)
  assert.equal(dsh.upgradeArgs, undefined)
  assert.equal(dsh.uninstallArgs, undefined)
  // Every entry keeps the fields the shared readers assume.
  for (const entry of CLI_CATALOG) {
    for (const field of ['id', 'name', 'vendor', 'binary', 'configDir', 'mcp', 'skillsDirs', 'promptFile']) {
      assert.notEqual(entry[field], undefined, `${entry.id} carries ${field}`)
    }
  }
})

test('the harness launcher is found beside the running executable', () => {
  const dsh = catalogEntry('dsh')
  // This test process is not the harness, so the derived paths point at a directory that has
  // no launcher. What matters is that they are absolute and inside the app directory, which is
  // what makes the PATH-less launcher reachable in the real Host.
  assert.equal(dsh.binaryCandidates.length, 2)
  for (const candidate of dsh.binaryCandidates) {
    assert.ok(candidate.startsWith(process.execPath.replace(/[^\\/]+$/u, '')), `${candidate} sits beside the executable`)
  }
})

test('a CLI with no prompt file reads as an empty document rather than an error', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'acm-'))
  try {
    const result = await readPrompt(catalogEntry('dsh'), disk(), dir)
    assert.equal(result.text, '', 'the absent file is an empty prompt')
    assert.equal(result.error, undefined)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('the request refuses a body it cannot write', () => {
  assert.equal(promptWriteRequestOf({ text: 'hello' }), 'hello')
  assert.throws(() => promptWriteRequestOf({}), /缺少 text/u)
  assert.throws(() => promptWriteRequestOf({ text: 42 }), /text 必须是字符串/u)
})

test('a prompt write creates the file and its directory', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'acm-'))
  try {
    const written = await writePrompt(catalogEntry('dsh'), disk(), dir, '# 指令\n\n正文。')
    assert.equal(written.path, '.dsh/AGENTS.md')
    assert.equal(await readFile(join(dir, '.dsh/AGENTS.md'), 'utf8'), '# 指令\n\n正文。', 'the text is on disk verbatim')
    // The read path finds what the write path left.
    const read = await readPrompt(catalogEntry('dsh'), disk(), dir)
    assert.equal(read.text, '# 指令\n\n正文。')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('a CLI with no prompt path is refused rather than written somewhere else', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'acm-'))
  try {
    const noPrompt = { ...catalogEntry('dsh'), promptFile: undefined }
    await assert.rejects(() => writePrompt(noPrompt, disk(), dir, 'x'), PromptWriteError)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('the route writes a prompt and refuses a malformed request', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'acm-'))
  try {
    const routes = {
      home: dir, ...disk(),
      host: { capture: async () => ({ exitCode: 0, stdout: '', stderr: '' }) },
      run: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
    }
    const handler = cliHandler(routes, { requestRejection: () => undefined }, () => {})
    const call = (path, body) => new Promise((settle) => {
      const payload = JSON.stringify(body)
      const req = { method: 'POST', url: path, async *[Symbol.asyncIterator]() { yield Buffer.from(payload) } }
      const res = {
        writeHead(status) { this.status = status },
        end(text) { settle({ status: this.status, body: JSON.parse(text) }) },
      }
      void handler(req, res)
    })
    const base = '/dsh-vyra-agent-cli-manager/cli/prompt-write'

    const ok = await call(base, { id: 'dsh', text: '设定' })
    assert.equal(ok.status, 200)
    assert.equal(ok.body.success, true)
    assert.equal(await readFile(join(dir, '.dsh/AGENTS.md'), 'utf8'), '设定')

    const missing = await call(base, { id: 'dsh' })
    assert.equal(missing.status, 400, 'a request without text is refused')
    assert.equal(missing.body.success, false)

    const unknown = await call(base, { id: 'not-a-cli', text: 'x' })
    assert.equal(unknown.status, 400, 'an unknown CLI id is refused')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('every skills directory the harness reads is probed', async () => {
  // `~/.dsh/skills` is the harness's own user-level root; the test only asserts the reader
  // looks where the catalog says, not what this machine happens to have installed.
  const seen = []
  const host = {
    readFile: async () => undefined,
    listDirectory: async (path) => { seen.push(path); return undefined },
  }
  await listSkills(catalogEntry('dsh'), host, '/home/example')
  assert.deepEqual(seen, [join('/home/example', '.dsh/skills'), join('/home/example', '.agents/skills')])
})
