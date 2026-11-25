/**
 * Open the file manager in a right Sidebar that would otherwise show only the
 * "guide" page, and keep doing it for each new Session.
 *
 * The `vyra-agent-cli-manager` plugin owns that same slot for its
 * workspace-files tab, so this yields whenever that tab type is registered:
 * two plugins racing over one guide tab would open, close and re-open it.
 *
 * The Sidebar has no "default tab" setting, so the swap is driven by its two
 * observable stores — the open tab set and the mounted Session — with the work
 * deferred a microtask so a registration that lands in the same tick is seen.
 */

const GUIDE_KIND = 'guide'
const RIVAL_KIND = 'files'

/**
 * Replace the Sidebar's lone guide tab with the file manager.
 * @param {object} args - inputs.
 * @param {object} args.sidebar - the `sidebarRight` service.
 * @param {Map<string, unknown> | { get(name: string): unknown }} args.kinds - registered tab types.
 * @param {string} args.libraryKind - this plugin's library tab kind.
 * @returns {boolean} whether a tab was opened.
 */
export function replaceSoleGuide({ sidebar, kinds, libraryKind }) {
  if (typeof sidebar?.tabsIn !== 'function' || typeof sidebar?.openTab !== 'function') return false
  const sessionId = sidebar.mounted?.getSnapshot?.()
  if (sessionId === undefined || sessionId === null) return false
  if (sidebar.isExpanded?.() !== true) return false

  const tabs = sidebar.tabsIn(sessionId)
  if (!Array.isArray(tabs) || tabs.length !== 1) return false
  const [only] = tabs
  if (only?.kind !== GUIDE_KIND) return false

  // Another plugin already claims this slot for its own file browser.
  if (kinds?.get?.(RIVAL_KIND) !== undefined) return false
  if (kinds?.get?.(libraryKind) === undefined) return false

  sidebar.openTab(libraryKind, { replaceTab: only.id })
  return true
}

/**
 * Keep the file manager as the Sidebar's first tab while the preference holds.
 * @param {object} args - inputs.
 * @param {object} args.sidebar - the `sidebarRight` service.
 * @param {Map<string, unknown> | { get(name: string): unknown }} args.kinds - registered tab types.
 * @param {string} args.libraryKind - this plugin's library tab kind.
 * @param {() => boolean} args.enabled - whether the preference is on right now.
 * @returns {() => void} disposer.
 */
export function installDefaultTab({ sidebar, kinds, libraryKind, enabled }) {
  const schedule = () => {
    queueMicrotask(() => {
      if (enabled() !== true) return
      replaceSoleGuide({ sidebar, kinds, libraryKind })
    })
  }
  const disposers = []
  if (typeof sidebar?.openTabs?.subscribe === 'function') disposers.push(sidebar.openTabs.subscribe(schedule))
  if (typeof sidebar?.mounted?.subscribe === 'function') disposers.push(sidebar.mounted.subscribe(schedule))
  return () => { for (const dispose of disposers) dispose?.() }
}

export { GUIDE_KIND, RIVAL_KIND }
