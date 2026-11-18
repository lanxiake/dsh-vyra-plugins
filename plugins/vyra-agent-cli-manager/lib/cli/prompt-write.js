/**
 * Replace a CLI's global instruction file with the text the user edited.
 *
 * This is the one write the panel makes to a file the CLI owns rather than delegating: those
 * files have no CLI command that sets them, and the measured shape is a single markdown
 * document at a path the catalog records. A CLI whose catalog entry names that path may have
 * it written even when the file does not exist yet, which is the case for the harness itself.
 * @module vyra-agent-cli-manager/cli/prompt-write
 */
import { dirname, join } from 'node:path';
import { BadRequest } from "./errors.js";
/**
 * A write this plugin will not make. The message is ready to show; `status` says whether the
 * request was refused (400) or the file could not be written (500).
 */
export class PromptWriteError extends Error {
    name = 'PromptWriteError';
    /** 400 when this plugin refuses the request, 500 when the write itself failed. */
    status;
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}
/** Larger than any instruction document a person edits by hand. */
const PROMPT_MAX = 200_000;
/**
 * The request's text, refusing anything that is not a string within the size bound.
 * @param body - the decoded request body.
 * @returns the text to write.
 */
export function promptWriteRequestOf(body) {
    if (typeof body !== 'object' || body === null || !('text' in body)) {
        throw new BadRequest('缺少 text');
    }
    const { text } = body;
    if (typeof text !== 'string') {
        throw new BadRequest('text 必须是字符串');
    }
    if (text.length > PROMPT_MAX) {
        throw new PromptWriteError(`提示词超过 ${String(PROMPT_MAX / 1000)}KB，本插件不写入这么大的文件`);
    }
    return text;
}
/**
 * Write one CLI's global instruction file.
 *
 * The parent directory is created when missing, because a CLI that has never been given global
 * instructions has no config directory either — the harness is the case in point — and a write
 * that failed on that would be unable to create the very file the panel offers to create.
 * @param entry - the CLI whose file to write.
 * @param host - how to reach the disk.
 * @param home - the user's home, which the catalog path is relative to.
 * @param text - the new file contents.
 * @returns the path written, relative to the home, and the size on disk.
 * @throws {PromptWriteError} when the CLI has no instruction file, or the write failed.
 */
export async function writePrompt(entry, host, home, text) {
    if (entry.promptFile === undefined) {
        throw new PromptWriteError(`${entry.name} 没有可写的全局提示词文件`);
    }
    const path = join(home, entry.promptFile);
    await host.ensureDirectory(dirname(path));
    try {
        await host.writeFile(path, text);
    }
    catch (error) {
        throw new PromptWriteError(`${entry.promptFile} 写入失败：${error instanceof Error ? error.message : String(error)}`, 500);
    }
    return { path: entry.promptFile, bytes: Buffer.byteLength(text, 'utf8') };
}
/** The filesystem helpers this module needs, which the route supplies. */
export const promptWriteHostOf = (routes) => ({
    readFile: routes.readFile,
    writeFile: routes.writeFile,
    ensureDirectory: routes.ensureDirectory,
});
