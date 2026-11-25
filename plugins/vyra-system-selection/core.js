// Pure logic for the system selection plugin: no FFI, no DOM, no timers.
// Everything here is a plain function so the decision rules and layout math stay testable
// without a desktop session.

/** Longest selection we will send to a model. Over this we refuse rather than truncate:
 *  a truncated translation is wrong in a way that is harder to notice than an error. */
export const MAX_TEXT_CHARS = 4000

/** Pixels the pointer must travel between press and release to count as a drag selection. */
export const DRAG_PX = 4
/** Two releases within this window at nearly the same spot count as a multi-click selection. */
export const MULTI_CLICK_MS = 500
/** How far a click may drift and still count as the same multi-click point. */
export const MULTI_CLICK_PX = 6

/**
 * The right-click menu, in order.
 *
 * `icon` is a Segoe Fluent Icons / MDL2 codepoint; the glyph is drawn from the icon font, not an
 * asset, so there is nothing to ship and nothing to scale.
 */
export const ACTIONS = [
  { id: 'translate', label: '翻译', kind: 'llm', icon: 0xE774 },
  // Copy sits second because it is the most used action; summarize is the least.
  { id: 'copy', label: '复制', kind: 'local', icon: 0xE8C8 },
  { id: 'explain', label: '解释', kind: 'llm', icon: 0xEA80 },
  { id: 'summarize', label: '总结', kind: 'llm', icon: 0xE8A5 },
]

/**
 * Whether a synthetic copy may be sent right now.
 *
 * `captureSelection` presses Ctrl+C through `SendInput`. If the user is holding a modifier at that
 * moment — which is exactly what they are doing while pressing Ctrl+C or Ctrl+V themselves — the
 * injected chord interleaves with the real one: the injected Ctrl-up ends the user's chord early,
 * and the restore that follows puts the *previous* clipboard back on top of the copy they just
 * made. That reads as "copy and paste stopped working", in every application at once.
 *
 * So any held modifier vetoes the capture. A missed capture costs one menu that does not open; a
 * corrupted chord costs the user the text they were carrying.
 */
export function maySynthesizeCopy(held = {}) {
  return !held.control && !held.alt && !held.shift && !held.win
}

export function findAction(id) {
  return ACTIONS.find((a) => a.id === id) ?? null
}

/** Navigator and editing keys that mean "I am working in the document now", not "pick an action". */
const DISMISSING_KEYS = new Set([
  0x08, // Backspace
  0x09, // Tab
  0x0d, // Enter
  0x21, // PageUp
  0x22, // PageDown
  0x23, // End
  0x24, // Home
  0x25, // Left
  0x26, // Up
  0x27, // Right
  0x28, // Down
  0x2d, // Insert
  0x2e, // Delete
])

/** Numpad operators: a keypad `+` or `.` is typing, not navigation. */
const NUMPAD_OPERATORS = new Set([0x6a, 0x6b, 0x6d, 0x6e, 0x6f])
/** Function keys run the application's own commands; they never type into the selection. */
const FUNCTION_KEY = (vk) => vk >= 0x70 && vk <= 0x87
/** Lock toggles change nothing in the document. */
const LOCK_KEYS = new Set([0x90, 0x91, 0x14]) // NumLock, ScrollLock, CapsLock

/**
 * Whether a key press means the selection menu is no longer wanted.
 *
 * The popup never takes focus, so it cannot see the keyboard at all: a low-level hook sees the
 * press, and this decides whether the popup closes. The rule is the user's own — they selected the
 * text to delete it or to replace it — so every key that types or edits counts, and the press is
 * passed on untouched either way.
 *
 * The three cases:
 *   - a printable key (letters, digits, space, punctuation, and every key an IME drives) → close;
 *   - an editing/navigation key (Backspace, Delete, Enter, Tab, arrows, Home/End, PageUp/PageDown,
 *     Insert) → close;
 *   - everything else — shortcuts with Ctrl/Alt/Win, F-keys, lock toggles, the numpad, a bare
 *     modifier — stays open. Ctrl+C after selecting is how people copy; closing the menu under
 *     that press would just make them reselect.
 *
 * @param press - `{ vk, control, alt, win, extended, numpad }`: the virtual key, which modifiers
 *   were down, and the flags a WH_KEYBOARD_LL `KBDLLHOOKSTRUCT` carries.
 */
