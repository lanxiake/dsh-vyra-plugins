/**
 * Read the two other things a CLI keeps on disk besides its MCP servers: the skills it will
 * offer the model, and the global instruction file it prepends to every session.
 *
 * Both are plain files under a path the catalog already records, so nothing here runs a CLI:
 * these are reads of the user's own configuration, and a CLI's own command for listing skills
 * prints a table meant for a terminal rather than a stable contract.
 * @module dsh-vyra-agent-cli-manager/cli/assets
 */
import { join } from 'node:path';
/** A skill's instructions live in this one name, whatever the CLI. */
const SKILL_ENTRY = 'SKILL.md';
/** Long enough for any real instruction file; a pasted log is not a prompt. */
const PROMPT_MAX = 200_000;
/**
 * List the skills a CLI would offer.
 *
 * A CLI reads several directories, and the more specific one wins a name collision, so the
 * first directory that offers a name owns it here too.
 * @param entry - the CLI whose directories to read.
 * @param host - how to reach the disk.
 * @param home - the user's home, which the catalog paths are relative to.
 * @returns the skills found, the directories looked at, and why there were none.
 */
export async function listSkills(entry, host, home) {
    const directories = entry.skillsDirs;
    const seen = new Map();
    let readable = false;
    for (const directory of directories) {
        const path = join(home, directory);
        const names = await host.listDirectory(path);
        if (names === undefined)
            continue;
        readable = true;
        for (const name of names) {
            if (seen.has(name))
                continue;
            // A directory counts only when it holds the entry file; anything else would never load.
            const text = await host.readFile(join(path, name, SKILL_ENTRY));
            if (text === undefined)
                continue;
            seen.set(name, { name, loadable: text.trim() !== '' });
        }
    }
    if (!readable) {
        return { skills: [], directories, error: `${entry.name} 没有技能目录（${directories.join('、')}）` };
    }
    return { skills: [...seen.values()], directories };
}
/**
 * Read a CLI's global instruction file.
 * @param entry - the CLI whose file to read.
 * @param host - how to reach the disk.
 * @param home - the user's home, which the catalog path is relative to.
 * @returns the document and its path, or an error naming both when it could not be read.
 */
export async function readPrompt(entry, host, home) {
    const path = join(home, entry.promptFile);
    const text = await host.readFile(path);
    // A CLI that was never given global instructions has no file; that is an empty prompt.
    if (text === undefined)
        return { path: entry.promptFile, text: '' };
    if (text.length > PROMPT_MAX) {
        return { error: `${entry.promptFile} 超过 ${String(PROMPT_MAX / 1000)}KB，本插件不读取这么大的文件` };
    }
    return { path: entry.promptFile, text };
}
