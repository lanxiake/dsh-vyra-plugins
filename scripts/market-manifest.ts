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
 * Inline icon for `vyra-tool-usage-stats`: three ascending bars.
 *
 * Inline rather than a file because the market card renders it from the index
 * document itself; a relative path would not resolve from the client, and
 * published indexes carry the image this way.
 */
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
 * `scripts/publish-plugins.mjs` runs those steps in that order, deriving each
 * SHA from the commit that actually holds the plugin's files.
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








/** Inline icon for `vyra-agent-manager`. */
const AGENT_MANAGER_ICON =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCIgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0Ij4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZ3JhZCIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM0RjQ2RTU7c3RvcC1vcGFjaXR5OjEiIC8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3R5bGU9InN0b3AtY29sb3I6IzdDM0FFRDtzdG9wLW9wYWNpdHk6MSIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCIgcng9IjEyIiBmaWxsPSJ1cmwoI2dyYWQpIi8+CiAgPGcgZmlsbD0id2hpdGUiIG9wYWNpdHk9IjAuOTUiPgogICAgPGNpcmNsZSBjeD0iMjIiIGN5PSIyNCIgcj0iNiIvPgogICAgPGNpcmNsZSBjeD0iNDIiIGN5PSIyNCIgcj0iNiIvPgogICAgPGNpcmNsZSBjeD0iMzIiIGN5PSI0NCIgcj0iNiIvPgogICAgPHBhdGggZD0iTTIyIDMwIEwzMiAzOCIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIiBvcGFjaXR5PSIwLjYiLz4KICAgIDxwYXRoIGQ9Ik00MiAzMCBMMzIgMzgiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMiIgb3BhY2l0eT0iMC42Ii8+CiAgPC9nPgo8L3N2Zz4NCg=='

/** Inline icon for `vyra-smart-compaction`. */
const SMART_COMPACTION_ICON =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCIgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiByb2xlPSJpbWciIGFyaWEtbGFiZWw9IlNtYXJ0IGNvbXBhY3Rpb24iPgogIDx0aXRsZT5TbWFydCBjb21wYWN0aW9uPC90aXRsZT4KICA8ZyBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyLjQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+CiAgICA8cmVjdCB4PSI2IiB5PSI5IiB3aWR0aD0iMzYiIGhlaWdodD0iMzAiIHJ4PSI0IiAvPgogICAgPHBhdGggZD0iTTExIDE2aDI2IiAvPgogICAgPHBhdGggZD0iTTExIDIzaDE4IiAvPgogICAgPHBhdGggZD0iTTExIDMwaDEwIiAvPgogICAgPHBhdGggZD0iTTMwIDI3LjUgMzUuNSAzMyAzMCAzOC41IiAvPgogIDwvZz4KICA8Y2lyY2xlIGN4PSIxOC41IiBjeT0iMzMuNSIgcj0iMi40IiBmaWxsPSJjdXJyZW50Q29sb3IiIC8+Cjwvc3ZnPgo='

/** Inline icon for `vyra-skill-mcp-manager`. */
const SKILL_MCP_ICON =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj4KICA8cGF0aCBkPSJNMjEgMTZWOGEyIDIgMCAwIDAtMS0xLjczbC03LTRhMiAyIDAgMCAwLTIgMGwtNyA0QTIgMiAwIDAgMCAzIDh2OGEyIDIgMCAwIDAgMSAxLjczbDcgNGEyIDIgMCAwIDAgMiAwbDctNEEyIDIgMCAwIDAgMjEgMTZ6Ii8+CiAgPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMyIvPgogIDxwYXRoIGQ9Ik0xMiA5djYiLz4KICA8cGF0aCBkPSJNOSAxMmg2Ii8+Cjwvc3ZnPgo='

