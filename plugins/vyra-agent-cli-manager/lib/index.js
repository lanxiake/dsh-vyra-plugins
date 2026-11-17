/**
 * Host plugin: registers each configured CLI as a model provider and wires the
 * session registry to the harness.
 * @module vyra-agent-cli-manager
 */
import { readFile, readdir } from 'node:fs/promises';
import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Service } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { LlmError } from '@deepseek-ai/dsh-llm';
import { CliBridgeAdapter } from "./adapter.js";
import { CliSession } from "./cli-session.js";
import { createCliTool } from "./cli-tool.js";
import { CLI_TOOL_NAME, cliRoute, isCliRoute } from "./constants.js";
import { ModelCacheFile } from "./model-cache.js";
import { CliModelCatalog } from "./model-catalog.js";
import { registerModeRoute } from "./mode-routes.js";
import { probeModels } from "./model-probe.js";
import { npxCacheDir, startFromNpxCache } from "./npx-cache.js";
import { cliHandler, registerCliRoutes } from "./cli/cli-routes.js";
import { writeFileAtomically } from "./cli/atomic-write.js";
import { hostOfSubprocess } from "./cli/detect.js";
import { npmLatestVersion } from "./cli/registry-status.js";
import { runnerOfSpawn } from "./cli/upgrade.js";
import { gitHandler, registerGitRoutes } from "./git/git-routes.js";
import { readPtcWrap } from "./session/ptc-call.js";
import { CliAskPolicy } from "./session/approval-policy.js";
import { CliSessionRegistry } from "./session-registry.js";
import { openStdioTransport } from "./stdio-transport.js";
import { startOnWindows } from "./windows-command.js";
import { LoginPath, diskDirs, runShell } from "./login-path.js";
/**
 * Shown to turns cut off when this plugin stops. Besides shutdown, the harness restarts a
 * plugin whose files changed, which takes every CLI it started down with it.
 */
