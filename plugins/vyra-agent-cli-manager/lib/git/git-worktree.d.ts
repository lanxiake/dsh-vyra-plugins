/**
 * `git worktree` for the 新建 Worktree dialog: what the dialog needs to fill its fields (the
 * main checkout, where worktrees go by default, the branches), and creating one from a new
 * branch, an existing branch, or a pull request. Names and paths always follow `--` or are
 * checked first, so nothing the user types is read as an option.
 * @module dsh-vyra-agent-cli-manager/git/git-worktree
 */
import type { Spawn } from './git-run.ts';
/** What the dialog shows before anything is created. */
export interface WorktreeInfo {
    readonly repo: true;
    /** The main checkout, even when asked from inside a worktree. */
    readonly root: string;
    readonly name: string;
    /** The default directory new worktrees go in. */
    readonly parent: string;
    /** The host's path separator, so the browser can join paths the host's way. */
    readonly separator: string;
    readonly current: string | undefined;
    readonly local: readonly string[];
    readonly remote: readonly string[];
}
/** One creation, already validated by the request layer. */
export type WorktreeRequest = {
    readonly mode: 'new';
    readonly branch: string;
    readonly base: string;
    readonly path: string;
} | {
    readonly mode: 'existing';
    readonly branch: string;
    readonly path: string;
} | {
    readonly mode: 'pr';
    readonly pr: PrRef;
    readonly branch: string;
    readonly path: string;
};
/** Which repository a checkout belongs to, for grouping worktrees under it in the sidebar. */
export interface WorktreeOf {
    readonly repo: true;
    /** The checkout's top level. */
    readonly top: string;
    /** The repository's main checkout; equal to `top` for the main checkout itself. */
    readonly main: string;
    /** The branch checked out, or the short commit on a detached HEAD. */
    readonly branch: string;
}
export interface WorktreeCreated {
    readonly path: string;
    readonly branch: string;
}
/** A pull request named by number, `#number` or link; a link also names `owner/repo`. */
export interface PrRef {
    readonly number: number;
    readonly repo?: string;
}
/**
 * Read what the user typed into the PR field.
 * @param input - a number, `#number`, or a pull request link.
 * @returns the pull request, or undefined when the input names none.
 */
export declare function parsePrInput(input: string): PrRef | undefined;
/**
 * Say which repository a checkout belongs to.
 * @param spawn - the subprocess service's spawn.
 * @param root - the checkout's top level.
 * @returns the top level, the main checkout and the branch.
 */
export declare function readWorktreeOf(spawn: Spawn, root: string): Promise<WorktreeOf>;
/**
 * Read what the dialog needs.
 * @param spawn - the subprocess service's spawn.
 * @param root - the top level of the checkout the user right-clicked.
 * @returns the main checkout, the default parent directory and the branches.
 */
export declare function readWorktreeInfo(spawn: Spawn, root: string): Promise<WorktreeInfo>;
/**
 * Create a worktree.
 * @param spawn - the subprocess service's spawn.
 * @param root - the top level of the checkout the user right-clicked.
 * @param request - what to check out, and where.
 * @returns where the worktree is and which branch it has checked out.
 */
export declare function addWorktree(spawn: Spawn, root: string, request: WorktreeRequest): Promise<WorktreeCreated>;