export function isDismissingKey(press = {}) {
  const vk = Number(press.vk) & 0xff
  // 0x00 and 0xFF mean "no such key": some IMEs report the first, no mapping reports the second.
  if (!Number.isFinite(vk) || vk === 0 || vk === 0xff) return false
  if (press.control || press.alt || press.win) return false
  if (vk === 0x1b) return false // Esc: the card handles it itself when it has focus
  // Modifier keys never type: pressing Shift to capitalise does not mean the menu is unwanted.
  if (vk === 0x10 || vk === 0x11 || vk === 0x12 || (vk >= 0x5b && vk <= 0x5f) || (vk >= 0xa0 && vk <= 0xa5)) return false
  if (LOCK_KEYS.has(vk) || FUNCTION_KEY(vk)) return false
  // A numpad digit types into the selection just like the top row does; with NumLock off the same
  // key is a navigation key and arrives without the numpad flag, so the general rule below covers it.
  if (press.numpad) return vk >= 0x60 && vk <= 0x69
  if (NUMPAD_OPERATORS.has(vk)) return false
  return true
}

/**
 * Ask for Markdown — the panel renders a subset of it.
 *
 * The model writes Markdown far more usefully than flat prose, and the renderer gives headings,
 * bullets and numbered lists their own shape. Keeping the answer short still matters: a panel is
 * read in passing, not studied.
 */
const MARKDOWN_RULE =
  '用 Markdown 输出：标题用 #，要点用 - 列表或 1. 编号，重点可以用 **加粗**。' +
  '不要输出表格和图片。整体保持紧凑，通常不超过 200 字，除非用户明确要求展开。' +
  '最后用 2–3 行「>> 追问」给出用户可以接着问的问题，每行一个，不要编号。'

/** Lines the model uses for follow-up suggestions; `>>` never appears in normal prose. */
const SUGGESTION = /^>>\s*(.+)$/

/**
 * Split the model's answer into the body and its follow-up suggestions.
 *
 * The suggestions are asked for as `>> 问题` lines at the end because the panel renders them as
 * buttons rather than text. Keeping them in the same stream means no second model call: the
 * answer is parsed once, and the lines never reach the rendered body.
 *
 * @returns `{ answer, suggestions }` with at most three suggestions.
 */
export function splitSuggestions(text) {
  const suggestions = []
  const kept = []
  for (const line of String(text ?? '').split('\n')) {
    const match = SUGGESTION.exec(line.trim())
    if (match && suggestions.length < 3) suggestions.push(match[1].trim())
    else kept.push(line)
  }
  return { answer: kept.join('\n').replace(/\n{3,}/g, '\n\n').trim(), suggestions }
}

const PROMPTS = {
  // The direction is decided here rather than left to the model: asked to "auto-detect", models
  // happily "translate" Chinese into Chinese, and the user reads that as the feature not working.
  translate: (target, source) => (source
    ? `你是翻译引擎。把用户给的${languageName(source)}文本翻译成${languageName(target)}。` +
      '只输出译文本身，不要解释、不要加引号、不要保留原文。'
    : `你是翻译引擎。把用户给的文本翻译成${languageName(target)}。只输出译文本身，不要解释、不要加引号。`) +
    MARKDOWN_RULE,
  explain: () => `你是讲解助手。用通俗的中文解释用户给出的文本：它是什么意思、涉及什么概念、什么场景下会用到。${MARKDOWN_RULE}`,
  summarize: () => `你是摘要助手。用中文概括用户给出文本的要点。${MARKDOWN_RULE}`,
  followup: () => `用户在追问下面这段文字。结合原文和你之前的回答直接回答追问，不要复述原文。${MARKDOWN_RULE}`,
}

export function systemPrompt(actionId, options = {}) {
  const build = PROMPTS[actionId]
  if (!build) throw new Error(`unknown action: ${actionId}`)
  return build(options.targetLanguage || DEFAULT_TARGET_LANGUAGE, options.sourceLanguage || null)
}

