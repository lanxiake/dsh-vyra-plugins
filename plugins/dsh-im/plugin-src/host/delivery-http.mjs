import { mkdir, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { createDeliveryRpcHandler, DELIVERY_ENDPOINTS } from './delivery-rpc.mjs';

export const DELIVERY_HTTP_PATH = '/api/dsh-im/delivery/messages';

/** Read-only bot/target discovery for the CLI; same trust boundary as send. */
export const DELIVERY_QUERY_HTTP_PATH = '/api/dsh-im/delivery/query';

/** Proactive file/image delivery; the path is read by the Host. */
export const DELIVERY_FILE_HTTP_PATH = '/api/dsh-im/delivery/files';

const MAX_BODY_BYTES = 1024 * 1024;

const DELIVERY_ERROR_STATUS = Object.freeze({
  'bad-request': 400,
  'unknown-bot': 404,
  'unknown-target': 404,
  'target-conflict': 409,
  'invalid-target': 422,
  'capability-unavailable': 501,
  'bot-not-connected': 503,
  'target-rejected': 422,
  'delivery-failed': 502,
  cancelled: 408,
});

class HttpRequestError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function json(response, status, value, headers = {}) {
  if (response.destroyed || response.writableEnded) return;
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(Buffer.byteLength(body)),
    ...headers,
  });
  response.end(body);
}

function isJsonContentType(value) {
  return typeof value === 'string'
    && value.split(';', 1)[0].trim().toLowerCase() === 'application/json';
}

async function readJsonBody(request) {
  const declaredLength = Number(request.headers['content-length']);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new HttpRequestError(413, 'payload-too-large');
  }

  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += buffer.length;
    if (length > MAX_BODY_BYTES) {
      throw new HttpRequestError(413, 'payload-too-large');
    }
    chunks.push(buffer);
  }

  try {
    return JSON.parse(Buffer.concat(chunks, length).toString('utf8'));
  } catch {
    throw new HttpRequestError(400, 'bad-request');
  }
}

/**
 * Serve one JSON POST route.
 *
 * Both routes share the method, content-type, body limit, cancellation and
 * error mapping; only the operation differs.
 * @param request - incoming request.
 * @param response - outgoing response.
 * @param dispatch - `(payload, signal)` returning an RPC envelope.
 */
async function serveJsonPost(request, response, dispatch) {
  if (request.method !== 'POST') {
    json(response, 405, {
      error: { code: 'method-not-allowed', message: 'method-not-allowed', details: {} },
    }, { allow: 'POST' });
    return;
  }
  if (!isJsonContentType(request.headers['content-type'])) {
    json(response, 415, {
      error: { code: 'unsupported-media-type', message: 'unsupported-media-type', details: {} },
    });
    return;
  }

  const abort = new AbortController();
  const cancel = () => abort.abort();
  const cancelClosedResponse = () => {
    if (!response.writableEnded) cancel();
  };
  request.once('aborted', cancel);
  response.once('close', cancelClosedResponse);
  try {
    const payload = await readJsonBody(request);
    const result = await dispatch(payload, abort.signal);
    if (result.ok) {
      json(response, 200, result.value);
      return;
    }
    json(response, DELIVERY_ERROR_STATUS[result.error.code] ?? 500, {
      error: result.error,
    });
  } catch (error) {
    if (error instanceof HttpRequestError) {
      json(response, error.status, {
        error: { code: error.code, message: error.code, details: {} },
      });
      return;
    }
    const code = typeof error?.code === 'string' ? error.code : 'delivery-failed';
    json(response, DELIVERY_ERROR_STATUS[code] ?? 500, {
      error: { code, message: code, details: {} },
    });
  } finally {
    request.off('aborted', cancel);
    response.off('close', cancelClosedResponse);
  }
}

export function createDeliveryHttpHandler(service) {
  const dispatch = createDeliveryRpcHandler(service);
  return (request, response) => serveJsonPost(
    request,
    response,
    (payload, signal) => dispatch(DELIVERY_ENDPOINTS.send, payload, signal),
  );
}

/** Keep only the fields a caller needs to name a target. */
function publicTarget(target) {
  const name = typeof target?.name === 'string' && target.name ? { name: target.name } : {};
  return { targetId: target?.targetId, ...name, kind: target?.kind };
}

function badRequest() {
  const error = new Error('bad-request');
  error.code = 'bad-request';
  return error;
}

