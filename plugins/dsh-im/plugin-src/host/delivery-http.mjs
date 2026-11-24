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

export function createDeliveryQueryHandler(service) {
  return (request, response) => serveJsonPost(request, response, async (payload) => {
    try {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)
        || Object.keys(payload).some((key) => !['op', 'botId'].includes(key))) {
        throw badRequest();
      }
      if (payload.op === 'bots') {
        const bots = await service.listBots();
        return { ok: true, value: { bots } };
      }
      if (payload.op === 'targets') {
        if (typeof payload.botId !== 'string' || !payload.botId) throw badRequest();
        const listed = await service.listTargets(payload.botId);
        return {
          ok: true,
          value: {
            botId: listed.botId,
            channel: listed.channel,
            targets: (listed.targets ?? []).map(publicTarget),
          },
        };
      }
      throw badRequest();
    } catch (error) {
      const code = typeof error?.code === 'string' ? error.code : 'delivery-failed';
      return { ok: false, error: { code, message: code, details: {} } };
    }
  });
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

export function installDeliveryHttp(ctx, service, { dshHome, logger = console } = {}) {
  if (!ctx?.webServer || typeof ctx.webServer.register !== 'function'
    || typeof ctx.effect !== 'function') {
    throw new TypeError('DSH Host WebServer is required');
  }
  const handlers = new Map([
    [DELIVERY_HTTP_PATH, createDeliveryHttpHandler(service)],
    [DELIVERY_QUERY_HTTP_PATH, createDeliveryQueryHandler(service)],
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
