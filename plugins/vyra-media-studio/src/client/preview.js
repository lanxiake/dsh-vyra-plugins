/** Rich preview surfaces: Markdown, highlighted code, JSON, CSV and sandboxed HTML. */
import React, { useEffect, useMemo, useState } from 'react'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import c from 'highlight.js/lib/languages/c'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import css from 'highlight.js/lib/languages/css'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import go from 'highlight.js/lib/languages/go'
import ini from 'highlight.js/lib/languages/ini'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import kotlin from 'highlight.js/lib/languages/kotlin'
import less from 'highlight.js/lib/languages/less'
import lua from 'highlight.js/lib/languages/lua'
import markdown from 'highlight.js/lib/languages/markdown'
import php from 'highlight.js/lib/languages/php'
import plaintext from 'highlight.js/lib/languages/plaintext'
import python from 'highlight.js/lib/languages/python'
import ruby from 'highlight.js/lib/languages/ruby'
import rust from 'highlight.js/lib/languages/rust'
import scss from 'highlight.js/lib/languages/scss'
import sql from 'highlight.js/lib/languages/sql'
import swift from 'highlight.js/lib/languages/swift'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'
import { apiUrl, extensionOf, folderOf, isTextExtension } from './helpers.js'
import { Icon } from './icons.js'

const h = React.createElement
const TEXT_CACHE = new Map()
const LANGUAGE_BY_EXT = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
  ts: 'typescript', tsx: 'typescript', mts: 'typescript', cts: 'typescript',
  json: 'json', jsonc: 'json',
  py: 'python', sh: 'bash', bash: 'bash', zsh: 'bash',
  html: 'xml', htm: 'xml', xml: 'xml', svg: 'xml',
  css: 'css', scss: 'scss', less: 'less',
  md: 'markdown', markdown: 'markdown', mdx: 'markdown',
  yaml: 'yaml', yml: 'yaml', toml: 'ini', ini: 'ini', conf: 'ini', properties: 'ini',
  sql: 'sql', java: 'java', kt: 'kotlin', swift: 'swift',
  c: 'c', h: 'c', cc: 'cpp', cpp: 'cpp', hpp: 'cpp', cs: 'csharp',
  go: 'go', rs: 'rust', rb: 'ruby', php: 'php', lua: 'lua',
  dockerfile: 'dockerfile', makefile: 'bash',
}

for (const [name, language] of Object.entries({
  bash, c, cpp, csharp, css, dockerfile, go, ini, java, javascript, json,
  kotlin, less, lua, markdown, php, plaintext, python, ruby, rust, scss,
  sql, swift, typescript, xml, yaml,
})) hljs.registerLanguage(name, language)

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/gu, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char])
}

function languageFor(ext) {
  return LANGUAGE_BY_EXT[String(ext ?? '').toLowerCase()]
}

function highlight(code, ext) {
  const language = languageFor(ext)
  if (language !== undefined && hljs.getLanguage(language) !== undefined) {
    try {
      return { html: hljs.highlight(code, { language, ignoreIllegals: true }).value, language }
    } catch { /* fall through to escaped text */ }
  }
  return { html: escapeHtml(code), language: 'text' }
}

/** Normalize a Markdown-relative path; undefined when it escapes the workspace. */
function normalizeRelative(folder, source) {
  if (/^[a-z][a-z0-9+.-]*:/iu.test(source) || source.startsWith('//') || source.startsWith('#')) return undefined
  const parts = []
  const combined = source.startsWith('/') ? source.slice(1) : `${folder}/${source}`
  for (const segment of combined.split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') {
      if (parts.length === 0) return undefined
      parts.pop()
      continue
    }
    parts.push(segment)
  }
  return parts.length === 0 ? undefined : parts.join('/')
}

