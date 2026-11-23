import { createManager } from './core.js';
import { createAgentTool } from './tool.js';

export const inject = ['tools'];

/** The skill an AI-driven create/edit turn loads before touching the tool. */
const BUILDER_SKILL = `# Agent Builder

Use the \`agent_manager\` tool to author or revise a DSH agent preset. Never edit \`~/.dsh/agent-manager\` files directly.

## Workflow
1. Call \`agent_manager({ action: "catalog" })\` to read the capability ids, global tool names, MCP servers and installed skills that actually exist here.
2. Draft the complete spec (an \`update\` replaces every field, so always send the whole spec).
3. Call \`agent_manager({ action: "preview", ...spec })\` and fix every returned error and warning before saving.
4. Call \`create\` (new id) or \`update\` (existing managed id).
5. Report the id, the capabilities granted and any warning the save returned.

## Rules
- \`id\`: 2-40 lowercase letters/digits/hyphens, starts with a letter; never a system id (standard, ptc, minimal, cordis).
- \`description\`: one sentence saying WHEN to use this agent.
- \`summary\`: what this mode does, what it is good at, and its limits (users read this).
- \`usage\`: how to use it plus 1-3 example prompts.
- \`system_prompt\`: role, duties, working style, boundaries and output format. It replaces the default persona; do not use double curly braces.
- \`capabilities\`: grant the minimum the role needs. \`skills\` requires the "skills" capability; \`team\` requires "delegation".
- \`deny_tools\` / \`deny_mcp\`: only names present in the catalog; they hide tools from this agent.
- \`skills\`: skill names from the catalog; they are appended to the persona hint and must be relevant.
- \`team\`: existing managed/system agent ids this agent may delegate to through \`subagent agent_preset\`.

## Output
After a successful save, state: the id, whether it is ready for new sessions, and the warnings (restart / pending build) if any.
`;

const SKILL_NAME = 'agent-builder';

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

export function apply(ctx) {
  const manager = createManager(ctx);

  // One operation set, two callers: the panel (RPC below) and the main agent (tool).
  ctx.tools.register(createAgentTool(manager));

  // An AI turn can load this skill instead of guessing the schema. Optional:
  // a minimal composition without the skill registry still gets the tool.
  ctx.inject(['skills'], (owner) => {
    owner.effect(() => owner.skills.register({
      name: SKILL_NAME,
      description: 'Author or revise a DSH Agent preset through the agent_manager tool: catalog, draft, preview, save.',
      content: BUILDER_SKILL,
    }), 'agent-manager: builder skill');
  });

  async function dispatch(body) {
    switch (String(body.op || '')) {
      case 'meta': return manager.meta();
      case 'agents': return manager.listAgents();
      case 'get': return manager.getAgent(String(body.id || ''));
      case 'save': return manager.saveAgent(body.agent, { create: Boolean(body.create) });
      case 'delete': return manager.deleteAgent(String(body.id || ''));
      case 'preview': return manager.previewAgent(body.agent || {});
      case 'stats': return manager.stats();
      default: throw new Error(`unknown operation "${body.op}"`);
    }
  }

  // webServer binds its port during its own init, so this plugin can apply before the service
  // exists. Asking for it through inject registers the endpoint now when it is ready and as soon
  // as it appears otherwise; reading ctx.get('webServer') here and returning on undefined left the
  // panel with no endpoint for the rest of the process (its first RPC fell through to the
  // Connection prefix route and came back as "not found" instead of JSON).
  ctx.inject(['webServer'], (owner) => {
    owner.effect(() => owner.webServer.register({
      kind: 'exact',
      path: '/api/agent-manager/rpc',
      handler: async (req, res) => {
        let payload;
        try {
          payload = { ok: true, ...(await dispatch(await readJson(req))) };
        } catch (err) {
          payload = { ok: false, error: String(err?.message || err) };
        }
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        res.end(JSON.stringify(payload));
      },
    }), 'agent-manager.route');
  });
}
