/**
 * Plugin market index source of truth.
 *
 * `pnpm run build:index` projects this manifest into `index/index.json`, the
 * format-1 document a DSH client fetches after the user adds its URL under
 * Settings -> Plugins -> index sources. Edit this file, never the generated
 * index. Every entry is a plugin this repository owns; skills shipped in
 * `skills/` are consumed directly through `customSkillDirs` and are listed
 * here only when they are also packaged for market installation.
 *
 * @module vyra-plugins/market
 */

/** A localized string: English alone, or English plus translations. */
export type LocaleMap = { readonly en: string; readonly zh?: string }

/**
 * Inline icon for `dsh-vyra-tool-usage-stats`: three ascending bars.
 *
 * Inline rather than a file because the market card renders it from the index
 * document itself; a relative path would not resolve from the client, and
 * published indexes carry the image this way.
 */
/**
 * Icon for 免费模型: an infinity mark with a lightning bolt — "unlimited, free".
 * Deliberately unlike Our Free Model's aquarium: it used to sit beside this
 * plugin in the market and the two must never be mistaken for one another.
 */
const VYRA_FREE_MODEL_ICON =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCIgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSJub25lIj4KICA8cmVjdCB4PSIyIiB5PSIyIiB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHJ4PSIxNSIgZmlsbD0iIzEyMTYxRiIvPgogIDxyZWN0IHg9IjIuNzUiIHk9IjIuNzUiIHdpZHRoPSI1OC41IiBoZWlnaHQ9IjU4LjUiIHJ4PSIxNC4yNSIgc3Ryb2tlPSIjMkIzMjQyIiBzdHJva2Utd2lkdGg9IjEuNSIvPgogIDxwYXRoIGQ9Ik0xNS41IDM4LjVjLTIuOSAwLTUuMS0yLjYtNS4xLTYuNXMyLjItNi41IDUuMS02LjVjMy42IDAgNi4xIDMuNCA4LjYgNy42IDIuMSAzLjUgNCA2LjQgNi40IDYuNCAyLjEgMCAzLjQtMS42IDMuNC00cy0xLjMtNC0zLjQtNGMtMi40IDAtNC4zIDIuOS02LjQgNi40LTIuNSA0LjItNSA3LjYtOC42IDcuNiIKICAgICAgICBzdHJva2U9IiM0QzhERkYiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBmaWxsPSJub25lIi8+CiAgPHBhdGggZD0iTTQ4LjUgMjUuNWMyLjkgMCA1LjEgMi42IDUuMSA2LjVzLTIuMiA2LjUtNS4xIDYuNWMtMy42IDAtNi4xLTMuNC04LjYtNy42IgogICAgICAgIHN0cm9rZT0iIzRDOERGRiIgc3Ryb2tlLXdpZHRoPSI0IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGZpbGw9Im5vbmUiLz4KICA8cGF0aCBkPSJNMzUuNiAyMC41IDI5LjggMzFoNS42bC0yLjIgMTIuNUw0MSAzMS40aC01Ljl6IiBmaWxsPSIjRjVDNTQyIi8+Cjwvc3ZnPg=='

const BOOT_DUEL_ICON =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCIgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByb2xlPSJpbWciIGFyaWEtbGFiZWw9IuW8gOW3peWkp+WQiSI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9InRpbGUiIHgxPSIwIiB5MT0iMCIgeDI9IjAiIHkyPSIxIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjMTIxNjJhIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzA1MDcwZiIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxyYWRpYWxHcmFkaWVudCBpZD0iaW1wYWN0IiBjeD0iNTAlIiBjeT0iNTAlIiByPSI1MCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiNmZmZmZmYiIHN0b3Atb3BhY2l0eT0iLjk1Ii8+CiAgICAgIDxzdG9wIG9mZnNldD0iNTUlIiBzdG9wLWNvbG9yPSIjZmZlOWZiIiBzdG9wLW9wYWNpdHk9Ii4zNSIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiNmZjRmZDgiIHN0b3Atb3BhY2l0eT0iMCIvPgogICAgPC9yYWRpYWxHcmFkaWVudD4KICAgIDxmaWx0ZXIgaWQ9Imdsb3ciIHg9Ii02MCUiIHk9Ii02MCUiIHdpZHRoPSIyMjAlIiBoZWlnaHQ9IjIyMCUiPgogICAgICA8ZmVHYXVzc2lhbkJsdXIgc3RkRGV2aWF0aW9uPSIxLjYiIHJlc3VsdD0iYmx1ciIvPgogICAgICA8ZmVNZXJnZT4KICAgICAgICA8ZmVNZXJnZU5vZGUgaW49ImJsdXIiLz4KICAgICAgICA8ZmVNZXJnZU5vZGUgaW49IlNvdXJjZUdyYXBoaWMiLz4KICAgICAgPC9mZU1lcmdlPgogICAgPC9maWx0ZXI+CiAgPC9kZWZzPgoKICA8cmVjdCB4PSIyIiB5PSIyIiB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHJ4PSIxNCIgZmlsbD0idXJsKCN0aWxlKSIvPgogIDxyZWN0IHg9IjIiIHk9IjIiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcng9IjE0IiBmaWxsPSJub25lIiBzdHJva2U9IiMyYjMzNTAiIHN0cm9rZS13aWR0aD0iMSIvPgoKICA8Y2lyY2xlIGN4PSIzMiIgY3k9IjMwIiByPSIxMyIgZmlsbD0idXJsKCNpbXBhY3QpIi8+CgogIDxnIGZpbHRlcj0idXJsKCNnbG93KSIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2Utd2lkdGg9IjIuNiI+CiAgICA8IS0tIGxlZnQgZmlnaHRlcjogY3lhbiwgbHVuZ2luZyByaWdodCAtLT4KICAgIDxnIHN0cm9rZT0iIzM1ZTBmZiI+CiAgICAgIDxjaXJjbGUgY3g9IjIxIiBjeT0iMjIuNSIgcj0iMy4xIiBmaWxsPSIjMzVlMGZmIiBzdHJva2U9Im5vbmUiLz4KICAgICAgPHBhdGggZD0iTTIxIDI2djkiLz4KICAgICAgPHBhdGggZD0iTTIxIDI5LjVsNi41IC0xLjUiLz4KICAgICAgPHBhdGggZD0iTTIxIDI5LjVsLTQuNSA0Ii8+CiAgICAgIDxwYXRoIGQ9Ik0yMSAzNWwtMy41IDYuNSIvPgogICAgICA8cGF0aCBkPSJNMjEgMzVsNCA2LjUiLz4KICAgIDwvZz4KICAgIDwhLS0gcmlnaHQgZmlnaHRlcjogbWFnZW50YSwgbHVuZ2luZyBsZWZ0IC0tPgogICAgPGcgc3Ryb2tlPSIjZmY0ZmQ4Ij4KICAgICAgPGNpcmNsZSBjeD0iNDMiIGN5PSIyMy41IiByPSIzLjEiIGZpbGw9IiNmZjRmZDgiIHN0cm9rZT0ibm9uZSIvPgogICAgICA8cGF0aCBkPSJNNDMgMjd2OSIvPgogICAgICA8cGF0aCBkPSJNNDMgMzAuNWwtNi41IC0xLjUiLz4KICAgICAgPHBhdGggZD0iTTQzIDMwLjVsNC41IDQiLz4KICAgICAgPHBhdGggZD0iTTQzIDM2bDMuNSA2LjUiLz4KICAgICAgPHBhdGggZD0iTTQzIDM2bC00IDYuNSIvPgogICAgPC9nPgogIDwvZz4KCiAgPGcgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjEuOCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBvcGFjaXR5PSIuOSI+CiAgICA8cGF0aCBkPSJNMzIgMjQuNXYtNCIvPgogICAgPHBhdGggZD0iTTMyIDM5LjV2NCIvPgogICAgPHBhdGggZD0iTTI2LjUgMjcuNWwtMi44IC0yLjIiLz4KICAgIDxwYXRoIGQ9Ik0zNy41IDI3LjVsMi44IC0yLjIiLz4KICAgIDxwYXRoIGQ9Ik0yNi41IDM2LjVsLTIuOCAyLjIiLz4KICAgIDxwYXRoIGQ9Ik0zNy41IDM2LjVsMi44IDIuMiIvPgogIDwvZz4KCiAgPGxpbmUgeDE9IjEyIiB5MT0iNTIiIHgyPSI1MiIgeTI9IjUyIiBzdHJva2U9IiMyYjMzNTAiIHN0cm9rZS13aWR0aD0iMS40IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KPC9zdmc+Cg=='

const TOOL_USAGE_ICON =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+PHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTQiIGZpbGw9IiMxZDRlZDgiLz48ZyBmaWxsPSIjZmZmIj48cmVjdCB4PSIxNiIgeT0iMzYiIHdpZHRoPSI3IiBoZWlnaHQ9IjE0IiByeD0iMiIvPjxyZWN0IHg9IjI4LjUiIHk9IjI2IiB3aWR0aD0iNyIgaGVpZ2h0PSIyNCIgcng9IjIiLz48cmVjdCB4PSI0MSIgeT0iMTYiIHdpZHRoPSI3IiBoZWlnaHQ9IjM0IiByeD0iMiIvPjwvZz48L3N2Zz4='

/**
 * How a version's `commit` is chosen.
 *
 * Each version records the commit it was published at, and a SHA cannot name
 * the commit that publishes it — so the order is: commit the plugin files
 * first, then write that SHA into the entries here, rebuild the index, and
 * commit the manifest. A version already published keeps its SHA permanently;
 * repinning it would make an install source change under a version that users
 * have already resolved.
 *
 * `pnpm run verify` runs the whole chain and will tell you if anything is off
 * (`verify-index-fresh` compares every plugin's package.json version against the
 * version registered here, so bumping a plugin without adding an entry fails
 * loudly instead of leaving the market showing the old version).
 *
 * The one exception is a repin that changes nothing a client reads: the commit
 * the market's detail page fetches (README and its images) is the pinned one,
 * not the default branch, so a plugin pinned before a README fix shows the old
 * README forever. Repinning such a version to a later commit is safe exactly
 * when no file other than the README, its images and the matching `files` entry
 * changed — those three change what the detail page renders and nothing a
 * running install reads. Verify that before repinning, and never repin to pick
 * up plugin code.
 */

/**
 * Inline icon for `dsh-vyra-studymate`.
 *
 * Hand-held, and declared OUTSIDE the generated icon block below on purpose:
 * `sync-manifest-icons.mjs` derives each constant from the plugin's own
 * `icon.svg`, and this plugin ships none, so the generator cannot own it. It was
 * dropped from the manifest along with two others and the manifest stopped
 * compiling; this carries the payload the manifest held before the drop.
 */
const STUDYMATE_ICON =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+PHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTQiIGZpbGw9IiM0ZjQ2ZTUiLz48ZyBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMzIgMjB2MjYiLz48cGF0aCBkPSJNMzIgMjBjLTQtMy05LTQtMTQtNHYyNmM1IDAgMTAgMSAxNCA0IDQtMyA5LTQgMTQtNFYxNmMtNSAwLTEwIDEtMTQgNHoiLz48L2c+PHBhdGggZD0iTTI2LjUgMjkuNWwxMCA1LTEwIDV6IiBmaWxsPSIjZmZmIi8+PC9zdmc+'

