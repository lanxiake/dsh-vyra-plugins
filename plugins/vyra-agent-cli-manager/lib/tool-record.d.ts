/**
 * Immutable fold over ACP tool-call updates, plus the projections the harness
 * needs from it: the durable `cli_tool` arguments and the final outcome.
 * @module vyra-agent-cli-manager/tool-record
 */
import type { ToolCallContent, ToolCallUpdate } from '@agentclientprotocol/sdk';
/** ACP tool-call lifecycle states. */
type ToolStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
/** One file change reported by the CLI; `oldText` is null for a new file. */
export interface CliFileDiff {
    readonly path: string;
    readonly oldText: string | null;
    readonly newText: string;
}
/** Everything the bridge knows about one CLI tool call so far. */
export interface ToolRecord {
    /** Id the CLI uses; unique only within that CLI session. */
    readonly acpId: string;
    /** Id written to the harness log; unique across the harness session. */
    readonly callId: string;
    readonly title: string;
    readonly kind: string;
    readonly status: ToolStatus;
    readonly rawInput?: unknown;
    readonly rawOutput?: unknown;
    readonly content: readonly ToolCallContent[];
    /**
     * Latest reported file changes. Kept apart from `content` because a CLI may
     * report a diff on the permission request and then replace `content` with a
     * text summary on completion, as OpenCode does.
     */
    readonly diffs: readonly CliFileDiff[];
    readonly locations: readonly string[];
    /** Whether the CLI is blocked on a permission answer for this call. */
    readonly permissionRequested: boolean;
}
/** Arguments recorded on the harness `tool/call` event. */
export interface CliToolArgs {
    readonly title: string;
    readonly kind: string;
    readonly command?: string;
    readonly input?: unknown;
    readonly diffs?: readonly CliFileDiff[];
    readonly locations?: readonly string[];
}
/** The final result of one CLI tool call. */
export interface ToolOutcome {
    readonly text: string;
    readonly failed: boolean;
    readonly diffs: readonly CliFileDiff[];
}
/**
 * Fold one ACP update into a tool record. ACP updates carry only the fields
 * that changed, so absent and null fields keep their earlier value.
 * @param previous - the record so far, or undefined for the first update.
 * @param update - the ACP `tool_call` or `tool_call_update` payload.
 * @param mintCallId - produces the harness call id; only invoked for a new record.
 * @returns a new record; `previous` is left unchanged.
 */
export declare function mergeToolUpdate(previous: ToolRecord | undefined, update: ToolCallUpdate, mintCallId: () => string): ToolRecord;
/**
 * Whether a call's arguments are final enough to record. A pending call may
 * still be streaming its input, and the harness log freezes arguments once.
 * @param record - the current record.
 * @returns true once the call runs, finishes, or blocks on permission.
 */
export declare function isReadyToPublish(record: ToolRecord): boolean;
/**
 * Whether the CLI has reported a terminal status.
 * @param record - the current record.
 * @returns true for `completed` and `failed`.
 */
export declare function isFinished(record: ToolRecord): boolean;
/**
 * Read the shell command a call runs.
 * @param record - the current record.
 * @returns the command, or undefined for another kind of call or one yet to report it.
 */
export declare function commandOf(record: ToolRecord): string | undefined;
/**
 * Build the arguments recorded for one call.
 * @param record - a record that is ready to publish.
 * @returns JSON-safe arguments, omitting everything the CLI did not report.
 */
export declare function toCliToolArgs(record: ToolRecord): CliToolArgs;
/**
 * Summarize a finished call.
 * @param record - a finished record.
 * @returns the text shown as the tool result, with any reported diffs.
 */
export declare function toolOutcome(record: ToolRecord): ToolOutcome;
/**
 * Describe a blocked call to the person deciding. The harness freezes tool arguments
 * before some CLIs report a diff, so this text is the only place they can see what
 * would be written.
 * @param record - the call waiting for permission.
 * @returns the title, plus the command or file contents when the CLI reported them.
 */
export declare function permissionReason(record: ToolRecord): string;
export {};
