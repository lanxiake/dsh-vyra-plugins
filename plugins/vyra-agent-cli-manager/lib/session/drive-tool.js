/**
 * The body of the mirror tool: wait for the CLI's result of one call, answering the
 * CLI's permission requests along the way.
 * @module dsh-vyra-agent-cli-manager/session/drive-tool
 */
import { abortable } from "../abortable.js";
import { permissionResponse } from "../permission.js";
import { isFinished, permissionReason, toolOutcome } from "../tool-record.js";
/**
 * Wait until the call finishes. Every open permission request is answered, not only the
 * call's own: a parent call can be waiting on a child whose mirror cannot start until
 * this one returns.
 * @returns the finished call's outcome.
 */
export async function driveTool(context, { acpId, callId }, ask, signal) {
    for (;;) {
        signal.throwIfAborted();
        const permission = context.permissions.takeNext();
        if (permission !== undefined) {
            const ownCallId = permission.acpId === acpId ? callId : undefined;
            await answerPermission(context, permission, { callId: ownCallId, ask, signal });
            continue;
        }
        const record = context.tools.get(acpId);
        if (isFinished(record))
            return toolOutcome(record);
        await abortable(context.tools.nextChange(), signal);
    }
}
async function answerPermission({ tools, label, turnSignal }, permission, { callId, ask, signal }) {
    const record = tools.get(permission.acpId);
    const reason = record === undefined ? `${label} 请求执行一个操作。` : permissionReason(record);
    const askSignal = AbortSignal.any([signal, turnSignal()]);
    // A failing approval service must not leave the CLI blocked; `unavailable` rejects.
    const outcome = await ask({ reason, ...(callId === undefined ? {} : { callId }) }, askSignal).catch(() => 'unavailable');
    permission.resolve(permissionResponse(outcome, permission.options));
}
