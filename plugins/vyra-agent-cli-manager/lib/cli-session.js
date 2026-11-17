/**
 * One harness session's live CLI session. The harness thinks in steps, each one
 * model request plus its tools; a CLI thinks in turns that run many tools before
 * `session/prompt` returns. This class holds a CLI turn open across harness steps:
 * a step ends at every tool call, the mirror tool waits for the CLI's result, and
 * the next step resumes reading the same turn.
 * @module vyra-agent-cli-manager/cli-session
 */
import { randomUUID } from 'node:crypto';
import { LlmError } from '@deepseek-ai/dsh-llm';
import { abortable } from "./abortable.js";
import { AsyncQueue } from "./async-queue.js";
import { readEffortList, readModeList, readModelList } from "./model-options.js";
import { nativeReplayState, readNativeSession, unseenUserInput } from "./request-input.js";
import { toPromptBlocks } from "./prompt-images.js";
import { openSession, withinStartTimeout } from "./session/connect.js";
import { driveTool } from "./session/drive-tool.js";
import { EffortState } from "./session/effort-state.js";
import { ModeState } from "./session/mode-state.js";
import { ModelState } from "./session/model-state.js";
import { errorMessage } from "./session/outcomes.js";
import { CANCELLED, PermissionQueue } from "./session/permission-queue.js";
import { readStep } from "./session/read-step.js";
import { startHint } from "./session/start-hint.js";
import { ToolMirror } from "./session/tool-mirror.js";
import { TurnQueue } from "./session/turn-queue.js";
const DEFAULT_CANCEL_GRACE_MS = 10_000;
const DEFAULT_START_TIMEOUT_MS = 120_000;
const DEFAULT_TOOL_SETTLE_MS = 1_000;
const NEVER_ABORTED = new AbortController().signal;
/** Live bridge between one harness session and one CLI session. */
export class CliSession {
    options;
    events = new AsyncQueue();
    label;
    startTimeoutMs;
    tools;
    permissions = new PermissionQueue();
    model;
    effort;
    mode;
    turns;
    seen;
    transport;
    started;
    acpSessionId;
    /** Whether the CLI declared image support when it connected. */
    acceptsImages = false;
    /** The CLI cannot see this conversation, and the user has not been told yet. */
    owesFreshNotice = false;
    failure;
    disposeRequested = false;
    /** This dead session holds user input it can no longer deliver. */
    owesInput = false;
    /** Levels the CLI reported, by model, not yet passed on; see `onEfforts`. */
    heldEfforts = new Map();
    constructor(options) {
        this.options = options;
        this.label = options.label;
        this.startTimeoutMs = options.startTimeoutMs ?? DEFAULT_START_TIMEOUT_MS;
        this.seen = options.sentMessageIds ?? new Set();
        this.model = new ModelState(options.knownModels, (reported, isNewSession) => this.noteOptions(reported, isNewSession));
        this.effort = new EffortState((reported) => this.model.observe(reported));
        this.mode = new ModeState(() => options.knownModels?.()?.modes, (reported) => this.model.observe(reported), options.initialMode);
        this.tools = new ToolMirror({
            mintCallId: options.mintCallId ?? (() => `cli-${randomUUID()}`),
            settleMs: options.toolSettleMs ?? DEFAULT_TOOL_SETTLE_MS,
            onReady: (acpId) => {
                this.events.push({ type: 'tool-ready', acpId });
            },
        });
        this.turns = new TurnQueue({
            target: () => {
                const { transport, acpSessionId } = this;
                if (this.failure !== undefined || transport === undefined || acpSessionId === undefined)
                    return undefined;
                return { transport, acpSessionId };
            },
            onSend: (prompt) => {
                this.seen = new Set([...this.seen, ...prompt.ids]);
            },
            onEnd: (event, wasCancelling) => {
                this.tools.failOpen();
                this.permissions.cancelAll();
                this.releaseEfforts();
                if (!wasCancelling)
                    this.events.push(event);
            },
            onCancelTimeout: () => {
                this.dispose(true).catch((error) => this.options.onError?.(error));
            },
            cancelGraceMs: options.cancelGraceMs ?? DEFAULT_CANCEL_GRACE_MS,
        });
    }
    /** Whether this session can no longer run turns. */
    get dead() {
        return this.failure !== undefined;
    }
    /**
     * Whether a dead session can be replaced. While its failure is unread it stays,
     * so the next step reports why the CLI died instead of quietly starting another.
     */
    get replaceable() {
        return this.dead && this.events.size === 0;
    }
    /** Ids of the user messages this session or its predecessors sent to a CLI. */
    get sentMessageIds() {
        return this.seen;
    }
    /** The CLI's own modes, exactly as it last reported them. */
    get modes() {
        return this.mode.current();
    }
    /** A mode the user picked that the CLI has not confirmed yet. */
    get pendingMode() {
        return this.mode.pending;
    }
    /**
     * Switch the CLI to one of its own modes, by the id the CLI itself reported. Before the
     * CLI has started there is nothing to change, so the pick waits for the first step.
     * @param mode - the mode id, unchanged.
     * @param signal - cancellation for the wait.
     * @returns the modes as the CLI now reports them, or the known list when it has not started.
     * @throws when the CLI never offered that mode, or refuses the change.
     */
    async switchMode(mode, signal) {
        this.mode.choose(mode);
        const { transport, acpSessionId, label } = this;
        if (transport === undefined || acpSessionId === undefined)
            return this.mode.current();
        return this.mode.apply({ transport, acpSessionId, label }, signal);
    }
    /**
     * Run one harness step: send any new user input, then read until the next tool
     * call or the end of the CLI turn.
     * @param request - the derived history and cancellation for this step.
     * @yields the step's stream chunks, ending with `finish`.
     */
    async *stream(request) {
        const { signal, ptc } = request;
        signal?.throwIfAborted();
        if (this.failure === undefined) {
            await this.prepareStep(request);
            yield* this.readStep(signal, ptc);
            return;
        }
        if (this.events.size === 0)
            throw this.failure;
        // The turn being read may look finished. If this request's input never reached
        // the CLI, a clean finish would swallow the message with nothing on screen. This
        // is remembered because a tool call read here moves the message out of the window
        // `unseenUserInput` looks at, and the next step could no longer tell.
        this.owesInput ||= this.unsentInput(request).blocks.length > 0;
        yield* this.readStep(signal, ptc);
    }
    /**
     * Wait for the CLI's result of a published call. This is the body of the mirror
     * tool. It answers every open permission request, not only its own: a parent call
     * can be waiting on a child whose mirror cannot start until this one returns.
     * @param callId - the call id from the harness log.
     * @param ask - asks the harness about a blocked call.
     * @param signal - cancellation; aborting abandons the CLI turn.
     * @returns the finished call's outcome.
     */
    async waitForTool(callId, ask, signal) {
        const acpId = this.tools.acpIdFor(callId);
        if (acpId === undefined)
            throw new Error(`vyra-agent-cli-manager: 调用 ${callId} 不是这个 CLI 会话发出的`);
        this.tools.startMirror(acpId);
        try {
            const context = {
                tools: this.tools,
                permissions: this.permissions,
                label: this.label,
                turnSignal: () => this.turns.signal,
            };
            return await driveTool(context, { acpId, callId }, ask, signal ?? NEVER_ABORTED);
        }
        catch (error) {
            this.abandonTurn();
            throw error;
        }
        finally {
            this.tools.forget(acpId);
        }
    }
    /**
     * Stop whatever the CLI is doing for a harness turn that is over. The harness can
     * end a turn between steps, when no stream or mirror is there to notice, so this
     * is driven by the end of the harness turn. It does nothing on an idle session.
     */
    abandonTurn() {
        this.events.clear();
        this.turns.clearPending();
        this.permissions.cancelAll();
        this.tools.dropUnmirrored();
        const { acpSessionId } = this;
        if (this.turns.active && !this.turns.cancelling && acpSessionId !== undefined) {
            this.turns.beginCancel(() => this.transport?.cancel(acpSessionId));
        }
        this.turns.abortLifetime();
        this.tools.failOpen();
    }
    /**
     * Stop the CLI process and fail anything still waiting on it.
     * @param force - skip the wait for the CLI to exit by itself.
     * @param reason - why it is being stopped, shown to a turn it cuts off.
     */
    async dispose(force = false, reason) {
        this.disposeRequested = true;
        this.failure ??= new LlmError(reason === undefined ? `${this.label} 会话已关闭。` : `${this.label} 已停止：${reason}`, 'CLI_START_FAILED');
        this.settleFailure(this.failure);
        await this.transport?.dispose(force);
    }
    async prepareStep(request) {
        const { messages, signal } = request;
        this.rejectSkippedMirrors();
        await abortable(this.ensureStarted(messages), signal);
        if (this.turns.cancelling) {
            await abortable(this.turns.untilEnded(), signal);
            if (this.failure !== undefined) {
                throw new LlmError(`${this.label} 没有响应取消，已被结束。这条消息没有发送，请重新发送。`, 'CLI_PROMPT_FAILED');
            }
        }
        // The CLI can exit during either wait above, and a prompt queued on a dead
        // session would never go out, leaving this step waiting forever.
        if (this.failure !== undefined)
            throw this.failure;
        const input = this.unsentInput(request);
        if (input.blocks.length === 0)
            return;
        // Read before anything is committed, so a failed read leaves the step as if never run.
        const blocks = await this.promptBlocks(input, signal);
        // Steering joins a turn already under way, so only a fresh prompt can switch.
        if (!this.turns.busy) {
            await this.applySelection(request, signal);
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, @typescript-eslint/only-throw-error -- a callback may set failure during the await, which narrowing cannot see
            if (this.failure !== undefined)
                throw this.failure;
        }
        // Told only now because a failed switch ends the harness turn, which clears the queue,
        // and the user still needs to hear this when they send again.
        if (this.owesFreshNotice) {
            this.owesFreshNotice = false;
            this.pushFreshSessionNotice();
        }
        this.turns.enqueue({ ids: input.ids, blocks });
    }
    async promptBlocks(input, signal) {
        const resolution = { acceptsImages: this.acceptsImages, readImage: this.options.readImage };
        const blocks = await abortable(toPromptBlocks(input.blocks, resolution, signal), signal);
        // The CLI can exit while the images are read; a prompt queued then would never go out.
        if (this.failure !== undefined)
            throw this.failure;
        return blocks;
    }
    /** The model goes first: switching it can change which reasoning levels exist. */
    async applySelection({ model, reasoningEffort }, signal) {
        const { transport, acpSessionId, label } = this;
        if (transport === undefined || acpSessionId === undefined)
            return;
        await this.model.apply(model, { transport, acpSessionId, label }, signal);
        const kept = await this.effort.apply(reasoningEffort, { transport, acpSessionId, label }, signal);
        if (kept !== undefined && reasoningEffort !== undefined) {
            this.events.push({
                type: 'text',
                notice: true,
                text: `（${label} 当前模型不支持思考强度 ${reasoningEffort}，沿用 CLI 的 ${kept}。请在菜单里重新选择。）\n\n`,
            });
        }
        // A mode picked before the CLI started has had no session to change until now.
        const refusal = await this.mode.settle({ transport, acpSessionId, label }, signal);
        if (refusal !== undefined) {
            this.events.push({ type: 'text', notice: true, text: refusal.notice });
            this.options.onModeRefused?.(refusal.mode);
        }
    }
    /**
     * Every report of the CLI's options passes through the model state, and lands here. Only a
     * new session's modes go to the catalog: it speaks for sessions with no CLI yet, which start
     * where a new process does, not where this one was switched to.
     */
    noteOptions(options, isNewSession) {
        this.effort.observe(options);
        this.mode.observe(options);
        const fresh = isNewSession ? readModeList(options) : undefined;
        if (fresh !== undefined)
            this.options.onModes?.(fresh);
        const model = readModelList(options)?.current;
        if (model !== undefined)
            this.heldEfforts = new Map([...this.heldEfforts, [model, readEffortList(options)]]);
    }
    releaseEfforts() {
        const held = this.heldEfforts;
        this.heldEfforts = new Map();
        for (const [model, effort] of held)
            this.options.onEfforts?.(model, effort);
    }
    /** Steering still in the queue is not sent yet, but must not be queued a second time. */
    unsentInput({ messages, currentTurnMessageIds }) {
        const handled = new Set([...this.seen, ...this.turns.queuedIds]);
        return unseenUserInput(messages, handled, currentTurnMessageIds);
    }
    ensureStarted(messages) {
        if (this.started !== undefined)
            return this.started;
        // A conversation the new CLI session never saw: a replacement process, a fork, or
        // a session that started on another model. The user should know it starts blank.
        const startsBlind = this.seen.size > 0 || messages.some((message) => message.role === 'assistant');
        const nativeSessionId = readNativeSession(messages, this.options.dshSessionId, this.options.provider);
        this.started = this.connectInTime(nativeSessionId, startsBlind).catch((error) => {
            // Being stopped during startup is not a startup failure, and needs no install hint.
            const failure = this.disposeRequested && this.failure !== undefined
                ? this.failure
                : new LlmError(`无法启动 ${this.label}：${errorMessage(error)}。${startHint(errorMessage(error))}`, 'CLI_START_FAILED', { cause: error });
            this.failure = failure;
            this.transport?.dispose(true).catch((disposeError) => this.options.onError?.(disposeError));
            throw failure;
        });
        // An aborted step stops waiting for this; the rejection must not go unobserved.
        this.started.catch(() => {
            /* whoever awaits this.started handles the rejection */
        });
        return this.started;
    }
    connectInTime(nativeSessionId, startsBlind) {
        return withinStartTimeout(() => this.connect(nativeSessionId, startsBlind), this.startTimeoutMs);
    }
    async connect(nativeSessionId, startsBlind) {
        await this.options.after;
        // The registry no longer holds a session stopped during that wait, so a CLI
        // started now would have nobody to stop it.
        if (this.failure !== undefined)
            throw this.failure;
        const { acpSessionId, reattachFailed, acceptsImages } = await openSession({
            openTransport: this.options.openTransport,
            handlers: {
                onUpdate: (update) => this.handleUpdate(update),
                onPermission: (request) => this.handlePermission(request),
                onClosed: (error) => this.handleClosed(error),
            },
            cwd: this.options.cwd,
            nativeSessionId,
            model: this.model,
            onTransport: (transport) => {
                this.transport = transport;
            },
            onError: this.options.onError,
        });
        this.acpSessionId = acpSessionId;
        this.acceptsImages = acceptsImages;
        this.owesFreshNotice = reattachFailed || (nativeSessionId === undefined && startsBlind);
    }
    pushFreshSessionNotice() {
        this.events.push({
            type: 'text',
            notice: true,
            text: `（${this.label} 无法恢复之前的会话，已开始新会话，它不记得之前的内容。）\n\n`,
        });
    }
    handleUpdate(update) {
        if (update.sessionUpdate === 'config_option_update') {
            this.model.observe(update.configOptions);
            return;
        }
        // Outside a turn nothing is reading, and stale output would surface in the next
        // turn. While cancelling, the user has already left this turn behind.
        if (!this.turns.active || this.turns.cancelling)
            return;
        switch (update.sessionUpdate) {
            case 'agent_message_chunk':
            case 'agent_thought_chunk':
                if (update.content.type === 'text') {
                    const type = update.sessionUpdate === 'agent_message_chunk' ? 'text' : 'reasoning';
                    this.events.push({ type, text: update.content.text });
                }
                return;
            case 'tool_call':
                this.tools.reopen(update.toolCallId);
                this.tools.apply(update, false);
                return;
            case 'tool_call_update':
                if (!this.tools.isClaimed(update.toolCallId))
                    this.tools.apply(update, false);
                return;
            default:
        }
    }
    handlePermission(request) {
        if (!this.turns.active || this.turns.cancelling)
            return Promise.resolve(CANCELLED);
        const { toolCall, options } = request;
        const { promise, resolve } = Promise.withResolvers();
        this.permissions.add({ acpId: toolCall.toolCallId, options, resolve });
        // Its mirror may have been skipped earlier. Asking again reopens the call, and
        // its later updates must reach the new mirror.
        this.tools.reopen(toolCall.toolCallId);
        this.tools.apply(toolCall, true);
        return promise;
    }
    handleClosed(error) {
        this.failure ??= new LlmError(`${this.label} 已退出：${error.message}`, 'CLI_PROMPT_FAILED', { cause: error });
        this.settleFailure(this.failure);
    }
    settleFailure(failure) {
        this.turns.clearPending();
        this.turns.end({ type: 'failure', error: failure });
        this.tools.failOpen();
        this.permissions.cancelAll();
    }
    /**
     * A mirror can be denied by a policy or skipped by a stop before it runs, leaving
     * the CLI blocked on an answer nobody would give. By the next step the harness has
     * finished with the call, so a request still open for it is refused.
     */
    rejectSkippedMirrors() {
        for (const acpId of this.tools.skippedMirrors()) {
            this.permissions.rejectFor(acpId);
            this.tools.forget(acpId);
        }
    }
    hasWork() {
        return this.turns.busy || this.events.size > 0;
    }
    replayFields() {
        return this.acpSessionId === undefined
            ? {}
            : { replayState: nativeReplayState(this.acpSessionId, this.options.dshSessionId) };
    }
    readStep(signal, ptc) {
        return readStep({
            label: this.label,
            nextEvent: (stepSignal) => this.nextEvent(stepSignal),
            hasWork: () => this.hasWork(),
            owesInput: () => this.owesInput,
            failure: () => this.failure,
            handOff: (acpId) => {
                const record = this.tools.get(acpId);
                if (record !== undefined)
                    this.tools.handOff(acpId);
                return record;
            },
            replay: () => this.replayFields(),
            ...(ptc === undefined ? {} : { ptc }),
        }, signal);
    }
    async nextEvent(signal) {
        try {
            return await this.events.next(signal);
        }
        catch (error) {
            this.abandonTurn();
            throw error;
        }
    }
}
