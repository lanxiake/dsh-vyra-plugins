import { present, requireService } from '../core.js'

/**
 * Model discovery and selection over the Host's own services.
 *
 * `agentDefaultModel` (see `@deepseek-ai/dsh-agent-default-model/src/index.ts`)
 * owns the default selection an Agent is created with: `currentSelection()`
 * returns a detached `ModelSelection`, and `saveSelection(next)` persists one to
 * the profile. Neither touches the running session's own route, which is why
 * this domain can change the default without changing what is answering now.
 *
 * `ModelSelection` is `{ provider, model, reasoningEffort? }`
 * (`@deepseek-ai/dsh-agent/src/model-selection.ts`): `reasoningEffort` is
 * optional, so it is spread through `present()` and never emitted as
 * `undefined`.
 */
export async function modelDomain(ctx, { action, args }) {
  switch (action) {
    case 'model.list': {
      const { service, missing } = requireService(ctx, 'agentDefaultModel', action)
      if (missing) return missing
      const current = service.currentSelection()
      // `llm` is a separate, optional service: a profile can hold a default
      // selection without any provider adapter registered. `listProviders()` is
      // synchronous and returns detached `{ id, name }` metadata.
      const llm = ctx.get('llm')
      const providers = llm ? llm.listProviders().map(({ id, name }) => ({ id, name })) : []
      return {
        status: 'ok',
        current: present({
          provider: current.provider,
          model: current.model,
          reasoningEffort: current.reasoningEffort,
        }),
        providers,
      }
    }
    case 'model.select': {
      // Validate before resolving the service, so a malformed call is reported
      // as a bad request rather than as a missing service.
      if (typeof args.provider !== 'string' || args.provider === '') {
        return { status: 'error', action, reason: 'model.select needs a non-empty provider string' }
      }
      if (typeof args.model !== 'string' || args.model === '') {
        return { status: 'error', action, reason: 'model.select needs a non-empty model string' }
      }
      const { service, missing } = requireService(ctx, 'agentDefaultModel', action)
      if (missing) return missing
      const next = present({
        provider: args.provider,
        model: args.model,
        reasoningEffort: typeof args.reasoningEffort === 'string' && args.reasoningEffort !== ''
          ? args.reasoningEffort
          : undefined,
      })
      await service.saveSelection(next)
      const current = service.currentSelection()
      return {
        status: 'ok',
        current: present({
          provider: current.provider,
          model: current.model,
          reasoningEffort: current.reasoningEffort,
        }),
      }
    }
    default:
      return { status: 'error', action, reason: `model domain has no action "${action}"` }
  }
}
