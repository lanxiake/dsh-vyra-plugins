/**
 * 版本比较与发布冷却期。
 *
 * 移植自 dsh-plugin-hub `src/client/logic/release-age.ts`（MIT）。
 * 与 market 的 `compareVersion` 不同：这里处理预发布语义，
 * `1.0.0` 高于 `1.0.0-beta.1`，两个预发布版按标识符比较。
 */

/** 逐段数字比较；缺失段按 0。返回负数 / 0 / 正数。 */
export function compareVersions(a, b) {
  const core = (v) =>
    String(v ?? '')
      .split('+')[0]
      .split('-')[0]
      .split('.')
      .map((part) => Number.parseInt(part.replace(/^[^\d]+/, ''), 10))
      .filter((n) => !Number.isNaN(n))

  const pre = (v) => {
    const rest = String(v ?? '').split('+')[0].split('-').slice(1)
    return rest.length === 0 ? [] : rest.join('-').split('.')
  }

  const va = core(a)
  const vb = core(b)
  const len = Math.max(va.length, vb.length)
  for (let i = 0; i < len; i++) {
    const d = (va[i] ?? 0) - (vb[i] ?? 0)
    if (d !== 0) return d
  }

  const pa = pre(a)
  const pb = pre(b)
  if (pa.length === 0 && pb.length === 0) return 0
  if (pa.length === 0) return 1
  if (pb.length === 0) return -1

  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i]
    const y = pb[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    const nx = /^\d+$/.test(x) ? Number(x) : null
    const ny = /^\d+$/.test(y) ? Number(y) : null
    if (nx !== null && ny !== null) {
      if (nx !== ny) return nx - ny
    } else if (x !== y) {
      return x < y ? -1 : 1
    }
  }
  return 0
}

/**
 * pnpm 对发布不满 24 小时（dsh profile 默认 minimumReleaseAge=1440 分钟）的版本
 * 会静默回退到旧版本，因此发布太新的版本不该提示更新。+30 分钟缓冲抵消 CDN 时间偏差。
 */
export const MIN_RELEASE_AGE_MS = 24 * 60 * 60 * 1000 + 30 * 60 * 1000

/** 发布时间是否仍在冷却期内（太新 → 暂缓提示）；无值或解析不出返回 false。 */
export function isReleaseTooFresh(publishedAt, now = Date.now()) {
  if (typeof publishedAt !== 'string' || publishedAt === '') return false
  const ms = Date.parse(publishedAt)
  if (Number.isNaN(ms)) return false
  return now - ms < MIN_RELEASE_AGE_MS
}

/** installed 是否落后于 candidate，且 candidate 已过冷却期。 */
export function isUpdateOffered(candidateVersion, candidatePublishedAt, installedVersion, now = Date.now()) {
  if (!candidateVersion || !installedVersion) return false
  if (compareVersions(candidateVersion, installedVersion) <= 0) return false
  return !isReleaseTooFresh(candidatePublishedAt, now)
}
