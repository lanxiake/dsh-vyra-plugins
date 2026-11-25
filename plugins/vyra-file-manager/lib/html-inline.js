/**
 * Inline an HTML document's external assets so it can be shown inside a
 * sandboxed iframe without letting the page fetch anything itself.
 *
 * Only the three tags that carry rendering weight are handled — a stylesheet
 * link, a script source and an image source. Everything else (forms, frames,
 * remote XHR) stays blocked by the preview's CSP, which is the point: the
 * document may run script, but every byte it displays came through the Host.
 *
 * No DOM parser here on purpose: the Host has no DOM, and the markup being
 * touched is a preview of a local file, not an untrusted document that must be
 * fully validated.
 */

/** One inlined resource may not exceed this many bytes. */
export const MAX_ASSET_BYTES = 2 * 1024 * 1024

/** All inlined resources for one document may not exceed this many bytes. */
export const MAX_TOTAL_ASSET_BYTES = 8 * 1024 * 1024

/** A remote asset fetch gives up after this long. */
export const ASSET_TIMEOUT_MS = 5000

const DOUBLE = '"'
const SINGLE = "'"

/** The attribute pattern shared by every tag: `name="value"` or `name='value'`. */
function attributePattern(name) {
  return new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'iu')
}

const LINK_TAG = /<link\b[^>]*>/giu
const SCRIPT_TAG = /<script\b[^>]*\bsrc\s*=[^>]*>/giu
const IMG_TAG = /<img\b[^>]*>/giu
/** Every asset-bearing tag in one pass, so references come back in source order. */
const ANY_ASSET_TAG = /<(link|script|img)\b[^>]*>/giu

function attributeValue(tag, name) {
  const match = attributePattern(name).exec(tag)
  if (match === null) return undefined
  return match[1] ?? match[2]
}

/**
 * Every asset reference in a document, in source order.
 * @param {string} html - the document.
 * @returns {Array<{ tag: 'link'|'script'|'img', url: string }>} the references.
 */
export function extractAssetRefs(html) {
  const refs = []
  for (const match of String(html).matchAll(ANY_ASSET_TAG)) {
    const tag = match[0]
    const name = match[1].toLowerCase()
    if (name === 'link') {
      const rel = attributeValue(tag, 'rel') ?? ''
      if (!/\bstylesheet\b/iu.test(rel)) continue
      const url = attributeValue(tag, 'href')
      if (url !== undefined && url !== '') refs.push({ tag: 'link', url })
      continue
    }
    const url = attributeValue(tag, 'src')
    if (url !== undefined && url !== '') refs.push({ tag: name, url })
  }
  return refs
}

/** Replace the value of one attribute inside one tag, preserving the quote style. */
function replaceAttribute(tag, name, value) {
  const preferred = attributePattern(name).exec(tag)?.[1] !== undefined ? DOUBLE : SINGLE
  const quote = tag.includes(`${name}=${DOUBLE}`) || new RegExp(`${name}\\s*=\\s*"`, 'u').test(tag) ? DOUBLE : preferred
  const escaped = value.replace(new RegExp(quote, 'gu'), quote === DOUBLE ? '&quot;' : '&#39;')
  return tag.replace(
    new RegExp(`(${name}\\s*=\\s*)(?:"[^"]*"|'[^']*')`, 'iu'),
    `$1${quote}${escaped}${quote}`,
  )
}

/**
 * Rewrite every resolvable asset reference into a `data:` URL.
 *
 * A reference the resolver declines (too large, timed out, missing) keeps its
 * original value: the page still renders, just without that asset.
 * @param {string} html - the document.
 * @param {(url: string) => Promise<string | undefined>} resolve - maps a reference to a data URL.
 * @returns {Promise<string>} the document with every inlined reference.
 */
export async function inlineAssets(html, resolve) {
  const refs = extractAssetRefs(html)
  if (refs.length === 0) return html

  const replacements = new Map()
  let total = 0
  for (const ref of refs) {
    if (replacements.has(ref.url)) continue
    if (total >= MAX_TOTAL_ASSET_BYTES) {
      replacements.set(ref.url, undefined)
      continue
    }
    let dataUrl
    try {
      dataUrl = await resolve(ref.url)
    } catch {
      dataUrl = undefined
    }
    if (typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
      if (total + dataUrl.length > MAX_TOTAL_ASSET_BYTES) {
        replacements.set(ref.url, undefined)
        continue
      }
      total += dataUrl.length
      replacements.set(ref.url, dataUrl)
    } else {
      replacements.set(ref.url, undefined)
    }
  }

  let output = html
  for (const ref of refs) {
    const dataUrl = replacements.get(ref.url)
    if (dataUrl === undefined) continue
    const name = ref.tag === 'link' ? 'href' : 'src'
    const pattern = ref.tag === 'link' ? LINK_TAG : ref.tag === 'script' ? SCRIPT_TAG : IMG_TAG
    output = output.replace(pattern, tag =>
      attributeValue(tag, name) === ref.url ? replaceAttribute(tag, name, dataUrl) : tag)
  }
  return output
}
