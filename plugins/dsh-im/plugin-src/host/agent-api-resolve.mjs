// Pure resolution and projection for the offline CLI.
//
// Everything here is a function of file contents: no Host service, no socket,
// no credential. That is what lets `dsh-im accounts` answer on a machine where
// DSH is not running, and it is why the writes never come through this module.

import { channelLabel } from './channel-registry.mjs';

/**
 * @typedef {{ accountName: string, accountNameSource: 'alias'|'botName'|'channel',
 *   channel: string, botId: string, connected: boolean|null, state: string }} PublicAccount
 * @typedef {{ targetId: string, targetName?: string, kind: string, route?: object }} PublicTarget
 */

function refusal(code, message, candidates) {
  const error = new Error(message);
  error.code = code;
  if (candidates) error.candidates = candidates;
  return error;
}

function displayText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Decide what a bot is called, and say where the name came from so the Agent
 * can tell a deliberate alias from a best-effort platform label.
 * @param value.alias - the user's alias from `workspaces.json`.
 * @param value.botName - the bot name stored in the channel's `config.json`.
 * @param value.channel - channel id, used for the last resort.
 * @returns the trimmed name plus the source that produced it.
 */
export function accountNameOf({ alias, botName, channel }) {
  const chosen = displayText(alias);
  if (chosen) return { name: chosen, source: 'alias' };
  const stored = displayText(botName);
  if (stored) return { name: stored, source: 'botName' };
  return { name: channelLabel(channel), source: 'channel' };
}

/**
 * Find one account by name or bot id.
 *
 * An exact account name wins over a bot id, because a name is something a
 * person chose and typed; a bot id is an internal key they normally never see.
 * Two accounts sharing a name is a refusal, never a coin flip: sending to the
 * wrong chat is not recoverable.
 * @param accounts - the projected account list.
 * @param query - `--account` value.
 */
export function resolveAccount(accounts, query) {
  const wanted = displayText(query);
  if (!wanted) throw refusal('unknown-account', '需要账号名或 botId');

  const byName = accounts.filter((account) => account.accountName === wanted);
  if (byName.length === 1) return byName[0];
  if (byName.length > 1) {
    throw refusal(
      'ambiguous-account',
      `账号名「${wanted}」对应 ${byName.length} 个账号，请改用 botId`,
      byName,
    );
  }

  const byId = accounts.filter((account) => account.botId === wanted);
  if (byId.length === 1) return byId[0];
  if (byId.length > 1) {
    throw refusal('ambiguous-account', `botId「${wanted}」不唯一`, byId);
  }

  throw refusal('unknown-account', `找不到账号「${wanted}」，先运行 dsh-im accounts`);
}

/**
 * Find one target by id or display name.
 *
 * Names are accepted because that is what a person reads off the settings page
 * and what an Agent naturally copies from `dsh-im targets`; the id remains the
 * unambiguous key and is what the HTTP route receives either way.
 * @param targets - the projected target list.
 * @param query - `--target` value.
 */
export function resolveTarget(targets, query) {
  const wanted = displayText(query);
  if (!wanted) throw refusal('unknown-target', '需要 targetId 或目标名');

  const byId = targets.filter((target) => target.targetId === wanted);
  if (byId.length === 1) return byId[0];

  const byName = targets.filter((target) => target.targetName === wanted);
  if (byName.length === 1) return byName[0];
  if (byName.length > 1) {
    throw refusal(
      'ambiguous-target',
      `目标名「${wanted}」对应 ${byName.length} 个目标，请改用 targetId`,
      byName,
    );
  }

  throw refusal('unknown-target', `找不到目标「${wanted}」，先运行 dsh-im targets --account <账号>`);
}

/**
 * Project one stored target for the CLI.
 *
 * `route` holds platform-native identifiers and is hidden by default: it adds
 * nothing for a caller that already has `targetId`, and showing it invites a
 * model to invent addresses that were never registered.
 * @param target - the stored target, with its `name`.
 * @param options.withRoutes - include `route` for troubleshooting.
 */
export function publicTarget(target, { withRoutes = false } = {}) {
  const projected = { targetId: target.targetId, kind: target.kind };
  const name = displayText(target.name ?? target.targetName);
  if (name) projected.targetName = name;
  if (withRoutes && target.route) projected.route = target.route;
  return projected;
}

/**
 * Warn when one name is spread over several accounts.
 * @param accounts - the projected account list.
 * @returns one line per duplicated name, in first-seen order.
 */
export function accountWarnings(accounts) {
  const seen = new Map();
  for (const account of accounts) {
    const entry = seen.get(account.accountName);
    if (entry) entry.count += 1;
    else seen.set(account.accountName, { count: 1 });
  }
  return [...seen.entries()]
    .filter(([, entry]) => entry.count > 1)
    .map(([name, entry]) => (
      `账号名重复（「${name}」同时对应 ${entry.count} 个账号），写操作请用 botId`
    ));
}

/**
 * Warn when a target is named exactly like the account that owns it.
 *
 * This is not hypothetical: the live Weixin config names the account and its
 * only private target both 「我的微信」, so a caller reading
 * `account=我的微信, target=我的微信` has no way to tell what it is sending to.
 * The fix belongs to the user (rename the target in Settings), so the CLI
 * surfaces it every time the pair is listed rather than silently resolving it.
 * @param account - the resolved account.
 * @param targets - its projected targets.
 */
export function targetWarnings(account, targets) {
  const accountName = displayText(account?.accountName);
  if (!accountName) return [];
  return targets
    .filter((target) => target.targetName === accountName)
    .map((target) => (
      `目标名与账号名相同（均为「${accountName}」，targetId ${target.targetId}），`
      + '建议在设置页给该目标起一个可区分的名字'
    ));
}
