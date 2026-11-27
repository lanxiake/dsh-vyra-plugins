/**
 * Follow a module entry's *relative* static imports and report any that do not
 * resolve.
 *
 * Written after `dsh-vyra-dsh-console` 0.1.2 shipped with `files` missing
 * `tool.js` and `domains/`: `index.js` imported them, the tarball did not carry
 * them, and the host half failed with ERR_MODULE_NOT_FOUND on every
 * installation while `check-installable` — which only asked whether the entry
 * file itself existed — stayed green.
 *
 * Bare specifiers are deliberately NOT followed: they belong to the consumer's
 * `node_modules`, and a repository checkout cannot vouch for what a profile
 * will resolve them to.
 *
 * @module dsh-vyra-plugins/check-imports
 */

import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

/**
 * `import … from './x'`, `export … from './x'`, and a side-effect
 * `import './x'`. Anchored so `foo.import('./x')` and a string that merely
 * contains the word do not match.
 */
const STATIC_IMPORT = /(?:^|[\s;}])(?:import|export)\s*(?:[^'"]*?\bfrom\s*)?['"]([^'"]+)['"]/gmu

/** A literal dynamic import, which resolves the same relative way. */
const DYNAMIC_IMPORT = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/gu

/**
 * Whether a `/` at this position starts a regular-expression literal rather
 * than a division. The standard heuristic: a regex may follow an operator,
 * an opening bracket, a comma, a colon or the start of input, but never a
 * value. Without this, an apostrophe inside `/'/` opens a bogus string and
 * every later comment is mis-tracked — which is exactly how a JSDoc example in
 * a bundled vendor file survived the first version of this comment stripper.
 */
function regexAllowedAfter(previous) {
  if (previous === '') return true
  return '(,=:[!&|?{};+-*%<>~^'.includes(previous)
}

/**
 * Blank out comments, and report where the string, template and regex literals
 * sit.
 *
 * Comments go so a documented example (`// import './MyComponent'`) cannot be
 * mistaken for a real edge — bundled vendor files are full of such examples.
 * The literals themselves are KEPT, because an import's specifier is one.
 *
 * The literal spans are what separates code from text that only looks like it.
 * `dsh-remotion`'s `media-templates.js` builds a project's `src/index.jsx` as a
 * template string, and that generated text contains `import data from
 * '../data.json'`: a file it writes INTO a user's project, never a module this
 * package loads. Matching on the specifier alone cannot tell the two apart —
 * both are string literals — so the test is positional: an `import` keyword is
 * code only when it does not sit inside another literal.
 *
 * @param text - module source.
 * @returns the source with every comment blanked (offsets and line numbers
 *   unchanged), and the `[start, end)` spans of its literals.
 */
function scan(text) {
  let out = ''
  let index = 0
  let quote = undefined
  let inCharacterClass = false
  let previousSignificant = ''
  /** Where the currently open literal began; `-1` while in code. */
  let literalStart = -1
  /** `[start, end)` for every literal closed so far. */
  const literalSpans = []
  while (index < text.length) {
    const char = text[index]
    const next = text[index + 1]
    if (quote !== undefined) {
      out += char
      if (char === '\\') {
        out += next ?? ''
        index += 2
        continue
      }
      if (quote === '/' && char === '[') inCharacterClass = true
      else if (quote === '/' && char === ']') inCharacterClass = false
      else if (char === quote && !(quote === '/' && inCharacterClass)) {
        quote = undefined
        literalSpans.push([literalStart, index + 1])
        literalStart = -1
      }
      if (quote === undefined) previousSignificant = 'value'
      index += 1
      continue
    }
    if (char === '/' && next === '/') {
      while (index < text.length && text[index] !== '\n') {
        out += ' '
        index += 1
      }
      continue
    }
    if (char === '/' && next === '*') {
      while (index < text.length && !(text[index] === '*' && text[index + 1] === '/')) {
        out += text[index] === '\n' ? '\n' : ' '
        index += 1
      }
      out += '  '
      index += 2
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char
      inCharacterClass = false
      literalStart = index
    } else if (char === '/' && regexAllowedAfter(previousSignificant)) {
      quote = '/'
      inCharacterClass = false
      literalStart = index
    } else if (!/\s/u.test(char)) {
      previousSignificant = char
    }
    out += char
    index += 1
  }
  // An unterminated literal (truncated source) still owns everything to the end.
  if (literalStart !== -1) literalSpans.push([literalStart, text.length])
  return { blanked: out, literalSpans }
}

/**
 * Blank out comments while leaving string, template and regex literals intact.
 *
 * @param text - module source.
 * @returns the same text with every comment replaced by spaces, so offsets and
 *   line numbers still match the original.
 */
function withoutComments(text) {
  return scan(text).blanked
}

/**
 * A file whose longest line exceeds this is a minified artefact, not source.
 *
 * Lexing those cannot be done reliably without a real parser: `dsh-im`'s
 * shipped index.js is one 2.2 MB line of esbuild output, and a template
 * literal inside it contains a *documented* dynamic import that is exempt at
 * run time. Reporting that as a missing module would be a false positive, and a
 * gate that cries wolf gets switched off. Source modules — every plugin's
 * `index.js`, `client.js`, `domains/*` — are far under this.
 */
const MAX_SOURCE_LINE = 4000

/** Whether a file's shape marks it as minified rather than written source. */
function isMinified(text) {
  let longest = 0
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== '\n') {
      longest += 1
      if (longest > MAX_SOURCE_LINE) return true
    } else {
      longest = 0
    }
  }
  return false
}

