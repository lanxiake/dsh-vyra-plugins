import { createRequire } from 'node:module';
import { readdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// Published tarballs carry the skills tree at <package root>/vendor/superpowers
// because pnpm 11 rejects git-resolved subdependencies (blockExoticSubdeps).
// Both `lib/` and `src/` sit one level below the package root.
const VENDORED_SKILLS_RELATIVE = join('..', 'vendor', 'superpowers', 'skills');
/**
 * Test whether a path can serve as a skills root.
 * @param dir - candidate directory.
 * @returns `undefined` when usable, otherwise the reason it was rejected.
 */
async function rejectSkillsDir(dir) {
    let st;
    try {
        st = await stat(dir);
    }
    catch {
        return `missing directory ${dir}`;
    }
    if (!st.isDirectory())
        return `${dir} is not a directory`;
    const entries = await readdir(dir);
    if (entries.length === 0)
        return `${dir} is empty`;
    return undefined;
}
/**
 * Resolve the obra Superpowers skills root, preferring the copy vendored in this
 * package and falling back to an installed `superpowers` package (local development).
 * @param options - optional require base and package name override (tests).
 * @returns absolute path to the `skills` directory.
 * @throws when neither location holds a non-empty `skills/` directory.
 */
export async function resolveSuperpowersSkillsRoot(options = {}) {
    const packageName = options.packageName ?? 'superpowers';
    const moduleUrl = options.moduleUrl ?? import.meta.url;
    const reasons = [];
    const vendored = join(dirname(fileURLToPath(moduleUrl)), VENDORED_SKILLS_RELATIVE);
    const vendoredReason = await rejectSkillsDir(vendored);
    if (vendoredReason === undefined)
        return vendored;
    reasons.push(vendoredReason);
    const require = createRequire(moduleUrl);
    let packageJsonPath;
    try {
        packageJsonPath = require.resolve(`${packageName}/package.json`);
    }
    catch (error) {
        reasons.push(`package "${packageName}" is not installed (${String(error)})`);
        throw new Error(`Cannot resolve superpowers skills root: ${reasons.join('; ')}`);
    }
    const installed = join(dirname(packageJsonPath), 'skills');
    const installedReason = await rejectSkillsDir(installed);
    if (installedReason === undefined)
        return installed;
    reasons.push(installedReason);
    throw new Error(`Cannot resolve superpowers skills root: ${reasons.join('; ')}`);
}
