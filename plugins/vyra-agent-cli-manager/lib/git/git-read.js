/**
 * The 变更 panel's reads: where a directory's repository is, its status with line counts,
 * its branches, and the patch of one file.
 * @module vyra-agent-cli-manager/git/git-read
 */
import { failureOf, mustGit, runGit } from "./git-run.js";
import { parseNumstat, parseStatus, withCounts } from "./git-status.js";
/** Untracked files beyond this many are listed without line counts; each count is one git run. */
const MAX_COUNTED_UNTRACKED = 100;
/**
 * Larger patches are not shown at all: collection keeps the tail of a stream, and a patch
 * missing its head cannot be read. The panel cuts what it draws by lines on its own.
 */
const MAX_DIFF_BYTES = 8 * 1024 * 1024;
const NULL_DEVICE = '/dev/null';
/** `git diff --no-index` exits with 1 when the files differ, which is the answer, not a failure. */
const DIFFERS = 1;
/**
 * Untracked counts run this many git processes at a time: each one is a process start, and a
 * timer repeats the whole read, so a burst of a hundred would recur every few seconds.
 */
const COUNT_CONCURRENCY = 8;
/**
 * External diff programs and textconv drivers are commands named by repository config; the
 * panel reads diffs without asking anyone, so it never runs them.
 */
const NO_DRIVERS = ['--no-ext-diff', '--no-textconv'];
/**
 * Find the repository a directory belongs to.
 * @param spawn - the subprocess service's spawn.
 * @param cwd - any directory.
 * @returns the top level, or undefined when the directory is not in a repository.
 */
export async function repoRoot(spawn, cwd) {
    const result = await runGit(spawn, cwd, ['rev-parse', '--show-toplevel']);
    const root = result.stdout.trim();
    return result.exitCode === 0 && root !== '' ? root : undefined;
}
async function untrackedCount(spawn, root, entry) {
    const args = ['diff', '--no-index', ...NO_DRIVERS, '--numstat', '-z', '--', NULL_DEVICE, entry.path];
    const result = await runGit(spawn, root, args);
    // The no-index numstat names the pair, not the file, so the single record is the count.
    const [count] = parseNumstat(result.stdout).values();
    return count === undefined ? entry : { ...entry, ...count };
}
async function untrackedCounts(spawn, root, entries) {
    const counted = entries.slice(0, MAX_COUNTED_UNTRACKED);
    const batches = Array.from({ length: Math.ceil(counted.length / COUNT_CONCURRENCY) }, (_, index) => counted.slice(index * COUNT_CONCURRENCY, (index + 1) * COUNT_CONCURRENCY));
    const results = await batches.reduce(async (done, batch) => [
        ...(await done),
        ...(await Promise.all(batch.map((entry) => untrackedCount(spawn, root, entry)))),
    ], Promise.resolve([]));
    return [...results, ...entries.slice(MAX_COUNTED_UNTRACKED)];
}
/**
 * Whether a path is one of the untracked files the status lists. git does not descend into a
 * symlinked directory, so `link/key.txt` behind `link -> ~/.ssh` is not one of them; the check
 * runs through git rather than the file system because git may run on another host.
 * @param spawn - the subprocess service's spawn.
 * @param root - the repository's top level.
 * @param path - a path relative to the root.
 * @returns true when git lists the path as untracked and not ignored.
 */
export async function isUntracked(spawn, root, path) {
    const result = await mustGit(spawn, root, ['ls-files', '-z', '--others', '--exclude-standard', '--', path], '读取 Git 状态失败');
    return result.stdout === `${path}\0`;
}
/**
 * Read the status of the repository at `root`, with line counts for every group.
 * @param spawn - the subprocess service's spawn.
 * @param root - the repository's top level.
 * @returns the branch, its distance from upstream, and the three groups.
 */
export async function readStatus(spawn, root) {
    const failure = '读取 Git 状态失败';
    const [status, staged, unstaged] = await Promise.all([
        mustGit(spawn, root, ['status', '--porcelain=v2', '--branch', '-z', '--untracked-files=all'], failure),
        mustGit(spawn, root, ['diff', '--cached', ...NO_DRIVERS, '--numstat', '-z', '-M'], failure),
        mustGit(spawn, root, ['diff', ...NO_DRIVERS, '--numstat', '-z'], failure),
    ]);
    const parsed = parseStatus(status.stdout);
    return {
        ...parsed,
        root,
        staged: withCounts(parsed.staged, parseNumstat(staged.stdout)),
        unstaged: withCounts(parsed.unstaged, parseNumstat(unstaged.stdout)),
        untracked: await untrackedCounts(spawn, root, parsed.untracked),
    };
}
/**
 * List local and remote branches.
 * @param spawn - the subprocess service's spawn.
 * @param root - the repository's top level.
 * @returns the checked-out branch and the others, locals first as git sorts them.
 */
export async function readBranches(spawn, root) {
    const format = '%(refname)%00%(refname:short)%00%(HEAD)';
    const result = await mustGit(spawn, root, ['for-each-ref', `--format=${format}`, 'refs/heads', 'refs/remotes'], '读取分支失败');
    const rows = result.stdout
        .split('\n')
        .filter((line) => line !== '')
        .map((line) => {
        const [ref = '', name = '', head = ''] = line.split('\0');
        return { ref, name, head: head === '*' };
    });
    return {
        current: rows.find((row) => row.head)?.name,
        local: rows.filter((row) => row.ref.startsWith('refs/heads/')).map((row) => row.name),
        // A remote's HEAD is an alias for one of its branches, not a branch to pick.
        remote: rows
            .filter((row) => row.ref.startsWith('refs/remotes/') && !row.ref.endsWith('/HEAD'))
            .map((row) => row.name),
    };
}
function diffArgs(side, path, origPath) {
    const paths = origPath === undefined ? [path] : [origPath, path];
    if (side === 'untracked')
        return ['diff', '--no-index', ...NO_DRIVERS, '--', NULL_DEVICE, path];
    if (side === 'staged')
        return ['diff', '--cached', ...NO_DRIVERS, '-M', '--', ...paths];
    return ['diff', ...NO_DRIVERS, '--', path];
}
/**
 * Read the unified patch of one file.
 * @param spawn - the subprocess service's spawn.
 * @param root - the repository's top level.
 * @param target - the file, the side compared, and the path it had before a rename.
 * @returns the patch, cut at the size limit.
 */
export async function readDiff(spawn, root, target) {
    const args = diffArgs(target.side, target.path, target.origPath);
    const result = await runGit(spawn, root, args, { maxBytes: MAX_DIFF_BYTES });
    // A missing file also exits with 1 under --no-index; only that case writes to stderr.
    const differs = target.side === 'untracked' && result.exitCode === DIFFERS && result.stderr.trim() === '';
    const ok = result.exitCode === 0 || differs;
    if (!ok)
        throw failureOf(result, '读取差异失败');
    return result.truncated ? { patch: '', truncated: true } : { patch: result.stdout, truncated: false };
}