/**
 * Whether a match is text inside a literal rather than code that imports.
 *
 * The `import` keyword of a real statement sits in code; the same word inside a
 * template that GENERATES another file's source does not. Its specifier is a
 * literal either way, so the distinction is drawn on the keyword's position —
 * that is the only thing that differs.
 *
 * @param spans - literal spans from `scan`, ascending and non-overlapping.
 * @param position - index of the `import`/`export` keyword.
 * @returns whether the keyword sits inside one of the literals.
 */
function insideLiteral(spans, position) {
  let low = 0
  let high = spans.length - 1
  while (low <= high) {
    const middle = (low + high) >> 1
    const [start, end] = spans[middle]
    if (position < start) high = middle - 1
    else if (position >= end) low = middle + 1
    else return true
  }
  return false
}

/**
 * Every literal module specifier in one file's text, in source order.
 * @param text - module source.
 * @returns the specifiers, including bare ones.
 */
export function staticImportsOf(text) {
  if (isMinified(text)) return []
  const { blanked: source, literalSpans } = scan(text)
  const found = []
  for (const match of source.matchAll(STATIC_IMPORT)) {
    if (!insideLiteral(literalSpans, match.index)) found.push(match[1])
  }
  for (const match of source.matchAll(DYNAMIC_IMPORT)) {
    if (!insideLiteral(literalSpans, match.index)) found.push(match[1])
  }
  // A `.d.ts` specifier is erased at run time; it never has to resolve in a
  // shipped tarball, so it is not an edge this check can fail on.
  return [...new Set(found)].filter((specifier) => !specifier.endsWith('.d.ts'))
}

/**
 * Resolve one relative specifier against its importer the way Node does for
 * this repository's plain-ESM plugins: the exact path, then `.js`/`.mjs`, then
 * a directory index.
 * @param fromFile - absolute path of the importer.
 * @param specifier - a `./…` or `../…` specifier.
 * @returns the resolved file, or `undefined`.
 */
