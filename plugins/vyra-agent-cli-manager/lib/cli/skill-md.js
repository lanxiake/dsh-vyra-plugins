/**
 * Read a skill's one-line summary out of its `SKILL.md`.
 *
 * A skill directory is identified by its name, but "canvas-design" says nothing about what it
 * does; the frontmatter's `description` does, and every skill in the wild has one because the
 * skill loader needs it. This reads only that one field: the body is instructions for a model,
 * not a description for a person.
 * @module vyra-agent-cli-manager/cli/skill-md
 */
/** Long enough for a one-line summary; a pasted paragraph is not a description. */
const DESCRIPTION_MAX = 300;
/** The frontmatter block's lines, or undefined when the file has none. */
function frontmatterLines(text) {
    const lines = text.split('\n');
    if (lines[0]?.trim() !== '---')
        return undefined;
    const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
    if (end < 0)
        return undefined;
    return lines.slice(1, end);
}
/** One scalar frontmatter field, unquoted, or undefined when it is absent or empty. */
function fieldOf(block, key) {
    const pattern = new RegExp(`^${key}:\\s*(.*)$`, 'u');
    const field = block.map((line) => pattern.exec(line.trim())).find((match) => match !== null);
    const raw = field?.[1]?.trim();
    if (raw === undefined || raw === '')
        return undefined;
    return raw.replace(/^['"]|['"]$/gu, '');
}
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
export function parseSkillMarkdown(text) {
    const block = frontmatterLines(text);
    if (block === undefined)
        return undefined;
    const name = fieldOf(block, 'name');
    const raw = fieldOf(block, 'description') ?? '';
    const description = raw.length <= DESCRIPTION_MAX ? raw : `${raw.slice(0, DESCRIPTION_MAX - 1)}…`;
    return { ...(name === undefined ? {} : { name }), description };
}
/**
 * The `description` field of a skill's frontmatter.
 * @param text - the whole `SKILL.md`.
 * @returns the summary without its quotes, or undefined when the file does not declare one.
 */
export function descriptionOf(text) {
    const lines = text.split('\n');
    if (lines[0]?.trim() !== '---')
        return undefined;
    const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
    if (end < 0)
        return undefined;
    const field = lines
        .slice(1, end)
        .map((line) => /^description:\s*(.*)$/u.exec(line.trim()))
        .find((match) => match !== null);
    const raw = field?.[1]?.trim();
    if (raw === undefined || raw === '')
        return undefined;
    const unquoted = raw.replace(/^['"]|['"]$/gu, '');
    return unquoted.length <= DESCRIPTION_MAX ? unquoted : `${unquoted.slice(0, DESCRIPTION_MAX - 1)}…`;
}
