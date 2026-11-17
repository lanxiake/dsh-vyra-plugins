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
export declare function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T>;
