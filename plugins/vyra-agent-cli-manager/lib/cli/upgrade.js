/**
 * Run one CLI's own upgrade command.
 *
 * Every CLI ships an updater that knows how it was installed: claude and codex pick between a
 * native package and npm, opencode between curl/npm/pnpm/bun/brew. Reimplementing that here
 * would mean guessing the install layout from the outside and writing into directories this
 * plugin did not create, so the upgrade is delegated instead.
 * @module vyra-agent-cli-manager/cli/upgrade
 */
import { homedir } from 'node:os';
import { startOnWindows } from "../windows-command.js";
/** An upgrade downloads a release, so it gets far longer than a probe's ten seconds. */
const UPGRADE_TIMEOUT_MS = 10 * 60 * 1000;
/** Upgraders are chatty; the panel shows a tail, not a transcript. */
const MAX_OUTPUT_BYTES = 8 * 1024;
const GRACE_MS = 2_000;
/** Why the upgrade did not finish. The message is ready to show the user. */
export class CliUpgradeError extends Error {
    name = 'CliUpgradeError';
}
/** Keeps the tail: an npm upgrade prints its progress line by line and ends with the verdict. */
function tail(text) {
    return text.length <= MAX_OUTPUT_BYTES ? text : text.slice(text.length - MAX_OUTPUT_BYTES);
}
/**
 * Build a runner that starts commands the way the harness does, so a `.cmd` shim is unwrapped
 * into the interpreter and script it really runs.
 * @param spawn - the subprocess service's spawn.
 * @returns the runner.
 */
export function runnerOfSpawn(spawn) {
    return async (argv, signal) => {
        const started = startOnWindows({ argv, env: {} }, process.platform, process.env);
        const child = spawn({
            argv: [...started.argv],
            // An updater belongs to the installation, not to whatever project the user has open, so
            // it runs in the home directory where no project config can change what it does.
            cwd: homedir(),
            env: started.env,
            graceMs: GRACE_MS,
            signal,
            stdio: {
                stdin: 'ignore',
                stdout: { maxBytes: MAX_OUTPUT_BYTES },
                stderr: { maxBytes: MAX_OUTPUT_BYTES },
            },
        });
        const outcome = await child.done;
        return {
            exitCode: outcome.exitCode,
            stdout: child.collected.stdout?.readFrom(0).text ?? '',
            stderr: child.collected.stderr?.readFrom(0).text ?? '',
        };
    };
}
/**
 * Upgrade one CLI in place with its own updater.
 * @param entry - the CLI to upgrade.
 * @param run - how to start a command.
 * @param timeoutMs - how long the whole upgrade may take.
 * @returns the exit code and the tail of both streams; a non-zero exit is reported, not thrown.
 * @throws CliUpgradeError when the command could not be started or the deadline passed.
 */
export async function upgradeCli(entry, run, timeoutMs = UPGRADE_TIMEOUT_MS) {
    // A CLI the harness itself provides has no updater of its own: refuse rather than run the
    // binary with no arguments, which would launch a session instead of upgrading anything.
    if (entry.upgradeArgs === undefined) {
        throw new CliUpgradeError(`${entry.name} 不由本插件升级`);
    }
    const signal = AbortSignal.timeout(timeoutMs);
    let result;
    try {
        result = await run([entry.binary, ...entry.upgradeArgs], signal);
    }
    catch (error) {
        if (signal.aborted) {
            throw new CliUpgradeError(`${entry.name} 升级超时（${String(Math.round(timeoutMs / 1000))} 秒）`);
        }
        throw new CliUpgradeError(`${entry.name} 升级无法启动：${error instanceof Error ? error.message : String(error)}`);
    }
    return { id: entry.id, exitCode: result.exitCode, stdout: tail(result.stdout), stderr: tail(result.stderr) };
}
