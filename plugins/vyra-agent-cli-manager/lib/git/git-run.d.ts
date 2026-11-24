/**
 * Run one git command in a working directory through the harness's subprocess service, so
 * git resolves in the same execution world as the CLIs (a remote or sandboxed host included).
 * @module dsh-vyra-agent-cli-manager/git/git-run
 */
import type { SubprocessHandle, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess';
/** Starts a child process; the harness's `ctx.subprocess.spawn` in production. */
export type Spawn = (spec: SubprocessSpawnSpec) => SubprocessHandle;
/** What a finished git command reported. */
export interface GitResult {
    readonly exitCode: number | null;
    readonly stdout: string;
    readonly stderr: string;
    /** True when stdout outgrew the cap and lost its head. */
    readonly truncated: boolean;
}
export interface GitRunOptions {
    /** Ends the command; the caller owns the deadline. */
    readonly signal?: AbortSignal | undefined;
    /** Largest stdout kept in memory, in bytes. */
    readonly maxBytes?: number | undefined;
    /** Written to stdin, which is then closed; a commit message, for instance. */
    readonly input?: string | undefined;
}
/**
 * Run `git <args>` in `cwd` and collect its output. A non-zero exit is reported, not thrown;
 * a failure to start git at all rejects.
 * @param spawn - the subprocess service's spawn.
 * @param cwd - the working directory.
 * @param args - git's arguments, never shell-interpreted.
 * @param options - abort signal and output cap.
 * @returns the exit code and the collected output.
 */
export declare function runGit(spawn: Spawn, cwd: string, args: readonly string[], options?: GitRunOptions): Promise<GitResult>;
/** A git command that failed; the message is ready to show the user. */
export declare class GitError extends Error {
    name: string;
}
/**
 * Describe a failed command for the user.
 * @param result - what git reported.
 * @param failure - what failed, in front of git's own reason.
 * @returns the error to throw.
 */
export declare function failureOf(result: GitResult, failure: string): GitError;
/**
 * Run git and require success.
 * @param spawn - the subprocess service's spawn.
 * @param cwd - the working directory.
 * @param args - git's arguments.
 * @param how - what the user is told failed, in front of git's own reason; with run options
 * (abort signal, output cap, stdin) as an object.
 * @returns the result of a command that exited with 0.
 * @throws GitError when git exits with anything else.
 */
export declare function mustGit(spawn: Spawn, cwd: string, args: readonly string[], how: string | (GitRunOptions & {
    readonly failure: string;
})): Promise<GitResult>;
