import { present, presentDeep, requireService } from '../core.js'

/**
 * The installed skills and the MCP server fleet: two inventories and the
 * recovery actions that belong with them.
 *
 * `skills` (`@deepseek-ai/dsh-skill/src/index.ts`) is the agent skill provider
 * registry. `list(options?)` is asynchronous and returns sorted
 * `SkillSummary[]`. A summary always carries `name`, `description`,
 * `invocation` (`{ modelInvocable, userInvocable }`), `source` and `provider`,
 * and optionally `path`, `whenToUse` and `resourceBase`. There is no `id` and
 * no display name beyond `name`; the optional three go through `present()` so
 * an unset one is omitted rather than emitted as `undefined`.
 *
 * `mcpManager` (`@deepseek-ai/dsh-mcp-manager/src/index.ts`) owns the running
 * MCP server instances. `list()` is synchronous and returns
 * `McpManagedServerView[]`, each `{ name, configured, status }`
 * (`@deepseek-ai/dsh-mcp-manager/src/types.ts`). `status` is a *union* of
 * variants that do not share their optional fields — `connected` carries
 * `toolCount`/`connectedAt` and no `lastError`; `reconnecting` and the
 * `failed` supervisor state carry `lastError` and no `toolCount`; `closed`
 * carries a `McpCloseResult`; `waiting-credentials` carries only `lastError`;
 * `disabled` carries nothing else. So this domain switches on `state` and
 * projects the fields that variant actually has, instead of reading them all
 * and emitting `undefined` for the half that does not apply.
 */
export async function catalogDomain(ctx, { action, args }) {
  if (action === 'skill.list') {
    const { service, missing } = requireService(ctx, 'skills', action)
    if (missing) return missing
    const skills = await service.list()
    return {
      status: 'ok',
      skills: skills.map((s) => present({
        name: s.name,
        description: s.description,
        path: s.path,
        whenToUse: s.whenToUse,
        invocation: s.invocation === undefined ? undefined : presentDeep(s.invocation),
        source: s.source,
        provider: s.provider,
        resourceBase: s.resourceBase === undefined ? undefined : presentDeep(s.resourceBase),
      })),
    }
  }

  // Validate before resolving the service, so a malformed call is reported as a
  // bad request rather than as a missing service. A call naming no server is
  // wrong whatever the profile holds.
  if (action === 'mcp.restart' || action === 'mcp.probe') {
    if (typeof args.name !== 'string' || args.name === '') {
      return { status: 'error', action, reason: `${action} needs a non-empty server name in name` }
    }
  }
  if (action === 'mcp.probe' && args.timeoutMs !== undefined
    && (typeof args.timeoutMs !== 'number' || !Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0)) {
    // The service's own resolveProbeOptions throws on a nonsensical budget,
    // which would escape the handler as an exception instead of a result.
    return { status: 'error', action, reason: 'mcp.probe needs timeoutMs to be a positive finite number of milliseconds' }
  }

  const { service, missing } = requireService(ctx, 'mcpManager', action)
  if (missing) return missing

  switch (action) {
    case 'mcp.list': {
      return {
        status: 'ok',
        servers: service.list().map((view) => ({
          ...present({
            name: view.name,
            configured: view.configured,
          }),
          ...serverState(view.status),
        })),
      }
    }
    case 'mcp.restart': {
      await service.restart(args.name)
      return { status: 'ok', name: args.name }
    }
    case 'mcp.probe': {
      // The outcome is a discriminated union: `McpProbeSuccess` has `ok: true`,
      // `serverInfo?`, `toolNames`, `truncated` and `durationMs`, while
      // `McpProbeFailure` has `ok: false`, `stage`, `message` and `durationMs`.
      // Neither carries the other's fields, so flattening the two into one
      // object would necessarily emit `undefined` keys — the exact shape the
      // tool pipeline's snapshot rejects. The whole result is therefore
      // forwarded under one key, cleaned deeply, with `ok` also lifted to the
      // top level so a caller can branch without descending.
      const probe = await service.probe(args.name, present({ timeoutMs: args.timeoutMs }))
      return { status: 'ok', name: args.name, ok: probe.ok, probe: presentDeep(probe) }
    }
    default:
      return { status: 'error', action, reason: `catalog domain has no action "${action}"` }
  }
}

/**
 * Project one `McpManagedServerStatus` variant onto its own fields, plus the
 * shared `state` token every variant carries.
 *
 * Switching on `state` is what keeps the result free of `undefined` keys: each
 * branch reads only the fields that branch's variant declares, so nothing is
 * padded in from a sibling variant. An unrecognised state still reports its
 * token, with the rest of the value cleaned deeply rather than guessed at.
 */
function serverState(status) {
  const state = status?.state
  switch (state) {
    case 'connected':
      return present({
        state,
        toolCount: status.toolCount,
        connectedAt: status.connectedAt,
      })
    case 'connecting':
      return present({ state, attempt: status.attempt })
    case 'reconnecting':
      return present({
        state,
        attempt: status.attempt,
        maxAttempts: status.maxAttempts,
        nextRetryAtMs: status.nextRetryAtMs,
        lastError: status.lastError,
      })
    case 'waiting-credentials':
      return present({ state, lastError: status.lastError })
    case 'closed':
      return present({
        state,
        close: status.result === undefined ? undefined : presentDeep(status.result),
      })
    case 'disabled':
      return { state }
    case 'failed':
      // Two different `failed` shapes reach here: the mcp-client supervisor
      // stop (`reason: 'gave-up' | 'reconnect-disabled' | 'unclosed-generation'`,
      // optional `lastError`) and the manager's own `load`/`cleanup` states.
      return present({
        state,
        reason: status.reason,
        lastError: status.lastError,
        // Only the manager's `cleanup` variant carries a close result.
        close: status.result === undefined ? undefined : presentDeep(status.result),
      })
    default:
      // An unrecognised state (a future variant, or a status the manager left
      // unset) still reports what it has, cleaned deeply. `state` is written
      // last so the spread can never replace the token with a service value —
      // the same ordering rule the action envelopes follow.
      return present({ ...presentDeep(status), state })
  }
}
