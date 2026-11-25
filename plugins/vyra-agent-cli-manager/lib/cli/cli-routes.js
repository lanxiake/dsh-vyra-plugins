/**
 * HTTP routes the 总览 panel posts to, under `/dsh-vyra-agent-cli-manager/cli/<operation>`.
 * Structured after the git routes: the harness's web server leaves authentication to each
 * route, so every request first asks `connection` for a rejection — its Host/Origin fence
 * stops cross-site and DNS-rebinding callers, and its login-token check stops anyone who is
 * not the signed-in browser.
 *
 * Reading is the bulk of this prefix: status, the MCP list, skills, and the instruction file.
 * The two write operations add and remove one MCP server, and each is delegated to the CLI
 * whose configuration it changes. Installing and uninstalling stay off this route so that a
 * mistake in the panel can never change what is installed.
 * @module dsh-vyra-agent-cli-manager/cli/cli-routes
 */
import { CLI_MANAGER_ROUTE_PREFIX } from "../constants.js";
import { isModelSource } from "../model-source.js";
import { listSkills, readPrompt } from "./assets.js";
import { catalogEntry } from "./catalog.js";
import { BadRequest, BodyTooLarge } from "./errors.js";
import { listMcpServers } from "./mcp.js";
import { mcpMatrix } from "./mcp-matrix.js";
import { McpWriteError, addMcpServer, addRequestOf, copyMcpServer, copyRequestOf, removeMcpServer, removeRequestOf, } from "./mcp-write.js";
import { disableSkill, enableSkill, SkillLinkError } from "./skill-links.js";
import { skillsMatrix } from "./skills-matrix.js";
import { installSkill, skillInstallRequestOf } from "./skill-install.js";
import { consolidateSkills } from "./skill-consolidate.js";
import { CliUpgradeError, upgradeCli } from "./upgrade.js";
import { cliStatuses } from "./registry-status.js";
import { PromptWriteError, promptWriteHostOf, promptWriteRequestOf, writePrompt } from "./prompt-write.js";
/** The operations this route accepts, by the last segment of their path. */
const CLI_OPERATIONS = [
    'status',
    'upgrade',
    'mcp',
    'mcp-matrix',
    'mcp-add',
    'mcp-copy',
    'mcp-remove',
    'skills',
    'skills-matrix',
    'skill-enable',
    'skill-disable',
    'skill-install',
    'skill-consolidate',
    'prompt',
    'prompt-write',
    'model-sources',
];
/** `upgrade` names one CLI and nothing else; anything near this size is a caller mistake. */
const MAX_BODY_BYTES = 8 * 1024;
function sendJson(res, status, payload, headers = {}) {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
    res.end(JSON.stringify(payload));
}
/**
 * Read the request body as JSON. `status` takes none, and an empty body parses to `{}` so the
 * same reader serves both operations.
 */
async function readBody(req) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
        size += buffer.length;
        if (size > MAX_BODY_BYTES)
            throw new BodyTooLarge('请求内容过大');
        chunks.push(buffer);
    }
    const text = Buffer.concat(chunks).toString('utf8');
    return text.trim() === '' ? {} : JSON.parse(text);
}
/** The one field `upgrade` reads. */
function idOf(body) {
    if (typeof body !== 'object' || body === null || !('id' in body))
        throw new BadRequest('缺少 id');
    // The `in` check above already narrowed `body` to carry `id`; reading it needs no assertion.
    const { id } = body;
    if (typeof id !== 'string' || id === '')
        throw new BadRequest('id 必须是非空字符串');
    return id;
}
/** The catalog entry a request names, refusing ids this plugin does not manage. */
function entryOf(id) {
    const entry = catalogEntry(id);
    if (entry === undefined)
        throw new BadRequest('未知的 CLI');
    return entry;
}
/** The MCP write path, wrapped rather than passed by reference: the methods need their receiver. */
function writeHostOf(routes) {
    return { readFile: routes.readFile, writeFile: routes.writeFile, run: routes.run };
}
/** The two operations that change a CLI's config, each delegated to that CLI. */
async function writeAnswer(routes, operation, body) {
    const host = writeHostOf(routes);
    if (operation === 'mcp-remove') {
        const request = removeRequestOf(body);
        return await removeMcpServer(entryOf(request.id), host, routes.home, request.name);
    }
    if (operation === 'mcp-copy') {
        const request = copyRequestOf(body);
        return await copyMcpServer({
            source: entryOf(request.from),
            target: entryOf(request.to),
            host,
            home: routes.home,
            name: request.name,
        });
    }
    if (operation === 'skill-consolidate') {
        // No arguments: the operation reads every root itself, and naming a subset would mean the
        // caller had to know which directories count as roots.
        return await consolidateSkills(routes.skillConsolidate, routes.home);
    }
    if (operation === 'skill-install') {
        const request = skillInstallRequestOf(body);
        return await installSkill(routes.skillInstall, routes.home, request.source);
    }
    if (operation === 'skill-enable' || operation === 'skill-disable') {
        const request = removeRequestOf(body);
        const entry = entryOf(request.id);
        return operation === 'skill-enable'
            ? await enableSkill({ entry, host: routes.skills, home: routes.home, name: request.name })
            : await disableSkill({ entry, host: routes.skills, home: routes.home, name: request.name });
    }
    if (operation === 'prompt-write') {
        // `idOf`, not `removeRequestOf`: a prompt write names no server, so requiring a `name`
        // would refuse the request for a field it has no use for.
        return await writePrompt(entryOf(idOf(body)), promptWriteHostOf(routes), routes.home, promptWriteRequestOf(body));
    }
    const request = addRequestOf(body);
    return await addMcpServer(entryOf(request.id), host, request.spec);
}
/** The operations that only read. */
async function readAnswer(routes, operation, entry) {
    if (operation === 'upgrade')
        return await upgradeCli(entry, routes.run);
    // Wrapped rather than passed by reference: the subprocess method expects its own receiver.
    const assetHost = { readFile: routes.readFile, listDirectory: routes.listDirectory };
    if (operation === 'mcp') {
        const mcpHost = {
            readFile: routes.readFile,
            capture: (argv, signal) => routes.host.capture(argv, signal),
        };
        return await listMcpServers(entry, mcpHost, routes.home);
    }
    if (operation === 'skills')
        return await listSkills(entry, assetHost, routes.home);
    return await readPrompt(entry, assetHost, routes.home);
}
/**
 * `model-sources` carries the browser's current picks, because that is where the user made
 * them, and answers each CLI's route. Nothing is written to disk: the browser is the store.
 */
