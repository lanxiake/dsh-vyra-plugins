/**
 * dsh-workflow-lite — 实例服务各部分共用的底座：依赖、每个实例的写入排队、快照与状态文件的读取、摘要、流水。
 *
 * 建立、读取、模型记进度、用户的改动四部分（`runSetup` / `runReader` / `runProgress` / `runEdits`）
 * 各自只取自己要用的那几项（`Pick<RunCore, …>`）；同一个实例的写入都经 `serial` 排在同一条队里。
 *
 * @module @xiaoso/dsh-workflow-lite/host/runs/runCore
 */
import { type InstanceRecord, type InstanceSummary, type NodeRunState, type RunState, type RunStateIssue } from '../../shared/runState.ts';
import type { InputAnswer, ValidationProblem, WorkflowDocument } from '../../shared/types.ts';
import { type CompileBundle } from '../plan.ts';
import type { Outcome } from '../store/repoResult.ts';
import { RunHistory } from './history.ts';
import { type InstanceIndex, InstanceStore } from './store.ts';
/** 把一条通知送进会话（`steer`：空闲就开一轮，正在跑就排进下一步）。送到了回 `true`。 */
export type Notify = (session: string, text: string, summary: string) => Promise<boolean>;
export interface RunServiceDeps {
    dataDir: () => string;
    /** 校验一张图（计划的「注意事项」要它）；不给就当没有警告。 */
    validate?: (document: WorkflowDocument, workflow: string) => ValidationProblem[];
    notify?: Notify;
}
/** 会话信息：工具从执行上下文取，画布从槽位给。 */
export interface SessionRef {
    id?: string;
    cwd?: string;
}
export declare const fail: <T>(code: "not_found" | "invalid_args" | "blocked" | "conflict" | "io_error", message: string, detail?: Record<string, unknown>) => Outcome<T>;
/** 状态 → YAML 文本（长摘要不折行，纯数字的字符串自动加引号）。 */
export declare function stateText(state: RunState): string;
export declare function isRecordLike(value: unknown): value is Record<string, unknown>;
export declare class RunCore {
    readonly store: InstanceStore;
    /** 产出的各版（循环迭代时每一轮写成了什么样）。 */
    readonly history: RunHistory;
    readonly deps: RunServiceDeps;
    /** 每个实例的写入排队（模型的 `state`、用户的保存、插件记流水不会互相覆盖）。 */
    private readonly queues;
    constructor(deps: RunServiceDeps);
    /** 同一个实例的写入一个接一个来。 */
    serial<T>(id: string, task: () => Promise<T>): Promise<T>;
    problemsOf(document: WorkflowDocument, workflow: string): ValidationProblem[];
    /** 实例建立时用户给的回答（没有输入节点、或文件不在时是空的）。 */
    answersOf(record: InstanceRecord): Promise<Record<string, InputAnswer>>;
    /** 按实例的快照出计划，把任务描述写进实例目录。 */
    planOf(record: InstanceRecord, document: WorkflowDocument, cwd: string | undefined): Promise<Outcome<CompileBundle>>;
    snapshot(record: InstanceRecord): Promise<WorkflowDocument | null>;
    /** 找文件用的快照：工作流目录、记忆库里的（`{workflow}/…`、`{memory}/…`）换成绝对路径（快照本身不改）。 */
    withAssets(record: InstanceRecord, document: WorkflowDocument): WorkflowDocument;
    /** 快照里一项（文件）在磁盘上的位置；`located` 是 {@link withAssets} 过的快照。不是路径项是 `null`。 */
    itemFull(record: InstanceRecord, located: WorkflowDocument, node: string, item: number): string | null;
    /**
     * 步骤状态变了：照前后的样子存下这一轮的产出（{@link historyPlan}）。存不下不影响状态本身。
     * 在实例的写入队列里调（和下一次改状态不会交错）。
     */
    keepHistory(record: InstanceRecord, document: WorkflowDocument, before: unknown, after: Readonly<Record<string, NodeRunState>>): Promise<void>;
    /** 读并校验状态文件。`document` 给了就对照快照。 */
    readState(record: InstanceRecord, document?: WorkflowDocument | null): Promise<{
        state: RunState | null;
        issues: RunStateIssue[];
        mtime: number;
        text: string | null;
    }>;
    summarize(record: InstanceRecord, index: InstanceIndex, session: string | undefined): Promise<InstanceSummary>;
    /** 插件替用户 / 自己往状态文件追加一条流水（转移、恢复）。文件不合法就不动它。 */
    appendLog(record: InstanceRecord, entry: {
        event: 'transfer' | 'resume';
        detail?: string;
    }): Promise<void>;
    private appendLogNow;
}
