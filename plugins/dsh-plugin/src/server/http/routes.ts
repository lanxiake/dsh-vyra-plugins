/**
 * DSH Plugin Hub — the community plugin marketplace for DeepSeek Harness.
 * Website: https://dsh-plugin.org
 * GitHub: https://github.com/dshplugin/dsh-plugin-hub
 *
 * 本地 HTTP 路由：把真实安装能力暴露给应用内的插件中心 UI。客户端请求同源
 * `/dsh-plugin-hub/*` 端点；安装处理校验目标后 spawn 官方 dsh CLI（见
 * services/install/install.ts）并回传捕获的结果。
 */
import { type LoaderHandle } from '../services/install/install.ts'
import { appendLog } from '../services/log.ts'
import { PROFILE_RE, type WebRoute, type WebServerService } from './shared.ts'
import { registerCatalogRoutes } from './catalog.ts'
import { registerInstallRoutes } from './install.ts'
import { registerSettingsRoutes } from './settings.ts'
import { registerLogsRoutes } from './logs.ts'
import { registerDiagnosticsRoutes } from './diagnostics.ts'
import { registerTaskRoutes } from './task.ts'
import { registerNpmReleaseAgeRoutes } from './npm-release-age.ts'

/**
 * 在宿主 web server 上注册插件中心 API 并返回 dispose 函数。
 * @param webServer - DSH web server 服务。
 * @param profile - 拥有插件变更权限的 profile。
 * @param loader - 运行中 loader（可选）：让卸载立即移除条目，页面刷新即生效、无需重启宿主。
 */
export function mountPluginHubRoutes(webServer: WebServerService, profile: string, loader?: LoaderHandle): () => void {
  if (!PROFILE_RE.test(profile)) throw new Error(`invalid profile name: ${profile}`)
  console.log(`[hub] routes mounted (profile=${profile}, loader=${loader === undefined ? 'undefined' : 'provided'})`)
  // 系统日志：插件随宿主启动即记录一条 —— 保证「打开就有运行日志」，日志页永远有内容
  appendLog(profile, {
    at: Date.now(),
    level: 'info',
    category: 'system',
    event: 'system.start',
    message: `Plugin Hub 已启动（profile=${profile}）`,
  })
  const routes: WebRoute[] = [
    ...registerCatalogRoutes(webServer, profile),
    ...registerInstallRoutes(webServer, profile, loader),
    ...registerSettingsRoutes(webServer, profile),
    ...registerLogsRoutes(webServer, profile),
    ...registerDiagnosticsRoutes(webServer, profile),
    ...registerTaskRoutes(webServer, profile, loader),
    ...registerNpmReleaseAgeRoutes(webServer, profile),
  ]
  const disposers = routes.map((route) => webServer.register(route))
  return () => {
    for (const dispose of disposers) dispose()
  }
}

/** 与客户端路由文档共用的 profile 解析。 */
export { readProfileArg } from '../services/install/install.ts'
/** 转出以便宿主入口（index.ts）继续从本模块引入。 */
export type { WebServerService } from './shared.ts'
/** 转出以便 tests/routes.test.ts 继续从本模块引入。 */
export { isDesktopHost, isSameOrigin } from './shared.ts'
