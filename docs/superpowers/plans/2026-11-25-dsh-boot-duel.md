# DSH Boot Duel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a `dsh-boot-duel` bundle that covers the DSH Web home page with a playable keyboard stick-figure duel until the opponent's health bar is emptied, then fades out into the home page.

**Architecture:** One bundle package. Host `index.js` declares `Config` only. Client `client.js` registers one `shell.overlay` entry that renders the whole layer. All fight logic lives in `sim/*.mjs` pure modules (no DOM, no React) so `node --test` can drive it directly; `render.js` is the only browser-only module and draws from immutable snapshots the sim returns.

**Tech Stack:** Plain ESM JavaScript, zero runtime dependencies. Host: Cordis `Config` (schemastery). Client: `window.__ModuleLoader__.load({ id, factory })`, React from the browser module table, `host.call`, `styles.insert`, `ctx.slots`. Tests: `node --test`; browser tests via Playwright.

**Spec:** `C:\myself\projects\my\自由创作区\docs\superpowers\specs\2026-11-25-dsh-boot-duel-design.md`

## Global Constraints

- Package name and directory: `dsh-boot-duel`; local-directory install only, **not** published to npm.
- Config defaults: `enabled: true`, `difficulty: 'easy'` (default difficulty **must** be easy; `normal` exists only for people who opt in).
- Both fighters start at **100** HP. No timer, no rounds. Only pass condition: opponent HP reaches 0.
- The **player cannot lose**: player HP floors at 1 and triggers a low-health red screen. No defeat state, no explainer in the UI.
- Action frames and damage exactly per spec §4.5: `J` jab windup 4 / active 3 / recovery 7 / damage 8; `K` kick 8 / 4 / 12 / damage 14; `L` block (hold) 80% damage reduction, kick still nudges back; movement `A`/`D` and `←`/`→`; jump `Space`/`W` with 24-frame airtime; `J` on a staggered opponent deals 18 and briefly slows time.
- KO sequence: time scale **0.25×** for **900 ms**; ragdoll = 6 point masses (4 limbs + head + torso), Verlet + distance constraints, **6** solver iterations, friction and slight bounce on landing; white flash 120 ms; radial shockwave; decaying screen shake; particles; centered "KO" letters popping in one by one, then `按任意键进入`; total ≈1.5 s, then `opacity` fade over 400 ms, then unmount.
- Particles capped at **300**.
- `prefers-reduced-motion`: no shake on hit; KO slow-motion becomes **0.5×** and no white flash.
- Audio: WebAudio oscillators + noise only, **no audio files**. Categories: `whoosh` (jab), `thud` (hit), `clink` (block), `boom` (KO), `crash` (health bar emptied). `AudioContext` is created only after the first user key/click; creation failure degrades silently to no sound. **Default muted**, state in memory only, reflected by `aria-pressed`.
- Keyboard: listeners attach to the focused container **only**, never `document`. `Space`, arrows, `J/K/L/A/D/W` are always `preventDefault()`ed while the game runs. `Esc` skips during play; `Esc` does nothing during the KO outro.
- Focus: focus the container on mount; remember `document.activeElement` before mount and restore it on unmount when still focusable, otherwise blur the layer. `focusout` pauses the game behind a "点击此处继续" mask.
- State lives in a module-level in-memory flag only; no Host persistence. Reload or hot reload replays the duel.
- `devicePixelRatio` scaling, recomputed on resize **and** DPR change; fixed-timestep accumulator so 144 Hz and 30 Hz both tick identically; pause on `visibilitychange` hidden.
- Every render/audio error is caught, logged via `console.error`, and unmounts the layer so the user reaches the home page. **Never trap the user.**
- Missing `shell.overlay` slot: render nothing, log one error, leave the app untouched.
- UI text routes through the client `locale` service, namespace `boot-duel`, dictionaries `locale/zh.json` and `locale/en.json`. No hard-coded Chinese in code. Locale keys: `title`, `hint.controls`, `hint.skip`, `ko`, `ko.pressAnyKey`, `pause.clickToResume`, `mute.on`, `mute.off`, plus `meta.title` / `meta.description` / `meta.detail` for the plugin page.
- Layer element owns `pointer-events: auto`, `position: fixed; inset: 0`, and its own z-index. Do not read host DOM, do not override host CSS variables, do not modify other plugins' DOM or the app shell.
- Only `shell.overlay`, `locale`, `styles`, `host.call` host capabilities are used.
- Code cross-file references use relative paths (`./sim/duel.mjs`). No new non-essential dependencies.

## Review Focus

1. **Focus ownership at the moment the overlay unmounts.** A user who wins and immediately types into the composer must get normal text, not keystrokes swallowed or injected. test: `test/focus.test.mjs` (Task 8) + Playwright regression (Task 10).
2. **`Esc` pressed twice, or pressed during the KO outro.** Double-skip must not double-unmount or throw; `Esc` mid-outro must be a no-op. test: `test/duel.test.mjs` state machine test (Task 3).
3. **The impossible-but-real error path.** A thrown animation-frame tick must still land the user on the home page with the layer removed. test: `test/session.test.mjs` (Task 7).
4. **Player health floor.** The AI can hit forever; player HP must stop at 1 and never produce a defeat state or a health bar reading 0. test: `test/combat.test.mjs` (Task 2).
5. **Reduced motion + no WebAudio.** `AudioContext` throwing or being blocked must not abort the KO, and reduced-motion must still complete the outro. tests: Task 6 (`test/audio.test.mjs`) and Task 8.

---

### Task 1: Package skeleton, manifest, patch, and locales

