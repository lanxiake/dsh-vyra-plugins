/**
 * Presents CLIs to the harness as model providers, which puts them in the model
 * menu and lets the agent loop drive them without loop changes.
 * @module vyra-agent-cli-manager/adapter
 */
import { LlmAdapter, LlmError, resolveRetryPolicy } from '@deepseek-ai/dsh-llm';
export { DEFAULT_MODEL_ID } from "./constants.js";
/**
 * Larger than any real conversation. Compaction reads this as remaining room, so
 * it never starts on a history the CLI does not read, and declaring a value at
 * all keeps a model switch to this route from failing its pressure check.
 */
const CONTEXT_WINDOW = 1_000_000_000;
/** A retry would repeat a prompt the CLI may already have acted on. */
const NO_RETRY = resolveRetryPolicy({ mode: 'normal', maxRetries: 0 }, 'vyra-agent-cli-manager');
/** The experimental Auto preset's reviewer, served by an independent stateless route. */
const AUTO_REVIEW_PURPOSE = 'auto-review';
/** Routes harness model requests to CLI sessions. */
export class CliBridgeAdapter extends LlmAdapter {
    deps;
    constructor(deps) {
        super();
        this.deps = deps;
    }
    providerInfo(provider) {
        return { id: provider, name: this.deps.labelFor(provider) ?? provider };
    }
    providerRetryPolicy(_provider) {
        return NO_RETRY;
    }
    listModels(provider) {
        return Promise.resolve(this.deps.modelsFor(provider));
    }
    /** The harness checks a chosen reasoning level against what this returns, before streaming. */
    resolveModel(provider, model) {
        const reasoning = this.deps.reasoningFor(provider, model);
        return Promise.resolve({
            provider,
            id: model,
            name: this.deps.modelName(provider, model),
            context: { contextWindow: CONTEXT_WINDOW },
            ...(reasoning === undefined ? {} : { reasoning }),
        });
    }
    /**
     * Run one harness step on the session's CLI. Auxiliary requests expect a
     * stateless model, so the Auto reviewer is handed to a separate route; every
     * other purpose is still refused, since forwarding it here would inject it
     * into the user's real conversation.
     * @param options - the assembled request; only messages, session, model, reasoning level and signal apply.
     * @yields stream chunks from the CLI session or the reviewer route.
     */
    async *stream(options) {
        const { provider, model, reasoningEffort, sessionId, messages, signal, purpose } = options;
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- not in the current type, but other host versions may still send it
        if (purpose !== undefined) {
            if (String(purpose) !== AUTO_REVIEW_PURPOSE) {
                throw new LlmError(`CLI 会话不支持辅助模型请求（${String(purpose)}）。`, 'UNSUPPORTED_OPTION');
            }
            yield* this.deps.auxiliaryStream(options);
            return;
        }
        if (sessionId === undefined) {
            throw new LlmError('CLI 只能在会话里使用，不支持一次性模型请求。', 'UNSUPPORTED_OPTION');
        }
        // Read first, so a CLI that cannot run under this PTC runtime is never started.
        const ptc = this.deps.ptcWrapFor(provider, sessionId);
        const session = this.deps.resolveSession(provider, sessionId);
        yield* session.stream({
            messages,
            signal,
            model,
            ...(reasoningEffort === undefined ? {} : { reasoningEffort }),
            currentTurnMessageIds: this.deps.currentTurnMessageIds(sessionId),
            ...(ptc === undefined ? {} : { ptc }),
        });
    }
}
