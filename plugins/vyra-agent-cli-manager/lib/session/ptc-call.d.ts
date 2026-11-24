/**
 * Mirrored calls in a PTC session. That tool executor only accepts `run_code`, so a
 * mirrored call goes out as a `run_code` program that calls the mirror tool through
 * its SDK binding. The executor then runs the mirror tool under a nested call id,
 * `<outer call id>:ptc:<n>`, which leads back to the CLI call.
 * @module dsh-vyra-agent-cli-manager/session/ptc-call
 */
import type { ToolRecord } from '../tool-record.ts';
/** How to send a mirrored call in a PTC session. */
export interface PtcWrap {
    /**
     * The program's time budget. It covers the CLI running the tool and the user
     * answering its approval, so it is the runtime's longest allowed; omitted when
     * the runtime takes no deadline, where passing one fails the call.
     */
    readonly timeoutMs?: number;
}
/** A tool call as the harness stream carries it. */
export interface StreamToolCall {
    readonly id: string;
    readonly name: string;
    readonly arguments: string;
}
/**
 * Decide how mirrored calls go out under a PTC runtime.
 * @param runtime - the host's `ptcRuntime` service, read as untrusted input.
 * @returns the wrap, or undefined when the runtime cannot run the program written here.
 */
export declare function readPtcWrap(runtime: unknown): PtcWrap | undefined;
/**
 * Dress a mirrored call as a `run_code` call. It keeps the call id, so the nested id
 * the executor derives from it leads back to the CLI call.
 * @param record - the CLI call.
 * @param wrap - the session's PTC settings.
 * @returns the call to put on the stream.
 */
export declare function ptcCall(record: ToolRecord, wrap: PtcWrap): StreamToolCall;
/**
 * Read the outer call id from the id of a call nested in `run_code`.
 * @param callId - a call id from a tool execution.
 * @returns the outer id, or undefined when the call is not nested.
 */
export declare function mirroredCallId(callId: string): string | undefined;
