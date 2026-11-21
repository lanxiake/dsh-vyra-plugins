/**
 * DSH Plugin Hub — the community plugin marketplace for DeepSeek Harness.
 * Website: https://dsh-plugin.org
 * GitHub: https://github.com/dshplugin/dsh-plugin-hub
 *
 * 插件中心设置持久化：每个活跃 profile 一个 `hub-settings.json`（与 pnpm-workspace.yaml 同目录）。
 * 所有字段可选；缺失的 key 回退到 DEFAULT_SETTINGS，新选项上线后旧文件仍可读。
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { profileDirectory } from './profile/profile.ts'

export interface HubSettings {
  /** 启动时检查目录插件更新，发现可更新时在通知中心提示（安装不自动进行） */
  checkUpdatesOnStart: boolean
  /** HTTP(S) 代理地址，用于 npm / git / 目录请求（空串 = 直连） */
  proxy: string
  /** npm 镜像源 registry 地址（空串 = 未配置，跟随用户本机 npm 配置） */
  npmRegistry: string
  /** 公共源传输失败时自动换下一个镜像重试（自定义/内网源不切换） */
  registryFallback: boolean
  /** 启用命令行安装 NPM 包（默认开；关掉后输入 npm 包名安装被拦截） */
  enableNpmInstall: boolean
  /** 日志存放位置覆盖（空串 = 默认 ~/.dsh/profiles/<profile>/hub.log；可填目录或 .log 文件路径） */
  logPath: string
}

export const DEFAULT_SETTINGS: HubSettings = {
  checkUpdatesOnStart: true,
  proxy: '',
  npmRegistry: '',
  registryFallback: true,
  enableNpmInstall: true,
  logPath: '',
}

export function settingsFile(profile: string): string {
  return join(profileDirectory(profile), 'hub-settings.json')
}

/** 读取当前 profile 的设置；文件缺失/损坏时回退默认值（只读路径绝不抛错）。 */
export function loadSettings(profile: string): HubSettings {
  try {
    const raw = JSON.parse(readFileSync(settingsFile(profile), 'utf8')) as Partial<HubSettings>
    return {
      ...DEFAULT_SETTINGS,
      ...(typeof raw === 'object' && raw !== null ? raw : {}),
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

/** 合并并持久化设置（部分更新），返回合并后的完整设置。 */
export function saveSettings(profile: string, patch: Partial<HubSettings>): HubSettings {
  const next = { ...loadSettings(profile), ...patch }
  const file = settingsFile(profile)
  try {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`)
  } catch {
    // 持久化失败不阻断本次会话：内存值仍生效，下次写入再试
  }
  return next
}

/** 重置为默认设置：删除设置文件，下次读取全部回退默认值（陈旧/白名单外键一并清除）。 */
export function resetSettings(profile: string): HubSettings {
  try {
    rmSync(settingsFile(profile), { force: true })
  } catch {
    // 删除失败不阻断：loadSettings 仍回退默认值
  }
  return { ...DEFAULT_SETTINGS }
}
