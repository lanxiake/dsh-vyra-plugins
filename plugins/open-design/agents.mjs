/**
 * Build the agent presets that pair with each domain.
 *
 * **One agent.** Nine domain agents were tried and removed: a preset with no
 * delegation cannot hand work to another, so every domain agent was a dead end
 * the director had to reassemble by hand, losing the artist's context at each
 * hop. Skills are the capability layer; this file now emits only the director.
 *
 * The director's `team` is the **whole roster** — every preset installed on the
 * machine, not just the enabled domains. It has to be: `subagent`'s
 * `agent_preset` parameter only accepts ids from the static
 * `allowedAgentPresets` whitelist (dsh-tool-subagent `preset-selection.js`
 * `resolve()`), and the host offers no runtime preset enumeration. So the
 * whitelist is the only way a preset becomes reachable, and it is written at
 * sync time from what is actually on disk.
 *
 * The output is shaped by `agent_manager`'s writer (core.js:404) so the files
 * drop straight into `$DSH_HOME/agent-manager/presets/<id>/`.
 *
 * @module open-design/agents
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { DOMAINS, ORCHESTRATOR } from './domains.mjs'

/**
 * The Loader rows each capability stands for.
 *
 * Copied from `vyra-agent-manager`'s `capabilityDefs` (core.js:25) so a preset
 * built here mounts exactly the same plugins as one made in the Agent manager.
 * A preset whose `plugins` array is empty mounts nothing: the agent then has no
 * read, no shell, no skill loader — only tools the host exposes globally — which
 * is why it cannot inspect a repository at all.
 */
const CAPABILITY_ROWS = {
  files: [
    { id: 'tool-fs', name: '@deepseek-ai/dsh-tool-fs', config: { applyPatch: false } },
    { id: 'tool-fs-search', name: '@deepseek-ai/dsh-tool-fs-search', config: { sampleOverCapGlobResults: false } },
  ],
  shell: [{ id: 'tool-pwsh', name: '@deepseek-ai/dsh-tool-pwsh' }],
  jobs: [{ id: 'tool-jobs', name: '@deepseek-ai/dsh-tool-jobs' }],
  web: [{ id: 'tool-web', name: '@deepseek-ai/dsh-tool-web', config: { fetch: true, searchTimeoutMs: 60000 } }],
  skills: [
    { id: 'skill-filesystem', name: '@deepseek-ai/dsh-skill-filesystem' },
    { id: 'tool-skill', name: '@deepseek-ai/dsh-tool-skill' },
  ],
  todo: [{ id: 'tool-todo', name: '@deepseek-ai/dsh-tool-todo', config: { allowParallelInProgress: true } }],
  'ask-user': [{ id: 'tool-ask-user', name: '@deepseek-ai/dsh-tool-ask-user' }],
  present: [{ id: 'present', name: '@deepseek-ai/dsh-tool-present' }],
  goal: [
    { id: 'command-goal', name: '@deepseek-ai/dsh-command-goal' },
    { id: 'tool-goal', name: '@deepseek-ai/dsh-tool-goal' },
  ],
  schedule: [{ id: 'tool-schedule', name: '@deepseek-ai/dsh-tool-schedule' }],
}

/** Rows every preset needs, in the order the Agent manager writes them. */
const BASELINE_ROWS = [
  { id: 'agent-instructions', name: '@deepseek-ai/dsh-agent-instructions', config: { maxBytes: 65536 } },
  { id: 'time-context', name: '@deepseek-ai/dsh-time-context' },
  {
    id: 'compaction',
    name: 'cordis:group',
    group: true,
    isolate: { compaction: true, toolResultPruner: true },
    config: [
      { id: 'compaction-basic', name: '@deepseek-ai/dsh-compaction-basic' },
      { id: 'command-compact', name: '@deepseek-ai/dsh-command-compact' },
      {
        id: 'tool-result-pruner',
        name: '@deepseek-ai/dsh-compaction-tool-result-pruner',
        config: { thresholdChars: 8192, headChars: 4096, tailChars: 1024 },
      },
    ],
  },
]

