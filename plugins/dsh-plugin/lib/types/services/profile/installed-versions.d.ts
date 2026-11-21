export interface InstalledVersionRecord {
    /** 安装时的目录最新 release 版本（无 release 的仓库为空串） */
    version: string;
    /** 安装时的仓库最近更新时间（ISO，GitHub pushed_at）；无 release 仓库的更新依据 */
    updatedAt: string;
    installedAt: string;
    /** 安装时记录在案的官方 npm 包名（repo → 包名映射）：目录数据可能未下发
     *  npmPackage（组织 scope 与 GitHub 用户名不一致），客户端据此把依赖 key 匹配回仓库 */
    npmPackage?: string;
}
export type InstalledVersionTable = Record<string, InstalledVersionRecord>;
export declare function versionsFilePath(profile: string): string;
/** 读取某 profile 的版本账本；缺失/损坏/字段不全一律归一化成完整形状。
 *  安装一开始只会写入 npm 包名映射（版本要等任务结束才知道），所以磁盘上可能存在
 *  只有 npmPackage 的记录 —— 原样下发会让客户端的版本比较拿到 undefined 直接抛错。 */
export declare function readInstalledVersions(profile: string): InstalledVersionTable;
/** 记录某仓库安装时的目录信号（版本 + 仓库更新时间）。 */
export declare function recordInstalledVersion(profile: string, repo: string, version: string, updatedAt: string): void;
/**
 * 记录某仓库解析出的 npm 包名。在 `/install` 时调用，让映射在任务完成前就存在；
 * 仓库尚未安装时也无害 —— 客户端只在依赖 key 真实存在时才把仓库当作已安装。
 */
export declare function recordResolvedNpmPackage(profile: string, repo: string, npmPackage: string): void;
/** 清除某仓库记录的版本（卸载时调用）。 */
export declare function removeInstalledVersion(profile: string, repo: string): void;
