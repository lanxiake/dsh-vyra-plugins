/**
 * Maps a harness approval decision onto the options a CLI offered.
 * @module vyra-agent-cli-manager/permission
 */
import type { PermissionOption, RequestPermissionResponse } from '@agentclientprotocol/sdk';
import type { ApprovalOutcome } from '@deepseek-ai/dsh-user-approval';
/** The answer for a request nobody will decide on. */
export declare const CANCELLED: RequestPermissionResponse;
/**
 * Answer a CLI permission request. A harness approval covers one operation, so it
 * never selects `allow_always`: with no one-time option on offer, the safe answer is
 * no. `unavailable` means nobody could answer and is also a no, which fails closed.
 * @param outcome - the harness approval decision.
 * @param options - the options the CLI offered.
 * @returns the ACP response.
 */
export declare function permissionResponse(outcome: ApprovalOutcome, options: readonly PermissionOption[]): RequestPermissionResponse;
