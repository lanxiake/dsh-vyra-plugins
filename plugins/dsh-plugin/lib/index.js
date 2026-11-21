/**
 * DSH Plugin Hub — the community plugin marketplace for DeepSeek Harness.
 * Website: https://dsh-plugin.org
 * GitHub: https://github.com/dshplugin/dsh-plugin-hub
 *
 * dsh-plugin 宿主入口：宿主 webServer 服务就绪后挂载插件中心的 HTTP 路由。
 * 浏览器 bundle（src/client）通过这些同源路由在应用内执行真正的安装。
 */
import { readProfileArg } from './services/install/install.js';
import { mountPluginHubRoutes } from './http/routes.js';
export const name = 'dsh-plugin';
/**
 * webServer 服务就绪后挂载插件中心路由。
 * @param ctx - cordis 宿主上下文。
 * @param config - 可选的 profile 覆盖。
 */
export function apply(ctx, config = {}) {
    const profile = config.profile ?? readProfileArg('web');
    ctx.inject(['webServer'], (host) => {
        host.effect(() => mountPluginHubRoutes(host.webServer, profile, host.loader), 'dsh-plugin: http routes');
    });
}
