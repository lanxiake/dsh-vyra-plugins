/**
 * Maps harness sessions to their live CLI sessions, and follows each session's log
 * to know where its turns begin and end. It holds no framework state, so `index.ts`
 * can stay plain wiring.
 * @module dsh-vyra-agent-cli-manager/session-registry
 */
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { ToolRunContext } from '@deepseek-ai/dsh-tools';
import type { ApprovalOutcome } from '@deepseek-ai/dsh-user-approval';
import type { CliSession, PermissionAsk } from './cli-session.ts';
import type { CliModeList } from './model-options.ts';
import type { PtcWrap } from './session/ptc-call.ts';
import type { ToolOutcome } from './tool-record.ts';
/** One CLI that speaks ACP over stdio. */
export interface CliAgentConfig {
    /** Names the provider route: `cli-<id>`. */
    id: string;
    /** Display name in menus and messages. */
    name: string;
    /** Executable to start. */
    command: string;
    /** Arguments that make it serve ACP on stdio. */
    args: string[];
    /** Added to the scrubbed environment; the place for this CLI's own credentials. */
    env: Record<string, string>;
}
/** What a new CLI session inherits from the one it replaces. */
export interface SessionStart {
    readonly sentMessageIds: ReadonlySet<string>;
    /** Settles once the previous process has stopped. */
    readonly after: Promise<void>;
    /** A native mode picked before this session existed, for the same CLI. */
    readonly initialMode?: string;
    /** Told when the CLI would not take that mode, so no replacement starts on it again. */
    readonly onModeRefused?: (mode: string) => void;
}
/** The harness facilities the registry uses. */
export interface RegistryDeps {
    getAgent(sessionId: string): Agent | undefined;
    /** The preset this agent runs under, if any. */
    composedPreset(agent: Agent): string | undefined;
    /** How the host's PTC runtime takes a mirrored call; undefined when it cannot. */
    ptcWrap(): PtcWrap | undefined;
    ask(agent: Agent, request: PermissionAsk, signal: AbortSignal): Promise<ApprovalOutcome>;
    warn(message: string): void;
    /** Someone chose this CLI, so starting it is now acceptable. */
    onCliSelected(provider: string): void;
    createSession(config: CliAgentConfig, sessionId: string, cwd: string, start: SessionStart): CliSession;
}
/** The fields of a session log event the registry reads. */
export interface ObservedEvent {
    readonly type: string;
    readonly data?: unknown;
}
/** Owns every live CLI session in this process. */
export declare class CliSessionRegistry {
    private readonly deps;
    private readonly agentsByProvider;
    private sessions;
    private stopping;
    private turnMessages;
    /** Native modes picked while their session had no CLI yet, by harness session. */
    private pickedModes;
    constructor(agents: readonly CliAgentConfig[], deps: RegistryDeps);
    /** Provider routes of all configured CLIs. */
    get providers(): readonly string[];
    /**
     * Read a route's display name.
     * @param provider - a provider route.
     * @returns the CLI's name, or undefined for any other route.
     */
    labelFor(provider: string): string | undefined;
    /**
     * Check whether a provider route is one of the configured CLIs.
     * @param provider - a provider route.
     * @returns whether it is.
     */
    isCliRoute(provider: string): boolean;
    /**
     * Read the CLI behind a route.
     * @param provider - a provider route.
     * @returns its configuration, if it is a CLI.
     */
    configFor(provider: string): CliAgentConfig | undefined;
    /**
     * Point an agent at the CLI its preset stands for. A preset whose id is a CLI route
     * selects that CLI, unless the session already chose one of its models. A session that
     * opens on a CLI counts as choosing it.
     * @param agent - the agent being announced or switched.
     */
    routeAgent(agent: Agent): void;
    /**
     * Follow one session log event. Tracking turns live is what keeps a prompt from
     * being sent twice: a failed turn leaves its message at the end of the history, and
     * only messages logged since the latest `turn/start` count as new. That holds across
     * a closed session, a replaced process, and a restart, with nothing extra to persist.
     * @param sessionId - the harness session.
     * @param event - the logged event.
     */
    observeEvent(sessionId: string, event: ObservedEvent): void;
    /**
     * Read which user messages belong to a session's open turn.
     * @param sessionId - the harness session.
     * @returns their ids; empty outside a turn.
     */
    currentTurnMessageIds(sessionId: string): ReadonlySet<string>;
    /**
     * Read the native modes a CLI reported for a session. A live CLI's own answer wins: it
     * may have changed mode during a turn, after the catalog last heard from it, and only it
     * knows whether a pick is still on its way.
     * @param sessionId - the harness session.
     * @param provider - the CLI route the menu is showing.
     * @returns the modes in the CLI's own ids and names, and a pick the CLI has not confirmed.
     */
    modeStateFor(sessionId: string, provider: string): {
        readonly modes?: CliModeList;
        readonly pending?: string;
    };
    /**
     * Switch a session to one of its CLI's own modes, by the id that CLI reported. A pick
     * made before the CLI started is kept and sent with its first step, and is what a
     * replacement session starts on.
     * @param sessionId - the harness session.
     * @param provider - the CLI route the menu is showing.
     * @param mode - the mode id, unchanged.
     * @returns the modes as the CLI reports them, or undefined while there is no CLI to ask.
     * @throws when the route is not a configured CLI, or the CLI refuses the change.
     */
    switchMode(sessionId: string, provider: string, mode: string): Promise<CliModeList | undefined>;
    /**
     * Decide whether a step's tool calls go out wrapped in `run_code`.
     * @param provider - the requested CLI route.
     * @param sessionId - the harness session.
     * @returns the wrap in PTC mode, otherwise undefined.
     * @throws when the PTC runtime cannot run the wrapping program: every mirrored call
     *   would be refused while the CLI carried on doing the work unseen.
     */
    ptcWrapFor(provider: string, sessionId: string): PtcWrap | undefined;
    /**
     * Find or create the CLI session for a harness session.
     * @param provider - the requested CLI route.
     * @param sessionId - the harness session.
     * @returns a CLI session; a dead one is returned until its failure has been read.
     */
    resolveSession(provider: string, sessionId: string): CliSession;
    /**
     * Wait for the CLI's result of one mirrored call. A CLI asks for permission only
     * when its own native mode says to; the bridge forwards that request unchanged and
     * never grants a call on the harness's behalf.
     * @param exec - the tool execution; its call id identifies the CLI call.
     * @returns the finished call's outcome.
     */
    waitForTool(exec: ToolRunContext): Promise<ToolOutcome>;
    /**
     * Forget a harness session and stop its CLI, if it has one.
     * @param sessionId - the harness session.
     */
    disposeSession(sessionId: string): void;
    /**
     * Stop every CLI.
     * @param reason - why, shown to any turn this cuts off.
     */
    disposeAll(reason?: string): void;
    private noticeSelection;
    /** A mode picked before the CLI started, if it was picked for this route. */
    private startMode;
    /** Drop a refused pick, unless the user has picked another since. */
    private forgetPick;
    private recordTurnMessage;
    /** Stop the process only; the harness session and its open turn carry on. */
    private stopSession;
}
