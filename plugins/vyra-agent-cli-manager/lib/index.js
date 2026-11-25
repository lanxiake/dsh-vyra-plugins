/**
 * Host plugin: registers each configured CLI as a model provider and wires the
 * session registry to the harness.
 * @module dsh-vyra-agent-cli-manager
 */
import { createHash } from 'node:crypto';
import { cp, lstat, mkdir, readFile, readdir, rename, rm, rmdir, symlink, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Service } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { LlmError } from '@deepseek-ai/dsh-llm';
import { CliBridgeAdapter } from "./adapter.js";
import { CliSession } from "./cli-session.js";
import { createCliTool } from "./cli-tool.js";
import { CLI_TOOL_NAME, cliRoute, DEFAULT_MODEL_ID, isCliRoute } from "./constants.js";
import { ModelCacheFile } from "./model-cache.js";
import { CliModelCatalog } from "./model-catalog.js";
import { registerModeRoute } from "./mode-routes.js";
import { probeModels } from "./model-probe.js";
import { modelRoutesOf } from "./model-source.js";
import { npxCacheDir, startFromNpxCache } from "./npx-cache.js";
import { cliHandler, registerCliRoutes } from "./cli/cli-routes.js";
import { fetchRepositoryFile } from "./cli/github-file.js";
import { writeFileAtomically } from "./cli/atomic-write.js";
import { hostOfSubprocess } from "./cli/detect.js";
import { npmLatestVersion } from "./cli/registry-status.js";
import { runnerOfSpawn } from "./cli/upgrade.js";
import { gitHandler, registerGitRoutes } from "./git/git-routes.js";
import { MODEL_SOURCE_CLI, MODEL_SOURCE_DSH, isModelSource, modelEnvironment, readModelRoutes, resolveRoute } from "./model-source.js";
import { readPtcWrap } from "./session/ptc-call.js";
import { CliAskPolicy } from "./session/approval-policy.js";
import { CliSessionRegistry } from "./session-registry.js";
import { openStdioTransport, openDeferredStdioTransport } from "./stdio-transport.js";
import { startOnWindows } from "./windows-command.js";
import { LoginPath, diskDirs, runShell } from "./login-path.js";
/**
 * Shown to turns cut off when this plugin stops. Besides shutdown, the harness restarts a
 * plugin whose files changed, which takes every CLI it started down with it.
 */
const PLUGIN_STOPPED_REASON = 'dsh-vyra-agent-cli-manager 插件已停止或重新加载（例如插件更新后），这条回复没有完成，请重新发送。';
const PLUGIN_HOME = 'dsh-vyra-agent-cli-manager';
const MODEL_CACHE_FILE = 'models.json';
const MODEL_PROBE_DIR = 'model-probe';
const REVIEW_ROUTE_UNSET = '「EXP 自动审查」需要一个独立的审查模型，插件不会替你挑选：请在插件配置里设置 reviewProvider（以及可选的 reviewModel），或用 /permission 改用其它访问模式。';
const REVIEW_ROUTE_IS_CLI = '「EXP 自动审查」的 reviewProvider 不能是 CLI，请设置为 DeepSeek 等非 CLI 的模型提供方。';
const REVIEW_MODEL_MISSING = '「EXP 自动审查」读不到 reviewProvider 的模型列表，无法确定审查模型：请在插件配置里设置 reviewModel，或检查该提供方的配置。';
/** Said when a route points at a provider this harness does not offer, so nothing could be filled in. */
const UNKNOWN_PROVIDER = 'DSH 里没有这个模型提供方';
/** Said when the provider configured a credential that is nowhere to be found. */
const CREDENTIAL_MISSING = 'DSH 里读不到这个提供方配置的凭据';
/** Said when the provider never configured an endpoint of its own. */
const ENDPOINT_MISSING = '这个提供方在 DSH 里没有配置接口地址';
/**
 * Said when the route names no environment variables. A CLI that follows DSH on its own account
 * would otherwise be told the variable names of another vendor and break, so the route is only
 * applied when the names are written down beside it.
 */
