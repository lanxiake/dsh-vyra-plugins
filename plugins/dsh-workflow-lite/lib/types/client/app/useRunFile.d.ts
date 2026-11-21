/**
 * dsh-workflow-lite — 读实例里的一份产出文件（文件面板的预览、查看框）。
 *
 * @module @xiaoso/dsh-workflow-lite/client/app/useRunFile
 */
import type { RunDirResponse, RunFileResponse, RunHistoryResponse } from '../../shared/wire/run.ts';
import { type WorkflowLiteRpc } from '../rpc.ts';
import { type ReadSignal } from './readCache.ts';
/**
 * 要看哪份：快照里某个资源的第几项（文件夹项可以再带 `sub`：文件夹里的相对路径；文件项可以带 `version`：
 * 存下的第几版），或实例工作区里的相对路径。`tail`：太大时读最后一截（日志），不说「太大」。
 */
export type FileTarget = {
    node: string;
    item: number;
    sub?: string;
    version?: number;
    tail?: boolean;
} | {
    path: string;
};
export interface RunFile {
    file: RunFileResponse | null;
    error: string | null;
    loading: boolean;
    /** 最近读完（成功或失败）的是哪个目标（{@link fileTargetKey}）：和现在要看的对得上，`file` / `error` 才是它的。 */
    settled: string;
    reload(): void;
}
/**
 * @param version - 变了就重读（文件面板拿"文件在不在 + 状态文件修改时间"当版本：模型写完文件通常也会更新状态）。
 *   给了（不是 0）就按它记进缓存：同一目标、同一版本再挂上时直接用；不给就每次挂上都重读。
 */
export declare function useRunFile(rpc: WorkflowLiteRpc, instance: string, target: FileTarget | null, version?: string | number): RunFile;
/** 一个读取目标的身份串（`useRunFile` 的 `settled` 就是它）。 */
export declare function fileTargetKey(target: FileTarget | null): string;
/**
 * 一份产出存下的各版（`run/history`）。`revision` 是 `run/stat` 报的变化次数：变了才重问，`0`（一版都没有）就不问。
 * `null` = 还没问到（或一版都没有）。
 */
export declare function useRunHistory(rpc: WorkflowLiteRpc, instance: string, target: {
    node: string;
    item: number;
} | null, revision: number): RunHistoryResponse | null;
/** 文件夹的一层（`useBrowseDir` 的结果）。 */
export interface RunDir {
    /** 最近一次读到的（换层时读回来之前还是上一层的，免得闪一下空）；还没读到过是 `null`。 */
    dir: RunDirResponse | null;
    error: string | null;
    /** 正在读 `sub` 这一层（`dir` 可能还是上一层的）。 */
    loading: boolean;
}
/** 一张图读回来的样子：`url` 是 data URL。 */
export interface RunImage {
    url: string | null;
    error: string | null;
}
/**
 * 把目标文件当图片读（`run/image` 不带 `src`）。同一个目标读过的先用缓存；
 * 换目标时先清成"读取中"，不让上一张闪一下。`target` 为 `null` 就什么也不读。
 */
export declare function useRunImage(rpc: WorkflowLiteRpc, instance: string, target: FileTarget | null): RunImage;
/**
 * 这份文档里相对路径的图片怎么读（交给 Markdown）：按文档所在目录去实例里读，读回来是 data URL。
 * 同一份文档里同一张图只读一次；换了文档就换一份缓存。
 * @param signal - 文档的版本（修改时间）：给了就跨挂载记着读过的图，文档变了重读；不给就只在这次挂载里记。
 */
export declare function useRunImages(rpc: WorkflowLiteRpc, instance: string, target: FileTarget, signal?: ReadSignal): (src: string) => Promise<string>;
