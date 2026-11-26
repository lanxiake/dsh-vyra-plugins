/**
 * dsh-boot-duel — client half (source template).
 *
 * `scripts/build-client.mjs` inlines `sim/*.mjs` and `render.js` into the
 * marker below and writes the single-file `client.js` the host loads.
 *
 * Registers one `shell.overlay` entry that covers the frame with the duel on
 * every page load. The entry disappears for good once the round is won or
 * skipped, tracked by an in-memory flag, so a reload plays the opening again
 * and uninstalling leaves nothing behind.
 *
 * Four rules keep this from damaging — or being trapped by — the host:
 *
 *   1. A `window.__ModuleLoader__.load` factory only ever receives `require`.
 *      The `host`/`styles`/`console` seats belong to the *dynamic* plugin
 *      runner (`evaluateClientHalf`), not to bundle clients: touching them
 *      here throws `ReferenceError` and used to kill the stylesheet, which is
 *      exactly what turned the layer into a half-sheet over the chat list.
 *      So this file injects its own `<style data-plugin="dsh-boot-duel">` and
 *      reads config over the package's own `webServer` route.
 *   2. Keyboard listeners live on `window` in the capture phase, because a
 *      dialog that only listens on its own focus container goes deaf the
 *      moment focus wanders. Text fields, editable regions and the host's own
 *      dialogs are exempt, so typing elsewhere is untouched.
 *   3. `Esc` always leaves, from every phase and however many times it is
 *      pressed. The user can never be locked inside the opening animation.
 *   4. The previous focus is captured before mounting and restored after
 *      unmounting.
 */

