/**
 * Single-reader async queue. CLI output arrives on notification callbacks while
 * the harness pulls it from an async generator, and a step can stop reading with
 * events still buffered for the next step.
 * @module vyra-agent-cli-manager/async-queue
 */
/** FIFO buffer with one abortable waiting reader. */
export class AsyncQueue {
    items = [];
    waiter;
    /** Number of buffered items. */
    get size() {
        return this.items.length;
    }
    /**
     * Hand an item to the waiting reader, or buffer it.
     * @param item - the item to deliver.
     */
    push(item) {
        const waiter = this.waiter;
        if (waiter === undefined) {
            this.items = [...this.items, item];
            return;
        }
        this.waiter = undefined;
        waiter.dispose();
        waiter.resolve(item);
    }
    /**
     * Read the next item, waiting if necessary. Aborting leaves buffered items in place.
     * @param signal - optional cancellation for this read.
     * @returns the next item.
     */
    next(signal) {
        if (signal?.aborted)
            return Promise.reject(signal.reason);
        const [first, ...rest] = this.items;
        if (this.items.length > 0) {
            this.items = rest;
            return Promise.resolve(first);
        }
        const { promise, resolve, reject } = Promise.withResolvers();
        const onAbort = () => {
            this.waiter = undefined;
            reject(signal?.reason);
        };
        signal?.addEventListener('abort', onAbort, { once: true });
        this.waiter = { resolve, dispose: () => signal?.removeEventListener('abort', onAbort) };
        return promise;
    }
    /** Drop all buffered items. */
    clear() {
        this.items = [];
    }
}