/** Inline icon for `dsh-vyra-agent-manager`. */
const AGENT_MANAGER_ICON =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCIgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0Ij4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZ3JhZCIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM0RjQ2RTU7c3RvcC1vcGFjaXR5OjEiIC8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3R5bGU9InN0b3AtY29sb3I6IzdDM0FFRDtzdG9wLW9wYWNpdHk6MSIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCIgcng9IjEyIiBmaWxsPSJ1cmwoI2dyYWQpIi8+CiAgPGcgZmlsbD0id2hpdGUiIG9wYWNpdHk9IjAuOTUiPgogICAgPGNpcmNsZSBjeD0iMjIiIGN5PSIyNCIgcj0iNiIvPgogICAgPGNpcmNsZSBjeD0iNDIiIGN5PSIyNCIgcj0iNiIvPgogICAgPGNpcmNsZSBjeD0iMzIiIGN5PSI0NCIgcj0iNiIvPgogICAgPHBhdGggZD0iTTIyIDMwIEwzMiAzOCIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIiBvcGFjaXR5PSIwLjYiLz4KICAgIDxwYXRoIGQ9Ik00MiAzMCBMMzIgMzgiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMiIgb3BhY2l0eT0iMC42Ii8+CiAgPC9nPgo8L3N2Zz4NCg=='
/** Inline icon for `dsh-vyra-smart-compaction`. */
const SMART_COMPACTION_ICON =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCIgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiByb2xlPSJpbWciIGFyaWEtbGFiZWw9IlNtYXJ0IGNvbXBhY3Rpb24iPgogIDx0aXRsZT5TbWFydCBjb21wYWN0aW9uPC90aXRsZT4KICA8ZyBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyLjQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+CiAgICA8cmVjdCB4PSI2IiB5PSI5IiB3aWR0aD0iMzYiIGhlaWdodD0iMzAiIHJ4PSI0IiAvPgogICAgPHBhdGggZD0iTTExIDE2aDI2IiAvPgogICAgPHBhdGggZD0iTTExIDIzaDE4IiAvPgogICAgPHBhdGggZD0iTTExIDMwaDEwIiAvPgogICAgPHBhdGggZD0iTTMwIDI3LjUgMzUuNSAzMyAzMCAzOC41IiAvPgogIDwvZz4KICA8Y2lyY2xlIGN4PSIxOC41IiBjeT0iMzMuNSIgcj0iMi40IiBmaWxsPSJjdXJyZW50Q29sb3IiIC8+Cjwvc3ZnPgo='
/** Inline icon for `dsh-vyra-skill-mcp-manager`. */
const SKILL_MCP_ICON =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj4KICA8cGF0aCBkPSJNMjEgMTZWOGEyIDIgMCAwIDAtMS0xLjczbC03LTRhMiAyIDAgMCAwLTIgMGwtNyA0QTIgMiAwIDAgMCAzIDh2OGEyIDIgMCAwIDAgMSAxLjczbDcgNGEyIDIgMCAwIDAgMiAwbDctNEEyIDIgMCAwIDAgMjEgMTZ6Ii8+CiAgPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMyIvPgogIDxwYXRoIGQ9Ik0xMiA5djYiLz4KICA8cGF0aCBkPSJNOSAxMmg2Ii8+Cjwvc3ZnPgo='
/** Inline icon for `dsh-vyra-ssh-terminal`. */
const SSH_TERMINAL_ICON =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCIgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0Ij4KICA8cmVjdCB4PSI2IiB5PSIxMCIgd2lkdGg9IjUyIiBoZWlnaHQ9IjQ0IiByeD0iOCIgZmlsbD0iIzFmMjkzNyIvPgogIDxyZWN0IHg9IjYiIHk9IjEwIiB3aWR0aD0iNTIiIGhlaWdodD0iMTAiIHJ4PSI4IiBmaWxsPSIjMzc0MTUxIi8+CiAgPGNpcmNsZSBjeD0iMTQiIGN5PSIxNSIgcj0iMiIgZmlsbD0iI2Y4NzE3MSIvPgogIDxjaXJjbGUgY3g9IjIxIiBjeT0iMTUiIHI9IjIiIGZpbGw9IiNmYmJmMjQiLz4KICA8Y2lyY2xlIGN4PSIyOCIgY3k9IjE1IiByPSIyIiBmaWxsPSIjMzRkMzk5Ii8+CiAgPHBhdGggZD0iTTE1IDMxbDggNi04IDYiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzM0ZDM5OSIgc3Ryb2tlLXdpZHRoPSIzLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgogIDxwYXRoIGQ9Ik0yOSA0NGgxNCIgc3Ryb2tlPSIjZTVlN2ViIiBzdHJva2Utd2lkdGg9IjMuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+Cjwvc3ZnPgo='
/** Inline icon for `dsh-vyra-system-selection`. */
const SYSTEM_SELECTION_ICON =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIj4KICA8cGF0aCBkPSJNNCAzaDRNNCAzdjRNMjAgM2gtNE0yMCAzdjRNNCAyMWg0TTQgMjF2LTRNMjAgMjFoLTRNMjAgMjF2LTQiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgogIDxwYXRoIGQ9Ik05IDEyaDdNMTMgOWwzIDMtMyAzIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+Cg=='
/** Inline icon for `dsh-vyra-free-theme`. */
const FREE_THEME_ICON =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzYiIGhlaWdodD0iMzYiIHZpZXdCb3g9IjAgMCAzNiAzNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiByb2xlPSJpbWciIGFyaWEtbGFiZWw9ImRzaC1za2lucyI+DQogIDwhLS0gZHNoLXNraW5zIOearuiCpO+8muS4ieW8oOaJh+W9ouiJsuWNoe+8iOe0qy/pnZIv6JOd77yJ57uV5bqV6YOo5p6i6L20IMKxMzDCsCDlsZXlvIAgPSDlpJrlpZflk4HniYznmq7ogqTng63liIfmjaIgLS0+DQogIDxyZWN0IHg9IjExLjUiIHk9IjkuNSIgd2lkdGg9IjEzIiBoZWlnaHQ9IjE3LjUiIHJ4PSIzLjIiIGZpbGw9InVybCgjdikiIHRyYW5zZm9ybT0icm90YXRlKC0zMCAxOCAyOSkiLz4NCiAgPHJlY3QgeD0iMTEuNSIgeT0iOS41IiB3aWR0aD0iMTMiIGhlaWdodD0iMTcuNSIgcng9IjMuMiIgZmlsbD0idXJsKCN0KSIvPg0KICA8cmVjdCB4PSIxMS41IiB5PSI5LjUiIHdpZHRoPSIxMyIgaGVpZ2h0PSIxNy41IiByeD0iMy4yIiBmaWxsPSJ1cmwoI2IpIiB0cmFuc2Zvcm09InJvdGF0ZSgzMCAxOCAyOSkiLz4NCiAgPGRlZnM+DQogICAgPGxpbmVhckdyYWRpZW50IGlkPSJiIiB4MT0iMTEuNSIgeTE9IjkuNSIgeDI9IjI0LjUiIHkyPSIyNyIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPg0KICAgICAgPHN0b3Agc3RvcC1jb2xvcj0iIzY5QjlGRiIvPg0KICAgICAgPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMzI0REUyIi8+DQogICAgPC9saW5lYXJHcmFkaWVudD4NCiAgICA8bGluZWFyR3JhZGllbnQgaWQ9InQiIHgxPSIxMS41IiB5MT0iOS41IiB4Mj0iMjQuNSIgeTI9IjI3IiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+DQogICAgICA8c3RvcCBzdG9wLWNvbG9yPSIjNDVFN0E0Ii8+DQogICAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMwNTkwOUQiLz4NCiAgICA8L2xpbmVhckdyYWRpZW50Pg0KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0idiIgeDE9IjExLjUiIHkxPSI5LjUiIHgyPSIyNC41IiB5Mj0iMjciIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj4NCiAgICAgIDxzdG9wIHN0b3AtY29sb3I9IiNCMThDRkYiLz4NCiAgICAgIDxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzZDNERFMiIvPg0KICAgIDwvbGluZWFyR3JhZGllbnQ+DQogIDwvZGVmcz4NCjwvc3ZnPg0K'
/** Inline icon for `dsh-vyra-agent-cli-manager`. */
const AGENT_CLI_MANAGER_ICON =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCIgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByb2xlPSJpbWciIGFyaWEtbGFiZWw9IkFnZW50IENMSSBNYW5hZ2VyIj4NCiAgPHRpdGxlPkFnZW50IENMSSBNYW5hZ2VyPC90aXRsZT4NCiAgPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTQiIGZpbGw9IiMwZjc2NmUiLz4NCiAgPGcgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjMiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+DQogICAgPHJlY3QgeD0iMTQiIHk9IjE2IiB3aWR0aD0iMzYiIGhlaWdodD0iMzIiIHJ4PSI1IiBvcGFjaXR5PSIwLjg1Ii8+DQogICAgPHBhdGggZD0iTTIyIDI3bDUgNS01IDUiLz4NCiAgICA8cGF0aCBkPSJNMzIgMzdoMTAiLz4NCiAgPC9nPg0KPC9zdmc+DQo='
/** Inline icon for `dsh-vyra-plugin-market`. */
const PLUGIN_MARKET_ICON =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSI+CiAgPHBhdGggZD0iTTMgOS41IDEyIDRsOSA1LjV2NUwxMiAyMGwtOS01LjV2LTVaIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIxLjYiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KICA8cGF0aCBkPSJNMyA5LjUgMTIgMTVsOS01LjUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjEuNiIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgogIDxwYXRoIGQ9Ik0xMiAyMHYtNSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMS42IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICA8cGF0aCBkPSJNNy42IDYuOSAxNi40IDEyIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIxLjYiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K'
/** Inline icon for `dsh-vyra-file-manager`. */
const FILE_MANAGER_ICON =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgdmlld0JveD0iMCAwIDQ4IDQ4IiBmaWxsPSJub25lIj4NCiAgPHJlY3QgeD0iNCIgeT0iNyIgd2lkdGg9IjQwIiBoZWlnaHQ9IjM0IiByeD0iMTAiIGZpbGw9IiMxMDE3MjIiLz4NCiAgPHJlY3QgeD0iOSIgeT0iMTIiIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMCIgcng9IjMiIGZpbGw9IiM3QUFBRkYiIGZpbGwtb3BhY2l0eT0iLjkiLz4NCiAgPHJlY3QgeD0iMjQiIHk9IjEyIiB3aWR0aD0iMTUiIGhlaWdodD0iMTAiIHJ4PSIzIiBmaWxsPSIjRTVCNDZBIiBmaWxsLW9wYWNpdHk9Ii45MiIvPg0KICA8cmVjdCB4PSI5IiB5PSIyNSIgd2lkdGg9IjkiIGhlaWdodD0iMTEiIHJ4PSIzIiBmaWxsPSIjNkZENkI1IiBmaWxsLW9wYWNpdHk9Ii45Ii8+DQogIDxwYXRoIGQ9Ik0yNC41IDMwLjUgMzQgMjUuMmwtOS41IDUuM3oiIGZpbGw9IiNGNEY1RjciLz4NCiAgPHBhdGggZD0iTTI0LjUgMzAuNSAzNCAyNS4ydjEwLjZMMjQuNSAzMC41eiIgZmlsbD0iI0Y0RjVGNyIgZmlsbC1vcGFjaXR5PSIuNTUiLz4NCjwvc3ZnPg0K'
/** Inline icon for `dsh-vyra-dsh-console`. */
const DSH_CONSOLE_ICON =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCIgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByb2xlPSJpbWciIGFyaWEtbGFiZWw9IkRTSCBDb25zb2xlIj4KICA8dGl0bGU+RFNIIENvbnNvbGU8L3RpdGxlPgogIDxyZWN0IHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCIgcng9IjE0IiBmaWxsPSIjMGYzZDVjIi8+CiAgPHJlY3QgeD0iOSIgeT0iMTMiIHdpZHRoPSI0NiIgaGVpZ2h0PSIzOCIgcng9IjciIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2VhZjZmZiIgc3Ryb2tlLXdpZHRoPSIzIi8+CiAgPHBhdGggZD0iTTkgMjRoNDYiIHN0cm9rZT0iI2VhZjZmZiIgc3Ryb2tlLXdpZHRoPSIzIi8+CiAgPGNpcmNsZSBjeD0iMTYiIGN5PSIxOC41IiByPSIyIiBmaWxsPSIjN2ZkMWZmIi8+CiAgPGNpcmNsZSBjeD0iMjMiIGN5PSIxOC41IiByPSIyIiBmaWxsPSIjN2ZkMWZmIiBvcGFjaXR5PSIwLjY1Ii8+CiAgPHBhdGggZD0iTTE2IDMxLjVoMTFNMTYgMzhoMTFNMTYgNDQuNWgxMSIgc3Ryb2tlPSIjN2ZkMWZmIiBzdHJva2Utd2lkdGg9IjIuNiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBvcGFjaXR5PSIwLjkiLz4KICA8ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgzOSA0MCkiPgogICAgPGNpcmNsZSBjeD0iMCIgY3k9IjAiIHI9IjkuNSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZkMjdmIiBzdHJva2Utd2lkdGg9IjIuOCIvPgogICAgPGcgc3Ryb2tlPSIjZmZkMjdmIiBzdHJva2Utd2lkdGg9IjIuNiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIj4KICAgICAgPHBhdGggZD0iTTAgLTE0LjV2LTMuNSIvPgogICAgICA8cGF0aCBkPSJNMCAxNC41djMuNSIvPgogICAgICA8cGF0aCBkPSJNLTE0LjUgMGgtMy41Ii8+CiAgICAgIDxwYXRoIGQ9Ik0xNC41IDBoMy41Ii8+CiAgICAgIDxwYXRoIGQ9Ik0tMTAuMyAtMTAuM2wtMi41IC0yLjUiLz4KICAgICAgPHBhdGggZD0iTTEwLjMgMTAuM2wyLjUgMi41Ii8+CiAgICAgIDxwYXRoIGQ9Ik0xMC4zIC0xMC4zbDIuNSAtMi41Ii8+CiAgICAgIDxwYXRoIGQ9Ik0tMTAuMyAxMC4zbC0yLjUgMi41Ii8+CiAgICA8L2c+CiAgICA8Y2lyY2xlIGN4PSIwIiBjeT0iMCIgcj0iMi42IiBmaWxsPSIjZmZkMjdmIi8+CiAgPC9nPgo8L3N2Zz4K'
/** Inline icon for `dsh-vyra-wechat-local`. */
const WECHAT_LOCAL_ICON =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+PHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTQiIGZpbGw9IiMwN2MxNjAiLz48cGF0aCBkPSJNMTggMjBoMjhhNCA0IDAgMCAxIDQgNHYxNGE0IDQgMCAwIDEtNCA0SDMybC05IDd2LTdoLTVhNCA0IDAgMCAxLTQtNFYyNGE0IDQgMCAwIDEgNC00eiIgZmlsbD0iI2ZmZiIvPjxjaXJjbGUgY3g9IjI1IiBjeT0iMzEiIHI9IjIuNiIgZmlsbD0iIzA3YzE2MCIvPjxjaXJjbGUgY3g9IjMyIiBjeT0iMzEiIHI9IjIuNiIgZmlsbD0iIzA3YzE2MCIvPjxjaXJjbGUgY3g9IjM5IiBjeT0iMzEiIHI9IjIuNiIgZmlsbD0iIzA3YzE2MCIvPjwvc3ZnPg=='
/** Inline icon for `dsh-vyra-xianyu-delivery`. */
const XIANYU_DELIVERY_ICON =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+PHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTQiIGZpbGw9IiMwZjlkNmUiLz48ZyBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTMgMjRsMTktMTAgMTkgMTB2MTlhNSA1IDAgMCAxLTUgNUgxOGE1IDUgMCAwIDEtNS01eiIvPjxwYXRoIGQ9Ik0yNCAzNGgxNk0yNCA0MmgxMCIvPjwvZz48L3N2Zz4K'
/** Inline icon for `dsh-vyra-screen-recorder`. */
const VYRA_SCREEN_RECORDER_ICON =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCIgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSJub25lIj4KICA8cmVjdCB4PSIyIiB5PSIyIiB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHJ4PSIxNSIgZmlsbD0iIzEyMTYxRiIvPgogIDxyZWN0IHg9IjIuNzUiIHk9IjIuNzUiIHdpZHRoPSI1OC41IiBoZWlnaHQ9IjU4LjUiIHJ4PSIxNC4yNSIgc3Ryb2tlPSIjMkIzMjQyIiBzdHJva2Utd2lkdGg9IjEuNSIvPgogIDxyZWN0IHg9IjEzIiB5PSIxNiIgd2lkdGg9IjM4IiBoZWlnaHQ9IjI2IiByeD0iNiIgc3Ryb2tlPSIjRjRGNUY3IiBzdHJva2Utd2lkdGg9IjMiLz4KICA8Y2lyY2xlIGN4PSIzMiIgY3k9IjI5IiByPSI1LjUiIGZpbGw9IiNFNTQ4NEQiLz4KICA8cGF0aCBkPSJNMjQgNTBoMTYiIHN0cm9rZT0iI0Y0RjVGNyIgc3Ryb2tlLXdpZHRoPSIzIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICA8cmVjdCB4PSI0MSIgeT0iMzkiIHdpZHRoPSIxMyIgaGVpZ2h0PSIxMCIgcng9IjMiIGZpbGw9IiMxNjc3RkYiLz4KICA8Y2lyY2xlIGN4PSI0Ny41IiBjeT0iNDQiIHI9IjIuNiIgc3Ryb2tlPSIjRjRGNUY3IiBzdHJva2Utd2lkdGg9IjEuOCIvPgo8L3N2Zz4K'

/** The validated index's localized-text union. */
export type LocalizedText = string | LocaleMap
/** One plugin this market lists. */
export interface MarketPluginSource {
  /** npm package name; unique within this index. */
  readonly name: string
  /** Display title. English is required; other locales are optional. */
  readonly title: LocaleMap
  /** Display introduction; same locale rules as {@link title}. */
  readonly description: LocaleMap
  /**
   * Inline `data:` image the market card renders. Published indexes carry a
   * base64 SVG, because a referenced file would need its own fetch and a
   * relative path would not resolve from the client.
   */
  readonly icon?: string
  /** Absolute http(s) URL of the project page. */
  readonly homepage?: string
  /** Source repository, shown in Discover; never an install source. */
  readonly repository?: {
    readonly url: string
    readonly directory?: string
  }
  readonly author?: string
  /**
   * DSH SemVer range. Omitted deliberately, and omit it unless the plugin
   * genuinely needs a newer DSH: a guessed range rejects older clients that
   * would have worked. With no `engines.dsh`, DSH falls back to peer
   * dependencies, and this plugin declares none because it reads every service
   * through `ctx.get` at runtime.
   */
  readonly engines?: { readonly dsh: string }
  /** Where each version installs from. Keyed by exact SemVer. */
  readonly versions: Readonly<Record<string, MarketVersionSource>>
  /**
   * Category, labels, and keywords. Omitted entirely when there are none —
   * published indexes leave the field off rather than emitting empty arrays.
   */
  readonly metadata?: {
    readonly category?: string
    readonly keywords?: readonly string[]
    readonly labels?: readonly string[]
  }
}

/** One install source plus the moment it was published. */
export interface MarketVersionSource {
  /**
   * Unix seconds this version was published. Written here rather than derived,
   * so rebuilding the index cannot rewrite a published version's timestamp.
   */
  readonly publishTimestamp: number
  readonly source: MarketInstallSource
}

/** Where one exact version installs from. */
export type MarketInstallSource =
  | { readonly type: 'npm'; readonly registry?: string }
  | {
    readonly type: 'git'
    /** Canonical https URL, no credentials, query, or fragment. */
    readonly url: string
    /** Lowercase 40-hex commit SHA. */
    readonly commit: string
    /** Relative POSIX package directory; absent means the repository root. */
    readonly path?: string
  }

/** Declarations the index defines; plugins may only reference these ids. */
export interface MarketDeclarations {
  readonly categories?: Readonly<Record<string, { readonly title: LocaleMap }>>
  readonly labels?: Readonly<Record<string, { readonly title: LocaleMap }>>
}

/** The complete market document. */
export interface MarketManifest {
  readonly title: LocaleMap
  readonly description?: LocaleMap
  readonly declarations?: MarketDeclarations
  readonly plugins: readonly MarketPluginSource[]
}

