/**
 * Turn a skill on or off for one CLI by linking, never copying.
 *
 * A skill's instructions live in one directory; a CLI loads it from any directory in its own
 * `skillsDirs`. Linking the real directory into another CLI's list means the skill is upgraded
 * in one place. The dangerous half is removal: this module only ever deletes an entry it has
 * just verified is a link, because a real directory there is the user's own work and deleting
 * it would lose files nothing else holds.
 * @module vyra-agent-cli-manager/cli/skill-links
 */
import type { CliCatalogEntry } from './catalog.ts';
/** What an entry on disk is. Distinguishing a link from a directory is the whole safety rule. */
export type EntryKind = 'link' | 'dir' | 'other' | undefined;
/** The disk operations a link needs. Injected so tests touch no disk. */
export interface SkillLinkHost {
    kindOf(path: string): Promise<EntryKind>;
    /** A file's text, or undefined when it is absent. */
    readFile(path: string): Promise<string | undefined>;
    /** The names directly under a directory, or undefined when it cannot be read. */
    listDirectory(path: string): Promise<readonly string[] | undefined>;
    /** Make a link at `path` pointing at `source`. */
    link(source: string, path: string): Promise<void>;
    /** Delete one entry that is known to be a link. */
    remove(path: string): Promise<void>;
    /** Create a directory and its parents. */
    mkdir(path: string): Promise<void>;
}
/** Where a link was made or removed, so the panel can show the path it touched. */
export interface SkillLinkOutcome {
    readonly id: string;
    /** The linked path, relative to the user's home. */
    readonly path: string;
    /** The real directory the link points at, relative to the user's home. */
    readonly source?: string | undefined;
}
/** A refusal this plugin makes on purpose. The message is ready to show. */
export declare class SkillLinkError extends Error {
    name: string;
}
/**
 * Link one skill into a CLI's own skills directory.
 * @param request.entry - the CLI to turn the skill on for.
 * @param request.host - how to reach the disk.
 * @param request.home - the user's home, which the catalog paths are relative to.
 * @param request.name - the skill's directory name.
 * @returns where the link was made and what it points at.
 * @throws SkillLinkError when the skill has no real directory, or the target already holds it.
 */
export declare function enableSkill(request: {
    readonly entry: CliCatalogEntry;
    readonly host: SkillLinkHost;
    readonly home: string;
    readonly name: string;
}): Promise<SkillLinkOutcome>;
/**
 * Remove the link that turns one skill on for a CLI.
 * @param request.entry - the CLI to turn the skill off for.
 * @param request.host - how to reach the disk.
 * @param request.home - the user's home, which the catalog paths are relative to.
 * @param request.name - the skill's directory name.
 * @returns the path that was removed.
 * @throws SkillLinkError when the CLI does not have the skill, or what it has is a real directory.
 */
export declare function disableSkill(request: {
    readonly entry: CliCatalogEntry;
    readonly host: SkillLinkHost;
    readonly home: string;
    readonly name: string;
}): Promise<{
    readonly id: string;
    readonly path: string;
}>;
