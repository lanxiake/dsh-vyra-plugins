/**
 * Turn a skill on or off for one CLI by linking, never copying.
 *
 * A skill's instructions live in one directory; a CLI loads it from any directory in its own
 * `skillsDirs`. Linking the real directory into another CLI's list means the skill is upgraded
 * in one place. The dangerous half is removal: this module only ever deletes an entry it has
 * just verified is a link, because a real directory there is the user's own work and deleting
 * it would lose files nothing else holds.
 * @module dsh-vyra-agent-cli-manager/cli/skill-links
 */
import { join } from 'node:path';
import { CLI_CATALOG } from "./catalog.js";
/** A skill's instructions live in this one name, whatever the CLI. */
const SKILL_ENTRY = 'SKILL.md';
/** A directory name this plugin is willing to create a link for. */
const SKILL_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
/** A refusal this plugin makes on purpose. The message is ready to show. */
export class SkillLinkError extends Error {
    name = 'SkillLinkError';
}
function assertName(name) {
    if (!SKILL_NAME.test(name))
        throw new SkillLinkError(`不是合法的技能名：${name}`);
    return name;
}
/**
 * The real directory a skill can be linked from.
 *
 * Only a directory counts: a link is something this plugin made earlier, and pointing a new
 * link at another link would make one CLI depend on another CLI's list rather than on the skill.
 */
async function sourceOf(name, host, home) {
    for (const entry of CLI_CATALOG) {
        for (const directory of entry.skillsDirs) {
            const path = join(home, directory, name);
            if ((await host.readFile(join(path, SKILL_ENTRY))) === undefined)
                continue;
            if ((await host.kindOf(path)) === 'dir')
                return path;
        }
    }
    return undefined;
}
/** Every directory of one CLI that currently offers this name, as an absolute path. */
async function holdersOf(entry, name, host, home) {
    const found = [];
    for (const directory of entry.skillsDirs) {
        const path = join(home, directory, name);
        if ((await host.kindOf(path)) !== undefined)
            found.push(path);
    }
    return found;
}
/**
 * Link one skill into a CLI's own skills directory.
 * @param request.entry - the CLI to turn the skill on for.
 * @param request.host - how to reach the disk.
 * @param request.home - the user's home, which the catalog paths are relative to.
 * @param request.name - the skill's directory name.
 * @returns where the link was made and what it points at.
 * @throws SkillLinkError when the skill has no real directory, or the target already holds it.
 */
export async function enableSkill(request) {
    const { entry, host, home } = request;
    const name = assertName(request.name);
    const primary = entry.skillsDirs[0];
    if (primary === undefined)
        throw new SkillLinkError(`${entry.name} 没有技能目录，无法启用技能`);
    const path = join(home, primary, name);
    const existing = await host.kindOf(path);
    if (existing !== undefined) {
        throw new SkillLinkError(`${entry.name} 的技能目录里已经有 ${name}（${existing === 'link' ? '已是指向别处的链接' : '是真实目录'}）`);
    }
    const source = await sourceOf(name, host, home);
    if (source === undefined)
        throw new SkillLinkError(`找不到 ${name} 的真实技能目录，只能链接真实目录`);
    await host.mkdir(join(home, primary));
    await host.link(source, path);
    return { id: entry.id, path: join(primary, name), source: source.slice(home.length + 1) };
}
/**
 * Remove the link that turns one skill on for a CLI.
 * @param request.entry - the CLI to turn the skill off for.
 * @param request.host - how to reach the disk.
 * @param request.home - the user's home, which the catalog paths are relative to.
 * @param request.name - the skill's directory name.
 * @returns the path that was removed.
 * @throws SkillLinkError when the CLI does not have the skill, or what it has is a real directory.
 */
export async function disableSkill(request) {
    const { entry, host, home } = request;
    const name = assertName(request.name);
    const holders = await holdersOf(entry, name, host, home);
    if (holders.length === 0)
        throw new SkillLinkError(`${entry.name} 没有技能 ${name}`);
    for (const path of holders) {
        const kind = await host.kindOf(path);
        if (kind === 'dir') {
            // The skill's own copy lives here; deleting it would destroy what every link points at.
            throw new SkillLinkError(`${path.slice(home.length + 1)} 是真实目录，删掉会丢文件，本插件不删`);
        }
        if (kind !== 'link')
            throw new SkillLinkError(`${path.slice(home.length + 1)} 不是链接，本插件只会删除链接`);
        await host.remove(path);
        return { id: entry.id, path: path.slice(home.length + 1) };
    }
    throw new SkillLinkError(`${entry.name} 没有技能 ${name}`);
}