/** True for actions that call a model. `copy` is handled in-process and has no prompt. */
export function isModelAction(actionId) {
  return actionId in PROMPTS
}

/** Human-readable reason a selection cannot be acted on, or null when it is usable. */
export function selectionProblem(text) {
  if (typeof text !== 'string') return '没有取到文本'
  const core = text.trim()
  if (core.length === 0) return '没有取到文本'
  if (core.length > MAX_TEXT_CHARS) return `选中内容过长（${core.length} 字，上限 ${MAX_TEXT_CHARS}）`
  return null
}

export function buildRequest(actionId, text, options = {}) {
  return {
    system: systemPrompt(actionId, options),
    messages: [{ role: 'user', content: [{ type: 'text', text: text.trim() }] }],
  }
}

/** The language the settings page starts with, and the one every prompt falls back to. */
export const DEFAULT_TARGET_LANGUAGE = '简体中文'

/**
 * Every target the settings page and the card's card language row offer.
 *
 * One list, used by both halves: the card used to keep its own copy, so adding a language in the
 * settings page left the picker inside the card unable to choose it.
 */
export const TARGET_LANGUAGES = ['简体中文', '繁體中文', 'English', '日本語', '한국어', 'Français', 'Deutsch', 'Español', 'Русский']

/** What the card shows instead of a detected source language. */
export const UNKNOWN_LANGUAGE = '其他'

const CHINESE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g
const LATIN_LETTER = /[A-Za-z]/g
/** Letters of any script, so letters can be compared with letters rather than with punctuation. */
const ANY_LETTER = /\p{L}/gu

/**
 * Whether a selection is mostly Chinese.
 *
 * Chinese is told apart by its ideographs, everything else by not having them: a text is Chinese
 * when more than half of its letters are Han characters. Counting letters rather than characters
 * is what keeps punctuation, digits and emoji from outvoting the words. Half is the threshold
 * because a Chinese sentence quoting an English term, or the reverse, is still one language — and
 * a mixed fragment has no right answer anyway.
 */
export function isChineseText(text) {
  const source = String(text ?? '')
  const letters = (source.match(ANY_LETTER) || []).length
  if (letters === 0) return false
  return (source.match(CHINESE) || []).length * 2 > letters
}

/** True when the text is mostly Latin letters — the only other language this plugin names. */
export function isEnglishText(text) {
  const source = String(text ?? '')
  const letters = (source.match(ANY_LETTER) || []).length
  if (letters === 0) return false
  return (source.match(LATIN_LETTER) || []).length * 2 > letters
}

/**
 * The language a translation should render into — the rule the user asked for, in one place.
 *
 *   - Chinese selection  → English, always.
 *   - English selection  → the preferred language from the settings page.
 *   - Anything else      → the preferred language from the settings page.
 *
 * One boundary is deliberate: English into English is not a translation, so when the preferred
 * language *is* English and the selection is English too, the direction falls back to Simplified
 * Chinese. The alternative is a card whose prompt says "translate English into English", which
 * returns the input unchanged and reads as the feature being broken.
 */
export function translateTarget(text, preferred = DEFAULT_TARGET_LANGUAGE) {
  const target = typeof preferred === 'string' && preferred.trim() ? preferred.trim() : DEFAULT_TARGET_LANGUAGE
  if (isChineseText(text)) return 'English'
  if (isEnglishText(text) && target === 'English') return DEFAULT_TARGET_LANGUAGE
  return target
}

/**
 * The source language as the card labels it, or the neutral label for anything else.
 *
 * Only two languages are named here, because only they change the direction; labelling Arabic as
 * "阿拉伯语" would imply the plugin can tell, and it cannot without a model round-trip.
 */
export function sourceLanguageLabel(text) {
  if (isChineseText(text)) return '中文'
  if (isEnglishText(text)) return '英文'
  return UNKNOWN_LANGUAGE
}

