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
    // Right-click is the trigger; drag-select opening a menu after every swipe is opt-in.
    openOnSelect: false,
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

export { FILE as settingsPath }
