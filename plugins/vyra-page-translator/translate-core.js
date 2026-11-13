// translate-core.js: Host pure logic for page-translator (simplified)
export class LruCache {
  constructor(max) {
    this.max = max
    this.map = new Map()
  }
  get(k) {
    if (!this.map.has(k)) return undefined
    const v = this.map.get(k)
    this.map.delete(k)
    this.map.set(k, v)
    return v
  }
  set(k, v) {
    if (this.map.has(k)) this.map.delete(k)
    this.map.set(k, v)
    if (this.map.size > this.max) {
      const first = this.map.keys().next().value
      this.map.delete(first)
    }
  }
  get size() {
    return this.map.size
  }
}

export function batchIndices(lengths, maxChars, maxItems) {
  const batches = []
  let batch = []
  let sum = 0
  for (let i = 0; i < lengths.length; i++) {
    const len = lengths[i]
    if (len > maxChars || (batch.length > 0 && (sum + len > maxChars || batch.length >= maxItems))) {
      if (batch.length > 0) batches.push(batch)
      batch = []
      sum = 0
    }
    batch.push(i)
    sum += len
  }
  if (batch.length > 0) batches.push(batch)
  return batches
}

export function splitLong(text, maxChars) {
  if (text.length <= maxChars) return [text]
  const parts = []
  const breaks = /[.!?\n]/g
  let lastEnd = 0
  let m
  while ((m = breaks.exec(text))) {
    const seg = text.slice(lastEnd, m.index + 1)
    if (seg.length <= maxChars) {
      parts.push(seg)
      lastEnd = m.index + 1
    } else {
      let pos = lastEnd
      while (pos < m.index + 1) {
        parts.push(text.slice(pos, pos + maxChars))
        pos += maxChars
      }
      lastEnd = pos
    }
  }
  if (lastEnd < text.length) {
    let pos = lastEnd
    while (pos < text.length) {
      parts.push(text.slice(pos, pos + maxChars))
      pos += maxChars
    }
  }
  return parts
}

export function parseLlmArray(raw, expected) {
  let text = raw.trim()
  if (text.startsWith('```')) {
    const lines = text.split('\n')
    text = lines.slice(1, -1).join('\n')
  }
  try {
    const arr = JSON.parse(text)
    if (!Array.isArray(arr)) return null
    if (arr.length !== expected) return null
    if (!arr.every(x => typeof x === 'string')) return null
    return arr
  } catch {
    return null
  }
}

export function buildLlmPrompt(target) {
  return `Translate each string in the JSON array to ${target}. Preserve array length and order. Output ONLY the JSON array, no markdown fences, no explanations. Do not translate code, URLs, or placeholders.`
}

export const LANGUAGES = [
  { code: 'zh-Hans', name: '简体中文' },
  { code: 'zh-Hant', name: '繁體中文' },
  { code: 'en', name: 'English' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'ru', name: 'Русский' },
  { code: 'pt', name: 'Português' },
  { code: 'it', name: 'Italiano' },
  { code: 'ar', name: 'العربية' },
]

export const MT_SEPARATOR = '\n§§§\n'

