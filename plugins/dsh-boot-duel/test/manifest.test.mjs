import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => readFileSync(path.join(root, file), 'utf8')

const flatten = (object, prefix = '') => Object.entries(object).flatMap(([key, value]) =>
  value && typeof value === 'object'
    ? flatten(value, prefix + key + '.')
    : [prefix + key])

test('manifest exposes the bundle patch, client half and display resources', () => {
  const pkg = JSON.parse(read('package.json'))
  assert.equal(pkg.name, 'dsh-boot-duel')
  assert.equal(pkg.type, 'module')
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(pkg.dsh.client.platform, 'web')
  assert.equal(pkg.dsh.client.immediately, true)
  for (const key of ['./client', './locale/*.json', './icon', '.']) {
    assert.ok(pkg.exports[key], `exports ${key}`)
  }
  assert.equal(pkg.dependencies, undefined, 'no runtime dependencies')
})

test('manifest files list covers every runtime module and resource', () => {
  const pkg = JSON.parse(read('package.json'))
  for (const entry of ['index.js', 'client.js', 'js', 'src', 'cordis.patch.yml',
    'locale/*.json', 'sfx', 'assets', 'docs', 'icon.svg']) {
    assert.ok(pkg.files.includes(entry), `files entry ${entry}`)
  }
  // The deprecated engine stays on disk for the legacy tests but must not ship.
  for (const stale of ['render.js', 'rig.js', 'sim']) {
    assert.ok(!pkg.files.includes(stale), `deprecated ${stale} must not ship`)
  }
})

test('patch inserts one boot-duel row with easy difficulty', () => {
  const patch = read('cordis.patch.yml')
  assert.match(patch, /id: boot-duel/)
  assert.match(patch, /name: dsh-boot-duel/)
  assert.match(patch, /enabled: true/)
  assert.match(patch, /difficulty: easy/)
  assert.equal((patch.match(/- insert:/g) || []).length, 1)
})

test('host half normalises config and defaults to easy', async () => {
  const host = await import('../index.js')
  assert.equal(host.name, 'dsh-boot-duel')
  assert.deepEqual(host.normalizeConfig(undefined), { enabled: true, difficulty: 'easy', sound: true })
  assert.deepEqual(host.normalizeConfig({ enabled: 'yes', difficulty: 'impossible' }), { enabled: true, difficulty: 'easy', sound: true })
  assert.deepEqual(host.normalizeConfig({ enabled: false, difficulty: 'normal', sound: true }), { enabled: false, difficulty: 'normal', sound: true })
  assert.deepEqual(await host.config(), { enabled: true, difficulty: 'easy', sound: true })
})

/**
 * The Client half is a bundle client and cannot call `host.call`, so the
 * config path is a read-only route. Its absence used to leave the Client on
 * silent defaults; worse, the Client's attempt to use the dynamic-run seat
 * threw a ReferenceError. Both halves of that contract are asserted here.
 */
test('host registers the read-only config route and the sfx route', () => {
  const host = require('../index.js')
  const routes = []
  const disposed = []
  const scope = {
    webServer: { register: (route) => { routes.push(route); return () => disposed.push(route) } },
    effect: (fn) => fn(),
  }
  let injected = null
  const ctx = {
    inject: (names, callback) => { injected = names; callback(scope) },
    effect: (fn) => fn(),
  }
  host.apply(ctx, { enabled: false, difficulty: 'normal', sound: true })
  assert.deepEqual(injected, ['webServer'])
  assert.equal(routes.length, 2)
  const config = routes.find((route) => route.path === '/plugins/dsh-boot-duel/config')
  assert.ok(config, 'config route')
  assert.equal(config.kind, 'exact')
  const sfx = routes.find((route) => route.path.startsWith('/plugins/dsh-boot-duel/sfx'))
  assert.ok(sfx, 'sfx route')
  assert.equal(sfx.kind, 'prefix')
})

