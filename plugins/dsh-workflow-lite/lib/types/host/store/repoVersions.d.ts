/**
 * dsh-workflow-lite — 仓储的版本部分：列 / 存 / 读 / 切换 / 改说明 / 删除版本，以及导入工作流包里的版本。
 *
 * 版本文件的形状在 `versions.ts`；这里管流程：写类动作全程在锁内，
 * 切换版本前会把还没存成版本的现在内容自动存一份，导入时先查完再写。
 * @module @xiaoso/dsh-workflow-lite/host/store/repoVersions
 */
import type { VersionEntry, WorkflowDocument } from '../../shared/types.ts';
import type { RepoCore } from './repoCore.ts';
import { type Outcome } from './repoResult.ts';
/** 导入的一个版本。 */
export interface ImportVersion {
    n: number;
    createdAt: number;
    note: string;
    document: WorkflowDocument;
}
export interface ImportRequest {
    mode: 'new' | 'merge';
    name: string;
    /** 按编号从小到大。 */
    versions: ImportVersion[];
    /** 导入后工作流的内容。 */
    current: WorkflowDocument;
    /** 检查都过了、写版本与工作流之前做的事；拿到的是归一后的图名。 */
    prepare?: (name: string) => Promise<Outcome<void>>;
}
export interface ImportResult {
    name: string;
    /** 写下的版本号，和 `request.versions` 一一对应（重复的那几个不在里面）。 */
    versions: number[];
    /** 和已有版本内容一样、没再存的（包里的编号）。 */
    duplicates: number[];
}
/** 版本部分用到的核心能力。 */
type VersionsCore = Pick<RepoCore, 'dataDir' | 'withLock' | 'ensureLayout' | 'resolveName' | 'validate' | 'rememberBaseline'>;
export declare class VersionStore {
    private readonly core;
    constructor(core: VersionsCore);
    listVersions(workflow: string): Promise<Outcome<VersionEntry[]>>;
    saveVersion(workflow: string, note: string): Promise<Outcome<VersionEntry>>;
    readVersion(workflow: string, n: number): Promise<Outcome<{
        entry: VersionEntry;
        document: WorkflowDocument;
    }>>;
    restoreVersion(workflow: string, n: number): Promise<Outcome<{
        hash: string;
        saved: VersionEntry | null;
    }>>;
    noteVersion(workflow: string, n: number, note: string): Promise<Outcome<VersionEntry>>;
    deleteVersion(workflow: string, n: number): Promise<Outcome<{
        removed: true;
    }>>;
    importWorkflow(request: ImportRequest): Promise<Outcome<ImportResult>>;
    /** 磁盘上现在那份：图名、内容键（比版本用）与文档；坏了的图 `document` / `key` 是 `null`。 */
    private currentContent;
    private findVersion;
    /** 写一个新版本（序号接着现有最大的往上数）。**必须在 `withLock` 内调用**。 */
    private writeVersion;
}
export {};
