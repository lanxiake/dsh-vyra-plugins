/**
 * Permission requests from the CLI that are still waiting for an answer.
 * @module vyra-agent-cli-manager/session/permission-queue
 */
import type { PermissionOption, RequestPermissionResponse } from '@agentclientprotocol/sdk';
import { CANCELLED } from '../permission.ts';
export { CANCELLED };
/** One CLI request blocked on a decision. */
export interface PendingPermission {
    readonly acpId: string;
    readonly options: readonly PermissionOption[];
    readonly resolve: (response: RequestPermissionResponse) => void;
}
/** Open permission requests, answered in the order the CLI asked. */
export declare class PermissionQueue {
    private open;
    add(permission: PendingPermission): void;
    /** @returns the oldest open request, removed from the queue. */
    takeNext(): PendingPermission | undefined;
    /** Answer every open request as cancelled. */
    cancelAll(): void;
    /** Refuse the open requests of one call, whose mirror will never ask the harness. */
    rejectFor(acpId: string): void;
}