/** Inline icon for `vyra-ssh-terminal`. */
const SSH_TERMINAL_ICON =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCIgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0Ij4KICA8cmVjdCB4PSI2IiB5PSIxMCIgd2lkdGg9IjUyIiBoZWlnaHQ9IjQ0IiByeD0iOCIgZmlsbD0iIzFmMjkzNyIvPgogIDxyZWN0IHg9IjYiIHk9IjEwIiB3aWR0aD0iNTIiIGhlaWdodD0iMTAiIHJ4PSI4IiBmaWxsPSIjMzc0MTUxIi8+CiAgPGNpcmNsZSBjeD0iMTQiIGN5PSIxNSIgcj0iMiIgZmlsbD0iI2Y4NzE3MSIvPgogIDxjaXJjbGUgY3g9IjIxIiBjeT0iMTUiIHI9IjIiIGZpbGw9IiNmYmJmMjQiLz4KICA8Y2lyY2xlIGN4PSIyOCIgY3k9IjE1IiByPSIyIiBmaWxsPSIjMzRkMzk5Ii8+CiAgPHBhdGggZD0iTTE1IDMxbDggNi04IDYiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzM0ZDM5OSIgc3Ryb2tlLXdpZHRoPSIzLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgogIDxwYXRoIGQ9Ik0yOSA0NGgxNCIgc3Ryb2tlPSIjZTVlN2ViIiBzdHJva2Utd2lkdGg9IjMuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+Cjwvc3ZnPgo='

/** Inline icon for `vyra-system-selection`. */
const SYSTEM_SELECTION_ICON =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIj4KICA8cGF0aCBkPSJNNCAzaDRNNCAzdjRNMjAgM2gtNE0yMCAzdjRNNCAyMWg0TTQgMjF2LTRNMjAgMjFoLTRNMjAgMjF2LTQiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgogIDxwYXRoIGQ9Ik05IDEyaDdNMTMgOWwzIDMtMyAzIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+Cg=='

/** Inline icon for `vyra-theme-styles`. */
const THEME_STYLES_ICON =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSI+CiAgPHBhdGggZD0iTTEyIDNhOSA5IDAgMCAxIDAgMThjLTEuNCAwLTIuMi0uOS0yLjItMiAwLS42LjItMSAuNi0xLjQuNC0uNC42LS44LjYtMS4zIDAtMS0uOC0xLjgtMS44LTEuOEg3LjZBNC42IDQuNiAwIDAgMSAzIDkuOUMzIDYuMSA3IDMgMTIgM1oiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjEuNiIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgogIDxjaXJjbGUgY3g9IjgiIGN5PSI5IiByPSIxLjMiIGZpbGw9ImN1cnJlbnRDb2xvciIvPgogIDxjaXJjbGUgY3g9IjEyIiBjeT0iNyIgcj0iMS4zIiBmaWxsPSJjdXJyZW50Q29sb3IiLz4KICA8Y2lyY2xlIGN4PSIxNS44IiBjeT0iOS40IiByPSIxLjMiIGZpbGw9ImN1cnJlbnRDb2xvciIvPgo8L3N2Zz4K'

/** Inline icon for `vyra-xianyu-delivery`: a white parcel on green. */
const XIANYU_DELIVERY_ICON =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+PHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTQiIGZpbGw9IiMwZjlkNmUiLz48ZyBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTMgMjRsMTktMTAgMTkgMTB2MTlhNSA1IDAgMCAxLTUgNUgxOGE1IDUgMCAwIDEtNS01eiIvPjxwYXRoIGQ9Ik0yNCAzNGgxNk0yNCA0MmgxMCIvPjwvZz48L3N2Zz4K'

/** Inline icon for `vyra-wechat-local`: a green chat bubble. */
const WECHAT_LOCAL_ICON =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+PHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTQiIGZpbGw9IiMwN2MxNjAiLz48cGF0aCBkPSJNMTggMjBoMjhhNCA0IDAgMCAxIDQgNHYxNGE0IDQgMCAwIDEtNCA0SDMybC05IDd2LTdoLTVhNCA0IDAgMCAxLTQtNFYyNGE0IDQgMCAwIDEgNC00eiIgZmlsbD0iI2ZmZiIvPjxjaXJjbGUgY3g9IjI1IiBjeT0iMzEiIHI9IjIuNiIgZmlsbD0iIzA3YzE2MCIvPjxjaXJjbGUgY3g9IjMyIiBjeT0iMzEiIHI9IjIuNiIgZmlsbD0iIzA3YzE2MCIvPjxjaXJjbGUgY3g9IjM5IiBjeT0iMzEiIHI9IjIuNiIgZmlsbD0iIzA3YzE2MCIvPjwvc3ZnPg=='

