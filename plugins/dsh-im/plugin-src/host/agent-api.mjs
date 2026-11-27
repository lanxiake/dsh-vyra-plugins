// Offline projection of the IM configuration for the `dsh-im` CLI.
//
// This module deliberately cannot send, write or connect. It reads the two
// files a channel keeps under `<DSH_HOME>/integrations/dsh-<channel>/` and
// projects them for an Agent:
//
//   config.json       which bots exist (`bots[].id`) and what they are called
//                     (`bots[].botName`)
//   workspaces.json   per-bot aliases, workspace paths and delivery targets
//
// Reading only the second file finds no bots at all, because `aliases` and
// `deliveryTargets` are keyed by a bot id whose set lives in the first file.
// Writes are *not* reimplemented here: they go through the Host, which owns the
// write queue and the validation.
//
// Nothing here opens a socket or resolves a credential, so it answers while
// DSH is not running.

import { readFile as defaultReadFile } from 'node:fs/promises';
import { join } from 'node:path';

import { CHANNELS, channelDataDir } from './channel-registry.mjs';
import {
  accountNameOf,
  accountWarnings,
  publicTarget,
  resolveAccount,
  targetWarnings,
} from './agent-api-resolve.mjs';

/** `workspaces.json` is optional; a channel with bots but no settings is normal. */
const EMPTY_WORKSPACES = Object.freeze({
  version: 2,
  workspaces: {},
  aliases: {},
  deliveryTargets: {},
});

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function channelFiles(dshHome, channel) {
  const directory = join(dshHome, 'integrations', channelDataDir(channel));
  return {
    config: join(directory, 'config.json'),
    workspaces: join(directory, 'workspaces.json'),
  };
}

async function readJson(readFile, path) {
  let text;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    // A channel the user never configured has no data directory at all.
    return null;
  }
  try {
    const parsed = JSON.parse(text);
    return isRecord(parsed) ? parsed : null;
  } catch {
    // A half-written file must not take the whole account list down.
    return null;
  }
}

/**
 * Read a bot id out of one stored entry.
 *
 * The channels disagree on both the array key and the id field: Feishu writes
 * `bots[]` entries whose id is `id`, while Weixin writes `accounts[]` entries
 * whose id is `botId`. Both are real shapes on disk, so both are accepted.
 */
function botIdOf(entry) {
  if (typeof entry?.id === 'string' && entry.id) return entry.id;
  if (typeof entry?.botId === 'string' && entry.botId) return entry.botId;
  return '';
}

/** The stored display name, if this channel records one at all. */
function botNameOf(entry) {
  return typeof entry?.botName === 'string' ? entry.botName : '';
}

/**
 * Every bot a channel's `config.json` records, whichever key it used.
 *
 * A channel that never recorded a name (Weixin, whose QR login returns none)
 * falls back to the channel label later, which is exactly why the CLI reports
 * `accountNameSource`.
 */
function configuredBots(config) {
  if (!config) return [];
  const list = Array.isArray(config.bots) ? config.bots
    : Array.isArray(config.accounts) ? config.accounts
      : [];
  return list
    .filter((entry) => isRecord(entry) && botIdOf(entry))
    .map((entry) => ({ id: botIdOf(entry), botName: botNameOf(entry) }));
}

function aliasesOf(workspaces) {
  return isRecord(workspaces?.aliases) ? workspaces.aliases : {};
}

function targetsOf(workspaces, botId) {
  const all = workspaces?.deliveryTargets;
  if (!isRecord(all)) return null;
  const own = all[botId];
  return isRecord(own) ? own : null;
}

/**
 * Build the offline projection.
 * @param options.dshHome - DSH home directory holding `integrations/`.
 * @param options.readFile - file reader override (tests); defaults to `fs/promises`.
 */
export function createAgentApi({ dshHome, readFile = defaultReadFile } = {}) {
  if (typeof dshHome !== 'string' || !dshHome) throw new TypeError('dshHome is required');

  /** Every account across every channel, ordered channel then bot id. */
  async function accounts() {
    const projected = [];
    for (const channel of CHANNELS) {
      const files = channelFiles(dshHome, channel);
      const config = await readJson(readFile, files.config);
      const bots = configuredBots(config);
      if (bots.length === 0) continue;
      const workspaces = (await readJson(readFile, files.workspaces)) ?? EMPTY_WORKSPACES;
      const aliases = aliasesOf(workspaces);
      for (const bot of [...bots].sort((left, right) => left.id.localeCompare(right.id))) {
        const alias = aliases[bot.id];
        const { name, source } = accountNameOf({ alias, botName: bot.botName, channel });
        projected.push({
          accountName: name,
          accountNameSource: source,
          channel,
          botId: bot.id,
          // Reaching a platform needs a credential and a connection; this
          // projection has neither, and must not pretend otherwise.
          connected: null,
          state: 'unknown',
        });
      }
    }
    return { accounts: projected, warnings: accountWarnings(projected) };
  }

  /** One account's delivery targets, never failing on an empty list. */
  async function targets({ account, withRoutes = false } = {}) {
    const listed = await accounts();
    const resolved = resolveAccount(listed.accounts, account);
    const files = channelFiles(dshHome, resolved.channel);
    const workspaces = (await readJson(readFile, files.workspaces)) ?? EMPTY_WORKSPACES;
    const own = targetsOf(workspaces, resolved.botId) ?? {};
    const projected = Object.entries(own)
      .map(([targetId, stored]) => publicTarget({ targetId, ...(isRecord(stored) ? stored : {}) }, { withRoutes }))
      .sort((left, right) => left.targetId.localeCompare(right.targetId));
    return {
      accountName: resolved.accountName,
      channel: resolved.channel,
      botId: resolved.botId,
      targets: projected,
      warnings: targetWarnings(resolved, projected),
    };
  }

  return Object.freeze({ accounts, targets });
}