function markdownRenderer(sessionId) {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: false,
    highlight: (code, lang) => {
      const known = typeof lang === 'string' && hljs.getLanguage(lang) !== undefined
      const html = known
        ? hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
        : escapeHtml(code)
      return `<pre class="hljs"><code>${html}</code></pre>`
    },
  })
  const defaultImage = md.renderer.rules.image
  md.renderer.rules.image = (tokens, index, options, env, self) => {
    const token = tokens[index]
    const source = token.attrGet('src')
    if (typeof source === 'string') {
      const relative = normalizeRelative(env.folder ?? '', source)
      if (relative !== undefined) {
        token.attrSet('src', apiUrl('api/vyra-media/file', { sessionId, path: relative }))
      }
    }
    return defaultImage === undefined
      ? self.renderToken(tokens, index, options)
      : defaultImage(tokens, index, options, env, self)
  }
  const linkOpen = md.renderer.rules.link_open
  md.renderer.rules.link_open = (tokens, index, options, env, self) => {
    const href = tokens[index].attrGet('href')
    if (typeof href === 'string' && /^https?:/iu.test(href)) {
      tokens[index].attrSet('target', '_blank')
      tokens[index].attrSet('rel', 'noreferrer noopener')
    }
    return linkOpen === undefined
      ? self.renderToken(tokens, index, options)
      : linkOpen(tokens, index, options, env, self)
  }
  return md
}

function useText(key, url) {
  const cached = TEXT_CACHE.get(key)
  const [state, setState] = useState(cached ?? { loading: true, text: '', truncated: false, failed: false })
  useEffect(() => {
    const hit = TEXT_CACHE.get(key)
    if (hit !== undefined) { setState(hit); return undefined }
    const controller = new AbortController()
    setState({ loading: true, text: '', truncated: false, failed: false })
    fetch(url, { signal: controller.signal, credentials: 'same-origin' })
      .then(async response => {
        let body
        try { body = await response.json() } catch { body = undefined }
        if (!response.ok || body?.ok !== true) throw new Error(body?.error ?? `HTTP ${response.status}`)
        return body
      })
      .then(body => {
        const entry = {
          loading: false,
          text: body.text ?? '',
          truncated: body.truncated === true,
          size: body.size,
          failed: false,
        }
        TEXT_CACHE.set(key, entry)
        setState(entry)
      })
      .catch(error => {
        if (error?.name === 'AbortError') return
        const entry = { loading: false, text: '', truncated: false, failed: true }
        TEXT_CACHE.set(key, entry)
        setState(entry)
      })
    return () => controller.abort()
  }, [key, url])
  return state
}

function ModeToggle({ mode, onChange, renderLabel = '预览', sourceLabel = '源码' }) {
  return h('div', { className: 'vms-preview-modes' },
    h('button', { type: 'button', className: mode === 'render' ? 'is-active' : '', onClick: () => onChange('render') }, renderLabel),
    h('button', { type: 'button', className: mode === 'source' ? 'is-active' : '', onClick: () => onChange('source') }, sourceLabel))
}

export function CodeView({ text, ext }) {
  const { html, language } = useMemo(() => highlight(text, ext), [text, ext])
  return h('div', { className: 'vms-code-view' },
    h('div', { className: 'vms-code-head' }, h('span', null, language), h('span', null, `${text.length.toLocaleString()} chars`)),
    h('pre', { className: 'vms-code-content hljs' }, h('code', { dangerouslySetInnerHTML: { __html: html } })))
}

export function MarkdownView({ text, sessionId, folder, ext }) {
  const [mode, setMode] = useState('render')
  const md = useMemo(() => markdownRenderer(sessionId), [sessionId])
  const html = useMemo(() => md.render(text, { folder }), [md, text, folder])
  if (mode === 'source') {
    return h('div', { className: 'vms-rich-view' },
      h(ModeToggle, { mode, onChange: setMode }),
      h(CodeView, { text, ext }))
  }
  return h('div', { className: 'vms-rich-view' },
    h(ModeToggle, { mode, onChange: setMode }),
    h('div', { className: 'vms-markdown', dangerouslySetInnerHTML: { __html: html } }))
}

