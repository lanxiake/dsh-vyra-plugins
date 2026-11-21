/**
 * dsh-workflow-lite — 工作流包在浏览器与主机之间搬：导出时一块块取回来存成下载，导入时一块块传上去。
 *
 * 一块 {@link PACK_CHUNK_BYTES}（base64 之前），不赌宿主对单条消息的上限。
 *
 * @module @xiaoso/dsh-workflow-lite/client/app/packTransfer
 */
import type { WorkflowLiteRpc } from '../rpc.ts';
/** 进度：已经搬了多少、一共多少（字节）。 */
export type Progress = (done: number, total: number) => void;
/** 把主机暂存的包取回来；取完（或失败）都让主机删掉暂存。 */
export declare function downloadPack(rpc: WorkflowLiteRpc, token: string, total: number, progress?: Progress): Promise<Uint8Array>;
/** 交给浏览器存成文件。 */
export declare function saveFile(bytes: Uint8Array, fileName: string): void;
/** 把用户选的文件传到主机暂存，回暂存编号。 */
export declare function uploadPack(rpc: WorkflowLiteRpc, file: Blob, progress?: Progress): Promise<string>;