/**
 * The delegation group, with `allowedAgentPresets` bound to `team`.
 *
 * This binding is the delegation whitelist: it is what `subagent`'s
 * `agent_preset` parameter will accept.
 */
function delegationRow(team) {
  return {
    id: 'delegation',
    name: 'cordis:group',
    group: true,
    isolate: { workflowEngine: true },
    config: [
      { id: 'tool-subagent-control', name: '@deepseek-ai/dsh-tool-subagent-control' },
      {
        id: 'tool-subagent',
        name: '@deepseek-ai/dsh-tool-subagent',
        config: {
          provider: 'spawn',
          toolName: 'subagent',
          modelSelection: true,
          modelDiscovery: true,
          ...(team.length > 0 ? { allowedAgentPresets: [...team] } : {}),
        },
      },
      {
        id: 'tool-subagent-fork',
        name: '@deepseek-ai/dsh-tool-subagent',
        config: { provider: 'fork', toolName: 'subagent_fork' },
      },
      { id: 'workflow-ptc', name: '@deepseek-ai/dsh-workflow-ptc', config: { provider: 'spawn' } },
      { id: 'tool-workflow', name: '@deepseek-ai/dsh-tool-workflow' },
    ],
  }
}

/**
 * Assemble a preset's plugin rows: baseline, the persona prompt, then one block
 * per capability. Unknown capability ids are skipped rather than throwing, so a
 * typo costs a tool, not the whole agent.
 *
 * @param {string} systemPrompt
 * @param {string[]} capabilities
 * @param {string[]} team
 */
export function buildRows(systemPrompt, capabilities, team) {
  const rows = [
    { id: 'persona', name: '@deepseek-ai/dsh-persona', config: { prefix: systemPrompt } },
    ...BASELINE_ROWS,
  ]

  for (const capability of capabilities) {
    if (capability === 'delegation') {
      // Only a coordinator gets this, and only with someone to delegate to.
      if (team.length > 0) rows.push(delegationRow(team))
      continue
    }
    const block = CAPABILITY_ROWS[capability]
    if (block === undefined) continue
    rows.push(...structuredClone(block))
  }

  return rows
}

/**
 * Read the roster: every preset installed under `presetsRoot`, excluding the
 * director itself.
 *
 * The host composes `allowedAgentPresets` statically, so this directory is the
 * only place a preset can be discovered. `agent.json` carries the `summary` the
 * director needs to pick well; a preset written by the Agent manager always has
 * one. When it does not, fall back to the locale title, then the id — a roster
 * row with no job description is worse than none, but still better than an
 * invisible agent.
 *
 * @param {string} presetsRoot
 * @returns {Array<{ id: string, name: string, description: string }>}
 */
