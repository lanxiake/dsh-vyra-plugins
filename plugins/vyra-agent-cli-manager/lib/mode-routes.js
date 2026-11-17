/**
 * The composer's mode route, under `/vyra-agent-cli-manager/modes`. A CLI's modes belong to the CLI:
 * the route only lists what that CLI reported and sends the chosen id back unchanged, so
 * no CLI mode is ever turned into a harness preset. Like the git routes, the harness's web
 * server leaves authentication to each route, so every request first asks `connection` for
 * a rejection.
 * @module vyra-agent-cli-manager/mode-routes
 */
import { LlmError } from '@deepseek-ai/dsh-llm';
import { MODE_ROUTE_PREFIX } from "./constants.js";
/** A body is two ids and an optional mode; anything larger is not a request this route takes. */
const MAX_BODY_BYTES = 8 * 1024;
class BodyTooLarge extends Error {
    name = 'BodyTooLarge';
}
const isText = (value) => typeof value === 'string' && value.length > 0;
const isObject = (value) => typeof value === 'object' && value !== null;
function sendJson(res, status, payload, headers = {}) {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
    res.end(JSON.stringify(payload));
}
async function readJson(req) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
        size += buffer.length;
        if (size > MAX_BODY_BYTES)
            throw new BodyTooLarge('请求内容过大');
        chunks.push(buffer);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
/** Read the one body shape this route accepts. */
function fieldsOf(body) {
    if (!isObject(body) || !isText(body.sessionId) || !isText(body.provider))
        return undefined;
    if (body.mode !== undefined && !isText(body.mode))
        return undefined;
    return { sessionId: body.sessionId, provider: body.provider, mode: body.mode };
}
function messageOf(error) {
    return error instanceof Error ? error.message : String(error);
}
/**
 * Build the handler for the mode route.
 * @param routes - what the bridge knows about native modes.
 * @param connection - the harness's trust check.
 * @param warn - logs failures that are not the user's doing.
 * @returns the request handler.
 */
export function modeHandler(routes, connection, warn) {
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
        let fields;
        try {
            fields = fieldsOf(await readJson(req));
        }
        catch (error) {
            const tooLarge = error instanceof BodyTooLarge;
            sendJson(res, tooLarge ? 413 : 400, { success: false, error: tooLarge ? '请求内容过大' : '请求格式不正确' });
            return;
        }
        if (fields === undefined) {
            sendJson(res, 400, { success: false, error: '请求缺少会话或 CLI' });
            return;
        }
        try {
            // Sending a mode and reading the state are one operation: the answer is what that
            // CLI reports after the change, in the same ids and names it gave.
            if (fields.mode !== undefined)
                await routes.switchMode(fields.sessionId, fields.provider, fields.mode);
            const { modes, pending } = routes.modeState(fields.sessionId, fields.provider);
            sendJson(res, 200, { success: true, data: { modes: modes ?? null, pending: pending ?? null } });
        }
        catch (error) {
            const known = error instanceof LlmError;
            if (!known)
                warn(`vyra-agent-cli-manager: mode request failed: ${messageOf(error)}`);
            sendJson(res, known ? 400 : 500, { success: false, error: known ? messageOf(error) : '切换模式失败，请查看日志' });
        }
    };
}
/**
 * Serve the mode route on the harness's web server.
 * @param server - the harness's web server.
 * @param routes - what the bridge knows about native modes.
 * @param connection - the harness's trust check.
 * @param warn - logs failures that are not the user's doing.
 * @returns a disposer that unregisters the route.
 */
export function registerModeRoute(server, routes, connection, warn) {
    return server.register({ kind: 'prefix', path: MODE_ROUTE_PREFIX, handler: modeHandler(routes, connection, warn) });
}