export function createTranslateService(deps) {
  const { translator, llm, agentDefaultModel, cacheSize = 5000 } = deps
  const cache = new LruCache(cacheSize)
  const MAX_CONCURRENT = 3
  let running = 0
  const queue = []

  async function withLimit(fn) {
    while (running >= MAX_CONCURRENT) {
      await new Promise(res => queue.push(res))
    }
    running++
    try {
      return await fn()
    } finally {
      running--
      if (queue.length > 0) queue.shift()()
    }
  }

  async function translateMT(texts, target, source, provider, signal) {
    if (signal?.aborted) throw new Error('Aborted')
    const spec = translator.resolve({ text: '', targetLanguage: target, sourceLanguage: source, provider })
    const maxChars = spec.maxTextChars || 1000
    const lengths = texts.map(t => t.trim().length)
    const batches = batchIndices(lengths, Math.max(1, maxChars - MT_SEPARATOR.length * 10), 100)
    const results = new Array(texts.length)

    for (const batch of batches) {
      await withLimit(async () => {
        if (signal?.aborted) throw new Error('Aborted')
        const batchTexts = batch.map(i => texts[i])
        if (batch.length === 1) {
          const text = batchTexts[0]
          const core = text.trim()
          if (core.length > maxChars) {
            const parts = splitLong(core, maxChars)
            const translated = []
            for (const part of parts) {
              const t = await translator.translate({ ...spec, text: part }, signal)
              translated.push(t)
            }
            results[batch[0]] = text.replace(core, translated.join(''))
          } else {
            const t = await translator.translate({ ...spec, text: core }, signal)
            results[batch[0]] = text.replace(core, t)
          }
        } else {
          const combined = batchTexts.map(t => t.trim()).join(MT_SEPARATOR)
          const translated = await translator.translate({ ...spec, text: combined }, signal)
          const parts = translated.split(MT_SEPARATOR)
          if (parts.length === batchTexts.length) {
            batchTexts.forEach((text, i) => {
              results[batch[i]] = text.replace(text.trim(), parts[i])
            })
          } else {
            for (let i = 0; i < batchTexts.length; i++) {
              const text = batchTexts[i]
              const core = text.trim()
              const t = await translator.translate({ ...spec, text: core }, signal)
              results[batch[i]] = text.replace(core, t)
            }
          }
        }
      })
    }
    return results
  }

  async function translateLLM(texts, target, source, signal) {
    if (signal?.aborted) throw new Error('Aborted')
    const { provider, model } = agentDefaultModel.currentSelection()
    const results = new Array(texts.length)

    async function batch(items, indices) {
      if (items.length === 0) return
      if (items.length === 1) {
        const prompt = buildLlmPrompt(target)
        let accumulated = ''
        for await (const chunk of llm.stream({
          provider,
          model,
          system: prompt,
          messages: [{ role: 'user', content: [{ type: 'text', text: JSON.stringify([items[0].trim()]) }] }],
          signal,
        })) {
          if (chunk.type === 'text-delta') accumulated += chunk.text
          if (chunk.type === 'finish') {
            if (chunk.reason.kind === 'error') throw new Error('LLM error')
          }
        }
        const parsed = parseLlmArray(accumulated, 1)
        if (parsed) results[indices[0]] = items[0].replace(items[0].trim(), parsed[0])
        else throw new Error('LLM parse failed')
        return
      }

      const prompt = buildLlmPrompt(target)
      let accumulated = ''
      for await (const chunk of llm.stream({
        provider,
        model,
        system: prompt,
        messages: [{ role: 'user', content: [{ type: 'text', text: JSON.stringify(items.map(t => t.trim())) }] }],
        signal,
      })) {
        if (chunk.type === 'text-delta') accumulated += chunk.text
        if (chunk.type === 'finish') {
          if (chunk.reason.kind === 'error') throw new Error('LLM error')
        }
      }
      const parsed = parseLlmArray(accumulated, items.length)
      if (parsed) {
        items.forEach((text, i) => {
          results[indices[i]] = text.replace(text.trim(), parsed[i])
        })
      } else {
        const mid = Math.floor(items.length / 2)
        await batch(items.slice(0, mid), indices.slice(0, mid))
        await batch(items.slice(mid), indices.slice(mid))
      }
    }

    const batches = []
    let current = []
    let currentIndices = []
    let chars = 0
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i]
      if (chars + text.length > 3000 && current.length > 0) {
        batches.push({ items: current, indices: currentIndices })
        current = []
        currentIndices = []
        chars = 0
      }
      current.push(text)
      currentIndices.push(i)
      chars += text.length
    }
    if (current.length > 0) batches.push({ items: current, indices: currentIndices })

    for (const b of batches) {
      await withLimit(() => batch(b.items, b.indices))
    }

    return results
  }

  return {
    async providers() {
      const list = []
      if (translator) {
        list.push({ id: 'bing', name: 'Bing', costsTokens: false, available: true })
        list.push({ id: 'google', name: 'Google', costsTokens: false, available: true })
      }
      if (llm && agentDefaultModel) {
        list.push({ id: 'llm', name: 'LLM (consumes tokens)', costsTokens: true, available: true })
      }
      return list
    },
    async translate(req, signal) {
      if (req.texts.length === 0) return []
      const { texts, target, source = 'auto', provider } = req
      const cacheKey = (t) => `${provider}|${source}|${target}|${t.trim()}`
      
      // dedup
      const seen = new Map()
      const unique = []
      const originalIndices = []
      texts.forEach((t, i) => {
        if (!seen.has(t)) {
          seen.set(t, unique.length)
          unique.push(t)
        }
        originalIndices.push(seen.get(t))
      })

      // check cache
      const uncachedIndices = []
      const uncached = []
      unique.forEach((t, i) => {
        const k = cacheKey(t)
        if (!cache.get(k)) {
          uncached.push(t)
          uncachedIndices.push(i)
        }
      })

      if (uncached.length > 0) {
        let translated
        if (provider === 'llm') {
          translated = await translateLLM(uncached, target, source, signal)
        } else {
          translated = await translateMT(uncached, target, source, provider, signal)
        }
        uncachedIndices.forEach((uniqueIdx, i) => {
          cache.set(cacheKey(unique[uniqueIdx]), translated[i])
        })
      }

      return texts.map(t => cache.get(cacheKey(t)))
    },
  }
}
