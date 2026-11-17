/**
 * The CLI's tool calls as the harness sees them: what each call has reported, which
 * ones were handed to the harness, which have a mirror tool waiting on them, and which
 * the harness is finished with.
 * @module vyra-agent-cli-manager/session/tool-mirror
 */
import { commandOf, isFinished, isReadyToPublish, mergeToolUpdate } from "../tool-record.js";
import { mirroredCallId } from "./ptc-call.js";
const INTERRUPTED_OUTPUT = 'CLI 在这个工具完成之前结束了本轮。';
/** Tool-call bookkeeping for one CLI session. */
export class ToolMirror {
    options;
    tools = new Map();
    /** Pending commands waiting for their reports to go quiet. */
    settling = new Map();
    callIds = new Map();
    /** Calls already announced through `onReady`; each is announced once. */
    published = new Set();
    /** Calls the harness received as tool calls; their mirrors may or may not run. */
    handedOff = new Set();
    /** Calls whose mirror is running right now. */
    mirrors = new Set();
    /** Calls the harness is finished with; their late updates are ignored. */
    claimed = new Set();
    changeWaiters = [];
    constructor(options) {
        this.options = options;
    }
    get(acpId) {
        return this.tools.get(acpId);
    }
    /** A PTC session runs the mirror tool inside `run_code`, under an id nested in the call's own. */
    acpIdFor(callId) {
        const direct = this.callIds.get(callId);
        if (direct !== undefined)
            return direct;
        const outer = mirroredCallId(callId);
        return outer === undefined ? undefined : this.callIds.get(outer);
    }
    isClaimed(acpId) {
        return this.claimed.has(acpId);
    }
    /** A call the CLI reports again, or asks permission for, is live once more. */
    reopen(acpId) {
        this.claimed = new Set([...this.claimed].filter((id) => id !== acpId));
    }
    handOff(acpId) {
        this.handedOff = new Set([...this.handedOff, acpId]);
    }
    startMirror(acpId) {
        this.mirrors = new Set([...this.mirrors, acpId]);
    }
    /** Calls handed to the harness whose mirror never started: denied by a policy or skipped by a stop. */
    skippedMirrors() {
        return [...this.handedOff].filter((acpId) => !this.mirrors.has(acpId));
    }
    apply(update, permission) {
        const merged = mergeToolUpdate(this.tools.get(update.toolCallId), update, this.options.mintCallId);
        const record = permission ? { ...merged, permissionRequested: true } : merged;
        this.tools = new Map([...this.tools, [record.acpId, record]]);
        this.callIds = new Map([...this.callIds, [record.callId, record.acpId]]);
        if (isReadyToPublish(record))
            this.publish(record.acpId);
        else
            this.publishOnceQuiet(record);
        this.notifyChange();
    }
    /**
     * A turn can end with calls still open. Their mirrors would otherwise wait forever,
     * so they finish as failed; an unpublished call is still published so the log shows
     * what the CLI attempted.
     */
    failOpen() {
        for (const record of this.tools.values()) {
            if (isFinished(record))
                continue;
            this.apply({ toolCallId: record.acpId, status: 'failed', rawOutput: INTERRUPTED_OUTPUT }, false);
        }
    }
    dropUnmirrored() {
        for (const acpId of this.tools.keys()) {
            if (!this.mirrors.has(acpId))
                this.forget(acpId);
        }
    }
    forget(acpId) {
        this.stopSettling(acpId);
        const callId = this.tools.get(acpId)?.callId;
        this.tools = new Map([...this.tools].filter(([id]) => id !== acpId));
        this.callIds = new Map([...this.callIds].filter(([id]) => id !== callId));
        this.published = new Set([...this.published].filter((id) => id !== acpId));
        this.handedOff = new Set([...this.handedOff].filter((id) => id !== acpId));
        this.mirrors = new Set([...this.mirrors].filter((id) => id !== acpId));
        this.claimed = new Set([...this.claimed, acpId]);
    }
    /** @returns a promise that settles at the next change to any call. */
    nextChange() {
        const { promise, resolve } = Promise.withResolvers();
        this.changeWaiters = [...this.changeWaiters, resolve];
        return promise;
    }
    publish(acpId) {
        this.stopSettling(acpId);
        if (this.published.has(acpId))
            return;
        this.published = new Set([...this.published, acpId]);
        this.options.onReady(acpId);
    }
    /**
     * claude-agent-acp goes from pending straight to completed, so a long command would show
     * nothing until it ended. Its input arrives over several updates with nothing marking the
     * end, so a command counts as started once they stop. Only commands, because a file write
     * reports its path and then goes quiet while its content is generated: showing it then
     * would freeze a card with no diff in it.
     */
    publishOnceQuiet(record) {
        const { acpId } = record;
        this.stopSettling(acpId);
        if (this.published.has(acpId) || commandOf(record) === undefined)
            return;
        const timer = setTimeout(() => {
            this.publish(acpId);
        }, this.options.settleMs);
        timer.unref();
        this.settling = new Map([...this.settling, [acpId, timer]]);
    }
    stopSettling(acpId) {
        clearTimeout(this.settling.get(acpId));
        this.settling = new Map([...this.settling].filter(([id]) => id !== acpId));
    }
    notifyChange() {
        const waiters = this.changeWaiters;
        this.changeWaiters = [];
        for (const wake of waiters)
            wake();
    }
}