window.__ModuleLoader__.load({
  id: 'dsh-boot-duel',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    const React = require('react')

    /* ---- inlined pure modules: sim/*.mjs and render.js ---- */

    /* __INLINED_MODULES__ */

    /* ------------------------------------------------------------- locale */

    const NAMESPACE = 'boot-duel'
    const SLOT = 'shell.overlay'
    /** The host settings page slot. */
    const SETTINGS_SLOT = 'settings.section'
    /** The icon beside it in the settings list. */
    const SETTINGS_ICON_SLOT = 'settings.section.icon'
    const ENTRY_ID = 'boot-duel'
    const ENTRY_ORDER = 1000
    const FADE_MS = 400
    const DEFAULT_CONFIG = { enabled: true, difficulty: 'easy' }
    /** Package id doubles as the style owner tag and the route prefix. */
    const PKG_ID = 'dsh-boot-duel'
    const CONFIG_URL = '/plugins/dsh-boot-duel/config'
    const STYLE_ID = 'dsh-boot-duel-style'
    /** Keys that must never reach the page while the layer is mounted. */
    const GAME_CODES = new Set([
      'Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'KeyA', 'KeyD', 'KeyW', 'KeyJ', 'KeyK', 'KeyL', 'KeyU', 'KeyI', 'Escape',
    ])

    // Inlined because the client bundle cannot read `locale/*.json` at runtime;
    // `test/client.test.mjs` keeps these keys in step with those files.
    const DICTS = {
      zh: {
        title: '开工大吉',
        subtitle: '工位即江湖',
        'hint.controls': "A / D 移动 · J 直拳 · H 摆拳 · K 踢击 · F 上勾 · G 扫腿 · N 滑铲 · L 格挡 · S 下蹲 · Shift 后跳 · 空格 跳 · 空中 J/K 空袭 · U 大招 · Esc 跳过",
        'hint.skip': '按 Esc 跳过这一局',
        'skip.button': '跳过',
        'settings.title': '开机动画',
        'settings.sectionName': '开机动画',
        'settings.panelTitle': '快速设置',
        'settings.enabled': '显示开局决斗',
        'settings.sound': '音效',
        'settings.difficulty': '对手强度',
        'settings.easy': '轻松',
        'settings.normal': '认真',
        'settings.binds': '键位',
        'settings.restart': '再来一局',
        'settings.resetBinds': '恢复默认键位',
        'settings.close': '关闭',
        'settings.lede': '每次打开 Web 界面先打一局火柴人，打完接着上班。',
        'settings.bindsNote': '点键位再按想要的键即可改绑。Esc 取消。',
        'settings.pressKey': '按新键…',
        'special.name': '破 军',
        'special.ready': '气已满 · 按 U 放大招',
        'special.locked': '气 {n}%',
        'special.hint': 'U',
        'start.button': '开始',
        'start.hint': '按 Enter 开始',
        'start.sub': '摆好架势，按下开始再出手',
        'roster.you': '你',
        'roster.enemy': '对手',
        'state.ready': '蓄势',
        'state.fight': '对决',
        'state.ko': '胜负已分',
        'ko.title': '胜',
        'ko.subtitle': '对手力竭，剑势已收',
        'ko.pressAnyKey': '按任意键进入',
        'pause.clickToResume': '点击此处继续',
        'mute.on': '开启音效',
        'mute.off': '关闭音效',
        you: '你',
        enemy: '对手',
      },
      en: {
        title: 'Clock In',
        subtitle: 'The desk is the arena',
        'hint.controls': "A / D move · J jab · H hook · K kick · F uppercut · G sweep · N slide · L block · S crouch · Shift back-hop · Space jump · J/K in air · U super · Esc skip",
        'hint.skip': 'Press Esc to skip this round',
        'skip.button': 'Skip',
        'settings.title': 'Opening duel',
        'settings.sectionName': 'Opening duel',
        'settings.panelTitle': 'Quick settings',
        'settings.enabled': 'Show the opening duel',
        'settings.sound': 'Sound',
        'settings.difficulty': 'Opponent',
        'settings.easy': 'Easy',
        'settings.normal': 'Firm',
        'settings.binds': 'Key bindings',
        'settings.restart': 'One more round',
        'settings.resetBinds': 'Reset keys',
        'settings.close': 'Close',
        'settings.lede': 'A one-round stick-figure duel before the home page loads, then back to work.',
        'settings.bindsNote': 'Click a key, then press the one you want. Esc cancels.',
        'settings.pressKey': 'Press a key…',
        'special.name': 'Rend',
        'special.ready': 'Qi full · press U',
        'special.locked': 'Qi {n}%',
        'special.hint': 'U',
        'start.button': 'Begin',
        'start.hint': 'Press Enter to begin',
        'start.sub': 'Take your stance — the fight starts on your word',
        'roster.you': 'You',
        'roster.enemy': 'Rival',
        'state.ready': 'Ready',
        'state.fight': 'Duel',
        'state.ko': 'Settled',
        'ko.title': 'Victory',
        'ko.subtitle': 'Your rival is out of strength',
        'ko.pressAnyKey': 'Press any key to continue',
        'pause.clickToResume': 'Click here to resume',
        'mute.on': 'Turn sound on',
        'mute.off': 'Turn sound off',
        you: 'You',
        enemy: 'Rival',
      },
    }

    let applyContext = null
    let activeLocale = 'en'
    let translated = null

    function ctxGet(name) {
      try {
        return applyContext?.get?.(name)
      } catch {
        return undefined
      }
    }

    /**
     * Pick the dictionary from the host locale; fall back to English.
     * `LocaleRuntime.getLocale()` returns `{ active, locales, revision }`, so
     * the language id is `snapshot.active` — reading `id`/`locale` off it is
     * what silently pinned the UI to English.
     */
    function pickLocale() {
      try {
        const locale = ctxGet('locale')
        if (!locale) return 'en'
        const snapshot = typeof locale.getLocale === 'function' ? locale.getLocale() : null
        const id = snapshot?.active ?? snapshot?.id ?? snapshot
        return typeof id === 'string' && id.toLowerCase().startsWith('zh') ? 'zh' : 'en'
      } catch {
        return 'en'
      }
    }

    /** Translate one key; a missing key falls back to English, not to the key. */
    function t(key) {
      if (translated) {
        try {
          const value = translated(key)
          if (typeof value === 'string' && value !== key) return value
        } catch { /* fall through to the bundled dictionary */ }
      }
      return DICTS[activeLocale]?.[key] ?? DICTS.en[key] ?? ''
    }

    /* --------------------------------------------------------------- styles */

    /**
     * Injected by `mountStyles()` rather than a `styles.insert` seat: this is a
     * bundle client, and only dynamic plugin runs get that variable. Without
     * this sheet the layer renders as an unstyled div in the overlay seat —
     * a band of canvas above the untouched chat list.
     */
    const CSS = `
.boot-duel-layer {
  position: fixed;
  inset: 0;
  z-index: 2147480000;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  background: #070b14;
  color: #eef4ff;
  font-family: "PingFang SC", "Microsoft YaHei", "Noto Sans SC", system-ui, -apple-system, "Segoe UI", sans-serif;
  overflow: hidden;
  user-select: none;
  transition: opacity ${FADE_MS}ms ease;
  --bd-player: #5ee7ff;
  --bd-enemy: #ff5fa8;
  --bd-gold: #ffcf8a;
  --bd-ink: rgba(9, 14, 24, .72);
}
.boot-duel-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }

/* ---- top plaque: names, bars, state ------------------------------------- */
.boot-duel-hud {
  position: relative; z-index: 3;
  display: flex; flex-direction: column; gap: 10px;
  padding: 20px 26px 0; pointer-events: none;
  text-shadow: 0 1px 3px rgba(0, 0, 0, .8);
}
.boot-duel-bars { display: flex; align-items: center; gap: 22px; }
.boot-duel-bar { flex: 1; display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.boot-duel-bar.is-enemy { align-items: flex-end; }
.boot-duel-bar-head { display: flex; align-items: baseline; gap: 8px; width: 100%; }
.boot-duel-bar.is-enemy .boot-duel-bar-head { flex-direction: row-reverse; }
.boot-duel-bar-label {
  font-size: 15px; font-weight: 700; letter-spacing: .16em;
  color: var(--bd-gold);
}
.boot-duel-bar-label.is-player { color: var(--bd-player); }
.boot-duel-bar-hp { font-size: 12px; opacity: .72; font-variant-numeric: tabular-nums; letter-spacing: .06em; }
.boot-duel-bar-track {
  position: relative; width: 100%; height: 13px; border-radius: 7px; overflow: hidden;
  background: rgba(4, 8, 16, .78);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .2), inset 0 2px 6px rgba(0, 0, 0, .7);
}
.boot-duel-bar-ghost {
  position: absolute; inset: 0 auto 0 0; height: 100%;
  background: rgba(255, 236, 210, .55);
  transition: width 460ms cubic-bezier(.2, .8, .3, 1) 140ms;
}
.boot-duel-bar.is-enemy .boot-duel-bar-ghost { left: auto; right: 0; }
.boot-duel-bar-fill {
  position: absolute; inset: 0 auto 0 0; height: 100%;
  transition: width 110ms linear;
  background: linear-gradient(180deg, var(--bd-enemy-hot, #ffd4e8) 0%, var(--bd-enemy, #ff5fa8) 34%, #b3115c 100%);
  box-shadow: 0 0 14px rgba(255, 95, 168, .75), inset 0 1px 0 rgba(255, 255, 255, .5);
}
.boot-duel-bar.is-player .boot-duel-bar-fill {
  background: linear-gradient(180deg, #d8fdff 0%, var(--bd-player) 34%, #12708f 100%);
  box-shadow: 0 0 14px rgba(94, 231, 255, .7), inset 0 1px 0 rgba(255, 255, 255, .55);
}
.boot-duel-bar.is-enemy .boot-duel-bar-fill { left: auto; right: 0; }
.boot-duel-bar.is-low .boot-duel-bar-fill {
  animation: boot-duel-pulse 760ms ease-in-out infinite;
  background: linear-gradient(180deg, #ffb3b3 0%, #ff4a4a 38%, #7d1010 100%);
  box-shadow: 0 0 18px rgba(255, 74, 74, .85), inset 0 1px 0 rgba(255, 255, 255, .45);
}
.boot-duel-bar.is-empty .boot-duel-bar-track { animation: boot-duel-flash 260ms steps(2) infinite; }
.boot-duel-mid {
  flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; gap: 2px;
  min-width: 88px;
}
.boot-duel-mid-mark {
  font-family: "STKaiti", "KaiTi", "Kaiti SC", "Songti SC", serif;
  font-size: 20px; font-weight: 700; letter-spacing: .26em;
  color: var(--bd-gold); opacity: .92;
  text-shadow: 0 0 22px rgba(255, 190, 120, .5);
}
.boot-duel-mid-state {
  font-size: 10px; letter-spacing: .34em; opacity: .55; text-transform: uppercase;
}

/* ---- qi meter + finisher call ------------------------------------------ */
.boot-duel-meter {
  display: flex; align-items: center; gap: 10px; margin-top: 4px;
  pointer-events: none; width: min(340px, 42vw);
}
.boot-duel-meter-label {
  font-family: "STKaiti", "KaiTi", "Kaiti SC", "Songti SC", serif;
  font-size: 15px; font-weight: 700; color: var(--bd-gold);
  text-shadow: 0 0 14px rgba(255, 180, 100, .55);
  flex: 0 0 auto;
}
.boot-duel-meter-track {
  position: relative; flex: 1; height: 8px; border-radius: 5px; overflow: hidden;
  background: rgba(4, 8, 16, .8);
  box-shadow: inset 0 0 0 1px rgba(255, 210, 150, .28);
}
.boot-duel-meter-fill {
  position: absolute; inset: 0 auto 0 0; height: 100%;
  background: linear-gradient(90deg, #a55a1a, #ffb455 55%, #fff0c8);
  box-shadow: 0 0 12px rgba(255, 170, 80, .7);
  transition: width 180ms ease;
}
.boot-duel-meter.is-full .boot-duel-meter-track {
  box-shadow: inset 0 0 0 1px rgba(255, 236, 190, .75), 0 0 18px rgba(255, 190, 110, .55);
}
.boot-duel-meter.is-full .boot-duel-meter-fill {
  animation: boot-duel-meter-glow 1.1s ease-in-out infinite;
}
.boot-duel-meter-key {
  flex: 0 0 auto; font-size: 10px; font-weight: 700; letter-spacing: .12em;
  padding: 2px 7px; border-radius: 5px; color: #1a1206;
  background: linear-gradient(180deg, #ffe6b8, #ffc271);
  opacity: .35;
}
.boot-duel-meter.is-full .boot-duel-meter-key {
  opacity: 1; animation: boot-duel-breathe 1.4s ease-in-out infinite;
}
.boot-duel-meter-tip {
  flex: 0 0 auto; font-size: 11px; letter-spacing: .1em; color: var(--bd-gold);
  opacity: 0; transition: opacity 220ms ease;
}
.boot-duel-meter.is-full .boot-duel-meter-tip { opacity: .95; }

/* ---- bottom rail: controls + buttons ------------------------------------ */
.boot-duel-hints {
  display: flex; justify-content: space-between; align-items: flex-end; gap: 16px;
  font-size: 12px; opacity: .8; padding: 0 26px 18px; margin-top: auto;
  pointer-events: none; position: relative; z-index: 3;
}
.boot-duel-keys { display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: center; }
.boot-duel-key { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.boot-duel-key b {
  display: inline-block; min-width: 20px; padding: 1px 6px;
  font: inherit; font-size: 11px; font-weight: 700; text-align: center;
  color: #0b1220; background: linear-gradient(180deg, #fff, #cfe0f0);
  border-radius: 5px; box-shadow: 0 1px 0 rgba(0, 0, 0, .55), inset 0 -1px 0 rgba(0, 0, 0, .18);
}
.boot-duel-hint-key { color: #a9dcff; font-size: 12px; letter-spacing: .05em; }
.boot-duel-controls { pointer-events: auto; display: flex; gap: 8px; align-items: center; }
.boot-duel-btn {
  pointer-events: auto; cursor: pointer; font: inherit; font-size: 12px;
  color: #dbe9ff; background: rgba(255, 255, 255, .07);
  border: 1px solid rgba(255, 255, 255, .2); border-radius: 9px; padding: 5px 12px;
  backdrop-filter: blur(6px);
}
.boot-duel-btn:hover { background: rgba(255, 255, 255, .16); }
.boot-duel-btn[aria-pressed="true"] { background: rgba(94, 231, 255, .2); border-color: rgba(94, 231, 255, .5); }
.boot-duel-btn:disabled { opacity: .4; cursor: default; }
.boot-duel-skip {
  pointer-events: auto; cursor: pointer; font: inherit; font-size: 13px; letter-spacing: .1em;
  color: #eef4ff; background: var(--bd-ink); border: 1px solid rgba(255, 255, 255, .26);
  border-radius: 999px; padding: 9px 20px; backdrop-filter: blur(6px);
}
.boot-duel-skip:hover { background: rgba(255, 255, 255, .18); }

.boot-duel-focus { position: absolute; inset: 0; outline: none; pointer-events: none; }

/* ---- the "press Enter" gate -------------------------------------------- */
.boot-duel-gate {
  position: absolute; inset: 0; z-index: 4;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 18px; pointer-events: none; text-align: center;
  padding-bottom: 22vh;
  background:
    linear-gradient(180deg, rgba(4, 8, 16, .55) 0%, rgba(4, 8, 16, .12) 34%, rgba(4, 8, 16, .1) 62%, rgba(4, 8, 16, .62) 100%);
  animation: boot-duel-gate-in 520ms ease both;
}
.boot-duel-gate-title {
  display: flex; flex-direction: column; gap: 6px; align-items: center;
}
.boot-duel-gate-main {
  font-family: "STKaiti", "KaiTi", "Kaiti SC", "Songti SC", serif;
  font-size: clamp(44px, 7vw, 86px); font-weight: 700; letter-spacing: .18em;
  color: #fff6e6; text-shadow: 0 0 34px rgba(255, 190, 120, .55), 0 2px 8px rgba(0, 0, 0, .8);
}
.boot-duel-gate-sub {
  font-size: 13px; letter-spacing: .3em; color: var(--bd-gold); opacity: .85;
}
.boot-duel-gate-call {
  pointer-events: auto; cursor: pointer; font: inherit;
  display: inline-flex; align-items: center; gap: 10px;
  padding: 12px 30px; border-radius: 999px;
  font-size: 16px; letter-spacing: .16em; color: #1a1206;
  background: linear-gradient(180deg, #ffe6b8, #ffc271);
  border: 0; box-shadow: 0 6px 26px rgba(255, 176, 94, .35), inset 0 -2px 0 rgba(0, 0, 0, .18);
  animation: boot-duel-breathe 2.4s ease-in-out infinite;
}
.boot-duel-gate-call:hover { filter: brightness(1.07); }
.boot-duel-gate-call kbd {
  font: inherit; font-size: 12px; font-weight: 700; letter-spacing: .06em;
  padding: 2px 7px; border-radius: 6px;
  background: rgba(26, 18, 6, .82); color: #ffe6b8;
}
.boot-duel-gate-note { font-size: 12px; letter-spacing: .14em; opacity: .6; }

/* ---- KO: the seal ------------------------------------------------------ */
.boot-duel-ko {
  position: absolute; inset: 0; z-index: 4;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 14px; pointer-events: none; text-align: center;
  /* Sit the seal above the fighters: the body reads as the aftermath. */
  padding-bottom: 26vh;
  background: linear-gradient(180deg, rgba(4, 8, 16, .62) 0%, rgba(4, 8, 16, .1) 36%, rgba(4, 8, 16, .1) 58%, rgba(4, 8, 16, .66) 100%);
}
.boot-duel-ko-seal {
  width: clamp(120px, 15vw, 176px); height: clamp(120px, 15vw, 176px);
  display: grid; place-items: center; border-radius: 16px;
  border: 5px solid rgba(255, 244, 232, .94);
  background: rgba(150, 26, 34, .55);
  box-shadow: 0 0 70px rgba(255, 90, 120, .45), inset 0 0 40px rgba(255, 200, 180, .3);
  animation: boot-duel-seal 520ms cubic-bezier(.16, 1.5, .3, 1) both;
}
.boot-duel-ko-char {
  font-family: "STKaiti", "KaiTi", "Kaiti SC", "Songti SC", serif;
  font-size: clamp(62px, 9vw, 100px); font-weight: 700; line-height: 1;
  color: #fff8f0; text-shadow: 0 0 30px rgba(255, 110, 130, .9);
}
.boot-duel-ko-sub { font-size: 14px; letter-spacing: .26em; opacity: .85; animation: boot-duel-fade 600ms ease 260ms both; }
.boot-duel-ko-hint { font-size: 12px; letter-spacing: .2em; opacity: .62; animation: boot-duel-fade 500ms ease 700ms both; }

/* The host settings section. The host owns the surrounding chrome, so this
   is deliberately plain: a title, a lede, rows, and nothing that fights the
   host's own typography. */
.boot-duel-host-section { display: flex; flex-direction: column; gap: 12px; max-width: 560px; }
.boot-duel-host-title { margin: 0; font-size: 15px; font-weight: 700; letter-spacing: .04em; }
.boot-duel-host-lede { margin: 0; font-size: 12.5px; line-height: 1.6; opacity: .72; }
.boot-duel-host-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; padding: 7px 0; font-size: 13px; cursor: pointer;
  border-bottom: 1px solid rgba(128, 138, 152, .16);
}
.boot-duel-host-label { flex: 1; }
.boot-duel-host-row input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; }
.boot-duel-host-row select {
  font: inherit; padding: 3px 8px; border-radius: 6px;
  border: 1px solid rgba(128, 138, 152, .3);
  background: transparent; color: inherit; cursor: pointer;
}
.boot-duel-host-note { margin: 4px 0 0; font-size: 12px; line-height: 1.6; opacity: .6; }
.boot-duel-host-section-head {
  margin: 14px 0 8px; padding-top: 12px; font-size: 12px;
  letter-spacing: .14em; opacity: .62;
  border-top: 1px solid rgba(128, 138, 152, .16);
}
.boot-duel-host-binds {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 18px;
}
.boot-duel-host-bind {
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px; font-size: 13px; cursor: pointer;
}
.boot-duel-host-bind-label { flex: 1; opacity: .82; }
.boot-duel-host-actions { display: flex; gap: 8px; margin-top: 12px; }
.boot-duel-host-icon { display: grid; place-items: center; font-size: 15px; }

.boot-duel-gear {
  position: absolute; top: 12px; right: 14px; z-index: 6;
  width: 30px; height: 30px; border-radius: 50%;
  display: grid; place-items: center;
  font-size: 15px; line-height: 1; cursor: pointer;
  color: #23303f; background: rgba(255, 255, 255, .62);
  border: 1px solid rgba(30, 42, 56, .18);
  box-shadow: 0 2px 8px rgba(30, 42, 56, .14);
  transition: background .15s, transform .15s;
}
.boot-duel-gear:hover { background: rgba(255, 255, 255, .92); transform: rotate(24deg); }

.boot-duel-settings {
  position: absolute; top: 50px; right: 14px; z-index: 7;
  width: min(390px, calc(100% - 28px));
  max-height: calc(100% - 80px); overflow-y: auto;
  padding: 16px 18px 18px; border-radius: 12px;
  background: rgba(252, 252, 254, .98);
  border: 1px solid rgba(30, 42, 56, .16);
  box-shadow: 0 18px 48px rgba(20, 28, 38, .28);
  color: #1b2430;
  font: 13px/1.5 "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
}
.boot-duel-set-title {
  margin: 0 0 12px; font-size: 15px; font-weight: 700; letter-spacing: .08em;
}
.boot-duel-set-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; padding: 6px 0; cursor: pointer;
}
.boot-duel-set-label { color: #3a4757; }
.boot-duel-set-row input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; }
.boot-duel-set-row select {
  font: inherit; padding: 3px 8px; border-radius: 6px;
  border: 1px solid rgba(30, 42, 56, .22); background: #fff;
}
.boot-duel-set-section {
  margin: 14px 0 8px; padding-top: 12px; font-size: 12px;
  letter-spacing: .14em; color: #6b7889;
  border-top: 1px solid rgba(30, 42, 56, .12);
}
.boot-duel-set-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 14px; }
.boot-duel-set-bind {
  min-width: 74px; padding: 3px 9px; font: inherit; font-size: 12px;
  font-weight: 600; cursor: pointer; border-radius: 6px;
  color: #1b2430; background: #eef2f6; border: 1px solid rgba(30, 42, 56, .16);
}
.boot-duel-set-bind:hover { background: #e2e9f0; }
.boot-duel-set-bind.is-listening {
  color: #fff; background: #2f6f8f; border-color: #2f6f8f;
  animation: boot-duel-pulse 700ms ease-in-out infinite;
}
.boot-duel-set-actions {
  display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px;
  padding-top: 14px; border-top: 1px solid rgba(30, 42, 56, .12);
}
.boot-duel-set-btn {
  padding: 6px 14px; font: inherit; font-size: 12px; font-weight: 600;
  cursor: pointer; border-radius: 7px;
  color: #1b2430; background: #eef2f6; border: 1px solid rgba(30, 42, 56, .16);
}
.boot-duel-set-btn:hover { background: #e2e9f0; }
.boot-duel-set-btn.is-primary { color: #fff; background: #c8321e; border-color: #c8321e; }
.boot-duel-set-btn.is-primary:hover { background: #b02a18; }

.boot-duel-pause {
  position: absolute; inset: 0; z-index: 5; display: flex; align-items: center; justify-content: center;
  pointer-events: auto; cursor: pointer; background: rgba(3, 5, 10, .72);
  font: inherit; font-size: 16px; letter-spacing: .1em; color: #eef4ff; border: 0;
}

@keyframes boot-duel-seal {
  from { opacity: 0; transform: scale(.55) rotate(-11deg); }
  to { opacity: 1; transform: none; }
}
@keyframes boot-duel-gate-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes boot-duel-breathe { 0%, 100% { transform: translateY(0); box-shadow: 0 6px 26px rgba(255, 176, 94, .3); } 50% { transform: translateY(-3px); box-shadow: 0 10px 34px rgba(255, 176, 94, .46); } }
@keyframes boot-duel-fade { from { opacity: 0; } to { opacity: .85; } }
@keyframes boot-duel-flash { 50% { box-shadow: inset 0 0 0 2px #ff3b3b, 0 0 18px #ff3b3b; } }
@keyframes boot-duel-pulse { 50% { filter: brightness(1.45); } }
@keyframes boot-duel-meter-glow { 50% { filter: brightness(1.5); } }

/* ---- the finisher's name card ------------------------------------------ */
.boot-duel-special {
  position: absolute; inset: 0; z-index: 4;
  display: flex; align-items: center; justify-content: flex-start;
  pointer-events: none; padding-left: 8vw;
  background: linear-gradient(90deg, rgba(6, 4, 2, .82) 0%, rgba(6, 4, 2, .42) 42%, rgba(6, 4, 2, 0) 72%);
  animation: boot-duel-special-in 180ms ease both;
}
.boot-duel-special-name {
  font-family: "STKaiti", "KaiTi", "Kaiti SC", "Songti SC", serif;
  font-size: clamp(60px, 11vw, 150px); font-weight: 700; line-height: 1.05;
  letter-spacing: .12em; color: #fffaf0;
  writing-mode: vertical-rl;
  text-shadow: 0 0 40px rgba(255, 150, 60, .85), 0 0 90px rgba(255, 90, 20, .55);
  animation: boot-duel-special-sweep 620ms cubic-bezier(.16, .9, .3, 1) both;
}
.boot-duel-special-sub {
  margin-left: 22px; font-size: 13px; letter-spacing: .34em;
  color: var(--bd-gold); opacity: .9;
  animation: boot-duel-fade 500ms ease 160ms both;
}
@keyframes boot-duel-special-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes boot-duel-special-sweep {
  from { opacity: 0; transform: translateX(-40px) scale(1.16); filter: blur(6px); }
  to { opacity: 1; transform: none; filter: none; }
}
@media (prefers-reduced-motion: reduce) {
  .boot-duel-gate-call, .boot-duel-bar.is-low .boot-duel-bar-fill,
  .boot-duel-ko-seal, .boot-duel-ko-sub, .boot-duel-ko-hint,
  .boot-duel-bar.is-empty .boot-duel-bar-track, .boot-duel-gate { animation: none; }
  .boot-duel-layer { transition: none; }
}
@media (max-width: 720px) {
  .boot-duel-hud { padding: 14px 16px 0; }
  .boot-duel-hints { flex-direction: column; align-items: flex-start; gap: 10px; padding: 0 16px 14px; }
  .boot-duel-key span { display: none; }
}
`

    /** Insert the sheet once; the returned disposer removes only this insert. */
    function mountStyles() {
      let inserted = null
      try {
        // A previous mount (hot reload, re-enable) may have left the sheet; it
        // is ours by id, but we did not insert it in this run, so it stays.
        if (document.getElementById(STYLE_ID)) return () => {}
        const tag = document.createElement('style')
        tag.id = STYLE_ID
        tag.setAttribute('data-plugin', PKG_ID)
        tag.textContent = CSS
        document.head.appendChild(tag)
        inserted = tag
      } catch (error) {
        logError('style injection failed', error)
      }
      return () => {
        if (!inserted) return
        try { inserted.remove() } catch { /* ignore */ }
      }
    }

    /* -------------------------------------------------------------- runtime */

    /** Resolved config and facts read once, on first mount. */
    const runtime = {
      config: { ...DEFAULT_CONFIG },
      reducedMotion: false,
    }

    /**
     * Ask the package's own Host half for `{ enabled, difficulty }`.
     *
     * `host.call` is the dynamic-run RPC and does not exist in a bundle
     * client, so the route registered by `index.js` is the only channel. A
     * failure is harmless: the defaults here equal the patch defaults.
     */
    async function fetchConfig() {
      try {
        const response = await fetch(CONFIG_URL, { cache: 'no-store', credentials: 'same-origin' })
        if (!response.ok) throw new Error(`config route answered ${response.status}`)
        const value = await response.json()
        return value && typeof value === 'object' ? value : null
      } catch (error) {
        logError('config read failed, using defaults', error)
        return null
      }
    }

    function applyConfig(value) {
      if (!value) return
      runtime.config = {
        enabled: value.enabled !== false,
        difficulty: value.difficulty === 'normal' ? 'normal' : 'easy',
      }
      if (value.enabled === false) store.hide()
    }

    /** Whether the layer is still mounted; flipped by `store.hide()`. */
    const store = {
      visible: true,
      listeners: new Set(),
      subscribe(listener) {
        store.listeners.add(listener)
        return () => store.listeners.delete(listener)
      },
      hide() {
        store.visible = false
        for (const listener of [...store.listeners]) listener()
      },
    }

    /**
     * Player settings, persisted across reloads.
     *
     * Three things live here that the host config cannot: the on/off switch
     * the PLAYER controls (so the opening can be dismissed for good without
     * touching the plugin config), the sound preference, and the key binds.
     *
     * Storage is wrapped because private mode throws on access, and a plugin
     * that cannot remember a preference must still run.
     */
    const SETTINGS_KEY = 'dsh-boot-duel:settings'
    function loadSettings() {
      const base = {
        /** Player-level off switch: false means the layer never mounts. */
        enabled: true,
        sound: true,
        difficulty: runtime.config.difficulty || 'easy',
        /** Key binds, as an input field -> KeyboardEvent.code. */
        binds: null,
      }
      try {
        const raw = window.localStorage?.getItem(SETTINGS_KEY)
        if (!raw) return base
        const saved = JSON.parse(raw)
        return {
          ...base,
          ...(typeof saved.enabled === 'boolean' ? { enabled: saved.enabled } : {}),
          ...(typeof saved.sound === 'boolean' ? { sound: saved.sound } : {}),
          ...(saved.difficulty === 'easy' || saved.difficulty === 'normal' ? { difficulty: saved.difficulty } : {}),
          ...(saved.binds && typeof saved.binds === 'object' ? { binds: saved.binds } : {}),
        }
      } catch {
        return base
      }
    }
    function saveSettings(next) {
      try {
        window.localStorage?.setItem(SETTINGS_KEY, JSON.stringify(next))
      } catch { /* a full or blocked store is not fatal */ }
    }

    /** The live settings. Read once at boot, written on every change. */
    let settings = loadSettings()

    function updateSettings(patch) {
      settings = { ...settings, ...patch }
      saveSettings(settings)
      for (const listener of [...settingsListeners]) listener(settings)
    }
    const settingsListeners = new Set()

    function logError(message, error) {
      try {
        console.error(`[dsh-boot-duel] ${message}`, error instanceof Error ? error.message : error)
      } catch { /* logging must never throw */ }
    }

    function readReducedMotion() {
      try {
        return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)
      } catch {
        return false
      }
    }

    /**
     * True when the keystroke belongs to something the user is typing into.
     * The layer is modal and covers the frame, but a broken/blocked stylesheet
     * must never turn this handler into a keyboard trap for the app beneath.
     */
    function isTypingTarget(target) {
      if (!target || typeof target !== 'object') return false
      const tag = typeof target.tagName === 'string' ? target.tagName.toLowerCase() : ''
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
      return target.isContentEditable === true
    }

    /** True while another modal dialog owns the frame (host settings, pickers…). */
    function isForeignDialog(target) {
      try {
        const node = target && typeof target.closest === 'function' ? target : null
        if (node && node.closest('.boot-duel-layer')) return false
        const dialog = document.querySelector('[role="dialog"][aria-modal="true"]:not(.boot-duel-layer)')
        return Boolean(dialog)
      } catch {
        return false
      }
    }

    /* --------------------------------------------------------------- layer */

    /**
     * One health bar. The `ghost` layer is the slow, pale trail that shows how
     * much was just taken off — the read that makes damage feel like damage
     * rather than a width recalculation.
     */
    function healthBar(kind, label, hp) {
      const value = Math.max(0, Math.min(100, Math.round(hp)))
      const low = kind === 'player' && value <= 25 && value > 0
      return React.createElement('div', {
        className: `boot-duel-bar is-${kind}${value <= 0 ? ' is-empty' : ''}${low ? ' is-low' : ''}`,
      },
        React.createElement('div', { className: 'boot-duel-bar-head' },
          React.createElement('span', {
            className: `boot-duel-bar-label${kind === 'player' ? ' is-player' : ''}`,
          }, label),
          React.createElement('span', { className: 'boot-duel-bar-hp' }, `${value} / 100`),
        ),
        React.createElement('div', {
          className: 'boot-duel-bar-track',
          role: 'progressbar',
          'aria-valuenow': value,
          'aria-valuemin': 0,
          'aria-valuemax': 100,
          'aria-label': label,
        },
          React.createElement('div', { className: 'boot-duel-bar-ghost', style: { width: `${value}%` } }),
          React.createElement('div', { className: 'boot-duel-bar-fill', style: { width: `${value}%` } }),
        ),
      )
    }

    /** `[key, label]` rows for the control rail. */
    const KEY_ROWS = [
      ['A / D', '移动'],
      ['J', '直拳'],
      ['H', '摆拳'],
      ['K', '踢击'],
      ['F', '上勾'],
      ['G', '扫腿'],
      ['N', '滑铲'],
      ['L', '格挡'],
      ['S', '下蹲'],
      ['Shift', '后跳'],
      ['空格', '跳跃'],
      ['空中 J/K', '空袭'],
      ['U', '大招'],
      ['Esc', '跳过'],
    ]

    function controlRail() {
      return React.createElement('div', { className: 'boot-duel-keys' },
        KEY_ROWS.map(([key, label]) => React.createElement('span', { key, className: 'boot-duel-key' },
          React.createElement('b', null, key),
          React.createElement('span', null, label),
        )),
      )
    }

    /** The qi meter. Full means the finisher is available right now. */
    function qiMeter(meter, specialReady) {
      const value = Math.max(0, Math.min(100, Math.round(meter ?? 0)))
      return React.createElement('div', {
        className: `boot-duel-meter${specialReady ? ' is-full' : ''}`,
      },
        React.createElement('span', { className: 'boot-duel-meter-label' }, '气'),
        React.createElement('div', {
          className: 'boot-duel-meter-track',
          role: 'progressbar',
          'aria-valuenow': value,
          'aria-valuemin': 0,
          'aria-valuemax': 100,
          'aria-label': '气',
        }, React.createElement('div', { className: 'boot-duel-meter-fill', style: { width: `${value}%` } })),
        React.createElement('span', { className: 'boot-duel-meter-key' }, t('special.hint')),
        React.createElement('span', { className: 'boot-duel-meter-tip' },
          specialReady ? t('special.ready') : t('special.locked').replace('{n}', String(value))),
      )
    }

    /**
     * The settings panel.
     *
     * It exists because the opening animation is the FIRST thing a returning
     * user sees, and the only way to be rid of it used to be the host config
     * file. Everything a player might reasonably want is here: turn it off,
     * turn the sound off, change the bindings, pick a difficulty, or play one
     * more round.
     */
    /** The default key per action, matching sim/session.mjs. */
    const DEFAULT_BINDS = {
      left: 'KeyA', right: 'KeyD', jump: 'Space', jab: 'KeyJ', hook: 'KeyH',
      kick: 'KeyK', uppercut: 'KeyF', sweep: 'KeyG', slide: 'KeyN',
      block: 'KeyL', crouch: 'KeyS', retreat: 'ShiftLeft', special: 'KeyU',
    }

    /** How a key code is shown on a button. */
    const KEY_LABEL = {
      KeyA: 'A', KeyB: 'B', KeyC: 'C', KeyD: 'D', KeyE: 'E', KeyF: 'F', KeyG: 'G',
      KeyH: 'H', KeyI: 'I', KeyJ: 'J', KeyK: 'K', KeyL: 'L', KeyM: 'M', KeyN: 'N',
      KeyO: 'O', KeyP: 'P', KeyQ: 'Q', KeyR: 'R', KeyS: 'S', KeyT: 'T', KeyU: 'U',
      KeyV: 'V', KeyW: 'W', KeyX: 'X', KeyY: 'Y', KeyZ: 'Z',
      Space: '空格', ShiftLeft: '左Shift', ShiftRight: '右Shift',
      Enter: '回车', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
    }

    /**
     * Map a physical key onto an action, honouring the player's binds.
     *
     * The bindings are checked FIRST, then the defaults, so a rebound key wins
     * over the built-in one and a bind that collides with a default does not
     * silently disable the default.
     */
    function actionForCode(code, binds) {
      if (binds) {
        for (const [action, bound] of Object.entries(binds)) {
          if (bound === code) return action
        }
      }
      return null
    }

    const BINDABLE = [
      ['left', '左移'], ['right', '右移'], ['jump', '跳跃'],
      ['jab', '直拳'], ['hook', '摆拳'], ['kick', '踢击'],
      ['uppercut', '上勾'], ['sweep', '扫腿'], ['slide', '滑铲'],
      ['block', '格挡'], ['crouch', '下蹲'], ['retreat', '后跳'],
      ['special', '大招'],
    ]

    function SettingsPanel({ onClose, onRestart, audio }) {
      const [local, setLocal] = React.useState(settings)
      const [listening, setListening] = React.useState(null)

      React.useEffect(() => {
        if (!listening) return undefined
        function onKey(e) {
          e.preventDefault()
          e.stopPropagation()
          if (e.code === 'Escape') { setListening(null); return }
          // One key per action; a duplicate binding replaces the old one.
          const nextBinds = { ...(local.binds || {}), [listening]: e.code }
          const updated = { ...local, binds: nextBinds }
          setLocal(updated)
          setListening(null)
          updateSettings({ binds: nextBinds })
        }
        window.addEventListener('keydown', onKey, true)
        return () => window.removeEventListener('keydown', onKey, true)
      }, [listening, local])

      const set = (patch) => { const next = { ...local, ...patch }; setLocal(next); updateSettings(patch) }

      const row = (key, label) => React.createElement('label', { key, className: 'boot-duel-set-row' },
        React.createElement('span', { className: 'boot-duel-set-label' }, label),
        React.createElement('button', {
          type: 'button',
          className: `boot-duel-set-bind${listening === key ? ' is-listening' : ''}`,
          onClick: () => setListening(listening === key ? null : key),
        }, listening === key ? '按下新键…' : (KEY_LABEL[local.binds?.[key]] || KEY_LABEL[DEFAULT_BINDS[key]] || '—')),
      )

      return React.createElement('div', {
        className: 'boot-duel-settings',
        role: 'dialog',
        'aria-label': t('settings.panelTitle'),
        onClick: (e) => e.stopPropagation(),
      },
        React.createElement('h2', { className: 'boot-duel-set-title' }, t('settings.panelTitle')),

        // --- on/off -------------------------------------------------
        React.createElement('label', { className: 'boot-duel-set-row' },
          React.createElement('span', { className: 'boot-duel-set-label' }, t('settings.enabled')),
          React.createElement('input', {
            type: 'checkbox',
            checked: local.enabled,
            onChange: (e) => set({ enabled: e.target.checked }),
          }),
        ),
        // --- sound --------------------------------------------------
        React.createElement('label', { className: 'boot-duel-set-row' },
          React.createElement('span', { className: 'boot-duel-set-label' }, t('settings.sound')),
          React.createElement('input', {
            type: 'checkbox',
            checked: local.sound,
            onChange: (e) => {
              set({ sound: e.target.checked })
              try { audio?.setMuted?.(!e.target.checked) } catch { /* ignore */ }
            },
          }),
        ),
        // --- difficulty ---------------------------------------------
        React.createElement('label', { className: 'boot-duel-set-row' },
          React.createElement('span', { className: 'boot-duel-set-label' }, t('settings.difficulty')),
          React.createElement('select', {
            value: local.difficulty,
            onChange: (e) => set({ difficulty: e.target.value }),
          },
            React.createElement('option', { value: 'easy' }, t('settings.easy')),
            React.createElement('option', { value: 'normal' }, t('settings.normal')),
          ),
        ),

        // --- key binds ----------------------------------------------
        React.createElement('div', { className: 'boot-duel-set-section' }, t('settings.binds')),
        React.createElement('div', { className: 'boot-duel-set-grid' },
          BINDABLE.map(([key, label]) => row(key, label))),

        // --- actions ------------------------------------------------
        React.createElement('div', { className: 'boot-duel-set-actions' },
          React.createElement('button', {
            type: 'button', className: 'boot-duel-set-btn is-primary',
            onClick: () => { setListening(null); onRestart() },
          }, t('settings.restart')),
          React.createElement('button', {
            type: 'button', className: 'boot-duel-set-btn',
            onClick: () => { updateSettings({ binds: null }); setLocal({ ...local, binds: null }) },
          }, t('settings.resetBinds')),
          React.createElement('button', {
            type: 'button', className: 'boot-duel-set-btn',
            onClick: onClose,
          }, t('settings.close')),
        ),
      )
    }

    /**
     * The section the host settings page renders.
     *
     * It edits the SAME stored preferences as the in-game gear, so the two
     * panels can never disagree. The difference is presentation: this one sits
     * in the host's own settings column, which is where a user looks for
     * "turn this plugin off" — and it has to work while the game layer is not
     * mounted, because "off" is one of the things it can set.
     */
    function HostSettingsSection() {
      const [local, setLocal] = React.useState(settings)
      /** The action waiting for a new key, or null. */
      const [listening, setListening] = React.useState(null)

      // Pick up changes made elsewhere (the in-game gear) while this is open.
      React.useEffect(() => {
        const listener = (next) => setLocal({ ...next })
        settingsListeners.add(listener)
        return () => settingsListeners.delete(listener)
      }, [])

      const patch = (next) => { setLocal({ ...local, ...next }); updateSettings(next) }

      // While a bind is being captured, the next key becomes that action's key.
      // Escape cancels; the capture runs in the CAPTURE phase so nothing else
      // sees the key first.
      React.useEffect(() => {
        if (!listening) return undefined
        function onKey(e) {
          e.preventDefault()
          e.stopPropagation()
          if (e.code === 'Escape') { setListening(null); return }
          patch({ binds: { ...(local.binds || {}), [listening]: e.code } })
          setListening(null)
        }
        window.addEventListener('keydown', onKey, true)
        return () => window.removeEventListener('keydown', onKey, true)
      }, [listening, local])

      const row = (label, control) => React.createElement('label', { className: 'boot-duel-host-row' },
        React.createElement('span', { className: 'boot-duel-host-label' }, label),
        control,
      )

      return React.createElement('div', { className: 'boot-duel-host-section' },
        React.createElement('h3', { className: 'boot-duel-host-title' }, t('title')),
        React.createElement('p', { className: 'boot-duel-host-lede' }, t('settings.lede')),

        row(t('settings.enabled'),
          React.createElement('input', {
            type: 'checkbox',
            checked: local.enabled,
            onChange: (e) => patch({ enabled: e.target.checked }),
          })),

        row(t('settings.sound'),
          React.createElement('input', {
            type: 'checkbox',
            checked: local.sound,
            onChange: (e) => patch({ sound: e.target.checked }),
          })),

        row(t('settings.difficulty'),
          React.createElement('select', {
            value: local.difficulty,
            onChange: (e) => patch({ difficulty: e.target.value }),
          },
            React.createElement('option', { value: 'easy' }, t('settings.easy')),
            React.createElement('option', { value: 'normal' }, t('settings.normal')),
          )),

        React.createElement('div', { className: 'boot-duel-host-section-head' }, t('settings.binds')),
        React.createElement('div', { className: 'boot-duel-host-binds' },
          BINDABLE.map(([key, label]) => React.createElement('label', {
            key,
            className: 'boot-duel-host-bind',
          },
            React.createElement('span', { className: 'boot-duel-host-bind-label' }, label),
            React.createElement('button', {
              type: 'button',
              className: `boot-duel-set-bind${listening === key ? ' is-listening' : ''}`,
              onClick: () => setListening(listening === key ? null : key),
            }, listening === key
              ? t('settings.pressKey')
              : (KEY_LABEL[local.binds?.[key]] || KEY_LABEL[DEFAULT_BINDS[key]] || '—')),
          ))),

        React.createElement('div', { className: 'boot-duel-host-actions' },
          React.createElement('button', {
            type: 'button',
            className: 'boot-duel-set-btn',
            onClick: () => { patch({ binds: null }) },
          }, t('settings.resetBinds')),
        ),

        React.createElement('p', { className: 'boot-duel-host-note' }, t('settings.bindsNote')),
      )
    }

    /** The mark beside the section in the settings list. */
    function SettingsSectionIcon() {
      return React.createElement('span', {
        className: 'boot-duel-host-icon',
        'aria-hidden': 'true',
      }, '⚔')
    }

    function BootDuel() {
      const [snapshot, setSnapshot] = React.useState(null)
      /** Settings panel visibility. */
      const [showSettings, setShowSettings] = React.useState(false)
      const [muted, setMuted] = React.useState(true)
      const [audioReady, setAudioReady] = React.useState(true)
      const [paused, setPaused] = React.useState(false)
      const [fading, setFading] = React.useState(false)

      const layerRef = React.useRef(null)
      const canvasRef = React.useRef(null)
      const focusRef = React.useRef(null)
      const engineRef = React.useRef(null)

      React.useEffect(() => {
        let teardown = () => {}
        try {
          teardown = mountLayer({
            layerRef, canvasRef, focusRef, engineRef,
            setSnapshot, setPaused, setFading, setAudioReady,
          })
        } catch (error) {
          logError('layer setup failed, letting the user through', error)
          window.setTimeout(() => store.hide(), 0)
        }
        return () => {
          try { teardown() } catch (error) { logError('teardown failed', error) }
        }
      }, [])

      const snapshotValue = snapshot
      const phase = snapshotValue?.phase ?? 'ready'
      const inOutro = phase === 'ko' || phase === 'done'
      const isReady = phase === 'ready'
      const opacity = fading ? 0 : (snapshotValue?.fadeOpacity ?? 1)
      const playerHp = snapshotValue?.player.hp ?? 100
      const enemyHp = snapshotValue?.enemy.hp ?? 100

      const toggleMute = () => {
        const engine = engineRef.current
        if (!engine) return
        const next = !engine.audio.isMuted()
        engine.audio.setMuted(next)
        setMuted(next)
        if (!next) engine.audio.play('clink')
      }

      const begin = () => {
        const engine = engineRef.current
        if (!engine) return
        engine.begin?.()
      }

      const stateLabel = isReady ? t('state.ready') : inOutro ? t('state.ko') : t('state.fight')

      return React.createElement('div', {
        className: 'boot-duel-layer',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': t('title'),
        'data-phase': phase,
        ref: layerRef,
        style: { opacity, pointerEvents: fading ? 'none' : 'auto' },
      },
        React.createElement('canvas', { className: 'boot-duel-canvas', ref: canvasRef, 'aria-hidden': 'true' }),

        React.createElement('div', { className: 'boot-duel-hud' },
          React.createElement('div', { className: 'boot-duel-bars' },
            healthBar('player', t('roster.you'), playerHp),
            React.createElement('div', { className: 'boot-duel-mid' },
              React.createElement('span', { className: 'boot-duel-mid-mark' }, '对 决'),
              React.createElement('span', { className: 'boot-duel-mid-state' }, stateLabel),
            ),
            healthBar('enemy', t('roster.enemy'), enemyHp),
          ),
          qiMeter(snapshotValue?.meter ?? 0, Boolean(snapshotValue?.specialReady)),
        ),

        React.createElement('div', { className: 'boot-duel-hints' },
          controlRail(),
          React.createElement('span', { className: 'boot-duel-controls' },
            React.createElement('button', {
              type: 'button',
              className: 'boot-duel-btn',
              'aria-pressed': String(!muted),
              'aria-label': muted ? t('mute.on') : t('mute.off'),
              disabled: !audioReady,
              onClick: toggleMute,
            }, muted ? t('mute.on') : t('mute.off')),
            React.createElement('button', {
              type: 'button',
              className: 'boot-duel-skip',
              onClick: () => engineRef.current?.finish?.(),
            }, t('skip.button')),
          ),
        ),

        // The settings gear, always reachable.
        React.createElement('button', {
          type: 'button',
          className: 'boot-duel-gear',
          'aria-label': t('settings.panelTitle'),
          onClick: (e) => { e.stopPropagation(); setShowSettings((v) => !v) },
        }, '⚙'),

        showSettings
          ? React.createElement(SettingsPanel, {
            audio: engineRef.current?.audio ?? null,
            onClose: () => setShowSettings(false),
            onRestart: () => {
              setShowSettings(false)
              engineRef.current?.restart?.()
            },
          })
          : null,

        React.createElement('div', { className: 'boot-duel-focus', tabIndex: 0, ref: focusRef }),

        // The gate: the fight does not start until the player says so.
        isReady
          ? React.createElement('div', { className: 'boot-duel-gate' },
            React.createElement('div', { className: 'boot-duel-gate-title' },
              React.createElement('span', { className: 'boot-duel-gate-main' }, t('title')),
              React.createElement('span', { className: 'boot-duel-gate-sub' }, t('subtitle')),
            ),
            React.createElement('button', {
              type: 'button',
              className: 'boot-duel-gate-call',
              onClick: begin,
            }, t('start.button'), React.createElement('kbd', null, 'Enter')),
            React.createElement('span', { className: 'boot-duel-gate-note' }, t('start.sub')),
            React.createElement('span', { className: 'boot-duel-gate-note' }, t('start.hint')),
          )
          : null,

        // The finisher's name card: a vertical brush title, anime-style.
        snapshotValue?.special
          ? React.createElement('div', { className: 'boot-duel-special' },
            React.createElement('span', { className: 'boot-duel-special-name' }, t('special.name')),
            React.createElement('span', { className: 'boot-duel-special-sub' },
              snapshotValue.special.beat === 'landed' ? '命中' : '起势'),
          )
          : null,

        inOutro
          ? React.createElement('div', { className: 'boot-duel-ko' },
            React.createElement('div', { className: 'boot-duel-ko-seal' },
              React.createElement('span', { className: 'boot-duel-ko-char' }, t('ko.title')),
            ),
            React.createElement('div', { className: 'boot-duel-ko-sub' }, t('ko.subtitle')),
            React.createElement('div', { className: 'boot-duel-ko-hint' }, t('ko.pressAnyKey')),
          )
          : null,

        paused
          ? React.createElement('button', {
            type: 'button',
            className: 'boot-duel-pause',
            onClick: () => engineRef.current?.resume?.(),
          }, t('pause.clickToResume'))
          : null,
      )
    }

    /**
     * Wire the duel to the DOM. Returns the teardown function; every listener,
     * timer, and animation frame is undone there.
     */
    function mountLayer({ layerRef, canvasRef, focusRef, engineRef, setSnapshot, setPaused, setFading, setAudioReady }) {
      runtime.reducedMotion = readReducedMotion()

      // The story is drawn at random each round; the engine refuses to repeat
      // the previous one. \`null\` is the signal for "pick for me".
      const duel = __mod_duel.createDuel({
        seed: Date.now() & 0x7fffffff,
        difficulty: settings.difficulty || runtime.config.difficulty,
        reducedMotion: runtime.reducedMotion,
        round: null,
      })
      const audio = __mod_audio.createAudio()
      if (!audio.available()) setAudioReady(false)
      // The stored sound preference wins over the default.
      try { audio.setMuted(!settings.sound) } catch { /* ignore */ }

      const previousFocus = document.activeElement
      const layer = layerRef.current
      const container = focusRef.current
      const canvas = canvasRef.current
      const renderer = __mod_render.createRenderer(canvas, canvas?.getContext?.('2d') ?? null)

      function measure() {
        const ratio = window.devicePixelRatio || 1
        const width = layer?.clientWidth || window.innerWidth || 1
        const height = layer?.clientHeight || window.innerHeight || 1
        renderer.resize(width, height, ratio)
      }
      measure()

      let settled = false
      let fadeTimer = null

      /** The round is over: remember it, fade, then unmount for good. */
      function finish() {
        if (settled) return
        settled = true
        __mod_session.markPassed()
        setFading(true)
        fadeTimer = window.setTimeout(() => store.hide(), FADE_MS)
      }

      function fail(message, error) {
        logError(message, error)
        session.unmount()
        finish()
      }

      const session = __mod_session.createSession({
        duel,
        binds: settings.binds,
        onEvent(event) {
          if (event === 'ko') audio.play('boom')
          else if (event === 'crash') audio.play('crash')
          else audio.play(event)
        },
        onError(error) {
          fail('fight failed, letting the user through', error)
        },
      })

      /** Leave the opening stance: the bell rings and the fight is live. */
      function begin() {
        if (settled) return false
        const started = session.keyDown('Enter')
        if (started) {
          audio.play('gong')
          // A gate click is a gesture: it is the honest moment to unmute audio
          // that the player explicitly turned on.
          try { container?.focus({ preventScroll: true }) } catch { /* ignore */ }
        }
        return started
      }

      const loop = __mod_loop.createLoop({
        step() {
          session.frame(1000 / 60)
          const next = duel.getSnapshot()
          setSnapshot(next)
          try {
            renderer.draw(next)
          } catch (error) {
            loop.stop()
            fail('draw failed, letting the user through', error)
          }
        },
        onError(error) {
          fail('loop failed, letting the user through', error)
        },
      })

      // The outro ends on its own timer; the watchdog makes the layer leave
      // even when the user never touches a key.
      const watchdog = window.setInterval(() => {
        if (duel.getState() === 'done') finish()
      }, 120)

      function onResize() {
        measure()
      }

      function onVisibility() {
        if (document.visibilityState === 'hidden') session.pause()
        else session.resume()
      }

      function resume() {
        session.releaseAll()
        session.resume()
        setPaused(false)
        try { container?.focus({ preventScroll: true }) } catch { /* ignore */ }
      }

      function onKeyDown(event) {
        // The host's own modal owns the keyboard while it is open, Esc included.
        if (isForeignDialog(event.target)) return
        // Esc is the unconditional exit: every phase, every press, and also
        // from a text field — a user must never have to reason about why the
        // opening animation is still there.
        if (event.code === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          if (settled) return
          session.releaseAll()
          finish()
          return
        }
        // Game keys must never be typed into a field. Only Esc is exempt above:
        // a keystroke aimed at an input belongs to it otherwise.
        if (isTypingTarget(event.target)) return
        if (settled) {
          // The outro is fading: any other key just moves things along.
          finish()
          return
        }
        if (duel.getState() === 'done') {
          finish()
          return
        }
        if (event.repeat) {
          // Auto-repeat holds the key; it must not restart an action.
          if (GAME_CODES.has(event.code)) event.preventDefault()
          return
        }
        // Enter is the start gesture: swallow it so a form underneath never
        // sees it, then ring the bell.
        if (event.code === 'Enter' || event.code === 'NumpadEnter') {
          event.preventDefault()
          begin()
          return
        }
        if (session.isPaused() && GAME_CODES.has(event.code)) {
          event.preventDefault()
          resume()
          return
        }
        const consumed = session.keyDown(event.code)
        if (consumed) event.preventDefault()
        // The finisher's own guitar-string moment: unmuting is not needed, but
        // the swing whoosh on a big input sells the commitment.
        if (!audio.isMuted()) audio.play(event.code === 'KeyU' || event.code === 'KeyI' ? 'counter' : 'whoosh')
      }

      function onKeyUp(event) {
        if (session.keyUp(event.code)) event.preventDefault()
      }

      function onFocusOut(event) {
        if (settled) return
        const next = event.relatedTarget
        if (next && container?.contains(next)) return
        if (next) return
        // Focus left the layer (or went nowhere): freeze rather than let the
        // player "keep playing" against a game that is not listening.
        session.pause()
        setPaused(true)
      }

      // Window-level capture: the layer is a modal surface, and a handler bound
      // only to its own focus container goes deaf as soon as focus wanders,
      // which is what made Esc and the movement keys do nothing.
      window.addEventListener('keydown', onKeyDown, true)
      window.addEventListener('keyup', onKeyUp, true)
      window.addEventListener('focusout', onWindowFocusOut, true)
      window.addEventListener('resize', onResize)
      document.addEventListener('visibilitychange', onVisibility)
      try { container?.focus({ preventScroll: true }) } catch { /* ignore */ }

      /** Start a fresh round in place: the panel's "再来一局". */
      function restart() {
        try {
          settings = { ...settings }
          duel.restart?.(null)
          session.setBinds?.(settings.binds)
          session.releaseAll()
          setPaused(false)
          setSnapshot(duel.getSnapshot())
          begin()
          try { container?.focus({ preventScroll: true }) } catch { /* ignore */ }
        } catch (error) {
          logError('restart failed, letting the user continue', error)
        }
      }

      engineRef.current = { audio, resume, finish, begin, restart }
      setSnapshot(duel.getSnapshot())
      loop.start()

      function onWindowFocusOut(event) {
        // Only a real blur of the whole window pauses; a click on a HUD button
        // moves focus within the same layer and must not freeze the fight.
        if (event.relatedTarget) return
        onFocusOut(event)
      }

      return function teardown() {
        loop.stop()
        session.unmount()
        if (watchdog) window.clearInterval(watchdog)
        if (fadeTimer) window.clearTimeout(fadeTimer)
        window.removeEventListener('keydown', onKeyDown, true)
        window.removeEventListener('keyup', onKeyUp, true)
        window.removeEventListener('focusout', onWindowFocusOut, true)
        window.removeEventListener('resize', onResize)
        document.removeEventListener('visibilitychange', onVisibility)
        if (engineRef.current?.audio === audio) engineRef.current = null
        // Hand focus back where it came from. Leaving it on a detached node is
        // exactly what makes the next keystroke disappear.
        try {
          if (previousFocus && previousFocus !== document.body && document.contains(previousFocus) && typeof previousFocus.focus === 'function') {
            previousFocus.focus({ preventScroll: true })
          } else if (container && document.activeElement === container) {
            container.blur()
          }
        } catch { /* focus restoration is best effort */ }
      }
    }

    /** The `shell.overlay` entry: renders nothing once the round is over. */
    function OverlayEntry() {
      const [visible, setVisible] = React.useState(store.visible && !__mod_session.hasPassed() && settings.enabled)
      React.useEffect(() => store.subscribe(() => setVisible(store.visible)), [])
      if (!visible || __mod_session.hasPassed()) return null
      return React.createElement(BootDuel, null)
    }

    /* ----------------------------------------------------------------- apply */

    function apply(ctx) {
      applyContext = ctx
      activeLocale = pickLocale()
      try {
        const locale = ctxGet('locale')
        if (locale && typeof locale.bind === 'function') translated = locale.bind(NAMESPACE)
      } catch { /* the bundled dictionaries are enough */ }

      // Re-read the language on a switch so the HUD follows the host locale.
      try {
        const locale = ctxGet('locale')
        if (locale && typeof locale.subscribe === 'function') {
          ctx.effect(() => {
            const off = locale.subscribe(() => { activeLocale = pickLocale() })
            return () => { try { off?.() } catch { /* ignore */ } }
          }, 'boot-duel: locale changes')
        }
      } catch { /* a host without subscribe keeps the boot-time language */ }

      // The style seat (`styles.insert`) does not exist for a bundle client —
      // only dynamic plugin runs receive it — so the sheet is inserted here.
      ctx.effect(() => mountStyles(), 'boot-duel: styles')

      // Config over the package's own route; a failure keeps the defaults.
      fetchConfig().then(applyConfig).catch((error) => logError('config apply failed', error))

      try {
        
      /**
       * The host settings page.
       *
       * Registered as a section, not as part of the overlay: the section is
       * what "设置 → 插件" lists, and a plugin with user-facing preferences
       * that does not appear there reads as having none.
       */
      ctx.effect(() => ctx.slots.inject(SETTINGS_SLOT, () => ctx.slots.register({
        name: SETTINGS_SLOT,
        id: ENTRY_ID,
        order: ENTRY_ORDER,
        label: () => t('settings.sectionName'),
        locale: NAMESPACE,
      }, () => React.createElement(HostSettingsSection))))

      ctx.effect(() => ctx.slots.inject(SETTINGS_ICON_SLOT, () => ctx.slots.register({
        name: SETTINGS_ICON_SLOT,
        id: ENTRY_ID,
        order: ENTRY_ORDER,
      }, () => React.createElement(SettingsSectionIcon))))

ctx.effect(() => ctx.slots.inject(SLOT, () => ctx.slots.register({
          name: SLOT,
          id: ENTRY_ID,
          order: ENTRY_ORDER,
        }, OverlayEntry)), 'boot-duel: overlay')
      } catch (error) {
        // No `shell.overlay` on this host version: stay silent and leave the
        // app untouched.
        logError('shell.overlay is unavailable, the duel will not render', error)
      }

      // If the style sheet never made it (a locked-down page), the layer would
      // render as a bare band over the app; skip the animation instead.
      ctx.effect(() => {
        const id = window.setTimeout(() => {
          let styled = false
          try { styled = document.getElementById(STYLE_ID) !== null } catch { styled = false }
          if (!styled) {
            logError('stylesheet missing, letting the user through', new Error(STYLE_ID))
            store.hide()
          }
        }, 1500)
        return () => window.clearTimeout(id)
      }, 'boot-duel: style guard')
    }

    exports.apply = apply
    exports.inject = ['slots']
    exports.__test = {
      DICTS, CSS, SLOT, ENTRY_ID, ENTRY_ORDER, DEFAULT_CONFIG, GAME_CODES,
      CONFIG_URL, STYLE_ID, pickLocale, isTypingTarget,
    }
    return module.exports
  },
})
