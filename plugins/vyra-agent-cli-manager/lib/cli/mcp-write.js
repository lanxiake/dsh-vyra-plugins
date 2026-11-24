/**
 * Add and remove one MCP server for a CLI.
 *
 * Adding is delegated to the CLI's own `mcp add`, because the CLI owns its config schema and
 * its own version decides which flags exist: this plugin only knows the flags measured from
 * that CLI's `--help` (see catalog.ts). Removing follows the same rule where the CLI has a
 * `remove` subcommand; where it does not, the server is deleted from the JSON file the CLI
 * reads. Deleting a key needs no knowledge of the entry's shape, so that path is safe even
 * for a CLI this plugin has never measured, while writing a *new* entry does need it and is
 * therefore refused rather than guessed.
 * @module dsh-vyra-agent-cli-manager/cli/mcp-write
 */
import { join } from 'node:path';
import { BadRequest } from "./errors.js";
import { definitionsOf } from "./mcp-matrix.js";
/**
 * A write this plugin will not make, or one that could not be started. The message is ready
 * to show; `status` says whether the request was refused (400) or a CLI failed to run (502).
 */
export class McpWriteError extends Error {
    name = 'McpWriteError';
    /** 400 when this plugin refuses the request, 502 when a CLI it delegated to would not run. */
    status;
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}
/** A write that changes one config file returns long before this. */
const WRITE_TIMEOUT_MS = 60_000;
/** The CLI's own message is the useful part; the panel shows a tail, not a transcript. */
const MAX_OUTPUT_BYTES = 4 * 1024;
/**
 * A server name becomes an argv element and a JSON key, so it may not look like a flag. The
 * CLIs themselves accept more than this, but anything outside it is likelier to be a typo
 * that would be written somewhere the user cannot find it again.
 */
const SERVER_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
function assertName(name) {
    if (typeof name !== 'string' || !SERVER_NAME.test(name)) {
        throw new McpWriteError('服务器名只能由字母、数字、点、横线和下划线组成，且不能以符号开头');
    }
    return name;
}
/** The last `max` bytes: a CLI's verdict is at the end of whatever it printed. */
function tail(text) {
    return text.length <= MAX_OUTPUT_BYTES ? text : text.slice(text.length - MAX_OUTPUT_BYTES);
}
/**
 * Split a command line into argv the way a shell would, except that a backslash is an ordinary
 * character: a Windows path is a common argument and a shell-style escape would eat it.
 * @param text - the line as the user typed it.
 * @returns each argument, with quotes removed.
 */
export function splitCommandLine(text) {
    const parts = [];
    let current = '';
    let quote;
    let started = false;
    for (const char of text) {
        if (quote !== undefined) {
            if (char === quote)
                quote = undefined;
            else
                current += char;
            continue;
        }
        if (char === '"' || char === "'") {
            quote = char;
            started = true;
            continue;
        }
        if (char === ' ' || char === '\t') {
            if (started)
                parts.push(current);
            current = '';
            started = false;
            continue;
        }
        current += char;
        started = true;
    }
    if (quote !== undefined)
        throw new McpWriteError('命令里的引号没有闭合');
    if (started)
        parts.push(current);
    return parts;
}
/** The transport declaration, or nothing when the CLI works it out from the arguments. */
function transportFlags(entry, transport) {
    return entry.mcp.add?.transport === 'flag-t' ? ['-t', transport] : [];
}
/** The URL and its flag; positional when the CLI's help showed no flag for it. */
function urlTail(entry, url) {
    if (url === undefined || url === '')
        throw new McpWriteError('HTTP 服务器需要 URL');
    const flag = entry.mcp.add?.url;
    return flag === undefined ? [url] : [flag, url];
}
function envFlags(entry, env) {
    if (env === undefined || env.length === 0)
        return [];
    const flag = entry.mcp.add?.env;
    if (flag === undefined)
        throw new McpWriteError(`${entry.name} 的 mcp add 不接受环境变量`);
    for (const pair of env) {
        if (!pair.includes('='))
            throw new McpWriteError(`环境变量要写成 KEY=VALUE，收到「${pair}」`);
    }
    return env.flatMap((pair) => [flag, pair]);
}
/** The command a stdio server runs, after the `--` that ends the CLI's own flags. */
function stdioTail(entry, command) {
    if (entry.mcp.add?.stdio === 'none') {
        throw new McpWriteError(`${entry.name} 的 mcp add 没有实测到传递 stdio 命令的方法，只能添加 HTTP 服务器`);
    }
    if (command === undefined || command.length === 0)
        throw new McpWriteError('stdio 服务器需要启动命令');
    return ['--', ...command];
}
/**
 * The argv that adds one server through the CLI's own subcommand.
 * @param entry - the CLI to add to.
 * @param spec - the server to add.
 * @returns the argv, ready for `run`.
 * @throws McpWriteError when the CLI's add shape was never measured, or the spec is incomplete.
 */
