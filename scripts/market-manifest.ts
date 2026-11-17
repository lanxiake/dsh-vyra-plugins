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

/** Inline icon for `vyra-agent-cli-manager`. */
const AGENT_CLI_MANAGER_ICON =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCIgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByb2xlPSJpbWciIGFyaWEtbGFiZWw9IkFnZW50IENMSSBNYW5hZ2VyIj4KICA8dGl0bGU+QWdlbnQgQ0xJIE1hbmFnZXI8L3RpdGxlPgogIDxyZWN0IHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCIgcng9IjE0IiBmaWxsPSIjMGY3NjZlIi8+CiAgPGcgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjMiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+CiAgICA8cmVjdCB4PSIxNCIgeT0iMTYiIHdpZHRoPSIzNiIgaGVpZ2h0PSIzMiIgcng9IjUiIG9wYWNpdHk9IjAuODUiLz4KICAgIDxwYXRoIGQ9Ik0yMiAyN2w1IDUtNSA1Ii8+CiAgICA8cGF0aCBkPSJNMzIgMzdoMTAiLz4KICA8L2c+Cjwvc3ZnPgo='

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
        en: 'Tool Self-Evolution',
        zh: '工具自进化',
      },
      description: {
        en: 'Lets your tools evolve: it counts every call, records why each one failed, then asks the agent to diagnose the repeat offenders and propose a fix you can apply in one click. Fewer repeated failures, fewer wasted tokens.',
        zh: '让 DSH 的工具自己进化：统计每次调用、记下每次失败的原因，定时交给 Agent 诊断那些反复出错的工具，给出可一键应用的修复。减少重复报错，也减少为同样错误反复烧掉的 token。',
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
            commit: 'b519c6bf160190313b15e1af891d04250d54a10e',
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
            commit: '54bd6c6be93723ddeda71f5802eb23fdd9fb3204',
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
            commit: '54bd6c6be93723ddeda71f5802eb23fdd9fb3204',
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
            commit: 'bc6d008cff2159893013e375d158277f43d495f4',
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
            commit: '54bd6c6be93723ddeda71f5802eb23fdd9fb3204',
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
            commit: 'c0a2f398ded5e79da81334b2b0d18b5e81520ba1',
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
        '1.0.0': {
          publishTimestamp: 1794963600,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'c0a2f398ded5e79da81334b2b0d18b5e81520ba1',
            path: 'plugins/vyra-agent-cli-manager',
          },
        },
      },
      metadata: {
        category: 'agent-runtime',
        keywords: ['agent-cli', 'claude-code', 'codex', 'opencode', 'acp'],
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
            commit: 'bfcecfa25ca5cc0781580a12a267b7f277abe7d3',
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
        '1.0.0': {
          publishTimestamp: 1794967200,
          source: {
            type: 'git',
            url: 'https://github.com/lanxiake/dsh-vyra-plugins.git',
            commit: 'bfcecfa25ca5cc0781580a12a267b7f277abe7d3',
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
            commit: 'bfcecfa25ca5cc0781580a12a267b7f277abe7d3',
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
