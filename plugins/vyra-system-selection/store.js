// Persistence for the two settings a user actually changes. A corrupt or missing file must never
// stop the plugin from loading, so every failure falls back to the defaults.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

const FILE = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'storages', 'system-selection', 'settings.json')

export const DEFAULTS = {
  enabled: true,
  settings: {
    targetLanguage: '简体中文',
    provider: '',
    model: '',
    modelProvider: '',
    // Selecting text is the trigger: the menu appears on release, with no right-click. Right-click
    // still works and still opens the same menu, so nobody has to learn the new gesture to keep
    // using the plugin.
    openOnSelect: true,
    // Taking over the right button is what puts this plugin in the system's input path: every
    // mouse event crosses into the Host through the low-level hook. On by default because that is
    // the menu people expect; the switch exists for machines where the crossing is felt.
    interceptRightClick: true,
    maxResults: 6,
  },
}

export function loadSettings() {
  try {
    const raw = JSON.parse(readFileSync(FILE, 'utf8'))
    return {
      enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULTS.enabled,
      settings: { ...DEFAULTS.settings, ...(raw.settings && typeof raw.settings === 'object' ? raw.settings : {}) },
    }
  } catch {
    return { enabled: DEFAULTS.enabled, settings: { ...DEFAULTS.settings } }
  }
}

export function saveSettings(value) {
  try {
    mkdirSync(dirname(FILE), { recursive: true })
    writeFileSync(FILE, JSON.stringify(value, null, 2))
    return true
  } catch {
    // A read-only or missing home directory is not worth failing the feature over; the setting
    // simply does not survive the restart.
    return false
  }
}

/** Where the last action's diagnostics land, so a silent failure leaves a trace to read. */
const RUN_FILE = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'storages', 'system-selection', 'last-run.json')

/**
 * Persist what the last action did.
 *
 * The user cannot see the Host log, and an action that dies before its panel opens leaves no
 * trace at all — which is exactly the "点了没有反应" report. One small file per action is the
 * cheapest way to make the next report actionable.
 */
export function saveLastRun(value) {
  try {
    mkdirSync(dirname(RUN_FILE), { recursive: true })
    writeFileSync(RUN_FILE, JSON.stringify(value, null, 2))
    return true
  } catch {
    return false
  }
}

export { FILE as settingsPath, RUN_FILE as lastRunPath }