export function readRoster(presetsRoot) {
  if (!existsSync(presetsRoot)) return []
  const rows = []
  for (const entry of readdirSync(presetsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const specFile = join(presetsRoot, entry.name, 'agent.json')
    if (!existsSync(specFile)) continue
    let spec
    try {
      spec = JSON.parse(readFileSync(specFile, 'utf8'))
    } catch {
      continue
    }
    const id = typeof spec.id === 'string' && spec.id !== '' ? spec.id : entry.name
    if (id === ORCHESTRATOR.id) continue
    const name = typeof spec.name === 'string' && spec.name !== '' ? spec.name : id
    // `summary` says what the agent does and cannot do; `description` only says
    // when to reach for it. The director needs the former to route by capability.
    const description =
      (typeof spec.summary === 'string' && spec.summary) ||
      (typeof spec.description === 'string' && spec.description) ||
      ''
    rows.push({ id, name, description })
  }
  return rows.sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * The coordinating agent.
 *
 * `team` is the whole roster, not just the OpenDesign domains: any preset the
 * user built in the Agent manager is a candidate too. That is the point — an
 * agent that cannot see the roster falls back to improvising a worker with
 * `agent_manager`, which is how a design task ended up staffed by a
 * hand-rolled researcher with no file tools.
 *
 * @param {{ roster?: Array<{ id: string, name: string, description: string }>, enabledIds?: readonly string[] }} [options]
 */
export function orchestratorSpec(options = {}) {
  const enabledIds = options.enabledIds ?? []
  const members = DOMAINS.filter((domain) => enabledIds.includes(domain.id))
  const roster = options.roster ?? []

  const domainLines =
    members.length === 0
      ? '（当前没有启用任何领域；提示用户用 `odx domains enable <id>` 打开需要的领域包）'
      : members
          .map((domain) => `- \`${domain.id}\`（${domain.name}）：${domain.description}`)
          .join('\n')

  const rosterLines =
    roster.length === 0
      ? '（磁盘上还没有任何可委派的 Agent 预设，只能自己完成）'
      : roster
          .map((row) => `- \`${row.id}\`（${row.name}）${row.description === '' ? '' : `：${row.description}`}`)
          .join('\n')

  const systemPrompt = [
    `你是 OpenDesign 的「${ORCHESTRATOR.name}」，负责把复合型设计需求拆开、派给合适的人、再把成品验收回来。`,
    '',
    '## 你的角色',
    '- 你是**调度者与验收者**。拆得准、派得对、把关得严，才是你的价值。',
    '- 你也是**兜底执行者**：小到「派出去比自己写更慢」的活，你自己做完即可。',
    '- 你**不做**「先自己创建一个代理再交给它」这种事。要委派，就从下面的花名册里挑一个现成的；没有合适的就自己做，不要临时创建。',
    '',
    '## 可委派的 Agent 预设（`subagent` 的 `agent_preset` 参数只能取这里的 id）',
    rosterLines,
    '',
    '## 技能领域（这些是技能索引，不是 Agent）',
    '领域包提供的是**技能**：它们在你或某个子 Agent 自己的会话里按需加载，不需要派给人。',
    domainLines,
    '',
    '## 怎么选人',
    '1. 先读花名册里每个人的描述：它写明了「能做 / 不能做」。按**任务需要的产出物**去匹配，不要按名字猜。',
    '2. 描述里明确说「不能做」的，不要派；换个能做的人，或者自己做。',
    '3. 没有合适的人时：自己做（你有 files / shell / skills），而不是临时创建一个新 Agent。',
    '4. 只有用户明确要求新建专用 Agent 时，才调用 `agent_manager`。',
    '',
    '## 工作流程',
    '1. **澄清**：复述目标、受众、交付物形态与硬约束；关键信息缺失时用 ask_user_question 一次问清。',
    '2. **落盘**：先想清楚成品长什么样（文件路径、验收标准），把它写进磁盘上的 brief，而不是写进对子 Agent 的口头描述。',
    '3. **派发**：用 `subagent`，`agent_preset` 选花名册里的人，`prompt` 只写「读哪个文件、产出哪个文件、怎么算合格」。',
    '4. **验收**：自己打开产物核对（尺寸、能否运行、有无占位符）。不合格就带具体问题退回，最多两轮。',
    '5. **汇报**：成果清单（含文件路径）、关键决策、已知局限与未完成项。',
    '',
    '## 迭代比新建便宜',
    '- 同一个子 Agent 已经做过这件活时，用 `send_message` 让它接着改；不要为每一轮修改重新派一个人。',
    '- 作品的中间状态留在磁盘上（脚本 + 产物），别指望子 Agent 记得上一轮说了什么。',
    '',
    '## 硬性要求',
    '- 不许虚构：没拿到证据（文件存在、命令输出、截图）就不要声称已完成。',
    '- 不许占位：任何交付物不得出现 `TODO` 或省略号代替实现。',
    '- 不许替用户碰界面：禁止模拟键鼠、禁止切换或点击用户的窗口。',
    '- 删除、覆盖、部署前必须先向用户确认。',
    '',
    '## 输出风格',
    '中文作答。先给结论与成果清单，再给细节。用清单和表格，不要长篇铺垫。',
  ].join('\n')

  const nameList = roster.length === 0 ? '无' : roster.map((row) => row.name).join('、')
  const team = roster.map((row) => row.id)

  return {
    id: ORCHESTRATOR.id,
    name: ORCHESTRATOR.name,
    description: '承接需要多种产出（视觉、动效、视频、演示、图文、前端、评审）的复合任务，拆解后派给本机已安装的合适 Agent，并验收汇总。',
    summary: `作为 OpenDesign 的设计总监，把复合需求拆成可执行子任务，从本机已安装的 Agent 花名册里挑人派活并验收。只做编排、把关与兜底，不替专家重做。可调度 ${String(roster.length)} 个已安装 Agent：${nameList}；另有 ${String(members.length)} 个技能领域可用。`,
    usage:
      '用它承接复合型设计项目。\n\n示例：\n1. 「做一个 SaaS 看板：先定视觉方向，再出可运行页面，最后配发布稿。」\n2. 「新品牌要一套物料：品牌视觉板 + 落地页 + 发布会幻灯片。」\n3. 「把这批截图做成一篇小红书图文。」',
    systemPrompt,
    capabilities: [...ORCHESTRATOR.capabilities],
    skills: [...ORCHESTRATOR.skills],
    team,
    rows: buildRows(systemPrompt, ORCHESTRATOR.capabilities, team),
  }
}

/**
 * A short SVG avatar, matching the style `agent_manager` writes.
 *
 * The hue is derived from the id so each agent gets a stable, distinct colour.
 */
function iconSvg(name, id) {
  let hue = 7
  for (const ch of id) hue = (hue * 31 + ch.codePointAt(0)) % 360
  const letter = (name.trim()[0] || id[0] || 'A').toUpperCase().replace(/[&<>"]/gu, '')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="hsl(${String(hue)} 55% 45%)"/><text x="32" y="43" font-family="Segoe UI,Arial,sans-serif" font-size="30" font-weight="700" text-anchor="middle" fill="#fff">${letter}</text></svg>\n`
}

/**
 * The files one preset directory holds.
 *
 * Mirrors `vyra-agent-manager`'s `writeBundle` (core.js:404) exactly, so a
 * preset built here is indistinguishable from one the Agent manager created.
 * `cordis.patch.yml` is JSON because JSON is valid YAML and the Loader parses
 * an entry list either way — that is what the Agent manager does too.
 *
 * @param {ReturnType<typeof domainAgentSpec>} spec
 * @returns {Record<string, string>}
 */
export function agentDirFiles(spec) {
  const meta = `${JSON.stringify({ meta: { title: spec.name, description: spec.description } }, null, 2)}\n`
  // `spec.rows` carries the real plugin list; falling back to an empty array
  // would produce an agent with no tools at all.
  const rows = Array.isArray(spec.rows) ? spec.rows : []
  const patch = [
    {
      insert: [
        {
          id: `preset-${spec.id}`,
          name: '@deepseek-ai/dsh-agent-preset',
          config: { id: spec.id, name: spec.name, description: spec.description, order: 100, plugins: rows },
        },
      ],
    },
  ]

  return {
    'agent.json': `${JSON.stringify(spec, null, 2)}\n`,
    'package.json': `${JSON.stringify(
      {
        name: `@local/agent-preset-${spec.id}`,
        version: '1.0.0',
        private: true,
        type: 'module',
        description: spec.description,
        exports: { './locale/*.json': './locale/*.json', './icon': './icon.svg' },
        files: ['cordis.patch.yml', 'locale/*.json', 'icon.svg', 'agent.json', 'README.md'],
        dsh: { bundle: { patch: './cordis.patch.yml' } },
      },
      null,
      2,
    )}\n`,
    'cordis.patch.yml': `${JSON.stringify(patch, null, 2)}\n`,
    'locale/en.json': meta,
    'locale/zh.json': meta,
    'icon.svg': iconSvg(spec.name, spec.id),
    'README.md': `# ${spec.name}\n\n${spec.description}\n\n## 模式说明\n\n${spec.summary}\n\n## 如何使用\n\n${spec.usage}\n`,
  }
}