/**
 * How a language setting is named inside a prompt.
 *
 * "English" is what the settings page offers to the user; a model reading "翻译成英语" produces
 * Chinese output far more reliably than one reading "翻译成 English", because the target name is
 * the language the model reasons in.
 */
export function languageName(name) {
  return name === 'English' ? '英语' : name
}

/**
 * Everything one translation needs: which way it goes and what to call both ends.
 *
 * The card draws the direction from this, so the row always says what will actually be produced —
 * "自动检测" was a promise the plugin never kept.
 *
 * @param text - the selection being translated.
 * @param preferred - the target language from the settings page.
 * @returns `{ target, source, sourceLabel, targetLabel }`: `target`/`source` are the configured
 *   language names, the labels are what the pill row shows.
 */
export function translatePlan(text, preferred = DEFAULT_TARGET_LANGUAGE) {
  const target = translateTarget(text, preferred)
  return {
    target,
    source: sourceLanguageLabel(text),
    sourceLabel: sourceLanguageLabel(text),
    targetLabel: target,
  }
}

/**
 * A follow-up question about the same selection.
 *
 * The conversation is replayed inside one user message rather than as assistant turns: the
 * selection is the context, and the panel has no session to attach a message history to.
 */
export function buildFollowUpRequest(original, previous, question, options = {}) {
  return {
    system: systemPrompt('followup', options),
    messages: [{
      role: 'user',
      content: [{
        type: 'text',
        text: `原文：\n${String(original).trim()}\n\n之前的回答：\n${String(previous).trim()}\n\n追问：${String(question).trim()}`,
      }],
    }],
  }
}

export function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by)
}

/**
 * Mouse state machine behind drag and multi-click detection.
 *
 * We poll the button and cursor rather than installing a low-level hook: polling needs no
 * extra dependency, no DLL, and no elevation, and it cannot deadlock the input queue the way
 * a slow hook callback can.
 *
 * @param state - previous state, or null for a fresh one.
 * @param sample - `{ down, x, y, t }` for this tick.
 * @returns the next state plus whether a selection gesture just completed.
 */
export function reduceMouse(state, sample) {
  const prev = state ?? { down: false, x0: 0, y0: 0, t0: 0, clicks: 0, lastUpT: -Infinity, lastUpX: 0, lastUpY: 0 }
  if (sample.down && !prev.down) {
    return { state: { ...prev, down: true, x0: sample.x, y0: sample.y, t0: sample.t }, fire: false, dragged: false }
  }
  if (!sample.down && prev.down) {
    const moved = distance(sample.x, sample.y, prev.x0, prev.y0) > DRAG_PX
    const multi =
      sample.t - prev.lastUpT <= MULTI_CLICK_MS &&
      distance(prev.x0, prev.y0, prev.lastUpX, prev.lastUpY) <= MULTI_CLICK_PX
    return {
      state: {
        ...prev,
        down: false,
        clicks: multi ? prev.clicks + 1 : 1,
        lastUpT: sample.t,
        lastUpX: prev.x0,
        lastUpY: prev.y0,
      },
      // A press that neither travelled nor repeated is a plain click: the user was placing a
      // caret, so there is nothing to act on.
      fire: moved || multi,
      // `dragged` is the strict subset: only an actual drag. Auto-open uses this one, because a
      // double-click already selects a word — firing the menu on it made every accidental
      // double-click pop the panel. `fire` still covers multi-click for right-click priming.
      dragged: moved,
    }
  }
  return { state: prev, fire: false, dragged: false }
}

/**
 * Geometry of the horizontal action bar, in device pixels. `scale` is monitor DPI / 96.
 *
 * One row, icon left of its label, item width derived from the label: the shape every
 * selection toolbar on Windows uses (Doubao's included). A fixed tile width was the older
 * icon-over-label grid; it wastes a row of height for one-word actions and reads as a dialog
 * rather than a toolbar.
 *
 * `measure(label)` returns the label's pixel width with the font the bar paints with — the
 * layout cannot be computed without it, so it is a parameter rather than a guess. The default
 * estimate keeps this function pure for tests that only care about hit-testing.
 */
