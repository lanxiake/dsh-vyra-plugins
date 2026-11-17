/**
 * Asks a CLI which models it offers. ACP only reports them on a session, so this
 * opens one and removes it again. It sends no prompt, so no model is called.
 * @module vyra-agent-cli-manager/model-probe
 */
import { setTimeout as delay } from 'node:timers/promises';
import { abortable } from "./abortable.js";
import { readModelList } from "./model-options.js";
const IGNORING_HANDLERS = {
    onUpdate: () => {
        /* a probe only reads the model list */
    },
    onPermission: () => Promise.resolve({ outcome: { outcome: 'cancelled' } }),
    onClosed: () => {
        /* the caller's dispose handles the close */
    },
};
const CLEANUP_LIMIT_MS = 3_000;
/**
 * Otherwise every probe would leave an empty session in the CLI's history. Failing to
 * clean up does not make the answer any less true, so it gets its own short limit and
 * can never cost the list already in hand.
 */
async function discardSession(transport, sessionId, capabilities, limitMs) {
    const discarding = capabilities?.delete != null
        ? transport.deleteSession(sessionId)
        : capabilities?.close != null
            ? transport.closeSession(sessionId)
            : undefined;
    if (discarding === undefined)
        return;
    await Promise.race([
        discarding.catch(() => {
            /* a failed cleanup does not change the answer in hand */
        }),
        delay(limitMs, undefined, { ref: false }),
    ]);
}
/**
 * Runs behind the answer, because removing the session takes Pi seconds and exiting takes
 * Codex as long, with the user watching a menu that could already be filled.
 */
async function cleanUp(transport, discard, limitMs, signal) {
    await abortable(discard(limitMs), signal).catch(() => {
        /* a failed cleanup does not change the answer in hand */
    });
    await transport.dispose(signal?.aborted === true).catch(() => {
        /* likewise */
    });
}
async function askModels(transport, cwd) {
    const { agentCapabilities } = await transport.initialize();
    const { sessionId, configOptions } = await transport.newSession(cwd);
    return {
        list: readModelList(configOptions),
        discard: (limitMs) => discardSession(transport, sessionId, agentCapabilities?.sessionCapabilities, limitMs),
    };
}
/**
 * Start a CLI just long enough to read its model list.
 * @param open - starts the CLI.
 * @param cwd - working directory for the temporary session.
 * @param timeoutMs - how long to wait, which must allow for a cold `npx` download.
 * @param signal - stops the CLI at once when the bridge is shutting down.
 * @returns the model list, or undefined when the CLI offers none.
 */
export async function probeModels(open, cwd, timeoutMs, signal) {
    signal?.throwIfAborted();
    const transport = open(IGNORING_HANDLERS);
    const { promise: timedOut, reject } = Promise.withResolvers();
    const timer = setTimeout(() => {
        reject(new Error('超时，CLI 没有响应'));
    }, timeoutMs);
    const cleanupLimitMs = Math.min(CLEANUP_LIMIT_MS, timeoutMs / 2);
    try {
        const { list, discard } = await abortable(Promise.race([askModels(transport, cwd), timedOut]), signal);
        void cleanUp(transport, discard, cleanupLimitMs, signal).catch(() => {
            /* background cleanup; nobody to report to */
        });
        return list;
    }
    catch (error) {
        await transport.dispose(true).catch(() => {
            /* the original error is rethrown; a failed dispose must not replace it */
        });
        throw error;
    }
    finally {
        clearTimeout(timer);
    }
}
