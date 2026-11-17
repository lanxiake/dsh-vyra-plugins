/**
 * Replace one file's contents without ever leaving it half-written.
 *
 * A CLI reads its config on every start, so a write interrupted midway (a crash, a full disk)
 * would present that CLI with a truncated file and lose every server the user configured. The
 * text is written beside the target and renamed over it, which is atomic on the platforms this
 * plugin runs on.
 * @module vyra-agent-cli-manager/cli/atomic-write
 */
import { rename, writeFile } from 'node:fs/promises';
/**
 * Write `text` to `path`, replacing what was there only once the new text is fully on disk.
 * @param path - the file to replace.
 * @param text - its new contents.
 * @param pid - which process the temporary name belongs to; injected so a test is deterministic.
 * @returns nothing, once the rename has completed.
 */
export async function writeFileAtomically(path, text, pid = process.pid) {
    const temporary = `${path}.tmp-${String(pid)}`;
    await writeFile(temporary, text, 'utf8');
    await rename(temporary, path);
}
