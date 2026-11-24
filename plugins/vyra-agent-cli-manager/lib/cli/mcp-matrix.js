/**
 * One table of every MCP server, per CLI, for the matrix view.
 *
 * The rows are the union of what the CLIs actually have configured, so nothing here is remember-
 * ed by this plugin: a server exists for the panel exactly while some CLI's own config says it
 * does. Each cell also carries the reason its checkbox is disabled, which is what keeps the
 * matrix honest — a greyed cell that cannot say why is indistinguishable from a bug.
 * @module dsh-vyra-agent-cli-manager/cli/mcp-matrix
 */
import { join } from 'node:path';
import { CLI_CATALOG } from "./catalog.js";
import { serversOf } from "./mcp.js";
import { mcpServersOfToml } from "./toml-mcp.js";
/** A CLI's config a TOML reader has to go through, keyed by the table it keeps servers in. */
const CODEX_TABLE = 'mcp_servers';
const CODEX_FILE = 'config.toml';
/**
 * A Codex entry that declares stdio and still carries a `url`.
 *
 * Codex refuses to load its entire config in that case, so every `codex mcp` subcommand fails
 * with a message about one unrelated server. Naming the entry here turns that into something
 * the user can act on, and it is checkable from the file this plugin already reads.
 */
function stdioWithUrlOf(entry, tables) {
    for (const [name, definition] of Object.entries(tables)) {
        const url = definition.url;
        const kind = definition.type ?? definition.transport;
        if (typeof url === 'string' && url !== '' && kind === 'stdio') {
            return ` ${entry.name} 的 config.toml 里 mcp_servers.${name} 声明了 stdio 却带 url，${entry.name} 会因此拒绝加载整份配置；删掉 type/command，改用「${entry.name} mcp add ${name} --url ${url}」重新添加即可。`;
        }
    }
    return undefined;
}
/** Where one CLI keeps its server list, and what to call that file in a message. */
function fileOf(entry) {
    if (entry.mcpFile !== undefined)
        return { absolute: entry.mcpFile, relative: entry.mcpFile };
    // The one config this plugin reads as TOML: Codex keeps no JSON file at all.
    if (entry.mcpKey === undefined) {
        return { absolute: join(entry.configDir, CODEX_FILE), relative: join(entry.configDir, CODEX_FILE) };
    }
    return undefined;
}
function messageOf(error) {
    return error instanceof Error ? error.message : String(error);
}
/**
 * The raw definition of every server one CLI has, unredacted and unconverted.
 *
 * The matrix only shows a display string, and that string is redacted; copying a server to
 * another CLI therefore has to come back here for the real value rather than rebuild it from
 * what the panel printed.
 * @param entry - the CLI to read.
 * @param host - how to read its config file.
 * @param home - the directory the catalog's paths are relative to.
 * @returns the definitions by name, or undefined when its config could not be read.
 */
export async function definitionsOf(entry, host, home) {
    const file = fileOf(entry);
    if (file === undefined)
        return undefined;
    const text = await host.readFile(join(home, file.absolute));
    if (text === undefined || text.trim() === '')
        return {};
    try {
        if (entry.mcpFile === undefined) {
            const tables = mcpServersOfToml(text);
            return Object.fromEntries(Object.entries(tables));
        }
        const document = JSON.parse(text);
        if (typeof document !== 'object' || document === null)
            return undefined;
        const group = Reflect.get(document, entry.mcpKey ?? 'mcpServers');
        if (typeof group !== 'object' || group === null)
            return {};
        return group;
    }
    catch {
        return undefined;
    }
}
/** Read one CLI's list, turning every failure into a stated problem rather than an empty list. */
async function serversOfCli(entry, host, home) {
    const file = fileOf(entry);
    if (file === undefined) {
        return { entry, servers: [], problem: `${entry.name} 的配置格式本插件尚未支持` };
    }
    const text = await host.readFile(join(home, file.absolute));
    if (text === undefined || text.trim() === '')
        return { entry, servers: [] };
    try {
        if (entry.mcpFile === undefined) {
            const tables = mcpServersOfToml(text);
            const note = stdioWithUrlOf(entry, tables);
            const servers = serversOf({ [CODEX_TABLE]: tables }, CODEX_TABLE);
            return { entry, servers, ...(note === undefined ? {} : { note }) };
        }
        return { entry, servers: serversOf(JSON.parse(text), entry.mcpKey ?? 'mcpServers') };
    }
    catch (error) {
        return { entry, servers: [], problem: `${entry.name} 的 ${file.relative} 无法解析：${messageOf(error)}` };
    }
}
/** Why this CLI cannot take a new server of this transport, or undefined when it can. */
function addProblemOf(entry, transport) {
    const { add } = entry.mcp;
    if (add === undefined)
        return `${entry.name} 的 mcp add 未在本机实测`;
    if (transport === 'stdio' && add.stdio === 'none')
        return `${entry.name} 只能从命令行添加 HTTP 服务器`;
    return undefined;
}
/** Why this CLI cannot drop a server it has, or undefined when it can. */
function removeProblemOf(entry) {
    // Anything a remove subcommand can do goes through it, but only where it was measured; a JSON
    // key can otherwise be deleted without knowing the CLI's flags, which needs no measurement.
    if (entry.verified && entry.mcp.remove !== undefined)
        return undefined;
    if (entry.mcpFile !== undefined && entry.mcpKey !== undefined)
        return undefined;
    return `${entry.name} 既没有实测过的删除子命令，也没有本插件能编辑的配置文件`;
}
/** One cell of the matrix. */
function cellOf(read, name, transport) {
    const { entry, problem, note } = read;
    if (problem !== undefined)
        return { id: entry.id, state: 'unknown', blocked: problem };
    // A config the CLI itself rejects blocks every write, whichever direction the cell would go.
    const found = read.servers.find((server) => server.name === name);
    const reason = found === undefined ? addProblemOf(entry, transport) : removeProblemOf(entry);
    const blocked = note ?? reason;
    if (found === undefined)
        return { id: entry.id, state: 'off', ...(blocked === undefined ? {} : { blocked }) };
    return { id: entry.id, state: 'on', detail: found.detail, ...(blocked === undefined ? {} : { blocked }) };
}
/** Every server any CLI has, in the order the first CLI that has it lists them. */
function unionOf(reads) {
    const rows = new Map();
    for (const read of reads) {
        for (const server of read.servers) {
            if (!rows.has(server.name))
                rows.set(server.name, { name: server.name, transport: server.transport, detail: server.detail });
        }
    }
    return [...rows.values()];
}
/**
 * Build the MCP matrix.
 * @param host - how to read a CLI's config file.
 * @param home - the directory the catalog's paths are relative to.
 * @returns one column per CLI and one row per server, with the reason each disabled cell is disabled.
 */
export async function mcpMatrix(host, home) {
    const reads = await Promise.all(CLI_CATALOG.map((entry) => serversOfCli(entry, host, home)));
    const columns = reads.map((read) => ({
        id: read.entry.id,
        name: read.entry.name,
        readable: read.problem === undefined,
        ...(read.problem === undefined ? {} : { problem: read.problem }),
        ...(read.note === undefined ? {} : { note: read.note }),
    }));
    const rows = unionOf(reads).map((server) => ({
        name: server.name,
        transport: server.transport,
        detail: server.detail,
        cells: reads.map((read) => cellOf(read, server.name, server.transport)),
    }));
    return { columns, rows };
}
