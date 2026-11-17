/**
 * Read the two other things a CLI keeps on disk besides its MCP servers: the skills it will
 * offer the model, and the global instruction file it prepends to every session.
 *
 * Both are plain files under a path the catalog already records, so nothing here runs a CLI:
 * these are reads of the user's own configuration, and a CLI's own command for listing skills
 * prints a table meant for a terminal rather than a stable contract.
 * @module vyra-agent-cli-manager/cli/assets
 */
import type { CliCatalogEntry } from './catalog.ts';
/** One skill the CLI would load, as the panel lists it. */
interface SkillSummary {
    readonly name: string;
    /** False when the directory has no `SKILL.md`, which no loader would pick up. */
    readonly loadable: boolean;
}
/** Where a read got its answer, so the panel can show the path it came from. */
export interface PromptDocument {
    readonly path: string;
    readonly text: string;
}
export interface AssetList {
    readonly skills: readonly SkillSummary[];
    /** The directories looked in, in the CLI's own precedence order, relative to the user's home. */
    readonly directories: readonly string[];
    /** Set when none of those directories could be read at all. */
    readonly error?: string;
}
/** The outside world this module needs, injected so tests touch no disk. */
export interface AssetHost {
    /** The file's text, or undefined when it is absent. */
    readFile(path: string): Promise<string | undefined>;
    /**
     * The names directly under a directory, or undefined when it cannot be read. A caller that
     * needs to know whether an entry is a directory reads for `SKILL.md` instead.
     */
    listDirectory(path: string): Promise<readonly string[] | undefined>;
}
/**
 * List the skills a CLI would offer.
 *
 * A CLI reads several directories, and the more specific one wins a name collision, so the
 * first directory that offers a name owns it here too.
 * @param entry - the CLI whose directories to read.
 * @param host - how to reach the disk.
 * @param home - the user's home, which the catalog paths are relative to.
 * @returns the skills found, the directories looked at, and why there were none.
 */
export declare function listSkills(entry: CliCatalogEntry, host: AssetHost, home: string): Promise<AssetList>;
/**
 * Read a CLI's global instruction file.
 * @param entry - the CLI whose file to read.
 * @param host - how to reach the disk.
 * @param home - the user's home, which the catalog path is relative to.
 * @returns the document and its path, or an error naming both when it could not be read.
 */
export declare function readPrompt(entry: CliCatalogEntry, host: AssetHost, home: string): Promise<PromptDocument | {
    readonly error: string;
}>;
export {};
