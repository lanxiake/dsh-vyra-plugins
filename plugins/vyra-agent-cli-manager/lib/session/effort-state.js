/**
 * What is known about a CLI session's reasoning level, and setting it to the harness's choice.
 * @module vyra-agent-cli-manager/session/effort-state
 */
import { LlmError } from '@deepseek-ai/dsh-llm';
import { abortable } from "../abortable.js";
import { readEffortList } from "../model-options.js";
import { errorMessage } from "./outcomes.js";
/** The reasoning level side of one CLI session. */
export class EffortState {
    report;
    /** The active model's levels, as last reported. */
    levels;
    /** The CLI's level as far as is known; unset while a change is unconfirmed. */
    active;
    /** @param report - passes on the options the CLI answers a change with, which describe more than the level. */
    constructor(report) {
        this.report = report;
    }
    /**
     * The CLI reported its options. A report without any keeps what is known: some CLIs
     * report nothing when resuming.
     */
    observe(options) {
        if (options == null)
            return;
        this.levels = readEffortList(options);
        this.active = this.levels?.current;
    }
    /**
     * Set the CLI to the harness's level, unless it is already there. The harness fills in
     * the catalog's default when the user chose none, so this nearly always has a level. One
     * the active model does not offer is left alone rather than failing the message: the
     * harness checked it against the levels it last knew, which a model switch may have replaced.
     * @param effort - the selected level; omitted leaves the CLI's own.
     * @param where - the session to change.
     * @param signal - cancellation for the wait.
     * @returns the level the CLI keeps when the selected one is not offered, else undefined.
     */
    async apply(effort, where, signal) {
        const levels = this.levels;
        if (effort === undefined || levels === undefined || effort === this.active)
            return undefined;
        if (!levels.options.some((option) => option.value === effort))
            return levels.current;
        // As with the model, a request this side stops waiting for may still be carried out.
        this.active = undefined;
        try {
            const options = await abortable(where.transport.setConfigOption(where.acpSessionId, levels.configId, effort), signal);
            this.report(options);
            const confirmed = readEffortList(options)?.current;
            if (confirmed !== undefined && confirmed !== effort)
                throw new Error(`CLI 仍在使用 ${confirmed}`);
            this.active = effort;
            return undefined;
        }
        catch (error) {
            if (signal?.aborted === true)
                throw error;
            throw new LlmError(`${where.label} 无法切换到思考强度 ${effort}：${errorMessage(error)}`, 'CLI_EFFORT_FAILED', {
                cause: error,
            });
        }
    }
}
