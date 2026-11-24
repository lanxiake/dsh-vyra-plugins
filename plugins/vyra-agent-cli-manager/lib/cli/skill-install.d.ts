/**
 * Put a new skill into the shared library.
 *
 * The library is `~/.agents/skills`, which is the one directory in this plugin's catalog that
 * more than one CLI reads on its own: opencode and kimi both look there. Every other CLI gets a
 * skill by linking it out of the library, which is the same operation the skills matrix already
 * performs — so an installed skill behaves exactly like one the user had put there by hand, and
 * this module never has to know which CLIs exist.
 *
 * Three sources, because the places a skill comes from differ in kind rather than in degree: the
 * text the user pasted, a repository it lives in, and a directory already on this machine. All
 * three end at the same place — a directory under the library holding a `SKILL.md` — so the
 * caller gets one outcome shape back whatever was asked for.
 *
 * Nothing here fetches. The repository read is handed in as a parameter for the same reason the
 * link host is: a test must not need the network.
 * @module dsh-vyra-agent-cli-manager/cli/skill-install
 */
/** The library every source installs into, relative to the user's home. */
export declare const SKILL_LIBRARY_DIR: string;
/** Longest instruction file this plugin will write. A skill is a prompt, not a document set. */
export declare const MAX_SKILL_CHARS: number;
/**
 * Where a skill's instructions come from.
 *
 * `paste` carries the text; `github` names a repository to read; `local` names a directory that
 * already holds one. The union is discriminated so a handler cannot read a field its own kind
 * does not set.
 */
export type SkillInstallSource = {
    readonly kind: 'paste';
    readonly markdown: string;
    readonly name?: string;
} | {
    readonly kind: 'github';
    readonly repository: string;
    readonly path?: string;
    readonly name?: string;
} | {
    readonly kind: 'local';
    readonly directory: string;
    readonly name?: string;
};
/** The disk and network operations an install needs. Injected so tests touch neither. */
export interface SkillInstallHost {
    /** A file's text, or undefined when it is absent. */
    readFile(path: string): Promise<string | undefined>;
    /** Write a file, creating its parent directory. */
    writeFile(path: string, text: string): Promise<void>;
    /** The names directly under a directory, or undefined when it cannot be read. */
    listDirectory(path: string): Promise<readonly string[] | undefined>;
    /** Make a link at `path` pointing at `source`. */
    link(source: string, path: string): Promise<void>;
    /** What an entry on disk is; `undefined` when it is absent. */
    kindOf(path: string): Promise<'link' | 'dir' | 'other' | undefined>;
    /** Remove one entry: a link, or a directory this module created. */
    removeEntry(path: string): Promise<void>;
    /** Delete a directory and everything under it. */
    removeTree(path: string): Promise<void>;
    /**
     * Read one text file from a public repository, or undefined when it is not there.
     * Injected rather than called: the install path must be testable without the network.
     */
    fetchRepositoryFile(repository: string, path: string): Promise<string | undefined>;
}
/** What an install did, in the shape the panel reports. */
export interface SkillInstallOutcome {
    /** The directory name it landed under, inside the library. */
    readonly name: string;
    /** The library path, relative to the user's home. */
    readonly path: string;
    /** True when an existing skill of that name was replaced. */
    readonly replaced: boolean;
}
/** A refusal this plugin makes on purpose. The message is ready to show. */
export declare class SkillInstallError extends Error {
    name: string;
}
/**
 * The directory name a skill should take.
 *
 * The frontmatter's `name` is the authority when it has one — it is what every CLI addresses the
 * skill by — but a pasted or local skill may not declare one, and the caller's suggestion is the
 * fallback. Both go through the same validation, because the name becomes a directory this
 * plugin creates and the rule is what keeps a path out of it.
 *
 * @param declared - the `name` from the frontmatter, when it had one.
 * @param suggested - what the caller proposed, when it did.
 * @returns the validated directory name.
 * @throws {SkillInstallError} when neither yields a safe name.
 */
export declare function skillDirName(declared: string | undefined, suggested: string | undefined): string;
/**
 * Check that text is a usable skill body.
 *
 * A `SKILL.md` without frontmatter is the common mistake, and the failure it causes is silent —
 * every CLI lists the skill with an empty description and the model never picks it. Saying so at
 * install time is the only place this can be caught.
 *
 * @param markdown - the file's text.
 * @returns the parsed frontmatter.
 * @throws {SkillInstallError} when there is no frontmatter, or no description in it.
 */
export declare function assertInstalledSkill(markdown: string): {
    readonly name?: string;
    readonly description: string;
};
/** A repository reference split into owner/repo and an optional path inside it. */
interface RepoRef {
    readonly repository: string;
    readonly path: string | undefined;
}
/**
 * Read what the user typed as a repository reference.
 *
 * Accepts the three spellings people actually paste — `owner/repo`, a full `github.com` URL, and
 * a `tree/<branch>/<path>` URL — because rejecting two of them to enforce a canonical form only
 * teaches the user a syntax this plugin invented.
 *
 * @param raw - the typed reference.
 * @returns the repository and the path inside it, when one was given.
 * @throws {SkillInstallError} when it names no repository at all.
 */
export declare function parseRepoReference(raw: string): RepoRef;
/**
 * Install one skill into the shared library.
 *
 * The write is replace-then-write rather than write-in-place: a skill the user reinstalls may
 * have picked up files of its own, and leaving them behind would silently mix two versions. The
 * replacement is only ever of a directory this library holds — the caller passes the library
 * root, and the name never contains a separator.
 *
 * @param host - disk and repository access.
 * @param home - the user's home, which the library is relative to.
 * @param source - where the skill comes from.
 * @returns what it installed.
 * @throws {SkillInstallError} on a bad name, unusable content, or a refused write.
 */
export declare function installSkill(host: SkillInstallHost, home: string, source: SkillInstallSource): Promise<SkillInstallOutcome>;
/**
 * Read a skill-install request.
 *
 * The three shapes are validated into the discriminated union rather than passed through: a
 * `kind` this plugin does not know, or a body missing the field that kind needs, has to fail at
 * the boundary with a message naming the field. Letting it through would reach the installer and
 * surface as an unreadable `undefined` deep in a path join.
 *
 * @param body - the parsed request body.
 * @returns the source, discriminated by `kind`.
 * @throws {BadRequest} on an unknown kind or a missing required field.
 */
export declare function skillInstallRequestOf(body: unknown): {
    readonly source: SkillInstallSource;
};
export {};
