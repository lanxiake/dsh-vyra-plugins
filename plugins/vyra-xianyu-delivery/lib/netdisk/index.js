// 网盘供应商工厂。目前只接了夸克；百度按需求留占位，接入前明确返回 unsupported。
import { createQuark } from './quark.js'

export const PROVIDERS = ['quark', 'baidu']

export const PROVIDER_LABELS = {
  quark: '夸克网盘',
  baidu: '百度网盘',
}

export function createNetdisk(config = {}) {
  const provider = String(config.provider || 'quark')
  if (provider === 'quark') return createQuark(config)
  return {
    id: provider,
    unsupported: true,
    label: PROVIDER_LABELS[provider] || provider,
    async probe() { return { ok: false, error: 'not_configured' } },
    async authState() { return { state: 'unsupported', hint: '尚未接入' } },
    async list() { return [] },
    async resolve() { throw new Error('not_configured') },
    async share() { throw new Error('not_configured') },
    async verify() { return { ok: false, status: 0, error: 'not_configured' } },
  }
}
