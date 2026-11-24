/**
 * Read the MCP servers out of Codex's TOML config.
 *
 * Node has no TOML parser, and writing a general one would mean maintaining a second copy of a
 * format this plugin does not own. This reads only the one construct the panel needs:
 * `[mcp_servers.<name>]` tables and their scalar or string-array values. Anything outside those
 * tables is ignored; a value this cannot read raises {@link TomlMcpError} so the caller can say
 * the column is unreadable rather than present a half-parsed list.
 * @module dsh-vyra-agent-cli-manager/cli/toml-mcp
 */
/** A value this reader does not understand. The caller turns it into a visible "cannot read". */
export declare class TomlMcpError extends Error {
    name: string;
}
/**
 * Read every `[mcp_servers.<name>]` table.
 * @param text - the whole config file.
 * @returns one plain object per server, with the keys the definition sets.
 * @throws TomlMcpError when a value inside a server table cannot be read.
 */
export declare function mcpServersOfToml(text: string): Record<string, Record<string, unknown>>;
