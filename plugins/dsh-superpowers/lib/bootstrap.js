import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { stripYamlFrontmatter } from './strip-frontmatter.js';
const DSH_NOTE = [
    '',
    '## DeepSeek Harness',
    'Load Superpowers skills with the `skill` tool when a skill applies.',
    'Skills are addressed by their bare name (e.g. `skill` / `brainstorming`) — ignore any `superpowers:` prefix used above; that is the provider label, not part of the catalog name.',
    'Do not assume Claude Code–only tools or hooks are available.',
].join('\n');
/** System-prompt section name for Superpowers bootstrap guidance. */
export const BOOTSTRAP_SECTION_NAME = 'superpowers:bootstrap';
/** After deployment persona (0), before tool guidance (100–199). */
export const BOOTSTRAP_SECTION_ORDER = 50;
/**
 * Append the DeepSeek Harness skill-tool note to stripped Superpowers instructions.
 * @param skillMarkdown - body text from `using-superpowers/SKILL.md`.
 * @returns combined bootstrap text for model injection.
 */
export function buildBootstrapText(skillMarkdown) {
    return skillMarkdown + DSH_NOTE;
}
/**
 * Read and strip the `using-superpowers` skill body from a skills root.
 * @param skillsRoot - absolute path to the Superpowers `skills/` directory.
 * @returns stripped skill body, or `undefined` when the file is missing.
 */
export async function readUsingSuperpowersText(skillsRoot) {
    const skillPath = join(skillsRoot, 'using-superpowers', 'SKILL.md');
    let raw;
    try {
        raw = await readFile(skillPath, 'utf8');
    }
    catch (error) {
        // Soft-fail only when the skill file or a path segment is absent.
        if (typeof error === 'object'
            && error !== null
            && 'code' in error
            && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) {
            return undefined;
        }
        throw error;
    }
    return stripYamlFrontmatter(raw);
}
/**
 * Register Superpowers bootstrap as a durable system-prompt section so it is
 * present on the first model request (unlike `agent.inject` at session-start).
 * @param ctx - Cordis context with `systemPrompt` injected.
 * @param options - skills root and optional inject toggle.
 */
export async function registerSuperpowersBootstrap(ctx, options) {
    if (options.injectBootstrap === false)
        return;
    const skillText = await readUsingSuperpowersText(options.skillsRoot);
    if (skillText === undefined) {
        ctx.logger.warn('dsh-superpowers: using-superpowers/SKILL.md missing; skipping session bootstrap');
        return;
    }
    ctx.systemPrompt.section({
        name: BOOTSTRAP_SECTION_NAME,
        order: BOOTSTRAP_SECTION_ORDER,
        text: buildBootstrapText(skillText),
    });
}