export function menuLayout(actions, scale = 1, measure = (label) => label.length * 7 * scale) {
  const pad = Math.round(4 * scale)
  const gap = Math.round(2 * scale)
  const itemH = Math.round(30 * scale)
  const itemPad = Math.round(9 * scale)
  const iconW = Math.round(16 * scale)
  const iconGap = Math.round(5 * scale)
  const items = []
  let x = pad
  for (const action of actions) {
    const labelW = Math.round(measure(action.label || ''))
    const w = itemPad * 2 + iconW + iconGap + labelW
    items.push({
      x,
      y: pad,
      w,
      h: itemH,
      icon: { left: x + itemPad, right: x + itemPad + iconW },
      label: { left: x + itemPad + iconW + iconGap, right: x + w - itemPad },
    })
    x += w + gap
  }
  return {
    width: Math.max(pad * 2, x - gap + pad),
    height: pad * 2 + itemH,
    pad,
    items,
  }
}

/**
 * Place a context menu at the pointer, the way a native menu opens: down-right of the cursor,
 * flipped when that would leave the work area.
 */
/**
 * Accept a selection rectangle from the renderer, or reject it.
 *
 * The rect crosses a process boundary, so it is validated rather than trusted: a missing field,
 * a non-finite number or an inverted pair would place a window at NaN. Rejection returns null and
 * the caller falls back to the pointer.
 *
 * @param value - candidate `{left, top, right, bottom}` in screen coordinates.
 * @returns the rounded rectangle, or null when it is not usable.
 */
export function saneRect(value) {
  if (!value || typeof value !== 'object') return null
  const nums = ['left', 'top', 'right', 'bottom'].map((k) => Number(value[k]))
  if (nums.some((n) => !Number.isFinite(n))) return null
  const [left, top, right, bottom] = nums.map(Math.round)
  if (right < left || bottom < top) return null
  return { left, top, right, bottom }
}

/**
 * Place the action menu under the selection, never over it.
 *
 * Preference order, always outside the selection's own box:
 *   1. below it, horizontally centred on it — the normal case, and the one the user reads
 *      against while deciding which action to pick;
 *   2. above it, when the selection sits too low for the menu to fit below;
 *   3. whichever of the two has more room, when neither fits — the menu is short, so this only
 *      happens when the selection itself spans most of the screen.
 *
 * Centring on the selection rather than on the pointer is what makes the two drag directions
 * behave the same: the pointer ends at either edge, the selection's box does not move.
 *
 * @param rect - the selection rectangle in screen coordinates.
 * @param size - the menu's `{ width, height }`.
 * @param work - the work area `{ left, top, right, bottom }` to stay inside.
 * @returns the window's `{ x, y }`.
 */
export function placeMenuAtSelection(rect, size, work) {
  const gap = 6
  const below = rect.bottom + gap
  const above = rect.top - size.height - gap
  const roomBelow = work.bottom - below
  const roomAbove = rect.top - gap - work.top
  const fitsBelow = roomBelow >= size.height
  const fitsAbove = roomAbove >= size.height

  let y
  if (fitsBelow) y = below
  else if (fitsAbove) y = above
  else y = roomBelow >= roomAbove ? below : above

  const x = Math.round((rect.left + rect.right) / 2 - size.width / 2)
  return {
    x: Math.max(work.left, Math.min(x, work.right - size.width)),
    y: Math.max(work.top, Math.min(y, work.bottom - size.height)),
  }
}

/**
 * Place the result panel under the selection so the user can read the two together.
 *
 * This is the whole point of the panel — comparing an answer against the text it came from — so
 * it goes below the selection and grows downward, unlike the menu, which is transient.
 *
 * Above is the fallback when there is no room below, and the panel then grows upward, which keeps
 * its bottom edge (the part nearest the selection) in place as content streams in. Snapping to
 * whichever side merely has more room would make a streaming panel jump across the selection.
 *
 * @param rect - the selection rectangle in screen coordinates.
 * @param size - the panel's `{ width, height }` for the current content.
 * @param work - the work area to stay inside.
 * @param mode - `'below'` or `'above'`, chosen once per panel and held while it streams.
 * @returns the window's `{ x, y }`.
 */
