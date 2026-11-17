/**
 * HTTP routes the 变更 panel posts to, under `/vyra-agent-cli-manager/git/<operation>`. The harness's
 * web server leaves authentication to each route, so every request first asks the
 * `connection` service for a rejection: its Host/Origin fence stops cross-site and DNS-
 * rebinding callers, and its login-token check stops anyone who is not the signed-in browser.
 * @module vyra-agent-cli-manager/git/git-routes
 */
import { GIT_ROUTE_PREFIX } from "../constants.js";
import { asBody, operationOf, runOperation, statusFor } from "./git-requests.js";
/** Request bodies are a directory and a list of paths; anything larger is refused. */
const MAX_BODY_BYTES = 1024 * 1024;
class BodyTooLarge extends Error {
    name = 'BodyTooLarge';
}
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
function messageOf(error) {
    return error instanceof Error ? error.message : String(error);
}
/**
 * Build the handler for every git route.
 * @param spawn - the subprocess service's spawn.
 * @param connection - the harness's trust check.
 * @param warn - logs failures that are not the user's doing.
 * @returns the request handler.
 */
export function gitHandler(spawn, connection, warn) {
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
            const data = await runOperation(spawn, operation, asBody(await readJson(req)));
            sendJson(res, 200, { success: true, data });
        }
        catch (error) {
            const status = error instanceof BodyTooLarge ? 413 : error instanceof SyntaxError ? 400 : statusFor(error);
            if (status === 500)
                warn(`vyra-agent-cli-manager: git ${operation} failed: ${messageOf(error)}`);
            sendJson(res, status, { success: false, error: status === 500 ? 'Git 操作失败，请查看日志' : messageOf(error) });
        }
    };
}
/**
 * Register the git routes on the web server.
 * @param webServer - the harness's web server.
 * @param handler - the handler from {@link gitHandler}.
 * @returns the unregister function.
 */
export function registerGitRoutes(webServer, handler) {
    return webServer.register({ kind: 'prefix', path: GIT_ROUTE_PREFIX, handler });
}
