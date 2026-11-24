/**
 * Permission requests from the CLI that are still waiting for an answer.
 * @module dsh-vyra-agent-cli-manager/session/permission-queue
 */
import { CANCELLED, permissionResponse } from "../permission.js";
export { CANCELLED };
/** Open permission requests, answered in the order the CLI asked. */
export class PermissionQueue {
    open = [];
    add(permission) {
        this.open = [...this.open, permission];
    }
    /** @returns the oldest open request, removed from the queue. */
    takeNext() {
        const [next, ...rest] = this.open;
        this.open = rest;
        return next;
    }
    /** Answer every open request as cancelled. */
    cancelAll() {
        const open = this.open;
        this.open = [];
        for (const permission of open)
            permission.resolve(CANCELLED);
    }
    /** Refuse the open requests of one call, whose mirror will never ask the harness. */
    rejectFor(acpId) {
        const own = this.open.filter((permission) => permission.acpId === acpId);
        this.open = this.open.filter((permission) => permission.acpId !== acpId);
        for (const permission of own)
            permission.resolve(permissionResponse('rejected', permission.options));
    }
}
