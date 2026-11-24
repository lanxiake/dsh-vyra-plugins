/**
 * Asks a CLI which models it offers. ACP only reports them on a session, so this
 * opens one and removes it again. It sends no prompt, so no model is called.
 * @module dsh-vyra-agent-cli-manager/model-probe
 */
import type { CliModelList } from './model-options.ts';
import type { AcpTransport, TransportHandlers } from './transport.ts';
/**
 * Start a CLI just long enough to read its model list.
 * @param open - starts the CLI.
 * @param cwd - working directory for the temporary session.
 * @param timeoutMs - how long to wait, which must allow for a cold `npx` download.
 * @param signal - stops the CLI at once when the bridge is shutting down.
 * @returns the model list, or undefined when the CLI offers none.
 */
export declare function probeModels(open: (handlers: TransportHandlers) => AcpTransport, cwd: string, timeoutMs: number, signal?: AbortSignal): Promise<CliModelList | undefined>;