function resolveRelative(fromFile, specifier) {
  const base = resolve(dirname(fromFile), specifier)
  for (const candidate of [base, `${base}.js`, `${base}.mjs`, join(base, 'index.js')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return undefined
}

/**
 * Every file reachable from `entry` through relative imports, entry included,
 * as paths relative to `packageRoot` with forward slashes.
 *
 * This is the set `files` must publish. Existence on disk is not the question
 * the shipper got wrong: the modules were there and the tarball did not carry
 * them.
 *
 * @param entry - absolute path of the entry module.
 * @param packageRoot - absolute path of the package directory.
 * @returns package-relative module paths, sorted.
 */
export function reachableModules(entry, packageRoot) {
  const out = new Set()
  const seen = new Set()
  const queue = [resolve(entry)]
  while (queue.length > 0) {
    const file = queue.shift()
    if (seen.has(file)) continue
    seen.add(file)
    out.add(relative(packageRoot, file).replaceAll('\\', '/'))
    let text
    try {
      text = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    for (const specifier of staticImportsOf(text)) {
      if (!specifier.startsWith('.')) continue
      const hit = resolveRelative(file, specifier)
      if (hit !== undefined && !seen.has(hit)) queue.push(hit)
    }
  }
  return [...out].sort()
}

/**
 * Whether one `files` entry publishes a package-relative path.
 *
 * Follows npm's `files` semantics for the forms this repository uses:
 *
 *   - a bare directory name publishes everything under it (`domains`, `lib`);
 *   - a trailing slash is ignored;
 *   - `*` matches within one path segment (`domains/*.js`);
 *   - `**` matches across segments (`lib/**`).
 *
 * @param entry - one `files` value.
 * @param rel - package-relative path with forward slashes.
 * @returns whether the entry covers the path.
 */
export function coveredByFiles(entry, rel) {
  const pattern = String(entry).replace(/\/+$/u, '')
  if (pattern === '') return false
  // A plain directory name publishes its whole subtree.
  if (rel === pattern || rel.startsWith(`${pattern}/`)) return true
  if (!pattern.includes('*')) return false

  const regex = new RegExp(`^${globToRegExpSource(pattern)}$`, 'u')
  return regex.test(rel)
}

/**
 * Translate a `files` glob into a regular expression source.
 *
 * `**` matches any number of path segments — including zero, which is the part
 * that matters: npm's glob for "every .js under lib" publishes `lib/index.js`
 * as well as `lib/ocr/read.js`. Treating a `**` segment as `.*` alone would
 * require the extra slash and wrongly report the package's own entry as
 * unpublished.
 */
function globToRegExpSource(pattern) {
  const segments = pattern.split('/')
  let source = ''
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]
    const last = index === segments.length - 1
    if (segment === '**') {
      source += last ? '.*' : '(?:[^/]+/)*'
      continue
    }
    source += segment.split('*').map(escapeRegExp).join('[^/]*')
    if (!last) source += '/'
  }
  return source
}

/** Escape a literal for use inside a RegExp. */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

/**
 * Modules reachable from `entry` that the manifest's `files` list does not
 * publish — the exact defect 0.1.2 shipped.
 *
 * @param entry - absolute path of the entry module.
 * @param packageRoot - absolute path of the package directory.
 * @param files - the manifest's `files` array.
 * @returns package-relative module paths no `files` entry covers.
 */
export function unshippedModules(entry, packageRoot, files) {
  const list = Array.isArray(files) ? files : []
  return reachableModules(entry, packageRoot)
    .filter((rel) => !list.some((entryPattern) => coveredByFiles(entryPattern, rel)))
}

/**
 * Every relative import reachable from `entry` that does not resolve.
 *
 * Traversal is breadth-first over resolved files only, so a cycle is visited
 * once and a missing file is reported at the edge that needed it — which names
 * the file whose `files` entry is wrong, not merely that something is absent.
 *
 * @param entry - absolute path of the entry module.
 * @returns `{ from, specifier }` for each unresolvable edge; empty when clean.
 */
export function unresolvableImports(entry) {
  const missing = []
  const seen = new Set()
  const queue = [resolve(entry)]
  while (queue.length > 0) {
    const file = queue.shift()
    if (seen.has(file)) continue
    seen.add(file)
    let text
    try {
      text = readFileSync(file, 'utf8')
    } catch {
      // An unreadable file is a different failure; the caller's existence check
      // owns it, and reporting it here would blame the wrong import edge.
      continue
    }
    for (const specifier of staticImportsOf(text)) {
      if (!specifier.startsWith('.')) continue
      const hit = resolveRelative(file, specifier)
      if (hit === undefined) missing.push({ from: file, specifier })
      else if (!seen.has(hit)) queue.push(hit)
    }
  }
  return missing
}
