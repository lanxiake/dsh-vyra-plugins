/**
 * Host plugin: registers each configured CLI as a model provider and wires the
 * session registry to the harness.
 * @module vyra-agent-cli-manager
 */
import type { Context } from '@deepseek-ai/cordis';
import { Service } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type { ImageRef } from './prompt-images.ts';
import type { GitConnection, GitWebServer } from './git/git-routes.ts';
import type { CliAgentConfig } from './session-registry.ts';
export type { CliAgentConfig } from './session-registry.ts';
declare module '@deepseek-ai/cordis' {
    interface Context {
        cliBridge: CliBridge;
        /** Provided by the harness's boot layer. */
        dshHomePath?: (...segments: string[]) => string;
        /**
         * The harness's attachment store (`@deepseek-ai/dsh-attachment`), narrowed to the one
         * call this plugin makes so the package does not have to depend on it.
         */
        attachments?: {
            readImage(ref: ImageRef, signal?: AbortSignal): Promise<{
                data: Uint8Array;
            }>;
        };
        /** The harness's web server and its trust check, narrowed to what the git routes use. */
        webServer: GitWebServer;
        connection: GitConnection;
    }
}
/** Plugin configuration. */
export interface Config {
    agents: CliAgentConfig[];
    /** Signal-escalation grace when stopping a CLI, in milliseconds. */
    disposeGraceMs: number;
    /** Time after stdin EOF for a CLI to exit by itself, in milliseconds. */
    disposeEofGraceMs: number;
    /** Time a cancelled CLI may take to end its turn before it is abandoned, in milliseconds. */
    cancelGraceMs: number;
    /** Time a CLI may take to start and accept a session, which must allow for a cold `npx` download. */
    startTimeoutMs: number;
    /** Stateless, non-CLI provider for auto-review requests; empty leaves auto-review off. */
    reviewProvider: string;
    /** Model on that provider; empty picks its first listed model. */
    reviewModel: string;
}
/** Service behind `ctx.cliBridge`. */
export default class CliBridge extends Service {
    private readonly config;
    static inject: string[];
    static Config: z<Config>;
    private readonly registry;
    private readonly catalog;
    /** Ends any model probe still running when this plugin goes away. */
    private readonly probes;
    private readonly askPolicy;
    private readonly loginPath;
    constructor(ctx: Context, config: Config);
    /** Read in the background: the menu works without it, and fills in once it arrives. */
    private restoreModels;
    /** The harness's home, or `~/.dsh` when it does not say. */
    private homePath;
    /**
     * The 变更 panel's git routes and the composer's mode route. Taken as optional
     * dependencies: a harness without a web server (a headless run) still gets the CLIs,
     * just not the panel's backend.
     */
    private serveWebRoutes;
    /**
     * The file access the Agent CLI panel needs: it reads a CLI's config and its skills
     * directories, and rewrites the one JSON file an MCP removal edits. Kept apart from
     * {@link serveWebRoutes} so that method stays short enough to follow.
     */
    private cliFileAccess;
    /**
     * The native modes to show for a session. A live CLI's own report wins; before it starts,
     * the catalog's last answer for that route fills in.
     */
    private modeState;
    /**
     * Switch a session's CLI mode. A pick made before the CLI starts is only stored, so it is
     * checked here against what that CLI reported; an id it never offered would otherwise wait
     * for the first message and fail there.
     */
    private switchMode;
    private registerRoutes;
    private firstModel;
    /**
     * The reviewer's route, only ever the one the user configured. The review carries the
     * conversation, so picking a provider on the user's behalf would send their code, and the
     * bill, somewhere they never chose. A CLI route would hand the review back to this adapter.
     */
    private reviewRoute;
    /**
     * Reviewer calls arrive stamped with the main agent's CLI route. Re-route them
     * to a stateless provider, keeping the frozen request intact, so the review
     * policy and history never become a `session/prompt` in the user's CLI turn. The
     * reasoning level stays behind: it was chosen for the CLI's model, and the harness
     * refuses a level the reviewer's model does not offer.
     */
    private auxiliaryStream;
    private followSessions;
    /**
     * Answer one CLI permission request. The CLI decided to ask; the harness's own access
     * mode must not answer it on the user's behalf, so a "never ask" stance is lifted while
     * the question is open (see session/approval-policy.ts).
     */
    private ask;
    private openTransport;
    /**
     * The temporary session goes in a directory of its own, away from the user's projects.
     * Some CLIs keep a folder per working directory even for a deleted session, so this one
     * never changes: a new directory on every start would add a folder each time. It is under
     * the harness's home rather than the system temp directory, where on a shared machine
     * another user could plant a project config at a predictable path for a CLI to load.
     */
    private probeProvider;
    /** Looked up on each read: the attachment service can come and go while the plugin runs. */
    private readImage;
    private createSession;
}
