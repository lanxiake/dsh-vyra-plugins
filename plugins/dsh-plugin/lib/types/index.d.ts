/**
 * DSH Plugin Hub — the community plugin marketplace for DeepSeek Harness.
 * Website: https://dsh-plugin.org
 * GitHub: https://github.com/dshplugin/dsh-plugin-hub
 *
 * dsh-plugin 宿主入口：宿主 webServer 服务就绪后挂载插件中心的 HTTP 路由。
 * 浏览器 bundle（src/client）通过这些同源路由在应用内执行真正的安装。
 */
import { type LoaderHandle } from './services/install/install.ts';
import { type WebServerService } from './http/routes.ts';
export declare const name = "dsh-plugin";
export interface Config {
    /** 拥有插件变更权限的 DSH profile，缺省用启动时的 profile。 */
    profile?: string;
}
/** 本插件用到的 cordis 宿主上下文子集。 */
interface HostContext {
    webServer: WebServerService;
    /** 运行中 loader：卸载成功后主动移除条目、立即生效（宿主未提供时卸载仍需重启） */
    loader?: LoaderHandle;
    inject(services: string[], callback: (host: HostContext) => void): void;
    effect(callback: () => void, label?: string): void;
}
/**
 * webServer 服务就绪后挂载插件中心路由。
 * @param ctx - cordis 宿主上下文。
 * @param config - 可选的 profile 覆盖。
 */
export declare function apply(ctx: HostContext, config?: Config): void;
export {};