function modelSourceAnswer(routes, body) {
    const models = routes.models;
    if (models === undefined)
        return { sources: [] };
    if (Array.isArray(body.chosen)) {
        for (const entry of body.chosen) {
            if (typeof entry !== 'object' || entry === null)
                continue;
            const { id, source } = entry;
            if (typeof id === 'string' && isModelSource(source))
                models.choose(id, source);
        }
    }
    return { sources: models.list() };
}
/** `status` and the two matrices read nothing and answer every CLI; the rest name one CLI. */
async function answer(routes, operation, body) {
    if (operation === 'status')
        return { clis: await cliStatuses(routes.host, routes.latest) };
    if (operation === 'model-sources')
        return modelSourceAnswer(routes, body);
    // Reading every CLI's config needs no named CLI, and starts no process.
    if (operation === 'mcp-matrix')
        return await mcpMatrix({ readFile: routes.readFile }, routes.home);
    if (operation === 'skills-matrix')
        return await skillsMatrix(routes.skills, routes.home);
    if (operation === 'mcp-add' ||
        operation === 'mcp-copy' ||
        operation === 'mcp-remove' ||
        operation === 'skill-enable' ||
        operation === 'skill-disable' ||
        operation === 'skill-install' ||
        operation === 'skill-consolidate' ||
        operation === 'prompt-write') {
        return await writeAnswer(routes, operation, body);
    }
    return await readAnswer(routes, operation, entryOf(idOf(body)));
}
function operationOf(name) {
    return CLI_OPERATIONS.find((operation) => operation === name);
}
function messageOf(error) {
    return error instanceof Error ? error.message : String(error);
}
/** A rejected request is the caller's; anything else is this plugin's own failure. */
function statusOf(error) {
    if (error instanceof BodyTooLarge)
        return 413;
    if (error instanceof BadRequest || error instanceof SyntaxError)
        return 400;
    // The write was refused, or the CLI it was delegated to could not be run.
    if (error instanceof McpWriteError)
        return error.status;
    // A prompt write this plugin refused, or one the filesystem rejected.
    if (error instanceof PromptWriteError)
        return error.status;
    // A skill link this plugin will not make or break: the request asked for the impossible.
    if (error instanceof SkillLinkError)
        return 400;
    // The updater never started or ran past its deadline: the message names which.
    if (error instanceof CliUpgradeError)
        return 502;
    return 500;
}
/**
 * What the user is told. An updater that ran is reported by its exit code in the response, so
 * only a request this plugin refused, or a failure it cannot explain, reaches this.
 */
function errorOf(error, status) {
    if (status === 500)
        return 'CLI 操作失败，请查看日志';
    return messageOf(error);
}
/**
 * Build the handler for every CLI route.
 * @param routes - where statuses come from.
 * @param connection - the harness's trust check.
 * @param warn - logs failures that are not the user's doing.
 * @returns the request handler.
 */
export function cliHandler(routes, connection, warn) {
    return async (req, res) => {
        const rejection = connection.requestRejection(req);
        if (rejection !== undefined) {
            sendJson(res, rejection, { success: false, error: '未授权' });
            return;
        }
        if (req.method !== 'POST') {
            sendJson(res, 405, { success: false, error: '只支持 POST' }, { allow: 'POST' });
            return;
        }
        const name = (req.url ?? '').split('?')[0]?.split('/').pop() ?? '';
        const operation = operationOf(name);
        if (operation === undefined) {
            sendJson(res, 404, { success: false, error: '接口不存在' });
            return;
        }
        try {
            const body = await readBody(req);
            sendJson(res, 200, { success: true, data: await answer(routes, operation, body) });
        }
        catch (error) {
            // Status collection already answers an unreadable CLI with a not-installed row, so a
            // rejection here is the request's fault or something unexpected breaking in the upgrade.
            const status = statusOf(error);
            if (status === 500)
                warn(`dsh-vyra-agent-cli-manager: cli ${operation} failed: ${messageOf(error)}`);
            sendJson(res, status, { success: false, error: errorOf(error, status) });
        }
    };
}
/**
 * Register the CLI routes on the web server.
 * @param webServer - the harness's web server.
 * @param handler - the handler from {@link cliHandler}.
 * @returns the unregister function.
 */
export function registerCliRoutes(webServer, handler) {
    return webServer.register({ kind: 'prefix', path: CLI_MANAGER_ROUTE_PREFIX, handler });
}
