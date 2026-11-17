/**
 * Abortable wait over a promise the caller does not own.
 * @module vyra-agent-cli-manager/abortable
 */
/**
 * Wait for a promise, giving up early when the signal aborts. The underlying
 * work keeps running; only this wait ends.
 * @param promise - the work to wait for.
 * @param signal - optional cancellation for the wait.
 * @returns the promise's value.
 */
export async function abortable(promise, signal) {
    if (signal === undefined)
        return promise;
    signal.throwIfAborted();
    const { promise: aborted, reject } = Promise.withResolvers();
    const onAbort = () => {
        reject(signal.reason);
    };
    signal.addEventListener('abort', onAbort, { once: true });
    try {
        return await Promise.race([promise, aborted]);
    }
    finally {
        signal.removeEventListener('abort', onAbort);
    }
}
