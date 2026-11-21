/**
 * dsh-workflow-lite — 实例的读取面：实例列表、画布视图、资源项状态、产出文件 / 图片 / 文件夹 / 各版。
 *
 * @module @xiaoso/dsh-workflow-lite/host/runs/runReader
 */
import type { InstanceSummary, InstanceView } from '../../shared/runState.ts';
import { type RunDirResponse, type RunFileResponse, type RunHistoryResponse, type RunImageResponse, type RunLatestResponse, type RunLinesRequest, type RunLinesResponse, type RunStatResponse } from '../../shared/wire/run.ts';
import type { Outcome } from '../store/repoResult.ts';
import { type RunFileTarget } from './files.ts';
import { type RunCore } from './runCore.ts';
/** `run/load` 带 `since` 且文件没变时的回答。 */
export interface Unchanged {
    unchanged: true;
    mtime: number;
}
type ReaderCore = Pick<RunCore, 'store' | 'history' | 'deps' | 'snapshot' | 'withAssets' | 'itemFull' | 'readState' | 'summarize' | 'answersOf'>;
/** 读：列实例、给画布读一个实例、实例里的产出文件 / 图片 / 文件夹 / 各版。 */
export declare class RunReader {
    private readonly core;
    /** 带筛选按行读的工作线程（用到才起）。 */
    private scanner;
    constructor(core: ReaderCore);
    /** 列实例：`all` 为假时只列 `session` 的。新的在前。 */
    list(session: string | undefined, all: boolean): Promise<InstanceSummary[]>;
    /** 会话的当前实例 id（没有就 `undefined`）。 */
    currentOf(session: string): Promise<string | undefined>;
    /** 读一个实例给画布。`since` 等于文件当前的修改时间时只回"没变"。 */
    view(id: string, session: string | undefined, since?: number): Promise<Outcome<InstanceView | Unchanged>>;
    /**
     * 快照里几个资源项现在在不在、多大、什么时候改的（画布上展示着的卡隔一会儿问一次）。
     * 只 stat，不读内容；项不在快照里、不是路径、读不到的一律当作不在。
     */
    stat(id: string, targets: readonly {
        node: string;
        item: number;
    }[]): Promise<Outcome<RunStatResponse>>;
    /**
     * 模板画布上的「上次执行」：这个工作流最近建的 {@link RUN_LATEST_SCAN} 个实例里，同一个资源里同一个路径的文件
     * 真的生成了的，取修改时间最新的。实例的图改过（资源换了 id、路径改了）就认不出，当没有。
     */
    latest(workflow: string, targets: readonly {
        node: string;
        value: string;
    }[]): Promise<RunLatestResponse>;
    /** 看实例里的一份产出文件（文件面板与查看框）。 */
    file(id: string, target: RunFileTarget, options?: {
        tail?: boolean;
    }): Promise<Outcome<RunFileResponse>>;
    /**
     * 日志、纯文本按行读（`run/lines`）：只读要显示的那几行；带筛选的在工作线程里扫（正则太慢就停下回错误）。
     * 存下的旧版读那一版的内容。
     */
    lines(id: string, target: {
        node: string;
        item: number;
        sub?: string;
        version?: number;
    }, request: Omit<RunLinesRequest, 'id' | 'node' | 'item' | 'sub' | 'version'>): Promise<Outcome<RunLinesResponse>>;
    /**
     * 实例里的一张本地图片：`src` 是 Markdown 里写的相对路径，按文档所在目录解析（见 {@link resolveImageRef}）；
     * 不给 `src` 就是目标文件自己（文件夹里点开一张图）。
     */
    image(id: string, target: RunFileTarget, src?: string): Promise<Outcome<RunImageResponse>>;
    /** 看资源里一个文件夹（或它下面的子文件夹）里有什么：只列这一层，名字、是不是目录、大小、修改时间。 */
    dir(id: string, target: {
        node: string;
        item: number;
        sub?: string;
    }): Promise<Outcome<RunDirResponse>>;
    /** 把目标解析到实例里的一个位置（实例、快照、路径一并查过）。 */
    private resolveTarget;
    /** 一份文件存下的各版（只认快照里的文件项）。 */
    versions(id: string, node: string, item: number): Promise<Outcome<RunHistoryResponse>>;
    /**
     * 找到并读出实例里的一份文件（连同实例记录，算图片路径要用它的工作区）。
     * `source` 是真正读的那份：平时就是 `file.path`，看存下的旧版时是那一版的内容（`file` 里的路径还是原文件）。
     */
    private locateFile;
}
export {};
