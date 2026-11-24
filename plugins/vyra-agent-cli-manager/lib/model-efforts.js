/**
 * The reasoning levels the model menu offers for each of a CLI's models. Levels differ by
 * model, and a CLI only reports those of its active model, so they are learned as models
 * are used: a model not seen yet borrows the levels of the CLI's default model, which the
 * probe saw, rather than switching the CLI through every model to ask.
 * @module dsh-vyra-agent-cli-manager/model-efforts
 */
import { ReasoningEffortId } from '@deepseek-ai/dsh-llm';
import { DEFAULT_MODEL_ID } from "./constants.js";
const offers = (effort, value) => effort.options.some((option) => option.value === value);
/** What is known for a model: its levels, `null` for none, undefined when not seen yet. */
function effortOf(list, model) {
    const key = model === DEFAULT_MODEL_ID ? list.current : model;
    const efforts = list.efforts ?? {};
    // Model ids come from the CLI, so an id like `constructor` must not find an inherited member.
    return Object.hasOwn(efforts, key) ? efforts[key] : efforts[list.current];
}
/**
 * The levels to offer for one model.
 * @param list - the CLI's model list.
 * @param model - a model id, or `default` for the CLI's own.
 * @returns the levels with the CLI's starting one as default, or undefined when it offers none.
 */
export function reasoningFor(list, model) {
    const effort = effortOf(list, model);
    if (effort == null)
        return undefined;
    const efforts = effort.options.map(({ value, name }) => ({ id: ReasoningEffortId(value), name }));
    // The harness rejects a default that is not one of the levels.
    if (!offers(effort, effort.current))
        return { efforts };
    return { efforts, defaultEffort: ReasoningEffortId(effort.current) };
}
const sameEffort = (left, right) => JSON.stringify(left) === JSON.stringify(right);
/**
 * Record what a session reported for its active model. The reported level is the session's,
 * which may be one the user chose and the CLI carried over from another model; the default
 * stays the level the CLI started with, as long as the model offers it.
 * @param list - the CLI's model list.
 * @param model - the model that was active.
 * @param effort - its levels, or undefined when it offers none.
 * @returns the updated list, or the same object when nothing changed.
 */
export function learnEfforts(list, model, effort) {
    const before = effortOf(list, model);
    const startedOn = before?.current;
    const learned = effort === undefined
        ? null
        : startedOn !== undefined && offers(effort, startedOn)
            ? { ...effort, current: startedOn }
            : effort;
    if (list.efforts !== undefined && Object.hasOwn(list.efforts, model) && sameEffort(list.efforts[model], learned)) {
        return list;
    }
    return { ...list, efforts: { ...list.efforts, [model]: learned } };
}
