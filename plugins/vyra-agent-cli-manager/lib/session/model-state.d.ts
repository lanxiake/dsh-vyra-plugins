/**
 * What is known about a CLI session's model, and switching it to the harness's choice.
 * @module dsh-vyra-agent-cli-manager/session/model-state
 */
import { readModelList } from '../model-options.ts';
import type { CliModelList } from '../model-options.ts';
import type { AcpTransport } from '../transport.ts';
/** Configuration options as a CLI reports them. */
export type ConfigOptions = Parameters<typeof readModelList>[0];
/** Where a model switch is sent. */
export interface ModelTarget {
    readonly transport: AcpTransport;
    readonly acpSessionId: string;
    /** CLI display name used in user-facing messages. */
    readonly label: string;
}
/** The model side of one CLI session. */
export declare class ModelState {
    private readonly knownModels?;
    private readonly onOptions?;
    /** The model the process was launched with, when DSH named it instead of the CLI. */
    private launchedWith;
    private optionId;
    /** The model a new session started on, which the `default` selection stands for. */
    private cliDefault;
    /** The CLI's model as far as is known; unset while a change is unconfirmed. */
    private active;
    /**
     * @param knownModels - what the CLI reported ahead of any session.
     * @param onOptions - told every set of options the CLI reports, which carry more than the
     *   model, and whether they describe a session the CLI has just created.
     */
    constructor(knownModels?: (() => CliModelList | undefined) | undefined, onOptions?: ((options: ConfigOptions, isNewSession: boolean) => void) | undefined);
    /**
     * Remember the model the CLI was launched with, when DSH named it through its environment.
     * @param model - the model the harness selected for the step that started this process.
     */
    launched(model: string | undefined): void;
    /**
     * Only a new session says what `default` stands for: a resumed one reports the model it
     * was left on, which may be one the user chose.
     */
    adopt(options: ConfigOptions, isNewSession: boolean): void;
    /** The CLI reported a change of its own. */
    observe(options: ConfigOptions): void;
    /**
     * Switch the CLI to the harness's selection, unless it is already there.
     * @param model - the selected model; omitted or `default` means whatever the CLI was
     *   launched with, which is the DSH model when the user made the CLI follow DSH.
     * @param where - the session to switch.
     * @param signal - cancellation for the wait.
     */
    apply(model: string | undefined, where: ModelTarget, signal: AbortSignal | undefined): Promise<void>;
}
