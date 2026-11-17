/**
 * One table of every skill, per CLI, for the 技能 tab.
 *
 * The rows are the union of what the CLIs would load, so a skill exists for the panel exactly
 * while some CLI's directory offers it. A cell also says whether what that CLI has is a link
 * this plugin made or a real directory of the user's own: the first can be turned off, the
 * second must not be touched, and the difference is invisible from the name alone.
 * @module vyra-agent-cli-manager/cli/skills-matrix
 */
import type { SkillLinkHost } from './skill-links.ts';
/** One CLI column of the skills matrix. */
interface SkillMatrixColumn {
    readonly id: string;
    readonly name: string;
    readonly readable: boolean;
    /** Why the column is unreadable, shown on the header and on each of its cells. */
    readonly problem?: string | undefined;
}
/** One cell: whether this CLI loads the skill, and why it cannot be changed. */
interface SkillMatrixCell {
    readonly id: string;
    readonly state: 'on' | 'off' | 'unknown';
    /** True when what this CLI has is a link, which is the only thing this plugin may remove. */
    readonly linked?: boolean | undefined;
    /** The directory, relative to the user's home, that holds (or would hold) the skill. */
    readonly path?: string | undefined;
    /** Present when the checkbox is disabled; the text says what would have to change. */
    readonly blocked?: string | undefined;
}
interface SkillMatrixRow {
    readonly name: string;
    readonly description: string;
    /** The real directory every link should point at, relative to the user's home. */
    readonly source: string;
    readonly cells: readonly SkillMatrixCell[];
}
export interface SkillMatrixResult {
    readonly columns: readonly SkillMatrixColumn[];
    readonly rows: readonly SkillMatrixRow[];
}
/**
 * Build the skills matrix.
 * @param host - how to read directories, files and entry kinds.
 * @param home - the directory the catalog's paths are relative to.
 * @returns one column per CLI and one row per skill, with the reason each disabled cell is disabled.
 */
export declare function skillsMatrix(host: SkillLinkHost, home: string): Promise<SkillMatrixResult>;
export {};
