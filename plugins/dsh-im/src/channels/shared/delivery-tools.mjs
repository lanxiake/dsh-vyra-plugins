// Agent-facing proactive delivery tools.
//
// The delivery HTTP route, the Connection RPC channel and the `ctx.dshIm`
// service all assume a caller outside the Agent loop: an app, a companion
// plugin, or the settings page. A model inside a Session has none of them, so
// without these tools the only way to push a message is to read the source.
//
// All tools reuse the same DeliveryService the settings page does, so the
// stable botId/targetId pair, per-channel formatting and the error codes stay
// identical across the entry points.

import { isAbsolute, resolve } from 'node:path';

/** Tool that sends one text message to a saved target. */
export const SEND_MESSAGE_TOOL = 'dsh_im_send_message';

/** Tool that sends one local file or image to a saved target. */
export const SEND_FILE_TOOL = 'dsh_im_send_file';

/** Tool that lists connected bots and their saved targets. */
export const DELIVERY_TARGETS_TOOL = 'dsh_im_delivery_targets';

/** Format values the delivery service accepts. */
const FORMAT_VALUES = Object.freeze(['plain', 'markdown']);

/**
 * Turn a delivery service error into a tool error that still names its code.
 *
 * The Host renders a thrown tool error as text, so the code has to live in the
 * message; the skill maps each code to a recovery step.
 * @param error - whatever the service rejected with.
 * @returns an Error whose message starts with the delivery error code.
 */
function toolError(error) {
  const code = typeof error?.code === 'string' ? error.code : 'delivery-failed';
  const detail = typeof error?.message === 'string' && error.message !== code
    ? `: ${error.message}`
    : '';
  return new Error(`${code}${detail}`, { cause: error });
}

/** Run one service call, rethrowing failures in the tool error shape. */
async function call(operation) {
  try {
    return await operation();
  } catch (error) {
    throw toolError(error);
  }
}

/**
 * Keep only the fields a caller needs to name a target.
 *
 * The platform route is deliberately dropped: a model has no use for a chat id
 * and exposing it only invites guessing or leaking it into a transcript.
 * @param target - one saved delivery target.
 * @returns `{ targetId, name?, kind }`.
 */
function publicTarget(target) {
  const name = typeof target?.name === 'string' && target.name ? { name: target.name } : {};
  return { targetId: target?.targetId, ...name, kind: target?.kind };
}

/**
 * Build the delivery tools bound to one service instance.
 * @param service - a DeliveryService (or a test double with `send`, `sendFile`,
 *   `listTargets` and `listBots`).
 * @returns an array of Cordis tool definitions.
 */
