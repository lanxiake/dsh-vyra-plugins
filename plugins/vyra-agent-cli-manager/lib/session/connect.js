/**
 * Opening the ACP connection to a CLI and getting a session on it: a new one, or the
 * native session an earlier process left behind.
 * @module vyra-agent-cli-manager/session/connect
 */
const MS_PER_SECOND = 1000;
/**
 * Connect to the CLI and open or continue its session.
 * @param request - transport factory, handlers and what to continue.
 * @returns the session and whether continuing it failed.
 */
export async function openSession(request) {
    const { openTransport, handlers, cwd, nativeSessionId, model, onTransport } = request;
    const transport = openTransport(handlers);
    onTransport(transport);
    const { agentCapabilities } = await transport.initialize();
    const acceptsImages = agentCapabilities?.promptCapabilities?.image === true;
    if (nativeSessionId === undefined) {
        const { sessionId, configOptions } = await transport.newSession(cwd);
        model.adopt(configOptions, true);
        return { acpSessionId: sessionId, reattachFailed: false, acceptsImages };
    }
    const attached = await reattach(request, transport, nativeSessionId, {
        resume: agentCapabilities?.sessionCapabilities?.resume != null,
        load: agentCapabilities?.loadSession === true,
    });
    return { ...attached, acceptsImages };
}
async function reattach({ cwd, model, onError }, transport, sessionId, can) {
    try {
        if (can.resume) {
            model.adopt(await transport.resumeSession(sessionId, cwd), false);
            return { acpSessionId: sessionId, reattachFailed: false };
        }
        if (can.load) {
            // session/load replays the conversation as updates. No turn is active yet,
            // so the update handler drops them; the harness already has that history.
            model.adopt(await transport.loadSession(sessionId, cwd), false);
            return { acpSessionId: sessionId, reattachFailed: false };
        }
    }
    catch (error) {
        onError?.(error);
    }
    const { sessionId: fresh, configOptions } = await transport.newSession(cwd);
    model.adopt(configOptions, true);
    return { acpSessionId: fresh, reattachFailed: true };
}
/**
 * A stalled `npx` or a CLI waiting for a login would otherwise hang every later message too.
 * @param work - the startup to bound.
 * @param timeoutMs - how long it may take.
 * @returns the startup, rejected with a readable reason once the time is up.
 */
export async function withinStartTimeout(work, timeoutMs) {
    const { promise: timedOut, reject } = Promise.withResolvers();
    const seconds = Math.ceil(timeoutMs / MS_PER_SECOND);
    const timer = setTimeout(() => {
        reject(new Error(`等了 ${seconds} 秒没有响应`));
    }, timeoutMs);
    timer.unref();
    try {
        await Promise.race([work(), timedOut]);
    }
    finally {
        clearTimeout(timer);
    }
}