export function addArgvFor(entry, spec) {
    const add = entry.mcp.add;
    if (add === undefined) {
        throw new McpWriteError(`${entry.name} 的 mcp add 未在本机测量，本插件不会凭猜测写它的配置`);
    }
    const name = assertName(spec.name);
    const head = [entry.binary, ...add.argv, ...(entry.mcp.scope ?? []), name, ...transportFlags(entry, spec.transport)];
    if (spec.transport === 'http') {
        // Every CLI documents environment for a local server only; inventing a flag here would
        // either fail on an unknown option or write a setting the server never reads.
        if (spec.env !== undefined && spec.env.length > 0) {
            throw new McpWriteError('HTTP 服务器的凭据要写进请求头，本插件不支持给 HTTP 服务器设置环境变量');
        }
        return [...head, ...urlTail(entry, spec.url)];
    }
    return [...head, ...envFlags(entry, spec.env), ...stdioTail(entry, spec.command)];
}
/**
 * The argv that removes one server, or undefined when the CLI has no usable subcommand and
 * its file has to be edited instead. A CLI whose command was never measured is treated the
 * same way: deleting a key from its file needs no knowledge of the CLI's flags.
 */
export function removeArgvFor(entry, name) {
    const clean = assertName(name);
    if (!entry.verified || entry.mcp.remove === undefined)
        return undefined;
    return [entry.binary, ...entry.mcp.remove, ...(entry.mcp.scope ?? []), clean];
}
/** One CLI's own failure to start, kept apart from its verdict on the request. */
function startFailureOf(entry, signal, error) {
    if (signal.aborted)
        return new McpWriteError(`${entry.name} 没有在 ${String(WRITE_TIMEOUT_MS / 1000)} 秒内返回`, 502);
    const detail = error instanceof Error ? error.message : String(error);
    return new McpWriteError(`${entry.name} 的 MCP 命令无法启动：${detail}`, 502);
}
async function delegate(entry, host, argv) {
    const signal = AbortSignal.timeout(WRITE_TIMEOUT_MS);
    let result;
    try {
        result = await host.run(argv, signal);
    }
    catch (error) {
        throw startFailureOf(entry, signal, error);
    }
    const outcome = {
        id: entry.id,
        via: 'cli',
        exitCode: result.exitCode,
        stdout: tail(result.stdout),
        stderr: tail(result.stderr),
    };
    return outcome;
}
/** The `mcpServers`-style object a CLI keeps its servers under, or undefined when absent. */
function groupOf(document, key) {
    if (typeof document !== 'object' || document === null)
        return undefined;
    const found = Reflect.get(document, key);
    return typeof found === 'object' && found !== null ? found : undefined;
}
/** The argv one stored definition runs: an array when the CLI writes one, else command + args. */
function commandOfDefinition(record) {
    const command = record.command;
    if (Array.isArray(command))
        return command.map((part) => String(part));
    const head = typeof command === 'string' && command !== '' ? [command] : [];
    const args = Array.isArray(record.args) ? record.args.map((arg) => String(arg)) : [];
    return [...head, ...args];
}
/** The environment a stored definition sets, as the `KEY=VALUE` pairs `mcp add` takes. */
function envOfDefinition(record) {
    // Vendors disagree on the name: Claude and Codex write `env`, OpenCode writes `environment`.
    const env = record.env ?? record.environment;
    if (typeof env !== 'object' || env === null || Array.isArray(env))
        return undefined;
    const pairs = Object.entries(env).flatMap(([key, value]) => (typeof value === 'string' ? [`${key}=${value}`] : []));
    return pairs.length === 0 ? undefined : pairs;
}
/**
 * Turn one stored definition into what `mcp add` accepts. Only the fields every CLI in the
 * catalog can express are carried over; a header or a vendor-specific key would be dropped
 * silently, so a definition that needs one is refused instead.
 * @param definition - the entry as the source CLI stored it.
 * @param name - the server's name.
 * @returns the spec to add elsewhere.
 * @throws McpWriteError when the definition has nothing this plugin can pass on.
 */
