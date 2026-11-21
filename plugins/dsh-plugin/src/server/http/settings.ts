/**
 * DSH Plugin Hub — the community plugin marketplace for DeepSeek Harness.
 * Website: https://dsh-plugin.org
 * GitHub: https://github.com/dshplugin/dsh-plugin-hub
 *
 * 设置路由：读写插件中心设置，以及恢复默认。
 */
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { loadSettings, saveSettings, resetSettings } from '../services/settings.ts'
import { appendLog, customLogFile } from '../services/log.ts'
import { readJsonBody, requireTrustedPost, sendJson, type WebRoute, type WebServerService } from './shared.ts'

export function registerSettingsRoutes(webServer: WebServerService, profile: string): WebRoute[] {
  return [
    {
      kind: 'exact',
      path: '/dsh-plugin-hub/settings',
      // GET 读 / POST 写：webServer.register 按 (kind, path) 唯一，多方法必须合并到同一个 handler 按 method 分派
      handler: async (request, response) => {
        if (request.method === 'GET') {
          sendJson(response, 200, loadSettings(profile))
          return
        }
        if (!requireTrustedPost(request, response)) return
        try {
          const body = await readJsonBody(request)
          // 白名单字段：只接受已知设置项，防客户端把任意键写进文件
          const patch: Record<string, unknown> = {}
          const source = typeof body === 'object' && body !== null ? body as Record<string, unknown> : {}
          for (const key of ['checkUpdatesOnStart', 'enableNpmInstall', 'npmRegistry', 'registryFallback', 'proxy', 'logPath'] as const) {
            if (source[key] !== undefined) patch[key] = source[key]
          }
          // 日志位置：非空时预建目录验证可写，失败直接 400 拦截（默认位置永远合法，空串 = 回默认）
          if (typeof patch.logPath === 'string' && patch.logPath.trim() !== '') {
            try {
              mkdirSync(dirname(customLogFile(patch.logPath)), { recursive: true })
            } catch {
              sendJson(response, 400, { error: 'log path is not writable' })
              return
            }
          }
          sendJson(response, 200, saveSettings(profile, patch))
          // 系统日志：设置项变更
          appendLog(profile, {
            at: Date.now(),
            level: 'info',
            category: 'settings',
            event: 'settings.update',
            message: `更新设置：${Object.keys(patch).join(', ')}`,
          })
        } catch (error) {
          sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
    {
      kind: 'exact',
      path: '/dsh-plugin-hub/settings/reset',
      handler: async (request, response) => {
        if (!requireTrustedPost(request, response)) return
        sendJson(response, 200, resetSettings(profile))
        appendLog(profile, {
          at: Date.now(),
          level: 'warn',
          category: 'settings',
          event: 'settings.reset',
          message: '恢复全部默认设置',
        })
      },
    },
  ]
}
