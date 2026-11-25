/**
 * Open the file manager in a right Sidebar that would otherwise show only the
 * "guide" page, and keep doing it for each new Session.
 *
 * Contract notes, from `@deepseek-ai/dsh-client-ui-sidebar-right`'s
 * `service.ts` / `stores.ts`:
 *
 * - `openTab` itself reveals the column ("an open behind a collapsed panel is
 *   not an open"), so this must NOT gate on `isExpanded()` — doing so made the
 *   swap unreachable in the ordinary startup flow, where the column is collapsed.
 * - `tabsIn(sessionId)` reads the *committed* layout and returns `[]` before the
 *   session's store is adopted. An empty list therefore means "not adopted yet",
 *   which is where the guide tab already is: treat it as the guide-only state.
 * - Closing our tab leaves the lone guide tab again — the exact state a fresh
 *   session has — so a plain "guide only → swap" rule re-opens a tab the person
 *   just closed. One swap per session is the latch that stops that.
 * - `sidebarRightTabs` exposes `get(kind)`. `vyra-agent-cli-manager` owns this
 *   same slot for its workspace-files tab, so yield when that kind exists.
 */

const GUIDE_KIND = 'guide'
const RIVAL_KIND = 'files'

/**
 * Decide whether the Sidebar should be given the file manager now.
 * Pure apart from the `openTab` call, so the policy is testable on its own.
 * @param {object} args - inputs.
 * @param {object} args.sidebar - the `sidebarRight` service.
 * @param {Map<string, unknown> | { get(name: string): unknown }} args.kinds - registered tab types.
 * @param {string} args.libraryKind - this plugin's library tab kind.
 * @param {Set<string>} [args.done] - sessions already swapped for.
 * @returns {boolean} whether a tab was opened.
 */
export function replaceSoleGuide({ sidebar, kinds, libraryKind, done }) {
  if (typeof sidebar?.tabsIn !== 'function' || typeof sidebar?.openTab !== 'function') return false
  const sessionId = sidebar.mounted?.getSnapshot?.()
  if (sessionId === undefined || sessionId === null) return false
  if (done?.has?.(sessionId) === true) return false

  const tabs = sidebar.tabsIn(sessionId)
  if (!Array.isArray(tabs)) return false
  if (tabs.length > 1) return false
  // Empty means the store is not adopted yet; the guide is what will be there.
  if (tabs.length === 1 && tabs[0]?.kind !== GUIDE_KIND) return false

  // Another plugin already claims this slot for its own file browser.
  if (kinds?.get?.(RIVAL_KIND) !== undefined) return false
  if (kinds?.get?.(libraryKind) === undefined) return false

  const replaceTab = tabs.length === 1 ? tabs[0].id : undefined
  sidebar.openTab(libraryKind, replaceTab === undefined ? {} : { replaceTab })
  done?.add?.(sessionId)
  return true
}

/**
 * Keep the file manager as the Sidebar's first tab, once per Session.
 * @param {object} args - inputs.
 * @param {object} args.sidebar - the `sidebarRight` service.
 * @param {Map<string, unknown> | { get(name: string): unknown }} args.kinds - registered tab types.
 * @param {string} args.libraryKind - this plugin's library tab kind.
 * @param {() => boolean} args.enabled - whether the preference is on right now.
 * @returns {() => void} disposer.
 */
export function installDefaultTab({ sidebar, kinds, libraryKind, enabled }) {
  const done = new Set()
  const schedule = () => {
    queueMicrotask(() => {
      if (enabled() !== true) return
      replaceSoleGuide({ sidebar, kinds, libraryKind, done })
    })
  }
  const disposers = []
  if (typeof sidebar?.openTabs?.subscribe === 'function') disposers.push(sidebar.openTabs.subscribe(schedule))
  if (typeof sidebar?.mounted?.subscribe === 'function') disposers.push(sidebar.mounted.subscribe(schedule))
  // Adoption may have already happened by the time this plugin applies.
  schedule()
  return () => { for (const dispose of disposers) dispose?.() }
}

export { GUIDE_KIND, RIVAL_KIND }
