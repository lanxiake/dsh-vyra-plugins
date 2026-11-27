// IM 投递出口：从 dsh-im 读取机器人/目标，并把「历史会话」变成可用的投递目标。
//
// 背景（2026-11-27 定）：
//   dsh-im 的 listTargets 只返回「显式创建过的目标」，一个都没建时下拉框就是空的；
//   listSuggestions 又要求会话 key 是 group:/DSChat，微信 P2P 会话不会被推荐。
//   所以这里额外做两件事：
//     1. 读出 dsh-im 各通道的会话记录（state.json 里的 sessions / 最近的发送对象），
//        列成「历史会话」供用户勾选；
//     2. 勾选后用 createTarget 把它们建成正式目标，之后 listTargets 就有值了。
//
// 如果 dsh-im 后续升级到「直接暴露会话/默认收件人」，这里优先用新接口，代码不用改。

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const INTEGRATIONS = () => join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'integrations')

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

/** 微信通道的账号目录：integrations/dsh-weixin/accounts/<botId>/state.json */
function weixinState(botId) {
  const base = join(INTEGRATIONS(), 'dsh-weixin', 'accounts', botId)
  const state = readJson(join(base, 'state.json'))
  if (!state) return null
  // 从 state 里能拿到的「可以主动发消息的对象」：
  //   - sessions 的 p2p:<userId> / group:<roomId>
  //   - recentOutboundMessages 里的 toUserId
  const out = []
  for (const key of Object.keys(state.sessions || {})) {
    const address = key.includes(':') ? key.slice(key.indexOf(':') + 1) : key
    out.push({ conversationKey: key, address, label: address, source: 'session' })
  }
  for (const m of state.recentOutboundMessages || []) {
    const address = String(m.toUserId || '')
    if (!address) continue
    if (out.some((o) => o.address === address)) continue
    out.push({ conversationKey: `p2p:${address}`, address, label: address, source: 'outbound' })
  }
  return out
}

/** 飞书/其它通道：看 accounts 目录下有没有可读的会话记录，读不到就返回空。 */
function genericState(botId) {
  const base = join(INTEGRATIONS(), 'dsh-feishu', 'accounts', botId)
  const out = []
  try {
    for (const name of readdirSync(base)) {
      if (!name.endsWith('.json')) continue
      const body = readJson(join(base, name)) || {}
      for (const key of Object.keys(body.sessions || {})) {
        const address = key.includes(':') ? key.slice(key.indexOf(':') + 1) : key
        out.push({ conversationKey: key, address, label: address, source: 'session' })
      }
    }
  } catch {
    // 目录不存在
  }
  return out
}

/**
 * 汇总「可以从历史会话绑定的目标」。
 * @returns {Array<{botId, channel, targetId, label, source}>}
 */
export function listHistoryCandidates(bots = []) {
  const out = []
  for (const bot of bots) {
    const botId = String(bot?.botId || bot?.id || '')
    if (!botId) continue
    const entries = String(bot.channel) === 'weixin' ? (weixinState(botId) || []) : genericState(botId)
    for (const entry of entries) {
      out.push({
        botId,
        channel: String(bot.channel || ''),
        // dsh-im 的目标 id 通常就是会话地址
        targetId: entry.address,
        label: entry.label,
        source: entry.source,
        conversationKey: entry.conversationKey,
      })
    }
  }
  return out
}

/** 各通道允许的目标 kind（来自 dsh-im normalizeRoute）。 */
export const CHANNEL_KINDS = {
  weixin: ['user'],
  feishu: ['user', 'group'],
  dingtalk: ['user', 'group'],
  wecom: ['user', 'group'],
  'wecom-app': ['user'],
  qq: ['user', 'group'],
  slack: ['conversation', 'thread'],
  telegram: ['chat', 'topic'],
}

/** 各通道放进 route 里的地址字段名。 */
export const CHANNEL_ROUTE_FIELD = {
  weixin: { user: 'toUserId' },
  feishu: { user: 'openId', group: 'chatId' },
  dingtalk: { user: 'userId', group: 'openConversationId' },
  wecom: { user: 'chatId', group: 'chatId' },
  'wecom-app': { user: 'chatId' },
  qq: { user: 'userOpenId', group: 'groupOpenId' },
  slack: { conversation: 'channelId' },
  telegram: { chat: 'chatId' },
}

/**
 * 给某个通道挑一个可用的 kind 并拼出 createTarget 需要的 payload。
 * dsh-im 的 normalizeDeliveryTarget 只接受这四个字段：targetId / name / kind / route，
 * 多一个字段就会报「target contains an unknown field」。
 */
export function buildTargetPayload({ channel, targetId, label }) {
  const kinds = CHANNEL_KINDS[String(channel)] || ['user']
  const kind = kinds[0]
  const field = (CHANNEL_ROUTE_FIELD[String(channel)] || {})[kind] || 'toUserId'
  return {
    targetId: String(targetId),
    name: String(label || targetId).slice(0, 80),
    kind,
    route: { [field]: String(targetId) },
  }
}
export function mergeTargets({ bots = [], targets = {}, suggestions = {} } = {}) {
  const merged = {}
  for (const bot of bots) {
    const botId = String(bot?.botId || bot?.id || '')
    if (!botId) continue
    const rows = []
    for (const t of targets[botId] || []) {
      rows.push({
        targetId: String(t.targetId || t.id || ''),
        label: String(t.name || t.label || t.targetId || t.id || ''),
        kind: String(t.kind || 'private'),
        source: 'target',
      })
    }
    for (const s of suggestions[botId] || []) {
      if (!rows.some((r) => r.targetId === s.targetId)) rows.push({ ...s, source: 'suggestion' })
    }
    for (const h of listHistoryCandidates([bot])) {
      if (!rows.some((r) => r.targetId === h.targetId)) {
        rows.push({ targetId: h.targetId, label: h.label, kind: 'private', source: 'history' })
      }
    }
    merged[botId] = rows
  }
  return merged
}
