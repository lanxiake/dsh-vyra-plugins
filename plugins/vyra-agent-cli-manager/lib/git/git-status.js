/**
 * Parse `git status --porcelain=v2 --branch -z` and `git diff --numstat -z` into the shape
 * the 变更 panel draws: one list per group (已暂存, 未暂存, 未跟踪), each entry with a status
 * letter and line counts, plus the branch and how far it is from its upstream.
 * @module dsh-vyra-agent-cli-manager/git/git-status
 */
const STATUS_LETTERS = new Set(['M', 'A', 'D', 'R', 'C', 'T']);
/** Fields before the path in an ordinary (`1`) and a renamed (`2`) entry, and a conflict (`u`). */
const ORDINARY_FIELDS = 8;
const RENAMED_FIELDS = 9;
const UNMERGED_FIELDS = 10;
function letterOf(code) {
    return code !== undefined && STATUS_LETTERS.has(code) ? code : undefined;
}
/** Split `count` space-separated fields off the front, keeping spaces in the path that follows. */
function fieldsAndPath(record, count) {
    const fields = record.split(' ', count);
    const head = fields.join(' ').length + 1;
    return { fields, path: record.slice(head) };
}
function parseBranchHeader(line, branch) {
    if (line.startsWith('# branch.head ')) {
        const name = line.slice('# branch.head '.length);
        return { ...branch, branch: name === '(detached)' ? undefined : name };
    }
    const ab = /^# branch\.ab \+(\d+) -(\d+)$/.exec(line);
    if (ab === null)
        return branch;
    return { ...branch, ahead: Number(ab[1]), behind: Number(ab[2]) };
}
function addTracked(groups, xy, path, origPath) {
    const base = origPath === undefined ? { path } : { path, origPath };
    const index = letterOf(xy[0]);
    const tree = letterOf(xy[1]);
    return {
        ...groups,
        staged: index === undefined ? groups.staged : [...groups.staged, { ...base, status: index }],
        unstaged: tree === undefined ? groups.unstaged : [...groups.unstaged, { ...base, status: tree }],
    };
}
function addRecord(groups, records, at) {
    const record = records[at] ?? '';
    const kind = record[0];
    if (kind === '?') {
        return {
            groups: { ...groups, untracked: [...groups.untracked, { path: record.slice(2), status: '?' }] },
            next: at + 1,
        };
    }
    if (kind === '1') {
        const { fields, path } = fieldsAndPath(record, ORDINARY_FIELDS);
        return { groups: addTracked(groups, fields[1] ?? '', path), next: at + 1 };
    }
    if (kind === '2') {
        // The path before the rename is the next NUL-separated record.
        const { fields, path } = fieldsAndPath(record, RENAMED_FIELDS);
        return { groups: addTracked(groups, fields[1] ?? '', path, records[at + 1]), next: at + 2 };
    }
    if (kind === 'u') {
        const { path } = fieldsAndPath(record, UNMERGED_FIELDS);
        return { groups: { ...groups, unstaged: [...groups.unstaged, { path, status: 'U' }] }, next: at + 1 };
    }
    return { groups, next: at + 1 };
}
/**
 * Parse porcelain v2 status output.
 * @param output - stdout of `git status --porcelain=v2 --branch -z --untracked-files=all`.
 * @returns the branch and the three groups, without line counts.
 */
export function parseStatus(output) {
    const records = output.split('\0').filter((record) => record !== '');
    let branch = { branch: undefined, ahead: undefined, behind: undefined };
    let groups = { staged: [], unstaged: [], untracked: [] };
    let at = 0;
    while (at < records.length) {
        const record = records[at] ?? '';
        if (record.startsWith('# ')) {
            branch = parseBranchHeader(record, branch);
            at += 1;
            continue;
        }
        const step = addRecord(groups, records, at);
        groups = step.groups;
        at = step.next;
    }
    return { ...branch, ...groups };
}
/**
 * Parse numstat output. A rename's counts are filed under its new path.
 * @param output - stdout of `git diff --numstat -z`.
 * @returns line counts per path; binary files are left out.
 */
export function parseNumstat(output) {
    const records = output.split('\0');
    const counts = new Map();
    let at = 0;
    while (at < records.length) {
        const [added, deleted, path] = (records[at] ?? '').split('\t');
        // A rename has an empty path here, then the old and the new path as records of their own.
        const target = path === '' ? records[at + 2] : path;
        at += path === '' ? 3 : 1;
        if (target === undefined || added === undefined || deleted === undefined)
            continue;
        const additions = Number(added);
        const deletions = Number(deleted);
        if (Number.isInteger(additions) && Number.isInteger(deletions))
            counts.set(target, { additions, deletions });
    }
    return counts;
}
/**
 * Attach line counts to entries that have them.
 * @param entries - one group's entries.
 * @param counts - that group's numstat.
 * @returns new entries; ones without counts are returned as they were.
 */
export function withCounts(entries, counts) {
    return entries.map((entry) => {
        const count = counts.get(entry.path);
        return count === undefined ? entry : { ...entry, ...count };
    });
}
