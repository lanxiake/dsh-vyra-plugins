/**
 * One row per catalog CLI: whether it is installed, which version it reports, which version
 * npm offers, and whether that is newer. Reads only.
 * @module vyra-agent-cli-manager/cli/registry-status
 */
import type { CliHost } from './detect.ts';
/** One CLI's row in the overview. */
export interface CliStatus {
    readonly id: string;
    readonly name: string;
    readonly vendor: string;
    readonly installed: boolean;
    readonly binaryPath?: string | undefined;
    readonly version?: string | undefined;
    readonly latestVersion?: string | undefined;
    /** True only when both versions are known and npm's is newer. */
    readonly updateAvailable?: boolean | undefined;
    readonly verified: boolean;
}
/** Where a newer version is looked up. Injected so tests never reach the network. */
export interface LatestVersionSource {
    /** The `latest` version of an npm package, or undefined when it cannot be read. */
    latestVersion(npmPackage: string, signal: AbortSignal): Promise<string | undefined>;
}
/**
 * URL-encode a package name for a registry path. A scoped name's `/` must become `%2f`: left
 * as a slash, `@anthropic-ai/claude-code` would read as a path nested one level deeper.
 * @param npmPackage - the package name.
 * @returns the name as one registry path segment.
 */
export declare function registryPath(npmPackage: string): string;
/**
 * The real npm registry. Every failure — offline, a timeout, a package that does not exist,
 * a body that is not JSON — answers undefined, because a missing latest version must never
 * take the whole overview down with it.
 * @param fetchImpl - the fetch to use.
 * @returns the source.
 */
export declare function npmLatestVersion(fetchImpl?: typeof fetch): LatestVersionSource;
/**
 * Read every CLI's status.
 *
 * Probes run concurrently because they are independent processes, and one CLI that answers
 * slowly must not hold back the others. A failed probe becomes a not-installed row rather
 * than a failed request.
 * @param host - the process world to probe in.
 * @param source - where latest versions come from.
 * @returns one row per catalog CLI, in catalog order.
 */
export declare function cliStatuses(host: CliHost, source: LatestVersionSource): Promise<readonly CliStatus[]>;
