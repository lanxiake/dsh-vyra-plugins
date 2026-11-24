/**
 * CLI turns for one session: prompts waiting their turn, the turn in flight, and
 * cancelling it. Only one turn runs at a time; steering sent mid-turn waits here and
 * runs as the next turn.
 * @module dsh-vyra-agent-cli-manager/session/turn-queue
 */
import type { ContentBlock as AcpContentBlock } from '@agentclientprotocol/sdk';
import type { AcpTransport, PromptOutcome } from '../transport.ts';
/** How a CLI turn ended. */
export type TurnEnd = (PromptOutcome & {
    readonly type: 'turn-end';
}) | {
    readonly type: 'failure';
    readonly error: Error;
};
/** User input waiting to be sent as a CLI turn. */
export interface QueuedPrompt {
    readonly ids: readonly string[];
    readonly blocks: readonly AcpContentBlock[];
}
/** Where a turn is sent. */
interface TurnTarget {
    readonly transport: AcpTransport;
    readonly acpSessionId: string;
}
/** What the queue needs from its session. */
export interface TurnHooks {
    /** @returns where to send a turn, or undefined while the session cannot take one. */
    readonly target: () => TurnTarget | undefined;
    /** A prompt is going out; its messages now count as sent. */
    readonly onSend: (prompt: QueuedPrompt) => void;
    /** A turn ended. A cancelled turn is not reported to the reader, who already left it. */
    readonly onEnd: (event: TurnEnd, wasCancelling: boolean) => void;
    /** A cancelled CLI did not finish its turn within the grace period. */
    readonly onCancelTimeout: () => void;
    /** How long a cancelled CLI may take to finish its turn before it is abandoned. */
    readonly cancelGraceMs: number;
}
/** The turn state machine of one CLI session. */
export declare class TurnQueue {
    private readonly hooks;
    private pending;
    private running;
    private stopping;
    private ended;
    /** Aborted when the CLI turn ends, which withdraws any question still on screen. */
    private lifetime;
    private cancelTimer;
    constructor(hooks: TurnHooks);
    /** Whether a CLI turn is in flight. */
    get active(): boolean;
    /** Whether the turn in flight has been asked to stop. */
    get cancelling(): boolean;
    /** Whether a turn is running or waiting. */
    get busy(): boolean;
    /** Ids of the user messages queued but not sent yet. */
    get queuedIds(): readonly string[];
    /** Aborted when the current turn ends. */
    get signal(): AbortSignal;
    /** @returns a promise that settles when the current turn ends. */
    untilEnded(): Promise<void>;
    enqueue(prompt: QueuedPrompt): void;
    clearPending(): void;
    /** Withdraw anything still asked within the current turn. */
    abortLifetime(): void;
    /**
     * Ask the CLI to stop the turn in flight.
     * @param sendCancel - sends `session/cancel` to the CLI.
     */
    beginCancel(sendCancel: () => void): void;
    end(event: TurnEnd): void;
    /** Send the next queued prompt if no turn is running and the session can take one. */
    pump(): void;
}
export {};
