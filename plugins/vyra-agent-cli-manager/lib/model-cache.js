/**
 * Keeps each CLI's model list on disk. The harness restarts this plugin when its files
 * change (an update, or a rebuild under a linked install), and a fresh catalog would show
 * a bare menu until the CLI is probed again; with the saved lists it is filled at once.
 * @module dsh-vyra-agent-cli-manager/model-cache
 */
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
/** Bumped when the layout changes; a file of another version is ignored, not misread. */
const CACHE_VERSION = 1;
const isObject = (value) => typeof value === 'object' && value !== null;
const isText = (value) => typeof value === 'string' && value.length > 0;
function readOption(value) {
    if (!isObject(value) || !isText(value.value) || !isText(value.name))
        return undefined;
    return {
        value: value.value,
        name: value.name,
        ...(isText(value.description) ? { description: value.description } : {}),
    };
}
/** Checked as strictly as a live answer: one empty id makes the harness drop the whole CLI. */
function readOptions(value) {
    if (!isObject(value) || !isText(value.configId) || !isText(value.current) || !Array.isArray(value.options)) {
        return undefined;
    }
    const options = value.options.map(readOption);
    if (options.length === 0 || options.some((option) => option === undefined))
        return undefined;
    return { configId: value.configId, current: value.current, options: options.filter((option) => option !== undefined) };
}
/** Levels only add to the menu, so a bad entry loses that model's levels, not the list. */
function readEfforts(value) {
    if (!isObject(value) || Array.isArray(value))
        return undefined;
    const entries = Object.entries(value).flatMap(([model, effort]) => {
        if (effort === null)
            return [[model, null]];
        const read = readOptions(effort);
        return read === undefined ? [] : [[model, read]];
    });
    return entries.length === 0 ? undefined : Object.fromEntries(entries);
}
/** A CLI's native modes are kept verbatim; a bad entry loses the modes, not the list. */
function readModes(value) {
    const read = readOptions(value);
    return read === undefined ? undefined : { configId: read.configId, current: read.current, options: read.options };
}
function readList(value) {
    const list = readOptions(value);
    if (list === undefined || !isObject(value))
        return undefined;
    const efforts = readEfforts(value.efforts);
    const modes = readModes(value.modes);
    return {
        ...list,
        ...(efforts === undefined ? {} : { efforts }),
        ...(modes === undefined ? {} : { modes }),
    };
}
function parseJson(text) {
    try {
        return JSON.parse(text);
    }
    catch {
        // A torn or hand-edited file is only a lost cache; the next probe writes a good one.
        return undefined;
    }
}
/**
 * Read the saved lists, keeping only well-formed entries.
 * @param text - the file's contents.
 * @returns the lists by provider route; empty for anything unreadable.
 */
export function parseModelCache(text) {
    const data = parseJson(text);
    if (!isObject(data) || data.version !== CACHE_VERSION || !isObject(data.lists))
        return new Map();
    return new Map(Object.entries(data.lists).flatMap(([provider, value]) => {
        const list = readList(value);
        return list === undefined ? [] : [[provider, list]];
    }));
}
const isMissing = (error) => isObject(error) && error.code === 'ENOENT';
/** One cache file, with writes kept in order. */
export class ModelCacheFile {
    path;
    writing = Promise.resolve();
    constructor(path) {
        this.path = path;
    }
    /**
     * Read the saved lists.
     * @returns them by provider route; empty before the first save or for a corrupt file.
     */
    async read() {
        try {
            return parseModelCache(await readFile(this.path, 'utf8'));
        }
        catch (error) {
            if (isMissing(error))
                return new Map();
            throw error;
        }
    }
    /**
     * Replace the saved lists. Writes run one at a time in call order, so a later, fuller
     * snapshot never lands under an earlier one; each goes through a temporary file, so a
     * reader never sees half a file.
     * @param lists - every list to keep, by provider route.
     * @returns settles once this snapshot is on disk; rejects when it could not be written.
     */
    save(lists) {
        const text = JSON.stringify({ version: CACHE_VERSION, lists: Object.fromEntries(lists) });
        const written = this.writing.then(() => this.write(text));
        this.writing = written.catch(() => {
            /* the caller of this save is told; the next one still runs */
        });
        return written;
    }
    async write(text) {
        const temporary = `${this.path}.${randomUUID()}.tmp`;
        await mkdir(dirname(this.path), { recursive: true });
        try {
            await writeFile(temporary, text, 'utf8');
            await rename(temporary, this.path);
        }
        catch (error) {
            await rm(temporary, { force: true });
            throw error;
        }
    }
}
