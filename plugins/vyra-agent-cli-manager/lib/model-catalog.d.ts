/**
 * What the model menu shows for each CLI. Asking a CLI means starting it, which can
 * take a while on a cold `npx` and for that command downloads and runs a package. So
 * filling the menu never asks: a CLI is only started once someone has chosen it, and
 * the menu refreshes when the answer arrives. Answers are saved, so a restarted plugin
 * can show the last known lists while it asks again.
 * @module vyra-agent-cli-manager/model-catalog
 */
import type { LlmModelInfo, LlmModelReasoningInfo } from '@deepseek-ai/dsh-llm';
import type { CliEffortList, CliModeList, CliModelList } from './model-options.ts';
/** What the catalog needs from the bridge. */
export interface ModelCatalogDeps {
    labelFor(provider: string): string | undefined;
    probe(provider: string): Promise<CliModelList | undefined>;
    /** The list for this route changed; the harness then refreshes its menus. */
    onUpdated(provider: string): void;
    warn(message: string): void;
    /** Keep every known list for the next run. */
    save(lists: ReadonlyMap<string, CliModelList>): Promise<void>;
}
/** Remembers each CLI's models, seeded from the lists an earlier run saved. */
export declare class CliModelCatalog {
    private readonly deps;
    private lists;
    private asked;
    /** Routes this run has a CLI's own answer for, as opposed to a restored list. */
    private answered;
    constructor(deps: ModelCatalogDeps);
    /**
     * List a CLI's models. The default entry names the model it stands for, so the menu
     * always shows what is really in use.
     * @param provider - a CLI route.
     * @returns the default entry, followed by the other models once they are known.
     */
    listModels(provider: string): readonly LlmModelInfo[];
    /**
     * The reasoning levels of one model. The harness reads these through model resolution,
     * not the listing, both for its menus and to check a chosen level.
     * @param provider - a CLI route.
     * @param model - a model id.
     * @returns its levels, or undefined when none are known.
     */
    reasoning(provider: string, model: string): LlmModelReasoningInfo | undefined;
    /**
     * Record the levels a session saw on its active model, which may differ from those the
     * menu assumed for it. Kept and saved like an answer, and the menu refreshes.
     * @param provider - a CLI route.
     * @param model - the model that was active.
     * @param effort - its levels, or undefined when it offers none.
     */
    learnEfforts(provider: string, model: string, effort: CliEffortList | undefined): void;
    /**
     * Name one model.
     * @param provider - a CLI route.
     * @param model - a model id.
     * @returns its display name, falling back to the id.
     */
    modelName(provider: string, model: string): string;
    /**
     * Read what a CLI reported.
     * @param provider - a CLI route.
     * @returns its model list, once known.
     */
    known(provider: string): CliModelList | undefined;
    /**
     * The CLI's own modes, kept per route. Each CLI has a different set and different ids;
     * callers must send those ids back unchanged rather than translating them into any
     * harness preset.
     * @param provider - a CLI route.
     * @returns its native modes, or undefined before the CLI has answered.
     */
    modesFor(provider: string): CliModeList | undefined;
    /**
     * Record the native modes a CLI reported for its own route. Only that route's list
     * changes: another CLI keeps its own modes, and no id is translated.
     * @param provider - a CLI route.
     * @param modes - the modes in the CLI's own ids and names.
     */
    learnModes(provider: string, modes: CliModeList): void;
    /**
     * Ask a CLI for its models in the background, unless that is done or under way. A
     * failed attempt can be repeated: the user may have installed it or logged in since.
     * @param provider - a CLI route someone has chosen.
     */
    ensureListed(provider: string): void;
    /**
     * Show the lists an earlier run saved. They may be out of date, so they never replace
     * an answer from this run and do not stop the CLI from being asked when chosen.
     * @param saved - lists by provider route; routes no longer configured are skipped.
     */
    restore(saved: ReadonlyMap<string, CliModelList>): void;
    /**
     * The probe only sees the default model, so what sessions learned about the others still
     * holds; for the default model the answer wins, including when it now offers no levels.
     */
    private withLearned;
    private persist;
    private defaultName;
}
