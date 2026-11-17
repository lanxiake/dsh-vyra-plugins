/**
 * The 变更 panel's writes: stage, unstage, discard, commit the selected files, push, pull,
 * and switch or create branches. Paths are relative to the repository's top level and always
 * follow `--`, so a file named like an option stays a file.
 * @module vyra-agent-cli-manager/git/git-write
 */
import { GitError, mustGit, runGit } from "./git-run.js";
/** Network commands wait on a remote; everything else is local and quick. */
const NETWORK_TIMEOUT_MS = 120_000;
const NO_ORIGIN = '没有名为 origin 的远程仓库';
async function hasHead(spawn, root) {
    const result = await runGit(spawn, root, ['rev-parse', '--verify', '--quiet', 'HEAD']);
    return result.exitCode === 0;
}
/**
 * Stage files, deletions included.
 * @param spawn - the subprocess service's spawn.
 * @param root - the repository's top level.
 * @param paths - files to stage.
 */
export async function stage(spawn, root, paths) {
    if (paths.length === 0)
        return;
    await mustGit(spawn, root, ['add', '-A', '--', ...paths], '暂存失败');
}
/**
 * Take files out of the index, keeping their changes in the working tree.
 * @param spawn - the subprocess service's spawn.
 * @param root - the repository's top level.
 * @param paths - files to unstage.
 */
export async function unstage(spawn, root, paths) {
    if (paths.length === 0)
        return;
    // Before the first commit there is no HEAD to reset to, so unstaging means removing.
    const args = (await hasHead(spawn, root))
        ? ['reset', '-q', 'HEAD', '--', ...paths]
        : ['rm', '--cached', '-r', '-q', '--', ...paths];
    await mustGit(spawn, root, args, '取消暂存失败');
}
/**
 * Throw away working-tree changes: tracked files go back to their staged version, untracked
 * files are deleted.
 * @param spawn - the subprocess service's spawn.
 * @param root - the repository's top level.
 * @param target - tracked and untracked files to discard.
 */
export async function discard(spawn, root, target) {
    if (target.tracked.length > 0) {
        await mustGit(spawn, root, ['checkout', '-q', '--', ...target.tracked], '撤销更改失败');
    }
    if (target.untracked.length > 0) {
        await mustGit(spawn, root, ['clean', '-f', '-q', '--', ...target.untracked], '删除未跟踪文件失败');
    }
}
/**
 * Commit exactly the selected files, as they are in the working tree. Files that were staged
 * but not selected stay staged for a later commit, which spares the user the unstage-and-
 * confirm step a commit of the whole index would need.
 * @param spawn - the subprocess service's spawn.
 * @param root - the repository's top level.
 * @param change - the message and the files to commit.
 */
export async function commit(spawn, root, change) {
    if (change.message.trim() === '')
        throw new GitError('请填写提交信息');
    if (change.paths.length === 0)
        throw new GitError('请选择要提交的文件');
    // `commit -- <paths>` only takes files git already knows, so new files are added first.
    await stage(spawn, root, change.paths);
    await mustGit(spawn, root, ['commit', '-q', '-F', '-', '--', ...change.paths], {
        failure: '提交失败',
        input: change.message,
    });
}
async function hasOrigin(spawn, root) {
    const result = await runGit(spawn, root, ['remote']);
    return result.stdout.split('\n').includes('origin');
}
/**
 * Push the current branch. A branch without an upstream is pushed to origin and tracks it.
 * @param spawn - the subprocess service's spawn.
 * @param root - the repository's top level.
 */
export async function push(spawn, root) {
    const signal = AbortSignal.timeout(NETWORK_TIMEOUT_MS);
    const upstream = await runGit(spawn, root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']);
    if (upstream.exitCode === 0) {
        await mustGit(spawn, root, ['push'], { failure: '推送失败', signal });
        return;
    }
    if (!(await hasOrigin(spawn, root)))
        throw new GitError(`推送失败：${NO_ORIGIN}`);
    await mustGit(spawn, root, ['push', '-u', 'origin', 'HEAD'], { failure: '推送失败', signal });
}
/**
 * Pull the current branch, fast-forward only: a merge or a rebase needs decisions the panel
 * cannot ask for, so those are left to the terminal.
 * @param spawn - the subprocess service's spawn.
 * @param root - the repository's top level.
 */
export async function pull(spawn, root) {
    const signal = AbortSignal.timeout(NETWORK_TIMEOUT_MS);
    await mustGit(spawn, root, ['pull', '--ff-only'], { failure: '拉取失败', signal });
}
/**
 * Require a name git accepts for a branch, and that cannot pass for an option.
 * @param spawn - the subprocess service's spawn.
 * @param root - the repository's top level.
 * @param name - the branch name.
 * @throws GitError for an invalid name.
 */
export async function validBranch(spawn, root, name) {
    const result = await runGit(spawn, root, ['check-ref-format', '--branch', name]);
    if (name.startsWith('-') || result.exitCode !== 0)
        throw new GitError(`分支名称无效：${name}`);
}
/**
 * Switch to a branch. A remote branch is checked out as a local branch that tracks it,
 * unless a local branch of that name exists already.
 * @param spawn - the subprocess service's spawn.
 * @param root - the repository's top level.
 * @param branch - the branch, and whether it names a remote branch such as `origin/main`.
 */
export async function checkout(spawn, root, branch) {
    await validBranch(spawn, root, branch.name);
    const local = branch.remote ? branch.name.slice(branch.name.indexOf('/') + 1) : branch.name;
    const exists = await runGit(spawn, root, ['show-ref', '--verify', '--quiet', `refs/heads/${local}`]);
    const args = branch.remote && exists.exitCode !== 0 ? ['switch', '--track', branch.name] : ['switch', local];
    await mustGit(spawn, root, args, '切换分支失败');
}
/**
 * Create a branch from HEAD and switch to it.
 * @param spawn - the subprocess service's spawn.
 * @param root - the repository's top level.
 * @param name - the new branch's name.
 */
export async function createBranch(spawn, root, name) {
    await validBranch(spawn, root, name);
    await mustGit(spawn, root, ['switch', '-c', name], '新建分支失败');
}
