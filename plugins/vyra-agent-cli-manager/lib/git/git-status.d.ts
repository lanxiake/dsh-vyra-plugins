/**
 * Parse `git status --porcelain=v2 --branch -z` and `git diff --numstat -z` into the shape
 * the 变更 panel draws: one list per group (已暂存, 未暂存, 未跟踪), each entry with a status
 * letter and line counts, plus the branch and how far it is from its upstream.
 * @module vyra-agent-cli-manager/git/git-status
 */
/** M modified, A added, D deleted, R renamed, C copied, T type changed, U conflicted, ? untracked. */
type ChangeStatus = 'M' | 'A' | 'D' | 'R' | 'C' | 'T' | 'U' | '?';
export interface ChangeEntry {
    readonly path: string;
    /** The path before a rename or copy. */
    readonly origPath?: string;
    readonly status: ChangeStatus;
    readonly additions?: number;
    readonly deletions?: number;
}
export interface GitStatus {
    /** Branch name, or undefined on a detached HEAD. */
    readonly branch: string | undefined;
    /** Set only when the branch has an upstream. */
    readonly ahead: number | undefined;
    readonly behind: number | undefined;
    readonly staged: readonly ChangeEntry[];
    readonly unstaged: readonly ChangeEntry[];
    readonly untracked: readonly ChangeEntry[];
}
/** Line counts per path; binary files have none. */
export type LineCounts = ReadonlyMap<string, {
    readonly additions: number;
    readonly deletions: number;
}>;
/**
 * Parse porcelain v2 status output.
 * @param output - stdout of `git status --porcelain=v2 --branch -z --untracked-files=all`.
 * @returns the branch and the three groups, without line counts.
 */
export declare function parseStatus(output: string): GitStatus;
/**
 * Parse numstat output. A rename's counts are filed under its new path.
 * @param output - stdout of `git diff --numstat -z`.
 * @returns line counts per path; binary files are left out.
 */
export declare function parseNumstat(output: string): LineCounts;
/**
 * Attach line counts to entries that have them.
 * @param entries - one group's entries.
 * @param counts - that group's numstat.
 * @returns new entries; ones without counts are returned as they were.
 */
export declare function withCounts(entries: readonly ChangeEntry[], counts: LineCounts): readonly ChangeEntry[];
export {};
