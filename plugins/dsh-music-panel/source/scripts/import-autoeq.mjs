#!/usr/bin/env node
/**
 * Import the AutoEQ fixed-band presets into lib/data/autoeq-presets.json.
 *
 *   node scripts/import-autoeq.mjs            # fetch missing entries, then write
 *   node scripts/import-autoeq.mjs --check    # fail if the data file is missing
 *
 * AutoEQ (https://github.com/jaakkopasanen/AutoEq, MIT) publishes one folder per
 * measured headphone with a `… FixedBandEQ.txt` file: a preamp line plus ten
 * peaking filters at 31/62/125/250/500/1k/2k/4k/8k/16k Hz, Q=1.41. The plugin's
 * graphic equalizer uses exactly that layout, so these import one-to-one.
 *
 * Results are cached under .autoeq-cache/ so a re-run only fetches what is new.
 *
 * Behind a system proxy, Node's fetch ignores it by default: run with
 *   HTTPS_PROXY=http://127.0.0.1:<port> node --use-env-proxy scripts/import-autoeq.mjs
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync as existsSyncSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const DATA = join(ROOT, 'src', 'host', 'stores', 'data', 'autoeq-presets.json')
const CACHE = join(ROOT, '.autoeq-cache')
const RAW = 'https://raw.githubusercontent.com/jaakkopasanen/AutoEq/master/results'
const INDEX = `${RAW}/INDEX.md`
const CONCURRENCY = 32

const check = process.argv.includes('--check')
if (check) {
  if (!existsSyncSync(DATA)) {
    console.error('missing src/host/stores/data/autoeq-presets.json — run node scripts/import-autoeq.mjs')
    process.exit(1)
  }
  const parsed = JSON.parse(await readFile(DATA, 'utf8'))
  console.log(`autoeq presets: ${parsed.presets.length} entries (${parsed.generated})`)
  process.exit(0)
}

async function fetchText(url, tries = 4) {
  let lastError = null
  for (let attempt = 0; attempt < tries; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { 'user-agent': 'dsh-music-panel/import' } })
      if (response.status === 404) return null
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.text()
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)))
    }
  }
  throw lastError ?? new Error('fetch failed')
}

function parseIndex(text) {
  const rows = []
  for (const line of text.split('\n')) {
    // The link target may itself contain literal parentheses, so the closing
    // `) by ` is the only reliable terminator.
    const match = line.match(/^-\s+\[(.+?)\]\((\.\/.+?)\)\s+by\s+(.+)$/)
    if (!match) continue
    const name = match[1]
    const target = match[2].slice(2) // drop "./"
    const attribution = match[3].trim()
    const source = attribution.split(' on ')[0].trim()
    const segments = target.split('/').map((part) => decodeURIComponent(part))
    rows.push({ name, segments, source, form: segments[1] || '' })
  }
  return rows
}

function cacheKey(row) {
  return row.segments.join('|') + '|' + row.name
}

function presetUrl(row) {
  const dir = row.segments.map((part) => encodeURIComponent(part)).join('/')
  const file = encodeURIComponent(`${row.name} FixedBandEQ.txt`)
  return `${RAW}/${dir}/${file}`
}

function parsePreset(text) {
  if (typeof text !== 'string' || text === '') return null
  const preampMatch = text.match(/Preamp:\s*(-?\d+(?:\.\d+)?)\s*dB/)
  if (!preampMatch) return null
  const gains = [...text.matchAll(/Filter\s+\d+:\s+ON\s+PK\s+Fc\s+[\d.]+\s*Hz\s+Gain\s+(-?\d+(?:\.\d+)?)\s*dB/g)].map(
    (match) => Number(match[1]),
  )
  if (gains.length !== 10) return null
  return { p: Number(preampMatch[1]), g: gains }
}

async function pathExists(path) {
  try {
    await readFile(path)
    return true
  } catch {
    return false
  }
}

await mkdir(CACHE, { recursive: true })
await mkdir(dirname(DATA), { recursive: true })

console.log('fetching INDEX.md…')
const indexText = await fetchText(INDEX)
if (indexText === null) throw new Error('INDEX.md is missing')
const rows = parseIndex(indexText)
console.log(`${rows.length} profiles in the index`)

let done = 0
let skipped = 0
let failed = 0
const presets = []

async function handle(row) {
  const key = cacheKey(row)
  const cacheFile = join(CACHE, encodeURIComponent(key) + '.json')
  let entry = null
  if (await pathExists(cacheFile)) {
    try {
      entry = JSON.parse(await readFile(cacheFile, 'utf8'))
    } catch {
      entry = null
    }
  }
  if (entry === null) {
    let text = null
    try {
      text = await fetchText(presetUrl(row))
    } catch {
      failed += 1
      return
    }
    if (text === null) {
      skipped += 1
      await writeFile(cacheFile, 'null', 'utf8')
      return
    }
    const parsed = parsePreset(text)
    if (parsed === null) {
      skipped += 1
      await writeFile(cacheFile, 'null', 'utf8')
      return
    }
    entry = {
      n: row.name,
      s: row.source,
      f: row.form,
      p: parsed.p,
      g: parsed.g,
    }
    await writeFile(cacheFile, JSON.stringify(entry), 'utf8')
    done += 1
    if (done % 200 === 0) console.log(`fetched ${done} (${failed} failed, ${skipped} skipped)`)
  }
  presets.push(entry)
}

const queue = rows.slice()
async function worker() {
  while (queue.length > 0) {
    const row = queue.shift()
    await handle(row)
  }
}

console.log(`fetching ${rows.length} presets with concurrency ${CONCURRENCY}…`)
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

// Stable order keeps diffs readable: by name, then source.
presets.sort((a, b) => a.n.localeCompare(b.n) || a.s.localeCompare(b.s))

const payload = {
  generated: new Date().toISOString().slice(0, 10),
  source: 'AutoEQ (https://github.com/jaakkopasanen/AutoEq, MIT)',
  bands: [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000],
  presets,
}
await writeFile(DATA, JSON.stringify(payload), 'utf8')
console.log(`wrote ${presets.length} presets (${failed} failed, ${skipped} skipped) to ${DATA}`)
console.log(`size: ${(JSON.stringify(payload).length / 1024).toFixed(0)} KiB`)

