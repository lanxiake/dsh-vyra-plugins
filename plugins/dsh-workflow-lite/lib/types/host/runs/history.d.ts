/**
 * dsh-workflow-lite — 实例里产出的各版：写它的步骤每一轮做完存一份，循环迭代时能回头看每一轮写成了什么样。
 *
 * 什么时候存（{@link historyPlan}，看步骤状态的前后变化）：
 * - 写它的步骤一轮做完（变成完成或失败）：存这一刻的样子，记下步骤、第几轮、结果；
 * - 写它的步骤开始一轮、而这份文件还一版都没存过、却已经在了（在原文件上更新的，或上回留下的）：先存一份原样；
 * - 步骤给出判定（完成时带 `verdict`）：记到它读的、写的文件的最近一版上，判定把流程领回去重做的标成 `again`。
 * 模型自己写文件，插件看不见每一次写；只在轮次的边界上存，中途写了一半的样子不会混进来。
 *
 * 存在哪：数据目录 `runs/<实例>/history/`，不放工作区（模型不会翻到旧版，删实例连它一起删）。
 * `index.json` 记每份文件的各版；内容按哈希存一份（`<哈希>.<扩展名>`），各版、各文件一样的只存一份。
 *
 * 存多少：一份文件最多 {@link RUN_HISTORY_VERSIONS_MAX} 版（超了删中间的，第一版留着），一份超过
 * {@link RUN_HISTORY_FILE_MAX} 的不存，整个实例最多 {@link RUN_HISTORY_INSTANCE_MAX}（超了从版数最多的那份删中间的）。
 * 文件夹不存。只有插件里执行时才有（导出成 skill 的执行没有插件看着）。
 *
 * @module @xiaoso/dsh-workflow-lite/host/runs/history
 */
import type { NodeRunState } from '../../shared/runState.ts';
import type { WorkflowDocument } from '../../shared/types.ts';
import { type RunHistoryResponse, type RunVersion } from '../../shared/wire/run.ts';
export declare const HISTORY_DIR = "history";
export declare function historyDir(dataDir: string, id: string): string;
/** 一项的身份串（和画布上的 `displayKey` 一样：资源 id 不分大小写）。 */
export declare function historyKey(node: string, item: number): string;
/** 索引里的一版：给前端的那些，加上内容在哪。 */
interface HistoryEntry extends RunVersion {
    hash: string;
    ext: string;
}
interface HistoryFile {
    /** 下一版的版本号。 */
    next: number;
    /** 每变一次（多存一版、记了判定）加一：前端拿它判断要不要重读。 */
    rev: number;
    dropped: number;
    entries: HistoryEntry[];
}
/** 资源里的一项（文件）：哪个资源、第几项。 */
export interface HistoryItem {
    node: string;
    item: number;
}
/** 要存的一份。`ifEmpty`：这份一版都没存过才存（开始前的原样）。 */
export interface HistoryCapture extends HistoryItem {
    step: string;
    round: number;
    phase: RunVersion['phase'];
    ifEmpty?: true;
}
/** 要记到最近一版上的判定。 */
export interface HistoryVerdict extends HistoryItem {
    step: string;
    value: string;
    again: boolean;
}
export interface HistoryPlan {
    captures: HistoryCapture[];
    verdicts: HistoryVerdict[];
}
/** 步骤给了这个判定，流程会不会绕回它自己（顺着判定那条线往下走，能走回来）。 */
export declare function verdictLoopsBack(document: WorkflowDocument, step: string, value: string): boolean;
/**
 * 步骤状态从 `before` 变成 `after`，要存哪几份、记哪几条判定（只看图和状态，不碰磁盘）。
 * 一次改了几个步骤时：先存各自开始前的原样，再存做完的，最后记判定（判定落在刚存的那版上）。
 */
export declare function historyPlan(document: WorkflowDocument, before: Readonly<Record<string, NodeRunState>>, after: Readonly<Record<string, NodeRunState>>): HistoryPlan;
/** 一个实例的各版：读、存、删。写都在实例的写入队列里（状态、用户改动同一条队），这里不另加锁。 */
export declare class RunHistory {
    private readonly dataDir;
    constructor(dataDir: () => string);
    private dir;
    private read;
    /** 每项存了几版、变过几次（`run/stat` 用）。 */
    counts(id: string, items: readonly HistoryItem[]): Promise<{
        versions: number;
        revision: number;
    }[]>;
    list(id: string, node: string, item: number): Promise<RunHistoryResponse>;
    /** 存下的第 `v` 版在哪（没有这一版是 `null`）。 */
    locate(id: string, node: string, item: number, v: number): Promise<{
        full: string;
        version: RunVersion;
    } | null>;
    /**
     * 照 `plan` 存、记判定。`where` 把一项换成磁盘上的位置（拿不到就跳过）。
     * 存不下（读不了、太大）的跳过，不影响状态本身——调用方吞掉这里的错。
     */
    apply(id: string, plan: HistoryPlan, where: (item: HistoryItem) => string | null, now?: number): Promise<void>;
    /** 把一份文件的内容按哈希放进去（已经有了就不再写）；读不了、不是文件、太大回 `null`。 */
    private store;
    /** 删掉索引里已经没人用的内容。 */
    private sweep;
    /** 删掉一个实例存的所有版本。 */
    clear(id: string): Promise<void>;
}
/** 整个实例超了 {@link RUN_HISTORY_INSTANCE_MAX}：从版数最多的那份删中间的（第一版、最近一版都留着）。 */
export declare function trimToBudget(index: {
    files: Record<string, HistoryFile>;
}, budget?: number): void;
export {};
