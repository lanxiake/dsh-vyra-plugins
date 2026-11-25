/**
 * Which model a CLI should run on, and the environment that tells it so.
 * @module dsh-vyra-agent-cli-manager/model-source
 */

/** The browser records this choice per CLI; the host reads the same value from the panel. */
export declare const MODEL_SOURCE_DSH = "dsh";
export declare const MODEL_SOURCE_CLI = "cli";

/** One `agents[].models` entry, with whatever the user left out already omitted. */
export interface ModelRoute {
    readonly provider: string;
    readonly model: string;
    readonly baseURL?: string;
    readonly apiKeyEnv?: string;
    readonly apiKeyEnvs?: readonly string[];
    /** The provider's published endpoint, used only when the harness knows none. */
    readonly providerBaseURL?: string;
}

/** What the harness knows about one of its own providers, for filling a route in. */
export interface ProviderEntry {
    readonly baseURL?: string;
    readonly apiKeyEnv?: string;
}

/** One environment variable a CLI reads, by the role it plays. */
export interface VariableName {
    readonly name: string;
}

/** The CLI's own environment variable names, configured beside the route. */
export interface ModelVariables {
    readonly baseURL?: VariableName;
    readonly apiKeyEnv?: VariableName;
    readonly apiKeyEnvs?: readonly VariableName[];
    readonly modelEnv?: VariableName;
    /** The model id written when the harness selects `default`. */
    readonly defaultModel?: string;
}

/** What the settings page shows for one CLI. */
export interface RouteDescription {
    readonly title: string;
    readonly hint: string;
}

/**
 * Whether a raw value is one of the two sources this plugin offers.
 * @param value - a value read from the browser or a request body.
 * @returns true for `dsh` and `cli`.
 */
export declare const isModelSource: (value: unknown) => value is 'dsh' | 'cli';
/**
 * Index the configured routes by CLI id.
 * @param agents - the `agents` list from the plugin config.
 * @returns one route per CLI that declares one; CLIs without one have no entry.
 */
export declare function readModelRoutes(agents: readonly {
    id?: unknown;
    models?: unknown;
}[] | undefined): Map<string, ModelRoute>;
/**
 * Fill a route's endpoint and credential name from what the harness configured for that provider.
 * @param route - the configured route.
 * @param lookup - returns one entry of the harness's provider directory, when it offers one.
 * @returns the route with `baseURL` and `apiKeyEnv` filled in where they were left out.
 */
export declare function resolveRoute(route: ModelRoute, lookup: (provider: string) => ProviderEntry | undefined): ModelRoute;
/**
 * The environment that points one CLI at a provider.
 * @param route - the resolved route.
 * @param modelId - the model id the harness selected, or the CLI's `default`.
 * @param apiKey - the credential's value, or undefined when it could not be resolved.
 * @param variables - the CLI's own environment variable names.
 * @returns the variables to add to the CLI's environment; empty when the route cannot be used.
 */
export declare function modelEnvironment(route: ModelRoute, modelId: string, apiKey: string | undefined, variables: ModelVariables): Record<string, string>;
/**
 * The raw `agents[].models` entry for one CLI, with empty strings for what was left out.
 * @param agents - the `agents` list from the plugin config.
 * @param id - the CLI id.
 * @returns the entry, or undefined for a CLI that declares no route.
 */
export declare function modelRoutesOf(agents: readonly {
    id?: unknown;
    models?: unknown;
}[] | undefined, id: string): ModelVariableEntry | undefined;
/** `agents[].models` as the user wrote it, with the empty strings kept. */
export interface ModelVariableEntry {
    readonly baseURLEnv: string;
    readonly apiKeyEnv: string;
    readonly apiKeyEnvs: readonly string[];
    readonly modelEnv: string;
    readonly defaultModel: string;
}
/**
 * A one-line description of what a CLI will run on, for the settings page.
 * @param route - the configured route, resolved or not.
 * @param source - the source the user picked.
 * @param baseURLFromProvider - whether the endpoint came from the harness rather than the route.
 * @returns the label and a hint line.
 */
export declare function describeRoute(route: ModelRoute, source: string, baseURLFromProvider?: boolean): RouteDescription;
/**
 * The default source for a CLI.
 * @param routes - routes by CLI id.
 * @param id - the CLI id.
 * @returns the source the panel starts the row on.
 */
export declare function defaultSourceFor(routes: Map<string, ModelRoute>, id: string): 'dsh' | 'cli';
