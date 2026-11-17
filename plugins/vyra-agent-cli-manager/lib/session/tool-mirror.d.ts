/**
 * The CLI's tool calls as the harness sees them: what each call has reported, which
 * ones were handed to the harness, which have a mirror tool waiting on them, and which
 * the harness is finished with.
 * @module vyra-agent-cli-manager/session/tool-mirror
 */
import type { ToolCallUpdate } from '@agentclientprotocol/sdk';
import type { ToolRecord } from '../tool-record.ts';
/** Construction inputs for a tool mirror. */
export interface ToolMirrorOptions {
    readonly mintCallId: () => string;
    /** How long a pending command's reports must stay quiet before it counts as started. */
    readonly settleMs: number;
    /** Told once per call when the harness should receive it as a tool call. */
    readonly onReady: (acpId: string) => void;
}
/** Tool-call bookkeeping for one CLI session. */
export declare class ToolMirror {
    private readonly options;
    private tools;
    /** Pending commands waiting for their reports to go quiet. */
    private settling;
    private callIds;
    /** Calls already announced through `onReady`; each is announced once. */
    private published;
    /** Calls the harness received as tool calls; their mirrors may or may not run. */
    private handedOff;
    /** Calls whose mirror is running right now. */
    private mirrors;
    /** Calls the harness is finished with; their late updates are ignored. */
    private claimed;
    private changeWaiters;
    constructor(options: ToolMirrorOptions);
    get(acpId: string): ToolRecord | undefined;
    /** A PTC session runs the mirror tool inside `run_code`, under an id nested in the call's own. */
    acpIdFor(callId: string): string | undefined;
    isClaimed(acpId: string): boolean;
    /** A call the CLI reports again, or asks permission for, is live once more. */
    reopen(acpId: string): void;
    handOff(acpId: string): void;
    startMirror(acpId: string): void;
    /** Calls handed to the harness whose mirror never started: denied by a policy or skipped by a stop. */
    skippedMirrors(): readonly string[];
    apply(update: ToolCallUpdate, permission: boolean): void;
    /**
     * A turn can end with calls still open. Their mirrors would otherwise wait forever,
     * so they finish as failed; an unpublished call is still published so the log shows
     * what the CLI attempted.
     */
    failOpen(): void;
    dropUnmirrored(): void;
    forget(acpId: string): void;
    /** @returns a promise that settles at the next change to any call. */
    nextChange(): Promise<void>;
    private publish;
    /**
     * claude-agent-acp goes from pending straight to completed, so a long command would show
     * nothing until it ended. Its input arrives over several updates with nothing marking the
     * end, so a command counts as started once they stop. Only commands, because a file write
     * reports its path and then goes quiet while its content is generated: showing it then
     * would freeze a card with no diff in it.
     */
    private publishOnceQuiet;
    private stopSettling;
    private notifyChange;
}