export function placePanelAtSelection(rect, size, work, mode) {
  const gap = 10
  const below = rect.bottom + gap
  const above = rect.top - size.height - gap
  const picked = mode === 'above' ? above : below
  const x = Math.round((rect.left + rect.right) / 2 - size.width / 2)
  return {
    x: Math.max(work.left, Math.min(x, work.right - size.width)),
    y: Math.max(work.top, Math.min(picked, work.bottom - size.height)),
  }
}

/**
 * Which side a panel anchored to `rect` should use, decided from its first size and then held.
 * @param rect - the selection rectangle in screen coordinates.
 * @param size - the panel's initial `{ width, height }`.
 * @param work - the work area to stay inside.
 * @returns `'below'` when the panel fits under the selection, otherwise `'above'`.
 */
export function panelSideFor(rect, size, work) {
  return work.bottom - (rect.bottom + 10) >= size.height ? 'below' : 'above'
}


/** Index of the menu tile under a client-area point, or -1. */
export function menuHitTest(layout, x, y) {
  for (let i = 0; i < layout.items.length; i++) {
    const t = layout.items[i]
    if (x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h) return i
  }
  return -1
}

/** Scroll offset that keeps a wrapped block of `contentH` inside a `viewH` window. */
export function clampScroll(offset, contentH, viewH) {
  const max = Math.max(0, contentH - viewH)
  return Math.max(0, Math.min(offset, max))
}

/**
 * Break one paragraph into the lines the panel draws, and remember where each line came from.
 *
 * The panel has to know the lines, not just their total height: mouse selection is a character
 * range, and a highlight can only be drawn when the pixel position of every character boundary is
 * known. Drawing with `DT_WORDBREAK` hides that layout inside GDI, so it is computed here instead
 * and the paint pass draws one measured line at a time.
 *
 * `start`/`end` index the original text, so a selection maps straight back to the characters the
 * model wrote — wrapped lines are a display detail and never leak into the copied text.
 *
 * @param text - the paragraph.
 * @param width - the available pixel width.
 * @param measure - width in pixels of a substring.
 * @returns one entry per line, including empty lines for blank source lines.
 */
export function wrapLines(text, width, measure) {
  const source = String(text ?? '')
  const lines = []
  let at = 0
  for (;;) {
    const newline = source.indexOf('\n', at)
    const hardEnd = newline === -1 ? source.length : newline
    if (hardEnd === at) {
      lines.push({ start: at, end: at, text: '' })
    } else {
      let from = at
      while (from < hardEnd) {
        // Longest prefix that fits. A single character always makes progress, even when it is
        // wider than the line, so this loop cannot stall.
        let lo = 1
        let hi = hardEnd - from
        let best = 1
        while (lo <= hi) {
          const mid = (lo + hi) >>> 1
          if (measure(source.slice(from, from + mid)) <= width) {
            best = mid
            lo = mid + 1
          } else {
            hi = mid - 1
          }
        }
        let end = from + best
        // Prefer breaking after a space, and keep the space on this line.
        if (end < hardEnd) {
          const space = source.lastIndexOf(' ', end - 1)
          if (space > from) end = space + 1
        }
        lines.push({ start: from, end, text: source.slice(from, end) })
        from = end
      }
    }
    if (newline === -1) break
    at = newline + 1
  }
  return lines
}

/**
 * Name the failure the user can act on.
 *
 * A bare 401 is shown as an English sentence from the provider; it reads as "the model is broken"
 * and leaves the user guessing which credential to change. Only the model path remains now that
 * search is gone, so there is exactly one thing to say.
 *
 * @returns a short status label plus the body explaining what to do, or null for other errors.
 */
export function explainAuthFailure(message) {
  if (!/(^|\D)401(\D|$)|unauthor|authentication fails?|invalid (api[ -]?)?key/i.test(String(message))) return null
  return {
    short: '模型接口被拒绝（401）',
    body: '模型调用失败：提供方返回 401，当前模型的 API Key 无效或被停用。\n\n' +
      '到「设置 → 模型」换一个可用的模型，或在划词设置里改选其他模型。',
  }
}