function specOfDefinition(definition, name) {
    if (typeof definition !== 'object' || definition === null) {
        throw new McpWriteError(`${name} 的定义不是一个对象，无法复制`);
    }
    const record = definition;
    const url = typeof record.url === 'string' && record.url !== '' ? record.url : undefined;
    if (url !== undefined)
        return { name, transport: 'http', url };
    const command = commandOfDefinition(record);
    if (command.length === 0)
        throw new McpWriteError(`${name} 没有可执行的命令，无法复制`);
    const env = envOfDefinition(record);
    return { name, transport: 'stdio', command, ...(env === undefined ? {} : { env }) };
}
/**
 * Copy one server between CLIs by reading the source's own definition.
 *
 * The panel only ever saw a redacted command line, so the value is read again here rather than
 * rebuilt from what was displayed: rebuilding it would write the redaction marker into the
 * target's config.
 * @param request - where the server comes from, where it goes, and which one it is.
 * @returns how the target reported the add.
 * @throws McpWriteError when the source's definition cannot be read or copied.
 */
export async function copyMcpServer(request) {
    const clean = assertName(request.name);
    const definitions = await definitionsOf(request.source, request.host, request.home);
    if (definitions === undefined) {
        throw new McpWriteError(`读不到 ${request.source.name} 的 MCP 配置，无法复制它里面的服务器`);
    }
    const definition = definitions[clean];
    if (definition === undefined) {
        throw new McpWriteError(`${request.source.name} 里没有名为 ${clean} 的服务器`);
    }
    return await addMcpServer(request.target, request.host, specOfDefinition(definition, clean));
}
/** Delete one server from the CLI's own JSON, leaving every other key as it was. */ async function removeFromFile(entry, host, home, name) {
    const { mcpFile, mcpKey } = entry;
    if (mcpFile === undefined || mcpKey === undefined) {
        throw new McpWriteError(`${entry.name} 既没有删除子命令，也没有本插件能安全编辑的配置文件`);
    }
    const path = join(home, mcpFile);
    const text = await host.readFile(path);
    if (text === undefined)
        throw new McpWriteError(`${entry.name} 没有配置文件 ${mcpFile}，没有可删除的服务器`);
    let document;
    try {
        document = JSON.parse(text);
    }
    catch {
        throw new McpWriteError(`${entry.name} 的 ${mcpFile} 不是合法 JSON，本插件不会改写它（请手工修复）`);
    }
    if (typeof document !== 'object' || document === null) {
        throw new McpWriteError(`${entry.name} 的 ${mcpFile} 不是一个 JSON 对象，本插件不会改写它`);
    }
    const group = groupOf(document, mcpKey);
    if (group === undefined || !Object.hasOwn(group, name)) {
        throw new McpWriteError(`${entry.name} 的 ${mcpFile} 里没有名为 ${name} 的 MCP 服务器`);
    }
    const { [name]: _removed, ...rest } = group;
    await host.writeFile(path, `${JSON.stringify({ ...document, [mcpKey]: rest }, null, 2)}\n`);
    return { id: entry.id, via: 'file' };
}
/**
 * Add one MCP server.
 * @param entry - the CLI to add to.
 * @param host - how to run a command.
 * @param spec - the server to add.
 * @returns how it was added, and the CLI's own exit code when it was delegated.
 * @throws McpWriteError when the CLI cannot be written to, or would not start.
 */