export function HtmlView({ text }) {
  const [mode, setMode] = useState('render')
  const document = useMemo(() => {
    const csp = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data: blob:; font-src data:;">'
    if (/<head[\s>]/iu.test(text)) return text.replace(/<head([^>]*)>/iu, `<head$1>${csp}`)
    if (/<html[\s>]/iu.test(text)) return text.replace(/<html([^>]*)>/iu, `<html$1><head>${csp}</head>`)
    return `<!doctype html><html><head>${csp}</head><body>${text}</body></html>`
  }, [text])
  if (mode === 'source') {
    return h('div', { className: 'vms-rich-view' },
      h(ModeToggle, { mode, onChange: setMode }),
      h(CodeView, { text, ext: 'html' }))
  }
  return h('div', { className: 'vms-rich-view' },
    h(ModeToggle, { mode, onChange: setMode }),
    h('iframe', {
      className: 'vms-html-frame',
      sandbox: '',
      srcDoc: document,
      title: 'HTML 预览',
      referrerPolicy: 'no-referrer',
    }))
}

function parseDelimited(text, delimiter, maxRows = 500, maxCols = 30) {
  const rows = [[]]
  let cell = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index += 1 }
      else if (char === '"') quoted = false
      else cell += char
      continue
    }
    if (char === '"') { quoted = true; continue }
    if (char === delimiter) { rows[rows.length - 1].push(cell); cell = ''; continue }
    if (char === '\n') {
      rows[rows.length - 1].push(cell)
      cell = ''
      if (rows.length >= maxRows) break
      rows.push([])
      continue
    }
    if (char !== '\r') cell += char
  }
  if (cell !== '' || rows[rows.length - 1].length > 0) rows[rows.length - 1].push(cell)
  return rows.filter(row => row.length > 0 && !(row.length === 1 && row[0] === '')).slice(0, maxRows).map(row => row.slice(0, maxCols))
}

export function CsvView({ text, ext }) {
  const [mode, setMode] = useState('render')
  const rows = useMemo(() => parseDelimited(text, ext === 'tsv' ? '\t' : ','), [text, ext])
  if (mode === 'source') {
    return h('div', { className: 'vms-rich-view' },
      h(ModeToggle, { mode, onChange: setMode }),
      h(CodeView, { text, ext }))
  }
  const [head, ...body] = rows
  return h('div', { className: 'vms-rich-view' },
    h(ModeToggle, { mode, onChange: setMode }),
    h('div', { className: 'vms-table-wrap' },
      h('table', { className: 'vms-table' },
        head !== undefined && h('thead', null, h('tr', null, head.map((cell, index) => h('th', { key: index }, cell)))),
        h('tbody', null, body.map((row, rowIndex) => h('tr', { key: rowIndex },
          row.map((cell, index) => h('td', { key: index }, cell))))))))
}

function JsonView({ text, ext }) {
  const pretty = useMemo(() => {
    try { return JSON.stringify(JSON.parse(text), null, 2) } catch { return text }
  }, [text])
  return h(CodeView, { text: pretty, ext: ext === 'jsonc' ? 'json' : ext })
}

function TextView({ text, ext }) {
  return h(CodeView, { text, ext })
}

/**
 * The rich preview body for any text-like file.
 * @param {object} props - item/session identity.
 */
export function RichTextPreview({ item, sessionId }) {
  const key = `preview:${sessionId}:${item.relativePath}`
  const url = apiUrl('api/vyra-media/text', { sessionId, path: item.relativePath, maxBytes: 1024 * 1024 })
  const state = useText(key, url)
  const ext = extensionOf(item.relativePath)

  if (state.failed) {
    return h('div', { className: 'vms-preview-note' }, h(Icon, { name: 'alert', size: 17 }), '文本读取失败')
  }
  if (state.loading) return h('div', { className: 'vms-preview-note' }, '读取中…')

  const view = (() => {
    if (['md', 'markdown', 'mdx'].includes(ext)) {
      return h(MarkdownView, { text: state.text, sessionId, folder: folderOf(item), ext })
    }
    if (['html', 'htm'].includes(ext)) return h(HtmlView, { text: state.text })
    if (['csv', 'tsv'].includes(ext)) return h(CsvView, { text: state.text, ext })
    if (['json', 'jsonc'].includes(ext)) return h(JsonView, { text: state.text, ext })
    if (isTextExtension(ext)) return h(TextView, { text: state.text, ext })
    return h(TextView, { text: state.text, ext })
  })()

  return h('div', { className: 'vms-text-view' },
    state.truncated && h('div', { className: 'vms-preview-note' }, '文件较大，只显示前 1 MB。'),
    view)
}
