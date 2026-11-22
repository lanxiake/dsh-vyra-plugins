/**
 * URL safety for the two places where the Host fetches a user/platform URL:
 * online cover proxying and tag-cover downloading.
 *
 * @module dsh-music-panel/url-safety
 */

import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const COVER_HOST_SUFFIXES = [
  'music.126.net',
  'music.163.com',
  'gtimg.cn',
  'qlogo.cn',
  'qq.com',
  'kugou.com',
  'kgimg.com',
  'kugou.net',
  'mzstatic.com',
  'coverartarchive.org',
  'archive.org',
  'itunes.apple.com',
  // Bodian serves artwork from Kuwo's CDN.
  'kuwo.cn',
  // Qishui (Douyin) artwork and avatars.
  'douyinpic.com',
  'douyin.com',
  'byteimg.com',
]

function privateAddress(address) {
  const value = String(address || '').toLowerCase()
  if (value === '::1' || value === '::' || value.startsWith('fe80:') || value.startsWith('fc') || value.startsWith('fd')) {
    return true
  }
  if (isIP(value) === 4) {
    const parts = value.split('.').map(Number)
    return (
      parts[0] === 10 ||
      parts[0] === 127 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      parts[0] === 0
    )
  }
  return false
}

function parseHttp(value) {
  let parsed
  try {
    parsed = new URL(String(value || ''))
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  if (parsed.username !== '' || parsed.password !== '') return null
  if (parsed.hostname === '' || parsed.hostname === 'localhost' || parsed.hostname.endsWith('.local')) return null
  return parsed
}

/** The provider CDN allowlist used by /online/cover. */
export function isAllowedCoverUrl(value) {
  const parsed = parseHttp(value)
  if (parsed === null) return false
  const host = parsed.hostname.toLowerCase()
  if (privateAddress(host)) return false
  return COVER_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith('.' + suffix))
}

/** Reject localhost/private targets for user-supplied remote covers. */
export async function assertPublicHttpUrl(value) {
  const parsed = parseHttp(value)
  if (parsed === null) throw Object.assign(new Error('远程地址不合法'), { code: 'BAD_URL' })
  const host = parsed.hostname.toLowerCase()
  if (privateAddress(host)) throw Object.assign(new Error('不允许访问本机或内网地址'), { code: 'BAD_URL' })
  if (isIP(host) !== 0) return parsed
  try {
    const results = await lookup(host, { all: true, verbatim: true })
    if (results.some((entry) => privateAddress(entry.address))) {
      throw Object.assign(new Error('不允许访问本机或内网地址'), { code: 'BAD_URL' })
    }
  } catch (error) {
    if (error?.code === 'BAD_URL') throw error
    throw Object.assign(new Error('远程地址无法解析'), { code: 'BAD_URL' })
  }
  return parsed
}
