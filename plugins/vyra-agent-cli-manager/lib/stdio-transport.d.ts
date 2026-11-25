/**
 * ACP over a child process's stdio, using the harness subprocess seam so the CLI
 * gets the shared credential scrub and managed teardown. Process teardown and SDK
 * wiring are adapted from `@deepseek-ai/dsh-subagent-acp`; see THIRD_PARTY_NOTICES.md.
 * @module dsh-vyra-agent-cli-manager/stdio-transport
 */
import type { SubprocessHandle, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess';
import type { AcpTransport, TransportHandlers } from './transport.ts';
/** How to start one CLI. */
export interface StdioTransportSpec {
    readonly argv: readonly string[];
    readonly cwd: string;
    /** Added to the seam's scrubbed environment; the place for a CLI's own credentials. */
    readonly env: Readonly<Record<string, string>>;
    /** Signal-escalation grace in milliseconds. */
    readonly graceMs: number;
    /** Time after stdin EOF for the CLI to flush and exit by itself, in milliseconds. */
    readonly eofGraceMs: number;
    readonly spawn: (spec: SubprocessSpawnSpec) => SubprocessHandle;
}
/** The same, except the environment is resolved just before the spawn. */
export interface DeferredTransportSpec extends Omit<StdioTransportSpec, 'env'> {
    readonly env: () => Promise<Readonly<Record<string, string>>>;
}
/**
 * Start a CLI and connect to it. The returned operations reject once the process
 * is gone, because a request the CLI will never answer would otherwise hang.
 * @param spec - the command and its process settings.
 * @param handlers - callbacks from the CLI.
 * @returns the connected transport.
 */
export declare function openStdioTransport(spec: StdioTransportSpec, handlers: TransportHandlers): AcpTransport;
/**
 * Spawn a CLI whose environment is only known after a lookup, such as the credential a
 * provider route names.
 * @param spec - the command and its process settings, with `env` resolved on demand.
 * @param handlers - callbacks from the CLI.
 * @returns the transport; its operations start the process on first use, or on dispose.
 */
export declare function openDeferredStdioTransport(spec: DeferredTransportSpec, handlers: TransportHandlers): AcpTransport;
