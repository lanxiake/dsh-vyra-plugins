// The manifest's inline icons, checked against the files they are generated
// from. `sync-manifest-icons.mjs` is a generator, and a generator that damages
// its own output is silent: the manifest still parses, every other suite still
// passes, and the market card shows a broken image.
//
//   node --test scripts/test/manifest-icons.test.mjs
import { strict as assert } from 'node:assert'
import test from 'node:test'
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..', '..')
const manifest = join(root, 'scripts', 'market-manifest.ts')
const generator = join(root, 'scripts', 'sync-manifest-icons.mjs')
const PREFIX = 'data:image/svg+xml;base64,'

/** The plugin → constant map, read from the generator so the two cannot drift. */
function iconMap() {
  const source = readFileSync(generator, 'utf8')
  const block = /const ICONS = \{([\s\S]*?)\n\}/u.exec(source)
  assert.ok(block, 'the generator must declare its ICONS map')
  return [...block[1].matchAll(/'([a-z0-9-]+)':\s*'([A-Z_]+)'/gu)].map((m) => ({ plugin: m[1], constant: m[2] }))
}

/** One constant's payload, anchored on the declaration line. */
function payloadOf(text, constant) {
  const start = text.indexOf(`const ${constant} =`)
  if (start === -1) return null
  const valueStart = text.indexOf("'", text.indexOf('\n', start)) + 1
  const valueEnd = text.indexOf("'", valueStart)
  return text.slice(valueStart, valueEnd)
}

const norm = (text) => text.replace(/\r\n/gu, '\n')

/**
 * Run the generator and hand back the manifest it produced, restoring the
 * original afterwards from a copy rather than from git — this must not depend
 * on the working tree being clean.
 */
function withGenerator(body) {
  const before = readFileSync(manifest, 'utf8')
  try {
    execFileSync(process.execPath, [generator], { stdio: 'ignore' })
    return body()
  } finally {
    writeFileSync(manifest, before)
  }
}

test('every icon payload decodes to its plugin\'s icon.svg', () => {
  const text = readFileSync(manifest, 'utf8')
  for (const { plugin, constant } of iconMap()) {
    const payload = payloadOf(text, constant)
    assert.ok(payload, `${constant} is missing from the manifest`)
    assert.ok(payload.startsWith(PREFIX), `${constant} is not a data: SVG URL`)
    const decoded = Buffer.from(payload.slice(PREFIX.length), 'base64').toString('utf8')
    // The generator strips a leading BOM (`vyra-agent-manager`'s SVG has one);
    // git may hand the file back with either line ending, so both are normalized.
    const svg = readFileSync(join(root, 'plugins', plugin, 'icon.svg'), 'utf8').replace(/^\uFEFF/u, '')
    assert.equal(norm(decoded), norm(svg), `${constant} does not match plugins/${plugin}/icon.svg`)
    assert.ok(decoded.trimStart().startsWith('<svg'), `${constant} is not an SVG document`)
    assert.ok(decoded.trimEnd().endsWith('</svg>'), `${constant} is a truncated SVG document`)
  }
})

test('running the generator twice does not change the manifest', () => {
  // The property the earlier pattern silently broke. It is asserted by RUNNING
  // the generator rather than by reading it, because what failed before was the
  // interaction between the removal pattern and the writer's own output — not
  // either one on its own.
  withGenerator(() => {
    const once = readFileSync(manifest, 'utf8')
    execFileSync(process.execPath, [generator], { stdio: 'ignore' })
    const twice = readFileSync(manifest, 'utf8')
    assert.equal(once, twice, 'a second run must be a byte-for-byte no-op')
    // And the block it writes must be the block it read: a generator that
    // "converged" by deleting its own output would pass the check above.
    for (const { constant } of iconMap()) {
      assert.ok(payloadOf(twice, constant), `${constant} disappeared after two runs`)
    }
  })
})

