/**
 * Validate the JSON the 变更 panel and the 新建 Worktree dialog post, and run the git operation
 * it names. Everything arriving here is untrusted: the directory must be absolute, and every
 * file path must stay inside the repository.
 * @module dsh-vyra-agent-cli-manager/git/git-requests
 */
import type { Spawn } from './git-run.ts';
/** A request the panel got wrong; answered with 400 rather than 500. */
export declare class GitRequestError extends Error {
    name: string;
}
/** The operations the routes accept, by the last segment of their path. */
export declare const GIT_OPERATIONS: readonly ["status", "branches", "diff", "stage", "unstage", "discard", "commit", "push", "pull", "checkout", "create-branch", "worktree-info", "worktree-add", "worktree-of"];
export type GitOperation = (typeof GIT_OPERATIONS)[number];
type Body = Readonly<Record<string, unknown>>;
/**
 * Narrow a parsed value to an object body.
 * @param value - the parsed JSON.
 * @returns the body.
 * @throws GitRequestError for anything but a plain object.
 */
export declare function asBody(value: unknown): Body;
/**
 * Check that an operation name is one the routes serve.
 * @param name - the last path segment.
 * @returns the operation, or undefined for an unknown name.
 */
export declare function operationOf(name: string): GitOperation | undefined;
/**
 * Run one operation for the directory in the body. A directory outside any repository
 * answers `{ repo: false }` to every operation, which the panel shows as its empty state.
 * @param spawn - the subprocess service's spawn.
 * @param operation - what to do.
 * @param body - the validated-on-read request body.
 * @returns the operation's data; writes answer with the fresh status.
 */
export declare function runOperation(spawn: Spawn, operation: GitOperation, body: Body): Promise<unknown>;
/**
 * The HTTP status for an error an operation threw.
 * @param error - what was thrown.
 * @returns 400 for a bad request, 409 for a git refusal, 500 otherwise.
 */
export declare function statusFor(error: unknown): number;
export {};
