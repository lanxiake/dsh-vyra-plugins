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
/**
 * Rows a CLI reports for "whatever I was started with". Several CLIs use the same word for it,
 * so both the conventional id and a row named for it stand for the CLI's default.
 */
const DEFAULT_ROWS = new Set([DEFAULT_MODEL_ID, 'default', 'cli-default']);
const isDefaultRow = (value) => DEFAULT_ROWS.has(value);
/** The model side of one CLI session. */
export class ModelState {
    knownModels;
    onOptions;
    /** The model the process was launched with, when DSH named it instead of the CLI. */
    launchedWith;
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
     * Remember the model the CLI was launched with. A CLI pointed at a DSH provider is told its
     * model through an environment variable before it runs, and then says so in a row of its own
     * (`Default`), so that row now stands for the DSH model rather than for the CLI's own pick.
     * @param model - the model the harness selected for the step that started this process.
     */
    launched(model) {
        this.launchedWith = model;
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
     * @param model - the selected model; omitted or `default` means whatever the CLI was
     *   launched with, which is the DSH model when the user made the CLI follow DSH.
     * @param where - the session to switch.
     * @param signal - cancellation for the wait.
     */
    async apply(model, where, signal) {
        const known = this.knownModels?.();
        const launchesOnDsh = this.launchedWith !== undefined;
        const own = isDefaultRow(model === undefined ? DEFAULT_MODEL_ID : model);
        // A CLI started on the DSH model already runs it, so the `default` row is a no-op: the
        // CLI's own default row would switch it back to the account this plugin was asked to
        // leave behind.
        if (own && launchesOnDsh)
            return;
        const target = own ? (this.cliDefault ?? known?.current) : model;
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
