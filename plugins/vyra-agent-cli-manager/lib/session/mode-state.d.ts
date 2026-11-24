/**
 * The modes a CLI reports for itself, and the one the user picked. The vocabulary is the
 * CLI's own: ids and names are kept and sent back exactly as reported, never translated
 * into a harness preset.
 * @module dsh-vyra-agent-cli-manager/session/mode-state
 */
import type { CliModeList } from '../model-options.ts';
import type { ConfigOptions, ModelTarget } from './model-state.ts';
/** A pick the CLI would not take at the start of a turn, and what to tell the user. */
export interface ModeRefusal {
    /** The mode id that was dropped. */
    readonly mode: string;
    /** Shown ahead of the reply, so the user knows which mode the message ran in. */
    readonly notice: string;
}
/** The mode side of one CLI session. */
export declare class ModeState {
    private readonly known;
    private readonly report;
    /** The CLI's modes as last reported. */
    private list;
    /** The mode the user picked, until the CLI confirms it. */
    private wanted;
    /**
     * @param known - what the CLI reported ahead of any session, which a probe reads.
     * @param report - passes on the options the CLI answers a change with, which describe
     *   more than the mode; the session then updates everything from that one report.
     * @param initial - a mode picked before this session existed, sent with its first step.
     */
    constructor(known: (() => CliModeList | undefined) | undefined, report: (options: ConfigOptions) => void, initial?: string);
    /**
     * The modes the CLI reports, in its own ids and names.
     * @returns the list, or undefined before the CLI has reported one.
     */
    current(): CliModeList | undefined;
    /** The mode picked but not yet confirmed by the CLI, if any. */
    get pending(): string | undefined;
    /**
     * A report of the CLI's options; one without modes keeps what is known, as some CLIs
     * report only the option that changed. The confirmed mode clears a pending pick.
     * @param options - the options the CLI answered with.
     * @returns the modes known after this report.
     */
    observe(options: ConfigOptions): CliModeList | undefined;
    /**
     * Ask for one of the CLI's own modes. Checked against the list the CLI last reported:
     * an id it never offered is refused rather than sent as an unknown value.
     * @param mode - a mode id exactly as the CLI reported it.
     * @throws when no list is known yet, or the list does not contain that mode.
     */
    choose(mode: string): void;
    /**
     * Send the picked mode, unless the CLI is already on it. A refused pick is dropped, so it
     * never comes back with a later step; only a cancelled wait keeps it, as nothing was refused.
     * @param where - the session to change.
     * @param signal - cancellation for the wait.
     * @returns the modes as the CLI confirmed them.
     * @throws when the started CLI does not offer that mode, or refuses the change.
     */
    apply(where: ModelTarget, signal: AbortSignal | undefined): Promise<CliModeList | undefined>;
    /**
     * Apply a pick at the start of a turn. The user is sending a message, and a mode the CLI
     * will not take must not cost them that message, so a refusal comes back as a notice.
     * @param where - the session to change.
     * @param signal - cancellation for the wait; a cancelled wait still throws.
     * @returns the refusal to report, or undefined when the pick went through or there was none.
     */
    settle(where: ModelTarget, signal: AbortSignal | undefined): Promise<ModeRefusal | undefined>;
}
