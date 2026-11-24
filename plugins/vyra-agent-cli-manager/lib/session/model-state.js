/**
 * What is known about a CLI session's model, and switching it to the harness's choice.
 * @module dsh-vyra-agent-cli-manager/session/model-state
 */
import { LlmError } from '@deepseek-ai/dsh-llm';
import { abortable } from "../abortable.js";
import { DEFAULT_MODEL_ID } from "../constants.js";
import { readModelList } from "../model-options.js";
import { errorMessage } from "./outcomes.js";
/** Used when a CLI reports no model option, as some do when resuming. */
const CONVENTIONAL_MODEL_OPTION_ID = 'model';
/** The model side of one CLI session. */
export class ModelState {
    knownModels;
    onOptions;
    optionId;
    /** The model a new session started on, which the `default` selection stands for. */
    cliDefault;
    /** The CLI's model as far as is known; unset while a change is unconfirmed. */
    active;
    /**
     * @param knownModels - what the CLI reported ahead of any session.
     * @param onOptions - told every set of options the CLI reports, which carry more than the
     *   model, and whether they describe a session the CLI has just created.
     */
    constructor(knownModels, onOptions) {
        this.knownModels = knownModels;
        this.onOptions = onOptions;
    }
    /**
     * Only a new session says what `default` stands for: a resumed one reports the model it
     * was left on, which may be one the user chose.
     */
    adopt(options, isNewSession) {
        const list = readModelList(options);
        this.optionId = list?.configId;
        this.active = list?.current;
        if (isNewSession)
            this.cliDefault = list?.current;
        this.onOptions?.(options, isNewSession);
    }
    /** The CLI reported a change of its own. */
    observe(options) {
        this.active = readModelList(options)?.current ?? this.active;
        this.onOptions?.(options, false);
    }
    /**
     * Switch the CLI to the harness's selection, unless it is already there.
     * @param model - the selected model; omitted or `default` means the CLI's own.
     * @param where - the session to switch.
     * @param signal - cancellation for the wait.
     */
    async apply(model, where, signal) {
        const known = this.knownModels?.();
        const target = model === undefined || model === DEFAULT_MODEL_ID ? (this.cliDefault ?? known?.current) : model;
        if (target === undefined || target === this.active)
            return;
        const optionId = this.optionId ?? known?.configId ?? CONVENTIONAL_MODEL_OPTION_ID;
        // The CLI may still carry out a request this side stops waiting for, so from here
        // its model is unknown until confirmed. The next step will then always set it.
        this.active = undefined;
        try {
            const options = await abortable(where.transport.setConfigOption(where.acpSessionId, optionId, target), signal);
            // A new model can bring other reasoning levels, reported in the same answer.
            this.onOptions?.(options, false);
            const confirmed = readModelList(options)?.current;
            if (confirmed !== undefined && confirmed !== target)
                throw new Error(`CLI 仍在使用 ${confirmed}`);
            this.active = target;
        }
        catch (error) {
            if (signal?.aborted === true)
                throw error;
            throw new LlmError(`${where.label} 无法切换到模型 ${target}：${errorMessage(error)}`, 'CLI_MODEL_FAILED', {
                cause: error,
            });
        }
    }
}
