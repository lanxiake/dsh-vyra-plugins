/**
 * Remove a leading YAML frontmatter fence from a Markdown skill file.
 * @param markdown - full file contents.
 * @returns body after the closing `---` line, or the original string if none.
 */
export function stripYamlFrontmatter(markdown) {
    if (!markdown.startsWith('---'))
        return markdown;
    const end = markdown.indexOf('\n---', 3);
    if (end === -1)
        return markdown;
    const after = markdown.slice(end + '\n---'.length);
    return after.startsWith('\n') ? after.slice(1) : after;
}
