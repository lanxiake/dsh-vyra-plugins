/**
 * Audio focus for the music panel.
 *
 * Two independent pieces:
 *  - a Windows microphone monitor ported from Folia's voiceInputPause.cjs: while
 *    the setting is on, polling the microphone ConsentStore and pausing playback
 *    when another process captures the microphone;
 *  - a small ducking registry other plugins can drive through HTTP. Ducking is
 *    not part of Folia; it exists so TTS/voice plugins can ask the player to lower
 *    its volume without owning the player.
 *
 * Folia excludes its own executable because it opens the microphone to enumerate
 * audio devices. This plugin never captures microphone audio, so the DSH process
 * is deliberately not excluded: that is what lets the host's own voice input
 * trigger the pause.
 *
 * @module dsh-music-panel/audio-focus
 */

import { execFile } from 'node:child_process'

const MICROPHONE_CONSENT_STORE_KEY =
  'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone'
const DEFAULT_POLL_INTERVAL_MS = 1000
const START_CONFIRM_SAMPLES = 2
const STOP_CONFIRM_SAMPLES = 3
const REG_QUERY_TIMEOUT_MS = 5000
const DEFAULT_DUCK_LEVEL = 0.3
const DEFAULT_DUCK_FADE_MS = 300
const DEFAULT_DUCK_TTL_MS = 60000
const MAX_DUCK_TTL_MS = 300000

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

/** Consent-store subkeys encode the exe path with '#' separators. */
export function normalizeConsentStoreExePath(subKey) {
  return String(subKey || '').replace(/#/g, '\\').toLowerCase()
}

function normalizeExePath(value) {
  return String(value || '').replace(/\//g, '\\').toLowerCase()
}

/** True when a registry key describes ownExePath itself. */
export function isOwnProcessKey(keyPath, ownExePath) {
  const own = normalizeExePath(ownExePath)
  if (own === '') return false
  const marker = '\\nonpackaged\\'
  const index = String(keyPath || '').toLowerCase().indexOf(marker)
  if (index === -1) return false
  return normalizeConsentStoreExePath(String(keyPath).slice(index + marker.length)) === own
}

/**
 * Parse the output of reg query on the microphone ConsentStore.
 *
 * An app is capturing when LastUsedTimeStart != 0 and LastUsedTimeStop == 0.
 * The parser is exported because it is the part worth testing deterministically.
 */
export function parseMicrophoneConsentStoreInUse(output, ownExePath = '') {
  if (typeof output !== 'string' || output.trim() === '') return false
  const entries = []
  let current = null
  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line === '') continue
    if (/^HKEY_/i.test(line)) {
      current = { keyPath: line, start: null, stop: null }
      entries.push(current)
      continue
    }
    if (current === null) continue
    const match = /^(LastUsedTimeStart|LastUsedTimeStop)\s+REG_QWORD\s+(0x[0-9a-fA-F]+)/.exec(line)
    if (match === null) continue
    const value = BigInt(match[2])
    if (match[1] === 'LastUsedTimeStart') current.start = value
    else current.stop = value
  }
  return entries.some((entry) => {
    if (isOwnProcessKey(entry.keyPath, ownExePath)) return false
    return entry.start !== null && entry.start !== 0n && entry.stop === 0n
  })
}

/** Read Windows microphone capture state. Resolves null when the probe fails. */
export function queryWindowsMicrophoneInUse(ownExePath = '', execFileImpl = execFile) {
  return new Promise((resolve) => {
    execFileImpl(
      'reg',
      ['query', MICROPHONE_CONSENT_STORE_KEY, '/s'],
      { timeout: REG_QUERY_TIMEOUT_MS, windowsHide: true, maxBuffer: 1024 * 1024 },
      (error, stdout) => {
        if (error) {
          resolve(null)
          return
        }
        resolve(parseMicrophoneConsentStoreInUse(stdout, ownExePath))
      },
    )
  })
}

/**
 * Poll microphone state while enabled, debouncing start/stop transitions.
 *
 * pollNow is exposed for tests; normal callers use syncState() and stop().
 */
