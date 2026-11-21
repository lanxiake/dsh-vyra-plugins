import { type WebRoute, type WebServerService } from './shared.ts';
/** 宿主环境快照：提交 bug 时随 issue 附上，便于作者复现（前端 /env 端点返回）。 */
export declare function hostEnv(profile: string): Record<string, string | null>;
export declare function registerDiagnosticsRoutes(webServer: WebServerService, profile: string): WebRoute[];