/** Settings an Agent may change; everything else is user-only. */
const WRITABLE_SETTINGS = new Set(['alias']);

/** Keys `target update` may merge into the stored target. */
const PATCHABLE_TARGET_KEYS = new Set(['name', 'route', 'kind']);

function requiredString(value) {
  if (typeof value !== 'string' || !value) throw badRequest();
  return value;
}

/**
 * Merge a partial target over the stored one.
 *
 * `updateTarget` on the service expects a complete target, so a caller that
 * only renames must still send the existing kind and route. Merging here keeps
 * that rule in one place and means the CLI never has to read-then-write.
 */
function mergeTarget(stored, patch) {
  if (!stored) throw Object.assign(new Error('unknown-target'), { code: 'unknown-target' });
  const merged = {
    targetId: stored.targetId,
    kind: patch.kind === undefined ? stored.kind : patch.kind,
    ...(patch.route === undefined
      ? { route: structuredClone(stored.route) }
      : { route: patch.route }),
  };
  const name = patch.name === undefined ? stored.name : patch.name;
  if (typeof name === 'string' && name.trim()) merged.name = name.trim();
  return merged;
}

/** Structured trace of a state-changing call; never carries a message body. */
function audit(logger, { op, botId, targetId, ok }) {
  const line = `[dsh-im:audit] method=${op} bot=${botId ?? '-'}`
    + ` target=${targetId ?? '-'} result=${ok ? 'ok' : 'fail'}`;
  try {
    logger?.info?.(line);
  } catch {
    // Auditing must never change the outcome of the call it describes.
  }
}

export function createDeliveryQueryHandler(service, { logger = console, settings } = {}) {
  return (request, response) => serveJsonPost(request, response, async (payload) => {
    const op = payload?.op;
    let botId = payload?.botId;
    let targetId = payload?.targetId;
    let wrote = false;
    try {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw badRequest();

      if (op === 'bots') {
        assertKeys(payload, ['op']);
        const bots = await service.listBots();
        return { ok: true, value: { bots } };
      }

      if (op === 'targets') {
        assertKeys(payload, ['op', 'botId']);
        requiredString(botId);
        const listed = await service.listTargets(botId);
        return {
          ok: true,
          value: {
            botId: listed.botId,
            channel: listed.channel,
            targets: (listed.targets ?? []).map(publicTarget),
          },
        };
      }

      if (op === 'createTarget') {
        assertKeys(payload, ['op', 'botId', 'target']);
        requiredString(botId);
        if (!payload.target || typeof payload.target !== 'object' || Array.isArray(payload.target)) {
          throw badRequest();
        }
        targetId = payload.target.targetId;
        wrote = true;
        const created = await service.createTarget(botId, payload.target);
        audit(logger, { op, botId, targetId, ok: true });
        return { ok: true, value: publicTarget(created) };
      }

      if (op === 'updateTarget') {
        assertKeys(payload, ['op', 'botId', 'targetId', 'patch']);
        requiredString(botId);
        requiredString(targetId);
        const patch = payload.patch;
        if (!patch || typeof patch !== 'object' || Array.isArray(patch)
          || Object.keys(patch).length === 0
          || Object.keys(patch).some((key) => !PATCHABLE_TARGET_KEYS.has(key))) {
          throw badRequest();
        }
        wrote = true;
        const listed = await service.listTargets(botId);
        const stored = (listed.targets ?? []).find((entry) => entry?.targetId === targetId);
        const updated = await service.updateTarget(botId, targetId, mergeTarget(stored, patch));
        audit(logger, { op, botId, targetId, ok: true });
        return { ok: true, value: publicTarget(updated) };
      }

      if (op === 'deleteTarget') {
        assertKeys(payload, ['op', 'botId', 'targetId']);
        requiredString(botId);
        requiredString(targetId);
        wrote = true;
        await service.deleteTarget(botId, targetId);
        audit(logger, { op, botId, targetId, ok: true });
        return { ok: true, value: { deleted: true } };
      }

      if (op === 'settingsGet') {
        assertKeys(payload, ['op', 'botId']);
        requiredString(botId);
        return { ok: true, value: await readSettings(settings, botId) };
      }

      if (op === 'settingsSet') {
        assertKeys(payload, ['op', 'botId', 'key', 'value']);
        requiredString(botId);
        if (typeof payload.key !== 'string' || !WRITABLE_SETTINGS.has(payload.key)) {
          // Access policy, credentials and bot deletion stay user-only.
          throw Object.assign(new Error('user-only-action'), { code: 'user-only-action' });
        }
        wrote = true;
        const written = await writeSettings(settings, botId, payload.key, payload.value);
        audit(logger, { op, botId, ok: true });
        return { ok: true, value: { key: payload.key, value: written?.value ?? payload.value } };
      }

      throw badRequest();
    } catch (error) {
      const code = typeof error?.code === 'string' ? error.code : 'delivery-failed';
      if (wrote) audit(logger, { op, botId, targetId, ok: false });
      return { ok: false, error: { code, message: code, details: {} } };
    }
  });
}

