/**
 * Reading one harness step out of a CLI turn: text and reasoning stream through, and the
 * step ends at the next tool call or at the end of the turn.
 * @module dsh-vyra-agent-cli-manager/session/read-step
 */
import type { LlmError, StreamChunk } from '@deepseek-ai/dsh-llm';
import type { ToolRecord } from '../tool-record.ts';
import type { ReplayFields } from './outcomes.ts';
import type { PtcWrap } from './ptc-call.ts';
import type { SessionEvent } from './types.ts';
/** What reading a step needs from its session. */
export interface StepSource {
    /** CLI display name used in user-facing messages. */
    readonly label: string;
    /** @returns the next event; a failed or aborted wait abandons the turn. */
    readonly nextEvent: (signal: AbortSignal | undefined) => Promise<SessionEvent>;
    /** Whether a turn is running or waiting, or events are still unread. */
    readonly hasWork: () => boolean;
    /** Whether this dead session holds user input it can no longer deliver. */
    readonly owesInput: () => boolean;
    readonly failure: () => LlmError | undefined;
    /** @returns the call to hand to the harness, marked as handed off; undefined if it is gone. */
    readonly handOff: (acpId: string) => ToolRecord | undefined;
    readonly replay: () => ReplayFields;
    /** Set when this step runs in a PTC session. */
    readonly ptc?: PtcWrap;
}
/**
 * Read until the next tool call or the end of the CLI turn.
 * @param source - the session being read.
 * @param signal - cancellation; aborting abandons the turn.
 * @yields the step's stream chunks, ending with `finish`.
 */
export declare function readStep(source: StepSource, signal: AbortSignal | undefined): AsyncGenerator<StreamChunk>;
