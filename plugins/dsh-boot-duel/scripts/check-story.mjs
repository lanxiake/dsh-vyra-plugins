/**
 * Continuity check for the scripts.
 *
 * Every `reply` must name a line that exists in the same story, and the two
 * speakers must alternate along a chain (nobody answers themselves). A broken
 * reply does not crash the game — it silently sends the argument back to an
 * opener — so the only way to catch it is to walk the graph.
 */
import { STORIES } from '../js/story.js'

let problems = 0
for (const story of STORIES) {
  const ids = new Map()
  for (const [beat, lines] of Object.entries(story.beats)) {
    lines.forEach((raw, i) => {
      if (Array.isArray(raw)) return
      if (!raw.id) { console.log(`✗ ${story.id}/${beat}[${i}] has no id`); problems++; return }
      if (ids.has(raw.id)) { console.log(`✗ ${story.id}: duplicate id ${raw.id}`); problems++ }
      ids.set(raw.id, { ...raw, beat })
    })
  }
  for (const [id, line] of ids) {
    if (!line.reply) continue
    const target = ids.get(line.reply)
    if (!target) { console.log(`✗ ${story.id}: ${id} replies to missing ${line.reply}`); problems++ }
    else if (target.speaker === line.speaker) {
      console.log(`✗ ${story.id}: ${id} (${line.speaker}) answers itself via ${line.reply}`)
      problems++
    }
  }
  // Count the sentence that actually reach the player.
  const open = (story.beats.open ?? []).length
  const thread = ['chain', 'guard', 'hit', 'take', 'taunt']
    .reduce((n, b) => n + (story.beats[b] ?? []).length, 0)
  const moment = ['super', 'ko'].reduce((n, b) => n + (story.beats[b] ?? []).length, 0)
  console.log(`${story.id} (${story.title}/${story.rival}): open ${open}, thread ${thread}, moment ${moment}, total ${open + thread + moment}`)
  // Every open line has to be an array: they are a script, not a thread.
  ;(story.beats.open ?? []).forEach((raw, i) => {
    if (!Array.isArray(raw)) { console.log(`✗ ${story.id}: open[${i}] must be a [speaker, text, mood] tuple`); problems++ }
  })
}
console.log(problems === 0 ? 'STORY OK' : `${problems} problem(s)`)
process.exitCode = problems === 0 ? 0 : 1
