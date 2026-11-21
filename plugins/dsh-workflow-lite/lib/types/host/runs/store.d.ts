/**
 * dsh-workflow-lite — 工作流实例：落盘位置与实例索引。
 *
 * 落盘位置：
 * - `<dataDir>/instances.json`：实例索引，全局一份，**只有插件写**（进程内写锁 + 原子写）；
 * - `<dataDir>/runs/<实例 id>/graph.json`：建实例那一刻的图快照，建立后只读；
 * - **实例目录** `<工作区>/.workflow-lite/runs/<实例 id>/`（拿不到工作区时退到 `<dataDir>/runs/<实例 id>/`）：
 *   `state.yaml` 状态（插件写：模型经 `state` 动作、用户经画布）、`tasks/` 各步骤的任务描述、
 *   `out/` 默认的产出根目录。早先的实例状态文件在 `runs/<实例 id>.yaml`，索引里记着绝对路径，照旧能读。
 *
 * 状态不进索引：进度的事实源只有状态文件，索引只记"在哪、属于谁"。
 *
 * @module @xiaoso/dsh-workflow-lite/host/runs/store
 */
import type { InstanceRecord } from '../../shared/runState.ts';
export declare const INSTANCES_FILE = "instances.json";
export declare const RUNS_DIR = "runs";
/** 工作区里放实例目录的地方（隐藏目录，里面放一个忽略一切的 `.gitignore`）。 */
export declare const WORKSPACE_RUNS_DIR: string;
/** 实例目录里放任务描述的子目录。 */
export declare const TASKS_DIR = "tasks";
/** 工作区里 `.workflow-lite/` 放一个忽略一切的 `.gitignore`（状态、任务描述、默认产出都不进版本库）。 */
export declare function ensureWorkspaceIgnore(cwd: string): Promise<void>;
export declare function instancesFile(dataDir: string): string;
export declare function runDir(dataDir: string, id: string): string;
export declare function snapshotFile(dataDir: string, id: string): string;
/** 用户执行前对输入节点的回答（输入 id → 回答），和图快照放在一起。 */
export declare function answersFile(dataDir: string, id: string): string;
/** 实例目录：有工作区就放工作区（沙箱 `workspace-write` 档能写，执行者也找得到），否则退回数据目录。 */
export declare function instanceDir(dataDir: string, id: string, cwd: string | undefined): string;
/** 状态文件：实例目录里的 `state.yaml`。 */
export declare function statePathFor(dataDir: string, id: string, cwd: string | undefined): string;
/** 实例 id：`<YYYYMMDD>-<HHmmss>-<4 位十六进制>`，按时间天然有序、能当文件名。 */
export declare function newInstanceId(date?: Date): string;
/** 实例 id 的形状（RPC / 工具入参先过这一道，再拿去拼路径）。 */
export declare function isInstanceId(value: unknown): value is string;
export interface InstanceIndex {
    version: 1;
    instances: InstanceRecord[];
    /** 会话 id → 它的当前实例 id。 */
    current: Record<string, string>;
}
/**
 * 实例索引的读写。写一律走 {@link update}：进程内串行（读 → 改 → 原子写），
 * 不会有两次修改互相覆盖。
 */
export declare class InstanceStore {
    private chain;
    private readonly dataDir;
    constructor(dataDir: () => string);
    get file(): string;
    /** 读索引。文件不在 = 空；解析不了就把它挪到一边（`instances.json.broken-<时间>`）再当空的。 */
    read(): Promise<InstanceIndex>;
    /** 在写锁里读 → 改 → 写回。`change` 返回 `false` 表示没改，不写盘。 */
    update<T>(change: (index: InstanceIndex) => T | Promise<T>): Promise<T>;
}
