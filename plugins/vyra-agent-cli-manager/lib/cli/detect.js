/**
 * Finds whether one CLI is installed and what version it reports. Detection only reads: it
 * never installs, upgrades, or writes, so a failure here costs a row in the list and nothing
 * else.
 * @module dsh-vyra-agent-cli-manager/cli/detect
 */
import { homedir } from 'node:os';
import { startOnWindows } from "../windows-command.js";
/**
 * A CLI that answers slowly is usually a CLI asking something. Ten seconds covers a cold start
 * of every catalog entry; waiting longer would leave the overview loading with nothing to show.
 */
const DETECT_TIMEOUT_MS = 10_000;
/**
 * The first `x.y.z` in the output. Each CLI words its version line differently —
 * `2.1.276 (Claude Code)`, `codex-cli 0.154.0`, a bare `1.18.19` — but all of them put the
 * number in that shape, so matching the shape beats matching every vendor's wording.
 */
const VERSION_PATTERN = /\d+\.\d+\.\d+/;
/** A version line is one short line; more than this means the CLI printed something else. */
const MAX_VERSION_BYTES = 64 * 1024;
/** Time for a killed version probe to go away without holding the overview open. */
const GRACE_MS = 2_000;
/**
 * Pull the version out of a CLI's version output.
 * @param text - what the CLI printed.
 * @returns the version, or undefined when the output holds none.
 */
export function parseVersion(text) {
    return VERSION_PATTERN.exec(text)?.[0];
}
/**
 * Run one CLI's version command and read its stdout.
 * @param subprocess - the harness's subprocess service.
 * @param argv - the program and its arguments.
 * @param signal - ends the command at the probe's deadline.
 * @returns what the command printed, or '' when it could not be started or timed out.
 */
async function capture(subprocess, argv, signal) {
    // A `.cmd` shim cannot be spawned directly, which is the whole reason this repo has this.
    const started = startOnWindows({ argv, env: {} }, process.platform, process.env);
    const handle = subprocess.spawn({
        argv: started.argv,
        // Version output does not depend on the working directory, so no project of the user's
        // is exposed to a CLI that reads one while starting.
        cwd: homedir(),
        env: started.env,
        graceMs: GRACE_MS,
        signal,
        stdio: {
            stdin: 'ignore',
            stdout: { maxBytes: MAX_VERSION_BYTES },
            stderr: { maxBytes: MAX_VERSION_BYTES },
        },
    });
    await handle.done.catch(() => undefined);
    return handle.collected.stdout?.readFrom(0).text ?? '';
}
/**
 * Build the production host over the harness's subprocess service.
 * @param subprocess - the harness's subprocess service.
 * @returns the host a probe runs against.
 */
export function hostOfSubprocess(subprocess) {
    return {
        resolveExecutable: (command, signal) => subprocess.resolveExecutable(command, undefined, signal),
        capture: (argv, signal) => capture(subprocess, argv, signal),
    };
}
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
export async function detectCli(entry, host, timeoutMs = DETECT_TIMEOUT_MS) {
    const signal = AbortSignal.timeout(timeoutMs);
    // A CLI shipped inside an application rather than installed on PATH — the harness itself —
    // names the absolute places its launcher lives; those are tried before the PATH lookup.
    const candidates = entry.binaryCandidates ?? [];
    const binaryPath = await resolveFirst(host, [...candidates, entry.binary], signal);
    if (binaryPath === undefined)
        return { installed: false };
    const printed = await host.capture([binaryPath, ...entry.versionArgs], signal).catch(() => '');
    const version = parseVersion(printed);
    // Installed without a readable version is a real state: the binary is there, and it either
    // printed something unexpected or would not answer before the deadline.
    return version === undefined ? { installed: true, binaryPath } : { installed: true, binaryPath, version };
}
/**
 * The first candidate that resolves, in order.
 * @param host - the process world to resolve in.
 * @param commands - absolute paths first, then the name to look for on PATH.
 * @param signal - the shared deadline.
 * @returns the resolved path, or undefined when none resolve.
 */
async function resolveFirst(host, commands, signal) {
    for (const command of commands) {
        const resolved = await host.resolveExecutable(command, signal).catch(() => undefined);
        if (resolved !== undefined)
            return resolved;
    }
    return undefined;
}
