/**
 * Calendar-day sections for the produced-files timeline. Mirrors the rule lumii
 * uses: compare local calendar days, not rolling 24-hour windows.
 */

/** @param {Date} date @returns {number} local midnight of that day */
function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function pad(value) {
  return String(value).padStart(2, '0')
}

/**
 * @param {number} timestamp - epoch milliseconds.
 * @param {Date} [now] - reference moment.
 * @returns {{ key: string, label: string }} the section for that timestamp.
 */
export function sectionOf(timestamp, now = new Date()) {
  const todayStart = startOfDay(now)
  const yesterdayStart = startOfDay(new Date(todayStart - 24 * 60 * 60 * 1000))
  const target = startOfDay(new Date(timestamp))
  if (target >= todayStart) return { key: `day:${todayStart}`, label: '今天' }
  if (target === yesterdayStart) return { key: `day:${yesterdayStart}`, label: '昨天' }
  const date = new Date(timestamp)
  return { key: `day:${target}`, label: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` }
}

/**
 * Group already-ordered entries into sections, keeping their order.
 * @param {Array<object>} items - entries.
 * @param {(item: object) => number} timeOf - timestamp accessor.
 * @param {Date} [now] - reference moment.
 * @returns {Array<{ section: object, items: Array<object> }>} sections.
 */
export function groupBySections(items, timeOf, now = new Date()) {
  const output = []
  for (const item of items) {
    const section = sectionOf(timeOf(item), now)
    const last = output[output.length - 1]
    if (last !== undefined && last.section.key === section.key) last.items.push(item)
    else output.push({ section, items: [item] })
  }
  return output
}