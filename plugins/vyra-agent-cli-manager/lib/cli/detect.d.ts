/**
 * Finds whether one CLI is installed and what version it reports. Detection only reads: it
 * never installs, upgrades, or writes, so a failure here costs a row in the list and nothing
 * else.
 * @module vyra-agent-cli-manager/cli/detect
 */
import type { SubprocessHandle, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess';
import type { CliCatalogEntry } from './catalog.ts';
/** What was found for one CLI. */
export interface CliDetection {
    readonly installed: boolean;
    /** Where the harness found the binary, as its own world reported it. */
    readonly binaryPath?: string | undefined;
    /** The version the binary printed, or undefined when it printed nothing usable. */
    readonly version?: string | undefined;
}
/**
 * The process world a probe runs in, injected so tests need neither a PATH lookup nor an
 * installed CLI. Production wires {@link hostOfSubprocess}.
 */
export interface CliHost {
    /** The canonical path of `command`, or undefined when it is not on PATH. */
    resolveExecutable(command: string, signal: AbortSignal): Promise<string | undefined>;
    /** Run argv and return its stdout; resolves with '' instead of rejecting when it fails. */
    capture(argv: readonly string[], signal: AbortSignal): Promise<string>;
}
/** The parts of the harness's `subprocess` service this module uses. */
export interface CliSubprocess {
    resolveExecutable(command: string, env?: Readonly<Record<string, string>>, signal?: AbortSignal): Promise<string>;
    spawn(spec: SubprocessSpawnSpec): SubprocessHandle;
}
/**
 * Pull the version out of a CLI's version output.
 * @param text - what the CLI printed.
 * @returns the version, or undefined when the output holds none.
 */
export declare function parseVersion(text: string): string | undefined;
/**
 * Build the production host over the harness's subprocess service.
 * @param subprocess - the harness's subprocess service.
 * @returns the host a probe runs against.
 */
export declare function hostOfSubprocess(subprocess: CliSubprocess): CliHost;
/**
 * Find out whether one CLI is installed, and which version it reports.
 *
 * Both steps share one deadline: a probe that spends the whole budget resolving a binary has
 * nothing left to learn from it, and the row fills in on the next pass instead.
 * @param entry - the CLI to look for.
 * @param host - the process world to look in.
 * @param timeoutMs - how long the whole probe may take.
 * @returns what was found; never throws.
 */
export declare function detectCli(entry: CliCatalogEntry, host: CliHost, timeoutMs?: number): Promise<CliDetection>;
