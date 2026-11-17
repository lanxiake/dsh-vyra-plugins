/**
 * Run one git command in a working directory through the harness's subprocess service, so
 * git resolves in the same execution world as the CLIs (a remote or sandboxed host included).
 * @module vyra-agent-cli-manager/git/git-run
 */
/** Plenty for status and numstat of a large checkout; diffs pass their own cap. */
const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;
/** stderr only carries messages for the user. */
const STDERR_MAX_BYTES = 64 * 1024;
const GRACE_MS = 2_000;
/**
 * Paths stay raw UTF-8 (no octal quoting), and nothing waits on a terminal: a push that
 * needs a password fails fast instead of hanging on a prompt nobody can see.
 *
 * The panel reads status on a timer, without asking anyone, in a repository whose config an
 * agent may have edited; `core.fsmonitor` names a command git would run on every status, so
 * it is switched off here. Diff drivers are switched off where the diffs are read.
 *
 * Paths arrive from the panel as file names, so pathspec patterns are off: discarding
 * `src/[id].tsx` must not also discard `src/d.tsx`, and `:memo.txt` is a file, not magic.
 */
const GIT_PREFIX = ['git', '-c', 'core.quotePath=false', '-c', 'color.ui=false', '-c', 'core.fsmonitor=false'];
const GIT_ENV = { GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', GIT_LITERAL_PATHSPECS: '1', LC_ALL: 'C' };
/**
 * Run `git <args>` in `cwd` and collect its output. A non-zero exit is reported, not thrown;
 * a failure to start git at all rejects.
 * @param spawn - the subprocess service's spawn.
 * @param cwd - the working directory.
 * @param args - git's arguments, never shell-interpreted.
 * @param options - abort signal and output cap.
 * @returns the exit code and the collected output.
 */
export async function runGit(spawn, cwd, args, options = {}) {
    const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    const child = spawn({
        argv: [...GIT_PREFIX, ...args],
        cwd,
        env: GIT_ENV,
        graceMs: GRACE_MS,
        signal: options.signal,
        stdio: {
            stdin: options.input === undefined ? 'ignore' : { data: options.input },
            stdout: { maxBytes },
            stderr: { maxBytes: STDERR_MAX_BYTES },
        },
    });
    const outcome = await child.done;
    const stdout = child.collected.stdout?.readFrom(0);
    const stderr = child.collected.stderr?.readFrom(0);
    return {
        exitCode: outcome.exitCode,
        stdout: stdout?.text ?? '',
        stderr: stderr?.text ?? '',
        truncated: stdout?.lossy ?? false,
    };
}
/** A git command that failed; the message is ready to show the user. */
export class GitError extends Error {
    name = 'GitError';
}
/** stderr lines git adds around the message that matters, such as push hints. */
const NOISE = /^(hint:|remote:\s*$)/;
function reasonOf(result) {
    // Some refusals, such as "nothing to commit", are printed on stdout.
    const text = result.stderr.trim() === '' ? result.stdout : result.stderr;
    const lines = text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '' && !NOISE.test(line));
    return lines.join('\n') || `git 退出码 ${String(result.exitCode)}`;
}
/**
 * Describe a failed command for the user.
 * @param result - what git reported.
 * @param failure - what failed, in front of git's own reason.
 * @returns the error to throw.
 */
export function failureOf(result, failure) {
    return new GitError(`${failure}：${reasonOf(result)}`);
}
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
export async function mustGit(spawn, cwd, args, how) {
    const { failure, ...options } = typeof how === 'string' ? { failure: how } : how;
    const result = await runGit(spawn, cwd, args, options);
    if (result.exitCode !== 0)
        throw failureOf(result, failure);
    return result;
}
