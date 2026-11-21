/**
 * DSH Plugin Hub — the community plugin marketplace for DeepSeek Harness.
 * Website: https://dsh-plugin.org
 * GitHub: https://github.com/dshplugin/dsh-plugin-hub
 *
 * 安装/卸载路由：校验目标后 spawn 官方 dsh CLI（见 services/install/install.ts），
 * 并回传捕获的结果。自定义安装只接受 npm 包名。
 */
import { type LoaderHandle } from '../services/install/install.ts';
import { type WebRoute, type WebServerService } from './shared.ts';
export declare function registerInstallRoutes(webServer: WebServerService, profile: string, loader: LoaderHandle | undefined): WebRoute[];
