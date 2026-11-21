/**
 * dsh-workflow-lite — 记忆的版本：`<dataDir>/memory-versions/<id>/`。
 *
 * 一个版本 = `<n>.json`（元信息）+ `<n>/`（那一刻整个记忆文件夹的拷贝）：
 *
 * ```json
 * { "format": 1, "n": 3, "createdAt": 1759650000000, "note": "跑通了审查", "hash": "…", "files": 4, "bytes": 2310 }
 * ```
 *
 * 平时只有手动存；恢复到别的版本之前，现在的内容没存成版本就先自动存一份（多一个 `autoBefore`）。
 * 内容（文件清单 + 每个文件的哈希）和已有的某个版本一样就不再存。拷贝跳过 `.git`、`node_modules` 和软链，
 * 超过导出包的上限就不存。和工作流的版本线各自独立：恢复工作流版本不动记忆。
 *
 * @module @xiaoso/dsh-workflow-lite/host/store/memoryVersions
 */
import type { MemoryVersionEntry } from '../../shared/memoryLib.ts';
import { type Outcome } from './repoResult.ts';
export interface MemoryVersionOptions {
    now?: () => number;
}
/** 一条记忆的版本，新的在前。 */
export declare function listMemoryVersions(dataDir: string, id: string): Promise<Outcome<MemoryVersionEntry[]>>;
/** 把现在的文件夹存成新版本；`skipSame` 时内容没变回 `null`（连同工作流一起存时用）。 */
export declare function saveMemoryVersion(dataDir: string, id: string, note: string, options?: MemoryVersionOptions & {
    skipSame?: boolean;
}): Promise<Outcome<MemoryVersionEntry | null>>;
/** 恢复到第 `n` 版：现在的内容没存成版本就先自动存一份（`saved`），再整个换掉文件夹。 */
export declare function restoreMemoryVersion(dataDir: string, id: string, n: number, options?: MemoryVersionOptions): Promise<Outcome<{
    saved: MemoryVersionEntry | null;
}>>;
/** 改版本说明。 */
export declare function noteMemoryVersion(dataDir: string, id: string, n: number, note: string): Promise<Outcome<MemoryVersionEntry>>;
/** 删一个版本（元信息和拷贝）。 */
export declare function deleteMemoryVersion(dataDir: string, id: string, n: number): Promise<Outcome<{
    removed: true;
}>>;
