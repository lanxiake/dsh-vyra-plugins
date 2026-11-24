/**
 * Replace one file's contents without ever leaving it half-written.
 *
 * A CLI reads its config on every start, so a write interrupted midway (a crash, a full disk)
 * would present that CLI with a truncated file and lose every server the user configured. The
 * text is written beside the target and renamed over it, which is atomic on the platforms this
 * plugin runs on.
 * @module dsh-vyra-agent-cli-manager/cli/atomic-write
 */
/**
 * Write `text` to `path`, replacing what was there only once the new text is fully on disk.
 * @param path - the file to replace.
 * @param text - its new contents.
 * @param pid - which process the temporary name belongs to; injected so a test is deterministic.
 * @returns nothing, once the rename has completed.
 */
export declare function writeFileAtomically(path: string, text: string, pid?: number): Promise<void>;
