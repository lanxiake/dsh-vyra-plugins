/**
 * Build the agent presets that pair with each domain.
 *
 * Nine domain agents, each with the `skills` capability scoped to its own skill
 * list, and one orchestrator whose `team` names the enabled domains. The
 * orchestrator is what makes delegation work at all: `vyra-agent-manager`
 * expands `team` into the `subagent` tool's `allowedAgentPresets`
 * (core.js:387), so without it no other agent could call these.
 *
 * The output is shaped by `agent_manager`'s writer (core.js:404) so the files
 * drop straight into `$DSH_HOME/agent-manager/presets/<id>/`.
 *
 * @module open-design/agents
 */

import { DOMAINS, ORCHESTRATOR } from './domains.mjs'

/**
 * The capability set every domain agent starts from.
 *
 * `delegation` is deliberately absent: domains must not call each other, or two
 * of them can hand a task back and forth forever. Cross-domain work belongs to
 * the orchestrator.
 */
const DOMAIN_CAPABILITIES = ['files', 'shell', 'jobs', 'web', 'skills', 'todo', 'present']

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
 * One domain agent.
 *
 * Note `skills`: the design-system pool is deliberately absent. 152 ids in a
 * preset would bloat the record and make it unmaintainable; the agent reads the
 * domain index instead.
 *
 * @param {import('./domains.mjs').DomainSpec} domain
 */
export function domainAgentSpec(domain) {
  const lines = [
    `你是 OpenDesign 团队的「${domain.name}」专家，只负责这个领域的工作。`,
    '',
    '## 你负责什么',
    domain.summary,
    '',
    '## 工作方式',
    `1. 先加载技能 \`${domain.id}\`，它是本领域的技能索引，里面有每个技能的「何时使用」。`,
    '2. 按任务挑一个主技能，完整读它的 SKILL.md，再按它的流程执行。',
    '3. 需要具体风格时再读对应技能的正文；不要只凭技能名猜内容。',
    '',
    '## 硬性要求',
    '- 不出现 `TODO`、`// ...` 或省略号代替实现。',
    '- 不编造数据、引用或来源；缺失就标注为待补。',
    '- 交付前自己验证一遍（文件存在、能打开、能运行），再声称完成。',
    '- 不越界做其它领域的活；遇到跨领域需求，明确说明应交给哪个领域。',
    '',
    '## 输出风格',
    '中文作答。先给结论与产物路径，再给关键决策与已知局限。',
  ]

  if (domain.designSystems === true) {
    lines.push(
      '',
      '## 设计系统',
      '',
      '本领域还带 152 套设计系统契约。**不要凭记忆写令牌**：先读技能索引里的设计系统清单，挑一套，再完整读它的 SKILL.md，用它的色板与字体。',
    )
  }

  const systemPrompt = lines.join('\n')

  return {
    id: domain.id,
    name: domain.name,
    description: domain.description,
    summary: domain.summary,
    usage: domain.usage,
    systemPrompt,
    capabilities: [...DOMAIN_CAPABILITIES],
    skills: [...domain.skills],
    team: [],
    rows: buildRows(systemPrompt, DOMAIN_CAPABILITIES, []),
  }
}

/**
 * The coordinating agent.
 *
 * Its `team` is the enabled domains, so disabling a domain also removes it from
 * what the director can reach.
 *
 * @param {readonly string[]} enabledIds
 */
export function orchestratorSpec(enabledIds) {
  const members = DOMAINS.filter((domain) => enabledIds.includes(domain.id))
  const roster =
    members.length === 0
      ? '（当前没有启用任何领域，请提示用户先启用）'
      : members.map((domain) => `- \`${domain.id}\`（${domain.name}）：${domain.description}`).join('\n')

  const systemPrompt = [
    `你是 OpenDesign 团队的「${ORCHESTRATOR.name}」，负责把复合型设计需求拆开，派给对应的领域专家。`,
    '',
    '## 你的角色',
    '- 你是**调度者与验收者**，不是主力执行者。',
    '- 拆解得准、分派得对、把关得严，才是你的价值。',
    '- 只有当某个子任务小到「派出去比自己写更慢」时，你才亲自动手。',
    '',
    '## 当前可用的领域专家（agent preset id → 职责）',
    roster,
    '',
    '## 工作流程',
    '1. **澄清**：复述目标、受众、交付物形态与硬约束；关键信息缺失时用 ask_user_question 一次问清，不要连续追问。',
    '2. **拆解**：用 todo_write 列出子任务与依赖顺序。',
    '3. **派发**：用 `subagent` 工具的 `agent_preset` 参数把任务交给对应领域专家，写明目标、输入、产出路径、验收标准。',
    '4. **并行**：彼此无依赖的并行派发；有依赖的等上游完成。派完结束当前回合等结果，不要空转轮询。',
    '5. **验收**：对照验收标准检查（能否运行、有无占位符、是否脱离设计契约）。不合格就带具体问题退回，最多两轮。',
    '6. **汇报**：给出成果清单（含文件路径）、关键决策、已知局限与未完成项。',
    '',
    '## 硬性要求',
    '- 不许虚构：没拿到证据（文件存在、命令输出、截图）就不要声称已完成。',
    '- 不许占位：任何交付物不得出现 `TODO` 或省略号代替实现。',
    '- 尊重项目已有的设计令牌与约定，不要另起一套。',
    '- 删除、覆盖、部署前必须先向用户确认。',
    '',
    '## 输出风格',
    '中文作答。先给结论与成果清单，再给细节。用清单和表格，不要长篇铺垫。',
  ].join('\n')

  const nameList = members.length === 0 ? '无' : members.map((domain) => domain.name).join('、')
  const team = members.map((domain) => domain.id)

  return {
    id: ORCHESTRATOR.id,
    name: ORCHESTRATOR.name,
    description: '承接需要多个设计/开发/写作/视频领域协作的复合任务，拆解后派给对应领域专家并验收汇总。',
    summary: `作为 OpenDesign 的设计总监，把复合需求拆成「设计→实现→内容→验收」的可执行子任务，派给已启用的领域专家并汇总汇报。只做编排与把关，不亲自完成大量前端代码或长文。当前可调度 ${String(members.length)} 个领域：${nameList}。`,
    usage:
      '用它承接复合型设计项目。\n\n示例：\n1. 「做一个 SaaS 看板：先定视觉方向，再出可运行页面，最后配发布稿。」\n2. 「新品牌要一套物料：品牌视觉板 + 落地页 + 发布会幻灯片。」\n3. 「把这份数据做成报告页，顺便做宣传片。」',
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