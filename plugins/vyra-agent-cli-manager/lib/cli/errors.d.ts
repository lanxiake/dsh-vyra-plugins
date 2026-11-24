/**
 * The refusals a HTTP route can answer with. Kept apart from the route handler because the
 * MCP write module needs them too, and importing them from the handler would make the two
 * modules depend on each other.
 * @module dsh-vyra-agent-cli-manager/cli/errors
 */
/** The request is malformed, or asks for something this plugin will not do. */
export declare class BadRequest extends Error {
    name: string;
}
/** The body is larger than any request this route accepts. */
export declare class BodyTooLarge extends Error {
    name: string;
}
