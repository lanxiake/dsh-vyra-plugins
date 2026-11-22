#!/usr/bin/env node
/**
 * Build icu-folia's Chinese data for the plugin's Host to serve.
 *
 * Folia builds the same two payloads as Vite virtual modules (dev/icuFolia/
 * icuFoliaDataPlugin.mjs): the shape here is identical — jieba's dictionary as one
 * sorted string plus base64 varint frequencies, and the HMM tables — so the runtime
 * segmenter decodes them unchanged. They are written gzipped because the Host serves
 * them with Content-Encoding: gzip and the browser decodes them transparently.
 *
 * Usage: node scripts/build-icu-folia.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { gunzipSync, gzipSync } from 'node:zlib'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as OpenCC from 'opencc-js'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const JIEBA = join(root, 'A_other', 'upstream', 'folia-major-main', 'dev', 'icuFolia', 'jieba')
const OUT = join(root, 'src', 'host', 'assets', 'icu-folia')

const dataPath = (file) => join(JIEBA, readExists(join(JIEBA, file + '.gz')) ? file + '.gz' : file)
function readExists(path) {
  try {
    readFileSync(path)
    return true
  } catch {
    return false
  }
}
const readData = (file) => {
  const path = dataPath(file)
  const raw = readFileSync(path)
  return (path.endsWith('.gz') ? gunzipSync(raw) : raw).toString('utf8')
}

const compareCodeUnits = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

const encodeVarints = (values) => {
  const bytes = []
  for (let value of values) {
    while (value >= 0x80) {
      bytes.push((value & 0x7f) | 0x80)
      value = Math.floor(value / 0x80)
    }
    bytes.push(value)
  }
  return Buffer.from(bytes).toString('base64')
}

const readPythonTable = (file) => {
  const source = readData(file)
  return JSON.parse(source.slice(source.indexOf('{')).replace(/'/g, '"'))
}

// Same OpenCC conversion Folia's plugin runs: every character whose simplified form is
// a different single character, as "tststs..." pairs.
const buildT2sPairs = () => {
  const convert = OpenCC.Converter({ from: 't', to: 'cn' })
  let pairs = ''
  const ranges = [[0x3400, 0x4dbf], [0x4e00, 0x9fff], [0xf900, 0xfaff]]
  for (const [from, to] of ranges) {
    for (let code = from; code <= to; code += 1) {
      const char = String.fromCharCode(code)
      const simplified = convert(char)
      if (simplified !== char && simplified.length === 1) pairs += char + simplified
    }
  }
  return pairs
}

const entries = new Map()
for (const line of readData('dict.txt').split('\n')) {
  const [word, freq] = line.trim().split(' ')
  if (!word) continue
  entries.set(word, Number(freq))
}
let total = 0
entries.forEach((freq) => { total += freq })
const words = [...entries.keys()].sort(compareCodeUnits)
if (words.some((word) => word.includes('\n'))) throw new Error('jieba dict: a word contains a newline')

const emit = readPythonTable('prob_emit.py')
const emitPacked = Object.fromEntries(Object.entries(emit).map(([state, table]) => {
  const chars = Object.keys(table)
  const logs = new Float64Array(chars.map((char) => table[char]))
  return [state, [chars.join(''), Buffer.from(logs.buffer).toString('base64')]]
}))

const dict = {
  words: words.join('\n'),
  freqs: encodeVarints(words.map((word) => entries.get(word))),
  total,
}
const hmm = {
  start: readPythonTable('prob_start.py'),
  trans: readPythonTable('prob_trans.py'),
  emit: emitPacked,
  t2s: buildT2sPairs(),
}

mkdirSync(OUT, { recursive: true })
for (const [name, payload] of [['dict', dict], ['hmm', hmm]]) {
  const json = JSON.stringify(payload)
  const gz = gzipSync(Buffer.from(json, 'utf8'), { level: 9 })
  writeFileSync(join(OUT, name + '.json.gz'), gz)
  console.log(name + '.json.gz', (gz.length / 1024 / 1024).toFixed(2) + 'MB (json ' + (json.length / 1024 / 1024).toFixed(2) + 'MB)')
}
console.log('icu-folia data written to', OUT.replace(root + '\\', ''))


