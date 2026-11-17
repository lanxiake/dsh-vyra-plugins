/**
 * HTTP routes the 变更 panel posts to, under `/vyra-agent-cli-manager/git/<operation>`. The harness's
 * web server leaves authentication to each route, so every request first asks the
 * `connection` service for a rejection: its Host/Origin fence stops cross-site and DNS-
 * rebinding callers, and its login-token check stops anyone who is not the signed-in browser.
 * @module vyra-agent-cli-manager/git/git-routes
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Spawn } from './git-run.ts';
/** The parts of the harness's `webServer` service this module uses. */
export interface GitWebServer {
    register(route: {
        kind: 'prefix';
        path: string;
        handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
    }): () => void;
}
/** The parts of the harness's `connection` service this module uses. */
export interface GitConnection {
    requestRejection(request: {
        readonly headers: IncomingMessage['headers'];
    }): 401 | 403 | undefined;
}
/**
 * Build the handler for every git route.
 * @param spawn - the subprocess service's spawn.
 * @param connection - the harness's trust check.
 * @param warn - logs failures that are not the user's doing.
 * @returns the request handler.
 */
export declare function gitHandler(spawn: Spawn, connection: GitConnection, warn: (message: string) => void): (req: IncomingMessage, res: ServerResponse) => Promise<void>;
/**
 * Register the git routes on the web server.
 * @param webServer - the harness's web server.
 * @param handler - the handler from {@link gitHandler}.
 * @returns the unregister function.
 */
export declare function registerGitRoutes(webServer: GitWebServer, handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>): () => void;
