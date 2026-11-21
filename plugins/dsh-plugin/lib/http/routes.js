import { appendLog } from '../services/log.js';
import { PROFILE_RE } from './shared.js';
import { registerCatalogRoutes } from './catalog.js';
import { registerInstallRoutes } from './install.js';
import { registerSettingsRoutes } from './settings.js';
import { registerLogsRoutes } from './logs.js';
import { registerDiagnosticsRoutes } from './diagnostics.js';
import { registerTaskRoutes } from './task.js';
import { registerNpmReleaseAgeRoutes } from './npm-release-age.js';
/**
 * 在宿主 web server 上注册插件中心 API 并返回 dispose 函数。
 * @param webServer - DSH web server 服务。
 * @param profile - 拥有插件变更权限的 profile。
 * @param loader - 运行中 loader（可选）：让卸载立即移除条目，页面刷新即生效、无需重启宿主。
 */
export function mountPluginHubRoutes(webServer, profile, loader) {
    if (!PROFILE_RE.test(profile))
        throw new Error(`invalid profile name: ${profile}`);
    console.log(`[hub] routes mounted (profile=${profile}, loader=${loader === undefined ? 'undefined' : 'provided'})`);
    // 系统日志：插件随宿主启动即记录一条 —— 保证「打开就有运行日志」，日志页永远有内容
    appendLog(profile, {
        at: Date.now(),
        level: 'info',
        category: 'system',
        event: 'system.start',
        message: `Plugin Hub 已启动（profile=${profile}）`,
    });
    const routes = [
        ...registerCatalogRoutes(webServer, profile),
        ...registerInstallRoutes(webServer, profile, loader),
        ...registerSettingsRoutes(webServer, profile),
        ...registerLogsRoutes(webServer, profile),
        ...registerDiagnosticsRoutes(webServer, profile),
        ...registerTaskRoutes(webServer, profile, loader),
        ...registerNpmReleaseAgeRoutes(webServer, profile),
    ];
    const disposers = routes.map((route) => webServer.register(route));
    return () => {
        for (const dispose of disposers)
            dispose();
    };
}
/** 与客户端路由文档共用的 profile 解析。 */
export { readProfileArg } from '../services/install/install.js';
/** 转出以便 tests/routes.test.ts 继续从本模块引入。 */
export { isDesktopHost, isSameOrigin } from './shared.js';
