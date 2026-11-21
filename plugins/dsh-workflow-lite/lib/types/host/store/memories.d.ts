/**
 * dsh-workflow-lite — 记忆库：`<dataDir>/memories/`。
 *
 * 一条记忆 = `<id>.json`（元数据）+ `<id>/`（一份 skill 文件夹，图里写 `{memory}/<id>`，执行时模型直接读写）。
 * 本模块管增删改、列表（连同哪些工作流在用）和只读浏览；版本在 `memoryVersions.ts`。
 * 浏览走实例文件夹浏览的那几样（`runs/files.ts`），同样只许往下走、软链指出去的不认。
 *
 * @module @xiaoso/dsh-workflow-lite/host/store/memories
 */
import { type MemoryEntry, type MemoryMeta } from '../../shared/memoryLib.ts';
import type { MemoryBrowseRequest, MemoryCreateRequest, MemoryImageRequest, MemoryUpdateRequest } from '../../shared/wire/memory.ts';
import type { RunDirResponse, RunFileResponse, RunImageResponse } from '../../shared/wire/run.ts';
import { type Outcome } from './repoResult.ts';
import type { Repository } from './repository.ts';
export interface MemoryDeps {
    dataDir: string;
    /** 列「在用的工作流」要扫各工作流当前存的那份。 */
    repository: Pick<Repository, 'list' | 'load'>;
    now?: () => number;
}
export declare function serialMemory<T>(dataDir: string, id: string, task: () => Promise<T>): Promise<T>;
/** id 合不合规矩（同工作流名）。合规回 `null`。 */
export declare function memoryIdProblem(id: string): string | null;
/** 读一条记忆的元数据：不存在回 `null`，读不出来回 `'invalid'`。 */
export declare function readMemoryMeta(dataDir: string, id: string): Promise<MemoryMeta | 'invalid' | null>;
/** 库里有没有这条记忆（元数据在就算，读不出来也算）。 */
export declare function hasMemory(dataDir: string, id: string): Promise<boolean>;
/** 各工作流当前存的那份引用了哪些记忆：记忆 id 的 `idKey` → 工作流名（按名字排）。 */
export declare function memoryUsage(repository: Pick<Repository, 'list' | 'load'>): Promise<Map<string, string[]>>;
/** 一条记忆的列表行；不存在回 `not_found`。 */
export declare function memoryEntry(deps: MemoryDeps, id: string): Promise<Outcome<MemoryEntry>>;
/** 库里的全部记忆，按名称排。 */
export declare function listMemories(deps: MemoryDeps): Promise<MemoryEntry[]>;
/** 新建一条：挑一个没被占的 id（建议的撞了加序号），写元数据、建空文件夹。 */
export declare function createMemory(deps: MemoryDeps, request: MemoryCreateRequest): Promise<Outcome<MemoryEntry>>;
/** 改名称、描述。 */
export declare function updateMemory(deps: MemoryDeps, request: MemoryUpdateRequest): Promise<Outcome<MemoryEntry>>;
/** 删一条：元数据、文件夹、版本一起删。引用它的记忆卡留着（会报「记忆不存在」）。 */
export declare function deleteMemory(deps: MemoryDeps, id: string): Promise<Outcome<{
    removed: true;
}>>;
/**
 * 导入时直接写一份元数据（id 已经定好、没被占）：类型、名称、描述照包里的，时间按现在。
 * 文件夹由调用方写。
 */
export declare function writeMemoryMeta(dataDir: string, meta: MemoryMeta): Promise<void>;
/** 导入、新建时挑一个没被占的 id：`base` 没被占就是它，否则加序号。 */
export declare function freeMemoryId(dataDir: string, base: string): Promise<string | null>;
export declare function memoryDir(dataDir: string, request: MemoryBrowseRequest): Promise<Outcome<RunDirResponse>>;
export declare function memoryFile(dataDir: string, request: MemoryBrowseRequest): Promise<Outcome<RunFileResponse>>;
/** 一张图：`src` 是 Markdown 里的相对路径（按文档所在目录解析，只许落在记忆文件夹里）；不给就是目标自己。 */
export declare function memoryImage(dataDir: string, request: MemoryImageRequest): Promise<Outcome<RunImageResponse>>;