const VARIABLES_MISSING = '插件配置里没有写这个 CLI 读哪个环境变量';
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
            // The model this CLI runs on when the user asks it to follow DSH: a provider the
            // harness already has configured, plus the variable names this CLI reads. Left out,
            // the CLI keeps its own configuration and the settings page offers no switch.
            models: z.object({
                provider: z.string().default(''),
                model: z.string().default(''),
                baseURL: z.string().default(''),
                apiKeyEnv: z.string().default(''),
                apiKeyEnvs: z.array(z.string()).default([]),
                baseURLEnv: z.string().default(''),
                modelEnv: z.string().default(''),
                defaultModel: z.string().default(''),
            }),
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
    /** The model each CLI follows DSH on, by CLI id; absent for a CLI that keeps its own. */
    modelRoutes = new Map();
    /** Source picked in the 设置 panel, by CLI id. Empty means nothing was picked this run. */
    modelSources = new Map();
    /** Told whenever the panel reports a source, so the catalog can relabel that CLI's menu. */
    sourceListeners = [];
    constructor(ctx, config) {
        super(ctx, 'cliBridge');
        this.config = config;
        this.modelRoutes = readModelRoutes(config.agents);
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
            modelSourceOf: (id) => this.modelSourceOf(id),
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
        this.trackModelSources();
        this.registerRoutes();
        this.followSessions();
        this.serveWebRoutes();
    }
    /** Keep the menu and the settings panel in step with the model source the user picked. */
    trackModelSources() {
        this.sourceListeners.push((id, source) => {
            this.modelSources = new Map([...this.modelSources, [id, source]]);
            this.announceFollowed(id);
        });
        for (const id of this.modelRoutes.keys())
            this.announceFollowed(id);
    }
    /**
     * Tell the catalog which model a CLI is pointed at, so its menu row says so. A CLI that
     * follows DSH shows the DSH model; one that does not goes back to its own default row.
     * @param id - the CLI id.
     */
    announceFollowed(id) {
        const provider = cliRoute(id);
        const declared = this.modelRoutes.get(id);
        const resolved = declared === undefined ? undefined : this.resolveModelRoute(declared, id);
        const follows = declared !== undefined &&
            this.modelSourceOf(id) === MODEL_SOURCE_DSH &&
            resolved !== undefined &&
            resolved.problem === undefined;
        if (!follows) {
            this.catalog.follow(provider, undefined);
            return;
        }
        this.catalog.follow(provider, resolved.model);
        // The route id is what the menu can show at once; the provider's own name replaces it
        // when it answers.
        void this.modelLabelOf(declared.provider, declared.model).then((name) => {
            if (name !== declared.model && this.modelSourceOf(id) === MODEL_SOURCE_DSH)
                this.catalog.follow(provider, name);
        });
    }
    /**
     * Ask the harness for one provider's display name, so the menu says "DeepSeek V4.1 Flash"
     * rather than the id a route was written with.
     * @param provider - the provider route the CLI follows.
     * @param model - the model id.
     * @returns the name, or the id when the provider does not answer.
     */
    async modelLabelOf(provider, model) {
        try {
            const models = await this.ctx.llm.listModels(provider);
            return models.find((candidate) => candidate.id === model)?.name ?? model;
        }
        catch {
            return model;
        }
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
            ctx.logger.warn(`dsh-vyra-agent-cli-manager: could not read saved model lists: ${String(error)}`);
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
            child.effect(() => registerGitRoutes(child.webServer, handler), 'dsh-vyra-agent-cli-manager: git routes');
            // The Agent CLI 管理 panel reads every CLI's installed state. Like the git routes it
            // registers only when the harness has a web server, so a headless run still gets the CLIs.
            const cli = cliHandler({
                host: hostOfSubprocess(child.subprocess),
                latest: npmLatestVersion(),
                run: runnerOfSpawn((spec) => child.subprocess.spawn(spec)),
                home: homedir(),
                ...this.cliFileAccess(),
                skills: this.cliSkillLinks(),
                skillInstall: this.cliSkillInstall(),
                skillConsolidate: this.cliSkillConsolidate(),
                models: this.modelPanel(),
            }, child.connection, (message) => child.logger.warn(message));
            child.effect(() => registerCliRoutes(child.webServer, cli), 'dsh-vyra-agent-cli-manager: cli routes');
            child.effect(() => registerModeRoute(child.webServer, {
                modeState: (sessionId, provider) => this.modeState(sessionId, provider),
                switchMode: (sessionId, provider, mode) => this.switchMode(sessionId, provider, mode),
            }, child.connection, (message) => child.logger.warn(message)), 'dsh-vyra-agent-cli-manager: mode route');
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
            // A prompt file the panel offers to create may have no directory yet — the harness
            // ships no global instruction file at all — so the write creates what it needs.
            ensureDirectory: async (path) => { await mkdir(path, { recursive: true }); },
        };
    }
    /**
     * The disk work a skill link needs: create one, remove one, and say what an entry is.
     * Kept apart from {@link cliFileAccess} because these are the only operations here that write
     * a filesystem entry rather than a file's contents.
     */
    cliSkillLinks() {
        return {
            kindOf: async (path) => {
                try {
                    const info = await lstat(path);
                    if (info.isSymbolicLink())
                        return 'link';
                    return info.isDirectory() ? 'dir' : 'other';
                }
                catch {
                    // Absent is the ordinary case: that skill is simply not turned on for this CLI.
                    return undefined;
                }
            },
            readFile: async (path) => {
                try {
                    return await readFile(path, 'utf8');
                }
                catch {
                    return undefined;
                }
            },
            listDirectory: async (path) => {
                try {
                    return await readdir(path);
                }
                catch {
                    return undefined;
                }
            },
            // A junction is the one link Windows can make without administrator rights, and it needs
            // an absolute target, which is what the caller passes on both platforms.
            link: (source, path) => process.platform === 'win32' ? symlink(source, path, 'junction') : symlink(source, path),
            // A junction is removed as a directory and a symlink as a file; trying both beats
            // branching on the platform, since which one it is depends on how the entry was made.
            remove: async (path) => {
                try {
                    await unlink(path);
                }
                catch {
                    await rmdir(path);
                }
            },
            mkdir: async (path) => {
                await mkdir(path, { recursive: true });
            },
        };
    }
    /**
     * The disk work installing a skill needs, plus the one network read it makes.
     *
     * The repository read goes through the GitHub contents API rather than a clone: a skill is one
     * small text file, and cloning a repository to read one of them would download everything else
     * with it and leave a checkout to clean up. The API answers base64, and an unauthenticated call
     * is rate-limited per IP — acceptable here, because this runs when a user presses a button, not
     * in a loop, and the failure is reported rather than retried.
     */
    cliSkillInstall() {
        return {
            readFile: async (path) => {
                try {
                    return await readFile(path, 'utf8');
                }
                catch {
                    return undefined;
                }
            },
            writeFile: (path, text) => writeFileAtomically(path, text),
            listDirectory: async (path) => {
                try {
                    return await readdir(path);
                }
                catch {
                    return undefined;
                }
            },
            link: (source, path) => process.platform === 'win32' ? symlink(source, path, 'junction') : symlink(source, path),
            kindOf: async (path) => {
                try {
                    const info = await lstat(path);
                    if (info.isSymbolicLink())
                        return 'link';
                    return info.isDirectory() ? 'dir' : 'other';
                }
                catch {
                    return undefined;
                }
            },
            removeEntry: async (path) => {
                try {
                    await unlink(path);
                }
                catch {
                    await rmdir(path);
                }
            },
            removeTree: async (path) => {
                await rm(path, { recursive: true, force: true });
            },
            fetchRepositoryFile: (repository, path) => fetchRepositoryFile(repository, path),
        };
    }
    /**
     * The disk work consolidating scattered skill copies needs.
     *
     * `copyTree` deletes the destination first: `cp` merges into an existing directory rather than
     * replacing it, so a library copy that is already there would keep files the incoming version
     * no longer has — two versions mixed in one directory, which is the failure this operation
     * exists to prevent. `link` uses a junction on Windows, the one link kind that needs no
     * administrator rights and accepts a directory target.
     */
    cliSkillConsolidate() {
        return {
            listCopies: async (root) => {
                let entries;
                try {
                    entries = await readdir(root, { withFileTypes: true });
                }
                catch {
                    // A CLI that has never been installed has no skills directory.
                    return [];
                }
                const found = [];
                for (const entry of entries) {
                    if (!entry.isDirectory())
                        continue;
                    const dir = join(root, entry.name);
                    // A directory without the entry file is not a skill: a backup, or the user's notes.
                    if ((await readFile(join(dir, SKILL_ENTRY), 'utf8').catch(() => undefined)) === undefined)
                        continue;
                    found.push({ name: entry.name, copy: { owner: '', path: dir, ...(await fingerprintTree(dir)) } });
                }
                return found;
            },
            kindOf: async (path) => {
                try {
                    const info = await lstat(path);
                    if (info.isSymbolicLink())
                        return 'link';
                    return info.isDirectory() ? 'dir' : 'file';
                }
                catch {
                    return undefined;
                }
            },
            copyTree: async (from, to) => {
                await rm(to, { recursive: true, force: true });
                await mkdir(to, { recursive: true });
                await cp(from, to, { recursive: true });
            },
            rename: (from, to) => rename(from, to),
            removeTree: async (path) => {
                await rm(path, { recursive: true, force: true });
            },
            link: (target, path) => process.platform === 'win32' ? symlink(target, path, 'junction') : symlink(target, path),
        };
    }
    /**
     * What the settings page needs to show each CLI's model source: the route the patch file
     * declared, the endpoint and credential it resolves to, and the source in effect now.
     *
     * The source is stored by the browser, which is where the user picked it; this side only
     * remembers what the last report said, so a restart of this plugin does not reset a choice
     * the page will report again as soon as it opens.
     */
    modelPanel() {
        return {
            list: () => this.registry.providers.flatMap((route) => {
                const agent = this.registry.configFor(route);
                const declared = agent === undefined ? undefined : this.modelRoutes.get(agent.id);
                if (agent === undefined || declared === undefined)
                    return [];
                const resolved = this.resolveModelRoute(declared, agent.id);
                return [{
                        id: agent.id,
                        name: agent.name,
                        source: this.modelSourceOf(agent.id),
                        provider: declared.provider,
                        model: declared.model,
                        endpoint: resolved.endpoint === undefined ? null : resolved.endpoint,
                        endpointFromDSH: resolved.endpointFromDSH,
                        credential: resolved.credential,
                        problem: resolved.problem ?? null,
                    }];
            }),
            choose: (id, source) => {
                if (!this.modelRoutes.has(id) || !isModelSource(source))
                    return false;
                for (const listener of this.sourceListeners)
                    listener(id, source);
                return true;
            },
        };
    }
    /** The source a CLI runs on now: the one the panel reported, or the one the patch file implies. */
    modelSourceOf(id) {
        return this.modelSources.get(id) ?? (this.modelRoutes.has(id) ? MODEL_SOURCE_DSH : MODEL_SOURCE_CLI);
    }
    /**
     * Fill a configured route in from the harness's own provider settings. Both halves are read
     * per call, because either plugin can be reloaded while this one keeps running.
     * @param declared - the route the patch file declared.
     * @param id - the CLI id the route belongs to.
     * @returns the endpoint in use, whether it came from the harness, and what stops it working.
     */
    resolveModelRoute(declared, id) {
        const entry = this.providerEntry(declared.provider);
        const resolved = resolveRoute(declared, () => entry?.entry);
        const endpoint = resolved.baseURL ?? declared.providerBaseURL;
        const credential = resolved.apiKeyEnv;
        const variables = modelRoutesOf(this.config.agents, id);
        const namesWritten = variables !== undefined && variables.baseURLEnv !== '' && variables.modelEnv !== '';
        const problem = !namesWritten
            ? VARIABLES_MISSING
            : endpoint === undefined
                ? UNKNOWN_PROVIDER
                : entry?.entry === undefined
                    ? ENDPOINT_MISSING
                    : credential === undefined
                        ? CREDENTIAL_MISSING
                        : undefined;
        return {
            ...resolved,
            ...(endpoint === undefined ? {} : { endpoint }),
            endpointFromDSH: entry?.entry?.baseURL === endpoint,
            ...(credential === undefined ? {} : { credential }),
            ...(problem === undefined ? {} : { problem }),
        };
    }
    /**
     * The harness's profile for one provider: its address and the credential name it reads.
     * Read from the live provider plugin's config, which is where a route the CLI follows
     * would otherwise have to repeat an address the user already entered once.
     * @param provider - the provider route a CLI follows.
     * @returns the profile and its entry, or undefined for a provider this harness does not offer.
     */
    providerEntry(provider) {
        if (isCliRoute(provider) || provider === '')
            return undefined;
        const profiles = this.ctx.get('llm')?.listConfigurableProviders?.() ?? [];
        const chosen = profiles.find((candidate) => candidate.provider === provider);
        if (chosen === undefined)
            return undefined;
        const entry = this.ctx.get('configEditor')?.entries?.().find((candidate) => candidate.options?.id === chosen.settingsNs);
        const values = entry === undefined ? undefined : this.providerValues(entry);
        return { entry: chosen, baseURL: values?.baseURL, apiKeyEnv: values?.apiKeyEnv };
    }
    /**
     * Read one provider's fields out of its own plugin config, walking the `settingsPath` the
     * provider declared, since a provider plugin keeps all its routes in one dictionary.
     * @param entry - the provider plugin's loader entry.
     * @returns the address and credential name it would use.
     */
    providerValues(entry) {
        const node = this.ctx.get('configEditor')?.configuration()?.find((row) => row.entry === entry)?.override;
        const profile = this.providerProfile(node);
        return profile === undefined ? undefined : { baseURL: profile.baseURL, apiKeyEnv: profile.apiKeyEnv };
    }
    /**
     * Find the profile object inside a provider plugin's config. The shape differs per plugin —
     * one keeps a `providers` dictionary, another holds the route's fields directly — so the
     * value is located by the fields it has rather than by where it sits.
     * @param node - the provider plugin's own config object.
     * @returns the profile, or undefined when the config holds none.
     */
    providerProfile(node) {
        const seen = new Set();
        const walk = (value, depth) => {
            if (typeof value !== 'object' || value === null || depth > 4 || seen.has(value))
                return undefined;
            seen.add(value);
            if (!Array.isArray(value) && typeof value.baseURL === 'string')
                return value;
            for (const child of Object.values(value)) {
                const found = walk(child, depth + 1);
                if (found !== undefined)
                    return found;
            }
            return undefined;
        };
        return walk(node, 0);
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
            this.ctx.logger.warn(`dsh-vyra-agent-cli-manager: could not list models for ${provider}: ${String(error)}`);
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
                    ctx.logger.warn(`dsh-vyra-agent-cli-manager: could not select the CLI for ${sessionId}: ${String(error)}`);
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
    /**
     * Start one CLI. When the user made it follow DSH, the environment is extended with the
     * variables that CLI reads, so it talks to the provider the user configured instead of its
     * own account. A route that cannot be resolved is reported and left out rather than guessed
     * around: the CLI then starts the way it always did.
     *
     * Reading the credential is asynchronous while the ACP client needs its pipes at once, so
     * the spawn is deferred behind that lookup; a CLI that keeps its own configuration starts
     * on the ordinary path, with nothing extra waited for.
     * @param agent - the CLI to start.
     * @param cwd - its working directory.
     * @param handlers - the transport's callbacks.
     * @param modelId - the model selected for this step, or `default` for the CLI's own.
     */
    openTransport(agent, cwd, handlers, modelId) {
        const fromCache = startFromNpxCache({ argv: [agent.command, ...agent.args], env: this.loginPath.apply(agent.env) }, {
            npxCache: npxCacheDir(process.env, homedir(), process.platform),
            path: process.env.PATH,
        });
        const { argv, env } = startOnWindows(fromCache, process.platform, process.env);
        const grace = { graceMs: this.config.disposeGraceMs, eofGraceMs: this.config.disposeEofGraceMs };
        const spawn = (spec) => this.ctx.subprocess.spawn(spec);
        if (this.modelSourceOf(agent.id) !== MODEL_SOURCE_DSH)
            return openStdioTransport({ argv, cwd, env, ...grace, spawn }, handlers);
        return openDeferredStdioTransport({ argv, cwd, env: () => this.modelEnvironmentFor(agent, modelId, env), ...grace, spawn }, handlers);
    }
    /**
     * The environment one CLI should start with, once the model source is applied.
     * @param agent - the CLI to start.
     * @param modelId - the model selected for this step, or `default` for the CLI's own.
     * @param env - the environment resolved so far.
     * @returns that environment; the CLI starts unchanged when it keeps its own configuration.
     */
    async modelEnvironmentFor(agent, modelId, env) {
        const { variables, problem } = this.adapterVariables(agent);
        const declared = this.modelRoutes.get(agent.id);
        if (declared === undefined || problem !== undefined) {
            this.ctx.logger.warn(`dsh-vyra-agent-cli-manager: ${agent.name} 无法跟随 DSH 的模型（${problem ?? UNKNOWN_PROVIDER}），按它自己的配置启动。`);
            return env;
        }
        const resolved = this.resolveModelRoute(declared, agent.id);
        if (resolved.problem !== undefined) {
            this.ctx.logger.warn(`dsh-vyra-agent-cli-manager: ${agent.name} 无法跟随 DSH 的模型（${resolved.problem}），按它自己的配置启动。`);
            return env;
        }
        const apiKey = await this.resolveApiKey(agent, resolved);
        return { ...env, ...modelEnvironment(resolved, modelId ?? DEFAULT_MODEL_ID, apiKey, variables) };
    }
    /**
     * The variable names this CLI reads, as configured beside its route. A route without names
     * is one whose CLI is configured some other way (a project config file, say); following DSH
     * would then only change the model id, so the route is treated as unusable instead.
     * @param agent - the CLI whose route is being applied.
     * @returns the names, and why they cannot be used when they cannot.
     */
    adapterVariables(agent) {
        const models = modelRoutesOf(this.config.agents, agent.id);
        const variables = {
            ...(models?.baseURLEnv === '' || models?.baseURLEnv === undefined ? {} : { baseURL: { name: models.baseURLEnv } }),
            ...(models?.apiKeyEnv === '' || models?.apiKeyEnv === undefined ? {} : { apiKeyEnv: { name: models.apiKeyEnv } }),
            ...(models?.modelEnv === '' || models?.modelEnv === undefined ? {} : { modelEnv: { name: models.modelEnv } }),
            ...(models === undefined || models.defaultModel === '' ? {} : { defaultModel: models.defaultModel }),
        };
        if (models === undefined || variables.baseURL === undefined || variables.modelEnv === undefined) {
            return { variables, problem: VARIABLES_MISSING };
        }
        const apiKeyEnvs = models.apiKeyEnvs.map((name) => ({ name }));
        return { variables: apiKeyEnvs.length === 0 ? variables : { ...variables, apiKeyEnvs }, problem: undefined };
    }
    /**
     * The credential a route names, through the harness's credential service, so a key the user
     * stored with DSH is found without being copied anywhere. Looked up per start: a key the user
     * replaces takes effect on the next CLI, not after a restart.
     * @param agent - the CLI being started, for the log line only.
     * @param route - the resolved route.
     * @returns the secret, or undefined when none is stored.
     */
    resolveApiKey(agent, route) {
        const credentials = this.ctx.get('credentials');
        if (route.apiKeyEnv === undefined || credentials === undefined)
            return Promise.resolve(undefined);
        return credentials.resolve(route.apiKeyEnv).then((resolved) => resolved?.value, (error) => {
            this.ctx.logger.warn(`dsh-vyra-agent-cli-manager: 读不到 ${agent.name} 需要的凭据 ${route.apiKeyEnv}：${String(error)}`);
            return undefined;
        });
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
            // A CLI that follows DSH is asked about the model it will actually run, not about
            // whichever one its own account would pick; the answer fills the menu either way.
            return await probeModels((handlers) => this.openTransport(agent, cwd, handlers, DEFAULT_MODEL_ID), cwd, this.config.startTimeoutMs, signal);
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
            onError: (error) => this.ctx.logger.warn(`dsh-vyra-agent-cli-manager: ${agent.name}: ${String(error)}`),
            // The model this step selected, so a CLI pointed at a DSH provider is told which one
            // before it starts; a CLI already running is moved with `session/set_config_option`.
            modelOfStep: () => start.modelId(),
            openTransport: (handlers) => this.openTransport(agent, cwd, handlers, start.modelId()),
        });
    }
}
/** A skill's entry file lives under this name, whatever the CLI. */
const SKILL_ENTRY = 'SKILL.md';
/**
 * Fingerprint a skill directory: every file's relative path and content hash, folded into one
 * digest, plus the totals a tie-break needs.
 *
 * Hashing the tree rather than the entry file is what makes "identical" mean identical — a skill
 * can carry scripts and references, and two copies whose instructions match while their resources
 * differ would lose something if one were linked over the other.
 * @param root - the skill's directory.
 * @returns the digest and the two numbers used to rank it against its peers.
 */
async function fingerprintTree(root) {
    const parts = [];
    let bytes = 0;
    let newest = 0;
    const walk = async (dir, prefix) => {
        let entries;
        try {
            entries = await readdir(dir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
            const path = join(dir, entry.name);
            const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
            if (entry.isDirectory()) {
                await walk(path, relative);
            }
            else if (entry.isFile()) {
                try {
                    const bytes_ = await readFile(path);
                    parts.push(`${relative}:${createHash('md5').update(bytes_).digest('hex')}`);
                    bytes += bytes_.length;
                    newest = Math.max(newest, (await lstat(path)).mtimeMs);
                }
                catch {
                    // A file that vanished mid-walk is left out rather than failing the whole fingerprint.
                }
            }
        }
    };
    await walk(root, '');
    return { digest: createHash('md5').update(parts.join('|')).digest('hex'), bytes, newest };
}
