/**
 * Read a skill's one-line summary out of its `SKILL.md`.
 *
 * A skill directory is identified by its name, but "canvas-design" says nothing about what it
 * does; the frontmatter's `description` does, and every skill in the wild has one because the
 * skill loader needs it. This reads only that one field: the body is instructions for a model,
 * not a description for a person.
 * @module vyra-agent-cli-manager/cli/skill-md
 */
/**
 * A skill's `name` and `description` from its frontmatter.
 *
 * Installing a skill is the one place both are needed at once: the description is what the model
 * routes on, and the name is what the directory has to be called, so a file missing either has to
 * be refused before it lands rather than listed with a blank line afterwards.
 *
 * @param text - the whole `SKILL.md`.
 * @returns the declared fields, or undefined when the file has no frontmatter at all. A file with
 *   frontmatter but no description is reported with `description: ''` so the caller can say which
 *   of the two is missing.
 */
export declare function parseSkillMarkdown(text: string): {
    readonly name?: string;
    readonly description: string;
} | undefined;
/**
 * The `description` field of a skill's frontmatter.
 * @param text - the whole `SKILL.md`.
 * @returns the summary without its quotes, or undefined when the file does not declare one.
 */
export declare function descriptionOf(text: string): string | undefined;
