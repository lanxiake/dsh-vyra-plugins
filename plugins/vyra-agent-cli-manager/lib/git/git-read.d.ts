/**
 * The 变更 panel's reads: where a directory's repository is, its status with line counts,
 * its branches, and the patch of one file.
 * @module dsh-vyra-agent-cli-manager/git/git-read
 */
import type { Spawn } from './git-run.ts';
import type { GitStatus } from './git-status.ts';
export interface RepoStatus extends GitStatus {
    /** The repository's top level; every path in the status is relative to it. */
    readonly root: string;
}
export interface BranchList {
    readonly current: string | undefined;
    readonly local: readonly string[];
    readonly remote: readonly string[];
}
export interface FileDiff {
    readonly patch: string;
    readonly truncated: boolean;
}
/** Which version of a file a diff compares. */
export type DiffSide = 'staged' | 'unstaged' | 'untracked';
/**
 * Find the repository a directory belongs to.
 * @param spawn - the subprocess service's spawn.
 * @param cwd - any directory.
 * @returns the top level, or undefined when the directory is not in a repository.
 */
export declare function repoRoot(spawn: Spawn, cwd: string): Promise<string | undefined>;
/**
 * Whether a path is one of the untracked files the status lists. git does not descend into a
 * symlinked directory, so `link/key.txt` behind `link -> ~/.ssh` is not one of them; the check
 * runs through git rather than the file system because git may run on another host.
 * @param spawn - the subprocess service's spawn.
 * @param root - the repository's top level.
 * @param path - a path relative to the root.
 * @returns true when git lists the path as untracked and not ignored.
 */
export declare function isUntracked(spawn: Spawn, root: string, path: string): Promise<boolean>;
/**
 * Read the status of the repository at `root`, with line counts for every group.
 * @param spawn - the subprocess service's spawn.
 * @param root - the repository's top level.
 * @returns the branch, its distance from upstream, and the three groups.
 */
export declare function readStatus(spawn: Spawn, root: string): Promise<RepoStatus>;
/**
 * List local and remote branches.
 * @param spawn - the subprocess service's spawn.
 * @param root - the repository's top level.
 * @returns the checked-out branch and the others, locals first as git sorts them.
 */
export declare function readBranches(spawn: Spawn, root: string): Promise<BranchList>;
/**
 * Read the unified patch of one file.
 * @param spawn - the subprocess service's spawn.
 * @param root - the repository's top level.
 * @param target - the file, the side compared, and the path it had before a rename.
 * @returns the patch, cut at the size limit.
 */
export declare function readDiff(spawn: Spawn, root: string, target: {
    readonly path: string;
    readonly side: DiffSide;
    readonly origPath?: string | undefined;
}): Promise<FileDiff>;
