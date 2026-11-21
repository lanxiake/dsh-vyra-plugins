/**
 * dsh-workflow-lite — 导入导出的暂存区：`<dataDir>/.pack/<token>/`。
 *
 * zip 在前后端之间分块传（{@link PACK_CHUNK_BYTES} 一块，base64），不赌宿主对单条消息的上限：
 * - 导出：主机把 zip 写成 `out.zip`，前端按偏移一块块取（{@link readChunk}）；
 * - 导入：前端一块块传上来，主机接在 `in.zip` 后面（{@link appendChunk}），读清单、落盘时再解开。
 *
 * 用完就删；每次开新暂存时顺手清掉放了一天以上的（上次中途关掉页面留下的）。
 *
 * @module @xiaoso/dsh-workflow-lite/host/pack/staging
 */
import type { Outcome } from '../store/repoResult.ts';
export declare const OUT_ZIP = "out.zip";
export declare const IN_ZIP = "in.zip";
/** 一个暂存目录；token 不对回 `null`（不让拼出暂存区外的路径）。 */
export declare function stageDir(dataDir: string, token: string): string | null;
/** 开一个新的暂存目录（顺手清掉过期的）。 */
export declare function newStage(dataDir: string): Promise<{
    token: string;
    dir: string;
}>;
/** 清掉放了一天以上的暂存。 */
export declare function sweep(dataDir: string, now?: number): Promise<void>;
export declare function discard(dataDir: string, token: string): Promise<void>;
/** 写下导出的 zip。 */
export declare function writeOut(dir: string, zip: Uint8Array): Promise<void>;
/** 取导出的 zip 的一块。 */
export declare function readChunk(dataDir: string, token: string, offset: number): Promise<Outcome<{
    data: string;
    next: number | null;
}>>;
/** 收导入的一块：必须正好接在已收到的后面（重复、跳块都拒绝）。 */
export declare function appendChunk(dataDir: string, token: string | undefined, offset: number, data: string): Promise<Outcome<{
    token: string;
    received: number;
}>>;
/** 读出上传完的 zip。 */
export declare function readIn(dataDir: string, token: string): Promise<Outcome<Uint8Array>>;
