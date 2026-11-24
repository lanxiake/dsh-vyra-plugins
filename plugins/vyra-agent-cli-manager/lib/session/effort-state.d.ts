/**
 * What is known about a CLI session's reasoning level, and setting it to the harness's choice.
 * @module dsh-vyra-agent-cli-manager/session/effort-state
 */
import type { ConfigOptions, ModelTarget } from './model-state.ts';
/** The reasoning level side of one CLI session. */
export declare class EffortState {
    private readonly report;
    /** The active model's levels, as last reported. */
    private levels;
    /** The CLI's level as far as is known; unset while a change is unconfirmed. */
    private active;
    /** @param report - passes on the options the CLI answers a change with, which describe more than the level. */
    constructor(report: (options: ConfigOptions) => void);
    /**
     * The CLI reported its options. A report without any keeps what is known: some CLIs
     * report nothing when resuming.
     */
    observe(options: ConfigOptions): void;
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
    apply(effort: string | undefined, where: ModelTarget, signal: AbortSignal | undefined): Promise<string | undefined>;
}
