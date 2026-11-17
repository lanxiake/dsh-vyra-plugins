/**
 * HTTP routes the 总览 panel posts to, under `/vyra-agent-cli-manager/cli/<operation>`.
 * Structured after the git routes: the harness's web server leaves authentication to each
 * route, so every request first asks `connection` for a rejection — its Host/Origin fence
 * stops cross-site and DNS-rebinding callers, and its login-token check stops anyone who is
 * not the signed-in browser.
 *
 * Reading is the bulk of this prefix: status, the MCP list, skills, and the instruction file.
 * The two write operations add and remove one MCP server, and each is delegated to the CLI
 * whose configuration it changes. Installing and uninstalling stay off this route so that a
 * mistake in the panel can never change what is installed.
 * @module vyra-agent-cli-manager/cli/cli-routes
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { SkillInstallHost } from './skill-install.ts';
import type { CliHost } from './detect.ts';
import type { LatestVersionSource } from './registry-status.ts';
import type { SkillLinkHost } from './skill-links.ts';
import type { CliRunner } from './upgrade.ts';
/** The parts of the harness's `webServer` service this module uses. */
export interface CliWebServer {
    register(route: {
        kind: 'prefix';
        path: string;
        handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
    }): () => void;
}
/** The parts of the harness's `connection` service this module uses. */
export interface CliConnection {
    requestRejection(request: {
        readonly headers: IncomingMessage['headers'];
    }): 401 | 403 | undefined;
}
/** Everything the route needs to answer, injected so tests reach no network and no PATH. */
export interface CliRoutes {
    readonly host: CliHost;
    readonly latest: LatestVersionSource;
    readonly run: CliRunner;
    /** The user's home, which the catalog's config paths are relative to. */
    readonly home: string;
    /** One file's text, or undefined when it cannot be read. */
    readonly readFile: (path: string) => Promise<string | undefined>;
    /** The names directly under a directory, or undefined when it cannot be read. */
    readonly listDirectory: (path: string) => Promise<readonly string[] | undefined>;
    /** Replace one file, for the MCP entries this plugin edits rather than delegates. */
    readonly writeFile: (path: string, text: string) => Promise<void>;
    /** The disk operations a skill link needs, which only the Host can do. */
    readonly skills: SkillLinkHost;
    /** The disk and repository access installing a skill needs. */
    readonly skillInstall: SkillInstallHost;
}
/**
 * Build the handler for every CLI route.
 * @param routes - where statuses come from.
 * @param connection - the harness's trust check.
 * @param warn - logs failures that are not the user's doing.
 * @returns the request handler.
 */
export declare function cliHandler(routes: CliRoutes, connection: CliConnection, warn: (message: string) => void): (req: IncomingMessage, res: ServerResponse) => Promise<void>;
/**
 * Register the CLI routes on the web server.
 * @param webServer - the harness's web server.
 * @param handler - the handler from {@link cliHandler}.
 * @returns the unregister function.
 */
export declare function registerCliRoutes(webServer: CliWebServer, handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>): () => void;
