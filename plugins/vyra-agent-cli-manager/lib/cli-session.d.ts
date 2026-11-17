/**
 * One harness session's live CLI session. The harness thinks in steps, each one
 * model request plus its tools; a CLI thinks in turns that run many tools before
 * `session/prompt` returns. This class holds a CLI turn open across harness steps:
 * a step ends at every tool call, the mirror tool waits for the CLI's result, and
 * the next step resumes reading the same turn.
 * @module vyra-agent-cli-manager/cli-session
 */
import type { StreamChunk } from '@deepseek-ai/dsh-llm';
import type { CliModeList } from './model-options.ts';
import type { AskPermission } from './session/drive-tool.ts';
import type { CliSessionOptions, StreamRequest } from './session/types.ts';
import type { ToolOutcome } from './tool-record.ts';
export type { AskPermission, PermissionAsk } from './session/drive-tool.ts';
export type { CliSessionOptions, StreamRequest } from './session/types.ts';
/** Live bridge between one harness session and one CLI session. */
export declare class CliSession {
    private readonly options;
    private readonly events;
    private readonly label;
    private readonly startTimeoutMs;
    private readonly tools;
    private readonly permissions;
    private readonly model;
    private readonly effort;
    private readonly mode;
    private readonly turns;
    private seen;
    private transport;
    private started;
    private acpSessionId;
    /** Whether the CLI declared image support when it connected. */
    private acceptsImages;
    /** The CLI cannot see this conversation, and the user has not been told yet. */
    private owesFreshNotice;
    private failure;
    private disposeRequested;
    /** This dead session holds user input it can no longer deliver. */
    private owesInput;
    /** Levels the CLI reported, by model, not yet passed on; see `onEfforts`. */
    private heldEfforts;
    constructor(options: CliSessionOptions);
    /** Whether this session can no longer run turns. */
    get dead(): boolean;
    /**
     * Whether a dead session can be replaced. While its failure is unread it stays,
     * so the next step reports why the CLI died instead of quietly starting another.
     */
    get replaceable(): boolean;
    /** Ids of the user messages this session or its predecessors sent to a CLI. */
    get sentMessageIds(): ReadonlySet<string>;
    /** The CLI's own modes, exactly as it last reported them. */
    get modes(): CliModeList | undefined;
    /** A mode the user picked that the CLI has not confirmed yet. */
    get pendingMode(): string | undefined;
    /**
     * Switch the CLI to one of its own modes, by the id the CLI itself reported. Before the
     * CLI has started there is nothing to change, so the pick waits for the first step.
     * @param mode - the mode id, unchanged.
     * @param signal - cancellation for the wait.
     * @returns the modes as the CLI now reports them, or the known list when it has not started.
     * @throws when the CLI never offered that mode, or refuses the change.
     */
    switchMode(mode: string, signal?: AbortSignal): Promise<CliModeList | undefined>;
    /**
     * Run one harness step: send any new user input, then read until the next tool
     * call or the end of the CLI turn.
     * @param request - the derived history and cancellation for this step.
     * @yields the step's stream chunks, ending with `finish`.
     */
    stream(request: StreamRequest): AsyncGenerator<StreamChunk>;
    /**
     * Wait for the CLI's result of a published call. This is the body of the mirror
     * tool. It answers every open permission request, not only its own: a parent call
     * can be waiting on a child whose mirror cannot start until this one returns.
     * @param callId - the call id from the harness log.
     * @param ask - asks the harness about a blocked call.
     * @param signal - cancellation; aborting abandons the CLI turn.
     * @returns the finished call's outcome.
     */
    waitForTool(callId: string, ask: AskPermission, signal?: AbortSignal): Promise<ToolOutcome>;
    /**
     * Stop whatever the CLI is doing for a harness turn that is over. The harness can
     * end a turn between steps, when no stream or mirror is there to notice, so this
     * is driven by the end of the harness turn. It does nothing on an idle session.
     */
    abandonTurn(): void;
    /**
     * Stop the CLI process and fail anything still waiting on it.
     * @param force - skip the wait for the CLI to exit by itself.
     * @param reason - why it is being stopped, shown to a turn it cuts off.
     */
    dispose(force?: boolean, reason?: string): Promise<void>;
    private prepareStep;
    private promptBlocks;
    /** The model goes first: switching it can change which reasoning levels exist. */
    private applySelection;
    /**
     * Every report of the CLI's options passes through the model state, and lands here. Only a
     * new session's modes go to the catalog: it speaks for sessions with no CLI yet, which start
     * where a new process does, not where this one was switched to.
     */
    private noteOptions;
    private releaseEfforts;
    /** Steering still in the queue is not sent yet, but must not be queued a second time. */
    private unsentInput;
    private ensureStarted;
    private connectInTime;
    private connect;
    private pushFreshSessionNotice;
    private handleUpdate;
    private handlePermission;
    private handleClosed;
    private settleFailure;
    /**
     * A mirror can be denied by a policy or skipped by a stop before it runs, leaving
     * the CLI blocked on an answer nobody would give. By the next step the harness has
     * finished with the call, so a request still open for it is refused.
     */
    private rejectSkippedMirrors;
    private hasWork;
    private replayFields;
    private readStep;
    private nextEvent;
}
