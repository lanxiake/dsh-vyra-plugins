/**
 * Keeps each CLI's model list on disk. The harness restarts this plugin when its files
 * change (an update, or a rebuild under a linked install), and a fresh catalog would show
 * a bare menu until the CLI is probed again; with the saved lists it is filled at once.
 * @module vyra-agent-cli-manager/model-cache
 */
import type { CliModelList } from './model-options.ts';
/**
 * Read the saved lists, keeping only well-formed entries.
 * @param text - the file's contents.
 * @returns the lists by provider route; empty for anything unreadable.
 */
export declare function parseModelCache(text: string): ReadonlyMap<string, CliModelList>;
/** One cache file, with writes kept in order. */
export declare class ModelCacheFile {
    private readonly path;
    private writing;
    constructor(path: string);
    /**
     * Read the saved lists.
     * @returns them by provider route; empty before the first save or for a corrupt file.
     */
    read(): Promise<ReadonlyMap<string, CliModelList>>;
    /**
     * Replace the saved lists. Writes run one at a time in call order, so a later, fuller
     * snapshot never lands under an earlier one; each goes through a temporary file, so a
     * reader never sees half a file.
     * @param lists - every list to keep, by provider route.
     * @returns settles once this snapshot is on disk; rejects when it could not be written.
     */
    save(lists: ReadonlyMap<string, CliModelList>): Promise<void>;
    private write;
}
