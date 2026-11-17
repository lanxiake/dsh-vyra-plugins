/**
 * One table of every MCP server, per CLI, for the matrix view.
 *
 * The rows are the union of what the CLIs actually have configured, so nothing here is remember-
 * ed by this plugin: a server exists for the panel exactly while some CLI's own config says it
 * does. Each cell also carries the reason its checkbox is disabled, which is what keeps the
 * matrix honest — a greyed cell that cannot say why is indistinguishable from a bug.
 * @module vyra-agent-cli-manager/cli/mcp-matrix
 */
import type { CliCatalogEntry } from './catalog.ts';
/** One CLI column. A column that could not be read shows every cell as unknown. */
interface McpMatrixColumn {
    readonly id: string;
    readonly name: string;
    readonly readable: boolean;
    /** Why the column is unreadable, shown on the header and on each of its cells. */
    readonly problem?: string | undefined;
    /** A fault in the CLI's config that does not stop this plugin reading it but does stop writes. */
    readonly note?: string | undefined;
}
/** One cell: whether this CLI has the server, and why it cannot be changed. */
interface McpMatrixCell {
    readonly id: string;
    readonly state: 'on' | 'off' | 'unknown';
    /** What this CLI's own config says the server runs, when it has it. */
    readonly detail?: string | undefined;
    /** Present when the checkbox is disabled; the text says what would have to change. */
    readonly blocked?: string | undefined;
}
interface McpMatrixRow {
    readonly name: string;
    readonly transport: string;
    readonly detail: string;
    readonly cells: readonly McpMatrixCell[];
}
export interface McpMatrixResult {
    readonly columns: readonly McpMatrixColumn[];
    readonly rows: readonly McpMatrixRow[];
}
/** How the matrix reads config files; injected so a test needs no disk. */
export interface MatrixHost {
    readFile(path: string): Promise<string | undefined>;
}
/**
 * The raw definition of every server one CLI has, unredacted and unconverted.
 *
 * The matrix only shows a display string, and that string is redacted; copying a server to
 * another CLI therefore has to come back here for the real value rather than rebuild it from
 * what the panel printed.
 * @param entry - the CLI to read.
 * @param host - how to read its config file.
 * @param home - the directory the catalog's paths are relative to.
 * @returns the definitions by name, or undefined when its config could not be read.
 */
export declare function definitionsOf(entry: CliCatalogEntry, host: MatrixHost, home: string): Promise<Record<string, unknown> | undefined>;
/**
 * Build the MCP matrix.
 * @param host - how to read a CLI's config file.
 * @param home - the directory the catalog's paths are relative to.
 * @returns one column per CLI and one row per server, with the reason each disabled cell is disabled.
 */
export declare function mcpMatrix(host: MatrixHost, home: string): Promise<McpMatrixResult>;
export {};
