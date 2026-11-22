/**
 * Runtime-shape adapter for the trusted-host list (personalization runtime
 * compat, 2026-10-17/18). DSH renamed the provision that carries
 * `trustedHosts` across runtime lines: web 0.2.0-rc.x serves it on
 * `webRuntime`; Desktop 0.2.1-rc.x serves it on `webStartup`. Routes
 * hard-depend on `webServer` only, so the list is resolved lazily per
 * request through the NON-THROWING `ctx.get(name)` lookup — property access
 * on a cordis context proxy throws for services outside `inject`
 * ("cannot get property ... without inject"), which `?.` chains cannot
 * guard (2026-10-18 hot-fix field capture). Every lookup failure degrades
 * to `[]` (loopback-only trust — never a mount failure).
 */
export function resolveTrustedHosts(ctx) {
  let startup, runtime;
  try {
    startup = ctx?.get?.("webStartup");
  } catch {}
  try {
    runtime = ctx?.get?.("webRuntime");
  } catch {}
  return startup?.trustedHosts ?? runtime?.trustedHosts ?? [];
}