test('the sfx route serves only plain .ogg basenames', async () => {
  const host = require('../index.js')
  const { handleSfx } = host.__test
  const ask = (pathname, method = 'GET') => new Promise((resolve) => {
    const res = {
      status: 0, body: null, headers: null,
      writeHead(status, headers) { this.status = status; this.headers = headers; return this },
      end(body) { resolve({ status: this.status, body, headers: this.headers }); return this },
    }
    handleSfx({ method }, res, { pathname })
  })

  const ok = await ask('/plugins/dsh-boot-duel/sfx/impactpunch-heavy-000.ogg')
  assert.equal(ok.status, 200)
  assert.equal(ok.headers['content-type'], 'audio/ogg')
  assert.ok(ok.body && ok.body.length > 1000, 'the file is actually served')

  for (const bad of [
    '/plugins/dsh-boot-duel/sfx/../../package.json',
    '/plugins/dsh-boot-duel/sfx/CREDITS.txt',
    '/plugins/dsh-boot-duel/sfx/',
    '/plugins/dsh-boot-duel/sfx/missing.ogg',
  ]) {
    const answer = await ask(bad)
    assert.equal(answer.status, 404, `served ${bad}`)
  }

  const write = await ask('/plugins/dsh-boot-duel/sfx/cloth1.ogg', 'POST')
  assert.equal(write.status, 405)
})

test('the config route answers JSON and refuses writes', () => {
  const host = require('../index.js')
  const host_ = host.__test
  const responses = []
  const res = {
    status: 0, headers: null, body: null,
    writeHead(status, headers) { this.status = status; this.headers = headers; return this },
    end(body) { this.body = body === undefined ? null : body },
  }
  host_.handleConfig({ method: 'GET' }, res)
  responses.push(res)
  assert.equal(res.status, 200)
  assert.match(res.headers['content-type'], /application\/json/)
  // The route reflects the resolved snapshot from the last apply().
  assert.deepEqual(JSON.parse(res.body.toString()), { enabled: false, difficulty: 'normal', sound: true })

  const write = {
    status: 0,
    writeHead(status) { this.status = status; return this },
    end() { this.body = null },
  }
  host_.handleConfig({ method: 'POST' }, write)
  responses.push(write)
  assert.equal(write.status, 405)
})

test('a host without webServer still applies cleanly', () => {
  const host = require('../index.js')
  assert.doesNotThrow(() => {
    host.apply({ inject: () => {}, effect: (fn) => fn() }, { enabled: true, difficulty: 'easy', sound: true })
  })
})

test('the config route path matches what the client fetches', async () => {
  const host = require('../index.js')
  const fs = await import('node:fs')
  const clientSource = fs.readFileSync(path.join(root, 'src/client.body.js'), 'utf8')
  const match = clientSource.match(/const CONFIG_URL = '([^']+)'/)
  assert.ok(match, 'client declares CONFIG_URL')
  assert.equal(match[1], host.__test.CONFIG_PATH)
})

test('locale dictionaries agree on keys and carry the required copy', () => {
  const zh = JSON.parse(read('locale/zh.json'))
  const en = JSON.parse(read('locale/en.json'))
  assert.deepEqual(flatten(zh).sort(), flatten(en).sort())
  for (const key of ['title', 'subtitle', 'hint.controls', 'hint.skip', 'skip.button',
    'start.button', 'start.hint', 'start.sub', 'roster.you', 'roster.enemy',
    'state.ready', 'state.fight', 'state.ko', 'ko.title', 'ko.subtitle', 'ko.pressAnyKey',
    'pause.clickToResume', 'mute.on', 'mute.off',
    'meta.title', 'meta.description', 'meta.detail']) {
    for (const dict of [zh, en]) {
      assert.ok(dict[key], `missing ${key}`)
      assert.equal(typeof dict[key], 'string')
    }
  }
})
