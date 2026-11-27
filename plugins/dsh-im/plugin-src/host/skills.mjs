// Mount the plugin's own skills next to the Host's skill catalog.
//
// Shipping the skill inside the package (instead of copying Markdown into
// ~/.dsh/skills) means it upgrades with the plugin and leaves the user's skill
// directory untouched. The Host's SkillFileSystem provider is an optional peer:
// an older Host without it keeps working, just without the catalog entry.

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Directory name whose presence marks the package's skills root. */
const MARKER_SKILL = 'dsh-im-delivery';

/**
 * Locate the package's `skills/` directory from either the source tree or the
 * built bundle.
 *
 * `plugin-src/host/skills.mjs` sits two levels below the package root while the
 * bundle is `lib/index.js`, one level below; walking up covers both without
 * hard-coding which one is running.
 * @param start - directory to start from.
 * @returns the skills root, or null when the package layout is unexpected.
 */
export function resolveSkillsRoot(start) {
  let dir = start;
  for (let depth = 0; depth < 4; depth += 1) {
    const candidate = join(dir, 'skills');
    if (existsSync(join(candidate, MARKER_SKILL, 'SKILL.md'))) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * Register the package skills on a context that can load child plugins.
 *
 * The provider mounts a skills *root* and discovers every `<name>/SKILL.md`
 * under it, so a skill added to `skills/` ships with the package without
 * touching this file.
 * @param ctx - Cordis context with `plugin`.
 * @param options.root - skills root override (tests).
 * @param options.load - SkillFileSystem module loader override (tests).
 * @returns whether the provider was mounted.
 */
export async function installDeliverySkill(ctx, {
  root,
  load = () => import('@deepseek-ai/dsh-skill-filesystem'),
} = {}) {
  if (typeof ctx?.plugin !== 'function') return false;
  const skillsRoot = root ?? resolveSkillsRoot(dirname(fileURLToPath(import.meta.url)));
  if (!skillsRoot) return false;
  let SkillFileSystem;
  try {
    SkillFileSystem = await load();
  } catch {
    // The Host's skill provider is a peer: an older Host keeps working, just
    // without the catalog entries.
    return false;
  }
  ctx.plugin(SkillFileSystem, {
    providerName: 'dsh-im',
    includeDefaultRoots: false,
    customSkillDirs: [skillsRoot],
    // The skills live inside an installed package; they cannot change without
    // a reinstall, so watching the directory buys nothing.
    watch: false,
  });
  return true;
}
