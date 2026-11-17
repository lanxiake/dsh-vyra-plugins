/**
 * The reasoning levels the model menu offers for each of a CLI's models. Levels differ by
 * model, and a CLI only reports those of its active model, so they are learned as models
 * are used: a model not seen yet borrows the levels of the CLI's default model, which the
 * probe saw, rather than switching the CLI through every model to ask.
 * @module vyra-agent-cli-manager/model-efforts
 */
import type { LlmModelReasoningInfo } from '@deepseek-ai/dsh-llm';
import type { CliEffortList, CliModelList } from './model-options.ts';
/**
 * The levels to offer for one model.
 * @param list - the CLI's model list.
 * @param model - a model id, or `default` for the CLI's own.
 * @returns the levels with the CLI's starting one as default, or undefined when it offers none.
 */
export declare function reasoningFor(list: CliModelList, model: string): LlmModelReasoningInfo | undefined;
/**
 * Record what a session reported for its active model. The reported level is the session's,
 * which may be one the user chose and the CLI carried over from another model; the default
 * stays the level the CLI started with, as long as the model offers it.
 * @param list - the CLI's model list.
 * @param model - the model that was active.
 * @param effort - its levels, or undefined when it offers none.
 * @returns the updated list, or the same object when nothing changed.
 */
export declare function learnEfforts(list: CliModelList, model: string, effort: CliEffortList | undefined): CliModelList;