/** Reject any field the operation does not define, so typos cannot be ignored. */
function assertKeys(payload, allowed) {
  if (Object.keys(payload).some((key) => !allowed.includes(key))) throw badRequest();
}

async function readSettings(settings, botId) {
  if (typeof settings?.read !== 'function') throw badRequest();
  return settings.read(botId);
}

async function writeSettings(settings, botId, key, value) {
  if (typeof settings?.write !== 'function') throw badRequest();
  return settings.write(botId, key, value);
}

export function createDeliveryFileHandler(service) {
  return (request, response) => serveJsonPost(request, response, async (payload, signal) => {
    try {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)
        || Object.keys(payload).some((key) => !['botId', 'targetId', 'path', 'asImage', 'idempotencyKey'].includes(key))
        || typeof payload.botId !== 'string' || !payload.botId
        || typeof payload.targetId !== 'string' || !payload.targetId
        || typeof payload.path !== 'string' || !payload.path.trim() || payload.path.length > 4_096
        || (payload.asImage !== undefined && typeof payload.asImage !== 'boolean')
        || (payload.idempotencyKey !== undefined
          && (typeof payload.idempotencyKey !== 'string'
            || !/^[A-Za-z0-9._:-]{1,128}$/.test(payload.idempotencyKey)))) {
        throw badRequest();
      }
      const value = await service.sendFile(payload.botId, payload.targetId, {
        path: payload.path,
        ...(payload.asImage === undefined ? {} : { asImage: payload.asImage }),
      }, {
        signal,
        ...(payload.idempotencyKey === undefined ? {} : { idempotencyKey: payload.idempotencyKey }),
      });
      return { ok: true, value };
    } catch (error) {
      const code = typeof error?.code === 'string' ? error.code : 'delivery-failed';
      return { ok: false, error: { code, message: code, details: {} } };
    }
  });
}

/** Where the CLI looks for the Host that served this route. */
export function deliveryEndpointPath(dshHome) {
  return resolve(
    dshHome ?? process.env.DSH_HOME ?? join(homedir(), '.dsh'),
    'integrations',
    'dsh-im',
    'delivery-http.json',
  );
}

async function writeEndpoint(dshHome, port) {
  if (!Number.isInteger(port) || port <= 0) return;
  const file = deliveryEndpointPath(dshHome);
  const body = JSON.stringify({
    version: 1,
    url: `http://127.0.0.1:${port}`,
    updatedAt: new Date().toISOString(),
  });
  const temporary = `${file}.${process.pid}.tmp`;
  await mkdir(dirname(file), { recursive: true });
  await writeFile(temporary, body, { mode: 0o600 });
  await rename(temporary, file);
}

export function installDeliveryHttp(ctx, service, { dshHome, logger = console, settings } = {}) {
  if (!ctx?.webServer || typeof ctx.webServer.register !== 'function'
    || typeof ctx.effect !== 'function') {
    throw new TypeError('DSH Host WebServer is required');
  }
  const handlers = new Map([
    [DELIVERY_HTTP_PATH, createDeliveryHttpHandler(service)],
    [DELIVERY_QUERY_HTTP_PATH, createDeliveryQueryHandler(service, { logger, settings })],
    [DELIVERY_FILE_HTTP_PATH, createDeliveryFileHandler(service)],
  ]);
  const disposers = [...handlers].map(([path, handler]) => {
    const route = { kind: 'exact', path, handler };
    return ctx.effect(
      () => ctx.webServer.register(route),
      `dsh-im: ${path}`,
    );
  });
  writeEndpoint(dshHome, Number(ctx.webServer.port)).catch((error) => {
    logger.warn?.(`[dsh-im] failed to write the delivery endpoint file: ${error?.message ?? error}`);
  });
  return disposers;
}