**Files:**
- Create: `plugins/dsh-boot-duel/package.json`
- Create: `plugins/dsh-boot-duel/cordis.patch.yml`
- Create: `plugins/dsh-boot-duel/index.js`
- Create: `plugins/dsh-boot-duel/locale/zh.json`
- Create: `plugins/dsh-boot-duel/locale/en.json`
- Test: `plugins/dsh-boot-duel/test/manifest.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: package name `dsh-boot-duel`; row id `boot-duel`; locale namespace `boot-duel` with the keys listed in Global Constraints; `index.js` exporting `apply`, `Config`, and `name`.

- [ ] **Step 1: Write the failing test**

```js
// test/manifest.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)))
const read = (p) => readFileSync(path.join(root, p), 'utf8')

test('manifest exposes the bundle patch, client half and display resources', () => {
  const pkg = JSON.parse(read('package.json'))
  assert.equal(pkg.name, 'dsh-boot-duel')
  assert.equal(pkg.type, 'module')
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(pkg.dsh.client.platform, 'web')
  for (const key of ['./client', './locale/*.json', './icon']) {
    assert.ok(pkg.exports[key], `exports ${key}`)
  }
})

test('patch inserts one boot-duel row with easy difficulty', () => {
  const patch = read('cordis.patch.yml')
  assert.match(patch, /id: boot-duel/)
  assert.match(patch, /name: dsh-boot-duel/)
  assert.match(patch, /enabled: true/)
  assert.match(patch, /difficulty: easy/)
})

