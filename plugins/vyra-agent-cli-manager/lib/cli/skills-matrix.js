/**
 * One table of every skill, per CLI, for the 技能 tab.
 *
 * The rows are the union of what the CLIs would load, so a skill exists for the panel exactly
 * while some CLI's directory offers it. A cell also says whether what that CLI has is a link
 * this plugin made or a real directory of the user's own: the first can be turned off, the
 * second must not be touched, and the difference is invisible from the name alone.
 * @module vyra-agent-cli-manager/cli/skills-matrix
 */
import { join } from 'node:path';
import { CLI_CATALOG } from "./catalog.js";
import { descriptionOf } from "./skill-md.js";
/** A skill's instructions live in this one name, whatever the CLI. */
const SKILL_ENTRY = 'SKILL.md';
/** Read one CLI's skills, keeping the first directory that offers a name, as the CLI itself does. */
async function skillsOfCli(entry, host, home) {
    const seen = new Map();
    let readable = false;
    for (const directory of entry.skillsDirs) {
        const path = join(home, directory);
        const names = await host.listDirectory(path);
        if (names === undefined)
            continue;
        readable = true;
        for (const name of names) {
            if (seen.has(name))
                continue;
            const text = await host.readFile(join(path, name, SKILL_ENTRY));
            if (text === undefined)
                continue;
            const kind = await host.kindOf(join(path, name));
            seen.set(name, { name, description: descriptionOf(text) ?? '', directory, kind });
        }
    }
    if (!readable) {
        return { entry, skills: [], problem: `${entry.name} 没有技能目录（${entry.skillsDirs.join('、')}）` };
    }
    return { entry, skills: [...seen.values()] };
}
/** The directory that holds the real copy of a skill, which is what every link must point at. */
function sourceOf(skill, reads) {
    for (const read of reads) {
        const found = read.skills.find((candidate) => candidate.name === skill.name && candidate.kind === 'dir');
        if (found !== undefined)
            return join(found.directory, found.name);
    }
    return undefined;
}
/** Why this CLI cannot turn the skill on, or undefined when it can. */
function addProblemOf(read, source) {
    if (source === undefined)
        return '找不到这个技能的真实目录，只能把真实目录链接过去';
    if (read.entry.skillsDirs[0] === undefined)
        return `${read.entry.name} 没有技能目录`;
    return undefined;
}
/** One cell of the matrix. */
function cellOf(read, name, source) {
    const { entry, problem } = read;
    if (problem !== undefined)
        return { id: entry.id, state: 'unknown', blocked: problem };
    const found = read.skills.find((candidate) => candidate.name === name);
    if (found === undefined) {
        const blocked = addProblemOf(read, source);
        return { id: entry.id, state: 'off', ...(blocked === undefined ? {} : { blocked }) };
    }
    const path = join(found.directory, found.name);
    if (found.kind === 'link')
        return { id: entry.id, state: 'on', linked: true, path };
    // A real directory here is the skill's own copy; removing it would destroy every link.
    return {
        id: entry.id,
        state: 'on',
        linked: false,
        path,
        blocked: '这是真实目录，删掉会丢文件，本插件只能关闭链接',
    };
}
/** Every skill any CLI offers, in the order the first CLI that offers it lists them. */
function unionOf(reads) {
    const rows = new Map();
    for (const read of reads) {
        for (const skill of read.skills) {
            if (!rows.has(skill.name))
                rows.set(skill.name, { name: skill.name, description: skill.description });
        }
    }
    return [...rows.values()];
}
/**
 * Build the skills matrix.
 * @param host - how to read directories, files and entry kinds.
 * @param home - the directory the catalog's paths are relative to.
 * @returns one column per CLI and one row per skill, with the reason each disabled cell is disabled.
 */
export async function skillsMatrix(host, home) {
    const reads = await Promise.all(CLI_CATALOG.map((entry) => skillsOfCli(entry, host, home)));
    const columns = reads.map((read) => ({
        id: read.entry.id,
        name: read.entry.name,
        readable: read.problem === undefined,
        ...(read.problem === undefined ? {} : { problem: read.problem }),
    }));
    const rows = unionOf(reads).map((skill) => {
        const found = reads.flatMap((read) => read.skills).find((candidate) => candidate.name === skill.name);
        const source = found === undefined ? undefined : sourceOf(found, reads);
        return {
            name: skill.name,
            description: skill.description,
            source: source ?? '',
            cells: reads.map((read) => cellOf(read, skill.name, source)),
        };
    });
    return { columns, rows };
}