export async function addMcpServer(entry, host, spec) {
    // No `home` here on purpose: an add always goes through the CLI, which resolves its own
    // config location, so this path never needs to know where that file lives.
    return await delegate(entry, host, addArgvFor(entry, spec));
}
/**
 * Remove one MCP server.
 * @param entry - the CLI to remove from.
 * @param host - how to run a command and read and write a file.
 * @param home - the directory the catalog's paths are relative to.
 * @param name - the server's name in that CLI's config.
 * @returns how it was removed, and the CLI's own exit code when it was delegated.
 * @throws McpWriteError when nothing could be removed, or the CLI would not start.
 */
export async function removeMcpServer(entry, host, home, name) {
    const argv = removeArgvFor(entry, name);
    if (argv !== undefined)
        return await delegate(entry, host, argv);
    return await removeFromFile(entry, host, home, assertName(name));
}
function requireString(body, field) {
    const value = body[field];
    if (typeof value !== 'string' || value.trim() === '')
        throw new BadRequest(`${field} 必须是非空字符串`);
    return value;
}
function bodyOf(body) {
    if (typeof body !== 'object' || body === null)
        throw new BadRequest('请求体必须是 JSON 对象');
    return body;
}
/** The command as argv: a string is split like a shell would, an array is taken as given. */
function commandOf(value) {
    if (value === undefined)
        return undefined;
    if (Array.isArray(value))
        return value.map((part) => String(part));
    if (typeof value === 'string')
        return splitCommandLine(value.trim());
    throw new BadRequest('command 必须是字符串或字符串数组');
}
function envOf(value) {
    if (value === undefined)
        return undefined;
    if (Array.isArray(value))
        return value.map((pair) => String(pair).trim()).filter((pair) => pair !== '');
    throw new BadRequest('env 必须是 KEY=VALUE 的字符串数组');
}
/**
 * Read an add request.
 * @param body - the parsed body.
 * @returns the CLI id and the server to add.
 * @throws BadRequest when a field is missing or has the wrong type.
 */
export function addRequestOf(body) {
    const record = bodyOf(body);
    const id = requireString(record, 'id');
    const transport = record.transport ?? 'stdio';
    if (transport !== 'stdio' && transport !== 'http')
        throw new BadRequest('transport 只能是 stdio 或 http');
    const command = commandOf(record.command);
    const url = typeof record.url === 'string' && record.url.trim() !== '' ? record.url.trim() : undefined;
    const env = envOf(record.env);
    const spec = {
        name: requireString(record, 'name'),
        transport: transport === 'http' ? 'http' : 'stdio',
        ...(command === undefined ? {} : { command }),
        ...(url === undefined ? {} : { url }),
        ...(env === undefined ? {} : { env }),
    };
    return { id, spec };
}
/**
 * Read a copy request.
 * @param body - the parsed body.
 * @returns the source CLI, the target CLI, and the server name.
 * @throws BadRequest when a field is missing.
 */
export function copyRequestOf(body) {
    const record = bodyOf(body);
    return {
        from: requireString(record, 'from'),
        to: requireString(record, 'to'),
        name: requireString(record, 'name'),
    };
}
/**
 * Read a remove request.
 * @param body - the parsed body.
 * @returns the CLI id and the server name.
 * @throws BadRequest when a field is missing.
 */
export function removeRequestOf(body) {
    const record = bodyOf(body);
    return { id: requireString(record, 'id'), name: requireString(record, 'name') };
}
