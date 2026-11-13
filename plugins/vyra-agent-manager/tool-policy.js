// Preset-mountable plugin: hides selected global tools from this agent only.
export const inject = ['tools'];

export function apply(ctx, config) {
  const deny = Array.isArray(config?.deny) ? config.deny.map(String) : [];
  const denyMcp = Array.isArray(config?.denyMcp) ? config.denyMcp.map(String) : [];
  if (!deny.length && !denyMcp.length) return;
  const prefixes = denyMcp.map((s) => `mcp__${s}__`);
  const known = new Set(ctx.tools.definitions().map((d) => d.name));
  // restrict() throws on unknown names, so only names that exist right now may be passed through.
  const names = [...new Set([
    ...deny.filter((n) => known.has(n)),
    ...[...known].filter((n) => prefixes.some((p) => n.startsWith(p))),
  ])];
  if (!names.length) return;
  ctx.effect(() => {
    try {
      return ctx.tools.restrict({ deny: names });
    } catch (err) {
      ctx.logger.warn(`tool-policy: restriction not applied: ${err?.message || err}`);
      return () => {};
    }
  }, 'agent-manager.tool-policy');
}
