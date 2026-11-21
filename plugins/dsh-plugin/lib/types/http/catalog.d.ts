import { type WebRoute, type WebServerService } from './shared.ts';
export declare function profileDirectory(profile: string): string;
/** 读取安装进某 profile 的非官方依赖。 */
export declare function readInstalled(profile: string): Record<string, string>;
/** 读已装依赖实际落在磁盘上的仓库身份（`owner/repo`）：解析 node_modules/<name>/package.json
 *  的 repository 字段。已装 spec 可能是纯版本号（丢了仓库身份），但真实包元数据仍指向来源仓库，
 *  据此可区分「同名依赖其实是同一仓库的残留（应转 update）」还是「跨仓库包名冲突（应报错）」。
 *  读不到 / 解析不出返回 null（交给调用方按冲突处理）。 */
export declare function installedRepoOf(profile: string, name: string): string | null;
export declare function registerCatalogRoutes(webServer: WebServerService, profile: string): WebRoute[];
