/**
 * Presents CLIs to the harness as model providers, which puts them in the model
 * menu and lets the agent loop drive them without loop changes.
 * @module dsh-vyra-agent-cli-manager/adapter
 */
import { LlmAdapter } from '@deepseek-ai/dsh-llm';
import type { GenerateOptions, LlmModelInfo, LlmModelReasoningInfo, LlmProviderInfo, LlmResolvedModelInfo, ResolvedRetryPolicy, StreamChunk } from '@deepseek-ai/dsh-llm';
import type { CliSession } from './cli-session.ts';
import type { PtcWrap } from './session/ptc-call.ts';
export { DEFAULT_MODEL_ID } from './constants.ts';
/** What the adapter needs from the bridge. */
export interface AdapterDeps {
    /** Display name for a provider route, or undefined when it is not a known CLI. */
    labelFor(provider: string): string | undefined;
    /** The live CLI session for a harness session; throws when it cannot run here. */
    resolveSession(provider: string, sessionId: string): CliSession;
    /** Set in a PTC session; throws when the CLI cannot run under its runtime. */
    ptcWrapFor(provider: string, sessionId: string): PtcWrap | undefined;
    /** Ids of the user messages in the session's open turn. */
    currentTurnMessageIds(sessionId: string): ReadonlySet<string>;
    /** The models to offer for a route. */
    modelsFor(provider: string): readonly LlmModelInfo[];
    /** The display name of one model. */
    modelName(provider: string, model: string): string;
    /** The reasoning levels of one model, if it offers any. */
    reasoningFor(provider: string, model: string): LlmModelReasoningInfo | undefined;
    /**
     * Serve one auto-review request on a stateless route instead of this CLI
     * conversation. Throws when no such route is available.
     */
    auxiliaryStream(options: GenerateOptions): AsyncIterable<StreamChunk>;
}
/** Routes harness model requests to CLI sessions. */
export declare class CliBridgeAdapter extends LlmAdapter {
    private readonly deps;
    constructor(deps: AdapterDeps);
    providerInfo(provider: string): LlmProviderInfo;
    providerRetryPolicy(_provider: string): ResolvedRetryPolicy;
    listModels(provider: string): Promise<readonly LlmModelInfo[]>;
    /** The harness checks a chosen reasoning level against what this returns, before streaming. */
    resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo>;
    /**
     * Run one harness step on the session's CLI. Auxiliary requests expect a
     * stateless model, so the Auto reviewer is handed to a separate route; every
     * other purpose is still refused, since forwarding it here would inject it
     * into the user's real conversation.
     * @param options - the assembled request; only messages, session, model, reasoning level and signal apply.
     * @yields stream chunks from the CLI session or the reviewer route.
     */
    stream(options: GenerateOptions): AsyncGenerator<StreamChunk>;
}