test('the icon block holds exactly the declared icons and nothing else', () => {
  // The block is written between the last of the file's own declarations and the
  // `LocalizedText` marker, so what sits in that span is exactly what this
  // generator owns. A pattern that over-matches leaves surplus blank lines
  // behind — invisible to a "every icon is present" check, and enough to make
  // the manifest drift by a few bytes on every run.
  const text = readFileSync(manifest, 'utf8')
  const marker = text.indexOf("/** The validated index's localized-text union. */")
  assert.notEqual(marker, -1, 'the block marker must exist')
  const head = text.slice(0, marker)
  // The block opens at the comment above the FIRST constant this generator
  // owns; everything from there to the marker is its span, and nothing else
  // may live in it.
  const map = iconMap()
  const firstConstant = map[0].constant
  const decl = head.lastIndexOf(`const ${firstConstant} =`)
  assert.notEqual(decl, -1, `the first owned constant ${firstConstant} must be present`)
  const open = head.lastIndexOf('/** Inline icon for ', decl)
  assert.notEqual(open, -1, 'the block must open at the comment above that constant')
  const block = head.slice(open)

  // Every line is one the generator writes: a comment, a declaration, a value,
  // a blank separator (bare, or carrying its CR), and nothing else.
  const allowed = [
    /^\r?$/u,
    /^\/\*\* Inline icon for `[a-z0-9-]+`\. \*\/\r?$/u,
    /^const [A-Z_]+ =\r?$/u,
    /^ {2}'data:image\/svg\+xml;base64,[A-Za-z0-9+/=]*'\r?$/u,
  ]
  const strays = block.split('\n').map((line, i) => [line, i + 1])
    .filter(([line]) => !allowed.some((re) => re.test(line)))
  assert.deepEqual(strays.map(([line, n]) => `${n}: ${line.slice(0, 60)}`), [],
    'the block contains lines the generator does not write')

  // One declaration per icon, and no doubled blank line inside the block: the
  // writer puts exactly one separator after each icon, so two in a row means a
  // removal left one behind and the block is accumulating them.
  assert.equal((block.match(/const /gu) || []).length, iconMap().length, 'one declaration per icon')
  assert.equal(/\r?\n\s*\r?\n\s*\r?\n/u.test(block), false, 'no doubled blank line inside the block')
})

test('the generator collapses surplus blank lines between the icons', () => {
  // The property the earlier pattern actually failed, and the reason "run it
  // twice" alone does not catch it: the generator had already normalised the
  // file to whatever its own bug produced, so two more runs of a
  // wrong-but-stable writer look identical.
  //
  // The surplus goes INSIDE the block — between one icon's separator and the
  // next icon's comment — because that is the span the removal pattern owns and
  // the only place the writer normalises. Blank lines outside the block belong
  // to the manifest's authors and are left alone, which is why the fixture is
  // built at that exact seam.
  withGenerator(() => {
    execFileSync(process.execPath, [generator], { stdio: 'ignore' })
    const fromClean = readFileSync(manifest, 'utf8')

    // One surplus blank line at each icon seam: `…value'\r\n\r\n` becomes
    // `…value'\r\n\r\n\r\n` before the next icon's comment.
    const respaced = fromClean.replace(
      /(\r?\n)(\r?\n)(\/\*\* Inline icon for `)/gu,
      '$1$2$2$3',
    )
    assert.notEqual(respaced, fromClean, 'the fixture must actually be respaced')
    writeFileSync(manifest, respaced)

    execFileSync(process.execPath, [generator], { stdio: 'ignore' })
    assert.equal(readFileSync(manifest, 'utf8'), fromClean,
      'the generator must collapse surplus spacing, not preserve or accumulate it')
  })
})
test('the generator leaves the manifest\'s line endings alone', () => {
  // `core.autocrlf=true` is on and there is no `.gitattributes`, so the file is
  // CRLF in the working tree and LF in git. A generator that wrote `\n` into a
  // CRLF file would show every line as changed on the next commit.
  const eol = readFileSync(manifest, 'utf8').includes('\r\n') ? '\r\n' : '\n'
  withGenerator(() => {
    const after = readFileSync(manifest, 'utf8')
    assert.equal(after.includes('\r\n'), eol === '\r\n', 'the line ending must not change')
    if (eol === '\r\n') assert.equal(/(?<!\r)\n/u.test(after), false, 'no lone LF may be introduced')
  })
})

test('a generator run over a damaged manifest restores every icon', () => {
  // The other direction: the generator is the repair tool for a manifest a bad
  // merge or an interrupted run left short, so it must put back what is missing
  // rather than only preserving what is already correct.
  //
  // Landing back on the pre-damage bytes is NOT asserted: the generator owns
  // the whole icon block, so a manifest it has never normalised (one edited by
  // hand, or written by an older version) legitimately comes out in the
  // generator's own shape. What must hold is that nothing is missing and the
  // result is stable.
  withGenerator(() => {
    const lines = readFileSync(manifest, 'utf8').split('\n')
    const at = lines.findIndex((l) => l.startsWith('const DSH_CONSOLE_ICON ='))
    assert.notEqual(at, -1, 'the fixture constant must exist')
    const damaged = lines.filter((_, i) => i !== at && i !== at + 1 && i !== at - 2).join('\n')
    assert.equal(damaged.includes('const DSH_CONSOLE_ICON ='), false, 'the fixture must actually be damaged')
    writeFileSync(manifest, damaged)

    execFileSync(process.execPath, [generator], { stdio: 'ignore' })
    const repaired = readFileSync(manifest, 'utf8')
    for (const { constant } of iconMap()) {
      assert.ok(payloadOf(repaired, constant), `${constant} was not restored`)
    }
    // And it is then a fixed point, which is the property that makes the repair
    // trustworthy: a second run must not change what the first one wrote.
    execFileSync(process.execPath, [generator], { stdio: 'ignore' })
    assert.equal(readFileSync(manifest, 'utf8'), repaired, 'the repaired manifest must be stable')
  })
})
