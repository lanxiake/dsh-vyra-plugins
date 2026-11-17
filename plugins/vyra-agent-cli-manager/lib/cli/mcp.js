/**
 * Read the MCP servers a CLI has configured.
 *
 * Where a CLI keeps them in JSON this reads that file, because the file is the stable contract
 * and its shape survives the CLI's own chatty output formatting. Codex keeps them in TOML —
 * Node has no TOML parser and writing one would mean maintaining a second copy of Codex's
 * schema — so for it the CLI's own `mcp list` is run and its text is passed through verbatim
 * rather than parsed by guesswork.
 * @module vyra-agent-cli-manager/cli/mcp
 */
import { join } from 'node:path';
/** A CLI that may take a while to answer. */
const LIST_TIMEOUT_MS = 15_000;
/** Long enough for a command line, short enough for one row. */
const DETAIL_MAX = 160;
/**
 * Credential shapes that appear inside a server's own arguments. A server configured with
 * `--header x-api-key:...` carries its secret in the command line, and this panel would
 * otherwise print it on screen where a screenshot or a shared display would expose it.
 */
const SECRET_ARG = /((?:--?[\w-]*(?:key|token|secret|password)|authorization)[=:\s]+)(\S+)/gi;
const SECRET_TOKEN = /(^|[\s"'=:])((?:sk|pk|ghp|gho|github_pat|xox[baprs])[-_][\w-]{8,})/g;
/**
 * Mask anything in a command line that looks like a credential, keeping the key so the row
 * still says which header the server sets.
 * @param text - the command line as configured.
 * @returns the same line with each secret replaced by a fixed marker.
 */
export function redact(text) {
    const masked = text.replace(SECRET_ARG, (_all, prefix) => `${prefix}***`).replace(SECRET_TOKEN, '$1***');
    // A bare header value such as `x-api-key:iv1…` has no flag in front of it.
    return masked.replace(/(\b[\w-]*(?:key|token|secret)\s*[:=]\s*)(?!\*\*\*)\S+/gi, '$1***');
}
const isRecord = (value) => typeof value === 'object' && value !== null;
function clip(text) {
    const flat = text.replace(/\s+/g, ' ').trim();
    return flat.length <= DETAIL_MAX ? flat : `${flat.slice(0, DETAIL_MAX - 1)}…`;
}
/** The command line a stdio server runs, as the config already wrote it. */
function commandLine(def) {
    const command = def.command;
    if (Array.isArray(command))
        return command.map((part) => String(part)).join(' ');
    const args = Array.isArray(def.args) ? def.args.map((arg) => String(arg)) : [];
    return [typeof command === 'string' ? command : '', ...args].filter((part) => part !== '').join(' ');
}
/**
 * Describe one server. Vendor files disagree on the discriminator: some use `type: 'stdio'`,
 * some `type: 'local'`, and some leave it out and let `command` versus `url` decide.
 */
function summarize(name, def) {
    if (!isRecord(def))
        return { name, transport: 'unknown', detail: '' };
    const declared = typeof def.type === 'string' ? def.type.toLowerCase() : undefined;
    const url = typeof def.url === 'string' ? def.url : undefined;
    const transport = declared === 'local'
        ? 'stdio'
        : declared === 'remote'
            ? 'http'
            : (declared ?? (url === undefined ? 'stdio' : 'http'));
    return { name, transport, detail: url === undefined ? clip(redact(commandLine(def))) : clip(url) };
}
/**
 * Pull the servers out of one parsed config document.
 * @param document - the parsed JSON, or the tables this plugin read out of a TOML config.
 * @param key - the field the CLI keeps them under.
 * @returns one summary per server, in the file's order.
 */
export function serversOf(document, key) {
    if (!isRecord(document))
        return [];
    const group = document[key];
    if (!isRecord(group))
        return [];
    return Object.entries(group).map(([name, def]) => summarize(name, def));
}
async function fromFile(entry, host, home) {
    const { mcpFile, mcpKey } = entry;
    if (mcpFile === undefined || mcpKey === undefined)
        return undefined;
    const text = await host.readFile(join(home, mcpFile));
    // A CLI that has never been configured has no file; that is an empty list, not a failure.
    if (text === undefined || text.trim() === '')
        return { servers: [], source: 'file' };
    try {
        return { servers: serversOf(JSON.parse(text), mcpKey), source: 'file' };
    }
    catch {
        return { servers: [], source: 'file', error: `${entry.name} 的配置文件不是合法 JSON（${mcpFile}）` };
    }
}
async function fromCli(entry, host, timeoutMs) {
    const listArgs = entry.mcp.list;
    if (listArgs === undefined) {
        return { servers: [], source: 'cli', error: `${entry.name} 没有可用于列出 MCP 的命令` };
    }
    const argv = [entry.binary, ...listArgs];
    const signal = AbortSignal.timeout(timeoutMs);
    const printed = await host.capture(argv, signal).catch(() => '');
    if (printed.trim() === '') {
        return {
            servers: [],
            source: 'cli',
            error: `${entry.name} 没有报告任何 MCP 服务器（或 ${entry.binary} ${listArgs.join(' ')} 执行失败）`,
        };
    }
    // Passed through rather than parsed: this module has no evidence of the format.
    return { servers: [], source: 'cli', raw: printed.trim() };
}
/**
 * List one CLI's configured MCP servers.
 * @param entry - the CLI to read.
 * @param host - how to read a file and run a command.
 * @param home - the user's home directory, which the catalog paths are relative to.
 * @param timeoutMs - how long a CLI-run list may take.
 * @returns the servers, where they came from, and why there are none when that is the case.
 */
export async function listMcpServers(entry, host, home, timeoutMs = LIST_TIMEOUT_MS) {
    const fromDisk = await fromFile(entry, host, home);
    if (fromDisk !== undefined)
        return fromDisk;
    if (!entry.mcp.viaSubcommands) {
        return {
            servers: [],
            source: 'file',
            error: `${entry.name} 的 MCP 服务器由它自己的界面管理，本插件暂不支持读取`,
        };
    }
    return await fromCli(entry, host, timeoutMs);
}
