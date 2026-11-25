/**
 * ACP over a child process's stdio, using the harness subprocess seam so the CLI
 * gets the shared credential scrub and managed teardown. Process teardown and SDK
 * wiring are adapted from `@deepseek-ai/dsh-subagent-acp`; see THIRD_PARTY_NOTICES.md.
 * @module dsh-vyra-agent-cli-manager/stdio-transport
 */
import { Readable, Writable } from 'node:stream';
import { client, methods, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk';
/** How long a closed pipe waits for the exit status before failing without it. */
const CLOSE_REASON_WAIT_MS = 1_000;
/**
 * stderr is collected rather than inherited: a CLI that dies before the protocol starts,
 * such as `npx` on a half-installed cache entry, writes its reason only there, and the
 * harness's own stderr is nowhere the user looks. The seam keeps the tail of this size.
 */
const STDERR_TAIL_BYTES = 4_096;
/** How much of that tail goes into the error shown to the user. */
const QUOTED_STDERR_CHARS = 800;
/** Windows reports a negative exit code as unsigned; npm and libuv print the signed one. */
const UNSIGNED_EXIT_FROM = 0x80_00_00_00;
const UNSIGNED_EXIT_RANGE = 0x1_00_00_00_00;
function exitCodeText(exitCode) {
    if (exitCode === null || exitCode < UNSIGNED_EXIT_FROM)
        return String(exitCode);
    return `${exitCode}（即 ${exitCode - UNSIGNED_EXIT_RANGE}）`;
}
function stderrTail(child) {
    const text = child.collected.stderr?.readFrom(0).text.trim() ?? '';
    return text.length > QUOTED_STDERR_CHARS ? text.slice(-QUOTED_STDERR_CHARS) : text;
}
function turnStderr(child) {
    const read = child.collected.stderr;
    let offset = 0;
    const advance = () => {
        if (read === undefined)
            return '';
        const { text, nextOffset } = read.readFrom(offset);
        offset = nextOffset;
        return text.trim();
    };
    return {
        mark: () => {
            advance();
        },
        take: () => {
            const text = advance();
            return text.length > QUOTED_STDERR_CHARS ? text.slice(-QUOTED_STDERR_CHARS) : text;
        },
    };
}
function describeExit(outcome, stderr) {
    const exit = outcome.signal === null ? `进程退出，退出码 ${exitCodeText(outcome.exitCode)}` : `进程被信号 ${outcome.signal} 终止`;
    return stderr === '' ? exit : `${exit}。它退出前的输出：${stderr}`;
}
async function exitsWithin(child, ms) {
    const controller = new AbortController();
    const timer = setTimeout(() => {
        controller.abort();
    }, ms);
    try {
        return await child.waitForExit(controller.signal);
    }
    finally {
        clearTimeout(timer);
    }
}
/** Stdin EOF gives the CLI a chance to flush its session before any signal. */
async function stopChild(child, eofGraceMs) {
    child.stdin?.end();
    if (await exitsWithin(child, eofGraceMs).catch(() => false))
        return;
    child.terminate();
    await child.waitForExit();
}
/** Prefer the exit status over a bare closed pipe, but do not hold up the failure for it. */
function closeReason(child) {
    const timeout = new Promise((resolve) => {
        setTimeout(() => {
            resolve(new Error('连接已关闭'));
        }, CLOSE_REASON_WAIT_MS).unref();
    });
    const exit = child.done.then((outcome) => new Error(describeExit(outcome, stderrTail(child))), (error) => (error instanceof Error ? error : new Error(String(error))));
    return Promise.race([exit, timeout]);
}
function spawnChild(spec) {
    const child = spec.spawn({
        argv: spec.argv,
        cwd: spec.cwd,
        stdio: { stdin: 'pipe', stdout: 'pipe', stderr: { maxBytes: STDERR_TAIL_BYTES } },
        graceMs: spec.graceMs,
        env: { ...spec.env },
    });
    if (child.stdin === undefined || child.stdout === undefined) {
        throw new Error('subprocess implementation dropped a piped protocol stream');
    }
    // A write racing the CLI's exit raises EPIPE here; the exit itself is reported through `done`.
    child.stdin.on('error', () => {
        /* EPIPE; the exit itself is reported through done */
    });
    return child;
}
/**
 * Watch for the end of the connection. A closed stdout ends the protocol for good, and it
 * can arrive well before the subprocess seam reports the exit. Call this ahead of connecting
 * so the reader registered here runs before the SDK's own, and `closing` is set by the time
 * the SDK rejects the requests in flight.
 * @returns a wrapper making a request reject once the connection is gone.
 */
function watchClose(child, handlers) {
    const closed = Promise.withResolvers();
    closed.promise.catch(() => {
        /* only keeps the rejection observed; untilClosed is the real consumer */
    });
    let closing;
    const beginClose = () => {
        closing ??= closeReason(child)
            .then((error) => {
            closed.reject(error);
            handlers.onClosed(error);
        })
            .catch(() => {
            // Requests already reject through `closed`. An unhandled rejection here would
            // take the whole harness down, which a handler bug must not do.
        });
    };
    child.stdout?.once('end', beginClose);
    child.done.then(beginClose, beginClose);
    // Once the connection is going down, callers get its reason instead of the
    // SDK's generic error, and `onClosed` has run before their rejection arrives.
    return (request) => Promise.race([request, closed.promise]).catch(async (error) => {
        if (closing !== undefined)
            await closed.promise;
        throw error;
    });
}
function connectAgent(child, handlers) {
    return client({ name: 'dsh-vyra-agent-cli-manager' })
        .onNotification(methods.client.session.update, ({ params }) => {
        handlers.onUpdate(params.update);
        return Promise.resolve();
    })
        .onRequest(methods.client.session.requestPermission, ({ params }) => handlers.onPermission(params))
        .connect(ndJsonStream(Writable.toWeb(child.stdin), Readable.toWeb(child.stdout))).agent;
}
function sessionOperations(agent, untilClosed, turnLog) {
    const { session } = methods.agent;
    return {
        newSession: (cwd) => untilClosed(agent.request(session.new, { cwd, mcpServers: [] })),
        resumeSession: async (sessionId, cwd) => {
            const { configOptions } = await untilClosed(agent.request(session.resume, { sessionId, cwd, mcpServers: [] }));
            return configOptions;
        },
        loadSession: async (sessionId, cwd) => {
            const { configOptions } = await untilClosed(agent.request(session.load, { sessionId, cwd, mcpServers: [] }));
            return configOptions;
        },
        setConfigOption: async (sessionId, configId, value) => {
            const { configOptions } = await untilClosed(agent.request(session.setConfigOption, { sessionId, configId, value }));
            return configOptions;
        },
        deleteSession: async (sessionId) => {
            await untilClosed(agent.request(session.delete, { sessionId }));
        },
        closeSession: async (sessionId) => {
            await untilClosed(agent.request(session.close, { sessionId }));
        },
        prompt: async (sessionId, blocks) => {
            turnLog.mark();
            const answer = await untilClosed(agent.request(session.prompt, { sessionId, prompt: [...blocks] }));
            const { stopReason, usage, _meta } = answer;
            // Read this turn only: the process may be replaced before anyone looks at
            // the failure, and a previous turn's log is no explanation for this one.
            // Nothing is added when there is nothing to add, so a plain turn keeps its
            // plain outcome.
            const stderr = turnLog.take();
            return {
                stopReason,
                usage,
                ...(_meta == null ? {} : { meta: _meta }),
                ...(stderr === '' ? {} : { stderr }),
            };
        },
        cancel: (sessionId) => {
            // Best effort: if the process is already gone, `closed` has reported it.
            agent.notify(session.cancel, { sessionId }).catch(() => {
                /* a gone process is reported by closed */
            });
        },
    };
}
/**
 * Start a CLI and connect to it. The returned operations reject once the process
 * is gone, because a request the CLI will never answer would otherwise hang.
 * @param spec - the command and its process settings.
 * @param handlers - callbacks from the CLI.
 * @returns the connected transport.
 */
export function openStdioTransport(spec, handlers) {
    const child = spawnChild(spec);
    const untilClosed = watchClose(child, handlers);
    const agent = connectAgent(child, handlers);
    let disposal;
    return {
        // No client capabilities are advertised: the CLI keeps using its own file
        // system and terminal, and the harness only observes what it reports.
        initialize: () => untilClosed(agent.request(methods.agent.initialize, {
            protocolVersion: PROTOCOL_VERSION,
            clientCapabilities: {},
        })),
        ...sessionOperations(agent, untilClosed, turnStderr(child)),
        dispose: (force = false) => {
            if (force)
                child.terminate();
            return (disposal ??= stopChild(child, spec.eofGraceMs));
        },
    };
}
/**
 * Spawn a CLI whose environment is only known after a lookup, such as the credential a
 * provider route names, then speak the protocol to it.
 *
 * The SDK's `connect()` reads its stream eagerly, and building that stream is what starts the
 * process, so the lookup has to finish first: nothing belongs on the wire before there is a
 * child. The ACP client therefore begins inside `initialize()`, which is the first thing the
 * transport contract asks for, and every operation waits for the same one-time start.
 * @param spec - the command and its process settings, with `env` resolved on demand.
 * @param handlers - callbacks from the CLI.
 * @returns the transport; its operations start the process on first use, or on dispose.
 */
export function openDeferredStdioTransport(spec, handlers) {
    let starting;
    let disposal;
    const start = () => (starting ??= Promise.resolve()
        .then(() => spec.env())
        .then((env) => {
        const child = spawnChild({ ...spec, env });
        const untilClosed = watchClose(child, handlers);
        const agent = client({ name: 'dsh-vyra-agent-cli-manager' })
            .onNotification(methods.client.session.update, ({ params }) => {
            handlers.onUpdate(params.update);
            return Promise.resolve();
        })
            .onRequest(methods.client.session.requestPermission, ({ params }) => handlers.onPermission(params))
            .connect(ndJsonStream(Writable.toWeb(child.stdin), Readable.toWeb(child.stdout))).agent;
        const operations = sessionOperations(agent, untilClosed, turnStderr(child));
        return { child, agent, untilClosed, operations };
    }));
    const withSession = (run) => start().then(run);
    const transport = {
        initialize: () => withSession(({ agent, untilClosed }) => untilClosed(agent.request(methods.agent.initialize, {
            protocolVersion: PROTOCOL_VERSION,
            clientCapabilities: {},
        }))),
        newSession: (cwd) => withSession(({ operations }) => operations.newSession(cwd)),
        resumeSession: (sessionId, cwd) => withSession(({ operations }) => operations.resumeSession(sessionId, cwd)),
        loadSession: (sessionId, cwd) => withSession(({ operations }) => operations.loadSession(sessionId, cwd)),
        setConfigOption: (sessionId, configId, value) => withSession(({ operations }) => operations.setConfigOption(sessionId, configId, value)),
        deleteSession: (sessionId) => withSession(({ operations }) => operations.deleteSession(sessionId)),
        closeSession: (sessionId) => withSession(({ operations }) => operations.closeSession(sessionId)),
        prompt: (sessionId, blocks) => withSession(({ operations }) => operations.prompt(sessionId, blocks)),
        // Fire and forget, as on the direct path: a gone process is reported by `closed`.
        cancel: (sessionId) => {
            void withSession(({ operations }) => {
                operations.cancel(sessionId);
            }).catch(() => undefined);
        },
        dispose: (force = false) => (disposal ??= start().then(({ child }) => {
            if (force)
                child.terminate();
            return stopChild(child, spec.eofGraceMs);
        }, () => undefined)),
    };
    // A start that fails is reported by whichever operation awaited it; this only keeps the
    // rejection from being reported as unhandled before one does.
    starting?.catch(() => undefined);
    return transport;
}
