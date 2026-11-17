/**
 * Opening the ACP connection to a CLI and getting a session on it: a new one, or the
 * native session an earlier process left behind.
 * @module vyra-agent-cli-manager/session/connect
 */
import type { AcpTransport, TransportHandlers } from '../transport.ts';
import type { ModelState } from './model-state.ts';
/** What opening a session needs. */
export interface OpenSessionRequest {
    readonly openTransport: (handlers: TransportHandlers) => AcpTransport;
    readonly handlers: TransportHandlers;
    readonly cwd: string;
    /** The CLI's own session for this conversation, when an earlier process left one. */
    readonly nativeSessionId: string | undefined;
    readonly model: ModelState;
    /** Told as soon as the transport exists, so a stop during startup can still close it. */
    readonly onTransport: (transport: AcpTransport) => void;
    /** Receives a failed reattach, which falls back to a new session rather than failing. */
    readonly onError?: ((error: unknown) => void) | undefined;
}
/** The session the CLI is working in. */
export interface OpenedSession {
    readonly acpSessionId: string;
    /** The native session could not be continued, so the CLI starts without the conversation. */
    readonly reattachFailed: boolean;
    /** The CLI takes image blocks in a prompt. */
    readonly acceptsImages: boolean;
}
/**
 * Connect to the CLI and open or continue its session.
 * @param request - transport factory, handlers and what to continue.
 * @returns the session and whether continuing it failed.
 */
export declare function openSession(request: OpenSessionRequest): Promise<OpenedSession>;
/**
 * A stalled `npx` or a CLI waiting for a login would otherwise hang every later message too.
 * @param work - the startup to bound.
 * @param timeoutMs - how long it may take.
 * @returns the startup, rejected with a readable reason once the time is up.
 */
export declare function withinStartTimeout(work: () => Promise<void>, timeoutMs: number): Promise<void>;
