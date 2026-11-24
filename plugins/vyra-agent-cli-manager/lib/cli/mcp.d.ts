/**
 * Read the MCP servers a CLI has configured.
 *
 * Where a CLI keeps them in JSON this reads that file, because the file is the stable contract
 * and its shape survives the CLI's own chatty output formatting. Codex keeps them in TOML —
 * Node has no TOML parser and writing one would mean maintaining a second copy of Codex's
 * schema — so for it the CLI's own `mcp list` is run and its text is passed through verbatim
 * rather than parsed by guesswork.
 * @module dsh-vyra-agent-cli-manager/cli/mcp
 */
import type { CliCatalogEntry } from './catalog.ts';
/** One configured server, in the shape the panel draws. */
export interface McpServerSummary {
    readonly name: string;
    /** `stdio`, `http`, `sse`, or `unknown` when the entry says neither. */
    readonly transport: string;
    /** Display-ready hint: the command line for stdio, the URL for a remote server. */
    readonly detail: string;
}
/** Where the list came from, which the panel states so nobody mistakes text for a parse. */
type McpSource = 'file' | 'cli';
export interface McpListResult {
    readonly servers: readonly McpServerSummary[];
    readonly source: McpSource;
    /** Set when the list could not be read at all; the message is ready to show. */
    readonly error?: string;
    /** Raw output for a CLI that this module does not parse. */
    readonly raw?: string;
}
/** The outside world this module needs, injected so tests touch no disk and no process. */
export interface McpHost {
    /** The file's text, or undefined when it is absent. */
    readFile(path: string): Promise<string | undefined>;
    /** Run argv and return its stdout; resolves with '' instead of rejecting when it fails. */
    capture(argv: readonly string[], signal: AbortSignal): Promise<string>;
}
/**
 * Mask anything in a command line that looks like a credential, keeping the key so the row
 * still says which header the server sets.
 * @param text - the command line as configured.
 * @returns the same line with each secret replaced by a fixed marker.
 */
export declare function redact(text: string): string;
/**
 * Pull the servers out of one parsed config document.
 * @param document - the parsed JSON, or the tables this plugin read out of a TOML config.
 * @param key - the field the CLI keeps them under.
 * @returns one summary per server, in the file's order.
 */
export declare function serversOf(document: unknown, key: string): readonly McpServerSummary[];
/**
 * List one CLI's configured MCP servers.
 * @param entry - the CLI to read.
 * @param host - how to read a file and run a command.
 * @param home - the user's home directory, which the catalog paths are relative to.
 * @param timeoutMs - how long a CLI-run list may take.
 * @returns the servers, where they came from, and why there are none when that is the case.
 */
export declare function listMcpServers(entry: CliCatalogEntry, host: McpHost, home: string, timeoutMs?: number): Promise<McpListResult>;
export {};