export function createVoiceInputMonitor(options = {}) {
  const isEnabled = typeof options.isEnabled === 'function' ? options.isEnabled : () => false
  const isSupported = options.isSupported === true
  const queryInUse = typeof options.queryInUse === 'function'
    ? options.queryInUse
    : () => queryWindowsMicrophoneInUse(options.ownExePath || '')
  const onState = typeof options.onState === 'function' ? options.onState : () => {}
  const pollIntervalMs = Number.isFinite(options.pollIntervalMs)
    ? Math.max(200, options.pollIntervalMs)
    : DEFAULT_POLL_INTERVAL_MS

  let timer = null
  let active = false
  let pendingSample = null
  let confirmCount = 0
  let polling = false

  function applySample(inUse) {
    if (inUse === active) {
      pendingSample = null
      confirmCount = 0
      return
    }
    if (pendingSample !== inUse) {
      pendingSample = inUse
      confirmCount = 1
    } else {
      confirmCount += 1
    }
    const needed = inUse ? START_CONFIRM_SAMPLES : STOP_CONFIRM_SAMPLES
    if (confirmCount < needed) return
    active = inUse
    pendingSample = null
    confirmCount = 0
    onState(active)
  }

  async function pollNow() {
    if (polling) return getStatus()
    polling = true
    try {
      const inUse = await queryInUse()
      if (typeof inUse === 'boolean') applySample(inUse)
    } catch (error) {
      console.warn('[audio-focus] microphone capture probe failed', error)
    } finally {
      polling = false
    }
    return getStatus()
  }

  function syncState() {
    const shouldRun = isSupported && isEnabled()
    if (shouldRun && timer === null) {
      timer = setInterval(() => {
        void pollNow()
      }, pollIntervalMs)
      if (typeof timer.unref === 'function') timer.unref()
      void pollNow()
    } else if (!shouldRun && timer !== null) {
      clearInterval(timer)
      timer = null
    }
    if (!shouldRun && active) {
      active = false
      pendingSample = null
      confirmCount = 0
      onState(false)
    }
    return getStatus()
  }

  function getStatus() {
    return { active, supported: isSupported, enabled: isEnabled() }
  }

  function stop() {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
    active = false
    pendingSample = null
    confirmCount = 0
  }

  return { syncState, stop, getStatus, pollNow }
}

function normalizeReason(value) {
  const reason = String(value ?? '').trim().toLowerCase()
  if (!/^[a-z0-9:_-]{1,64}$/.test(reason)) return ''
  return reason
}

/**
 * Create the shared audio-focus state.
 *
 * voiceInputPause is configured by the browser half. Ducks are registered by
 * other plugins through /music/audio-focus/duck; each reason carries a TTL so a
 * crashed caller cannot leave the player quietly ducked forever.
 */
export function createAudioFocusService(options = {}) {
  const platform = options.platform ?? process.platform
  const supported = platform === 'win32'
  const now = typeof options.now === 'function' ? options.now : Date.now
  let voiceInputPause = false
  let voiceInputActive = false
  // Defaults for ducks whose caller does not pass a level/fade (the browser half mirrors
  // the two settings here so a cross-process caller gets the listener's levels).
  let duckLevel = DEFAULT_DUCK_LEVEL
  let duckFadeMs = DEFAULT_DUCK_FADE_MS
  const ducks = new Map()

  const monitor = createVoiceInputMonitor({
    isSupported: supported,
    isEnabled: () => voiceInputPause,
    queryInUse: options.queryInUse,
    pollIntervalMs: options.pollIntervalMs,
    onState: (active) => {
      voiceInputActive = active
    },
  })

  function pruneDucks(at) {
    for (const [reason, entry] of ducks) {
      if (entry.expiresAt > 0 && entry.expiresAt <= at) ducks.delete(reason)
    }
  }

  function duckStatus(at) {
    pruneDucks(at)
    if (ducks.size === 0) return { active: false, level: 1, fadeMs: 0, reasons: [] }
    let best = null
    for (const [reason, entry] of ducks) {
      if (best === null || entry.level < best.level) best = { reason, ...entry }
    }
    return {
      active: true,
      level: best.level,
      fadeMs: best.fadeMs,
      reasons: [...ducks.keys()],
    }
  }

  function status() {
    const at = now()
    return {
      supported,
      platform,
      voiceInputPause,
      voiceInputActive,
      duck: duckStatus(at),
    }
  }

  function configure(input) {
    if (input !== null && typeof input === 'object') {
      if (typeof input.voiceInputPause === 'boolean') {
        voiceInputPause = input.voiceInputPause
        monitor.syncState()
      }
      if (Number.isFinite(Number(input.duckLevel))) duckLevel = clamp(Number(input.duckLevel), 0, 1)
      if (Number.isFinite(Number(input.duckFadeMs))) duckFadeMs = clamp(Math.round(Number(input.duckFadeMs)), 0, 5000)
    }
    return status()
  }

  function beginDuck(input = {}) {
    const reason = normalizeReason(input.reason)
    if (reason === '') return status()
    const level = Number.isFinite(Number(input.level)) ? clamp(Number(input.level), 0, 1) : duckLevel
    const fadeMs = Number.isFinite(Number(input.fadeMs))
      ? clamp(Math.round(Number(input.fadeMs)), 0, 5000)
      : duckFadeMs
    const ttl = Number.isFinite(Number(input.ttlMs))
      ? clamp(Math.round(Number(input.ttlMs)), 0, MAX_DUCK_TTL_MS)
      : DEFAULT_DUCK_TTL_MS
    ducks.set(reason, { level, fadeMs, expiresAt: ttl > 0 ? now() + ttl : 0 })
    return status()
  }

  function endDuck(reason) {
    const key = normalizeReason(reason)
    if (key !== '') ducks.delete(key)
    return status()
  }

  return {
    configure,
    status,
    beginDuck,
    endDuck,
    dispose() {
      monitor.stop()
      ducks.clear()
    },
  }
}