/** Inline icon for `vyra-agent-cli-manager`. */
const AGENT_CLI_MANAGER_ICON =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCIgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByb2xlPSJpbWciIGFyaWEtbGFiZWw9IkFnZW50IENMSSBNYW5hZ2VyIj4NCiAgPHRpdGxlPkFnZW50IENMSSBNYW5hZ2VyPC90aXRsZT4NCiAgPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTQiIGZpbGw9IiMwZjc2NmUiLz4NCiAgPGcgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjMiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+DQogICAgPHJlY3QgeD0iMTQiIHk9IjE2IiB3aWR0aD0iMzYiIGhlaWdodD0iMzIiIHJ4PSI1IiBvcGFjaXR5PSIwLjg1Ii8+DQogICAgPHBhdGggZD0iTTIyIDI3bDUgNS01IDUiLz4NCiAgICA8cGF0aCBkPSJNMzIgMzdoMTAiLz4NCiAgPC9nPg0KPC9zdmc+DQo='

/** Inline icon for `vyra-plugin-market`. */
const PLUGIN_MARKET_ICON =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSI+CiAgPHBhdGggZD0iTTMgOS41IDEyIDRsOSA1LjV2NUwxMiAyMGwtOS01LjV2LTVaIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIxLjYiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KICA8cGF0aCBkPSJNMyA5LjUgMTIgMTVsOS01LjUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjEuNiIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgogIDxwYXRoIGQ9Ik0xMiAyMHYtNSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMS42IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICA8cGF0aCBkPSJNNy42IDYuOSAxNi40IDEyIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIxLjYiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K'

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
    },
  },
  plugins: [
    {
      name: 'vyra-tool-usage-stats',
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
      },
      metadata: {
        category: 'observability',
        keywords: ['stats', 'tool-usage', 'observability'],
      },
    },
    {
      name: 'vyra-agent-manager',
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
        '1.1.0': {
          publishTimestamp: 1794551488,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'ec3d3abfd7878410695de90798bcfe9a738a436e',
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
      name: 'vyra-smart-compaction',
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
      name: 'vyra-skill-mcp-manager',
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
      name: 'vyra-ssh-terminal',
      title: {
        en: 'SSH Terminal',
        zh: 'SSH 终端',
      },
      description: {
        en: 'An SSH terminal inside DSH: connection profiles, jump hosts, SFTP, port forwarding and host-key pinning. Passwords go to the credentials service, never into the profile file.',
        zh: '把 SSH 终端搬进 DSH：连接档案、跳板、SFTP、端口转发与主机密钥固定。密码只进凭据服务，档案文件里没有任何秘密。',
      },
      author: 'lanxiake',
      homepage: 'https://github.com/lanxiake/dsh-vyra-plugins#readme',
      repository: {
        url: 'https://github.com/lanxiake/dsh-vyra-plugins',
        directory: 'plugins/vyra-ssh-terminal',
      },
      icon: SSH_TERMINAL_ICON,
      versions: {
        '0.1.0': {
          publishTimestamp: 1794551488,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'ec3d3abfd7878410695de90798bcfe9a738a436e',
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
      name: 'vyra-system-selection',
      title: {
        en: 'System Selection',
        zh: '系统级划词',
      },
      description: {
        en: 'Select text in any application and get a native toolbar: AI search, translate, summarize, explain, copy. It takes over the right mouse button, so the application menu you would otherwise get does not appear in front of it.',
        zh: '在任何应用里划词，弹出原生工具条：AI 搜索、翻译、总结、解释、复制。它接管右键，所以应用自带的右键菜单不会再冒出来跟你抢。仅 Windows。',
      },
      author: 'lanxiake',
      homepage: 'https://github.com/lanxiake/dsh-vyra-plugins#readme',
      repository: {
        url: 'https://github.com/lanxiake/dsh-vyra-plugins',
        directory: 'plugins/vyra-system-selection',
      },
      icon: SYSTEM_SELECTION_ICON,
      versions: {
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
      },
      metadata: {
        category: 'browser',
        keywords: ['selection', 'translate', 'clipboard', 'windows'],
      },
    },
    {
      name: 'vyra-theme-styles',
      title: {
        en: 'Theme Styles',
        zh: '主题风格',
      },
      description: {
        en: 'Swap the whole client colour scheme for a third-party theme: a warm organic palette, or macOS frosted glass. Recolours the existing components through their own tokens, so nothing is left half-switched.',
        zh: '把整个客户端的配色换成第三方主题：暖感有机风，或 macOS 毛玻璃。覆盖的是既有组件自己的主题令牌，不会出现「一半换了另一半没换」。',
      },
      author: 'lanxiake',
      homepage: 'https://github.com/lanxiake/dsh-vyra-plugins#readme',
      repository: {
        url: 'https://github.com/lanxiake/dsh-vyra-plugins',
        directory: 'plugins/vyra-theme-styles',
      },
      icon: THEME_STYLES_ICON,
      versions: {
        '0.1.0': {
          publishTimestamp: 1794963600,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'ec3d3abfd7878410695de90798bcfe9a738a436e',
            path: 'plugins/vyra-theme-styles',
          },
        },
      },
      metadata: {
        category: 'browser',
        keywords: ['theme', 'style', 'ui'],
      },
    },
    {
      name: 'vyra-wechat-local',
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
      },
      metadata: {
        category: 'integration',
        keywords: ['wechat', 'weixin', 'local', 'chat', 'windows'],
      },
    },
    {
      name: 'vyra-xianyu-delivery',
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
        // vyra-xianyu-delivery so installed copies keep their install source.
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
      },
      metadata: {
        category: 'integration',
        keywords: ['xianyu', 'goofish', 'auto-delivery', 'virtual-goods'],
      },
    },
    {
      name: 'vyra-agent-cli-manager',
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
      },
      metadata: {
        category: 'agent-runtime',
        keywords: ['agent-cli', 'claude-code', 'codex', 'opencode', 'acp'],
      },
    },
    {
      name: 'vyra-plugin-market',
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
      },
      metadata: {
        category: 'integration',
        keywords: ['market', 'marketplace', 'plugin', 'batch'],
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
      name: '@xmanrui/dsh-im',
      title: {
        en: 'Instant Messaging Bridge',
        zh: '即时通讯桥接',
      },
      description: {
        en: 'Connect WeChat, Feishu, WeCom, DingTalk, QQ, Telegram, WhatsApp, Slack, Discord and Matrix to DSH.',
        zh: '把微信、飞书、企微、钉钉、QQ、Telegram、WhatsApp、Slack、Discord、Matrix 接入 DSH。',
      },
      author: 'xmanrui',
      homepage: 'https://github.com/xmanrui/dsh-im#readme',
      repository: {
        url: 'https://github.com/xmanrui/dsh-im',
      },
      versions: {
        '5.10.0': {
          publishTimestamp: 1794967200,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'ec3d3abfd7878410695de90798bcfe9a738a436e',
            path: 'plugins/dsh-im',
          },
        },
      },
      metadata: {
        category: 'integration',
        keywords: ['im', 'wechat', 'feishu', 'telegram', 'slack', 'discord'],
      },
    },
    {
      name: '@yuehancn/dsh-tool-ocr',
      title: {
        en: 'OCR',
        zh: '图像文字识别',
      },
      description: {
        en: 'Extract text from images and PDFs: read a born-digital text layer, or OCR a scan with any configured engine.',
        zh: '从图片和 PDF 里取文字：数字版 PDF 直接读文字层，扫描件走 OCR。',
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
      },
      metadata: {
        category: 'input-output',
        keywords: ['ocr', 'text-extraction', 'pdf', 'image'],
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
  ],
}
