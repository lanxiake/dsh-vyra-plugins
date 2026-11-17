/**
 * Shared names.
 * @module vyra-agent-cli-manager/constants
 */
/**
 * The only tool a CLI session calls in the harness. The name is deliberately not
 * one the harness ships, so a CLI call can never reach a real tool body and run a
 * command the CLI already ran.
 */
export declare const CLI_TOOL_NAME = "cli_tool";
/** Every CLI's provider route starts with this; the rest is its configured id. */
export declare const CLI_ROUTE_PREFIX = "cli-";
/**
 * Name a CLI's provider route.
 * @param id - the configured agent id.
 * @returns its route.
 */
export declare const cliRoute: (id: string) => string;
/**
 * Whether a provider route is a CLI's rather than one of the harness's own.
 * @param provider - a provider route, or nothing before one is chosen.
 * @returns true for a CLI route.
 */
export declare const isCliRoute: (provider: string | undefined) => boolean;
/**
 * The part of a model's description the menu shows beside its name: a compact label such as
 * CodeBuddy's `x0.29 credits`, which tells apart tiers that share a name. Sentences about what
 * a model is good at are left out. The server side decides with the same rule whether such
 * labels can tell same-named rows apart, so a row never relies on text the menu hides.
 * @param description - what the CLI said about the model.
 * @returns the label to show, or undefined when there is none worth showing.
 */
export declare function compactDescription(description: string | undefined): string | undefined;
/** Model id meaning whatever the CLI itself is set to. */
export declare const DEFAULT_MODEL_ID = "default";
/** Path prefix of the 变更 panel's git routes; the browser posts to `<prefix>/<operation>`. */
export declare const GIT_ROUTE_PREFIX = "/vyra-agent-cli-manager/git";
/**
 * The route the composer's mode control posts to. It only lists the modes a CLI reported
 * and sends the chosen id back to that CLI, unchanged.
 */
export declare const MODE_ROUTE_PREFIX = "/vyra-agent-cli-manager/modes";
/**
 * Path prefix of the Agent CLI 管理 panel's routes; the browser posts to `<prefix>/<operation>`.
 * Distinct from {@link CLI_ROUTE_PREFIX}, which names provider routes: one is a URL prefix for
 * the panel's own API, the other a route id for a CLI acting as a model provider.
 */
export declare const CLI_MANAGER_ROUTE_PREFIX = "/vyra-agent-cli-manager/cli";
