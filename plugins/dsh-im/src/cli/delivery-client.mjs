// HTTP client for the `dsh-im` CLI.
//
// The Host owns the bot connections and the WebServer. The CLI only needs the
// two routes the plugin already serves, so it stays dependency-free and works
// from any shell the Agent has.

import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

/** Port used by a stock `dsh web` profile when no endpoint file exists. */
const DEFAULT_BASE_URL = 'http://127.0.0.1:3080';

/** Upper bound on one CLI call; a hung Host must not hang the shell. */
const REQUEST_TIMEOUT_MS = 30_000;

export class DeliveryCliError extends Error {
  constructor(code, message, { status } = {}) {
    super(message || code);
    this.code = code;
    this.status = status;
  }
}

/** @returns the endpoint file the Host writes at startup. */
export function deliveryEndpointPath(dshHome) {
  return resolve(
    dshHome ?? process.env.DSH_HOME ?? join(homedir(), '.dsh'),
    'integrations',
    'dsh-im',
    'delivery-http.json',
  );
}

function normalizeBaseUrl(value) {
  const trimmed = String(value).trim().replace(/\/+$/, '');
  if (!trimmed) return DEFAULT_BASE_URL;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

/**
 * Resolve the Host address: explicit flag, environment, endpoint file, default.
 * @param explicit - `--url` value.
 * @param options.dshHome - DSH home override.
 * @param options.readFile - file reader override (tests).
 * @returns an origin with no trailing slash.
 */
export async function resolveBaseUrl(explicit, {
  dshHome,
  readFile: read = readFile,
} = {}) {
  if (explicit) return normalizeBaseUrl(explicit);
  if (process.env.DSH_IM_URL) return normalizeBaseUrl(process.env.DSH_IM_URL);
  try {
    const endpoint = JSON.parse(await read(deliveryEndpointPath(dshHome), 'utf8'));
    if (typeof endpoint?.url === 'string' && endpoint.url) {
      return normalizeBaseUrl(endpoint.url);
    }
  } catch {
    // No endpoint file: fall back to the stock port.
  }
  return DEFAULT_BASE_URL;
}

async function postJson(baseUrl, path, payload, { signal, fetch: fetchImpl = fetch } = {}) {
  const requestSignal = signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetchImpl(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: requestSignal,
    });
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw new DeliveryCliError('timeout', `请求超时：${baseUrl}`);
    }
    throw new DeliveryCliError('unreachable', `无法连接 Host：${baseUrl}（${error?.message ?? error}）`);
  }
  let body;
  try {
    body = await response.json();
  } catch {
    throw new DeliveryCliError('delivery-failed', `Host 返回了非 JSON 响应（HTTP ${response.status}）`, {
      status: response.status,
    });
  }
  if (!response.ok) {
    const code = typeof body?.error?.code === 'string' ? body.error.code : 'delivery-failed';
    throw new DeliveryCliError(code, code, { status: response.status });
  }
  return body;
}

/**
 * Send one text message.
 * @param baseUrl - Host origin.
 * @param message - `{ botId, targetId, text, format? }`.
 * @returns `{ sent: true }`.
 */
export async function sendMessage(baseUrl, message, options = {}) {
  return postJson(baseUrl, '/api/dsh-im/delivery/messages', message, options);
}

/**
 * Send one local file or image.
 * @param baseUrl - Host origin.
 * @param message - `{ botId, targetId, path, asImage? }`; the path is read on the Host.
 * @returns `{ sent, fileName, size, asImage }`.
 */
export async function sendFile(baseUrl, message, options = {}) {
  return postJson(baseUrl, '/api/dsh-im/delivery/files', message, options);
}

/**
 * List bots, or the targets of one bot.
 * @param baseUrl - Host origin.
 * @param query - `{ op: 'bots' }` or `{ op: 'targets', botId }`.
 */
export async function queryDelivery(baseUrl, query, options = {}) {
  return postJson(baseUrl, '/api/dsh-im/delivery/query', query, options);
}
