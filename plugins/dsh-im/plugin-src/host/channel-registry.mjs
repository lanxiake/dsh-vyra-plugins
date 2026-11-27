// Channel identity shared by the Host and the offline CLI projection.
//
// One table so a channel's directory name, its CLI label and its data
// directory (`<DSH_HOME>/integrations/dsh-<channel>`) can never drift apart.
// `office` is deliberately absent: the AI Office connector has no bots, no
// delivery targets and no QR binding, so it is not part of the account surface.

/** Channels that own bots and delivery targets, in the client's tab order. */
export const CHANNELS = Object.freeze([
  'feishu',
  'weixin',
  'dingtalk',
  'wecom',
  'wecom-app',
  'qq',
  'slack',
  'telegram',
  'discord',
  'whatsapp',
  'imessage',
  'email',
  'matrix',
]);

/** Display label per channel; the last-resort `accountName` when nothing names a bot. */
const LABELS = Object.freeze({
  feishu: '飞书',
  weixin: '微信',
  dingtalk: '钉钉',
  wecom: '企业微信',
  'wecom-app': '企业微信应用',
  qq: 'QQ',
  slack: 'Slack',
  telegram: 'Telegram',
  discord: 'Discord',
  whatsapp: 'WhatsApp',
  imessage: 'iMessage',
  email: '邮件',
  matrix: 'Matrix',
});

function assertChannel(channel) {
  if (typeof channel !== 'string' || !Object.hasOwn(LABELS, channel)) {
    throw new TypeError(`Unknown IM channel: ${String(channel)}`);
  }
  return channel;
}

/**
 * The label the settings page and the CLI both show for one channel.
 * @param channel - channel id from CHANNELS.
 */
export function channelLabel(channel) {
  return LABELS[assertChannel(channel)];
}

/**
 * The `integrations/` directory name holding one channel's config files.
 * @param channel - channel id from CHANNELS.
 */
export function channelDataDir(channel) {
  return `dsh-${assertChannel(channel)}`;
}
