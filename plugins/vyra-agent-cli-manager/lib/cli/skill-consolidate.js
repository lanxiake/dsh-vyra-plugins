/**
 * Consolidate the skills scattered across CLI directories into one shared library.
 *
 * Every CLI that this plugin knows reads its own skills directory, and a skill the user wants in
 * two of them has to exist in two of them — so the same instructions get copied around and then
 * drift. This module makes one directory the home of each skill (`~/.agents/skills`, which
 * opencode and kimi already read on their own) and links it into the rest, so the copies are one
 * file and turning a CLI's copy off is unlinking it.
 *
 * The dangerous part is that a skill's copies are not always identical: two CLIs can hold
 * different versions of the same name. Picking one and linking the rest would silently destroy
 * the other, so a differing copy is renamed aside instead — it stays on disk, keeps its files,
 * and stops being loaded (a directory without the entry file is not a skill).
 * @module dsh-vyra-agent-cli-manager/cli/skill-consolidate
 */
import { join } from 'node:path';
import { CLI_CATALOG } from "./catalog.js";
/** The library every skill ends up in, relative to the user's home. */
export const SKILL_LIBRARY_DIR = join('.agents', 'skills');
/** The file whose presence makes a directory a skill. */
const SKILL_ENTRY = 'SKILL.md';
/** Appended to a copy that differs from the one kept, so it stops being loaded but stays. */
export const BACKUP_SUFFIX = '.replaced';
/**
 * What should happen to each copy of one skill, as a list of steps.
 *
 * `planPlan` returns the classification; this turns it into operations that can be run top to
 * bottom without any of them having to look at disk state to decide whether it is safe.
 *
 * Every copy that becomes a link is removed first — an identical copy and a differing one alike.
 * The difference is only *when* and *how*: a differing copy is renamed aside (keeping its files),
 * an identical one is simply deleted, because its bytes are already the ones being linked. Left
 * out, the link would try to occupy a path a directory still holds, and that collision is the
 * one thing an implementation must not resolve by overwriting.
 *
 * @param name - the skill's directory name.
 * @param plan - what {@link planFor} decided.
 * @param libraryRoot - absolute path of the shared library.
 * @returns the steps for this skill, in order.
 */
export function stepsForPlan(name, plan, libraryRoot) {
    if (plan.keep === undefined)
        return [];
    const steps = [];
    const target = join(libraryRoot, name);
    if (plan.keep.owner !== 'library') {
        steps.push({ kind: 'copy', name, from: plan.keep.path, to: target });
    }
    // Rename aside, then link: keeping the copy is the point of this branch, and a CLI that loses
    // the skill because its copy was superseded is not consolidated, it is broken.
    for (const copy of plan.replace) {
        steps.push({ kind: 'backup', name, path: copy.path, to: backupPathOf(copy) });
        steps.push({ kind: 'link', name, target, at: copy.path, owner: copy.owner });
    }
    // An identical copy is removed before the link replaces it. Its content is already in the
    // library byte for byte, so there is nothing to preserve — but the directory still has to go,
    // or the link has nowhere to land.
    for (const copy of plan.link) {
        steps.push({ kind: 'remove', name, path: copy.path, owner: copy.owner });
        steps.push({ kind: 'link', name, target, at: copy.path, owner: copy.owner });
    }
    return steps;
}
/**
 * Run a plan.
 *
 * Each step checks the disk before acting rather than trusting the plan, because the plan was
 * built from a read that has since gone stale if anything else touched these directories — and a
 * `link` that overwrites a real directory would lose it. A step whose preconditions no longer
 * hold is reported instead of forced.
 *
 * @param host - disk access.
 * @param steps - what {@link planSteps} produced.
 * @returns what happened, including anything that did not.
 */
