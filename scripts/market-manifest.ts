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
  /** DSH SemVer range this plugin supports, e.g. `>=0.2.0 <0.3.0`. */
  readonly engines: { readonly dsh: string }
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
        en: 'Tool Usage Stats',
        zh: '工具调用统计',
      },
      description: {
        en: 'Per-tool call, failure, and last-use counters, folded from the session log, with a Settings panel.',
        zh: '按工具统计调用次数、失败次数与最后使用时间，数据来自会话日志，带设置页面板。',
      },
      author: 'lanxiake',
      homepage: 'https://github.com/lanxiake/dsh-vyra-plugins#readme',
      repository: {
        url: 'https://github.com/lanxiake/dsh-vyra-plugins',
        directory: 'plugins/tool-usage-stats',
      },
      icon: TOOL_USAGE_ICON,
      // Every API this plugin uses — `tool/result.message.toolCallId`,
      // `connection.fetch.register`, `storageDomain`, and the
      // `settings.section` slot — is present from 0.2.0-rc.2 onward, verified
      // by reading those files at each released tag. The lower bound is stated
      // conservatively as the first stable 0.2 release.
      engines: { dsh: '>=0.2.0 <0.3.0' },
      versions: {
        '0.1.0': {
          // Unix seconds of commit ece9710.
          publishTimestamp: 1794485017,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            // Pinned to the commit that published this version. A Git source
            // must name an exact commit: a branch would make the same version
            // mean different code over time.
            commit: '41804bcad6655d1462f4ea5b3c8627df1cbfc238',
            path: 'plugins/tool-usage-stats',
          },
        },
      },
      metadata: {
        category: 'observability',
        keywords: ['stats', 'tool-usage', 'observability'],
      },
    },
  ],
}
