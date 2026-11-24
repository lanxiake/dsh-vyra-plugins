/**
 * Add and remove one MCP server for a CLI.
 *
 * Adding is delegated to the CLI's own `mcp add`, because the CLI owns its config schema and
 * its own version decides which flags exist: this plugin only knows the flags measured from
 * that CLI's `--help` (see catalog.ts). Removing follows the same rule where the CLI has a
 * `remove` subcommand; where it does not, the server is deleted from the JSON file the CLI
 * reads. Deleting a key needs no knowledge of the entry's shape, so that path is safe even
 * for a CLI this plugin has never measured, while writing a *new* entry does need it and is
 * therefore refused rather than guessed.
 * @module dsh-vyra-agent-cli-manager/cli/mcp-write
 */
import type { CliCatalogEntry } from './catalog.ts';
import type { CliRunner } from './upgrade.ts';
/** The two transports every CLI in the catalog can express. */
type McpTransport = 'stdio' | 'http';
/** One server to add, as the panel sent it. */
export interface McpServerSpec {
    readonly name: string;
    readonly transport: McpTransport;
    /** The argv for a stdio server, already split. */
    readonly command?: readonly string[] | undefined;
    /** The URL for a remote server. */
    readonly url?: string | undefined;
    /** Each entry is one `KEY=VALUE`. */
    readonly env?: readonly string[] | undefined;
}
/** How the change was made, so the panel can say it instead of implying one mechanism. */
export interface McpWriteOutcome {
    readonly id: string;
    /** `cli`: the CLI's own subcommand wrote its config. `file`: this plugin edited its JSON. */
    readonly via: 'cli' | 'file';
    /** Present for `cli`; a non-zero exit is the CLI's verdict and is reported, not thrown. */
    readonly exitCode?: number | null;
    readonly stdout?: string;
    readonly stderr?: string;
}
/** The outside world a write needs. Injected so tests touch no disk and no process. */
export interface McpWriteHost {
    /** The file's text, or undefined when it does not exist. */
    readFile(path: string): Promise<string | undefined>;
    /** Replace a file's contents. */
    writeFile(path: string, text: string): Promise<void>;
    /** Run one argv to completion. */
    run: CliRunner;
}
/**
 * A write this plugin will not make, or one that could not be started. The message is ready
 * to show; `status` says whether the request was refused (400) or a CLI failed to run (502).
 */
export declare class McpWriteError extends Error {
    name: string;
    /** 400 when this plugin refuses the request, 502 when a CLI it delegated to would not run. */
    readonly status: 400 | 502;
    constructor(message: string, status?: 400 | 502);
}
/**
 * Split a command line into argv the way a shell would, except that a backslash is an ordinary
 * character: a Windows path is a common argument and a shell-style escape would eat it.
 * @param text - the line as the user typed it.
 * @returns each argument, with quotes removed.
 */
export declare function splitCommandLine(text: string): readonly string[];
/**
 * The argv that adds one server through the CLI's own subcommand.
 * @param entry - the CLI to add to.
 * @param spec - the server to add.
 * @returns the argv, ready for `run`.
 * @throws McpWriteError when the CLI's add shape was never measured, or the spec is incomplete.
 */
export declare function addArgvFor(entry: CliCatalogEntry, spec: McpServerSpec): readonly string[];
/**
 * The argv that removes one server, or undefined when the CLI has no usable subcommand and
 * its file has to be edited instead. A CLI whose command was never measured is treated the
 * same way: deleting a key from its file needs no knowledge of the CLI's flags.
 */
export declare function removeArgvFor(entry: CliCatalogEntry, name: string): readonly string[] | undefined;
/** One copy of a server from a CLI that has it into another. */
export interface McpCopyRequest {
    readonly source: CliCatalogEntry;
    readonly target: CliCatalogEntry;
    readonly host: McpWriteHost;
    readonly home: string;
    readonly name: string;
}
/**
 * Copy one server between CLIs by reading the source's own definition.
 *
 * The panel only ever saw a redacted command line, so the value is read again here rather than
 * rebuilt from what was displayed: rebuilding it would write the redaction marker into the
 * target's config.
 * @param request - where the server comes from, where it goes, and which one it is.
 * @returns how the target reported the add.
 * @throws McpWriteError when the source's definition cannot be read or copied.
 */
export declare function copyMcpServer(request: McpCopyRequest): Promise<McpWriteOutcome>;
/** A request to copy one server between two CLIs. */
export interface McpCopyBody {
    readonly from: string;
    readonly to: string;
    readonly name: string;
}
/**
 * Add one MCP server.
 * @param entry - the CLI to add to.
 * @param host - how to run a command.
 * @param spec - the server to add.
 * @returns how it was added, and the CLI's own exit code when it was delegated.
 * @throws McpWriteError when the CLI cannot be written to, or would not start.
 */
export declare function addMcpServer(entry: CliCatalogEntry, host: McpWriteHost, spec: McpServerSpec): Promise<McpWriteOutcome>;
/**
 * Remove one MCP server.
 * @param entry - the CLI to remove from.
 * @param host - how to run a command and read and write a file.
 * @param home - the directory the catalog's paths are relative to.
 * @param name - the server's name in that CLI's config.
 * @returns how it was removed, and the CLI's own exit code when it was delegated.
 * @throws McpWriteError when nothing could be removed, or the CLI would not start.
 */
export declare function removeMcpServer(entry: CliCatalogEntry, host: McpWriteHost, home: string, name: string): Promise<McpWriteOutcome>;
/** Everything the two write operations read out of a request body. */
export interface McpAddRequest {
    readonly id: string;
    readonly spec: McpServerSpec;
}
/**
 * Read an add request.
 * @param body - the parsed body.
 * @returns the CLI id and the server to add.
 * @throws BadRequest when a field is missing or has the wrong type.
 */
export declare function addRequestOf(body: unknown): McpAddRequest;
/**
 * Read a copy request.
 * @param body - the parsed body.
 * @returns the source CLI, the target CLI, and the server name.
 * @throws BadRequest when a field is missing.
 */
export declare function copyRequestOf(body: unknown): McpCopyBody;
/**
 * Read a remove request.
 * @param body - the parsed body.
 * @returns the CLI id and the server name.
 * @throws BadRequest when a field is missing.
 */
export declare function removeRequestOf(body: unknown): {
    readonly id: string;
    readonly name: string;
};
export {};
