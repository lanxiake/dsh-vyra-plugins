/**
 * The body of the mirror tool: wait for the CLI's result of one call, answering the
 * CLI's permission requests along the way.
 * @module dsh-vyra-agent-cli-manager/session/drive-tool
 */
import type { ApprovalOutcome } from '@deepseek-ai/dsh-user-approval';
import type { ToolOutcome } from '../tool-record.ts';
import type { PermissionQueue } from './permission-queue.ts';
import type { ToolMirror } from './tool-mirror.ts';
/** A question for the harness about a blocked CLI call. */
export interface PermissionAsk {
    /** What the person deciding needs to know. */
    readonly reason: string;
    /** The call's id in the harness log; absent when the call has no card to attach to yet. */
    readonly callId?: string;
}
/** Asks the harness whether a blocked CLI call may proceed. */
export type AskPermission = (request: PermissionAsk, signal: AbortSignal) => Promise<ApprovalOutcome>;
/** The session state a mirror works against. */
export interface DriveContext {
    readonly tools: ToolMirror;
    readonly permissions: PermissionQueue;
    /** CLI display name used in user-facing messages. */
    readonly label: string;
    /** Aborted when the current CLI turn ends, which withdraws any question still on screen. */
    readonly turnSignal: () => AbortSignal;
}
/** One mirrored call. */
export interface DrivenCall {
    readonly acpId: string;
    readonly callId: string;
}
/**
 * Wait until the call finishes. Every open permission request is answered, not only the
 * call's own: a parent call can be waiting on a child whose mirror cannot start until
 * this one returns.
 * @returns the finished call's outcome.
 */
export declare function driveTool(context: DriveContext, { acpId, callId }: DrivenCall, ask: AskPermission, signal: AbortSignal): Promise<ToolOutcome>;
