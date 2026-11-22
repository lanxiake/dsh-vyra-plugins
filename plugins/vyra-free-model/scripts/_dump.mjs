import { readFileSync } from 'node:fs'

const html = readFileSync(new URL('../.preview.html', import.meta.url), 'utf8')
const bodyStart = html.indexOf('<body>')
const body = html.slice(bodyStart, bodyStart + 1200)
console.log(JSON.stringify(body, null, 1).slice(0, 1400))