export const manifest: MarketManifest = {
  title: {
    en: 'Veyra Plugins',
    zh: 'Veyra 插件市场',
  },
  description: {
    en: 'Plugins and skills for DeepSeek Harness, maintained alongside the dsh-Veyra fork.',
    zh: '面向 DeepSeek Harness 的插件与技能，随 dsh-Veyra fork 维护。',
  },
  declarations: {
    categories: {
      'agent-runtime': { title: { en: 'Agent runtime', zh: '智能体运行时' } },
      'observability': { title: { en: 'Observability', zh: '可观测性' } },
      'input-output': { title: { en: 'Input and output', zh: '输入与输出' } },
      'integration': { title: { en: 'Integrations', zh: '外部集成' } },
      'browser': { title: { en: 'Browser and desktop', zh: '浏览器与桌面' } },
      'content': { title: { en: 'Content creation', zh: '内容创作' } },
      'appearance': { title: { en: 'Appearance', zh: '界面外观' } },
      'media': { title: { en: 'Media', zh: '媒体处理' } },
      'model': { title: { en: 'Model access', zh: '模型接入' } },
    },
  },
  plugins: [
    {
      name: 'dsh-vyra-tool-usage-stats',
      title: {
        en: 'Tool Analysis',
        zh: '工具分析',
      },
      description: {
        en: 'Counts every tool call and records why each failure happened, then hands you the ones you pick as text to paste into a conversation — statistics and the recent failure samples, with a prompt that asks the model to find the repeat offender and fix it.',
        zh: '统计每次工具调用、记下每次失败的原因。勾选出问题的工具，一键把统计与近期失败样本连同分析提示词复制走，粘进对话就能让模型找出反复出错的那一个并给出修复。',
      },
      author: 'lanxiake',
      homepage: 'https://github.com/lanxiake/dsh-vyra-plugins#readme',
      repository: {
        url: 'https://github.com/lanxiake/dsh-vyra-plugins',
        directory: 'plugins/tool-usage-stats',
      },
      icon: TOOL_USAGE_ICON,
      versions: {
        '0.7.5': {
          publishTimestamp: 1795680000,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '4f4d01ffe5612461d706874dabe66996ad306cda',
            path: 'plugins/tool-usage-stats',
          },
        },
        '0.6.0': {
          // Unix seconds of the commit that published it.
          publishTimestamp: 1794551488,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'ec3d3abfd7878410695de90798bcfe9a738a436e',
            path: 'plugins/tool-usage-stats',
          },
        },
        // 0.7.0 is 工具分析: the model-analysis half is gone (no schedule, no
        // threshold or cooldown, no diagnose/apply/dismiss routes), and the panel
        // copies the selected tools' evidence to the clipboard instead.
        '0.7.0': {
          publishTimestamp: 1795392000,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'f9dd87937729ba1ec3898f0de845483f141f2295',
            path: 'plugins/tool-usage-stats',
          },
        },
        // 0.7.1 reads only the current record. A profile that once held both the
        // legacy counter set and the snapshot could show the older one; the
        // legacy key is no longer consulted.
        '0.7.1': {
          publishTimestamp: 1795060200,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '9ea34cf6d81662e126a62e4720c26f5daca4696b',
            path: 'plugins/tool-usage-stats',
          },
        },
        // 0.7.2 asks the endpoint for every window its selector offers. It
        // requested none, so the host answered its default pair and the
        // 3-day and 1-day tabs rendered empty.
        '0.7.2': {
          publishTimestamp: 1795062600,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'ab5079897989fa2a0a1178fd825112ac88b2ec41',
            path: 'plugins/tool-usage-stats',
          },
        },
        // 0.7.3 opens the panel on 最近 3 天; the cumulative totals stay one
        // selection away.
        '0.7.3': {
          publishTimestamp: 1795065600,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '3d318c9dc1f0e4e81463c38f96b209189a01f06c',
            path: 'plugins/tool-usage-stats',
          },
        },
        // 0.7.4 ships the icon the market card already draws: without an `./icon` export the
        // installed plugin list fell back to a generic glyph.
        '0.7.4': {
          publishTimestamp: 1795080600,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '92dc3e408b046e087608dd22491a19b2b2915c7d',
            path: 'plugins/tool-usage-stats',
          },
        },
      },
      metadata: {
        category: 'observability',
        keywords: ['stats', 'tool-usage', 'observability'],
      },
    },
    {
      name: 'dsh-vyra-agent-manager',
      title: {
        en: 'Agent Manager',
        zh: '智能体管理',
      },
      description: {
        en: 'Create and manage agents in a panel instead of a config file: each one gets its own prompt, capability set, tool restrictions and preferred skills, and the main agent can create them for you.',
        zh: '用面板而不是配置文件来创建和管理智能体：每个智能体有自己的提示词、能力集、工具限制与优选技能，主智能体也能替你创建它们。',
      },
      author: 'lanxiake',
      homepage: 'https://github.com/lanxiake/dsh-vyra-plugins#readme',
      repository: {
        url: 'https://github.com/lanxiake/dsh-vyra-plugins',
        directory: 'plugins/vyra-agent-manager',
      },
      icon: AGENT_MANAGER_ICON,
      versions: {
        '1.3.1': {
          publishTimestamp: 1795679999,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '4f4d01ffe5612461d706874dabe66996ad306cda',
            path: 'plugins/vyra-agent-manager',
          },
        },
        '1.1.0': {
          publishTimestamp: 1794551488,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'ec3d3abfd7878410695de90798bcfe9a738a436e',
            path: 'plugins/vyra-agent-manager',
          },
        },
        // 1.2.0 edits in a full-screen sectioned layout with a live summary and a
        // preview of the rows to install; system presets and custom Agents share
        // one detail page (capabilities and persona prefix are inferred from the
        // declaration); deleting an Agent whose profile bundle record was lost
        // now cleans up the preset directory and stale link, and a Repair action
        // re-registers it; cards and details can start a new session with a preset.
        '1.2.0': {
          publishTimestamp: 1795338000,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '6391caf77e702593122cc37d372b27f5d6b4e89a',
            path: 'plugins/vyra-agent-manager',
          },
        },
        // 1.3.0 moves the editor into a right-side drawer, adds the AI create/edit
        // flow (prefilled session + agent-builder skill + agent_manager preview),
        // a usage tab read from the session projection cache, and error boundaries
        // so one malformed preset cannot blank the whole panel.
        '1.3.0': {
          publishTimestamp: 1795410000,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'fc2085e89e1bfba83061a206c12a96abeb855630',
            path: 'plugins/vyra-agent-manager',
          },
        },
      },
      metadata: {
        category: 'agent-runtime',
        keywords: ['agent', 'preset', 'panel'],
      },
    },
    {
      name: 'dsh-vyra-smart-compaction',
      title: {
        en: 'Smart Compaction',
        zh: '智能压缩',
      },
      description: {
        en: 'Tiered, agent-decided context compaction: a pressure ladder, a deterministic pre-prune gated on how much it actually reclaims, and compaction the model can call itself. Keeps long sessions alive without churning the prompt cache.',
        zh: '分层、由智能体决定的高质量上下文压缩：压力阶梯、以"真的回收了多少"为门槛的确定性预剪枝，以及模型可自行调用的压缩工具。让长会话活得下去，又不会反复冲掉提示缓存。',
      },
      author: 'lanxiake',
      homepage: 'https://github.com/lanxiake/dsh-vyra-plugins#readme',
      repository: {
        url: 'https://github.com/lanxiake/dsh-vyra-plugins',
        directory: 'plugins/vyra-smart-compaction',
      },
      icon: SMART_COMPACTION_ICON,
      versions: {
        '0.1.1': {
          publishTimestamp: 1795679998,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '4f4d01ffe5612461d706874dabe66996ad306cda',
            path: 'plugins/vyra-smart-compaction',
          },
        },
        '0.1.0': {
          publishTimestamp: 1794551488,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'ec3d3abfd7878410695de90798bcfe9a738a436e',
            path: 'plugins/vyra-smart-compaction',
          },
        },
      },
      metadata: {
        category: 'agent-runtime',
        keywords: ['compaction', 'context', 'tokens'],
      },
    },
    {
      name: 'dsh-vyra-skill-mcp-manager',
      title: {
        en: 'Skill and MCP Manager',
        zh: '技能与 MCP 管理',
      },
      description: {
        en: 'Browse, search and install skills and MCP servers from one panel, instead of hand-editing profile config rows to add each one.',
        zh: '在一个面板里浏览、搜索、安装技能与 MCP 服务器，不必为每一件都手改 profile 配置行。',
      },
      author: 'lanxiake',
      homepage: 'https://github.com/lanxiake/dsh-vyra-plugins#readme',
      repository: {
        url: 'https://github.com/lanxiake/dsh-vyra-plugins',
        directory: 'plugins/vyra-skill-mcp-manager',
      },
      icon: SKILL_MCP_ICON,
      versions: {
        '1.4.1': {
          publishTimestamp: 1795789021,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'f2cf715a4235662ccc7e1a76ea0e49bea37e03b4',
            path: 'plugins/vyra-skill-mcp-manager',
          },
        },
        '1.3.2': {
          publishTimestamp: 1795679997,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '4f4d01ffe5612461d706874dabe66996ad306cda',
            path: 'plugins/vyra-skill-mcp-manager',
          },
        },
        // 1.0.0 keeps its original commit: a version whose source moved under
        // users who already resolved it is not a version anymore.
        '1.0.0': {
          publishTimestamp: 1794551488,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '54bd6c6be93723ddeda71f5802eb23fdd9fb3204',
            path: 'plugins/vyra-skill-mcp-manager',
          },
        },
        '1.1.0': {
          publishTimestamp: 1794900000,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '3a370b1ffcdca5d832672d029ac3014c9dee17c7',
            path: 'plugins/vyra-skill-mcp-manager',
          },
        },
        '1.2.0': {
          publishTimestamp: 1795050000,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'ec3d3abfd7878410695de90798bcfe9a738a436e',
            path: 'plugins/vyra-skill-mcp-manager',
          },
        },
        // 1.3.0: market skill cards open their SKILL.md detail (installed or
        // not), and every preview ends with the QQ group card.
        '1.3.0': {
          publishTimestamp: 1795066681,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'a20c4bdea5b9e60677d392a621545d16ae8bbe8d',
            path: 'plugins/vyra-skill-mcp-manager',
          },
        },
        // 1.3.1 keeps only the QQ group text at the end of a preview.
        '1.3.1': {
          publishTimestamp: 1795067593,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '7f72ea171649065cef2c4efaae71b2d658e97834',
            path: 'plugins/vyra-skill-mcp-manager',
          },
        },
      },
      metadata: {
        category: 'integration',
        keywords: ['skill', 'mcp', 'market'],
      },
    },
    {
      name: 'dsh-vyra-ssh-terminal',
      title: {
        en: 'SSH Terminal',
        zh: 'SSH 终端',
      },
      description: {
        en: 'An SSH terminal inside DSH with an AI assistant that runs commands in the terminal you can see: connection profiles, jump hosts, SFTP with transfer progress, resource monitoring and host-key pinning. Passwords go to the credentials service, never into the profile file.',
        zh: '把 SSH 终端搬进 DSH，自带 AI 助手：它的命令就打在你眼前那个终端里。连接档案、跳板、带进度的 SFTP、资源监控与主机密钥固定。密码只进凭据服务，档案文件里没有任何秘密。',
      },
      author: 'lanxiake',
      homepage: 'https://github.com/lanxiake/dsh-vyra-plugins#readme',
      repository: {
        url: 'https://github.com/lanxiake/dsh-vyra-plugins',
        directory: 'plugins/vyra-ssh-terminal',
      },
      icon: SSH_TERMINAL_ICON,
      versions: {
        '0.2.0': {
          publishTimestamp: 1795833104,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '772cc73feef6f1d1686201c3205e9e6c287c177e',
            path: 'plugins/vyra-ssh-terminal',
          },
        },
        '0.1.3': {
          publishTimestamp: 1795679996,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '4f4d01ffe5612461d706874dabe66996ad306cda',
            path: 'plugins/vyra-ssh-terminal',
          },
        },
        '0.1.0': {
          publishTimestamp: 1794551488,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'ec3d3abfd7878410695de90798bcfe9a738a436e',
            path: 'plugins/vyra-ssh-terminal',
          },
        },
        // 0.1.1 fixes the credential key grammar: a colon-separated key made the
        // whole credentials document unparseable at the next Host start.
        '0.1.1': {
          publishTimestamp: 1795074249,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'c55e166864ba3d279b71eaeea4b2a75c9f756338',
            path: 'plugins/vyra-ssh-terminal',
          },
        },
        // 0.1.2 fixes a startup-killing bug: credential keys used a colon
        // ("ssh-terminal/<id>:password"), which the credentials store rejects,
        // so one saved SSH password made the whole Host crash on next start.
        '0.1.2': {
          publishTimestamp: 1795074609,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '3e35a33964fc538665b2c480debd9787b8744a42',
            path: 'plugins/vyra-ssh-terminal',
          },
        },
      },
      metadata: {
        category: 'integration',
        keywords: ['ssh', 'terminal', 'sftp', 'remote'],
      },
    },
    {
      name: 'dsh-vyra-system-selection',
      title: {
        en: 'System Selection',
        zh: '系统级划词',
      },
      description: {
        en: 'Select text in any application and get a native toolbar: translate, copy, explain, summarize. Answers render as Markdown, scroll, expand, and copy on drag-select. It takes over the right mouse button, so the application menu you would otherwise get does not appear in front of it.',
        zh: '在任何应用里划词，弹出原生工具条：翻译、复制、解释、总结。结果按 Markdown 渲染，可滚动、可展开、可拖选复制。它接管右键，所以应用自带的右键菜单不会再冒出来跟你抢。仅 Windows。',
      },
      author: 'lanxiake',
      homepage: 'https://github.com/lanxiake/dsh-vyra-plugins#readme',
      repository: {
        url: 'https://github.com/lanxiake/dsh-vyra-plugins',
        directory: 'plugins/vyra-system-selection',
      },
      icon: SYSTEM_SELECTION_ICON,
      versions: {
        // 3.2.1 hears keystrokes through raw input rather than a global hook,
        // so the toolbar closes on typing without swallowing the keystroke.
        '3.2.1': {
          publishTimestamp: 1795741200,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '26b55e971cd334256f6fb6faef3364ebeb2e6530',
            path: 'plugins/vyra-system-selection',
          },
        },
        '3.1.3': {
          publishTimestamp: 1795679995,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '4f4d01ffe5612461d706874dabe66996ad306cda',
            path: 'plugins/vyra-system-selection',
          },
        },
        '1.0.0': {
          publishTimestamp: 1794960000,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'a9bfa549aae379aab9649ffe886a2239e71898d6',
            path: 'plugins/vyra-system-selection',
          },
        },
        // 1.1.0 fixes two things 1.0.0 shipped: the settings page painted itself from
        // `--dsw-color-*` token names that do not exist in the client, so it rendered its dark
        // fallbacks on every theme; and the capture path injected Ctrl+C while the user was
        // holding Ctrl himself, which broke his own copy and paste everywhere.
        '1.1.0': {
          publishTimestamp: 1795046400,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '28f63b7243a7e07555312c509f7fade6828d25dc',
            path: 'plugins/vyra-system-selection',
          },
        },
        // 1.2.0 makes selecting text the trigger. The capability existed but was off by default
        // and unreachable inside the DSH window, whose surface the poll skips on purpose.
        '1.2.0': {
          publishTimestamp: 1795132800,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'fa2db0587b5bd1f668234a89ce2b44be329babeb',
            path: 'plugins/vyra-system-selection',
          },
        },
        '1.3.0': {
          publishTimestamp: 1795219200,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '6b7b215d39a1ae8ad0ec7ef4efc3602b2b3cefff',
            path: 'plugins/vyra-system-selection',
          },
        },
        // 1.4.0 fixes what 1.3.0 shipped: the koffi type declarations ran at
        // module load and koffi registers those names process-wide, so loading
        // the module a second time — a re-enable, or an update inside a running
        // Host — failed with "Duplicate type name 'POINT'" and the entry never
        // activated. Installing from scratch happened to work, which is why it
        // looked like an install problem.
        '1.4.0': {
          publishTimestamp: 1795305600,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'ec3d3abfd7878410695de90798bcfe9a738a436e',
            path: 'plugins/vyra-system-selection',
          },
        },
        // 1.4.1 fixes two things the earlier versions shipped: 1.3.0 called
        // `saneRect` from an action handler without importing it, which took the
        // whole Host down with a ReferenceError the first time the toolbar was
        // used; and the package exported neither `locale/*.json` nor
        // `package.json`, so the installed-plugins list had no description to
        // show.
        '1.4.1': {
          publishTimestamp: 1795392000,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'aba67108d2145583884ccd3fd77cbf0e0ffeecb0',
            path: 'plugins/vyra-system-selection',
          },
        },
        // 1.4.2 makes the actions actually run: the model was resolved as the first
        // provider paired with an empty model id, so every action took the "no model
        // selected" branch and the menu buttons looked dead with no visible error.
        '1.4.2': {
          publishTimestamp: 1795392000,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '8d971ed6b15feeb3181e3f6e17b67c6622461701',
            path: 'plugins/vyra-system-selection',
          },
        },
        // 1.4.3 leaves the shared client lexical scope alone: the bundle is IIFE-wrapped
        // and its endpoint is package-prefixed, so it no longer collides with any other
        // plugin's top-level `const RPC`.
        '1.4.3': {
          publishTimestamp: 1795062317,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '274cc8b3c066d78c8fee290960c985feb9305322',
            path: 'plugins/vyra-system-selection',
          },
        },
        // 1.5.0 is the toolbar reshape and the two silent failures behind it: the menu is one
        // row with the icon left of its label (the shape Doubao and every other selection
        // toolbar uses), an empty model answer now says what came back instead of painting a
        // blank panel, and the whole action path reports instead of dying as an unhandled
        // rejection. It also stops priming a capture on every plain click — that injected
        // Ctrl+C and busy-waited 220 ms with the system's input queue behind it, which is what
        // made the desktop feel sticky once the plugin was on.
        '1.5.0': {
          publishTimestamp: 1795069344,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '287a29b406e136eeff4f5e3441cbacc5a9986c1d',
            path: 'plugins/vyra-system-selection',
          },
        },
        // 1.5.1 makes the one part that touches every mouse event optional. The right-click
        // takeover needs a WH_MOUSE_LL hook, which puts this process in the system's input path;
        // the switch removes it entirely (selection-trigger and the in-window right-click keep
        // working). Disabling the whole plugin used to leave that hook swallowing right-clicks,
        // and the settings page now prints the version the Host actually loaded, so an install
        // without a restart is visible instead of looking like a fix that did nothing.
        '1.5.1': {
          publishTimestamp: 1795074360,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'f5267ac1c0373031d13db1b1f06d556e8246aed5',
            path: 'plugins/vyra-system-selection',
          },
        },
        // 1.5.2 shortens the latency the hook imposes on every mouse event: Windows delivers a
        // WH_MOUSE_LL callback only when the installing thread pumps, so a 16 ms pump added up to
        // 8 ms to each event machine-wide. The queue is now drained every 4 ms while the hook is
        // installed (and every 16 ms for a plain popup), and both timers stop when idle.
        '1.5.2': {
          publishTimestamp: 1795075200,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '8f19338d97a945bc10d8c7307c06cc301041e5ae',
            path: 'plugins/vyra-system-selection',
          },
        },
        // 1.5.3 is the blank panel, and it was here since the first version: `setContent` follows
        // the stream by setting `scroll` to MAX_SAFE_INTEGER and nothing clamped it back, so every
        // line was laid out at -1.7e308 and skipped — title and status painted, body empty while
        // the answer sat in memory. The footer's copy button now reports whether the clipboard
        // write actually happened instead of always claiming success.
        '1.5.3': {
          publishTimestamp: 1795076400,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '9958b681e82db647d3f2755a4468645b9f531f74',
            path: 'plugins/vyra-system-selection',
          },
        },
        // 1.6.0 reads better and explains itself: the answer is split into paragraphs with a gap
        // between them (one painted run collapsed any structure the model produced), a 401 now
        // names the service that rejected it — the DeepSeek search credential is not the answer
        // model chosen here — and copy moves ahead of summarize in the toolbar.
        '1.6.0': {
          publishTimestamp: 1795077600,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'c00a826eb5354dfd02149b38f47ee7922f3c1b5f',
            path: 'plugins/vyra-system-selection',
          },
        },
        // 1.7.0 makes a long answer usable: the mouse hook forwards wheel events over the panel
        // (a no-activate window never receives them, which is why it could not scroll), a
        // scrollbar shows the overflow, and the answer is laid out line by line so a drag selects
        // a character range and copies it on release.
        '1.7.0': {
          publishTimestamp: 1795081200,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '3f17c72599689e0fa593ef583b9c8dd2f7b2ccd0',
            path: 'plugins/vyra-system-selection',
          },
        },
        // 2.0.0 removes AI search — it needed the DeepSeek web-search credential, unrelated to the
        // model this plugin runs, and its failures read as "the selection plugin is broken".
        // Answers are Markdown now (headings, bullets, numbering, code blocks), and the footer
        // gains 展开/收起 so a long answer can use the screen instead of being scrolled forever.
        '2.0.0': {
          publishTimestamp: 1795086000,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '0ac2ff80f0873c2e7586587edde7b2d25934f009',
            path: 'plugins/vyra-system-selection',
          },
        },
        // 3.0.0 rebuilds the popup as Doubao's selection card: avatar, pin/close, a quoted block
        // of the selection, follow-up chips parsed from `>>` lines, an icon row, and a real EDIT
        // follow-up field (the only part that takes focus). The card grows with its answer to
        // 60% of the screen, so the 展开 button is gone.
        '3.0.0': {
          publishTimestamp: 1795087800,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'b31aa60894c63f4fa870a968368574e43b374d2d',
            path: 'plugins/vyra-system-selection',
          },
        },
        // 3.0.1 stops the card shivering while an answer streams: it was re-placed against the
        // selection on every layout (moving the window ~20 times a second), and now keeps the
        // corner it opened at, grows with SWP_NOREDRAW, and repaints once per frame. The pin
        // button is gone — it toggled state nothing acted on.
        '3.0.1': {
          publishTimestamp: 1795088400,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '99a1d5e1d779d3f708c8e79270878287107014cc',
            path: 'plugins/vyra-system-selection',
          },
        },
        // 3.0.2 makes the card movable: the header is a drag handle (grip drawn, move cursor,
        // SetCapture so the pointer can leave the window), the position is clamped to the work
        // area, and a card that would grow past the bottom slides up to stay whole.
        '3.0.2': {
          publishTimestamp: 1795089000,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'b60d6bd3f62f9e5ce7b40be3fddb7ab94cc99ea8',
            path: 'plugins/vyra-system-selection',
          },
        },
        // 3.1.0 optimizes performance for remote desktop scenarios: removes polling mechanism,
        // reduces hook pump frequency from 4ms to 16ms (-75% wakeups), extends process tree
        // cache from 5s to 30s, and switches to event-driven drag detection. CPU wakeup
        // frequency drops from 283Hz to 62.5Hz (-78%), mouse movement latency reduced by 90%.
        //
        // Repinned: it first pointed at the performance commit, whose package.json still said
        // 3.0.2 — so installing "3.1.0" produced a Host reporting 3.0.2. This commit holds the
        // same plugin code with the version actually bumped; nothing else differs.
        '3.1.0': {
          publishTimestamp: 1795334400,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'd28c24a3eb91f353a73ddd975f7a3513629e2cde',
            path: 'plugins/vyra-system-selection',
          },
        },
        // 3.1.1 takes the global mouse hook out of the default path: it made every mouse event
        // machine-wide wait on the Host's pump, which remote sessions felt as lag. The hook is
        // opt-in now, old profiles carrying the previous default are migrated off once, and the
        // drag trigger falls back to a poll that is not in the input path.
        '3.1.1': {
          publishTimestamp: 1795335000,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '8b9ccc889745eddeacb8b5131a2573be61636494',
            path: 'plugins/vyra-system-selection',
          },
        },
        // 3.1.2 cuts the accidental popups and makes an accidental one dismissible: auto-open
        // fires only on a real drag (a double-click no longer counts) and never on a
        // one-character slip, and with the hook off a click anywhere outside closes the popup.
        '3.1.2': {
          publishTimestamp: 1795336200,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '6a33ae79dfd652e1b1e10fea9c4f96a4720b9497',
            path: 'plugins/vyra-system-selection',
          },
        },
        // 2.0.1 removes an undeclared `lastSources` assignment that threw inside a
        // timer and took the whole host process down on the first selection capture.
        '2.0.1': {
          publishTimestamp: 1795143607,
          source: {
            type: 'git',
            url: 'https://atomgit.com/qq_42997950111111111111111sfq/dsh-vyra-plugins.git',
            commit: 'ad533f50952ac4249c652d249c4946aa95925499',
            path: 'plugins/vyra-system-selection',
          },
        },
      },
      metadata: {
        category: 'browser',
        keywords: ['selection', 'translate', 'clipboard', 'windows'],
      },
    },
    {
      name: 'dsh-vyra-free-theme',
      title: {
        en: 'Free Theme',
        zh: '自由主题',
      },
      description: {
        en: 'Replaces the client appearance with a whole theme: colours, shape, sidebar treatment and a wallpaper that can be an image, a looping video or code. Ships several finished themes, and a CLI plus skill so an agent can build, check and switch them. The wallpaper can cover the left menu or stay in the conversation area.',
        zh: '把客户端外观整体换掉：配色、圆角、左侧菜单样式，以及一张可以是图片、无缝循环视频或代码的壁纸。自带几套成品主题，并提供 CLI 与技能，让 Agent 能自己建主题、检配色、切换。壁纸可以选择覆盖左侧菜单，或只留在对话区。',
      },
      author: 'lanxiake',
      homepage: 'https://github.com/lanxiake/dsh-vyra-plugins#readme',
      repository: {
        url: 'https://github.com/lanxiake/dsh-vyra-plugins',
        directory: 'plugins/vyra-free-theme',
      },
      icon: FREE_THEME_ICON,
      versions: {
        '0.1.1': {
          publishTimestamp: 1795679994,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '4f4d01ffe5612461d706874dabe66996ad306cda',
            path: 'plugins/vyra-free-theme',
          },
        },
        '0.1.0': {
          publishTimestamp: 1795449013,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '0b99710f38803c1700e036f5fb6093eb6da7491b',
            path: 'plugins/vyra-free-theme',
          },
        },
      },
    },
    {
      name: 'dsh-vyra-wechat-local',
      title: {
        en: 'PC WeChat',
        zh: 'PC微信',
      },
      description: {
        en: 'Read the user’s own PC WeChat — sessions, history, images, unread, search and export — and reply per a per-person policy: direct, draft, notify or blacklist. New messages are merged per conversation before they reach the agent. Windows only.',
        zh: '读取用户本人的 PC 微信：会话、聊天记录、图片、未读、检索与导出；按每人策略回复（直接代回 / 起草确认 / 只提醒 / 黑名单），同一好友/群的新消息合并后再交给 Agent。仅 Windows。',
      },
      author: 'lanxiake',
      homepage: 'https://github.com/lanxiake/dsh-vyra-plugins#readme',
      repository: {
        url: 'https://github.com/lanxiake/dsh-vyra-plugins',
        directory: 'plugins/vyra-wechat-local',
      },
      icon: WECHAT_LOCAL_ICON,
      engines: { dsh: '>=0.2.2-rc.1 <0.3.0' },
      versions: {
        '0.8.2': {
          publishTimestamp: 1795679993,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '4f4d01ffe5612461d706874dabe66996ad306cda',
            path: 'plugins/vyra-wechat-local',
          },
        },
        '0.1.0': {
          publishTimestamp: 1795046400,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'b5345a639f6f26b8d1235546318b7af1b1f6041b',
            path: 'plugins/vyra-wechat-local',
          },
        },
        // 0.1.1 keeps the settings page from taking down the shared client scope:
        // a top-level `const RPC` collided with the same name in the system-selection
        // bundle, and the combined script failed to compile, so neither registered.
        '0.1.1': {
          publishTimestamp: 1795062317,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '274cc8b3c066d78c8fee290960c985feb9305322',
            path: 'plugins/vyra-wechat-local',
          },
        },
        // 0.1.2 rebuilds the settings page as the Lumii pcwechat channel card:
        // status pill, meta strip, environment self-check with repair, tool chips.
        '0.1.2': {
          publishTimestamp: 1795065751,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'f7ce15abf8288948d1de89b457199f4b2b981207',
            path: 'plugins/vyra-wechat-local',
          },
        },
        // 0.2.0 adds the core feature: the per-person reply-policy dialog
        // (direct / draft / notify / blacklist, triggers, cooldown, contact picker)
        // backed by the sidecar's per-account rules; the status card moves to its
        // own 本机微信状态 settings entry.
        '0.2.0': {
          publishTimestamp: 1795066581,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '5c057fecb8e853791c07cde4378cdf65675fc7ad',
            path: 'plugins/vyra-wechat-local',
          },
        },
        // 0.3.0 is the real-time one: watch new messages, apply the per-person
        // policy, merge bursts (20s, reset by each message) and the post-reply
        // cooldown, deliver to a DSH session per conversation, show contact
        // avatars, and fold the settings into one PC微信 page with tabs.
        '0.3.0': {
          publishTimestamp: 1795068286,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '781e4f143ecf2224862dac0952af99e9e8d4423f',
            path: 'plugins/vyra-wechat-local',
          },
        },
        // 0.3.1 starts the draft cooldown at delivery, lets 立即检查 poll while
        // paused, and polls only running accounts.
        '0.3.1': {
          publishTimestamp: 1795068385,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'cd84a027452f5d5bbf77a289090723a193b1622f',
            path: 'plugins/vyra-wechat-local',
          },
        },
        // 0.3.2 titles each watched conversation "PC微信 · 名字".
        '0.3.2': {
          publishTimestamp: 1795068488,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '4159ff0ee420143515b12970e357e26bdd721d23',
            path: 'plugins/vyra-wechat-local',
          },
        },
        // 0.4.0 groups watch sessions under a PC微信 workspace, monitors the
        // WeChat connection itself, and moves the UI hints into hover titles.
        '0.4.0': {
          publishTimestamp: 1795070486,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'a1214b80d06663b22d5c99c5521a675c6c00f231',
            path: 'plugins/vyra-wechat-local',
          },
        },
        // 0.5.0 transcribes voice and attaches images before delivery, sends a
        // compact raw message instead of assistant prose, and gives new watch
        // sessions the built-in 代聊模式 preset.
        '0.5.0': {
          publishTimestamp: 1795076698,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '7f634d515de374a3b67dafe5617943cb0d09d218',
            path: 'plugins/vyra-wechat-local',
          },
        },
        // 0.6.0 scopes 代聊 to watch sessions (no global preset), reads WeChat's
        // decoded image cache (WXGF originals included), and archives the old
        // preset-based watch sessions on upgrade.
        '0.6.0': {
          publishTimestamp: 1795078687,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '04932926568e618e663a00df694570dead8f7d8a',
            path: 'plugins/vyra-wechat-local',
          },
        },
        // 0.6.1 fixes the watch loop: `ctx.agents` was read without `inject`,
        // so deliveries failed and messages sat in "合并中" forever. A tray
        // window now counts as connected (the sender wakes it), failed
        // deliveries surface their error, and image notes stop repeating on
        // retry. Tool chips carry their descriptions as hover titles.
        '0.6.1': {
          publishTimestamp: 1795140376,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'cfe7a621914dd105b61a6f5fdf94b5ede2d74423',
            path: 'plugins/vyra-wechat-local',
          },
        },
        // 0.6.2 records messages the policy skipped (keyword miss, not on the
        // list, blacklist, quiet hours, the user's own sends) and shows them in
        // the settings card, so a silent drop no longer looks like "not seen".
        '0.6.2': {
          publishTimestamp: 1795143741,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'a2a5e0129e8a9a401f6cfd282fce084af8e52769',
            path: 'plugins/vyra-wechat-local',
          },
        },
        // 0.6.3 gives each watch session a bound wechat_send_reply(text) tool:
        // the peer is fixed by the plugin, so a small model no longer has to
        // fill talker/account into send_text (and no longer forgets to send).
        '0.6.3': {
          publishTimestamp: 1795144208,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '4469d19ef6c3ea9ff0478923b61e03871f4f2cae',
            path: 'plugins/vyra-wechat-local',
          },
        },
        // 0.7.0 is the security release: only self-chat and 文件传输助手 are
        // whitelisted by default; a watched friend's agent is masked down to
        // wechat_send_reply + check_env (no files, shell, web, other chats or
        // export), and draft batches cannot send. The policy dialog has a
        // fixed height and a forced light palette.
        '0.7.0': {
          publishTimestamp: 1795160433,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '113b35d8032830b313acdd1f22d18ae0537e9c03',
            path: 'plugins/vyra-wechat-local',
          },
        },
        // 0.7.1 mirrors the trusted defaults (self-chat + 文件传输助手) in the
        // channel card, which otherwise claimed nobody could be replied to.
        '0.7.1': {
          publishTimestamp: 1795160538,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '4188a58abe94b473007f325630214a43ae0a1314',
            path: 'plugins/vyra-wechat-local',
          },
        },
        // 0.7.2 treats self-chat and 文件传输助手 as the owner's control channel
        // (full toolset); only third-party friend sessions keep the restricted
        // mask. Newly added contacts default to direct reply.
        '0.7.2': {
          publishTimestamp: 1795160992,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '79a3e313eee9f0902d6b2ec3634154b644161288',
            path: 'plugins/vyra-wechat-local',
          },
        },
        // 0.8.0: every tool advertises account + list_accounts (two instances
        // no longer mix), Lumii's digest/profile tools with an editable 画像蒸馏
        // tab and per-delivery profile injection, and send_file targets the
        // third toolbar icon with a verified-offset fallback.
        '0.8.0': {
          publishTimestamp: 1795164339,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '09ad8de91d9014cfc673eab16992ef6f5551f884',
            path: 'plugins/vyra-wechat-local',
          },
        },
        // 0.8.1 rebuilds the 画像蒸馏 tab around the friend list (names, avatars,
        // search, multi-select) and adds 自动蒸馏: auto friend batches refresh a
        // missing/stale peer profile before replying, via peer-bound tools.
        '0.8.1': {
          publishTimestamp: 1795165435,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '1c91d81cf89558dba2d7983d89128e15c1928b01',
            path: 'plugins/vyra-wechat-local',
          },
        },
      },
      metadata: {
        category: 'integration',
        keywords: ['wechat', 'weixin', 'local', 'chat', 'windows'],
      },
    },
    {
      name: 'dsh-vyra-xianyu-delivery',
      title: {
        en: 'Xianyu Auto Service',
        zh: '闲鱼自动客服',
      },
      description: {
        en: 'An automatic customer-service desk for virtual goods on Xianyu (Goofish): watch buyer messages in real time, ship the card stock the moment an order is placed, and answer questions through the DSH agent with per-item skills. Ships with a panel for cards, orders, delivery logs and skill binding.',
        zh: '闲鱼虚拟商品自动客服：实时监听买家消息，拍下即发卡密，并用 DSH 的 agent 与技能回答买家问题。附带卡券、订单、发货记录与技能绑定面板。',
      },
      author: 'lanxiake',
      homepage: 'https://github.com/lanxiake/dsh-vyra-plugins#readme',
      repository: {
        url: 'https://github.com/lanxiake/dsh-vyra-plugins',
        directory: 'plugins/vyra-xianyu-delivery',
      },
      icon: XIANYU_DELIVERY_ICON,
      versions: {
        '0.10.0': {
          publishTimestamp: 1795789655,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '56a30636300a2bc9005872bdd8a227cc265a8536',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        '0.9.2': {
          publishTimestamp: 1795679992,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '4f4d01ffe5612461d706874dabe66996ad306cda',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        '0.1.0': {
          publishTimestamp: 1795058652,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '129421592badb4bf8a07ecfe9fbd3036f28b93ec',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.1.1 ships vendor/worker.py: sold-list and confirm no longer need a
        // forked goofish-cli, so a market install works with the PyPI package.
        '0.1.1': {
          publishTimestamp: 1795059215,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '7defa10ea77d7bb17385772242210643821805d2',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.1.2 adds scan-to-login: the panel shows the passport QR itself.
        '0.1.2': {
          publishTimestamp: 1795061218,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'ed18b769b1791668d706423e713460040f455b5e',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.2.0 adds realtime IM watch (order tips ship immediately) and an
        // optional AI buyer-reply engine driven by per-item knowledge.
        '0.2.0': {
          publishTimestamp: 1795065592,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'af6111f2e50be335ff13c69e57240f2a8d88309c',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.2.1 replies through the DSH agent (ctx.agents) and binds each item
        // to skills instead of a plugin-local knowledge field.
        '0.2.1': {
          publishTimestamp: 1795066164,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '4d3e6e727ed0b0c2fe9dc849c58abf7642bf16f8',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.2.2 renames the plugin to 闲鱼自动客服; the package name stays
        // dsh-vyra-xianyu-delivery so installed copies keep their install source.
        '0.2.2': {
          publishTimestamp: 1795066500,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '86656eab0bc7c9af403f1d00c46512e135d2c1a6',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.3.0 shows the signed-in account, adds an in-panel chat tab, picks
        // shop items from a dropdown, scans installed skills for multi-select,
        // and lets the panel bind an Agent preset.
        '0.3.0': {
          publishTimestamp: 1795074092,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '6cf26ca9a09f5b40a48ce7d4795f7d437e481f6f',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.3.1: the orders tab reads the real Xianyu order list, each panel
        // request fails independently instead of blanking the whole refresh,
        // chats show avatars/unread/recent time, and the panel gets color.
        '0.3.1': {
          publishTimestamp: 1795075917,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'b6c3d14e224b2d041f3affc9a0b16313f3cfaeaf',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.3.2: conversations come from the IM pagination endpoint the web IM
        // uses (25 vs 5), the composer is pinned to the bottom, and reloaded
        // plugin instances no longer leave watcher processes fighting over IM.
        '0.3.2': {
          publishTimestamp: 1795077859,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'e03fe1b02d58345477b4cf2418e28f2b06429b71',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.4.0 adds logout and multi-account switching: each login is archived
        // under ~/.goofish-cli/accounts/<unb>.json and the panel can switch.
        '0.4.0': {
          publishTimestamp: 1795078362,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '9ca4d192ac2fb8c045ff0d5674e206056088a871',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.4.1 scopes cards, orders, deliveries and item skills by account.
        '0.4.1': {
          publishTimestamp: 1795078661,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'fa32e8ef6b6b5eb7de718e5018f4fe92130d7d5f',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.4.2 ships a built-in customer-service agent ("builtin") so the AI
        // reply works without creating an Agent Manager preset first.
        '0.4.2': {
          publishTimestamp: 1795078899,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '1290d8473290843477da63a241c5440460f8621e',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.4.3 rebuilds the legacy items table on upgrade. Without it the
        // per-account ON CONFLICT fails at prepare time and the whole host
        // plugin never activates (every RPC answers "not found").
        '0.4.3': {
          publishTimestamp: 1795137523,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '8be61de4c7ec9cd8b1024945610a5e1f770647fb',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.5.0: newest-first conversations with real avatars, message cards
        // and images, click-through order and item details, and a hover hint
        // on the manual-delivery button.
        '0.5.0': {
          publishTimestamp: 1795138821,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'e894a78059214292aff0caced2ec5eeafa6698af',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.5.1 replaces the item form with product cards, turns the order
        // detail into Xianyu-style cards, and adds an "AI 配置" dialog per item.
        '0.5.1': {
          publishTimestamp: 1795141417,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '6597e84e7e9cbca7efcc41aff5b59bbc1a29c981',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.5.2 restores the avatar helpers (their removal threw during render
        // and left the panel blank) and adds a render smoke test.
        '0.5.2': {
          publishTimestamp: 1795143511,
          source: {
            type: 'git',
            url: 'https://atomgit.com/qq_42997950111111111111111sfq/dsh-vyra-plugins.git',
            commit: 'dbcfdda4c6cdbea19d30c65582ec9afd30b4d771',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.5.3 refreshes the short-lived _m_h5_tk through Edge's quick-login
        // and retries the failed call, instead of surfacing "token expired".
        '0.5.3': {
          publishTimestamp: 1795149354,
          source: {
            type: 'git',
            url: 'https://atomgit.com/qq_42997950111111111111111sfq/dsh-vyra-plugins.git',
            commit: 'c306a285f9c423a24ac50d5bfcc2f5dba0cf0584',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.5.4 refreshes headlessly first and only falls back to a visible
        // window when the headless fingerprint is rejected.
        '0.5.4': {
          publishTimestamp: 1795149649,
          source: {
            type: 'git',
            url: 'https://atomgit.com/qq_42997950111111111111111sfq/dsh-vyra-plugins.git',
            commit: '5f0b7366586609f23a674f50b15f6e9a6c39c886',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.5.5 is the same code installed from GitCode, which clones faster in CN.
        '0.5.5': {
          publishTimestamp: 1795152931,
          source: {
            type: 'git',
            url: 'https://gitcode.com/qq_42997950111111111111111sfq/dsh-vyra-plugins.git',
            commit: '6379365ed14f1e05c6213c8f386d5fd4712da4b5',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.5.6 adds a searchable skill list with "open in place" and an
        // AI on/off switch in the panel.
        '0.5.6': {
          publishTimestamp: 1795154453,
          source: {
            type: 'git',
            url: 'https://gitcode.com/qq_42997950111111111111111sfq/dsh-vyra-plugins.git',
            commit: '1acf8030731e145ccaef8f8b35da7ce752ee174f',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.5.7 stores local time, lets the platform state win over a stale
        // local "blocked", adds the market skills dir, and moves the AI switch
        // onto each item.
        '0.5.7': {
          publishTimestamp: 1795156180,
          source: {
            type: 'git',
            url: 'https://gitcode.com/qq_42997950111111111111111sfq/dsh-vyra-plugins.git',
            commit: 'c50cad67bf9f880ddce0097e0970e2ee060f9124',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.5.8 replaces the card's item-ID input with a shop-item dropdown.
        '0.5.8': {
          publishTimestamp: 1795156621,
          source: {
            type: 'git',
            url: 'https://gitcode.com/qq_42997950111111111111111sfq/dsh-vyra-plugins.git',
            commit: 'd685957b5752fb33f0a7e25aa51c1ea1d4ac2978',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.6.0 introduces customer-service entities shared across items,
        // exposes 10 xianyu_* tools to the main agent, and names the agent
        // sessions "[service] item-buyer".
        '0.6.0': {
          publishTimestamp: 1795160002,
          source: {
            type: 'git',
            url: 'https://gitcode.com/qq_42997950111111111111111sfq/dsh-vyra-plugins.git',
            commit: 'c616c79d4a9c283e6f83784b560d22912c781595',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.6.1 ships three built-in skills (two drive skills with no credentials,
        // plus the customer-service playbook), pre-fills a default service
        // profile, and lets each service pick its tools.
        '0.6.1': {
          publishTimestamp: 1795160579,
          source: {
            type: 'git',
            url: 'https://gitcode.com/qq_42997950111111111111111sfq/dsh-vyra-plugins.git',
            commit: '596c6c2bbe669b8f065912b45884ba37c5a6da5a',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.6.2 makes the default profile a real weflow example, adds a model
        // picker fed by the DSH providers, and shows tool descriptions on hover.
        '0.6.2': {
          publishTimestamp: 1795162546,
          source: {
            type: 'git',
            url: 'https://gitcode.com/qq_42997950111111111111111sfq/dsh-vyra-plugins.git',
            commit: '96860b0281100f30e5fb4c8637141383f6267fec',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.6.3 falls back to the first enabled service when the buyer has no
        // order yet, and logs each handled message so "no reply" is diagnosable.
        '0.6.3': {
          publishTimestamp: 1795163956,
          source: {
            type: 'git',
            url: 'https://gitcode.com/qq_42997950111111111111111sfq/dsh-vyra-plugins.git',
            commit: '4212b795834184e4d7f3a75c50cfac46e590a5dd',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.6.4 adds card edit/disable/delete and reads the item id from the
        // chat's product card when the buyer has not ordered yet.
        '0.6.4': {
          publishTimestamp: 1795164403,
          source: {
            type: 'git',
            url: 'https://gitcode.com/qq_42997950111111111111111sfq/dsh-vyra-plugins.git',
            commit: '5d03fbe1305f5fc1d8ec4b23465c96d7a579267c',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.6.5 returns card content on edit, merges the toggle into one
        // button, and labels why a message got no reply.
        '0.6.5': {
          publishTimestamp: 1795164978,
          source: {
            type: 'git',
            url: 'https://gitcode.com/qq_42997950111111111111111sfq/dsh-vyra-plugins.git',
            commit: '7d004c02c58e8b3365cbf112a3bc86dafa991b99',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.6.6 falls back to the only enabled card when specs differ, and
        // retries orders that were blocked for no_card once a card exists.
        '0.6.6': {
          publishTimestamp: 1795175555,
          source: {
            type: 'git',
            url: 'https://gitcode.com/qq_42997950111111111111111sfq/dsh-vyra-plugins.git',
            commit: 'ea217ec194e08f3b8ecf2b04cb7e26da35642b6d',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.6.7 treats custom-wrapped (101) text as text, logs the card
        // contentType, and records the 3s cooldown skips.
        '0.6.7': {
          publishTimestamp: 1795176031,
          source: {
            type: 'git',
            url: 'https://gitcode.com/qq_42997950111111111111111sfq/dsh-vyra-plugins.git',
            commit: '029a64de0800bd9e4abd95dd855370c5ea95ce7c',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.6.8 keeps exactly one IM watcher (orphans kicked each other off
        // the socket) and turns 实时 into a clickable, remembered toggle.
        '0.6.8': {
          publishTimestamp: 1795190400,
          source: {
            type: 'git',
            url: 'https://gitcode.com/qq_42997950111111111111111sfq/dsh-vyra-plugins.git',
            commit: 'f117085dd1a636c02bb3c8de9bb7cf056bf9b8c0',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.6.9: a new_msg push carries no text, so body-less events now read
        // the history and answer the latest buyer message from there.
        '0.6.9': {
          publishTimestamp: 1795193400,
          source: {
            type: 'git',
            url: 'https://gitcode.com/qq_42997950111111111111111sfq/dsh-vyra-plugins.git',
            commit: '417d453928e2279f42780b982fc294b55fa99f71',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.6.10: the agents service is read lazily; asking for it during apply
        // left AI mode permanently disabled.
        '0.6.10': {
          publishTimestamp: 1795196400,
          source: {
            type: 'git',
            url: 'https://gitcode.com/qq_42997950111111111111111sfq/dsh-vyra-plugins.git',
            commit: '12d8e8904c60913da1baff433297c00c65250b5a',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.6.11: add file lock to watch singleton; hot reload no longer spawns
        // duplicate watchers that kick each other off the IM socket.
        '0.6.11': {
          publishTimestamp: 1795233600,
          source: {
            type: 'git',
            url: 'https://gitcode.com/qq_42997950111111111111111sfq/dsh-vyra-plugins.git',
            commit: '7ab94aa007b55f380a58da3f343f845598e4e85f',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.6.12: recordEvent('replied') now happens after send succeeds; send
        // failures are diagnosed as send-failed:<error> instead of replied.
        '0.6.12': {
          publishTimestamp: 1795236000,
          source: {
            type: 'git',
            url: 'https://gitcode.com/qq_42997950111111111111111sfq/dsh-vyra-plugins.git',
            commit: '4209f0634d6263ed31f988b2d6f267c03e82694e',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.6.13: tighten send_buyer_reply tool schema with additionalProperties
        // and explicit presentationMeta to match DSH registration requirements.
        '0.6.13': {
          publishTimestamp: 1795237800,
          source: {
            type: 'git',
            url: 'https://gitcode.com/qq_42997950111111111111111sfq/dsh-vyra-plugins.git',
            commit: '3f8291144084afa7e8628d5fa840d6b31d34d006',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.6.14: skip replies when no itemId (buyer from chat list, not product
        // page); show buyer/item/amount in delivery records.
        '0.6.14': {
          publishTimestamp: 1795240200,
          source: {
            type: 'git',
            url: 'https://gitcode.com/qq_42997950111111111111111sfq/dsh-vyra-plugins.git',
            commit: 'f6a6e6b979cb085f0fe7aa259ba2e773323aff57',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.6.15: conversation polling replaces the persistent watcher as the
        // main path (CLI calls kicked it off the single-login IM socket);
        // itemId now comes from the conversation extension.
        '0.6.15': {
          publishTimestamp: 1795242600,
          source: {
            type: 'git',
            url: 'https://gitcode.com/qq_42997950111111111111111sfq/dsh-vyra-plugins.git',
            commit: '46cb2f29186bca66c936612affd173eb6f8a5d75',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.7.0: sessions grouped under the 闲鱼客服 workspace (one per buyer),
        // card modes pool/reuse/generate with stock counts, visible failure
        // reasons, and setup tools the main agent can call.
        '0.7.0': {
          publishTimestamp: 1795245000,
          source: {
            type: 'git',
            url: 'https://gitcode.com/qq_42997950111111111111111sfq/dsh-vyra-plugins.git',
            commit: '156cc65449b3f89ee995049643cf39e0bb34abaa',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.7.1: orders that never sent anything (old card_exhausted rows)
        // retry once cards are replenished.
        '0.7.1': {
          publishTimestamp: 1795247400,
          source: {
            type: 'git',
            url: 'https://gitcode.com/qq_42997950111111111111111sfq/dsh-vyra-plugins.git',
            commit: 'daf5a8f3b8dc5079840f51e48434db453bff4c63',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.7.2: redesigned cards panel (list + editor, per-mode fields and
        // samples, live preview); shipped orders no longer show stale errors.
        '0.7.2': {
          publishTimestamp: 1795249800,
          source: {
            type: 'git',
            url: 'https://gitcode.com/qq_42997950111111111111111sfq/dsh-vyra-plugins.git',
            commit: '33b9cb3a3c90f96068ea2f097644fc2e7d178811',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.7.3: trade cards render, handled orders stop swallowing later
        // messages, session nicknames fall back to squadName_<peer>.
        '0.7.3': {
          publishTimestamp: 1795252200,
          source: {
            type: 'git',
            url: 'https://gitcode.com/qq_42997950111111111111111sfq/dsh-vyra-plugins.git',
            commit: '31dcdd5b5bfa4f6d0558e973ae91f576b33adae1',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.7.4: no automatic browser pops. Refresh needs a cookie file,
        // runs headless only, and backs off after a failure.
        '0.7.4': {
          publishTimestamp: 1795254600,
          source: {
            type: 'git',
            url: 'https://gitcode.com/qq_42997950111111111111111sfq/dsh-vyra-plugins.git',
            commit: '0220dd1c5a3c698f6ae8e5684689592f557392fd',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.7.5: find the newest *text* message so an order card no longer
        // hides the buyer's question.
        '0.7.5': {
          publishTimestamp: 1795257000,
          source: {
            type: 'git',
            url: 'https://gitcode.com/qq_42997950111111111111111sfq/dsh-vyra-plugins.git',
            commit: 'b6efcd4f7f3d96d6b16c4cc5af3587cb06a79d10',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.7.6: model fallback via agentDefaultModel, cookie write-back after
        // every mtop call (token no longer looks expired every 10 minutes),
        // and actionable error messages.
        '0.7.6': {
          publishTimestamp: 1795259400,
          source: {
            type: 'git',
            url: 'https://gitcode.com/qq_42997950111111111111111sfq/dsh-vyra-plugins.git',
            commit: '2931275650eae95a816a5d560ead1e0fdb910ac0',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.8.0: one persistent IM process for chats/history/send and pushes;
        // sessions register a 闲鱼客服 workspace; prompts and tools are scoped
        // on the agent; conversation parsing and the RPC probe are testable.
        '0.8.0': {
          publishTimestamp: 1795267200,
          source: {
            type: 'git',
            url: 'https://gitcode.com/qq_42997950111111111111111sfq/dsh-vyra-plugins.git',
            commit: 'c5f656096c83d293eb4a53dfe05011cd14145831',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.8.1: one live agent per buyer (no throwaway sessions on the second
        // message), skills read from every skill root, prompt preserved when
        // the system section is unavailable.
        '0.8.1': {
          publishTimestamp: 1795270800,
          source: {
            type: 'git',
            url: 'https://gitcode.com/qq_42997950111111111111111sfq/dsh-vyra-plugins.git',
            commit: '898cadd700cb8d8af350ef9422f87eed693a4ed6',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.9.0: image replies via ![](url), layered system prompt, reply cap,
        // and the 开始使用 tab with one-click product setup.
        '0.9.0': {
          publishTimestamp: 1795274400,
          source: {
            type: 'git',
            url: 'https://gitcode.com/qq_42997950111111111111111sfq/dsh-vyra-plugins.git',
            commit: '1f7578363182b41f7cf6ff62e219b4f52e8d2b1a',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
        // 0.9.1: flow-control (400) on the conversation list now falls back to
        // HTTP with a cooldown; the host caches the list for 5s.
        '0.9.1': {
          publishTimestamp: 1795278000,
          source: {
            type: 'git',
            url: 'https://gitcode.com/qq_42997950111111111111111sfq/dsh-vyra-plugins.git',
            commit: '3bae6c75310607e3a8189a4155324f38139e8185',
            path: 'plugins/vyra-xianyu-delivery',
          },
        },
      },
      metadata: {
        category: 'integration',
        keywords: ['xianyu', 'goofish', 'auto-delivery', 'virtual-goods'],
      },
    },
    {
      name: 'dsh-vyra-agent-cli-manager',
      title: {
        en: 'Agent CLI Manager',
        zh: 'Agent CLI 管理',
      },
      description: {
        en: 'Drive Claude Code, Codex, OpenCode and other agent CLIs from DSH: install and upgrade them, and manage their MCP servers, skills and prompts in one place.',
        zh: '在 DSH 里驱动 Claude Code、Codex、OpenCode 等 Agent CLI：安装升级，并统一管理它们的 MCP、技能与提示词。',
      },
      author: 'lanxiake',
      homepage: 'https://github.com/lanxiake/dsh-vyra-plugins#readme',
      repository: {
        url: 'https://github.com/lanxiake/dsh-vyra-plugins',
        directory: 'plugins/vyra-agent-cli-manager',
      },
      icon: AGENT_CLI_MANAGER_ICON,
      // Declared because this plugin genuinely needs it: it imports DSH
      // packages directly instead of reading every service through `ctx.get`,
      // so an older client cannot load it.
      engines: { dsh: '>=0.2.2-rc.1 <0.3.0' },
      versions: {
        // 1.4.0 lets a CLI run on a model DSH already has configured. Claude Code only knows
        // its own login or ANTHROPIC_*, so a machine with neither cannot run it at all; the
        // new 设置 → Agent CM → 模型来源 page picks that per CLI, and `agents[].models` names the
        // provider, the model and the variables that CLI reads. The endpoint and credential
        // come from the provider's own DSH settings, and the secret is read at each start.
        '1.4.0': {
          publishTimestamp: 1795723200,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '6e513fb7f4fb9bba771e00fff49d124b474810c7',
            path: 'plugins/vyra-agent-cli-manager',
          },
        },
        '1.3.2': {
          publishTimestamp: 1795679991,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '4f4d01ffe5612461d706874dabe66996ad306cda',
            path: 'plugins/vyra-agent-cli-manager',
          },
        },
        // 1.0.0's package.json carried `prepare: lefthook install`, copied in
        // from the source working copy. A git install runs `prepare`, there is
        // no .git in the fetched tarball, and lefthook exits 128 — so 1.0.0
        // fails to install for everyone. It keeps its pinned commit: the fix is
        // 1.0.1, not a repin of a version users already resolved.
        '1.0.0': {
          publishTimestamp: 1794963600,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'c0a2f398ded5e79da81334b2b0d18b5e81520ba1',
            path: 'plugins/vyra-agent-cli-manager',
          },
        },
        '1.0.1': {
          publishTimestamp: 1794900000,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '9c77cc23b9c296c36d57edce8955c06565d30ca2',
            path: 'plugins/vyra-agent-cli-manager',
          },
        },
        '1.1.0': {
          publishTimestamp: 1795222800,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'd94ed5e632ad80ea42e5a731d57f351b75f2fb60',
            path: 'plugins/vyra-agent-cli-manager',
          },
        },
        // 1.1.0 is uninstallable: its package.json carries `prepare: lefthook install`, which
        // pnpm runs on a git install, and there is no .git in the fetched tarball. The fix is a
        // new version, not a repin — 1.1.0's bytes are already out.
        '1.1.1': {
          publishTimestamp: 1795226400,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'f7ae30421c544f62d3ed6c39aaf42e6c79be5f56',
            path: 'plugins/vyra-agent-cli-manager',
          },
        },
        '1.1.2': {
          publishTimestamp: 1795230000,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'ec3d3abfd7878410695de90798bcfe9a738a436e',
            path: 'plugins/vyra-agent-cli-manager',
          },
        },
        '1.2.0': {
          publishTimestamp: 1795266000,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '482cf2b1769710f8d669b6d8b9eb9cdc7aaf26fc',
            path: 'plugins/vyra-agent-cli-manager',
          },
        },
        // 1.3.0 lists the harness itself as one of the managed CLIs, and lets the
        // 提示词 fold replace the instruction file instead of only showing it.
        '1.3.0': {
          publishTimestamp: 1795392000,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '2eef8b722e0cabc1e5d790a8a78c08772fab50ff',
            path: 'plugins/vyra-agent-cli-manager',
          },
        },
        // 1.3.1 drops the package's own `icon` field, which pointed at assets/logo.png while the
        // market card renders this index's icon — the installed list and the market showed two
        // different pictures for the same plugin.
        '1.3.1': {
          publishTimestamp: 1795080000,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '92dc3e408b046e087608dd22491a19b2b2915c7d',
            path: 'plugins/vyra-agent-cli-manager',
          },
        },
      },
      metadata: {
        category: 'agent-runtime',
        keywords: ['agent-cli', 'claude-code', 'codex', 'opencode', 'acp'],
      },
    },
    {
      name: 'dsh-vyra-plugin-market',
      title: {
        en: 'Plugin Market',
        zh: '插件市场',
      },
      description: {
        en: 'A card-style market tab beside Installed: switch between index sources, search, and install, update, uninstall, enable or disable many plugins in one batch. It reads and changes plugins through the client\'s own Remote interfaces, so the source list is the same one Settings edits.',
        zh: '在「已安装」旁边多一个卡片式市场标签页：切换市场源、搜索，并批量安装、更新、卸载、启用或停用。读取与改动都走客户端自己的 Remote 接口，所以源列表就是「设置 → 插件 → 索引源」那一份。',
      },
      author: 'lanxiake',
      homepage: 'https://github.com/lanxiake/dsh-vyra-plugins#readme',
      repository: {
        url: 'https://github.com/lanxiake/dsh-vyra-plugins',
        directory: 'plugins/vyra-plugin-market',
      },
      icon: PLUGIN_MARKET_ICON,
      versions: {
        // 0.7.5 fills the "all sources" result in as each source answers, so a
        // slow or dead source no longer blanks the page until it times out.
        '0.7.5': {
          publishTimestamp: 1795835554,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '8911a1e911eb3515abe33243aa337111613301c6',
            path: 'plugins/vyra-plugin-market',
          },
        },
        // 0.7.4 makes a restart-required result actionable: the completion toast
        // and the Installed-page bar now offer a restart where the Desktop shell
        // publishes one, and state the manual steps where it does not.
        '0.7.4': {
          publishTimestamp: 1795658609,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '065e3b1b6332ad1bfc020777fc68c33664ea75ee',
            path: 'plugins/vyra-plugin-market',
          },
        },
        '0.7.3': {
          publishTimestamp: 1795679990,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '4f4d01ffe5612461d706874dabe66996ad306cda',
            path: 'plugins/vyra-plugin-market',
          },
        },
        // 0.1.0 is published: it is what the index already carried, and its
        // source stays pinned where users resolved it.
        '0.1.0': {
          // Unix seconds of the commit that published it.
          publishTimestamp: 1794873600,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '4bc08a2465719a0f08221a274988daf52d533584',
            path: 'plugins/vyra-plugin-market',
          },
        },
        // 0.1.1 fixes what 0.1.0 shipped: the tab drew nothing, because its
        // loading branch returned before two of its hooks ran and React refused
        // the render. There was no earlier version of the tab to fall back to.
        '0.1.1': {
          publishTimestamp: 1794960000,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '3d7d778e623384e45df66dd225ae4b3ce5091216',
            path: 'plugins/vyra-plugin-market',
          },
        },
        // 0.1.2 fixes three things 0.1.1 shipped: the primary button paired
        // `brand-primary` with `brand-text`, whose near-black label vanished on
        // a light theme's dark fill; a failed change only reached a summary bar
        // that the next action cleared, so the reason was gone before it could
        // be read; and `Card` read a `copied` prop it never declared.
        '0.1.2': {
          publishTimestamp: 1795305600,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '7420a72571be09aad7bee2e132fdbd335a5c4409',
            path: 'plugins/vyra-plugin-market',
          },
        },
        // 0.1.3 makes the tab open on this repository's own market and lead the
        // source menu with it, instead of whichever index a profile happens to
        // list first. The configured order is untouched.
        '0.1.3': {
          publishTimestamp: 1795392000,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'ec3d3abfd7878410695de90798bcfe9a738a436e',
            path: 'plugins/vyra-plugin-market',
          },
        },
        // 0.1.4 makes a bulk action end in the state it asked for: the batch is
        // guarded by a ref instead of state, and after the orders run the
        // market re-reads the profile and puts back any entry a concurrent
        // writer stripped between two orders.
        '0.1.4': {
          publishTimestamp: 1795056212,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '8f63f5583d5c20fd54764be31dd656aae29a86b2',
            path: 'plugins/vyra-plugin-market',
          },
        },
        // 0.1.5 retries a bulk order across a flaky GitHub: transport failures
        // earn up to three more runs with a pause between them, and pnpm's
        // content-addressed store makes each retry resume what was fetched.
        '0.1.5': {
          publishTimestamp: 1795057200,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '86c76d84343b4124d7b677e0d027d67c32fd80f5',
            path: 'plugins/vyra-plugin-market',
          },
        },
        // 0.1.6 makes the refresh button do what it says: the Host reuses one
        // index document for ten minutes, and the button re-read it without
        // `refresh`, so a just-published plugin stayed invisible until the TTL
        // ran out.
        '0.1.6': {
          publishTimestamp: 1795059216,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'fcb4faab935dd14cfd94d476fe2514d0bed2db8c',
            path: 'plugins/vyra-plugin-market',
          },
        },
        // 0.1.7 opens a details dialog from every card, installed or not, and
        // ends it with the QQ group card.
        '0.1.7': {
          publishTimestamp: 1795066951,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '575d1f707c56ae444e0b23fa32afe233a55724a8',
            path: 'plugins/vyra-plugin-market',
          },
        },
        // 0.1.8 reads the plugin's own README (repository.directory/README.md)
        // and keeps only the QQ group text, no QR image.
        '0.1.8': {
          publishTimestamp: 1795067593,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '7f72ea171649065cef2c4efaae71b2d658e97834',
            path: 'plugins/vyra-plugin-market',
          },
        },
        // 0.1.9 makes the refresh button observable: disabled while loading,
        // "已刷新" for 2.5s, and it also re-reads the installed bundles.
        '0.1.9': {
          publishTimestamp: 1795068052,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'bfda1b975d8d19eabbb1eec6d28483db6a10f22a',
            path: 'plugins/vyra-plugin-market',
          },
        },
        // 0.2.0 makes the market usable: switching sources cancels the in-flight read and clears
        // stale results instead of leaving the previous market on screen; the default source is
        // the ghproxy mirror (reachable in CN); cards are flattened (name + state on one line,
        // click opens details, actions on hover); the detail view renders the README as blocks
        // with actions and version history; bulk runs show a progress bar; quick filters,
        // update-all, startup update check and recent searches are added.
        '0.2.0': {
          publishTimestamp: 1795334400,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '0318a89ada224c3f99042bc6e0c82dbe2c8127c0',
            path: 'plugins/vyra-plugin-market',
          },
        },
        // 0.2.1 makes the cards static: install/update/uninstall/enable sit beside the state tags
        // and never appear on hover, and the per-card "details" button that opened the client's
        // native plugin page is gone — clicking a card opens this market's own detail view.
        '0.2.1': {
          publishTimestamp: 1795335000,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'afa6f449498ce8404c9bda25f932f556ee1c4c03',
            path: 'plugins/vyra-plugin-market',
          },
        },
        // 0.2.2 renders README images: <picture>/<img> HTML is unwrapped into Markdown images,
        // a standalone image is drawn, and a relative source resolves against the README URL —
        // the QQ-group QR code in every plugin README was missing without this.
        '0.2.2': {
          publishTimestamp: 1795335600,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'f2d15632b7a6baedf82f6938bceac655fd4deb82',
            path: 'plugins/vyra-plugin-market',
          },
        },
        // 0.3.0 moves the batch runner out of the tab component: installs and updates keep
        // going when the page is switched, the tab subscribes to the run's state on return,
        // and a progress-bar button cancels the rest of a batch (the order already on the
        // Host finishes; pnpm/git cannot be aborted from the client).
        '0.3.0': {
          publishTimestamp: 1795336200,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '193ba61966386344caaa81a35009f93a1e8df5c5',
            path: 'plugins/vyra-plugin-market',
          },
        },
        // 0.4.0 adds the sidebar entry and the Apple-style surface; built-in
        // dsh.so and dshmarket.com aggregation with star/npm-download stats; a
        // session-wide install queue with host-side cancellation, live phases,
        // pnpm logs and a completion toast; and an Installed tab that lists
        // every profile bundle, including ones no market index knows about.
        '0.4.0': {
          publishTimestamp: 1795331233,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'a171a7290b48437c80bd6b6b145b170fc0192309',
            path: 'plugins/vyra-plugin-market',
          },
        },
        // 0.5.0 adds two validated community indexes (DSH Open Market and
        // DSH Go Market); page-level lazy loading and a five-minute page
        // cache; a single compact filter row; and a Settings section with
        // independent switches for the sidebar row and the Plugins tab.
        '0.5.0': {
          publishTimestamp: 1795335394,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'a11b064118e088bff365a0257d92f54ce4c7dba7',
            path: 'plugins/vyra-plugin-market',
          },
        },
        // 0.5.1 matches a market entry to an installed bundle even when the
        // names differ (scope, display name, mirror), so search results mark
        // plugins installed from another source as Installed.
        '0.5.1': {
          publishTimestamp: 1795336083,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'e00f7078342a113ac4a1dcfefffe71f1c8b559a6',
            path: 'plugins/vyra-plugin-market',
          },
        },
        // 0.5.2 groups DSH-provided bundles under their own heading below the
        // profile's installed plugins.
        '0.5.2': {
          publishTimestamp: 1795341110,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'eb9ad61da2defb708b29d97093999876ff24187f',
            path: 'plugins/vyra-plugin-market',
          },
        },
        // 0.5.3 probes the network and swaps the Veyra index edition between
        // GitCode installs (domestic) and GitHub installs (overseas).
        '0.5.3': {
          publishTimestamp: 1795343104,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '95a269fe0c6bcf64c7de9bda93a932daaf9f88b3',
            path: 'plugins/vyra-plugin-market',
          },
        },
        // 0.6.0 adds cross-source search and the Agent CLI/skill.
        '0.6.0': {
          publishTimestamp: 1795355020,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '665b7fbfa7f02c98b482579beb4765c505a1f0f5',
            path: 'plugins/vyra-plugin-market',
          },
        },
        // 0.7.0: Not installed filter, per-source copy and drag reorder, and
        // initial-letter tiles for entries without an icon.
        '0.7.0': {
          publishTimestamp: 1795420502,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '59f7357925115f39b8996423f3779f2365010739',
            path: 'plugins/vyra-plugin-market',
          },
        },
        // 0.7.1: the queue of a bulk run is a toggle that folds itself past
        // three items (an open queue scrolls in its own box), the bulk bar
        // folds its selection the same way, the Installed tab no longer hangs
        // a count on its label, the market filter says "installed in market",
        // and the hero explains how an Agent session drives the market with
        // four paste-ready use cases.
        '0.7.1': {
          publishTimestamp: 1795500031,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '2c9cabdebac01c49a78ed10e757d1bf3a7fcfb91',
            path: 'plugins/vyra-plugin-market',
          },
        },
        // 0.7.2: the version published to npm. Its only difference from 0.7.1
        // is the `bin` spelling (`cli.mjs`, no `./`) — npm 11 dropped the
        // field when it carried a `./` prefix, so the `vyra-market` command
        // never materialized. Same 11 packaged files, verified by a real
        // `npm install` from the registry.
        '0.7.2': {
          publishTimestamp: 1795501546,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '16b4b6ce1a95fd86875acfe4f74fa262e2cf9eab',
            path: 'plugins/vyra-plugin-market',
          },
        },
      },
      metadata: {
        category: 'integration',
        keywords: ['market', 'marketplace', 'plugin', 'batch', 'queue', 'installed', 'sidebar', 'settings', 'lazy'],
      },
    },
    // ── Vendored third-party plugins ──
    //
    // Not ours: each keeps its upstream package name, its own LICENSE, and its
    // upstream `description`. Renaming one onto `vyra-` would strip the
    // attribution off code we did not write, so `import-plugin.mjs --keep-name`
    // copies these verbatim and the install source pins the commit that holds
    // the snapshot. An upstream release is picked up by re-vendoring, never by
    // a version bump here.
    {
      name: '@weibaohui/dsh-sync',
      title: {
        en: 'DSH Sync',
        zh: '多机同步与备份',
      },
      description: {
        en: 'Keep skills, sessions, settings and plugin lists aligned across machines through a private Git repository, WebDAV or a local folder.',
        zh: '通过私有 Git 仓库、WebDAV 或本地文件夹，让多台机器上的技能、会话、设置和插件清单保持一致。',
      },
      author: 'weibaohui',
      homepage: 'https://github.com/weibaohui/dsh-sync#readme',
      repository: {
        url: 'https://github.com/weibaohui/dsh-sync',
      },
      engines: { dsh: '>=0.1.7-rc.2' },
      versions: {
        '0.4.12': {
          publishTimestamp: 1795341110,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'eb9ad61da2defb708b29d97093999876ff24187f',
            path: 'plugins/dsh-sync',
          },
        },
      },
      metadata: {
        category: 'integration',
        keywords: ['sync', 'backup', 'git', 'webdav', 'snapshot'],
      },
    },
    {
      name: 'dsh-ffmpeg',
      title: {
        en: 'FFmpeg',
        zh: '音视频处理',
      },
      description: {
        en: 'Probe, trim, transcode, burn subtitles, storyboard and export GIFs with the local FFmpeg/FFprobe.',
        zh: '用本机 FFmpeg/FFprobe 探测、剪辑、转码、烧录字幕、生成分镜总览图与 GIF。',
      },
      author: 'stardustlc',
      homepage: 'https://github.com/STARDUSTLC666/dsh-ffmpeg#readme',
      repository: {
        url: 'https://github.com/STARDUSTLC666/dsh-ffmpeg',
      },
      icon: 'https://cdn.jsdelivr.net/gh/lanxiake/dsh-vyra-plugins@master/plugins/dsh-ffmpeg/assets/plugin-icon.webp',
      engines: { dsh: '>=0.2.2-rc.3' },
      versions: {
        '0.7.20': {
          publishTimestamp: 1795341110,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'eb9ad61da2defb708b29d97093999876ff24187f',
            path: 'plugins/dsh-ffmpeg',
          },
        },
      },
      metadata: {
        category: 'media',
        keywords: ['ffmpeg', 'video', 'audio', 'transcode', 'gif'],
      },
    },
    {
      name: 'dsh-music-panel',
      title: {
        en: 'Music Panel',
        zh: '音乐面板',
      },
      description: {
        en: 'A local and online music player for DSH: NetEase, QQ, KuGou, Navidrome, lyrics, EQ and crossfade.',
        zh: 'DSH 本地与在线音乐播放器：网易云、QQ、酷狗、Navidrome、歌词、均衡器与智能过渡。',
      },
      author: 'Aliboder',
      homepage: 'https://github.com/Aliboder/dsh-music-panel#readme',
      repository: {
        url: 'https://github.com/Aliboder/dsh-music-panel',
      },
      icon: 'https://cdn.jsdelivr.net/gh/lanxiake/dsh-vyra-plugins@master/plugins/dsh-music-panel/icon.svg',
      versions: {
        '0.42.0': {
          publishTimestamp: 1795341110,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'eb9ad61da2defb708b29d97093999876ff24187f',
            path: 'plugins/dsh-music-panel',
          },
        },
      },
      metadata: {
        category: 'media',
        keywords: ['music', 'player', 'lyrics', 'equalizer', 'navidrome'],
      },
    },
    {
      name: 'dsh-vyra-free-model',
      title: {
        en: 'Vyra Free Models',
        zh: 'Vyra 免费模型',
      },
      description: {
        en: 'Free models with no sign-up and no API key: pick one and chat. Real availability checks, a sign-in dialog with the link when a browser blocks the popup, multiple accounts with balances on one page (CodeBuddy / WorkBuddy included), any OpenAI-compatible endpoint you already have a key for, and automatic retry on another model when the router fails. One click installs the Vyra plugin market and adds its index source, and the plugin ships a DSH onboarding skill that helps the agent recommend and install a plugin set for your needs.',
        zh: '装上就能用的免费模型：不用注册、不用填 key，选一个就能聊。真实可用性检测、登录弹窗（浏览器被拦截时可复制链接）、多账号与积分管理（含 CodeBuddy / WorkBuddy）、任何已有 Key 的 OpenAI 兼容接口，以及自动选择失败时换模型重试。设置页可一键安装 Vyra 插件市场并添加索引源；插件还会初始化一个 DSH 使用指南技能，帮 Agent 按你的需求推荐并安装插件组合。',
      },
      author: 'lanxiake',
      homepage: 'https://github.com/lanxiake/dsh-vyra-plugins#readme',
      repository: {
        url: 'https://github.com/lanxiake/dsh-vyra-plugins',
        directory: 'plugins/vyra-free-model',
      },
      icon: VYRA_FREE_MODEL_ICON,
      versions: {
        '0.1.0': {
          publishTimestamp: 1795416000,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '3735643b1da16e69722f796486213ac242005581',
            path: 'plugins/vyra-free-model',
          },
        },
        // 0.2.0 is the first usable release. 0.1.0 defined its stylesheet but
        // never appended it to document.head, so the settings page rendered as
        // bare HTML. This version also serves the Responses shape Codex speaks
        // and writes the local port into Codex and Claude Code on one click.
        '0.2.0': {
          publishTimestamp: 1795478400,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'eb42bb374670a0f8d27d6613dcb35cbae2ac9083',
            path: 'plugins/vyra-free-model',
          },
        },
        // 0.3.0 repairs the account block (the HTTP proxy it used could never
        // pass browser auth), adds real per-model probes, folds the page by
        // default, names the model the auto router actually used, and adds the
        // Tencent and bring-your-own-key lanes.
        '0.3.0': {
          publishTimestamp: 1795564800,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '753b46e54f777ef148e1b4f91ff237530f5c7926',
            path: 'plugins/vyra-free-model',
          },
        },
        // 0.4.0 adds the sign-in dialog, multi-account balances (Tencent merged
        // into the same list) and the automatic model retry.
        '0.4.0': {
          publishTimestamp: 1795651200,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'b37784045956e191aa5d13e4bbfc5c724469f1ef',
            path: 'plugins/vyra-free-model',
          },
        },
        // 0.4.1 fixes the sign-in completion check (placeholder accounts),
        // hides the relay blocks, and implements imageRequestPricing so context
        // compaction can switch models.
        '0.4.1': {
          publishTimestamp: 1795737600,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '5b1039207d9eabe7658ad21b845598e6c1761d37',
            path: 'plugins/vyra-free-model',
          },
        },
        // 0.4.2 refreshes account rows after every action and removes a
        // duplicate sign-in of an account that is already in the list.
        '0.4.2': {
          publishTimestamp: 1795824000,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '24da94ed141af8959e9c22d53cd79034bfbdddf8',
            path: 'plugins/vyra-free-model',
          },
        },
        // 0.5.0 adds the one-click plugin-market install (with the Veyra index
        // source), the vyra-dsh-guide onboarding skill, and DSH usage tips.
        '0.5.0': {
          publishTimestamp: 1795910400,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'f69c668810065a2de558a4fc9450bd6b8c9fb4f7',
            path: 'plugins/vyra-free-model',
          },
        },
        // 0.6.0 fixes the light-theme button colours (primary buttons now use the
        // shell's paired fill/label tokens, so neither the base nor the hover
        // state can wash the label out), makes one click work at all — the card
        // never declared `remote` in its inject, which threw
        // "cannot get property \"remote.pluginManager\" without inject" — and
        // turns that button into an update once the market is installed, instead
        // of silently doing nothing. It also adds a community card (QQ group
        // with a locally served QR, and the GitHub repository) and installs the
        // onboarding skill with LF endings on Windows checkouts.
        '0.6.0': {
          publishTimestamp: 1795487478,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '2359177aa67eacc59001881df991950bb08b1585',
            path: 'plugins/vyra-free-model',
          },
        },
        // 0.6.1 moves the QQ group and GitHub entries out of a card at the very
        // bottom into the title row, right-aligned against the page heading, and
        // dresses them in the same quiet button as 「刷新积分」/「添加账号」 so the
        // page keeps one hover language. Btn also forwards aria-* to the element
        // now: the popover trigger used to drop aria-expanded, so assistive tech
        // never learned it was closed.
        '0.6.1': {
          publishTimestamp: 1795490023,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '794dd1436fc643ef173252a2ead93f8e28a98354',
            path: 'plugins/vyra-free-model',
          },
        },
        // 0.6.2 stops the twelve-hour blind spot after a release: the jsDelivr
        // index entries are pinned to a commit (served immutable) instead of the
        // @master branch, whose s-maxage handed readers the previous release.
        '0.6.2': {
          publishTimestamp: 1795491062,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '70b3dc6c183223ee43167563027f6c63bcb9fe8e',
            path: 'plugins/vyra-free-model',
          },
        },
        // 0.6.3 puts 添加接口 and 一键安装插件市场 on the same quiet button as
        // 刷新积分 / 添加账号; they were primary, which paints a blue fill and
        // read as unstyled next to the rest of the page.
        '0.6.3': {
          publishTimestamp: 1795495140,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '45921c8a0ec7dc11e407bf634ca5ca0cb2e18bdc',
            path: 'plugins/vyra-free-model',
          },
        },
        // 0.6.4 gives ghost and quiet buttons a real surface. Making the two
        // actions quiet was not enough: quiet was transparent as well, so they
        // still read as plain labels. An earlier attempt at this used
        // --dsw-alias-bg-layer-3, which the theme does not publish, so the whole
        // background declaration was invalid and nothing changed on screen.
                // 0.6.5 adds the repository field the npm tarball was missing, which
        // left the package unlinked from its source in npm metadata and search.
        '0.6.5': {
          publishTimestamp: 1796572800,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '3524e6f7b0dee1e91e8645378797a9db3eac5b1f',
            path: 'plugins/vyra-free-model',
          },
        },
'0.6.4': {
          publishTimestamp: 1795496197,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            // Repinned from b3b94ac, which predates the rename. 9292d11 changed
            // nothing in this plugin but the names: package.json, the cordis row
            // and the client registration id now all read dsh-vyra-free-model,
            // which is also the name npm published 0.6.4 under.
            commit: '9292d1170cd87d914cff743b9a8811ce0e4b7ba7',
            path: 'plugins/vyra-free-model',
          },
        },
      },
      metadata: {
        category: 'model',
        keywords: ['model', 'llm', 'free', 'provider'],
      },
    },
    {
      name: 'dsh-vyra-screen-recorder',
      title: {
        en: 'Vyra Screen Recorder',
        zh: 'Vyra 录屏截图',
      },
      description: {
        en: 'Screen recording and annotated screenshots in the DSH composer: choose the desktop, a display, a window or a region; record system audio and microphone; save MP4 (H.264/AAC) or WebM; configure separate video and screenshot folders, format and shortcuts in the settings page; screenshots stay fast with no loading overlay and can hide DSH to capture other apps. Toolbar buttons show their shortcut on hover, and the screenshot overlay reads text out of the selection (Windows built-in OCR, or any dsh-tool-ocr engine) and copies the text, the image or the file in one click. Also installs a vsr CLI and an agent skill. No Python or ffmpeg required.',
        zh: 'DSH 输入框工具条里的录屏与截图：选择整个桌面 / 显示器 / 窗口 / 自定义区域，录系统声音和麦克风，默认保存 MP4（H.264/AAC）或 WebM；设置页可分别配置视频与截图的存储目录、格式和快捷键；截图走常驻服务、不显示加载提示，单张几十毫秒，也可以隐藏 DSH 截取其他应用。鼠标悬停在按钮上会显示快捷键；截图拖框即识别文字（Windows 自带 OCR，或读取 dsh-tool-ocr 配置的引擎），一键复制文字 / 图片 / 文件，和 QQ、微信截图一样顺手。同时安装 vsr CLI 和 Agent 技能。不需要 Python 或 ffmpeg。',
      },
      author: 'lanxiake',
      homepage: 'https://github.com/lanxiake/dsh-vyra-plugins#readme',
      repository: {
        url: 'https://github.com/lanxiake/dsh-vyra-plugins',
        directory: 'plugins/vyra-screen-recorder',
      },
      icon: VYRA_SCREEN_RECORDER_ICON,
      versions: {
        '0.1.0': {
          publishTimestamp: 1795910400,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '83a0b42fd48d5487cb2edf8045df5a6012f7fa64',
            path: 'plugins/vyra-screen-recorder',
          },
        },
        // 0.2.0 adds the settings page, configurable library directory,
        // MP4 export (and WebM -> MP4 conversion), shortcuts, and hide-DSH capture.
        '0.2.0': {
          publishTimestamp: 1795996800,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '244b14aab16752f2ad6024286dc2f5921f713556',
            path: 'plugins/vyra-screen-recorder',
          },
        },
        // 0.3.0 keeps a resident capture process (screenshots in tens of ms,
        // no loading UI captured) and splits video/screenshot storage folders.
        '0.3.0': {
          publishTimestamp: 1796083200,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '9a5a7c54d330abe302975d12b839a4ee15e01665',
            path: 'plugins/vyra-screen-recorder',
          },
        },
        // 0.4.0 adds hover tooltips carrying each button's shortcut, and QQ /
        // WeChat style text extraction in the screenshot overlay: select, read
        // the text (Windows OCR or whatever dsh-tool-ocr is configured with),
        // then copy the text, the image, or the file in one click.
        '0.4.0': {
          publishTimestamp: 1796112000,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '351b0bb9d67498bad801c96738347565b5f4159e',
            path: 'plugins/vyra-screen-recorder',
          },
        },
        // 0.4.1 fixes five bugs from real use: the screenshot shortcut was
        // swallowed while the composer had focus, tooltips never showed, the
        // text panel covered the confirm buttons, and screenshots captured the
        // whole screen instead of asking which display/window/region first
        // (now the same picker recording uses).
        '0.4.1': {
          publishTimestamp: 1796198400,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'f1cbef1021ad6b4442e4772c30beb962cac2e0d7',
            path: 'plugins/vyra-screen-recorder',
          },
        },
        // 0.4.2 makes the screenshot shortcut capture the whole screen without
        // asking for a source, makes text extraction manual, keeps the text
        // panel off the canvas, stops attaching captures to the composer
        // (screenshots are copied to the clipboard), and keeps the settings
        // cards rendered even when the file list cannot be read.
        '0.4.2': {
          publishTimestamp: 1796284800,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'cccdd56fdec0ecde9d90c992f3bc4cecdb1a0936',
            path: 'plugins/vyra-screen-recorder',
          },
        },
        // 0.4.3 removes the hide-DSH toggle, dims everything outside the
        // selection, and scrolls the settings page back to the top so the
        // cards above "Files" are not scrolled out of view.
        '0.4.3': {
          publishTimestamp: 1796371200,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '443fe99b1dfd5903d21d7924d513c0da1b1df5f5',
            path: 'plugins/vyra-screen-recorder',
          },
        },
        // 0.4.4 fixes the settings page rendering only the Files card: a stray
        // closing paren ended the return early, so four cards were never in
        // the tree. Also repairs the theme tokens (--dsh-color-* never
        // existed; DSH publishes --dsw-alias-*).
                // 0.4.5 adds the repository field the npm tarball was missing and the
        // screenshots the README had none of.
        '0.4.5': {
          publishTimestamp: 1796572800,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '3524e6f7b0dee1e91e8645378797a9db3eac5b1f',
            path: 'plugins/vyra-screen-recorder',
          },
        },
'0.4.4': {
          publishTimestamp: 1796457600,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'c62084093bb8dc94e9b3ebc4975603150f153479',
            path: 'plugins/vyra-screen-recorder',
          },
        },
      },
      metadata: {
        category: 'media',
        keywords: ['screen', 'record', 'screenshot', 'capture', 'video', 'ocr', 'clipboard', '录屏', '截图', '取字'],
      },
    },
    {
      name: '@lanxiake/dsh-im',
      title: {
        en: 'Instant Messaging Bridge',
        zh: '即时通讯桥接',
      },
      description: {
        en: 'Connect WeChat, Feishu, WeCom, DingTalk, QQ, Telegram, WhatsApp, Slack, Discord and Matrix to DSH, with Agent tools for proactive messages and files.',
        zh: '把微信、飞书、企微、钉钉、QQ、Telegram、WhatsApp、Slack、Discord、Matrix 接入 DSH；Agent 可直接主动发送文字和文件。',
      },
      author: 'lanxiake',
      homepage: 'https://github.com/lanxiake/dsh-vyra-plugins/tree/master/plugins/dsh-im#readme',
      repository: {
        url: 'https://github.com/lanxiake/dsh-vyra-plugins',
      },
      versions: {
        '6.0.0': {
          publishTimestamp: 1795791604,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '2c276842ba6dfc38206087e827d739e8caba0004',
            path: 'plugins/dsh-im',
          },
        },
        '5.13.0': {
          publishTimestamp: 1795446358,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '036c3dbc58eef1304f4a0e36741c436fdf7ba3d7',
            path: 'plugins/dsh-im',
          },
        },
      },
      metadata: {
        category: 'integration',
        keywords: ['im', 'wechat', 'feishu', 'telegram', 'slack', 'discord', 'agent', 'skill', 'lanxiake'],
      },
    },
    {
      name: '@yuehancn/dsh-tool-ocr',
      title: {
        en: 'OCR',
        zh: '图像文字识别',
      },
      description: {
        en: 'Extract text from images and PDFs: read a born-digital text layer, or OCR a scan with any configured engine — including the OCR engine built into Windows 10/11, which needs nothing installed.',
        zh: '从图片和 PDF 里取文字：数字版 PDF 直接读文字层，扫描件走 OCR。可以接任意配置的引擎，也可以用 Windows 10/11 自带的 OCR——什么都不用装。',
      },
      author: 'yuehancn',
      homepage: 'https://github.com/yuehancn/dsh-tool-ocr#readme',
      repository: {
        url: 'https://github.com/yuehancn/dsh-tool-ocr',
      },
      // The vendored manifest declares this; the index must agree with the
      // package a client actually installs, or the card shows a compatibility
      // the install then refuses.
      engines: { dsh: '>=0.2.0-rc.2' },
      versions: {
        // 1.0.0 shipped a tree with no `lib/` — see 1.0.1 below. Kept so a
        // client that already resolved it keeps installing what it resolved.
        '1.0.0': {
          publishTimestamp: 1794967200,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'bfcecfa25ca5cc0781580a12a267b7f277abe7d3',
            path: 'plugins/dsh-tool-ocr',
          },
        },
        '1.0.1': {
          publishTimestamp: 1795053600,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'ec3d3abfd7878410695de90798bcfe9a738a436e',
            path: 'plugins/dsh-tool-ocr',
          },
        },
        // 1.1.0 adds the winrt backend: `backend: winrt`, or an engine marked
        // `mode: winrt`, runs Windows.Media.Ocr through a bundled PowerShell
        // driver, so ocr_read works with no external OCR installed.
        '1.1.0': {
          publishTimestamp: 1796112000,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '351b0bb9d67498bad801c96738347565b5f4159e',
            path: 'plugins/dsh-tool-ocr',
          },
        },
      },
      metadata: {
        category: 'input-output',
        keywords: ['ocr', 'text-extraction', 'pdf', 'image', 'windows', '取字', '文字识别'],
      },
    },
    {
      name: '@anht3889/dsh-superpowers',
      title: {
        en: 'Superpowers',
        zh: 'Superpowers 技能集',
      },
      description: {
        en: 'The obra Superpowers skill collection plus session bootstrap for a DSH profile.',
        zh: 'obra Superpowers 技能集，附带会话引导。',
      },
      author: 'anht3889',
      homepage: 'https://github.com/anht3889/dsh-superpowers',
      repository: {
        url: 'https://github.com/anht3889/dsh-superpowers',
      },
      versions: {
        '0.0.4': {
          publishTimestamp: 1794967200,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'ec3d3abfd7878410695de90798bcfe9a738a436e',
            path: 'plugins/dsh-superpowers',
          },
        },
      },
      metadata: {
        category: 'agent-runtime',
        keywords: ['skills', 'superpowers', 'tdd', 'debugging'],
      },
    },
    {
      name: '@noob-stupid/dsh-plugin-console',
      title: {
        en: 'Plugin Console',
        zh: '插件控制台',
      },
      description: {
        en: 'Framework upgrade safety and plugin version gating for DSH: one-click upgrade with automatic rollback on failure, rollback to the previous release, automatic disabling of plugins that no longer fit, plus a multi-source plugin market whose sources can point at internal mirrors, private indexes or a local Git repository for intranet-only offline installs.',
        zh: '框架升级安全与插件升级门控：一键升级、失败自动回滚、升级后回滚上版、旧插件不适配自动禁用；内置多源插件市场为发现层，插件源全部可自定义，可指向公司内网私有源、私有索引、本地 Git 仓库，纯内网离线可用。',
      },
      author: 'Noob-stupid',
      homepage: 'https://github.com/Noob-stupid/dsh-plugin-gating-hub#readme',
      repository: {
        url: 'https://github.com/Noob-stupid/dsh-plugin-gating-hub',
      },
      versions: {
        '0.5.110': {
          publishTimestamp: 1795336800,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '677cc3aba9a7f07fcf0b81571be36abe77cbffa1',
            path: 'plugins/dsh-plugin-console',
          },
        },
      },
      metadata: {
        category: 'integration',
        keywords: ['plugin-manager', 'market', 'upgrade', 'rollback', 'gating'],
      },
    },
    {
      name: '@xiaoso/dsh-workflow-lite',
      title: {
        en: 'Workflow Lite',
        zh: '轻量工作流',
      },
      description: {
        en: 'Lightweight agent workflow for DeepSeek Harness: one workflow = one JSON (React Flow native) with prompts inline, compiled into a dispatch plan the model executes itself. No execution engine; optional per-workflow run state kept by the model in a YAML file.',
        zh: '轻量智能体工作流：一个工作流就是一份 JSON（React Flow 原生），提示词内联，编译成模型自己执行的分派计划；没有执行引擎，可选的运行状态由模型写在 YAML 里。',
      },
      author: 'xiaoso',
      homepage: 'https://xiaoso456.github.io/dsh-workflow-lite/',
      repository: {
        url: 'https://github.com/xiaoso456/dsh-workflow-lite',
      },
      // The vendored manifest declares this; the index must agree with the
      // package a client actually installs.
      engines: { dsh: '>=0.2.0-0 <0.2.1-0 || >=0.2.1-0 <0.3.0-0' },
      versions: {
        '0.10.0': {
          publishTimestamp: 1795337200,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '677cc3aba9a7f07fcf0b81571be36abe77cbffa1',
            path: 'plugins/dsh-workflow-lite',
          },
        },
      },
      metadata: {
        category: 'agent-runtime',
        keywords: ['workflow', 'agents', 'json', 'dispatch'],
      },
    },
    {
      name: 'dsh-vyra-studymate',
      title: {
        en: 'StudyMate Learning',
        zh: 'StudyMate 学习',
      },
      description: {
        en: 'StudyMate learning skills and lesson engine, maintained here with audio lessons, narrated video and hands-on workshops: turn a subject into lessons, practice and projects inside DSH. Based on StudyMate by Cattofu (MIT).',
        zh: 'StudyMate 学习技能与课程引擎：把一门科目拆成课程、练习与项目，并可将每一课派生为音频课、旁白视频和动手工作坊。基于 Cattofu 的 StudyMate（MIT）。',
      },
      author: 'lanxiake',
      homepage: 'https://github.com/lanxiake/dsh-vyra-plugins#readme',
      repository: {
        url: 'https://github.com/lanxiake/dsh-vyra-plugins',
        directory: 'plugins/vyra-studymate',
      },
      icon: STUDYMATE_ICON,
      versions: {
        '2.2.1': {
          publishTimestamp: 1795679988,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '4f4d01ffe5612461d706874dabe66996ad306cda',
            path: 'plugins/vyra-studymate',
          },
        },
        // 2.2.0 asks for a course format at enrollment (reading, audio,
        // video, quiz or a mix) and ships the media generators with the
        // installed package.
        '2.2.0': {
          publishTimestamp: 1795360406,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '02f1678b11b20748c7084566370b1dcd1406e558',
            path: 'plugins/vyra-studymate',
          },
        },
        '2.1.0': {
          publishTimestamp: 1795354811,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '0f02c9852ade1c91681a69d01d41403d38c5c176',
            path: 'plugins/vyra-studymate',
          },
        },
      },
      metadata: {
        category: 'agent-runtime',
        keywords: ['study', 'learning', 'skills', 'lessons', 'audio', 'video', 'workshop'],
      },
    },
    {
      name: 'dsh-expert-orchestrator',
      title: {
        en: 'Expert Orchestrator',
        zh: '专家编排',
      },
      description: {
        en: 'Expert Orchestrator: a multi-agent orchestration agent preset for DSH — triage, PM planning, delegation to domain experts through a merged roster (summon_expert), a dependency-DAG taskboard, a file message bus, tiered delivery gates and experience pooling.',
        zh: '专家编排模式：多智能体任务编排，分诊、PM 先行规划、专家委派、依赖 DAG 任务板、消息总线并行落盘、分级交付门禁、经验池沉淀。',
      },
      author: 'mario841859784',
      homepage: 'https://github.com/mario841859784/dsh-expert-orchestrator#readme',
      repository: {
        url: 'https://github.com/mario841859784/dsh-expert-orchestrator',
      },
      engines: { dsh: '>=0.1.7-alpha.2 <0.2.0-0 || >=0.2.0-rc.1 <0.3.0-0 || >=0.2.1-0 <0.3.0-0' },
      versions: {
        '2.14.2': {
          publishTimestamp: 1795337600,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '677cc3aba9a7f07fcf0b81571be36abe77cbffa1',
            path: 'plugins/dsh-expert-orchestrator',
          },
        },
      },
      metadata: {
        category: 'agent-runtime',
        keywords: ['orchestration', 'multi-agent', 'preset', 'dag'],
      },
    },
    {
      name: '@nanmicoder/dsh-agent-teams',
      title: {
        en: 'Agent Teams',
        zh: '智能体团队',
      },
      description: {
        en: 'Multi-agent team collaboration for DSH: captain, members, tasks with dependencies and messaging, driven by natural language, with a tree monitor in the web GUI. Members can be composed from an Agent preset.',
        zh: '多智能体团队协作：队长、成员、带依赖的任务与消息，自然语言驱动，带树形监控面板。成员可由 Agent 预设组装。',
      },
      author: 'NanmiCoder',
      homepage: 'https://github.com/NanmiCoder/dsh-agent-teams#readme',
      repository: {
        url: 'https://github.com/NanmiCoder/dsh-agent-teams',
      },
      engines: { dsh: '>=0.1.2-alpha.2' },
      versions: {
        '0.1.30': {
          publishTimestamp: 1795337800,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '10e37aca2deeff162f3d8ef7ff914fa0834ce0a8',
            path: 'plugins/dsh-agent-teams',
          },
        },
        // 0.1.31-vyra.1 is this repository's snapshot of 0.1.30 plus one local
        // extension: a team member may name an `agent_preset`, so a preset from
        // the Agent manager (prompt, tools, skills) composes that member. The
        // staged-plan Web editor offers a preset dropdown, and a cold resume
        // restores the preset recorded in the member session.
        '0.1.31-vyra.1': {
          publishTimestamp: 1795408000,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'd80f3287b4da422a8a96b25c0fe871fe10320d0e',
            path: 'plugins/dsh-agent-teams',
          },
        },
      },
      metadata: {
        category: 'agent-runtime',
        keywords: ['multi-agent', 'teams', 'collaboration', 'tasks'],
      },
    },
    {
      name: 'dsh-vyra-file-manager',
      title: {
        en: 'File Manager',
        zh: '文件管理',
      },
      description: {
        en: 'A file manager in the right Sidebar that opens by default: browse every workspace file type (images, video, audio, documents, archives, HTML, code), zoom the whole grid, switch compact/detailed list views, preview PDFs and rich HTML in an opaque-origin sandbox, copy files onto the system clipboard as real file drops, rename, delete, reveal (selected in Explorer) or insert files into the composer, and list only the conversation turns that changed files.',
        zh: '右侧栏文件管理（展开即打开）：浏览工作区的全部文件类型（图片、视频、音频、文档、压缩包、HTML、代码等），网格可整体缩放，列表支持简洁/详细信息，面板内预览 PDF 与 HTML 富页面（opaque-origin 沙箱），可把文件以真实文件列表复制进系统剪贴板、重命名、删除、在资源管理器中选中打开及引用到输入框，时间线只列出真正改动过文件的对话轮次。',
      },
      author: 'lanxiake',
      homepage: 'https://github.com/lanxiake/dsh-vyra-plugins#readme',
      repository: {
        url: 'https://github.com/lanxiake/dsh-vyra-plugins',
        directory: 'plugins/vyra-file-manager',
      },
      icon: FILE_MANAGER_ICON,
      versions: {
        // 0.5.1 carries three features that landed after 0.5.0 was cut without a
        // version bump, so no install could reach them: media thumbnails in the
        // timeline grid, filtering the timeline by file type, and a draggable
        // seek bar for video and audio playback.
        '0.5.1': {
          // 2026-11-28 — the day this build was cut.
          publishTimestamp: 1795844829,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'bb8d752344e7e51e83e228ef132b99acd1cd9136',
            path: 'plugins/vyra-file-manager',
          },
        },
        // 0.5.0 — BREAKING: the "link" file type is gone. The type row now
        // offers "HTML" instead, and previously saved link cards are no longer
        // read or drawn (their localStorage entries are left untouched).
        // Also: a fresh right Sidebar opens on the file manager (toggle in the
        // filter panel); HTML previews run in an opaque-origin sandbox with
        // Host-inlined stylesheets, scripts and images; "copy file" puts a real
        // file list on the system clipboard; "reveal in file manager" now
        // selects the file in Explorer instead of silently doing nothing; and
        // the timeline lists only turns that changed files.
        '0.5.0': {
          // 2026-11-25 15:00 UTC — the day this build was cut.
          publishTimestamp: 1795593512,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '7c46956a474fde2a8875e1370b365b2f8bf3a3ef',
            path: 'plugins/vyra-file-manager',
          },
        },
        // 0.4.0 renames the package from `dsh-vyra-media-studio` to
        // `dsh-vyra-file-manager`. Only the identity strings move — the
        // package name, the cordis row, `export const name` and the client
        // registration id; by 0.2.0 this had become a file manager and the old
        // name described a plugin it no longer was. The earlier entries keep
        // the old path and name: their commits predate the rename and an
        // install must still resolve what those versions actually contained.
        '0.4.0': {
          // 2026-11-25 00:00 UTC — the day this build was cut.
          publishTimestamp: 1795585523,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'fa69be5879b52a505734c9117b76fa273e787166',
            path: 'plugins/vyra-file-manager',
          },
        },
        '0.3.5': {
          publishTimestamp: 1795576940,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '4f4d01ffe5612461d706874dabe66996ad306cda',
            path: 'plugins/vyra-media-studio',
          },
        },
        '0.1.0': {
          publishTimestamp: 1795344982,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '42840c36ccf65c61763e5a023a3f83efcfdd5e37',
            path: 'plugins/vyra-media-studio',
          },
        },
        // 0.1.1 fixes the two failures found on a real Host: a missing
        // `fs.contains`/`processPath` capability produced an opaque 500, and
        // workspace-relative paths could not reach delivered files outside the
        // workspace. It also reports the route's own reason instead of a bare
        // HTTP status.
        '0.1.1': {
          publishTimestamp: 1795354115,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'a6050a2cbad210c252bd745a2983413e3eade0ef',
            path: 'plugins/vyra-media-studio',
          },
        },
        // 0.1.2 supports Hosts whose workspace-files service predates
        // `scopeOf`: the workspace root is resolved from the live Session's
        // sandbox policy, then its header, then a stored Session header.
        '0.1.2': {
          publishTimestamp: 1795356930,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '29cafb11566f0a763bda65a51cd354d69cb4206a',
            path: 'plugins/vyra-media-studio',
          },
        },
        // 0.2.0 turns the media library into a file manager: every file type,
        // deferred metadata, a zoomable grid, detailed list mode, document
        // previews and rename/copy/delete/reveal/open actions.
        '0.2.0': {
          publishTimestamp: 1795407793,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'd1653955e7cc82117464361d3a5bd7e2a3ba5427',
            path: 'plugins/vyra-media-studio',
          },
        },
        // 0.2.1 restores the gridRef declaration and the MediaTab mediaSrc
        // import that made the 0.2.0 panel blank, and adds a render smoke test.
        '0.2.1': {
          publishTimestamp: 1795408917,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '3b9f6901860a9a14d6b58344d0b51a8c6a35f5f5',
            path: 'plugins/vyra-media-studio',
          },
        },
        // 0.2.2 adds the tree view, single/multi type filters, Ctrl batch
        // selection, Markdown/HTML/CSV/JSON/code previews and folder actions.
        '0.2.2': {
          publishTimestamp: 1795415421,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'cfae71a15d15bbed7f383c568236db8311476daf',
            path: 'plugins/vyra-media-studio',
          },
        },
        // 0.2.3 adds a current-session file filter backed by the Session header
        // createdAt, sorted newest first.
        '0.2.3': {
          publishTimestamp: 1795426714,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '966faf738aa30717f90fc921c2e5ac3d52af6876',
            path: 'plugins/vyra-media-studio',
          },
        },
        // 0.2.4 adds the produced-files timeline, long-press drag to move or
        // reference, a move route, explorer labels and a faster search.
        '0.2.4': {
          publishTimestamp: 1795486962,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'a27ca6702bd6d35686b8a9de0f52aecddf8a3c0a',
            path: 'plugins/vyra-media-studio',
          },
        },
        // 0.2.5 makes the timeline a conversation axis, adds an in-panel drop
        // panel for long-press drag, and collapses view toggles.
        '0.2.5': {
          publishTimestamp: 1795492040,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'bf32204900ea98c8b09f491628f69c5abdaa6a43',
            path: 'plugins/vyra-media-studio',
          },
        },
        // 0.2.6 fixes the invisible timeline and restores native drag.
        '0.2.6': {
          publishTimestamp: 1795495448,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'b758addf67d3602061bae014df6d60600017f23f',
            path: 'plugins/vyra-media-studio',
          },
        },
        // 0.2.7 reads the session log from every Host surface so the timeline fills.
        '0.2.7': {
          publishTimestamp: 1795499691,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '35323514409471c07237c2b81f4198a1e6a4e796',
            path: 'plugins/vyra-media-studio',
          },
        },
        // 0.2.8 reads the session log through non-throwing service probes.
        '0.2.8': {
          publishTimestamp: 1795503452,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '3f45a21221865571dda3958fb19fe803b4df6f70',
            path: 'plugins/vyra-media-studio',
          },
        },
        // 0.2.9 stops reading undeclared services by property (Cordis throws).
        '0.2.9': {
          publishTimestamp: 1795503964,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '4423d781c9d7248e61f30fa13b6c6a1d7bfbc6f5',
            path: 'plugins/vyra-media-studio',
          },
        },
        // 0.3.0 turns the timeline into its own grid-capable, collapsible view.
        '0.3.0': {
          publishTimestamp: 1795504770,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '297ffc81890a18eb47b4e5615c53bfcd7a702144',
            path: 'plugins/vyra-media-studio',
          },
        },
        // 0.3.1 ties the timeline to the session filter and enlarges the controls.
        '0.3.1': {
          publishTimestamp: 1795505657,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '44a3f04bce2eba171f81db0b647bc9bd91187fae',
            path: 'plugins/vyra-media-studio',
          },
        },
        // 0.3.2 fixes mouse drag, widens text preview and filters type counts.
        '0.3.2': {
          publishTimestamp: 1795506277,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '0c863d9613980f7f84c2212ad52b28424a6c34f1',
            path: 'plugins/vyra-media-studio',
          },
        },
        // 0.3.3 makes timeline entries drag sources.
        '0.3.3': {
          publishTimestamp: 1795506792,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '1b1a3eab7b552e44ba7b27f65c09a4ee6b40ec5d',
            path: 'plugins/vyra-media-studio',
          },
        },
        // 0.3.4 drags a clone of the pressed element as the ghost.
        '0.3.4': {
          publishTimestamp: 1795507015,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '6e499f15c5bb01823d2f9dff6ca80f4efcb16620',
            path: 'plugins/vyra-media-studio',
          },
        },
      },
      metadata: {
        category: 'content',
        keywords: ['files', 'file-manager', 'media', 'document', 'video', 'audio', 'gallery'],
      },
    },
    {
      name: 'dsh-vyra-dsh-console',
      title: {
        en: 'DSH Console',
        zh: 'DSH 控制台',
      },
      description: {
        en: 'A console for the harness itself: read and switch models, read and write settings, enable or disable plugins and MCP servers, and change the theme and layout — from an agent tool or from a sidebar panel, both dispatching through one action registry. Its point is its boundary as much as its reach: sandbox mode, permission presets, approval answers and credential writes are refused for every caller, with the reason and who should do it instead shown rather than hidden.',
        zh: '面向 harness 自身的控制台：查看与切换模型、读写设置、启停插件与 MCP、调整主题与布局，Agent 工具与侧栏面板共用同一张动作注册表。这个插件同样在意「不能做什么」：沙箱模式、权限预设、审批应答与凭据写入对任何调用方都永久拒绝，并把拒绝原因与该由谁来做摊开显示。',
      },
      author: 'lanxiake',
      homepage: 'https://github.com/lanxiake/dsh-vyra-plugins#readme',
      repository: {
        url: 'https://github.com/lanxiake/dsh-vyra-plugins',
        directory: 'plugins/vyra-dsh-console',
      },
      icon: DSH_CONSOLE_ICON,
      versions: {
        '0.1.2': {
          publishTimestamp: 1795679986,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '4f4d01ffe5612461d706874dabe66996ad306cda',
            path: 'plugins/vyra-dsh-console',
          },
        },
        '0.1.0': {
          publishTimestamp: 1795472400,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '2e72b533b1917f0637c5a6c94ca10ce7efb12e19',
            path: 'plugins/vyra-dsh-console',
          },
        },
        // 0.1.0 stays pinned where it was published — repinning a version users
        // have already resolved would change an install source under them, and
        // the header forbids repinning to pick up code. Everything here changed
        // after that pin, so 0.1.1 is a new version:
        // `settings.set` could write the `permission` namespace and so reach the
        // sandbox and approval settings `FORBIDDEN` refuses — the boundary was
        // bypassable and answered `ok`. The panel built its service bag from a
        // global nothing ever assigned, so every appearance control failed, and
        // the endpoint could not dispatch an action at all. `FORBIDDEN` and
        // `ACTIONS` resolved inherited prototype names (`toString` came back
        // `forbidden` with no reason). The CLI's `services` command omitted the
        // appearance domain. Also reads the default model from its live source,
        // not the `settings.yaml` DSH removed.
        '0.1.1': {
          publishTimestamp: 1795503600,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '1ef44a9eb048c4d4aa6175aad430fb3d953d47fd',
            path: 'plugins/vyra-dsh-console',
          },
        },
        // 0.1.2 shipped without `tool.js` and `domains/` in `files`, so index.js
        // threw ERR_MODULE_NOT_FOUND on every installation: no dsh_console tool,
        // no RPC route, no panel. 0.2.0 is the first working release. It also
        // adds ui.* (open a settings section, a main panel, a right-drawer tab),
        // console.map, the exact-route Origin/Host fence the RPC was missing,
        // and the agent skill registered at runtime instead of living outside
        // the package.
        //
        // 0.1.2 is deliberately NOT repinned: a version users have already
        // resolved keeps its source, and repinning it would change code under
        // an installed name.
        '0.2.0': {
          publishTimestamp: 1795680000,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '197603579872294d29fec68e076b4a064e2b6990',
            path: 'plugins/vyra-dsh-console',
          },
        },
        // Found on the first real desktop run: the bridge forwarded only an op's
        // `value`, so `ui.list` arrived as a bare `{status:'ok'}` and `ui.open`
        // lost the `verified` flag. Separately, only the first menu trigger was
        // tried, and the account menu — where the settings row lives — is not the
        // first menu in the sidebar. Both fixed here.
        '0.2.1': {
          publishTimestamp: 1795683600,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '4fd1bc95b881204257940d9be43aa76f25b8b3b4',
            path: 'plugins/vyra-dsh-console',
          },
        },
        // Refusing ui.* while the window was in the background deadlocked the
        // agent: forwarding DSH took a shell command, and that command handed
        // focus back to the terminal. Visibility is now reported, not enforced.
        '0.2.2': {
          publishTimestamp: 1795687200,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'a60f160a990ad96a325361afa526e1b601632d2d',
            path: 'plugins/vyra-dsh-console',
          },
        },
        // 0.4.0 records a walkthrough from a step list. The package moved to
        // 0.4.0 before the index did, so anyone on a fresh install was held at
        // 0.2.2 while the checkout said something else.
        '0.4.0': {
          publishTimestamp: 1795741200,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'd2324ba2217d442e316e52fc6e05710162ef4933',
            path: 'plugins/vyra-dsh-console',
          },
        },
      },
      metadata: {
        category: 'agent-runtime',
        keywords: ['console', 'harness', 'settings', 'ui', 'panels', 'models', 'plugins'],
      },
    },
    {
      name: 'dsh-boot-duel',
      title: {
        en: 'Clock In',
        zh: '开工大吉',
      },
      description: {
        en: 'A one-round stick-figure fight that covers the Web home page after each load: settle it with your fists, then get back to work. Eleven-point Verlet skeleton, capsule hits, a King-of-Fighters impact language, and three project rows — scope changes, API integration, release day — argued out in speech bubbles.',
        zh: '每次打开 Web 界面先打一局火柴人：把对手血条打空就能进首页，按 Esc 直接放行，打完接着上班。十一质点 Verlet 骨架、胶囊命中、拳皇式打击感，三套项目故事（改需求 / 联调 / 上线）用台词气泡吵完。',
      },
      author: 'lanxiake',
      homepage: 'https://github.com/lanxiake/dsh-vyra-plugins#readme',
      repository: {
        url: 'https://github.com/lanxiake/dsh-vyra-plugins',
        directory: 'plugins/dsh-boot-duel',
      },
      icon: BOOT_DUEL_ICON,
      versions: {
        '0.1.0': {
          publishTimestamp: 1795700000,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '27c10c3f584896bbc8dd458713cb8b7034d632d1',
            path: 'plugins/dsh-boot-duel',
          },
        },
        // 0.2.0 is the first version with a LICENSE file and a `repository`
        // field, which is what an external listing checks. It also carries the
        // language fix, the project-row stories and the host-page restart.
        '0.2.0': {
          publishTimestamp: 1795737600,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '443808025758e387601889726e398547ff90ef8e',
            path: 'plugins/dsh-boot-duel',
          },
        },
        // 0.2.1 gates both routes with `connection.requestRejection`, which is
        // what an external listing's security review asks for.
        '0.2.1': {
          publishTimestamp: 1795741200,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '110a2042a40357d6570b50821eaf8ecd64dbfe72',
            path: 'plugins/dsh-boot-duel',
          },
        },
        // 0.3.0 is the version an external listing pins: the finisher's
        // five-beat cinematic, the finish's own beats, and the dialogue that
        // tracks instead of shuffling.
        '0.3.0': {
          publishTimestamp: 1795827600,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '8073cce2cbf229782d843bc2a4774694b18472c4',
            path: 'plugins/dsh-boot-duel',
          },
        },
        // 0.4.0 is what the listing ships with: the combo counter moved off
        // the health bar, and the KO subtitle now speaks the game's own
        // language (projects, not swords).
        '0.4.0': {
          publishTimestamp: 1795831200,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '13f7580cd21168ba0907c3fb0867515af850f29a',
            path: 'plugins/dsh-boot-duel',
          },
        },
      },
      metadata: {
        category: 'appearance',
        keywords: ['boot', 'animation', 'fighting-game', 'canvas', 'office', 'game'],
      },
    },
    {
      // Renamed from upstream's `dsh-media-desk`, because this copy is the one
      // developed further here rather than mirrored. The DATA directory keeps
      // upstream's name (`$DSH_HOME/media-desk/`, derived from a literal in
      // `src/store.js`, not from the package name), so moving from the upstream
      // package to this one keeps ideas, drafts and schedule.
      name: 'dsh-vyra-media-desk',
      title: {
        en: 'Media Desk',
        zh: '自媒体工作台',
      },
      description: {
        en: 'Capture an idea in one sentence, then generate the spoken script, title, cover, illustrations and line-art storyboards: idea wall, drafts, schedule, insights and reusable style cards. Based on Media Desk by 蜗牛的科技笔记 (MIT), developed further here.',
        zh: '一句话记灵感，一键做出脚本、封面、配图和黑白线稿分镜：灵感墙、成稿、排期、复盘和专属风格卡。基于蜗牛的科技笔记的 Media Desk（MIT），在本仓库二次开发。',
      },
      author: 'lanxiake',
      homepage: 'https://github.com/lanxiake/dsh-vyra-plugins/tree/master/plugins/vyra-media-desk#readme',
      repository: {
        url: 'https://github.com/lanxiake/dsh-vyra-plugins',
        directory: 'plugins/vyra-media-desk',
      },
      engines: { dsh: '>=0.2.1-rc.5 <0.3.0' },
      versions: {
        '2.7.2': {
          publishTimestamp: 1795827600,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '707e477f352b36f6b71c1a59945092cdc86d42fb',
            path: 'plugins/vyra-media-desk',
          },
        },
      },
      metadata: {
        category: 'content',
        keywords: ['content-creation', 'script', 'cover', 'storyboard', 'xiaohongshu', '自媒体', '小红书', '脚本', '封面', '分镜'],
      },
    },
    {
      // Upstream publishes build output only, so `lib/` is the editable form.
      // The name stays upstream's: it is the part the baoyu-design plugins share
      // and each mounts under its own row id, which a rename would break for
      // plugins installed from upstream.
      name: 'dsh-claude-artifacts',
      title: {
        en: 'Artifacts',
        zh: '作品',
      },
      description: {
        en: 'The Artifacts page in the sidebar, and comments from the baoyu-design editors reaching the agent: every slide deck, design, dashboard, film or whiteboard an agent opened, one click from its conversation. Installed by itself, or brought along by any baoyu-design plugin. MIT for its own code; NOTICE.md records what stays Anthropic\'s.',
        zh: '侧栏的「作品」页，以及把 baoyu-design 各编辑器里的评论送到 Agent：Agent 打开过的幻灯片、设计、仪表盘、影片或白板，点一下就回到它的对话。可以单独装，也会随任一 baoyu-design 插件一起装上。自身代码为 MIT，NOTICE.md 注明仍属 Anthropic 的部分。',
      },
      author: 'Jim Liu 宝玉',
      homepage: 'https://github.com/JimLiu/baoyu-design',
      repository: {
        url: 'https://github.com/JimLiu/baoyu-design',
        directory: 'dsh-plugins/dsh-claude-artifacts',
      },
      engines: { dsh: '>=0.2.0-0' },
      versions: {
        '2.16.0': {
          publishTimestamp: 1795827600,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '707e477f352b36f6b71c1a59945092cdc86d42fb',
            path: 'plugins/dsh-claude-artifacts',
          },
        },
      },
      metadata: {
        category: 'content',
        keywords: ['artifacts', 'comments', 'slides', 'design', 'whiteboard', '作品'],
      },
    },
    {
      name: 'dsh-remotion',
      title: {
        en: 'Remotion Studio',
        zh: 'Remotion 视频创作',
      },
      description: {
        en: 'A React video workbench: a multi-track director\'s desk with live monitor and scrubbable timeline, the official Remotion skills, project search, templates, Studio preview and local MP4 export, with 13 bright styles and 8 paired CJK/Latin typefaces.',
        zh: 'React 视频创作工作台：实体多轨导演台（实时监看屏、可擦洗时间线）、官方 Remotion 技能、工程检索、模板库、Studio 预览与本地 MP4 导出，含 13 套明亮风格与 8 套中英双层字体搭配。',
      },
      author: 'stardustlc',
      homepage: 'https://github.com/STARDUSTLC666/dsh-remotion#readme',
      repository: {
        url: 'https://github.com/STARDUSTLC666/dsh-remotion',
      },
      engines: { dsh: '>=0.2.2-rc.3' },
      versions: {
        '0.13.3': {
          publishTimestamp: 1795827600,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: '707e477f352b36f6b71c1a59945092cdc86d42fb',
            path: 'plugins/dsh-remotion',
          },
        },
      },
      metadata: {
        category: 'media',
        keywords: ['video', 'remotion', 'react', 'animation', 'mp4', '视频', '剪辑'],
      },
    },
  ],
}
