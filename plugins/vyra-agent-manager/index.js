import { createManager } from './core.js';
import { createAgentTool } from './tool.js';

export const inject = ['tools'];

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

  async function dispatch(body) {
    switch (String(body.op || '')) {
      case 'meta': return manager.meta();
      case 'agents': return manager.listAgents();
      case 'get': return manager.getAgent(String(body.id || ''));
      case 'save': return manager.saveAgent(body.agent, { create: Boolean(body.create) });
      case 'delete': return manager.deleteAgent(String(body.id || ''));
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
