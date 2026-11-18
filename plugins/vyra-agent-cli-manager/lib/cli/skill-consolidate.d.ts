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
 * @module vyra-agent-cli-manager/cli/skill-consolidate
 */
/** The library every skill ends up in, relative to the user's home. */
export declare const SKILL_LIBRARY_DIR: string;
/** Appended to a copy that differs from the one kept, so it stops being loaded but stays. */
export declare const BACKUP_SUFFIX = ".replaced";
/** One copy of a skill, as found on disk. */
export interface SkillCopy {
    /** The CLI catalog id that owns this directory, or `library` for the shared library itself. */
    readonly owner: string;
    /** Absolute path of the copy. */
    readonly path: string;
    /**
     * A fingerprint of the copy's whole tree.
     *
     * The entry file alone is not enough: a skill may carry scripts and references, and two copies
     * whose instructions match while their resources differ would still lose something when one is
     * linked over the other.
     */
    readonly digest: string;
    /** Total bytes, used only to break a tie between copies of equal interest. */
    readonly bytes: number;
    /** Newest modification among its files, the other half of that tie-break. */
    readonly newest: number;
}
/** What the consolidation will do, one skill at a time. */
export interface SkillPlan {
    readonly name: string;
    /**
     * The copy that becomes the skill in the library.
     *
     * `undefined` when the skill is already only in the library, so there is nothing to copy.
     */
    readonly keep: SkillCopy | undefined;
    /** Copies that differ from {@link keep} and will be renamed aside rather than replaced. */
    readonly replace: readonly SkillCopy[];
    /** Copies identical to {@link keep}: these become links, losing nothing. */
    readonly link: readonly SkillCopy[];
}
/**
 * One step the caller should perform, in the order the plan gives them.
 *
 * Every variant names the skill it belongs to, including `link`: the panel groups the report by
 * skill, and a link that cannot say which skill it belongs to would appear as an orphaned path.
 */
export type SkillStep = {
    readonly kind: 'copy';
    readonly name: string;
    readonly from: string;
    readonly to: string;
} | {
    readonly kind: 'backup';
    readonly name: string;
    readonly path: string;
    readonly to: string;
} | {
    readonly kind: 'remove';
    readonly name: string;
    readonly path: string;
    readonly owner: string;
} | {
    readonly kind: 'link';
    readonly name: string;
    readonly target: string;
    readonly at: string;
    readonly owner: string;
} | {
    readonly kind: 'skip';
    readonly name: string;
    readonly path: string;
    readonly owner: string;
    readonly reason: string;
};
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
export declare function stepsForPlan(name: string, plan: SkillPlan, libraryRoot: string): readonly SkillStep[];
/** The disk operations consolidation needs. Injected so a test touches nothing. */
export interface SkillConsolidateHost {
    /** Every skill copy under one directory: its name and the copy's fingerprint. */
    listCopies(root: string): Promise<readonly {
        readonly name: string;
        readonly copy: SkillCopy;
    }[]>;
    /** Whether a path exists, and what it is. */
    kindOf(path: string): Promise<'link' | 'dir' | 'file' | undefined>;
    /** Copy a directory tree, replacing whatever is at the destination. */
    copyTree(from: string, to: string): Promise<void>;
    /** Rename one entry, keeping its contents. */
    rename(from: string, to: string): Promise<void>;
    /** Delete a directory and everything under it. */
    removeTree(path: string): Promise<void>;
    /** Make a link at `path` pointing at `target`. */
    link(target: string, path: string): Promise<void>;
}
/** What one run did, for the panel to report. */
export interface ConsolidateOutcome {
    /** Skills whose copies are now one directory plus links. */
    readonly consolidated: readonly string[];
    /** Copies renamed aside because they differed from the version kept. */
    readonly replaced: readonly {
        readonly name: string;
        readonly from: string;
        readonly to: string;
    }[];
    /** Steps that could not be performed, with the reason. */
    readonly failed: readonly string[];
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
export declare function runConsolidation(host: SkillConsolidateHost, steps: readonly SkillStep[]): Promise<ConsolidateOutcome>;
/**
 * Collect and run, the whole operation.
 *
 * @param host - disk access.
 * @param home - the user's home.
 * @returns what happened.
 */
export declare function consolidateSkills(host: SkillConsolidateHost, home: string): Promise<ConsolidateOutcome>;
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
export declare function rankCopies(copies: readonly SkillCopy[]): readonly SkillCopy[];
/**
 * Build the plan for one skill.
 *
 * @param name - the skill's directory name.
 * @param copies - everywhere it was found.
 * @returns the copy to keep, the ones to rename aside, and the ones to link.
 */
export declare function planFor(name: string, copies: readonly SkillCopy[]): SkillPlan;
/** Where a replaced copy is moved to, so it keeps its files but stops being loaded. */
export declare function backupPathOf(copy: SkillCopy): string;
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
export declare function skillRoots(home: string): readonly string[];
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
export declare function collectCopies(host: SkillConsolidateHost, home: string): Promise<ReadonlyMap<string, readonly SkillCopy[]>>;
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
export declare function planSteps(byName: ReadonlyMap<string, readonly SkillCopy[]>, libraryRoot: string): readonly SkillStep[];
