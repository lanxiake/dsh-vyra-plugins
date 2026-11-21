/**
 * dsh-workflow-lite — 实例里的一张图：修改时间变了重读，存下的旧版图读过的直接用。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/display/views/useDisplayImage
 */
import { type WorkflowLiteRpc } from '../../../rpc.ts';
/** 读回来的一张图，连同它是哪一次读的（`at`：换一版就换一层、淡入）。 */
interface LoadedImage {
    url: string | null;
    error: string | null;
    at: string | number | null;
}
/**
 * 实例里的一张图：`signal` 变了重读（现在的文件拿修改时间，`null` 不读）；`kept` 给了就读存下的那一版。
 */
export declare function useDisplayImage(rpc: WorkflowLiteRpc, instance: string, node: string, item: number, kept: number | null, signal: string | number | null): LoadedImage;
export {};
