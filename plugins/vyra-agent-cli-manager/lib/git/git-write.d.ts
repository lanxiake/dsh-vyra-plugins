/**
 * The 变更 panel's writes: stage, unstage, discard, commit the selected files, push, pull,
 * and switch or create branches. Paths are relative to the repository's top level and always
 * follow `--`, so a file named like an option stays a file.
 * @module vyra-agent-cli-manager/git/git-write
 */
import type { Spawn } from './git-run.ts';
/**
 * Stage files, deletions included.
 * @param spawn - the subprocess service's spawn.
 * @param root - the repository's top level.
 * @param paths - files to stage.
 */
export declare function stage(spawn: Spawn, root: string, paths: readonly string[]): Promise<void>;
/**
 * Take files out of the index, keeping their changes in the working tree.
 * @param spawn - the subprocess service's spawn.
 * @param root - the repository's top level.
 * @param paths - files to unstage.
 */
export declare function unstage(spawn: Spawn, root: string, paths: readonly string[]): Promise<void>;
/**
 * Throw away working-tree changes: tracked files go back to their staged version, untracked
 * files are deleted.
 * @param spawn - the subprocess service's spawn.
 * @param root - the repository's top level.
 * @param target - tracked and untracked files to discard.
 */
export declare function discard(spawn: Spawn, root: string, target: {
    readonly tracked: readonly string[];
    readonly untracked: readonly string[];
}): Promise<void>;
/**
 * Commit exactly the selected files, as they are in the working tree. Files that were staged
 * but not selected stay staged for a later commit, which spares the user the unstage-and-
 * confirm step a commit of the whole index would need.
 * @param spawn - the subprocess service's spawn.
 * @param root - the repository's top level.
 * @param change - the message and the files to commit.
 */
export declare function commit(spawn: Spawn, root: string, change: {
    readonly message: string;
    readonly paths: readonly string[];
}): Promise<void>;
/**
 * Push the current branch. A branch without an upstream is pushed to origin and tracks it.
 * @param spawn - the subprocess service's spawn.
 * @param root - the repository's top level.
 */
export declare function push(spawn: Spawn, root: string): Promise<void>;
/**
 * Pull the current branch, fast-forward only: a merge or a rebase needs decisions the panel
 * cannot ask for, so those are left to the terminal.
 * @param spawn - the subprocess service's spawn.
 * @param root - the repository's top level.
 */
export declare function pull(spawn: Spawn, root: string): Promise<void>;
/**
 * Require a name git accepts for a branch, and that cannot pass for an option.
 * @param spawn - the subprocess service's spawn.
 * @param root - the repository's top level.
 * @param name - the branch name.
 * @throws GitError for an invalid name.
 */
export declare function validBranch(spawn: Spawn, root: string, name: string): Promise<void>;
/**
 * Switch to a branch. A remote branch is checked out as a local branch that tracks it,
 * unless a local branch of that name exists already.
 * @param spawn - the subprocess service's spawn.
 * @param root - the repository's top level.
 * @param branch - the branch, and whether it names a remote branch such as `origin/main`.
 */
export declare function checkout(spawn: Spawn, root: string, branch: {
    readonly name: string;
    readonly remote: boolean;
}): Promise<void>;
/**
 * Create a branch from HEAD and switch to it.
 * @param spawn - the subprocess service's spawn.
 * @param root - the repository's top level.
 * @param name - the new branch's name.
 */
export declare function createBranch(spawn: Spawn, root: string, name: string): Promise<void>;
