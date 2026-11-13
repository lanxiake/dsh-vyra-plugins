const DESCRIPTION = [
  'Create, inspect, update or delete reusable custom agents (agent presets) listed in the Agent Manager panel.',
  'Call action=catalog first: it lists the capability ids, global tools and skills that exist in this installation.',
  'create/update need: id (kebab-case, 2-40 chars, starts with a letter), name, description (one sentence saying WHEN to use this agent),',
  'summary (mode description shown to users: what this mode does, what it can and cannot do), usage (how to use it, with 1-3 example prompts),',
  'system_prompt (role, scope, working rules, output format; must not contain double curly braces), capabilities (ids from the catalog; grant the minimum the role needs).',
  'Optional: deny_tools (global tool names to hide from this agent), deny_mcp (MCP server names whose tools to hide), skills (skill names to prefer; needs the "skills" capability).',
  'A saved agent is selectable for NEW sessions; running sessions are unchanged. update replaces the whole spec, so send every field.',
].join(' ');

const stringArray = (description) => ({ type: 'array', items: { type: 'string' }, description });

export function createAgentTool(manager) {
  const parameters = {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['catalog', 'list', 'get', 'create', 'update', 'delete'] },
      id: { type: 'string', description: 'Agent id.' },
      name: { type: 'string' },
      description: { type: 'string', description: 'When to use this agent.' },
      summary: { type: 'string', description: 'Mode description: what this mode does, what it can and cannot do (max 600 chars).' },
      usage: { type: 'string', description: 'How to use this mode, with 1-3 example prompts (max 1200 chars).' },
      system_prompt: { type: 'string' },
      capabilities: stringArray('Capability ids from action=catalog.'),
      deny_tools: stringArray('Global tool names to hide from this agent.'),
      deny_mcp: stringArray('MCP server names (from action=catalog mcp_servers) whose tools should be hidden from this agent.'),
      skills: stringArray('Skill names this agent should prefer.'),
      team: stringArray('Member agent ids (from action=list) this agent can delegate to via subagent agent_preset. Makes it a team coordinator; needs the "delegation" capability.'),
    },
    required: ['action'],
    additionalProperties: false,
  };

  return {
    name: 'agent_manager',
    description: DESCRIPTION,
    parameters,
    timeoutMs: 180000,
    output: {
      schema: { type: 'object', properties: { status: { type: 'string' } }, required: ['status'] },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
      presentationMeta: (args, value) => ({ action: args?.action ?? '', status: value?.status ?? '' }),
    },
    async execute(args) {
      const a = args || {};
      const spec = () => ({
        id: a.id, name: a.name, description: a.description, summary: a.summary, usage: a.usage, systemPrompt: a.system_prompt,
        capabilities: a.capabilities ?? [], denyTools: a.deny_tools ?? [], denyMcp: a.deny_mcp ?? [], skills: a.skills ?? [], team: a.team ?? [],
      });
      switch (a.action) {
        case 'catalog': {
          const m = await manager.meta();
          return {
            status: 'ok',
            capabilities: m.capabilities.map(({ id, label, group, risk, description, tools, available }) => ({ id, label, group, risk, description, tools, available })),
            global_tools: m.tools.map((t) => t.name),
            mcp_servers: m.mcpServers.map((s) => ({ name: s.name, tool_count: s.toolCount })),
            skills: m.skills.map((s) => ({ name: s.name, description: s.description })),
          };
        }
        case 'list': {
          const l = await manager.listAgents();
          return {
            status: 'ok',
            managed: l.managed.map((x) => ({ id: x.spec.id, name: x.spec.name, description: x.spec.description, installed: x.installed })),
            system: l.system.map((x) => ({ id: x.id, name: x.name })),
          };
        }
        case 'get': {
          if (!a.id) throw new Error('get 需要 id');
          const r = await manager.getAgent(a.id);
          if (r.managed) return { status: 'ok', managed: true, spec: r.spec, installed: r.installed, broken: r.broken };
          return { status: 'ok', managed: false, preset: r.preset, capabilities: r.capabilities, read_error: r.readError || null, yaml: String(r.yaml || '').slice(0, 8000) };
        }
        case 'create':
        case 'update': {
          const r = await manager.saveAgent(spec(), { create: a.action === 'create' });
          return { status: 'ok', id: r.id, application: r.application, warnings: r.warnings, note: '新建会话时可选择该 Agent' };
        }
        case 'delete': {
          if (!a.id) throw new Error('delete 需要 id');
          return { status: 'ok', ...(await manager.deleteAgent(a.id)) };
        }
        default:
          throw new Error(`未知 action「${a.action}」`);
      }
    },
  };
}
