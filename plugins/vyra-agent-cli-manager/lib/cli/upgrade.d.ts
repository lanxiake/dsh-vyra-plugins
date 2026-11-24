/**
 * Run one CLI's own upgrade command.
 *
 * Every CLI ships an updater that knows how it was installed: claude and codex pick between a
 * native package and npm, opencode between curl/npm/pnpm/bun/brew. Reimplementing that here
 * would mean guessing the install layout from the outside and writing into directories this
 * plugin did not create, so the upgrade is delegated instead.
 * @module dsh-vyra-agent-cli-manager/cli/upgrade
 */
import type { SubprocessHandle, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess';
import type { CliCatalogEntry } from './catalog.ts';
/** What one command reported. A CLI that would not start resolves with a null exit code. */
export interface CliCommandResult {
    readonly exitCode: number | null;
    readonly stdout: string;
    readonly stderr: string;
}
/** Starts a child process; the harness's `ctx.subprocess.spawn` in production. */
export type CliSpawn = (spec: SubprocessSpawnSpec) => SubprocessHandle;
/** Runs one argv to completion. Injected so a test needs neither a CLI nor a PATH. */
export type CliRunner = (argv: readonly string[], signal: AbortSignal) => Promise<CliCommandResult>;
/** Why the upgrade did not finish. The message is ready to show the user. */
export declare class CliUpgradeError extends Error {
    name: string;
}
/** What the panel gets back for one upgrade. */
export interface CliUpgradeOutcome {
    readonly id: string;
    readonly exitCode: number | null;
    readonly stdout: string;
    readonly stderr: string;
}
/**
 * Build a runner that starts commands the way the harness does, so a `.cmd` shim is unwrapped
 * into the interpreter and script it really runs.
 * @param spawn - the subprocess service's spawn.
 * @returns the runner.
 */
export declare function runnerOfSpawn(spawn: CliSpawn): CliRunner;
/**
 * Upgrade one CLI in place with its own updater.
 * @param entry - the CLI to upgrade.
 * @param run - how to start a command.
 * @param timeoutMs - how long the whole upgrade may take.
 * @returns the exit code and the tail of both streams; a non-zero exit is reported, not thrown.
 * @throws CliUpgradeError when the command could not be started or the deadline passed.
 */
export declare function upgradeCli(entry: CliCatalogEntry, run: CliRunner, timeoutMs?: number): Promise<CliUpgradeOutcome>;
