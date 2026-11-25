/**
 * Inline an HTML document's external assets so it can be shown inside a
 * sandboxed iframe without letting the page fetch anything itself.
 *
 * Only the three tags that carry rendering weight are handled — a stylesheet
 * link, a script source and an image source. Everything else (forms, frames,
 * remote XHR) stays blocked by the preview's CSP, which is the point: the
 * document may run script, but every byte it displays came through the Host.
 *
 * Two parsing hazards this file guards against, both of which silently produced
 * a wrong document when naive regexes were used:
 *
 * - `<script>`/`<style>` bodies are removed before matching. A script that
 *   writes markup (`var s = "<div>"`) otherwise opens a pseudo-tag that the
 *   *next real tag* closes, so that tag is never inlined.
 * - Attribute values are found by walking quotes, not by `[^>]*`, so a `>`
 *   inside an attribute does not end the tag early.
 */

/** One inlined resource may not exceed this many bytes. */
export const MAX_ASSET_BYTES = 2 * 1024 * 1024

/** The inlined assets of one document, summed over every occurrence, may not exceed this. */
export const MAX_TOTAL_ASSET_BYTES = 8 * 1024 * 1024

/** A remote asset fetch gives up after this long. */
export const ASSET_TIMEOUT_MS = 5000

/** Inline the same asset at most this many times, so a sprite sheet cannot multiply the document. */
export const MAX_ASSET_OCCURRENCES = 32

const DOUBLE = '"'
const SINGLE = "'"

/** Regions whose text must never be scanned for tags. */
const OPAQUE_REGION = /<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/giu

/** Every asset-bearing opening tag, with quoted attribute values allowed to contain `>`. */
const ANY_ASSET_TAG = /<(link|script|img)\b((?:"[^"]*"|'[^']*'|[^>"'])*)>/giu

function attributePattern(name) {
  return new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'iu')
}

function attributeValue(tag, name) {
  const match = attributePattern(name).exec(tag)
  if (match === null) return undefined
  return match[1] ?? match[2]
}

/** The document with script and style bodies blanked, preserving tag positions. */
function withoutOpaqueBodies(html) {
  return String(html).replace(OPAQUE_REGION, match => {
    // Keep the opening tag so an inlined <script src> is still visible to the
    // scan, but drop the body that may contain fake markup.
    const open = /^(<(?:script|style)\b[^>]*>)/iu.exec(match)
    return open === null ? '' : open[1]
  })
}

/**
 * Every asset reference in a document, in source order.
 * @param {string} html - the document.
 * @returns {Array<{ tag: 'link'|'script'|'img', url: string }>} the references.
 */
export function extractAssetRefs(html) {
  const scanText = withoutOpaqueBodies(html)
  const refs = []
  for (const match of scanText.matchAll(ANY_ASSET_TAG)) {
    const tag = match[0]
    const kind = match[1].toLowerCase()
    if (kind === 'link') {
      const rel = attributeValue(tag, 'rel') ?? ''
      if (!/\bstylesheet\b/iu.test(rel)) continue
      const url = attributeValue(tag, 'href')
      if (url !== undefined && url !== '') refs.push({ tag: 'link', url })
      continue
    }
    const url = attributeValue(tag, 'src')
    if (url !== undefined && url !== '') refs.push({ tag: kind, url })
  }
  return refs
}

/**
 * Replace one attribute's value inside one tag.
 *
 * The replacement is built by a function, never a `$1`-style template: a
 * `data:` URL is user-derived (a remote `Content-Type` reaches it) and `$&`,
 * `$'` or `` $` `` in a replacement *string* would splice the rest of the
 * document into the attribute.
 * @param {string} tag - the opening tag.
 * @param {string} name - attribute name.
 * @param {string} value - new value.
 * @returns {string} the tag with the attribute replaced.
 */
function replaceAttribute(tag, name, value) {
  const quote = new RegExp(`${name}\\s*=\\s*"`, 'iu').test(tag) ? DOUBLE : SINGLE
  const escaped = value.split(quote).join(quote === DOUBLE ? '&quot;' : '&#39;')
  return tag.replace(
    new RegExp(`(${name}\\s*=\\s*)(?:"[^"]*"|'[^']*')`, 'iu'),
    (whole, lead) => lead + quote + escaped + quote,
  )
}

/**
 * Rewrite every resolvable asset reference into a `data:` URL.
 *
 * A reference the resolver declines (too large, timed out, missing) keeps its
 * original value: the page still renders, just without that asset. The total
 * budget counts every occurrence of an inlined asset, not just the first, so a
 * page repeating one image cannot blow past it.
 * @param {string} html - the document.
 * @param {(url: string) => Promise<string | undefined>} resolve - maps a reference to a data URL.
 * @returns {Promise<string>} the document with every inlined reference.
 */
export async function inlineAssets(html, resolve) {
  const refs = extractAssetRefs(html)
  if (refs.length === 0) return html

  const occurrences = new Map()
  for (const ref of refs) occurrences.set(ref.url, (occurrences.get(ref.url) ?? 0) + 1)

  const dataUrls = new Map()
  let budget = 0
  for (const [url, count] of occurrences) {
    if (count > MAX_ASSET_OCCURRENCES) { dataUrls.set(url, undefined); continue }
    if (budget >= MAX_TOTAL_ASSET_BYTES) { dataUrls.set(url, undefined); continue }
    let dataUrl
    try {
      dataUrl = await resolve(url)
    } catch {
      dataUrl = undefined
    }
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
      dataUrls.set(url, undefined)
      continue
    }
    const cost = dataUrl.length * count
    if (budget + cost > MAX_TOTAL_ASSET_BYTES) { dataUrls.set(url, undefined); continue }
    budget += cost
    dataUrls.set(url, dataUrl)
  }

  let output = html
  for (const ref of refs) {
    const dataUrl = dataUrls.get(ref.url)
    if (dataUrl === undefined) continue
    const name = ref.tag === 'link' ? 'href' : 'src'
    const pattern = new RegExp(`<${ref.tag}\\b((?:"[^"]*"|'[^']*'|[^>"'])*)>`, 'giu')
    output = output.replace(pattern, tag =>
      attributeValue(tag, name) === ref.url ? replaceAttribute(tag, name, dataUrl) : tag)
  }
  return output
}
