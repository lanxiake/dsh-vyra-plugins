import z from '@deepseek-ai/schemastery';
import * as SkillFileSystem from '@deepseek-ai/dsh-skill-filesystem';
import { resolveSuperpowersSkillsRoot } from './resolve-skills-root.js';
import { registerSuperpowersBootstrap } from './bootstrap.js';
/** Cordis plugin name registered by this package. */
export const name = 'dsh-superpowers';
/** Services required before `apply` runs. */
export const inject = ['skills', 'systemPrompt'];
/** Validated schema for {@link Config}. */
export const Config = z.object({
    injectBootstrap: z.boolean().default(true),
});
/**
 * Mount Superpowers skills and optional session bootstrap using a known skills root.
 * @param ctx - Cordis context with `skills` injected.
 * @param config - plugin config.
 * @param skillsRoot - absolute Superpowers `skills/` path.
 */
export async function applyWithSkillsRoot(ctx, config, skillsRoot) {
    ctx.plugin(SkillFileSystem, {
        providerName: 'superpowers',
        includeDefaultRoots: false,
        customSkillDirs: [skillsRoot],
        // The skills root lives inside an installed npm dependency; it cannot
        // change without a reinstall, so watching it buys nothing.
        watch: false,
    });
    if (config.injectBootstrap !== false) {
        await registerSuperpowersBootstrap(ctx, { skillsRoot });
    }
}
/**
 * Resolve Superpowers from node_modules, mount skills, register bootstrap.
 * @param ctx - Cordis context with `skills` injected.
 * @param config - plugin config.
 */
export async function apply(ctx, config = {}) {
    const skillsRoot = await resolveSuperpowersSkillsRoot();
    await applyWithSkillsRoot(ctx, config, skillsRoot);
}
