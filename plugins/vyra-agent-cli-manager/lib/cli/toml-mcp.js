/**
 * Read the MCP servers out of Codex's TOML config.
 *
 * Node has no TOML parser, and writing a general one would mean maintaining a second copy of a
 * format this plugin does not own. This reads only the one construct the panel needs:
 * `[mcp_servers.<name>]` tables and their scalar or string-array values. Anything outside those
 * tables is ignored; a value this cannot read raises {@link TomlMcpError} so the caller can say
 * the column is unreadable rather than present a half-parsed list.
 * @module vyra-agent-cli-manager/cli/toml-mcp
 */
/** A value this reader does not understand. The caller turns it into a visible "cannot read". */
export class TomlMcpError extends Error {
    name = 'TomlMcpError';
}
/** `[mcp_servers.ynote]` or `[mcp_servers."name.with.dots"]`. */
const SERVER_TABLE = /^\[\s*mcp_servers\s*\.\s*("[^"]*"|[A-Za-z0-9_-]+)\s*\]$/;
const KEY_VALUE = /^([A-Za-z0-9_-]+|"[^"]*")\s*=\s*(.+)$/;
/** Cut a trailing `#` comment, but only when the `#` is outside a quoted string. */
function withoutComment(line) {
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        if (char === '"')
            quoted = !quoted;
        else if (char === '#' && !quoted)
            return line.slice(0, index);
    }
    return line;
}
/** A quoted TOML string, with the escapes its own format allows inside it. */
function unquote(text) {
    const body = text.slice(1, -1);
    return body.replace(/\\(.)/g, (_all, escaped) => (escaped === 'n' ? '\n' : escaped === 't' ? '\t' : escaped));
}
/** One array of quoted strings, which is the only array form Codex writes for `args`. */
function stringArray(text) {
    if (!text.endsWith(']'))
        throw new TomlMcpError(`无法解析的 TOML 数组：${text}`);
    const items = text
        .slice(1, -1)
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item !== '');
    for (const item of items) {
        if (!item.startsWith('"') || !item.endsWith('"')) {
            throw new TomlMcpError(`TOML 数组里只有字符串是被支持的：${item}`);
        }
    }
    return items.map(unquote);
}
/** A scalar value. Only the shapes a server definition uses are accepted. */
function scalarOf(text) {
    if (text.startsWith('"')) {
        if (!text.endsWith('"') || text.length < 2)
            throw new TomlMcpError(`引号未闭合：${text}`);
        return unquote(text);
    }
    if (text.startsWith('['))
        return stringArray(text);
    if (text === 'true')
        return true;
    if (text === 'false')
        return false;
    if (/^-?\d+(\.\d+)?$/.test(text))
        return Number(text);
    throw new TomlMcpError(`无法解析的 TOML 值：${text}`);
}
/** The table a header line opens, when it is one this reader cares about. */
function tableNameOf(line) {
    const header = SERVER_TABLE.exec(line);
    const raw = header?.[1];
    if (raw === undefined)
        return undefined;
    return raw.startsWith('"') ? unquote(raw) : raw;
}
/**
 * Read every `[mcp_servers.<name>]` table.
 * @param text - the whole config file.
 * @returns one plain object per server, with the keys the definition sets.
 * @throws TomlMcpError when a value inside a server table cannot be read.
 */
export function mcpServersOfToml(text) {
    const servers = {};
    let current;
    for (const raw of text.split('\n')) {
        const line = withoutComment(raw).trim();
        if (line === '')
            continue;
        if (line.startsWith('[')) {
            const name = tableNameOf(line);
            current = name === undefined ? undefined : (servers[name] ??= {});
            continue;
        }
        // Keys before the first server table, or inside `[features]`, are not ours.
        if (current === undefined)
            continue;
        const pair = KEY_VALUE.exec(line);
        const key = pair?.[1];
        const value = pair?.[2];
        if (key === undefined || value === undefined)
            throw new TomlMcpError(`无法解析的 TOML 行：${line}`);
        current[key.startsWith('"') ? unquote(key) : key] = scalarOf(value.trim());
    }
    return servers;
}
