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
  /** Base64 `data:` URL or absolute URL of the plugin's icon. */
  readonly icon?: string
  /** Absolute http(s) URL of the project page. */
  readonly homepage?: string
  /** Source repository, shown in Discover; never an install source. */
  readonly repository?: {
    readonly url: string
    readonly directory?: string
  }
  readonly author?: string
  /** Where each version installs from. Keyed by exact SemVer. */
  readonly versions: Readonly<Record<string, MarketVersionSource>>
  readonly metadata?: {
    readonly category?: string
    readonly keywords?: readonly string[]
    readonly labels?: readonly string[]
  }
}

/** Install source for one exact version. */
export type MarketVersionSource =
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
  plugins: [],
}
