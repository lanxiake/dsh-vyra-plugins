/**
 * The composer's mode route, under `/dsh-vyra-agent-cli-manager/modes`. A CLI's modes belong to the CLI:
 * the route only lists what that CLI reported and sends the chosen id back unchanged, so
 * no CLI mode is ever turned into a harness preset. Like the git routes, the harness's web
 * server leaves authentication to each route, so every request first asks `connection` for
 * a rejection.
 * @module dsh-vyra-agent-cli-manager/mode-routes
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { CliModeList } from './model-options.ts';
/** The parts of the harness's `webServer` service this module uses. */
export interface ModeWebServer {
    register(route: {
        kind: 'prefix';
        path: string;
        handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
    }): () => void;
}
/** The parts of the harness's `connection` service this module uses. */
export interface ModeConnection {
    requestRejection(request: {
        readonly headers: IncomingMessage['headers'];
    }): 401 | 403 | undefined;
}
/** What the route reads from the bridge. */
export interface ModeRoutes {
    /** The modes known for a session's route, and a pick the CLI has not confirmed. */
    modeState(sessionId: string, provider: string): {
        readonly modes?: CliModeList;
        readonly pending?: string;
    };
    /** Ask that CLI to switch, by the id it reported. */
    switchMode(sessionId: string, provider: string, mode: string): Promise<CliModeList | undefined>;
}
/**
 * Build the handler for the mode route.
 * @param routes - what the bridge knows about native modes.
 * @param connection - the harness's trust check.
 * @param warn - logs failures that are not the user's doing.
 * @returns the request handler.
 */
export declare function modeHandler(routes: ModeRoutes, connection: ModeConnection, warn: (message: string) => void): (req: IncomingMessage, res: ServerResponse) => Promise<void>;
/**
 * Serve the mode route on the harness's web server.
 * @param server - the harness's web server.
 * @param routes - what the bridge knows about native modes.
 * @param connection - the harness's trust check.
 * @param warn - logs failures that are not the user's doing.
 * @returns a disposer that unregisters the route.
 */
export declare function registerModeRoute(server: ModeWebServer, routes: ModeRoutes, connection: ModeConnection, warn: (message: string) => void): () => void;
