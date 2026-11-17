/**
 * The refusals a HTTP route can answer with. Kept apart from the route handler because the
 * MCP write module needs them too, and importing them from the handler would make the two
 * modules depend on each other.
 * @module vyra-agent-cli-manager/cli/errors
 */
/** The request is malformed, or asks for something this plugin will not do. */
export class BadRequest extends Error {
    name = 'BadRequest';
}
/** The body is larger than any request this route accepts. */
export class BodyTooLarge extends Error {
    name = 'BodyTooLarge';
}
