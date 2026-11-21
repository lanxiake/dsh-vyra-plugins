/**
 * dsh-workflow-lite — 画布上展示着的资源项：隔一会儿问一次它们在不在、什么时候改的。
 *
 * 实例视图问这个实例（`run/stat`）；模板视图问「上次执行」——这个工作流最近哪个实例真的生成了它
 * （`run/latest`），模板卡片上就显示那一份，没有就是草图。实例视图从不看别的实例。
 * 只问开着展示的那几项，只 stat 不读内容；修改时间变了，展示卡才去重读内容。页面藏起来时不问。
 *
 * @module @xiaoso/dsh-workflow-lite/client/app/useDisplayStats
 */
import type { WorkflowDocument } from '../../shared/types.ts';
import { type RunLatestOutput } from '../../shared/wire/run.ts';
import type { WorkflowLiteRpc } from '../rpc.ts';
export interface DisplayStat {
    exists: boolean;
    size: number;
    mtime: number;
    /** 存下了几版（循环迭代时每一轮的样子）；模板视图的「上次执行」不看各版，是 0。 */
    versions: number;
    /** 各版每变一次加一：变了再去读各版。 */
    revision: number;
}
/** 一项的身份串（资源 id 不分大小写）。 */
export declare function displayKey(node: string, item: number): string;
/** 图里开着展示、展示的是文件或文件夹的那几项（`value` 是路径原文）。 */
export declare function displayTargets(doc: WorkflowDocument | null): {
    node: string;
    item: number;
    value: string;
}[];
/**
 * 实例视图：这个实例里每一项此刻的样子。`interval` 跟着实例的轮询走（结束了的实例问得慢些）。
 * @returns 按 {@link displayKey}；还没问到的不在表里。
 */
export declare function useDisplayStats(rpc: WorkflowLiteRpc, instance: string, doc: WorkflowDocument | null, interval?: number): Readonly<Record<string, DisplayStat>>;
/**
 * 模板视图：每一项「上次执行」生成的那一份（哪个实例、那边的第几项、修改时间）。
 * @returns 按模板里的 {@link displayKey}；哪个实例都没生成的不在表里。
 */
export declare function useLatestOutputs(rpc: WorkflowLiteRpc, workflow: string | null, doc: WorkflowDocument | null): Readonly<Record<string, RunLatestOutput>>;