const PLUGIN_STOPPED_REASON = 'vyra-agent-cli-manager 插件已停止或重新加载（例如插件更新后），这条回复没有完成，请重新发送。';
const PLUGIN_HOME = 'vyra-agent-cli-manager';
const MODEL_CACHE_FILE = 'models.json';
const MODEL_PROBE_DIR = 'model-probe';
const REVIEW_ROUTE_UNSET = '「EXP 自动审查」需要一个独立的审查模型，插件不会替你挑选：请在插件配置里设置 reviewProvider（以及可选的 reviewModel），或用 /permission 改用其它访问模式。';
const REVIEW_ROUTE_IS_CLI = '「EXP 自动审查」的 reviewProvider 不能是 CLI，请设置为 DeepSeek 等非 CLI 的模型提供方。';
const REVIEW_MODEL_MISSING = '「EXP 自动审查」读不到 reviewProvider 的模型列表，无法确定审查模型：请在插件配置里设置 reviewModel，或检查该提供方的配置。';
/** Service behind `ctx.cliBridge`. */
export default class CliBridge extends Service {
    config;
    static inject = ['llm', 'agents', 'subprocess', 'tools'];
    static Config = z.object({
        agents: z
            .array(z.object({
            id: z.string().required(),
            name: z.string().required(),
            command: z.string().required(),
            args: z.array(z.string()).default([]),
            env: z.dict(z.string()).default({}),
        }))
            .default([]),
        disposeGraceMs: z.number().min(1).default(3_000),
        disposeEofGraceMs: z.number().min(1).default(6_000),
        cancelGraceMs: z.number().min(1).default(10_000),
        startTimeoutMs: z.number().min(1).default(120_000),
        reviewProvider: z.string().default(''),
        reviewModel: z.string().default(''),
    });
    registry;
    catalog;
    /** Ends any model probe still running when this plugin goes away. */
    probes = new AbortController();
    askPolicy = new CliAskPolicy((message) => this.ctx.logger.warn(message));
    loginPath;
    constructor(ctx, config) {
        super(ctx, 'cliBridge');
        this.config = config;
        this.loginPath = new LoginPath({
            platform: process.platform,
            env: process.env,
            home: homedir(),
            dirs: diskDirs,
            run: runShell,
            warn: (message) => ctx.logger.warn(message),
        });
        // Started first so the answer is likely in before the first CLI starts; until then the fallback holds.
        void this.loginPath.load(this.probes.signal);
        this.registry = new CliSessionRegistry(config.agents, {
            getAgent: (sessionId) => ctx.agents.get(sessionId),
            composedPreset: (agent) => ctx.get('agentPresets')?.composedPreset(agent.ctx),
            // Read per step: the runtime is another plugin's service and may be reloaded.
            ptcWrap: () => readPtcWrap(ctx.get('ptcRuntime')),
            ask: (agent, request, signal) => this.ask(agent, request, signal),
            warn: (message) => ctx.logger.warn(message),
            onCliSelected: (provider) => this.catalog.ensureListed(provider),
            createSession: (agent, sessionId, cwd, start) => this.createSession(agent, sessionId, cwd, start),
        });
        const modelCache = new ModelCacheFile(this.homePath(PLUGIN_HOME, MODEL_CACHE_FILE));
        this.catalog = new CliModelCatalog({
            labelFor: (provider) => this.registry.labelFor(provider),
            probe: (provider) => this.probeProvider(provider),
            onUpdated: (provider) => {
                ctx.emit('llm/models-updated', provider);
            },
            warn: (message) => ctx.logger.warn(message),
            save: (lists) => modelCache.save(lists),
        });
        this.restoreModels(modelCache);
        this.registerRoutes();
        this.followSessions();
        this.serveWebRoutes();
    }
    /** Read in the background: the menu works without it, and fills in once it arrives. */
    restoreModels(modelCache) {
        const { ctx, catalog, probes } = this;
        modelCache
            .read()
            .then((lists) => {
            if (!probes.signal.aborted)
                catalog.restore(lists);
        })
            .catch((error) => {
            ctx.logger.warn(`vyra-agent-cli-manager: could not read saved model lists: ${String(error)}`);
        });
    }
    /** The harness's home, or `~/.dsh` when it does not say. */
    homePath(...segments) {
        const resolveHome = this.ctx.get('dshHomePath') ?? ((...parts) => join(homedir(), '.dsh', ...parts));
        return resolveHome(...segments);
    }
    /**
     * The 变更 panel's git routes and the composer's mode route. Taken as optional
     * dependencies: a harness without a web server (a headless run) still gets the CLIs,
     * just not the panel's backend.
     */
    serveWebRoutes() {
        this.ctx.inject(['webServer', 'connection'], (child) => {
            const handler = gitHandler((spec) => child.subprocess.spawn(spec), child.connection, (message) => child.logger.warn(message));
            child.effect(() => registerGitRoutes(child.webServer, handler), 'vyra-agent-cli-manager: git routes');
            // The Agent CLI 管理 panel reads every CLI's installed state. Like the git routes it
            // registers only when the harness has a web server, so a headless run still gets the CLIs.
            const cli = cliHandler({
                host: hostOfSubprocess(child.subprocess),
                latest: npmLatestVersion(),
                run: runnerOfSpawn((spec) => child.subprocess.spawn(spec)),
                home: homedir(),
                ...this.cliFileAccess(),
            }, child.connection, (message) => child.logger.warn(message));
            child.effect(() => registerCliRoutes(child.webServer, cli), 'vyra-agent-cli-manager: cli routes');
            child.effect(() => registerModeRoute(child.webServer, {
                modeState: (sessionId, provider) => this.modeState(sessionId, provider),
                switchMode: (sessionId, provider, mode) => this.switchMode(sessionId, provider, mode),
            }, child.connection, (message) => child.logger.warn(message)), 'vyra-agent-cli-manager: mode route');
        });
    }
    /**
     * The file access the Agent CLI panel needs: it reads a CLI's config and its skills
     * directories, and rewrites the one JSON file an MCP removal edits. Kept apart from
     * {@link serveWebRoutes} so that method stays short enough to follow.
     */
    cliFileAccess() {
        return {
            readFile: async (path) => {
                try {
                    return await readFile(path, 'utf8');
                }
                catch {
                    // A CLI that has never been configured has no file; the caller reads that as empty.
                    return undefined;
                }
            },
            listDirectory: async (path) => {
                try {
                    return await readdir(path);
                }
                catch {
                    // No such directory means this CLI has no skills there yet.
                    return undefined;
                }
            },
            // Renamed over the target rather than written in place: a CLI reads this file on every
            // start, and a half-written one would lose every server the user configured.
            writeFile: (path, text) => writeFileAtomically(path, text),
        };
    }
    /**
     * The native modes to show for a session. A live CLI's own report wins; before it starts,
     * the catalog's last answer for that route fills in.
     */
    modeState(sessionId, provider) {
        const { modes, pending } = this.registry.modeStateFor(sessionId, provider);
        const known = modes ?? this.catalog.modesFor(provider);
        return { ...(known === undefined ? {} : { modes: known }), ...(pending === undefined ? {} : { pending }) };
    }
    /**
     * Switch a session's CLI mode. A pick made before the CLI starts is only stored, so it is
     * checked here against what that CLI reported; an id it never offered would otherwise wait
     * for the first message and fail there.
     */
    async switchMode(sessionId, provider, mode) {
        if (this.registry.isCliRoute(provider)) {
            const { modes } = this.modeState(sessionId, provider);
            if (modes === undefined)
                throw new LlmError('还没有读到这个 CLI 的模式列表，请稍后再试。', 'CLI_MODE_FAILED');
            if (!modes.options.some((option) => option.value === mode)) {
                throw new LlmError(`这个 CLI 没有报告模式 ${mode}。`, 'CLI_MODE_FAILED');
            }
        }
        return this.registry.switchMode(sessionId, provider, mode);
    }
    registerRoutes() {
        const { ctx, registry, catalog } = this;
        if (registry.providers.length > 0) {
            ctx.llm.registerAdapter([...registry.providers], new CliBridgeAdapter({
                labelFor: (provider) => registry.labelFor(provider),
                resolveSession: (provider, sessionId) => registry.resolveSession(provider, sessionId),
                ptcWrapFor: (provider, sessionId) => registry.ptcWrapFor(provider, sessionId),
                currentTurnMessageIds: (sessionId) => registry.currentTurnMessageIds(sessionId),
                modelsFor: (provider) => catalog.listModels(provider),
                modelName: (provider, model) => catalog.modelName(provider, model),
                reasoningFor: (provider, model) => catalog.reasoning(provider, model),
                auxiliaryStream: (options) => this.auxiliaryStream(options),
            }));
        }
        // Admitted only for steps a CLI runs, so no other model ever sees this tool, and a
        // CLI works from any mode without its calls needing a preset of their own.
        ctx.tools.register(createCliTool({ waitForTool: (exec) => registry.waitForTool(exec) }), {
            when: ({ modelSelection }) => registry.isCliRoute(modelSelection.provider),
        });
    }
    async firstModel(provider) {
        try {
            const models = await this.ctx.llm.listModels(provider);
            return models[0]?.id;
        }
        catch (error) {
            this.ctx.logger.warn(`vyra-agent-cli-manager: could not list models for ${provider}: ${String(error)}`);
            return undefined;
        }
    }
    /**
     * The reviewer's route, only ever the one the user configured. The review carries the
     * conversation, so picking a provider on the user's behalf would send their code, and the
     * bill, somewhere they never chose. A CLI route would hand the review back to this adapter.
     */
    async reviewRoute() {
        const { reviewProvider, reviewModel } = this.config;
        if (reviewProvider === '')
            throw new LlmError(REVIEW_ROUTE_UNSET, 'UNSUPPORTED_OPTION');
        if (isCliRoute(reviewProvider))
            throw new LlmError(REVIEW_ROUTE_IS_CLI, 'UNSUPPORTED_OPTION');
        const model = reviewModel === '' ? await this.firstModel(reviewProvider) : reviewModel;
        if (model === undefined)
            throw new LlmError(REVIEW_MODEL_MISSING, 'UNSUPPORTED_OPTION');
        return { provider: reviewProvider, model };
    }
    /**
     * Reviewer calls arrive stamped with the main agent's CLI route. Re-route them
     * to a stateless provider, keeping the frozen request intact, so the review
     * policy and history never become a `session/prompt` in the user's CLI turn. The
     * reasoning level stays behind: it was chosen for the CLI's model, and the harness
     * refuses a level the reviewer's model does not offer.
     */
    async *auxiliaryStream(options) {
        const route = await this.reviewRoute();
        const { reasoningEffort: _cliEffort, ...request } = options;
        yield* this.ctx.llm.stream({ ...request, provider: route.provider, model: route.model });
    }
    followSessions() {
        const { ctx, registry, probes } = this;
        ctx.on('agent/created', ({ agent }) => {
            registry.routeAgent(agent);
            return undefined;
        });
        // The Web client creates a session under the default preset and switches it
        // afterwards, so `agent/created` alone would miss the preset the user chose.
        // This event fires while the session is still publishing the preset change,
        // which rejects a nested append; the microtask runs just after, and still
        // before the first turn because the switch has not returned to its caller.
        ctx.on('agent-preset/selected', (sessionId) => {
            queueMicrotask(() => {
                const agent = ctx.agents.get(sessionId);
                if (agent === undefined)
                    return;
                try {
                    registry.routeAgent(agent);
                }
                catch (error) {
                    ctx.logger.warn(`vyra-agent-cli-manager: could not select the CLI for ${sessionId}: ${String(error)}`);
                }
            });
        });
        ctx.on('session/event', (session, event) => registry.observeEvent(session.id, event));
        ctx.on('agent/disposed', ({ agent }) => registry.disposeSession(agent.id));
        ctx.effect(() => () => {
            probes.abort();
            registry.disposeAll(PLUGIN_STOPPED_REASON);
        }, 'cliBridge.sessions()');
    }
    /**
     * Answer one CLI permission request. The CLI decided to ask; the harness's own access
     * mode must not answer it on the user's behalf, so a "never ask" stance is lifted while
     * the question is open (see session/approval-policy.ts).
     */
    ask(agent, { reason, callId }, signal) {
        const approval = this.ctx.get('approval');
        if (approval === undefined)
            return Promise.resolve('unavailable');
        return this.askPolicy.asking(approval, agent, () => approval.request({
            agent,
            toolName: CLI_TOOL_NAME,
            reason,
            signal,
            ...(callId === undefined ? {} : { callId: callId }),
        }));
    }
    openTransport(agent, cwd, handlers) {
        const fromCache = startFromNpxCache({ argv: [agent.command, ...agent.args], env: this.loginPath.apply(agent.env) }, {
            npxCache: npxCacheDir(process.env, homedir(), process.platform),
            path: process.env.PATH,
        });
        const { argv, env } = startOnWindows(fromCache, process.platform, process.env);
        return openStdioTransport({
            argv,
            cwd,
            env,
            graceMs: this.config.disposeGraceMs,
            eofGraceMs: this.config.disposeEofGraceMs,
            spawn: (spec) => this.ctx.subprocess.spawn(spec),
        }, handlers);
    }
    /**
     * The temporary session goes in a directory of its own, away from the user's projects.
     * Some CLIs keep a folder per working directory even for a deleted session, so this one
     * never changes: a new directory on every start would add a folder each time. It is under
     * the harness's home rather than the system temp directory, where on a shared machine
     * another user could plant a project config at a predictable path for a CLI to load.
     */
    async probeProvider(provider) {
        const agent = this.registry.configFor(provider);
        if (agent === undefined)
            return undefined;
        const { signal } = this.probes;
        const cwd = this.homePath(PLUGIN_HOME, MODEL_PROBE_DIR);
        await mkdir(cwd, { recursive: true });
        try {
            return await probeModels((handlers) => this.openTransport(agent, cwd, handlers), cwd, this.config.startTimeoutMs, signal);
        }
        catch (error) {
            if (signal.aborted)
                return undefined;
            throw error;
        }
    }
    /** Looked up on each read: the attachment service can come and go while the plugin runs. */
    async readImage(ref, signal) {
        const attachments = this.ctx.get('attachments');
        if (attachments === undefined)
            throw new Error('attachment service is not available');
        const { data } = await attachments.readImage(ref, signal);
        return data;
    }
    createSession(agent, sessionId, cwd, start) {
        const provider = cliRoute(agent.id);
        return new CliSession({
            dshSessionId: sessionId,
            provider,
            cwd,
            label: agent.name,
            sentMessageIds: start.sentMessageIds,
            after: start.after,
            cancelGraceMs: this.config.cancelGraceMs,
            startTimeoutMs: this.config.startTimeoutMs,
            knownModels: () => this.catalog.known(provider),
            ...(start.initialMode === undefined ? {} : { initialMode: start.initialMode }),
            ...(start.onModeRefused === undefined ? {} : { onModeRefused: start.onModeRefused }),
            onEfforts: (model, effort) => this.catalog.learnEfforts(provider, model, effort),
            onModes: (modes) => this.catalog.learnModes(provider, modes),
            readImage: (ref, signal) => this.readImage(ref, signal),
            onError: (error) => this.ctx.logger.warn(`vyra-agent-cli-manager: ${agent.name}: ${String(error)}`),
            openTransport: (handlers) => this.openTransport(agent, cwd, handlers),
        });
    }
}
