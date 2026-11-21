/**
 * DSH Plugin Hub — the community plugin marketplace for DeepSeek Harness.
 * Website: https://dsh-plugin.org
 * GitHub: https://github.com/dshplugin/dsh-plugin-hub
 *
 * 归一化器：把在线 API 的短 key 载荷（s/o/n/vr/c/t/f/d/r/v/u/a/sg/fk）映射为
 * HubPlugin，让渲染层只面对一种数据形态。
 */
import type { HubPlugin } from '../types.ts'

export function normalize(raw: Record<string, unknown>): HubPlugin {
  if (typeof raw.s === 'string') {
    return {
      slug: raw.s,
      ownerSlug: typeof raw.o === 'string' ? raw.o : undefined,
      displayName: typeof raw.n === 'string' ? raw.n : undefined,
      version: typeof raw.vr === 'string' ? raw.vr : undefined,
      category: typeof raw.c === 'string' ? raw.c : undefined,
      topics: Array.isArray(raw.t) ? (raw.t as string[]) : undefined,
      features: Array.isArray(raw.f) ? (raw.f as string[]) : undefined,
      description: typeof raw.d === 'string' ? raw.d : undefined,
      // source 双形态：字符串 repo，或 { repo, npmPackage } 对象
      source: typeof raw.r === 'string'
        ? { repo: raw.r }
        : raw.r !== null && typeof raw.r === 'object'
          ? {
            repo: typeof (raw.r as { repo?: unknown }).repo === 'string' ? (raw.r as { repo: string }).repo : undefined,
            npmPackage: typeof (raw.r as { npmPackage?: unknown }).npmPackage === 'string' ? (raw.r as { npmPackage: string }).npmPackage : undefined,
          }
          : undefined,
      // 安装信息：wi 仅在 false 时下发（缺省视为 true 可一键安装）；
      // mi 仅在 true 时下发（人工干预：网页端替不了终端，只引导用户自己去终端装）；
      // ic/igc = 目录下发的权威安装命令（CLI-only 插件如 dsh-tui 必须用）
      install: raw.wi === false || raw.mi === true || typeof raw.ic === 'string' || typeof raw.igc === 'string'
        ? {
          webInstallable: raw.wi === false ? false : undefined,
          manualInstall: raw.mi === true ? true : undefined,
          command: typeof raw.ic === 'string' ? raw.ic : undefined,
          githubCommand: typeof raw.igc === 'string' ? raw.igc : undefined,
        }
        : undefined,
      compatibility: typeof raw.v === 'string' ? { status: raw.v } : undefined,
      dates: {
        repoUpdatedAt: typeof raw.u === 'string' ? raw.u : undefined,
        addedAt: typeof raw.a === 'string' ? raw.a : undefined,
      },
      stats: {
        stargazers_count: typeof raw.sg === 'number' ? raw.sg : undefined,
        forks_count: typeof raw.fk === 'number' ? raw.fk : undefined,
      },
    }
  }
  return raw as unknown as HubPlugin
}
