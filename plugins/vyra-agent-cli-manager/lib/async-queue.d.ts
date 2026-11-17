/**
 * Single-reader async queue. CLI output arrives on notification callbacks while
 * the harness pulls it from an async generator, and a step can stop reading with
 * events still buffered for the next step.
 * @module vyra-agent-cli-manager/async-queue
 */
/** FIFO buffer with one abortable waiting reader. */
export declare class AsyncQueue<T> {
    private items;
    private waiter;
    /** Number of buffered items. */
    get size(): number;
    /**
     * Hand an item to the waiting reader, or buffer it.
     * @param item - the item to deliver.
     */
    push(item: T): void;
    /**
     * Read the next item, waiting if necessary. Aborting leaves buffered items in place.
     * @param signal - optional cancellation for this read.
     * @returns the next item.
     */
    next(signal?: AbortSignal): Promise<T>;
    /** Drop all buffered items. */
    clear(): void;
}
