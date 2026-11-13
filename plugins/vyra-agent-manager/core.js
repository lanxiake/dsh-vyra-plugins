import { mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { homedir } from 'node:os';

const RESERVED_IDS = new Set(['standard', 'ptc', 'minimal', 'cordis']);
const ID_RE = /^[a-z][a-z0-9-]{1,39}$/;
const POLICY_MODULE = 'vyra-agent-manager/tool-policy';

const dshHome = () => process.env.DSH_HOME || join(homedir(), '.dsh');
export const presetsRoot = () => join(dshHome(), 'agent-manager', 'presets');
const bundleName = (id) => `@local/agent-preset-${id}`;

function pathFor(id) {
  const root = resolve(presetsRoot());
  const dir = resolve(root, id);
  if (!dir.startsWith(root + sep)) throw new Error('Invalid agent id');
  return dir;
}

// ---------------------------------------------------------------------------
// Capability catalog. Rows mirror the shipped `standard` preset so a generated
// agent mounts exactly the same plugins; availability is checked against the
// live preset composition, not assumed.
// ---------------------------------------------------------------------------
function capabilityDefs(env) {
  const shellName = env.win ? '@deepseek-ai/dsh-tool-pwsh' : '@deepseek-ai/dsh-tool-bash';
  const shellId = env.win ? 'tool-pwsh' : 'tool-bash';
  const defs = [
    {
      id: 'files', label: '文件读写与搜索', group: '文件与命令', risk: 'write',
      description: '读取、创建、编辑文件，按文件名和内容搜索。',
      tools: ['read', 'write', 'edit', 'glob', 'grep'],
      rows: [
        { id: 'tool-fs', name: '@deepseek-ai/dsh-tool-fs', config: { applyPatch: false } },
        { id: 'tool-fs-search', name: '@deepseek-ai/dsh-tool-fs-search', config: { sampleOverCapGlobResults: false } },
      ],
    },
    {
      id: 'shell', label: env.win ? 'PowerShell 命令' : 'Shell 命令', group: '文件与命令', risk: 'exec',
      description: '在本机运行命令与脚本，可后台运行。',
      tools: [env.win ? 'pwsh' : 'bash'],
      rows: [{ id: shellId, name: shellName }],
    },
    {
      id: 'jobs', label: '后台任务', group: '文件与命令', risk: 'none',
      description: '查看、等待、终止后台运行的任务。',
      tools: ['job_list', 'job_output', 'job_kill'],
      rows: [{ id: 'tool-jobs', name: '@deepseek-ai/dsh-tool-jobs' }],
    },
    {
      id: 'web', label: '联网搜索与网页读取', group: '网络与信息', risk: 'none',
      description: '搜索互联网并读取网页内容。',
      tools: ['web_search', 'web_fetch'],
      rows: [{ id: 'tool-web', name: '@deepseek-ai/dsh-tool-web', config: { fetch: true, searchTimeoutMs: 60000 } }],
    },
    {
      id: 'skills', label: '技能', group: '网络与信息', risk: 'none',
      description: '可按需加载已安装的技能（SKILL.md）。',
      tools: ['skill'],
      rows: [
        { id: 'skill-filesystem', name: '@deepseek-ai/dsh-skill-filesystem' },
        { id: 'tool-skill', name: '@deepseek-ai/dsh-tool-skill' },
      ],
    },
    {
      id: 'delegation', label: '子 Agent 与工作流', group: '协作与自动化', risk: 'exec',
      description: '派生子 Agent 并行处理子任务，运行编排脚本。',
      tools: ['subagent', 'subagent_fork', 'workflow'],
      rows: [{
        id: 'delegation', name: 'cordis:group', group: true, isolate: { workflowEngine: true },
        config: [
          { id: 'tool-subagent-control', name: '@deepseek-ai/dsh-tool-subagent-control' },
          { id: 'tool-subagent', name: '@deepseek-ai/dsh-tool-subagent', config: { provider: 'spawn', toolName: 'subagent', modelSelection: true, modelDiscovery: true } },
          { id: 'tool-subagent-fork', name: '@deepseek-ai/dsh-tool-subagent', config: { provider: 'fork', toolName: 'subagent_fork' } },
          { id: 'workflow-ptc', name: '@deepseek-ai/dsh-workflow-ptc', config: { provider: 'spawn' } },
          { id: 'tool-workflow', name: '@deepseek-ai/dsh-tool-workflow' },
        ],
      }],
    },
    {
      id: 'schedule', label: '定时任务', group: '协作与自动化', risk: 'none',
      description: '创建、查看、修改定时提醒与计划任务。',
      tools: ['schedule_create', 'schedule_list', 'schedule_edit', 'schedule_view'],
      rows: [{ id: 'tool-schedule', name: '@deepseek-ai/dsh-tool-schedule' }],
    },
    {
      id: 'goal', label: '长期目标', group: '协作与自动化', risk: 'none',
      description: '创建持续推进的目标，并在多轮中自动继续。',
      tools: ['create_goal', 'get_goal', 'update_goal'],
      rows: [
        { id: 'command-goal', name: '@deepseek-ai/dsh-command-goal' },
        { id: 'tool-goal', name: '@deepseek-ai/dsh-tool-goal' },
      ],
    },
    {
      id: 'todo', label: '任务清单', group: '会话与交互', risk: 'none',
      description: '拆分多步骤工作并展示进度。',
      tools: ['todo_write'],
      rows: [{ id: 'tool-todo', name: '@deepseek-ai/dsh-tool-todo', config: { allowParallelInProgress: true } }],
    },
    {
      id: 'ask-user', label: '向用户提问', group: '会话与交互', risk: 'none',
      description: '遇到需要用户决定的事项时弹出选择题。',
      tools: ['ask_user_question'],
      rows: [{ id: 'tool-ask-user', name: '@deepseek-ai/dsh-tool-ask-user' }],
    },
    {
      id: 'present', label: '交付文件', group: '会话与交互', risk: 'none',
      description: '把生成的文档、图片等文件作为成果展示给用户。',
      tools: ['present'],
      rows: [{ id: 'present', name: '@deepseek-ai/dsh-tool-present' }],
    },
  ];
  if (env.hasProfile) {
    defs.push({
      id: 'plugin-manager', label: '插件管理', group: '扩展', risk: 'admin',
      description: '安装、启用、移除插件与 bundle，会改动整个 profile。',
      tools: ['plugin_manager'],
      rows: [{ id: 'tool-plugin-manager', name: '@deepseek-ai/dsh-plugin-manager/tools' }],
    });
  }
  return defs;
}

const BASELINE_ROWS = [
  { id: 'agent-instructions', name: '@deepseek-ai/dsh-agent-instructions', config: { maxBytes: 65536 } },
  { id: 'time-context', name: '@deepseek-ai/dsh-time-context' },
  {
    id: 'compaction', name: 'cordis:group', group: true, isolate: { compaction: true, toolResultPruner: true },
    config: [
      { id: 'compaction-basic', name: '@deepseek-ai/dsh-compaction-basic' },
      { id: 'command-compact', name: '@deepseek-ai/dsh-command-compact' },
      { id: 'tool-result-pruner', name: '@deepseek-ai/dsh-compaction-tool-result-pruner', config: { thresholdChars: 8192, headChars: 4096, tailChars: 1024 } },
    ],
  },
];

function flatModules(rows, out = new Set()) {
  for (const row of rows) {
    if (row.name && row.name !== 'cordis:group') out.add(row.name);
    if (Array.isArray(row.config) && row.group) flatModules(row.config, out);
  }
  return out;
}

function environment(ctx) {
  return { win: process.platform === 'win32', hasProfile: Boolean(ctx.get('profileContext')) };
}

export function createManager(ctx) {
  const log = (level, msg) => { try { ctx.logger[level]?.(msg); } catch { /* ignore */ } };

  async function liveModules() {
    try {
      const presets = ctx.get('agentPresets');
      const inventory = await presets?.compositionInventory?.();
      if (!inventory?.length) return null;
      const base = inventory.find((c) => c.id === 'standard') || inventory.find((c) => c.isDefault) || inventory[0];
      return new Set(base.rows.map((r) => r.moduleName));
    } catch (err) {
      log('warn', `agent-manager: composition inventory unavailable: ${err?.message || err}`);
      return null;
    }
  }

  function globalTools() {
    const tools = ctx.get('tools');
    if (!tools) return [];
    return tools.definitions().map((t) => ({ name: t.name, description: String(t.description || '').split('\n')[0].slice(0, 200) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const MCP_PREFIX = 'mcp__';
  // "mcp__mcp__app_get" -> server "mcp"; a name without a second "__" has no server and is ignored.
  function mcpServerOf(name) {
    if (!name.startsWith(MCP_PREFIX)) return '';
    const rest = name.slice(MCP_PREFIX.length);
    const cut = rest.indexOf('__');
    return cut > 0 ? rest.slice(0, cut) : '';
  }

  // MCP tools are plain global tools; group them by server so the editor can toggle a whole server.
  function mcpServers() {
    const byName = new Map();
    for (const t of globalTools()) {
      const server = mcpServerOf(t.name);
      if (!server) continue;
      if (!byName.has(server)) byName.set(server, []);
      byName.get(server).push(t.name);
    }
    return [...byName.entries()]
      .map(([name, list]) => ({ name, toolCount: list.length, tools: [...list].sort((a, b) => a.localeCompare(b)) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async function skillList() {
    const skills = ctx.get('skills');
    if (!skills) return [];
    try {
      const snap = await skills.snapshot({ signal: AbortSignal.timeout(5000) });
      const items = snap.skills ?? snap.items ?? snap;
      return (Array.isArray(items) ? items : []).map((s) => ({
        name: s.name, description: String(s.description || '').slice(0, 240), source: s.source,
      })).sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
      log('warn', `agent-manager: skills unavailable: ${err?.message || err}`);
      return [];
    }
  }

  async function meta() {
    const env = environment(ctx);
    const live = await liveModules();
    const capabilities = capabilityDefs(env).map((c) => {
      const mods = [...flatModules(c.rows)];
      const available = live ? mods.every((m) => live.has(m)) : true;
      const { rows, ...pub } = c;
      return { ...pub, available };
    });
    return { capabilities, tools: globalTools(), mcpServers: mcpServers(), skills: await skillList(), platform: process.platform };
  }

  async function readSpec(id) {
    const raw = await readFile(join(pathFor(id), 'agent.json'), 'utf8');
    return JSON.parse(raw);
  }

  async function listAgents() {
    const presets = ctx.get('agentPresets');
    const live = presets ? await presets.list() : [];
    const liveById = new Map(live.map((p) => [p.id, p]));
    const managed = [];
    let dirs = [];
    try { dirs = await readdir(presetsRoot(), { withFileTypes: true }); } catch { /* none yet */ }
    for (const d of dirs) {
      if (!d.isDirectory()) continue;
      try {
        const spec = await readSpec(d.name);
        const lp = liveById.get(spec.id);
        managed.push({ spec, installed: Boolean(lp), broken: lp?.broken || null });
      } catch { /* unreadable spec: skip */ }
    }
    const managedIds = new Set(managed.map((m) => m.spec.id));
    const system = live.filter((p) => !managedIds.has(p.id)).map((p) => ({
      id: p.id, name: p.name || p.id, description: p.description || '', broken: p.broken || null, shipped: RESERVED_IDS.has(p.id),
    }));
    managed.sort((a, b) => a.spec.name.localeCompare(b.spec.name));
    return { managed, system };
  }

  function normalize(input, caps, tools, presetIds, mcpNames) {
    const errors = [];
    const str = (v) => (typeof v === 'string' ? v.trim() : '');
    const spec = {
      id: str(input.id), name: str(input.name), description: str(input.description),
      summary: str(input.summary), usage: str(input.usage),
      systemPrompt: typeof input.systemPrompt === 'string' ? input.systemPrompt.trim() : '',
      capabilities: Array.isArray(input.capabilities) ? [...new Set(input.capabilities.map(String))] : [],
      denyTools: Array.isArray(input.denyTools) ? [...new Set(input.denyTools.map(String))] : [],
      denyMcp: Array.isArray(input.denyMcp) ? [...new Set(input.denyMcp.map(String))] : [],
      skills: Array.isArray(input.skills) ? [...new Set(input.skills.map(String))] : [],
      team: Array.isArray(input.team) ? [...new Set(input.team.map(String))] : [],
    };
    if (!ID_RE.test(spec.id)) errors.push('id 必须是 2-40 位小写字母/数字/连字符，且以字母开头（例如 code-reviewer）');
    if (RESERVED_IDS.has(spec.id)) errors.push(`id「${spec.id}」是系统预设，不能占用`);
    if (!spec.name) errors.push('name 不能为空');
    if (spec.name.length > 40) errors.push('name 不能超过 40 个字符');
    if (!spec.description) errors.push('description 不能为空：用一句话写清「何时应该使用这个 Agent」');
    if (spec.description.length > 300) errors.push('description 不能超过 300 个字符');
    if (!spec.summary) errors.push('summary 不能为空：说明这个模式做什么、能做什么、不能做什么');
    if (spec.summary.length > 600) errors.push('summary 不能超过 600 个字符');
    if (!spec.usage) errors.push('usage 不能为空：说明如何使用，并给出 1-3 个示例提问');
    if (spec.usage.length > 1200) errors.push('usage 不能超过 1200 个字符');
    if (!spec.systemPrompt) errors.push('systemPrompt 不能为空');
    if (spec.systemPrompt.length > 20000) errors.push('systemPrompt 不能超过 20000 个字符');
    if (/\{\{|\}\}/.test(spec.systemPrompt)) errors.push("systemPrompt 不能包含 '{{' 或 '}}'（提示词模板会尝试解析它们）");
    const capById = new Map(caps.map((c) => [c.id, c]));
    for (const c of spec.capabilities) {
      const def = capById.get(c);
      if (!def) errors.push(`未知能力「${c}」，可用：${caps.map((x) => x.id).join(', ')}`);
      else if (!def.available) errors.push(`能力「${c}」在当前环境不可用`);
    }
    if (spec.team.length) {
      if (!spec.capabilities.includes('delegation')) errors.push('team 需要同时开启 delegation 能力（团队靠子 Agent 委派工作）');
      for (const member of spec.team) {
        if (member === spec.id) errors.push('team 不能包含自己');
        else if (!presetIds.has(member)) errors.push(`team 成员「${member}」不存在，可用：${[...presetIds].join(', ')}`);
      }
    }
    const known = new Set(tools.map((t) => t.name));
    const warnings = [];
    spec.denyTools = spec.denyTools.filter((n) => {
      if (known.has(n)) return true;
      warnings.push(`已忽略未知的全局工具「${n}」`);
      return false;
    });
    spec.denyMcp = spec.denyMcp.filter((n) => {
      if (mcpNames.has(n)) return true;
      warnings.push(`已忽略未知的 MCP 服务「${n}」`);
      return false;
    });
    return { spec, errors, warnings };
  }

  function buildRows(spec, env) {
    const defs = capabilityDefs(env);
    const rows = [];
    const hint = spec.capabilities.includes('skills') && spec.skills.length
      ? `\n\n遇到相关任务时优先加载这些技能：${spec.skills.join('、')}。` : '';
    const teamHint = spec.team.length
      ? `\n\n你是团队协调者。可以通过 subagent 工具的 agent_preset 参数把子任务委派给这些成员：${spec.team.join('、')}。按各成员擅长的方向分工，汇总他们的结果后再回答用户。` : '';
    rows.push({ id: 'persona', name: '@deepseek-ai/dsh-persona', config: { prefix: spec.systemPrompt + hint + teamHint } });
    rows.push(...BASELINE_ROWS.slice(0, 1), ...BASELINE_ROWS.slice(1, 2));
    rows.push(BASELINE_ROWS[2]);
    for (const def of defs) {
      if (!spec.capabilities.includes(def.id)) continue;
      if (def.id === 'delegation' && spec.team.length) {
        // allowedAgentPresets makes the model's `subagent` tool accept agent_preset; only the spawn tool supports it.
        const copy = structuredClone(def.rows);
        copy[0].config.find((r) => r.id === 'tool-subagent').config.allowedAgentPresets = spec.team;
        rows.push(...copy);
      } else rows.push(...def.rows);
    }
    if (spec.denyTools.length || spec.denyMcp.length) {
      rows.push({ id: 'tool-policy', name: POLICY_MODULE, config: { deny: spec.denyTools, denyMcp: spec.denyMcp } });
    }
    return rows;
  }

  function iconSvg(name, id) {
    let h = 0;
    for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
    const letter = (name.trim()[0] || id[0] || 'A').toUpperCase().replace(/[&<>"]/g, '');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="hsl(${h} 55% 45%)"/><text x="32" y="43" font-family="Segoe UI,Arial,sans-serif" font-size="30" font-weight="700" text-anchor="middle" fill="#fff">${letter}</text></svg>\n`;
  }

  async function writeBundle(spec) {
    const env = environment(ctx);
    const dir = pathFor(spec.id);
    await mkdir(join(dir, 'locale'), { recursive: true });
    const pkg = {
      name: bundleName(spec.id), version: '1.0.0', private: true, type: 'module',
      description: spec.description,
      exports: { './locale/*.json': './locale/*.json', './icon': './icon.svg' },
      files: ['cordis.patch.yml', 'locale/*.json', 'icon.svg', 'agent.json', 'README.md'],
      dsh: { bundle: { patch: './cordis.patch.yml' } },
    };
    const patch = [{
      insert: [{
        id: `preset-${spec.id}`, name: '@deepseek-ai/dsh-agent-preset',
        config: { id: spec.id, name: spec.name, description: spec.description, order: 100, plugins: buildRows(spec, env) },
      }],
    }];
    const metaJson = JSON.stringify({ meta: { title: spec.name, description: spec.description } }, null, 2) + '\n';
    await writeFile(join(dir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
    // JSON is valid YAML; the Loader parses this file as a YAML entry list.
    await writeFile(join(dir, 'cordis.patch.yml'), JSON.stringify(patch, null, 2) + '\n');
    await writeFile(join(dir, 'locale', 'en.json'), metaJson);
    await writeFile(join(dir, 'locale', 'zh.json'), metaJson);
    await writeFile(join(dir, 'icon.svg'), iconSvg(spec.name, spec.id));
    await writeFile(join(dir, 'agent.json'), JSON.stringify(spec, null, 2) + '\n');
    await writeFile(join(dir, 'README.md'), `# ${spec.name}\n\n${spec.description}\n\n## 模式说明\n\n${spec.summary}\n\n## 如何使用\n\n${spec.usage}\n`);
    return dir;
  }

  function describeFailure(result) {
    const diag = result?.error?.diagnostic;
    const tail = result?.packageResult?.output ? String(result.packageResult.output).split('\n').slice(-6).join('\n') : '';
    return [result?.error?.code, diag, tail].filter(Boolean).join(' | ') || `application=${result?.application}`;
  }

  async function saveAgent(input, { create }) {
    const pm = ctx.get('pluginManager');
    if (!pm) throw new Error('pluginManager 服务不可用，无法安装 Agent');
    const m = await meta();
    const { managed, system } = await listAgents();
    const presetIds = new Set([...managed.map((a) => a.spec.id), ...system.map((p) => p.id)]);
    const { spec, errors, warnings } = normalize(input || {}, m.capabilities, m.tools, presetIds, new Set(m.mcpServers.map((s) => s.name)));
    if (errors.length) throw new Error(errors.join('；'));
    const isManaged = managed.some((a) => a.spec.id === spec.id);
    if (create && (isManaged || system.some((p) => p.id === spec.id))) throw new Error(`id「${spec.id}」已存在`);
    if (!create && !isManaged) throw new Error(`Agent「${spec.id}」不是由 Agent 管理器创建的，无法修改`);
    const dir = await writeBundle(spec);
    if (isManaged) {
      const removed = await pm.removeBundle(bundleName(spec.id));
      if (removed?.application === 'failed') throw new Error(`替换旧版本失败：${describeFailure(removed)}`);
    }
    const res = await pm.installBundle(dir, { enabled: true });
    if (res?.application !== 'applied') {
      if (res?.application === 'restart-required') warnings.push('需要重启 DSH 后才会出现在预设列表');
      else throw new Error(`安装失败：${describeFailure(res)}（配置已保存在 ${dir}，修正后可重试）`);
    }
    return { id: spec.id, application: res.application, dir, warnings, spec };
  }

  async function deleteAgent(id) {
    const { managed } = await listAgents();
    if (!managed.some((a) => a.spec.id === id)) throw new Error(`Agent「${id}」不是由 Agent 管理器创建的，不能删除`);
    const pm = ctx.get('pluginManager');
    if (!pm) throw new Error('pluginManager 服务不可用');
    const res = await pm.removeBundle(bundleName(id));
    if (res?.application === 'failed') throw new Error(`卸载失败：${describeFailure(res)}`);
    await rm(pathFor(id), { recursive: true, force: true });
    return { id };
  }

  async function getAgent(id) {
    const { managed, system } = await listAgents();
    const hit = managed.find((a) => a.spec.id === id);
    if (hit) return { managed: true, ...hit };
    const sys = system.find((p) => p.id === id);
    if (sys) {
      // Show the declared plugin list as read-only YAML (what the shipped Settings viewer shows),
      // instead of parsing it. The shape of readDocument's result is surfaced in readError if unexpected.
      const presets = ctx.get('agentPresets');
      let yaml = '';
      let readError = '';
      try {
        const doc = await presets.readDocument(id);
        yaml = typeof doc === 'string' ? doc : String(doc?.yaml ?? doc?.content ?? doc?.document ?? doc?.text ?? '');
        if (!yaml) readError = `readDocument 返回了无法识别的结构：${doc && typeof doc === 'object' ? Object.keys(doc).join(', ') : typeof doc}`;
      } catch (err) {
        readError = String(err?.message || err);
        log('warn', `agent-manager: readDocument(${id}) failed: ${readError}`);
      }
      const defs = capabilityDefs(environment(ctx));
      const capabilities = yaml ? defs.filter((d) => [...flatModules(d.rows)].every((m) => yaml.includes(m))).map((d) => d.id) : [];
      return { managed: false, preset: sys, yaml, readError, capabilities };
    }
    throw new Error(`没有找到 Agent「${id}」`);
  }

  return { meta, listAgents, getAgent, saveAgent, deleteAgent };
}