export async function runConsolidation(host, steps) {
    const consolidated = new Set();
    const replaced = [];
    const failed = [];
    for (const step of steps) {
        if (step.kind === 'skip')
            continue;
        try {
            if (step.kind === 'copy') {
                await host.copyTree(step.from, step.to);
                continue;
            }
            if (step.kind === 'backup') {
                // A `.replaced` already beside it means an earlier run did this step; renaming again
                // would bury it one level deeper for no reason.
                if ((await host.kindOf(step.to)) !== undefined) {
                    failed.push(`${step.name}: 备份已存在（${step.to}），跳过`);
                    continue;
                }
                await host.rename(step.path, step.to);
                replaced.push({ name: step.name, from: step.path, to: step.to });
                continue;
            }
            if (step.kind === 'remove') {
                // Only a real directory: a link here means an earlier run already replaced this copy,
                // and deleting it would remove the link rather than a duplicate.
                if ((await host.kindOf(step.path)) === 'link')
                    continue;
                await host.removeTree(step.path);
                continue;
            }
            // `link`: the path has to be free. A directory still there means the `remove` or `backup`
            // before it did not happen, and overwriting is the one outcome this module exists to avoid.
            const occupied = await host.kindOf(step.at);
            if (occupied !== undefined && occupied !== 'link') {
                failed.push(`${step.name}: ${step.at} 仍被占用，未建链接`);
                continue;
            }
            await host.link(step.target, step.at);
            consolidated.add(step.name);
        }
        catch (error) {
            failed.push(`${step.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    return { consolidated: [...consolidated], replaced, failed };
}
/**
 * Collect and run, the whole operation.
 *
 * @param host - disk access.
 * @param home - the user's home.
 * @returns what happened.
 */
export async function consolidateSkills(host, home) {
    const byName = await collectCopies(host, home);
    return await runConsolidation(host, planSteps(byName, join(home, SKILL_LIBRARY_DIR)));
}
/**
 * Order copies by how much they should be trusted as the one to keep.
 *
 * A copy in the library wins outright — it is already where every link will point, and
 * re-copying over it would churn the one directory that is now the source of truth. Between
 * others the larger copy wins, then the more recently touched: "bigger and newer" is a rough
 * proxy, but for two files with the same name the alternative is guessing, and the loser is
 * preserved either way.
 *
 * @param copies - the copies found for one skill.
 * @returns the same copies, best first.
 */
export function rankCopies(copies) {
    return [...copies].sort((a, b) => {
        if (a.owner === 'library' !== (b.owner === 'library'))
            return a.owner === 'library' ? -1 : 1;
        if (a.bytes !== b.bytes)
            return b.bytes - a.bytes;
        return b.newest - a.newest;
    });
}
/**
 * Build the plan for one skill.
 *
 * @param name - the skill's directory name.
 * @param copies - everywhere it was found.
 * @returns the copy to keep, the ones to rename aside, and the ones to link.
 */
export function planFor(name, copies) {
    const ranked = rankCopies(copies);
    const keep = ranked[0];
    if (keep === undefined)
        return { name, keep: undefined, replace: [], link: [] };
    const rest = ranked.slice(1);
    return {
        name,
        keep,
        // A copy that matches the one kept is linked; one that differs is renamed aside. Identity is
        // by digest, not by size or date: two copies are the same only if every byte of every file
        // agrees.
        link: rest.filter((copy) => copy.digest === keep.digest),
        replace: rest.filter((copy) => copy.digest !== keep.digest),
    };
}
/** Where a replaced copy is moved to, so it keeps its files but stops being loaded. */
export function backupPathOf(copy) {
    return `${copy.path}${BACKUP_SUFFIX}`;
}
/** Absolute path of one CLI's skills directory, or undefined when it declares none. */
function skillsDirOf(entry, home) {
    return entry.skillsDirs.map((dir) => join(home, dir));
}
/**
 * Every directory this plugin treats as a place a skill can live, the library first.
 *
 * The catalog's own ones plus the library: the library is not in the catalog because no CLI
 * needs it declared — opencode and kimi name `.agents/skills` among their own directories, so it
 * is already covered for them.
 *
 * @param home - the user's home.
 * @returns absolute directory paths.
 */
export function skillRoots(home) {
    const roots = [join(home, SKILL_LIBRARY_DIR)];
    for (const entry of CLI_CATALOG) {
        for (const dir of skillsDirOf(entry, home)) {
            if (!roots.includes(dir))
                roots.push(dir);
        }
    }
    return roots;
}
/** Which catalog entry owns a root, for the plan's `owner` field. */
function ownerOf(root, home) {
    if (root === join(home, SKILL_LIBRARY_DIR))
        return 'library';
    for (const entry of CLI_CATALOG) {
        if (skillsDirOf(entry, home).includes(root))
            return entry.id;
    }
    return 'unknown';
}
/**
 * Read every skill copy under every root this plugin knows.
 *
 * A `.replaced` directory is skipped. It still holds a `SKILL.md` — that is what makes it a
 * backup rather than a deletion — so without this it is read as a skill named
 * `<name>.replaced` and consolidated in turn, which copies it into the library and renames it
 * aside a second time. One run is correct; the second would grow a `.replaced.replaced` and the
 * library would fill with versions nobody asked for.
 *
 * @param host - disk access.
 * @param home - the user's home.
 * @returns one entry per skill name, with every copy of it.
 */
export async function collectCopies(host, home) {
    const byName = new Map();
    for (const root of skillRoots(home)) {
        const found = await host.listCopies(root);
        for (const { name, copy } of found) {
            if (name.endsWith(BACKUP_SUFFIX))
                continue;
            const list = byName.get(name) ?? [];
            list.push({ ...copy, owner: ownerOf(root, home) });
            byName.set(name, list);
        }
    }
    return byName;
}
/**
 * Turn the collected copies into the steps to run, in order.
 *
 * Order matters and is the whole safety of this: a copy is never written over before its contents
 * exist elsewhere. Copying precedes linking, and a differing copy is renamed aside before the
 * link that would otherwise replace it.
 *
 * @param byName - what {@link collectCopies} found.
 * @param libraryRoot - the absolute path of the shared library.
 * @returns the steps, safe to run top to bottom.
 */
export function planSteps(byName, libraryRoot) {
    const steps = [];
    for (const [name, copies] of [...byName].sort(([a], [b]) => a.localeCompare(b))) {
        if (copies.length <= 1 && copies[0]?.owner === 'library')
            continue; // already consolidated
        steps.push(...stepsForPlan(name, planFor(name, copies), libraryRoot));
    }
    return steps;
}