test('locale dictionaries agree on keys and keep meta copy', () => {
  const zh = JSON.parse(read('locale/zh.json'))
  const en = JSON.parse(read('locale/en.json'))
  const keys = (o, prefix = '') => Object.entries(o).flatMap(([k, v]) =>
    typeof v === 'object' ? keys(v, prefix + k + '.') : [prefix + k])
  assert.deepEqual(keys(zh).sort(), keys(en).sort())
  for (const dict of [zh, en]) {
    for (const key of ['title', 'hint.controls', 'hint.skip', 'ko', 'ko.pressAnyKey',
      'pause.clickToResume', 'mute.on', 'mute.off', 'meta.title', 'meta.description', 'meta.detail']) {
      assert.ok(dict[key.split('.').reduce((o, part) => o?.[part], dict)], `missing ${key}`)
    }
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test plugins/dsh-boot-duel/test/manifest.test.mjs`
Expected: FAIL with `ENOENT` on `package.json`.

- [ ] **Step 3: Create the package files**

`package.json` — `name: "dsh-boot-duel"`, `version: "0.1.0"`, `private: true`, `type: "module"`, `license: "MIT"`, `description` in English plus Chinese for the plugin page. `exports`: `".": "./index.js"`, `"./client": "./client.js"`, `"./cordis.patch.yml"`, `"./locale/*.json"`, `"./icon": "./icon.svg"`, `"./package.json"`. `files` lists `index.js`, `client.js`, `render.js`, `sim`, `locale/*.json`, `docs`, `icon.svg`, `README.md`, `THIRD_PARTY_NOTICES.md`, `cordis.patch.yml`. `dsh.bundle.patch: "./cordis.patch.yml"`. `dsh.client: { platform: "web", immediately: true, inject: [] }`. `scripts.test: "node --test test/*.test.mjs"`. No `dependencies`.

`index.js` — export `name`, `Config` (schemastery `Schema.object({ enabled: Schema.boolean().default(true), difficulty: Schema.union(['easy', 'normal']).default('easy') })`), and `apply(ctx, config)` that stores the resolved config in a module variable and exposes it to the Client half through the Package-private RPC by returning `{ enabled, difficulty }`; nothing else. Do not register Host services, tools, or files.

`cordis.patch.yml`:

```yaml
# dsh-boot-duel: a one-round stick-figure duel on the Web home page.
# `enabled: false` turns the opening animation off without uninstalling.
- insert:
    - id: boot-duel
      name: dsh-boot-duel
      config:
        enabled: true
        difficulty: easy
```

`locale/zh.json` and `locale/en.json` — the full key set from Global Constraints plus `meta.title`, `meta.description`, `meta.detail: "docs/DETAIL.md"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test plugins/dsh-boot-duel/test/manifest.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add plugins/dsh-boot-duel/package.json plugins/dsh-boot-duel/cordis.patch.yml plugins/dsh-boot-duel/index.js plugins/dsh-boot-duel/locale plugins/dsh-boot-duel/test/manifest.test.mjs
git commit -m "feat(boot-duel): scaffold bundle manifest, patch and locales"
```

---

### Task 2: Fighter state machine and combat resolution

**Files:**
- Create: `plugins/dsh-boot-duel/sim/constants.mjs`
- Create: `plugins/dsh-boot-duel/sim/fighter.mjs`
- Create: `plugins/dsh-boot-duel/sim/combat.mjs`
- Test: `plugins/dsh-boot-duel/test/combat.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `constants.mjs` exports `MOVES` (`{ jab: { windup: 4, active: 3, recovery: 7, damage: 8, range: 46, height: 70 }, kick: { windup: 8, active: 4, recovery: 12, damage: 14, range: 74, height: 40 } }`), `MAX_HP = 100`, `PLAYER_HP_FLOOR = 1`, `JUMP_FRAMES = 24`, `ARENA = { min: 60, max: 900, ground: 300 }`, `STAGGER_FRAMES`, `COUNTER_DAMAGE = 18`.
  - `fighter.mjs` exports `createFighter(id, x, facing)` → `{ id, x, y, vy, facing, hp, action: null, actionFrame, stagger, blocking, onGround }`, `startAction(fighter, name)` → boolean, `stepFighter(fighter, input, arena)` → void, `hitboxOf(fighter)` → `{ x, y, w, h, damage } | null`, `hurtboxOf(fighter)` → `{ x, y, w, h }`.
  - `combat.mjs` exports `resolveHits(attacker, defender, opts)` → `{ hit: boolean, damage: number, blocked: boolean, ko: boolean } | null` and `applyDamage(defender, damage, opts)` → boolean.

- [ ] **Step 1: Write the failing test**

```js
// test/combat.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MOVES, MAX_HP, PLAYER_HP_FLOOR, ARENA } from '../sim/constants.mjs'
import { createFighter, startAction, stepFighter, hitboxOf } from '../sim/fighter.mjs'
import { resolveHits } from '../sim/combat.mjs'

const idle = { left: false, right: false, jump: false, jab: false, kick: false, block: false }

function duelists() {
  const player = createFighter('player', 300, 1)
  const enemy = createFighter('enemy', 340, -1)
  return { player, enemy }
}

test('jab produces no hitbox during windup and one during active frames', () => {
  const { player } = duelists()
  assert.equal(startAction(player, 'jab'), true)
  for (let i = 0; i < MOVES.jab.windup; i++) {
    assert.equal(hitboxOf(player), null, `windup frame ${i}`)
    stepFighter(player, idle, ARENA)
  }
  assert.notEqual(hitboxOf(player), null)
})

test('kick stays active exactly for its active window', () => {
  const { player } = duelists()
  startAction(player, 'kick')
  for (let i = 0; i < MOVES.kick.windup; i++) stepFighter(player, idle, ARENA)
  let active = 0
  while (hitboxOf(player)) { active++; stepFighter(player, idle, ARENA) }
  assert.equal(active, MOVES.kick.active)
})

test('same attack resolves once, not once per active frame', () => {
  const { player, enemy } = duelists()
  startAction(player, 'jab')
  for (let i = 0; i < MOVES.jab.windup; i++) stepFighter(player, idle, ARENA)
  const first = resolveHits(player, enemy, { slow: 0 })
  const second = resolveHits(player, enemy, { slow: 0 })
  assert.equal(first.hit, true)
  assert.equal(second, null)
  assert.equal(enemy.hp, MAX_HP - MOVES.jab.damage)
})

test('block reduces damage by 80 percent', () => {
  const { player, enemy } = duelists()
  enemy.blocking = true
  startAction(player, 'jab')
  for (let i = 0; i < MOVES.jab.windup; i++) stepFighter(player, idle, ARENA)
  const hit = resolveHits(player, enemy, { slow: 0 })
  assert.equal(hit.blocked, true)
  assert.equal(enemy.hp, MAX_HP - Math.round(MOVES.jab.damage * 0.2))
})

test('player health floors at 1 and never reports a KO', () => {
  const player = createFighter('player', 300, 1)
  const enemy = createFighter('enemy', 340, -1)
  startAction(enemy, 'kick')
  for (let i = 0; i < MOVES.kick.windup; i++) stepFighter(enemy, idle, ARENA)
  for (let i = 0; i < 30; i++) {
    const attacker = { ...enemy, kickConsumed: false }
    resolveHits(attacker, player, { player: true, slow: 0 })
  }
  assert.equal(player.hp, PLAYER_HP_FLOOR)
  const hit = resolveHits({ ...enemy, kickConsumed: false }, player, { player: true, slow: 0 })
  assert.equal(player.hp, PLAYER_HP_FLOOR)
  assert.equal(Boolean(hit?.ko), false)
})

test('KO fires only on the frame health reaches zero', () => {
  const { player, enemy } = duelists()
  enemy.hp = MOVES.jab.damage
  startAction(player, 'jab')
  for (let i = 0; i < MOVES.jab.windup; i++) stepFighter(player, idle, ARENA)
  assert.equal(resolveHits(player, enemy, { slow: 0 }).ko, true)
  assert.equal(enemy.hp, 0)
  assert.equal(resolveHits(player, enemy, { slow: 0 }), null)
})

test('movement is clamped to the arena', () => {
  const { player } = duelists()
  for (let i = 0; i < 400; i++) stepFighter(player, { ...idle, left: true }, ARENA)
  assert.equal(player.x, ARENA.min)
  for (let i = 0; i < 400; i++) stepFighter(player, { ...idle, right: true }, ARENA)
  assert.equal(player.x, ARENA.max)
})

test('jump leaves the ground for JUMP_FRAMES', () => {
  const { player } = duelists()
  startAction(player, 'jump')
  let air = 0
  while (!player.onGround && air < 200) { stepFighter(player, idle, ARENA); air++ }
  assert.ok(air > 0 && air <= 40, `airtime ${air}`)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test plugins/dsh-boot-duel/test/combat.test.mjs`
Expected: FAIL with `Cannot find module '../sim/constants.mjs'`.

- [ ] **Step 3: Implement the three modules**

`constants.mjs` — the numeric table above, exactly the spec's frame windows and damages.

`fighter.mjs` — a small state machine. `action` is `null` or one of `jab`, `kick`, `jump`; `actionFrame` counts up. `hitboxOf` returns a box only while `actionFrame` is inside `[windup, windup + active)`, and reports `consumed` so a single attack connects once. Movement moves `x` by a per-frame speed, clamped to `ARENA.min`/`ARENA.max`; jump sets `vy` and gravity returns the fighter to `ARENA.ground` after `JUMP_FRAMES`. `stepFighter` decrements `stagger` and clears `blocking` when `input.block` is false.

`combat.mjs` — `resolveHits(attacker, defender, { player = false, slow })`: if attacker's action is consumed or no hitbox overlaps the defender's hurtbox, return `null`; otherwise compute damage (×0.2 when the defender blocks, rounded), apply it (`player: true` clamps the defender at `PLAYER_HP_FLOOR` and never sets `ko`), set `defender.stagger`, and return `{ hit: true, damage, blocked, ko }`. `applyDamage` is the single write point for `hp`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test plugins/dsh-boot-duel/test/combat.test.mjs`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add plugins/dsh-boot-duel/sim plugins/dsh-boot-duel/test/combat.test.mjs
git commit -m "feat(boot-duel): fighter state machine and combat resolution"
```

---

### Task 3: Duel facade — input sampling, KO outro, skip, and irreversibility

**Files:**
- Create: `plugins/dsh-boot-duel/sim/duel.mjs`
- Test: `plugins/dsh-boot-duel/test/duel.test.mjs`

**Interfaces:**
- Consumes: Task 2's `createFighter`, `stepFighter`, `hitboxOf`, `resolveHits`, `MOVES`, `MAX_HP`, `ARENA`.
- Produces: `createDuel({ seed, difficulty })` → object with `tick(input)` → `{ events: string[], snapshot: DuelSnapshot }`, `skip()` → boolean, `getState()` → `'playing' | 'ko' | 'done'`, and `update(dtMs, input)`. `DuelSnapshot` = `{ phase, player: { x, y, facing, hp, action, actionFrame, blocking, stagger }, enemy: {…}, ragdoll: null | RagdollSnapshot, fx: { shake, flash, shockwave, particles }, timeScale, koElapsedMs, fadeOpacity }`. Events are `'hit' | 'block' | 'ko' | 'crash' | 'whoosh' | 'skip' | 'enter'`.

- [ ] **Step 1: Write the failing test**

```js
// test/duel.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDuel } from '../sim/duel.mjs'
import { MAX_HP } from '../sim/constants.mjs'

const idle = { left: false, right: false, jump: false, jab: false, kick: false, block: false }

test('KO sets 0.25x time scale, then settles after the outro', () => {
  const duel = createDuel({ seed: 1, difficulty: 'easy' })
  duel.forceKo(1)
  const snap = duel.getSnapshot()
  assert.equal(duel.getState(), 'ko')
  assert.equal(snap.timeScale, 0.25)
  assert.equal(snap.enemy.hp, 0)
  assert.notEqual(snap.ragdoll, null)
})

test('KO outro lasts about 1.5s before it reports done', () => {
  const duel = createDuel({ seed: 2, difficulty: 'easy' })
  duel.forceKo(-1)
  let elapsed = 0
  while (duel.getState() !== 'done' && elapsed < 5000) { duel.update(16, idle); elapsed += 16 }
  assert.ok(elapsed >= 1400 && elapsed <= 2400, `outro ${elapsed}ms`)
})

test('skip during play enters the outro, and skip is irreversible once ko', () => {
  const duel = createDuel({ seed: 3, difficulty: 'easy' })
  assert.equal(duel.skip(), true)
  assert.equal(duel.getState(), 'ko')
  assert.equal(duel.skip(), false, 'second skip is a no-op')
  assert.equal(duel.getState(), 'ko')
})

test('snapshot is a copy, mutating it cannot corrupt the duel', () => {
  const duel = createDuel({ seed: 4, difficulty: 'easy' })
  const snap = duel.getSnapshot()
  snap.player.hp = 0
  assert.equal(duel.getSnapshot().player.hp, MAX_HP)
})

test('reduced motion lowers KO time scale to 0.5x and disables flash', () => {
  const duel = createDuel({ seed: 5, difficulty: 'easy', reducedMotion: true })
  duel.forceKo(1)
  const snap = duel.getSnapshot()
  assert.equal(snap.timeScale, 0.5)
  assert.equal(snap.fx.flash, 0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test plugins/dsh-boot-duel/test/duel.test.mjs`
Expected: FAIL with `Cannot find module '../sim/duel.mjs'`.

- [ ] **Step 3: Implement `sim/duel.mjs`**

`createDuel` builds two fighters and a seeded PRNG (`xorshift32`-style, seed normalised to a non-zero uint32). `update(dtMs, input)` runs a **fixed 60 Hz step** accumulator and drops the remainder each call, so `tick` counts are identical at 30 Hz and 144 Hz for the same total time. `tick(input)` advances exactly one frame and returns `{ events, snapshot }`. In the `ko` phase, `update` advances `koElapsedMs` in **real** time (time scale only stretches the fight sim), spawns the ragdoll on entry, and reports `done` at 1500 ms; `fadeOpacity` then ramps 1 → 0 over 400 ms. `skip()` returns `true` only when the phase is `playing`, moving straight to the KO outro with `koElapsedMs = 0`; in any other phase it returns `false`. `getSnapshot()` deep-copies. `forceKo(dir)` empties the enemy's health with a knockback direction; it exists for tests and the outro self-check.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test plugins/dsh-boot-duel/test/duel.test.mjs`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add plugins/dsh-boot-duel/sim/duel.mjs plugins/dsh-boot-duel/test/duel.test.mjs
git commit -m "feat(boot-duel): duel facade with KO outro and irreversible skip"
```

---

### Task 4: Ragdoll physics

**Files:**
- Create: `plugins/dsh-boot-duel/sim/ragdoll.mjs`
- Test: `plugins/dsh-boot-duel/test/ragdoll.test.mjs`

**Interfaces:**
- Consumes: `ARENA` from `constants.mjs`.
- Produces: `createRagdoll({ x, y, facing, impulse })` → `{ points, constraints }`; `stepRagdoll(ragdoll, { ground, iterations })` → void; `ragdollSnapshot(ragdoll)` → `{ points: Array<{ x, y, px, py }>, constraints: Array<[i, j]> }`.

- [ ] **Step 1: Write the failing test**

```js
// test/ragdoll.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRagdoll, stepRagdoll, ragdollSnapshot } from '../sim/ragdoll.mjs'
import { ARENA } from '../sim/constants.mjs'

test('ragdoll has six point masses', () => {
  const r = createRagdoll({ x: 300, y: ARENA.ground, facing: 1, impulse: { x: 8, y: -4 } })
  assert.equal(r.points.length, 6)
})

test('constraint lengths hold within 1px after solving', () => {
  const r = createRagdoll({ x: 300, y: ARENA.ground, facing: 1, impulse: { x: 8, y: -4 } })
  for (let i = 0; i < 120; i++) stepRagdoll(r, { ground: ARENA.ground, iterations: 6 })
  for (const c of r.constraints) {
    const a = r.points[c.a]
    const b = r.points[c.b]
    const len = Math.hypot(a.x - b.x, a.y - b.y)
    assert.ok(Math.abs(len - c.length) < 1, `constraint drift ${Math.abs(len - c.length)}`)
  }
})

test('absurd impulse never produces NaN and stays in the arena', () => {
  const r = createRagdoll({ x: 300, y: ARENA.ground, facing: 1, impulse: { x: 1e9, y: -1e9 } })
  for (let i = 0; i < 200; i++) stepRagdoll(r, { ground: ARENA.ground, iterations: 6 })
  for (const p of r.points) {
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y))
    assert.ok(p.y <= ARENA.ground + 4, `point below ground: ${p.y}`)
  }
})

test('ragdoll comes to rest on the ground', () => {
  const r = createRagdoll({ x: 300, y: ARENA.ground, facing: 1, impulse: { x: 6, y: -3 } })
  for (let i = 0; i < 400; i++) stepRagdoll(r, { ground: ARENA.ground, iterations: 6 })
  const speed = Math.max(...r.points.map((p) => Math.hypot(p.x - p.px, p.y - p.py)))
  assert.ok(speed < 0.6, `still moving: ${speed}`)
})

test('snapshot is serialisable plain data', () => {
  const r = createRagdoll({ x: 300, y: ARENA.ground, facing: 1, impulse: { x: 6, y: -3 } })
  const snap = ragdollSnapshot(r)
  assert.equal(snap.points.length, 6)
  assert.doesNotThrow(() => JSON.stringify(snap))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test plugins/dsh-boot-duel/test/ragdoll.test.mjs`
Expected: FAIL with `Cannot find module '../sim/ragdoll.mjs'`.

- [ ] **Step 3: Implement `sim/ragdoll.mjs`**

Six points (head, torso, two arms, two legs) joined by distance constraints. Verlet integration (`x += (x - px) * damping + ax`), then `iterations` passes of constraint relaxation, then ground contact at `ARENA.ground` with friction and a small bounce, then clamping `x` into the arena. Damping ≈0.99, gravity ≈0.55 per frame. Reject non-finite input by clamping the impulse to a sane magnitude before seeding velocities.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test plugins/dsh-boot-duel/test/ragdoll.test.mjs`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add plugins/dsh-boot-duel/sim/ragdoll.mjs plugins/dsh-boot-duel/test/ragdoll.test.mjs
git commit -m "feat(boot-duel): verlet ragdoll with distance constraints"
```

---

### Task 5: Opponent AI

**Files:**
- Create: `plugins/dsh-boot-duel/sim/ai.mjs`
- Test: `plugins/dsh-boot-duel/test/ai.test.mjs`

**Interfaces:**
- Consumes: `MOVES`, `ARENA` from `constants.mjs`.
- Produces: `createAi({ difficulty, seed })` → `{ decide(state) }` returning an input object `{ left, right, jump, jab, kick, block }`; `AI_PROFILES` = `{ easy: { attackInterval: [1200, 2000], blockChance, counterChance }, normal: {...} }`.

- [ ] **Step 1: Write the failing test**

```js
// test/ai.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAi, AI_PROFILES } from '../sim/ai.mjs'

const state = (over = {}) => ({
  self: { x: 500, y: 300, facing: -1, action: null, actionFrame: 0, stagger: 0 },
  foe: { x: 400, y: 300, facing: 1, action: null, actionFrame: 0, stagger: 0 },
  ...over,
})

test('easy profile attacks at most once per 1.2 seconds', () => {
  const ai = createAi({ difficulty: 'easy', seed: 7 })
  let attacks = 0
  let frames = 0
  while (frames < 60 * 12) {
    const out = ai.decide(state(), 1000 / 60)
    if (out.jab || out.kick) attacks++
    frames++
  }
  assert.ok(attacks <= 12, `attacks ${attacks}`)
  assert.equal(AI_PROFILES.easy.attackInterval[0], 1200)
})

test('easy ai never chains a knockdown follow-up', () => {
  const ai = createAi({ difficulty: 'easy', seed: 8 })
  let consecutive = 0
  let worst = 0
  for (let i = 0; i < 3600; i++) {
    const out = ai.decide(state({ foe: { x: 400, y: 300, facing: 1, action: null, actionFrame: 0, stagger: 40 } }), 1000 / 60)
    if (out.jab || out.kick) { consecutive++; worst = Math.max(worst, consecutive) } else consecutive = 0
  }
  assert.ok(worst <= 1, `chained ${worst}`)
})

test('ai approaches when out of range and backs off when too close', () => {
  const ai = createAi({ difficulty: 'easy', seed: 9 })
  const far = ai.decide(state({ foe: { x: 60, y: 300, facing: 1, action: null, actionFrame: 0, stagger: 0 } }), 16)
  assert.equal(far.left, true)
  const near = ai.decide(state({ foe: { x: 470, y: 300, facing: 1, action: null, actionFrame: 0, stagger: 0 } }), 16)
  assert.equal(near.block, true)
})

test('seeded ai is deterministic', () => {
  const a = createAi({ difficulty: 'easy', seed: 11 })
  const b = createAi({ difficulty: 'easy', seed: 11 })
  const trace = (ai) => Array.from({ length: 300 }, () => JSON.stringify(ai.decide(state(), 16)))
  assert.deepEqual(trace(a), trace(b))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test plugins/dsh-boot-duel/test/ai.test.mjs`
Expected: FAIL with `Cannot find module '../sim/ai.mjs'`.

- [ ] **Step 3: Implement `sim/ai.mjs`**

`createAi` keeps an internal cooldown and a seeded PRNG. `decide(state, dtMs)` accumulates time, approaches until within striking distance, blocks instead of attacking when the foe is mid-attack close by, and fires `jab`/`kick` only when the cooldown expired, choosing an interval inside `attackInterval` with jitter. Easy profile: `{ attackInterval: [1200, 2000], blockChance: 0.25, counterChance: 0 }` — it never attacks a staggered foe. `normal`: `[700, 1300]`, `blockChance: 0.45`, `counterChance: 0.3`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test plugins/dsh-boot-duel/test/ai.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add plugins/dsh-boot-duel/sim/ai.mjs plugins/dsh-boot-duel/test/ai.test.mjs
git commit -m "feat(boot-duel): seeded opponent ai with easy and normal profiles"
```

---

### Task 6: Synthesised audio

**Files:**
- Create: `plugins/dsh-boot-duel/render.js` (audio section only, `createAudio`)
- Test: `plugins/dsh-boot-duel/test/audio.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `createAudio({ AudioContextCtor })` → `{ play(name), setMuted(bool), isMuted(), available() }`, where `name` is one of `whoosh`, `thud`, `clink`, `boom`, `crash`.

- [ ] **Step 1: Write the failing test**

```js
// test/audio.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAudio } from '../render.js'

function fakeContext({ failOnCreate = false } = {}) {
  const created = []
  class FakeAudioContext {
    constructor() {
      if (failOnCreate) throw new Error('blocked')
      this.state = 'running'
      this.currentTime = 0
      this.destination = {}
      created.push(this)
    }
    createOscillator() {
      const node = { type: '', frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() { node.started = true }, stop() {} }
      return node
    }
    createGain() { return { gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} } }
    createBufferSource() { return { buffer: null, connect() {}, start() { this.started = true }, stop() {} } }
    createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) } }
    close() { this.state = 'closed' }
  }
  return { FakeAudioContext, created }
}

test('audio is muted by default and plays nothing until unmuted', () => {
  const { FakeAudioContext, created } = fakeContext()
  const audio = createAudio({ AudioContextCtor: FakeAudioContext })
  assert.equal(audio.isMuted(), true)
  audio.play('thud')
  assert.equal(created.length, 0)
})

test('every sound name plays after unmuting', () => {
  const { FakeAudioContext } = fakeContext()
  const audio = createAudio({ AudioContextCtor: FakeAudioContext })
  audio.setMuted(false)
  for (const name of ['whoosh', 'thud', 'clink', 'boom', 'crash']) {
    assert.doesNotThrow(() => audio.play(name))
  }
})

test('a throwing AudioContext degrades to silence instead of failing', () => {
  const { FakeAudioContext } = fakeContext({ failOnCreate: true })
  const audio = createAudio({ AudioContextCtor: FakeAudioContext })
  audio.setMuted(false)
  assert.equal(audio.available(), false)
  assert.doesNotThrow(() => audio.play('boom'))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test plugins/dsh-boot-duel/test/audio.test.mjs`
Expected: FAIL with `Cannot find module '../render.js'`.

- [ ] **Step 3: Implement `createAudio` in `render.js`**

Export `createAudio({ AudioContextCtor = globalThis.AudioContext || globalThis.webkitAudioContext })`. Construct the context lazily on the first `play` after unmuting; wrap the constructor in `try/catch` and set an `unavailable` flag on failure. Each sound is a short envelope: `whoosh` = filtered noise sweep, `thud` = low square + noise burst, `clink` = two high sine pings, `boom` = low sine sweep + noise, `crash` = descending saw stack. Every call is wrapped in `try/catch` + `console.error` so nothing escapes.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test plugins/dsh-boot-duel/test/audio.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add plugins/dsh-boot-duel/render.js plugins/dsh-boot-duel/test/audio.test.mjs
git commit -m "feat(boot-duel): synthesised webaudio sound effects"
```

---

### Task 7: Session controller — lifecycle, focus, error escape

**Files:**
- Create: `plugins/dsh-boot-duel/sim/session.mjs`
- Test: `plugins/dsh-boot-duel/test/session.test.mjs`

**Interfaces:**
- Consumes: `createDuel`.
- Produces: `createSession({ duel, onEvent, onError })` → `{ keyDown(code), keyUp(code), frame(dtMs), pause(), resume(), isPaused(), isFinished(), unmount() }`, `PASSED` module flag accessors `hasPassed()` / `markPassed()`.

- [ ] **Step 1: Write the failing test**

```js
// test/session.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSession } from '../sim/session.mjs'
import { createDuel } from '../sim/duel.mjs'

test('Esc during play finishes the duel', () => {
  const duel = createDuel({ seed: 1, difficulty: 'easy' })
  const session = createSession({ duel })
  assert.equal(duel.getState(), 'playing')
  session.keyDown('Escape')
  assert.notEqual(duel.getState(), 'playing')
})

test('unmount stops further frames and never throws', () => {
  const duel = createDuel({ seed: 2, difficulty: 'easy' })
  const session = createSession({ duel })
  session.unmount()
  assert.doesNotThrow(() => session.frame(16))
  assert.equal(session.isFinished(), true)
})

test('a throwing duel is reported once and finishes the session', () => {
  const broken = {
    update() { throw new Error('boom') },
    skip() { return false },
    getState() { return 'playing' },
    getSnapshot() { return {} },
  }
  let errors = 0
  const session = createSession({ duel: broken, onError: () => { errors++ } })
  assert.doesNotThrow(() => session.frame(16))
  assert.equal(errors, 1)
  assert.equal(session.isFinished(), true)
})

test('keys held then released clear the input set', () => {
  const duel = createDuel({ seed: 3, difficulty: 'easy' })
  const session = createSession({ duel })
  session.keyDown('KeyD')
  assert.equal(session.input().right, true)
  session.keyUp('KeyD')
  assert.equal(session.input().right, false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test plugins/dsh-boot-duel/test/session.test.mjs`
Expected: FAIL with `Cannot find module '../sim/session.mjs'`.

- [ ] **Step 3: Implement `sim/session.mjs`**

Maps key codes to input flags (`KeyA`/`ArrowLeft` → left, `KeyD`/`ArrowRight` → right, `Space`/`KeyW` → jump, `KeyJ` → jab, `KeyK` → kick, `KeyL` → block). `frame(dtMs)` calls `duel.update` inside `try/catch`; on error it calls `onError` once and marks the session finished so the caller unmounts. `keyDown('Escape')` calls `duel.skip()`. `unmount()` sets a finished flag permanently. `pause`/`resume` gate `frame`. Module-level `hasPassed()`/`markPassed()` back the in-memory "already passed" flag.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test plugins/dsh-boot-duel/test/session.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add plugins/dsh-boot-duel/sim/session.mjs plugins/dsh-boot-duel/test/session.test.mjs
git commit -m "feat(boot-duel): session controller with error escape and key mapping"
```

---

### Task 8: Canvas renderer and fixed-step loop

**Files:**
- Create: `plugins/dsh-boot-duel/render.js` (draw + loop sections added to Task 6's file)
- Test: `plugins/dsh-boot-duel/test/render.test.mjs`

**Interfaces:**
- Consumes: `DuelSnapshot` shape from Task 3.
- Produces: `createLoop({ now, raf, cancelRaf, fixedStepMs = 1000 / 60, step })` → `{ start(), stop(), ticks(frames, frameMs) }` where `ticks` is a pure helper used by tests; `createRenderer(canvas, ctx2d)` → `{ resize(cssWidth, cssHeight, dpr), draw(snapshot) }`.

- [ ] **Step 1: Write the failing test**

```js
// test/render.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLoop, particleLimit } from '../render.js'

test('144Hz and 30Hz produce the same tick count for the same elapsed time', () => {
  const run = (frameMs) => {
    let total = 0
    const begin = 0
    const frames = Math.round(1000 / frameMs)
    const loop = createLoop({
      now: (i) => begin + i * frameMs,
      raf: () => 0,
      cancelRaf: () => {},
      step: () => { total++ },
    })
    loop.ticks(frames, frameMs)
    return total
  }
  const fast = run(1000 / 144)
  const slow = run(1000 / 30)
  assert.ok(Math.abs(fast - slow) <= 2, `144Hz=${fast} 30Hz=${slow}`)
})

test('particle limit is capped at 300', () => {
  assert.equal(particleLimit(), 300)
})

test('a throwing step is caught, never propagated', () => {
  const loop = createLoop({ now: (i) => i * 16, raf: () => 0, cancelRaf: () => {}, step: () => { throw new Error('draw') }, onError: () => {} })
  assert.doesNotThrow(() => loop.ticks(10, 16))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test plugins/dsh-boot-duel/test/render.test.mjs`
Expected: FAIL with `particleLimit is not a function`.

- [ ] **Step 3: Implement the loop and renderer in `render.js`**

`createLoop` accumulates real elapsed time and calls `step()` while the accumulator exceeds `fixedStepMs`, capping catch-up at 5 steps per frame so a long stall cannot freeze the page. `onError` receives a thrown `step` error and stops the loop. `createRenderer` draws the dark arena with a horizon and sparse neon particles, both stick figures with `shadowBlur` glow (cyan player, magenta opponent), the KO flash, shockwave, shake, particles, and the ragdoll from the snapshot; it caps particles via `particleLimit() === 300`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test plugins/dsh-boot-duel/test/render.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add plugins/dsh-boot-duel/render.js plugins/dsh-boot-duel/test/render.test.mjs
git commit -m "feat(boot-duel): canvas renderer and fixed-step loop"
```

---

### Task 9: Client entry — overlay registration, HUD, focus contract

**Files:**
- Create: `plugins/dsh-boot-duel/client.js`
- Test: `plugins/dsh-boot-duel/test/client.test.mjs`

**Interfaces:**
- Consumes: Tasks 1–8.
- Produces: `window.__ModuleLoader__.load({ id: 'dsh-boot-duel', factory })` whose exports are `apply(ctx)` and `inject`; internal `BootDuel` React component.

- [ ] **Step 1: Write the failing test**

```js
// test/client.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const source = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'client.js'), 'utf8')

test('client registers exactly one shell.overlay entry with the spec order', () => {
  assert.match(source, /__ModuleLoader__\.load\(/)
  assert.match(source, /id:\s*'dsh-boot-duel'/)
  assert.match(source, /name:\s*'shell\.overlay'/)
  assert.match(source, /order:\s*1000/)
})

test('keyboard listeners never bind to document', () => {
  assert.doesNotMatch(source, /document\.addEventListener\(\s*'key/)
  assert.doesNotMatch(source, /window\.addEventListener\(\s*'key/)
})

test('layer declares pointer-events auto and fixed inset coverage', () => {
  assert.match(source, /pointer-events:\s*auto/)
  assert.match(source, /position:\s*fixed/)
  assert.match(source, /inset:\s*0/)
})

test('locale and styles are registered through disposable effects', () => {
  assert.match(source, /styles\.insert\(/)
  assert.match(source, /locale/)
  assert.match(source, /host\.call\(/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test plugins/dsh-boot-duel/test/client.test.mjs`
Expected: FAIL with `ENOENT` on `client.js`.

- [ ] **Step 3: Implement `client.js`**

`apply(ctx)`:

1. `ctx.effect(() => styles.insert(CSS))`, returning the disposer.
2. `ctx.effect(() => ctx.locale.register('boot-duel', { zh, en }))` — the dictionaries are inlined by reading the same key set as `locale/*.json` (a build-free import is not available in the browser bundle, so `client.js` keeps one `DICTS` object and `test/manifest.test.mjs`-style checks keep it in sync).
3. `ctx.effect(() => ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'boot-duel', order: 1000 }, BootDuel)))`, wrapped in `try/catch` that logs `console.error` and returns nothing when the slot is absent.
4. Read `{ enabled, difficulty }` once with `host.call('config')`, falling back to `{ enabled: true, difficulty: 'easy' }` and logging on rejection.

`BootDuel` returns `null` when `hasPassed()` or config disabled. Otherwise it renders `<div class="boot-duel-layer" role="dialog" aria-modal="true">` containing the `<canvas>`, the native-DOM HUD (two health bars, control hint, mute button with `aria-pressed`, skip hint), a `tabIndex={0}` focus container, and the pause mask. On mount it records `document.activeElement`, focuses the container, wires `keydown`/`keyup`/`focusout` **on the container**, and starts the rAF loop; cleanup restores focus or blurs, clears the loop, cancels the fade timer, and calls `session.unmount()`. Every handler body is wrapped so a throw unmounts the layer via a `fail()` helper that logs and marks passed.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test plugins/dsh-boot-duel/test/client.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add plugins/dsh-boot-duel/client.js plugins/dsh-boot-duel/test/client.test.mjs
git commit -m "feat(boot-duel): client overlay entry with hud and focus contract"
```

---

### Task 10: Display resources, docs, and browser verification

**Files:**
- Create: `plugins/dsh-boot-duel/icon.svg`
- Create: `plugins/dsh-boot-duel/docs/DETAIL.md`
- Create: `plugins/dsh-boot-duel/README.md`
- Create: `plugins/dsh-boot-duel/THIRD_PARTY_NOTICES.md`
- Create: `plugins/dsh-boot-duel/test/e2e/duel.spec.mjs`
- Modify: `plugins/dsh-boot-duel/package.json` (`files` already reserves these)

**Interfaces:**
- Consumes: the installed, working plugin from Task 9.
- Produces: displayable icon + detail page; an E2E script that proves the spec's browser-level success criteria.

- [ ] **Step 1: Draw the icon**

Write an original `icon.svg` (≤256 KiB, square viewBox): two stick figures mid-clash on a dark rounded tile, a cyan figure and a magenta figure, a white impact burst between them. No embedded raster, no external references.

- [ ] **Step 2: Write the documents**

`docs/DETAIL.md` — what the plugin does, the keyboard controls table, how `enabled`/`difficulty` change behaviour, the reduced-motion and mute behaviour, and the honest limitation that the player cannot lose. `README.md` — install path (`plugin_manager` `install_bundle` with the directory; **Plugins → Add plugin** for a local directory), same control table, uninstall note. `THIRD_PARTY_NOTICES.md` — the four upstream projects from spec §2, each marked "design ideas only, no code reused", with licences as recorded in the spec (ragdoll-riot: no LICENSE; stick-fight: AGPL-3.0; wallbrawl: MIT; machin-stickman-battle: shell scripts).

- [ ] **Step 3: Write the Playwright E2E test**

`test/e2e/duel.spec.mjs` uses the workspace's Playwright install. Cases: (a) the full-screen layer is present above the home page with health bars and the Chinese hint; (b) driving the keyboard to empty the opponent's health shows the KO sequence and the layer leaves the DOM; (c) pressing `Esc` removes the layer immediately and focus returns to the pre-mount element; (d) typing `a`, `d`, `j` right after the layer is gone injects no characters into an input, and `Space` does not scroll; (e) after uninstalling the plugin and refreshing, no layer appears.

- [ ] **Step 4: Run the Node suite**

Run: `node --test plugins/dsh-boot-duel/test/*.test.mjs`
Expected: PASS (all tasks).

- [ ] **Step 5: Install and capture screenshots**

Install the bundle with `plugin_manager` `install_bundle`, confirm `application: applied`, refresh the page, and capture three screenshots: the opening, the KO, and the home page afterwards. Fix defects observed, in this plugin.

- [ ] **Step 6: Commit**

```bash
git add plugins/dsh-boot-duel
git commit -m "feat(boot-duel): icon, docs and browser verification"
```
