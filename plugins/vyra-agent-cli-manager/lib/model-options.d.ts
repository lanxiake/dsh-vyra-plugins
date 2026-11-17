/**
 * Reads a CLI's model list, its reasoning levels, and the native modes it reports, out of
 * the configuration options ACP sends. Every option id and name stays exactly as the CLI
 * gave it; nothing here maps a CLI concept onto a harness one.
 * @module vyra-agent-cli-manager/model-options
 */
import type { SessionConfigOption } from '@agentclientprotocol/sdk';
/** One model a CLI offers. */
export interface CliModelOption {
    readonly value: string;
    readonly name: string;
    /** What the CLI says about the model, typically its usage cost multiplier. */
    readonly description?: string;
}
/** The reasoning levels a model offers and which one is set. */
export interface CliEffortList {
    /** Option id to send when changing the level; each CLI names it differently. */
    readonly configId: string;
    readonly current: string;
    readonly options: readonly CliModelOption[];
}
/**
 * A CLI's own modes, exactly as it reports them. The set belongs to the CLI, not to the
 * harness: each route keeps its own list and its own current value.
 */
export interface CliModeList {
    /** Option id to send when changing the mode; ACP does not fix this name. */
    readonly configId: string;
    readonly current: string;
    readonly options: readonly CliModelOption[];
}
/** The models a CLI offers and which one is active. */
export interface CliModelList {
    /** Option id to send when switching; ACP does not fix this name. */
    readonly configId: string;
    readonly current: string;
    readonly options: readonly CliModelOption[];
    /** The CLI's native modes, in the CLI's own ids and names. Absent when it reports none. */
    readonly modes?: CliModeList;
    /**
     * Reasoning levels by model id, for the models seen so far: `null` for a model seen to
     * offer none. Absent when no model has been seen with levels.
     */
    readonly efforts?: Readonly<Record<string, CliEffortList | null>>;
}
type ConfigOptions = readonly SessionConfigOption[] | null | undefined;
/**
 * Find the reasoning level option. Only ACP's category identifies it: the ids differ
 * between CLIs (`effort`, `thinking`, `reasoning_effort`), and an id alone could be
 * some other setting. Checked like the model option, as the SDK does not validate it.
 * @param configOptions - the options a CLI reported, if any.
 * @returns the levels, or undefined when the active model offers none.
 */
export declare function readEffortList(configOptions: ConfigOptions): CliEffortList | undefined;
/**
 * Find the CLI's native mode option. Only ACP's category identifies it: the ids differ
 * between CLIs, and a CLI may report no modes at all. The values are kept verbatim so
 * switching sends back an id the CLI itself understands.
 * @param configOptions - the options a CLI reported, if any.
 * @returns its modes, or undefined when it reports none.
 */
export declare function readModeList(configOptions: ConfigOptions): CliModeList | undefined;
/**
 * Find the model option. ACP marks it with a category, so that wins; the id is only
 * a convention, for CLIs that report no category. The SDK does not validate responses,
 * so everything here is checked: an empty name or id in the catalog would make the
 * harness drop the whole CLI from its menus.
 * @param configOptions - the options a CLI reported, if any.
 * @returns the model list, with the CLI's native modes and the active model's reasoning
 * levels when it has any, or undefined when the CLI offers no selectable models.
 */
export declare function readModelList(configOptions: ConfigOptions): CliModelList | undefined;
export {};
