/**
 * The modes a CLI reports for itself, and the one the user picked. The vocabulary is the
 * CLI's own: ids and names are kept and sent back exactly as reported, never translated
 * into a harness preset.
 * @module dsh-vyra-agent-cli-manager/session/mode-state
 */
import { LlmError } from '@deepseek-ai/dsh-llm';
import { abortable } from "../abortable.js";
import { readModeList } from "../model-options.js";
import { errorMessage } from "./outcomes.js";
/** The mode side of one CLI session. */
export class ModeState {
    known;
    report;
    /** The CLI's modes as last reported. */
    list;
    /** The mode the user picked, until the CLI confirms it. */
    wanted;
    /**
     * @param known - what the CLI reported ahead of any session, which a probe reads.
     * @param report - passes on the options the CLI answers a change with, which describe
     *   more than the mode; the session then updates everything from that one report.
     * @param initial - a mode picked before this session existed, sent with its first step.
     */
    constructor(known, report, initial) {
        this.known = known;
        this.report = report;
        this.list = known?.();
        this.wanted = initial;
    }
    /**
     * The modes the CLI reports, in its own ids and names.
     * @returns the list, or undefined before the CLI has reported one.
     */
    current() {
        return this.list;
    }
    /** The mode picked but not yet confirmed by the CLI, if any. */
    get pending() {
        return this.wanted;
    }
    /**
     * A report of the CLI's options; one without modes keeps what is known, as some CLIs
     * report only the option that changed. The confirmed mode clears a pending pick.
     * @param options - the options the CLI answered with.
     * @returns the modes known after this report.
     */
    observe(options) {
        if (options == null)
            return this.list;
        this.list = readModeList(options) ?? this.list;
        if (this.list?.current === this.wanted)
            this.wanted = undefined;
        return this.list;
    }
    /**
     * Ask for one of the CLI's own modes. Checked against the list the CLI last reported:
     * an id it never offered is refused rather than sent as an unknown value.
     * @param mode - a mode id exactly as the CLI reported it.
     * @throws when no list is known yet, or the list does not contain that mode.
     */
    choose(mode) {
        const { list } = this;
        if (list === undefined)
            throw new LlmError('还没有读到这个 CLI 的模式列表，请稍后再试。', 'CLI_MODE_FAILED');
        if (!list.options.some((option) => option.value === mode)) {
            throw new LlmError(`这个 CLI 没有报告模式 ${mode}。`, 'CLI_MODE_FAILED');
        }
        this.wanted = mode;
    }
    /**
     * Send the picked mode, unless the CLI is already on it. A refused pick is dropped, so it
     * never comes back with a later step; only a cancelled wait keeps it, as nothing was refused.
     * @param where - the session to change.
     * @param signal - cancellation for the wait.
     * @returns the modes as the CLI confirmed them.
     * @throws when the started CLI does not offer that mode, or refuses the change.
     */
    async apply(where, signal) {
        const { list, wanted } = this;
        if (list === undefined || wanted === undefined)
            return list;
        if (list.current === wanted) {
            this.wanted = undefined;
            return list;
        }
        // A pick made before the CLI started was checked against the catalog, not this process.
        if (!list.options.some((option) => option.value === wanted)) {
            this.wanted = undefined;
            throw new LlmError(`${where.label} 无法切换到模式 ${wanted}：CLI 没有报告这个模式`, 'CLI_MODE_FAILED');
        }
        try {
            const options = await abortable(where.transport.setConfigOption(where.acpSessionId, list.configId, wanted), signal);
            this.report(options);
            const confirmed = readModeList(options)?.current;
            if (confirmed !== undefined && confirmed !== wanted)
                throw new Error(`CLI 仍在使用 ${confirmed}`);
            this.wanted = undefined;
            return this.list ?? list;
        }
        catch (error) {
            if (signal?.aborted === true)
                throw error;
            this.wanted = undefined;
            throw new LlmError(`${where.label} 无法切换到模式 ${wanted}：${errorMessage(error)}`, 'CLI_MODE_FAILED', {
                cause: error,
            });
        }
    }
    /**
     * Apply a pick at the start of a turn. The user is sending a message, and a mode the CLI
     * will not take must not cost them that message, so a refusal comes back as a notice.
     * @param where - the session to change.
     * @param signal - cancellation for the wait; a cancelled wait still throws.
     * @returns the refusal to report, or undefined when the pick went through or there was none.
     */
    async settle(where, signal) {
        const { list, wanted } = this;
        if (list === undefined || wanted === undefined)
            return undefined;
        try {
            await this.apply(where, signal);
            return undefined;
        }
        catch (error) {
            if (signal?.aborted === true)
                throw error;
            // The CLI may have answered the refusal with its options, so read where it is now.
            const now = this.list ?? list;
            const current = now.options.find((option) => option.value === now.current)?.name ?? now.current;
            const notice = `（${errorMessage(error)}。这条消息按 CLI 当前的模式「${current}」发送，可以在 CLI 模式菜单里重新选择。）\n\n`;
            return { mode: wanted, notice };
        }
    }
}
