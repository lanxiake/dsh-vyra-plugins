/**
 * Validate the JSON the 变更 panel and the 新建 Worktree dialog post, and run the git operation
 * it names. Everything arriving here is untrusted: the directory must be absolute, and every
 * file path must stay inside the repository.
 * @module vyra-agent-cli-manager/git/git-requests
 */
import { isAbsolute } from 'node:path';
import { isUntracked, readBranches, readDiff, readStatus, repoRoot } from "./git-read.js";
import { GitError } from "./git-run.js";
import { checkout, commit, createBranch, discard, pull, push, stage, unstage } from "./git-write.js";
import { addWorktree, parsePrInput, readWorktreeInfo, readWorktreeOf } from "./git-worktree.js";
/** A request the panel got wrong; answered with 400 rather than 500. */
export class GitRequestError extends Error {
    name = 'GitRequestError';
}
/** The operations the routes accept, by the last segment of their path. */
export const GIT_OPERATIONS = [
    'status',
    'branches',
    'diff',
    'stage',
    'unstage',
    'discard',
    'commit',
    'push',
    'pull',
    'checkout',
    'create-branch',
    'worktree-info',
    'worktree-add',
    'worktree-of',
];
/** More files than any selection the panel can make; a cap on argv length. */
const MAX_PATHS = 5_000;
const MAX_TEXT = 64 * 1024;
const DIFF_SIDES = ['staged', 'unstaged', 'untracked'];
const NOT_A_REPO = { repo: false };
/**
 * Narrow a parsed value to an object body.
 * @param value - the parsed JSON.
 * @returns the body.
 * @throws GitRequestError for anything but a plain object.
 */
export function asBody(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        throw new GitRequestError('请求格式无效');
    return value;
}
function text(body, key) {
    const value = body[key];
    if (typeof value !== 'string' || value === '' || value.length > MAX_TEXT || value.includes('\0')) {
        throw new GitRequestError(`缺少或无效的参数：${key}`);
    }
    return value;
}
/** Relative, without `..` segments, so git never reaches outside the repository. */
function repoPath(value) {
    if (typeof value !== 'string' || value === '' || value.includes('\0') || isAbsolute(value)) {
        throw new GitRequestError('文件路径无效');
    }
    if (value.split(/[\\/]/).includes('..'))
        throw new GitRequestError('文件路径无效');
    return value;
}
function paths(body, key) {
    const value = body[key];
    if (value === undefined)
        return [];
    if (!Array.isArray(value) || value.length > MAX_PATHS)
        throw new GitRequestError(`缺少或无效的参数：${key}`);
    return value.map(repoPath);
}
function diffSide(body) {
    const side = DIFF_SIDES.find((candidate) => candidate === body.side);
    if (side === undefined)
        throw new GitRequestError('缺少或无效的参数：side');
    return side;
}
/**
 * Check that an operation name is one the routes serve.
 * @param name - the last path segment.
 * @returns the operation, or undefined for an unknown name.
 */
export function operationOf(name) {
    return GIT_OPERATIONS.find((operation) => operation === name);
}
async function write(spawn, root, operation, body) {
    switch (operation) {
        case 'stage':
            return stage(spawn, root, paths(body, 'paths'));
        case 'unstage':
            return unstage(spawn, root, paths(body, 'paths'));
        case 'discard':
            return discard(spawn, root, { tracked: paths(body, 'tracked'), untracked: paths(body, 'untracked') });
        case 'commit':
            return commit(spawn, root, { message: text(body, 'message'), paths: paths(body, 'paths') });
        case 'push':
            return push(spawn, root);
        case 'pull':
            return pull(spawn, root);
        case 'checkout':
            return checkout(spawn, root, { name: text(body, 'branch'), remote: body.remote === true });
        case 'create-branch':
            return createBranch(spawn, root, text(body, 'branch'));
        default:
            throw new GitRequestError(`不支持的操作：${operation}`);
    }
}
function worktreeRequest(body) {
    const path = text(body, 'path');
    if (!isAbsolute(path))
        throw new GitRequestError('Worktree 位置必须是绝对路径');
    const branch = text(body, 'branch');
    switch (body.mode) {
        case 'new':
            return { mode: 'new', branch, base: text(body, 'base'), path };
        case 'existing':
            return { mode: 'existing', branch, path };
        case 'pr': {
            const input = text(body, 'pr');
            const pr = parsePrInput(input);
            if (pr === undefined)
                throw new GitRequestError(`无法识别的 PR：${input}`);
            return { mode: 'pr', pr, branch, path };
        }
        default:
            throw new GitRequestError('缺少或无效的参数：mode');
    }
}
async function diff(spawn, root, body) {
    const path = repoPath(body.path);
    const side = diffSide(body);
    // An untracked diff reads the file itself, outside git's object store, so it is limited to
    // the files the status lists; anything else could follow a symlink out of the repository.
    if (side === 'untracked' && !(await isUntracked(spawn, root, path))) {
        throw new GitRequestError('只能查看仓库内未跟踪文件的差异');
    }
    return readDiff(spawn, root, {
        path,
        side,
        origPath: body.origPath === undefined ? undefined : repoPath(body.origPath),
    });
}
/**
 * Run one operation for the directory in the body. A directory outside any repository
 * answers `{ repo: false }` to every operation, which the panel shows as its empty state.
 * @param spawn - the subprocess service's spawn.
 * @param operation - what to do.
 * @param body - the validated-on-read request body.
 * @returns the operation's data; writes answer with the fresh status.
 */
export async function runOperation(spawn, operation, body) {
    const cwd = text(body, 'cwd');
    if (!isAbsolute(cwd))
        throw new GitRequestError('工作目录必须是绝对路径');
    const root = await repoRoot(spawn, cwd);
    if (root === undefined)
        return NOT_A_REPO;
    if (operation === 'branches')
        return readBranches(spawn, root);
    if (operation === 'worktree-info')
        return readWorktreeInfo(spawn, root);
    if (operation === 'worktree-of')
        return readWorktreeOf(spawn, root);
    if (operation === 'worktree-add')
        return addWorktree(spawn, root, worktreeRequest(body));
    if (operation === 'diff')
        return diff(spawn, root, body);
    if (operation !== 'status')
        await write(spawn, root, operation, body);
    return { repo: true, ...(await readStatus(spawn, root)) };
}
/**
 * The HTTP status for an error an operation threw.
 * @param error - what was thrown.
 * @returns 400 for a bad request, 409 for a git refusal, 500 otherwise.
 */
export function statusFor(error) {
    if (error instanceof GitRequestError)
        return 400;
    if (error instanceof GitError)
        return 409;
    return 500;
}