/**
 * Lightweight Markdown for the panel: blocks, not a full parser.
 *
 * The panel draws with GDI, so what can be *shown* differ from what can be *written*. This keeps
 * the shapes that carry structure — headings, bullets, numbering, fenced code — and flattens
 * inline emphasis to its text. Rendering a stray `**` in a translation would look broken, and a
 * partial inline parser would leave the rest of the markers on screen.
 *
 * @param text - the model's answer.
 * @returns blocks with `kind` in `heading | bullet | number | code | paragraph`, each carrying the
 *   text with markers removed. Blank lines separate blocks; consecutive prose lines join.
 */
export function parseMarkdown(text) {
  const source = String(text ?? '').replace(/\r\n/g, '\n')
  const blocks = []
  let code = null
  let paragraph = null

  const flushParagraph = () => {
    if (paragraph === null) return
    blocks.push({ kind: 'paragraph', text: paragraph.join('\n') })
    paragraph = null
  }

  for (const raw of source.split('\n')) {
    const line = raw.trimEnd()
    if (/^\s*```/.test(line)) {
      flushParagraph()
      if (code === null) {
        code = []
      } else {
        blocks.push({ kind: 'code', text: code.join('\n') })
        code = null
      }
      continue
    }
    if (code !== null) {
      code.push(raw)
      continue
    }
    if (line.trim() === '') {
      flushParagraph()
      continue
    }
    const heading = /^\s{0,3}(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      flushParagraph()
      blocks.push({ kind: 'heading', level: heading[1].length, text: inlineText(heading[2]) })
      continue
    }
    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line)
    if (bullet) {
      flushParagraph()
      blocks.push({ kind: 'bullet', text: inlineText(bullet[1]) })
      continue
    }
    const numbered = /^\s*(\d+)[.)]\s+(.*)$/.exec(line)
    if (numbered) {
      flushParagraph()
      blocks.push({ kind: 'number', marker: `${numbered[1]}.`, text: inlineText(numbered[2]) })
      continue
    }
    // A horizontal rule carries no text; it becomes the gap the blank line already implies.
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      flushParagraph()
      continue
    }
    paragraph = paragraph === null ? [inlineText(line)] : [...paragraph, inlineText(line)]
  }
  flushParagraph()
  if (code !== null) blocks.push({ kind: 'code', text: code.join('\n') })
  return blocks
}

/** Strip the inline markers the panel cannot draw, keeping the words. */
function inlineText(text) {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')            // images → their alt text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')             // links → their label
    .replace(/`([^`]+)`/g, '$1')                         // inline code
    .replace(/\*\*([^*]+)\*\*/g, '$1')                   // bold
    .replace(/(^|[\s(])[*_]([^*_]+)[*_]([\s).,，。])/g, '$1$2$3') // italic
    .trim()
}

/**
 * Split an answer into the blocks the panel paints.
 *
 * Search is gone, so there is no source list any more: an answer is exactly the Markdown the
 * model wrote, block by block.
 */
export function bodyBlocks(answer) {
  return parseMarkdown(answer)
}

/**
 * Pick the first provider that advertises a usable model.
 *
 * `listProviders()` names providers but not their models, so a provider by itself cannot answer
 * an action: `llm.stream` needs a concrete model id. Treating the first provider as usable with
 * an empty model — which is what the action path used to do — reported "no model selected" on a
 * machine that had working models, and the user saw a menu whose buttons did nothing.
 *
 * @param providers - provider route ids, in the order the service lists them.
 * @param modelsOf - reads one provider's models; may throw, and a provider that throws is skipped.
 * @returns the first provider and model pair, or null when none advertises a model.
 */
export async function pickModel(providers, modelsOf) {
  for (const provider of providers) {
    if (typeof provider?.id !== 'string' || provider.id === '') continue
    let models
    try {
      models = await modelsOf(provider.id)
    } catch {
      continue
    }
    const model = Array.isArray(models)
      ? models.find((candidate) => typeof candidate?.id === 'string' && candidate.id !== '')
      : undefined
    if (model !== undefined) return { provider: provider.id, model: model.id }
  }
  return null
}