export function createDeliveryTools(service) {
  if (!service || typeof service.send !== 'function' || typeof service.sendFile !== 'function'
    || typeof service.listTargets !== 'function' || typeof service.listBots !== 'function') {
    throw new TypeError('delivery tools require send, sendFile, listTargets and listBots');
  }
  return [{
    name: SEND_MESSAGE_TOOL,
    description: 'Send one text message through a connected IM bot to a saved delivery target. '
      + 'Use it only when the user explicitly asks you to notify, push, or send something to a chat, '
      + 'or when a scheduled task says so. Never use it to answer the conversation you are in. '
      + 'Get botId and targetId from dsh_im_delivery_targets; never guess them. '
      + '`sent: true` means the platform accepted the request, not that it was delivered or read. '
      + 'Do not retry on a timeout: a duplicate message may already have been sent.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        botId: { type: 'string', description: 'Stable bot id from dsh_im_delivery_targets.' },
        targetId: { type: 'string', description: 'Saved target alias under that bot.' },
        text: { type: 'string', description: 'Message body. Non-empty.', minLength: 1 },
        format: {
          type: 'string',
          enum: [...FORMAT_VALUES],
          description: 'plain (default) or markdown. Markdown support varies by channel.',
        },
        idempotencyKey: {
          type: 'string',
          description: 'Optional stable key (letters, digits, . _ : -; max 128). '
            + 'Reuse the same key when retrying the same message so the Host suppresses a duplicate.',
        },
      },
      required: ['botId', 'targetId', 'text'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          sent: { type: 'boolean' },
          duplicate: { type: 'boolean' },
        },
        required: ['sent'],
      },
      render: (args, value) => [{
        type: 'text',
        text: value?.sent === true
          ? (value.duplicate === true
            ? `This idempotency key already delivered a message to target ${args.targetId}; nothing was sent again.`
            : `Accepted by the ${args.botId} bot for target ${args.targetId}. Delivery is not guaranteed yet; do not claim the user has read it.`)
          : 'The delivery service did not confirm success.',
      }],
    },
    execute: (args) => call(() => service.send(args.botId, args.targetId, args.text, {
      format: args.format ?? 'plain',
      ...(args.idempotencyKey === undefined ? {} : { idempotencyKey: args.idempotencyKey }),
    })),
  }, {
    name: SEND_FILE_TOOL,
    description: 'Send one local file or image through a connected IM bot to a saved delivery target. '
      + 'The Host reads the path; relative paths resolve against the Session workspace. '
      + 'Maximum 30 MB. Only channels with a proactive file path can do this (currently Feishu); '
      + 'others answer capability-unavailable. '
      + 'Use it only when the user explicitly asks to send a file to that chat. '
      + '`sent: true` means the platform accepted the upload and message, not that it was read. '
      + 'Do not retry after a timeout or delivery-failed: the file may already be visible.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        botId: { type: 'string', description: 'Stable bot id from dsh_im_delivery_targets.' },
        targetId: { type: 'string', description: 'Saved target alias under that bot.' },
        path: {
          type: 'string',
          description: 'Absolute path, or a path relative to the current workspace.',
          minLength: 1,
        },
        asImage: {
          type: 'boolean',
          description: 'Force an image message. Default: infer from the file extension.',
        },
        idempotencyKey: {
          type: 'string',
          description: 'Optional stable key (letters, digits, . _ : -; max 128). '
            + 'Reuse the same key when retrying the same file so the Host suppresses a duplicate.',
        },
      },
      required: ['botId', 'targetId', 'path'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          sent: { type: 'boolean' },
          duplicate: { type: 'boolean' },
          fileName: { type: 'string' },
          size: { type: 'number' },
          asImage: { type: 'boolean' },
        },
        required: ['sent', 'fileName', 'size', 'asImage'],
      },
      render: (args, value) => [{
        type: 'text',
        text: value?.sent === true
          ? (value.duplicate === true
            ? `This idempotency key already delivered ${value.fileName} to target ${args.targetId}; nothing was sent again.`
            : `Accepted ${value.fileName} (${value.size} bytes) as ${value.asImage ? 'an image' : 'a file'} `
              + `for target ${args.targetId}. Delivery is not guaranteed; do not claim the user has read it.`)
          : 'The delivery service did not confirm success.',
      }],
    },
    execute: (args, exec) => {
      const cwd = exec?.agent?.session?.header?.cwd;
      const path = isAbsolute(args.path) ? args.path : resolve(cwd ?? process.cwd(), args.path);
      return call(() => service.sendFile(args.botId, args.targetId, {
        path,
        ...(args.asImage === undefined ? {} : { asImage: args.asImage }),
      }, args.idempotencyKey === undefined ? {} : { idempotencyKey: args.idempotencyKey }));
    },
  }, {
    name: DELIVERY_TARGETS_TOOL,
    description: 'List connected IM bots and their saved delivery targets. '
      + 'Call without botId to see which bots exist; call with a botId to get the targetId values '
      + 'usable with dsh_im_send_message. Targets are created by the user in Settings → IM bots. '
      + 'Platform routes are not returned.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        botId: { type: 'string', description: 'Optional bot id; omit to list bots.' },
      },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    execute: (args) => call(async () => {
      if (typeof args.botId !== 'string' || !args.botId) {
        return { bots: await service.listBots() };
      }
      const listed = await service.listTargets(args.botId);
      return {
        botId: listed.botId,
        channel: listed.channel,
        targets: (listed.targets ?? []).map(publicTarget),
      };
    }),
  }];
}

/**
 * Register the delivery tools on a Host context.
 *
 * The tool list is static per Session, so both tools are registered whenever
 * the plugin loads; a Host with no bots answers `unknown-bot`, which the tool
 * message names explicitly. Guidance lives in the mounted skill, not in an
 * always-on system-prompt section.
 * @param ctx - context with `tools`.
 * @param service - the Host's DeliveryService.
 * @returns whether the tools were registered.
 */
export function installDeliveryTools(ctx, service) {
  if (typeof ctx?.tools?.register !== 'function') return false;
  for (const tool of createDeliveryTools(service)) ctx.tools.register(tool);
  return true;
}
