/**
 * One row per catalog CLI: whether it is installed, which version it reports, which version
 * npm offers, and whether that is newer. Reads only.
 * @module vyra-agent-cli-manager/cli/registry-status
 */
import { CLI_CATALOG } from "./catalog.js";
import { detectCli } from "./detect.js";
import { isNewerVersion } from "../model-versions.js";
/**
 * Long enough for a slow registry, short enough that the overview still arrives promptly. The
 * lookup is optional information; the installed row is the part the user came for.
 */
const NPM_TIMEOUT_MS = 8_000;
const NPM_REGISTRY = 'https://registry.npmjs.org';
/**
 * URL-encode a package name for a registry path. A scoped name's `/` must become `%2f`: left
 * as a slash, `@anthropic-ai/claude-code` would read as a path nested one level deeper.
 * @param npmPackage - the package name.
 * @returns the name as one registry path segment.
 */
export function registryPath(npmPackage) {
    return `${NPM_REGISTRY}/${encodeURIComponent(npmPackage)}/latest`;
}
/**
 * The real npm registry. Every failure — offline, a timeout, a package that does not exist,
 * a body that is not JSON — answers undefined, because a missing latest version must never
 * take the whole overview down with it.
 * @param fetchImpl - the fetch to use.
 * @returns the source.
 */
export function npmLatestVersion(fetchImpl = fetch) {
    return {
        latestVersion: async (npmPackage, signal) => {
            try {
                const response = await fetchImpl(registryPath(npmPackage), { signal });
                if (!response.ok)
                    return undefined;
                const document = await response.json();
                if (typeof document !== 'object' || document === null)
                    return undefined;
                const { version } = document;
                return typeof version === 'string' && version !== '' ? version : undefined;
            }
            catch {
                // Offline, timed out, or unreadable: the installed version is still worth showing.
                return undefined;
            }
        },
    };
}
/**
 * Work out one CLI's row, probing it and looking up its latest version at the same time.
 * @param entry - the CLI.
 * @param host - the process world to probe in.
 * @param source - where the latest version comes from.
 * @returns the row.
 */
async function statusOf(entry, host, source) {
    // A CLI with no npm package has no registry to ask; a lookup would request a package named
    // "undefined". The harness's own binary is the case this covers.
    const latest = entry.npmPackage === undefined
        ? Promise.resolve(undefined)
        : source.latestVersion(entry.npmPackage, AbortSignal.timeout(NPM_TIMEOUT_MS)).catch(() => undefined);
    const detection = await detectCli(entry, host);
    const latestVersion = await latest;
    const updateAvailable = detection.version === undefined || latestVersion === undefined
        ? undefined
        : isNewerVersion(latestVersion, detection.version);
    return {
        id: entry.id,
        name: entry.name,
        vendor: entry.vendor,
        installed: detection.installed,
        binaryPath: detection.binaryPath,
        version: detection.version,
        latestVersion,
        updateAvailable,
        verified: entry.verified,
    };
}
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
export async function cliStatuses(host, source) {
    return Promise.all(CLI_CATALOG.map((entry) => statusOf(entry, host, source).catch(() => ({
        id: entry.id,
        name: entry.name,
        vendor: entry.vendor,
        installed: false,
        verified: entry.verified,
    }))));
}
