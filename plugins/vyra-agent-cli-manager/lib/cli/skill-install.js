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
 * @module vyra-agent-cli-manager/cli/skill-install
 */
import { join } from 'node:path';
import { BadRequest } from "./errors.js";
import { parseSkillMarkdown } from "./skill-md.js";
/** The library every source installs into, relative to the user's home. */
export const SKILL_LIBRARY_DIR = join('.agents', 'skills');
/** A directory name this plugin will create or replace. */
const SKILL_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
/** Longest instruction file this plugin will write. A skill is a prompt, not a document set. */
export const MAX_SKILL_CHARS = 256 * 1024;
/** A refusal this plugin makes on purpose. The message is ready to show. */
export class SkillInstallError extends Error {
    name = 'SkillInstallError';
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
export function skillDirName(declared, suggested) {
    for (const candidate of [declared, suggested]) {
        const trimmed = candidate?.trim();
        if (trimmed !== undefined && trimmed !== '' && SKILL_NAME.test(trimmed))
            return trimmed;
    }
    const shown = declared ?? suggested ?? '';
    throw new SkillInstallError(shown === ''
        ? '技能没有名字：SKILL.md 的 frontmatter 需要 name，或在上面的输入框里填一个'
        : `不是合法的技能名「${shown}」：只能用字母数字开头，可含 . _ -，最长 64 字`);
}
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
export function assertInstalledSkill(markdown) {
    if (markdown.length > MAX_SKILL_CHARS) {
        throw new SkillInstallError(`技能内容过长（${String(markdown.length)} 字，上限 ${String(MAX_SKILL_CHARS)}）`);
    }
    const parsed = parseSkillMarkdown(markdown);
    if (parsed === undefined) {
        throw new SkillInstallError('SKILL.md 需要以 --- 开头的 frontmatter，其中至少要有 description');
    }
    if (parsed.description === '') {
        throw new SkillInstallError('SKILL.md 的 frontmatter 里没有 description：模型靠它判断什么时候该用这个技能');
    }
    return parsed;
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
export function parseRepoReference(raw) {
    const text = raw.trim().replace(/^https?:\/\//i, '').replace(/^github\.com\//i, '');
    const segments = text.split('/').filter((part) => part !== '');
    if (segments.length < 2) {
        throw new SkillInstallError(`不是有效的仓库：${raw}（写成 owner/repo，或粘贴 GitHub 链接）`);
    }
    const [owner, repo, marker, ...rest] = segments;
    const name = repo?.replace(/\.git$/i, '') ?? '';
    if (owner === undefined || name === '')
        throw new SkillInstallError(`不是有效的仓库：${raw}`);
    // `tree/<branch>/…` is a link to a directory; everything after the branch is the path.
    const inside = marker === 'tree' || marker === 'blob' ? rest.slice(1) : marker === undefined ? [] : [marker, ...rest];
    return { repository: `${owner}/${name}`, path: inside.length === 0 ? undefined : inside.join('/') };
}
/**
 * Where a repository keeps its `SKILL.md`, in the order worth trying.
 *
 * A skills repository varies enough that one guess is wrong more often than not: some hold one
 * skill at the root, some keep them under `skills/`, and the ecosystem also uses `.claude/skills`
 * and `.agents/skills`. The path the user gave wins when there is one.
 */
function candidatePaths(ref, fallbackName) {
    if (ref.path !== undefined && ref.path !== '') {
        // A path naming a directory holds the file; one already naming the file is taken as-is.
        return ref.path.toLowerCase().endsWith('.md') ? [ref.path] : [`${ref.path}/SKILL.md`];
    }
    const guesses = ['SKILL.md', 'skills/SKILL.md'];
    if (fallbackName !== undefined && fallbackName !== '') {
        guesses.push(`skills/${fallbackName}/SKILL.md`, `${fallbackName}/SKILL.md`, `.claude/skills/${fallbackName}/SKILL.md`, `.agents/skills/${fallbackName}/SKILL.md`);
    }
    return guesses;
}
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
export async function installSkill(host, home, source) {
    let markdown;
    let suggested;
    if (source.kind === 'paste') {
        markdown = source.markdown;
        suggested = source.name;
    }
    else if (source.kind === 'local') {
        const directory = source.directory.trim();
        if (directory === '')
            throw new SkillInstallError('请填写技能所在目录');
        const file = join(directory, 'SKILL.md');
        const text = await host.readFile(file);
        if (text === undefined)
            throw new SkillInstallError(`这个目录里没有 SKILL.md：${directory}`);
        markdown = text;
        suggested = source.name ?? basenameOf(directory);
    }
    else {
        const ref = parseRepoReference(source.repository);
        // The separate path field wins over one embedded in the reference, because it is the field
        // the user typed last and it is the one labelled as the path. Earlier this read only the
        // parsed reference, so a path typed into its own box was silently ignored and the installer
        // guessed instead — which reads as "the path field does nothing".
        const withPath = source.path !== undefined && source.path.trim() !== ''
            ? { repository: ref.repository, path: source.path.trim() }
            : ref;
        suggested = source.name ?? withPath.path?.split('/').filter(Boolean).pop();
        let text;
        for (const candidate of candidatePaths(withPath, source.name)) {
            text = await host.fetchRepositoryFile(withPath.repository, candidate);
            if (text !== undefined)
                break;
        }
        if (text === undefined) {
            throw new SkillInstallError(`在 ${withPath.repository} 里没找到 SKILL.md（试过 ${candidatePaths(withPath, source.name).join('、')}）；` +
                '可以填上仓库内的具体路径。');
        }
        markdown = text;
    }
    const parsed = assertInstalledSkill(markdown);
    const name = skillDirName(parsed.name, suggested);
    const relative = join(SKILL_LIBRARY_DIR, name);
    const absolute = join(home, relative);
    const existing = await host.kindOf(absolute);
    if (existing === 'link') {
        // A link here is one this plugin made when the CLI list pointed at another library. Replacing
        // it is right, but the target is not this module's to delete — unlink the link only.
        await host.removeEntry(absolute);
    }
    else if (existing === 'dir') {
        await host.removeTree(absolute);
    }
    else if (existing === 'other') {
        throw new SkillInstallError(`${relative} 已经存在，而且不是一个目录`);
    }
    await host.writeFile(join(absolute, 'SKILL.md'), markdown);
    return { name, path: relative, replaced: existing !== undefined };
}
/** The last segment of a path, for naming a skill after the directory it came from. */
function basenameOf(directory) {
    const parts = directory.replace(/[/\\]+$/, '').split(/[/\\]/);
    return parts[parts.length - 1] ?? '';
}
/** One optional string field, trimmed; undefined when absent or empty. */
function optionalString(body, field) {
    const value = body[field];
    if (value === undefined || value === null)
        return undefined;
    if (typeof value !== 'string')
        throw new BadRequest(`${field} 必须是字符串`);
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
}
/** The one required string field of a given source kind. */
function requiredString(body, field, kind) {
    const value = optionalString(body, field);
    if (value === undefined)
        throw new BadRequest(`${kind} 来源需要 ${field}`);
    return value;
}
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
export function skillInstallRequestOf(body) {
    if (typeof body !== 'object' || body === null)
        throw new BadRequest('请求体必须是 JSON 对象');
    const record = body;
    const kind = record.kind;
    const name = optionalString(record, 'name');
    if (kind === 'paste') {
        return {
            source: {
                kind: 'paste',
                markdown: requiredString(record, 'markdown', '粘贴'),
                ...(name === undefined ? {} : { name }),
            },
        };
    }
    if (kind === 'local') {
        return {
            source: {
                kind: 'local',
                directory: requiredString(record, 'directory', '本地目录'),
                ...(name === undefined ? {} : { name }),
            },
        };
    }
    if (kind === 'github') {
        const path = optionalString(record, 'path');
        return {
            source: {
                kind: 'github',
                repository: requiredString(record, 'repository', 'GitHub'),
                ...(path === undefined ? {} : { path }),
                ...(name === undefined ? {} : { name }),
            },
        };
    }
    throw new BadRequest(`不认识的技能来源：${String(kind)}（可用 paste、local、github）`);
}
