/**
 * CLI turns for one session: prompts waiting their turn, the turn in flight, and
 * cancelling it. Only one turn runs at a time; steering sent mid-turn waits here and
 * runs as the next turn.
 * @module dsh-vyra-agent-cli-manager/session/turn-queue
 */
/** The turn state machine of one CLI session. */
export class TurnQueue {
    hooks;
    pending = [];
    running = false;
    stopping = false;
    ended = Promise.withResolvers();
    /** Aborted when the CLI turn ends, which withdraws any question still on screen. */
    lifetime = new AbortController();
    cancelTimer;
    constructor(hooks) {
        this.hooks = hooks;
    }
    /** Whether a CLI turn is in flight. */
    get active() {
        return this.running;
    }
    /** Whether the turn in flight has been asked to stop. */
    get cancelling() {
        return this.stopping;
    }
    /** Whether a turn is running or waiting. */
    get busy() {
        return this.running || this.pending.length > 0;
    }
    /** Ids of the user messages queued but not sent yet. */
    get queuedIds() {
        return this.pending.flatMap((prompt) => prompt.ids);
    }
    /** Aborted when the current turn ends. */
    get signal() {
        return this.lifetime.signal;
    }
    /** @returns a promise that settles when the current turn ends. */
    untilEnded() {
        return this.ended.promise;
    }
    enqueue(prompt) {
        this.pending = [...this.pending, prompt];
        this.pump();
    }
    clearPending() {
        this.pending = [];
    }
    /** Withdraw anything still asked within the current turn. */
    abortLifetime() {
        this.lifetime.abort();
    }
    /**
     * Ask the CLI to stop the turn in flight.
     * @param sendCancel - sends `session/cancel` to the CLI.
     */
    beginCancel(sendCancel) {
        this.stopping = true;
        sendCancel();
        // A CLI that ignores session/cancel would block every later prompt and may keep
        // changing files, so it is stopped outright once the grace period ends.
        this.cancelTimer = setTimeout(() => {
            this.hooks.onCancelTimeout();
        }, this.hooks.cancelGraceMs);
        this.cancelTimer.unref();
    }
    end(event) {
        if (!this.running)
            return;
        this.running = false;
        clearTimeout(this.cancelTimer);
        const wasCancelling = this.stopping;
        this.stopping = false;
        this.lifetime.abort();
        this.hooks.onEnd(event, wasCancelling);
        this.ended.resolve();
        this.pump();
    }
    /** Send the next queued prompt if no turn is running and the session can take one. */
    pump() {
        if (this.running)
            return;
        const target = this.hooks.target();
        if (target === undefined)
            return;
        const [next, ...rest] = this.pending;
        if (next === undefined)
            return;
        this.pending = rest;
        this.hooks.onSend(next);
        this.running = true;
        this.ended = Promise.withResolvers();
        this.lifetime = new AbortController();
        target.transport.prompt(target.acpSessionId, next.blocks).then((outcome) => {
            this.end({ type: 'turn-end', ...outcome });
        }, (error) => {
            this.end({ type: 'failure', error: error instanceof Error ? error : new Error(String(error)) });
        });
    }
}
