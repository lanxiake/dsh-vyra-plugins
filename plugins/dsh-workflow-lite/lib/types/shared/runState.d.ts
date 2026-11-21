/**
 * dsh-workflow-lite — 运行状态：格式、校验、初始状态与派生量。
 *
 * 一个工作流实例一份 YAML 状态文件，执行期间由主 agent 维护。本模块**只处理解析后的普通对象**，不碰 YAML、不碰磁盘：
 * host（建实例、画布显示）、随 skill 分发的校验脚本、单测三边共用同一套规则。
 *
 * 校验结论是给模型看的——每条都写成「路径: 哪里不对（可选值…）」，照着就能改。
 *
 * @module @xiaoso/dsh-workflow-lite/shared/runState
 */
import { type ExecutionMode, type InputAnswer, type WorkflowDocument } from './types.ts';
export declare const RUN_STATE_VERSION = 1;
/** 整次执行的状态。 */
export declare const RUN_STATUSES: readonly ["pending", "running", "waiting", "done", "failed", "cancelled"];
export type RunStatus = (typeof RUN_STATUSES)[number];
/** 单个步骤的状态。 */
export declare const NODE_STATUSES: readonly ["pending", "running", "waiting", "done", "failed", "skipped"];
export type NodeStatus = (typeof NODE_STATUSES)[number];
/** 流水里的事件。 */
export declare const LOG_EVENTS: readonly ["start", "done", "failed", "waiting", "skipped", "resume", "transfer", "edit", "next", "note"];
export type LogEvent = (typeof LOG_EVENTS)[number];
/** 摘要的长度上限（码位）。建议一两句、200 字以内；超过这个数就是贴原文了。 */
export declare const SUMMARY_MAX = 500;
export interface NodeRunState {
    status: NodeStatus;
    /** 第几轮，从 1 起；开始过就必填。 */
    round?: number;
    startedAt?: string;
    finishedAt?: string;
    /** 谁做的：`self` / `subagent` / 队员名。 */
    by?: string;
    /** 这一轮的判定：必须是它出边 `when` 的值之一。 */
    verdict?: string;
    summary?: string;
    outputs?: string[];
    error?: string;
}
export interface RunLogEntry {
    at: string;
    /** 省略 = 整次执行的事件。 */
    node?: string;
    event: LogEvent;
    round?: number;
    verdict?: string;
    detail?: string;
    /** `user` = 用户在画布上改的（插件写入）；省略 = 主 agent。 */
    by?: 'user';
}
export interface RunState {
    version: typeof RUN_STATE_VERSION;
    instance: string;
    workflow: string;
    plan: string;
    /** 图快照的绝对路径。 */
    graph: string;
    mode: ExecutionMode;
    goal?: string;
    status: RunStatus;
    updatedAt: string;
    note?: string;
    /**
     * 用户指定的下一步（步骤 id）：有它时「接下来」就是这几步，不再按流转推。
     * 只有用户在画布上改；模型开始做其中一步时插件把它划掉，划完删掉这个字段。
     */
    next?: string[];
    /** 每个步骤一项（文件节点不在这里），键是步骤 id。 */
    nodes: Record<string, NodeRunState>;
    log: RunLogEntry[];
}
/** 身份字段：插件写，模型不改。 */
export declare const IDENTITY_KEYS: readonly ["version", "instance", "workflow", "plan", "graph", "mode"];
/** 校验要对照的图事实：有哪些步骤、各步骤的判定能取哪些值。 */
export interface RunGraphFacts {
    /** 步骤 id，按图里的顺序。 */
    steps: string[];
    /** 步骤 id → 它出边（到步骤的）`when` 的取值；没有条件出边的不在表里。 */
    verdicts: Record<string, string[]>;
}
export declare function graphFacts(document: WorkflowDocument): RunGraphFacts;
export interface RunStateIssue {
    /** 出问题的位置，例如 `nodes.review.status`；整份文件的问题是空串。 */
    path: string;
    message: string;
}
/** 身份字段要对得上的值（host 知道它建的是哪个实例）。 */
export interface RunStateExpect {
    instance?: string;
    workflow?: string;
    plan?: string;
}
export interface RunStateCheck {
    /** 没有问题时是规整后的状态；有问题时为 `null`。 */
    state: RunState | null;
    issues: RunStateIssue[];
}
/**
 * 校验一份解析后的状态。`facts` 给了就对照图快照（步骤齐不齐、判定取值对不对）；
 * `expect` 给了就核对身份字段。
 */
export declare function validateRunState(value: unknown, facts?: RunGraphFacts, expect?: RunStateExpect): RunStateCheck;
export interface InitialRunInput {
    instance: string;
    workflow: string;
    plan: string;
    graph: string;
    mode: ExecutionMode;
    goal?: string;
    /** 建立时刻（ISO 8601，带时区）。 */
    now: string;
    steps: readonly string[];
}
/** 插件建实例时写下的初始状态：整体 `pending`，每个步骤 `pending`，流水为空。 */
export declare function initialRunState(input: InitialRunInput): RunState;
/**
 * 本地时间的 ISO 8601（带时区偏移，不用 `Z`：人读状态文件时一眼就是本地钟点），**精确到毫秒**。
 *
 * 为什么要毫秒：「同一次调用写下的几步一起算」是靠流水里 `at` 相同认出来的，只精确到秒会把落到
 * 同一秒里的**两次**调用认成一次（连着改两下、模型连着写两次状态都会这样）。见 `shared/runCursor.ts`。
 */
export declare function isoNow(date?: Date): string;
export interface RunProgress {
    done: number;
    total: number;
    running: string[];
    failed: string[];
    waiting: string[];
}
export declare function progressOf(state: RunState): RunProgress;
/**
 * 走过的线：不要求模型记边，按状态推。
 * - 步骤 → 步骤：源做过、目标开始过；条件边还要求源在某一轮给过这个判定
 *   （流水里该步骤 `done` 的判定 + 当前的判定，所以循环里先 fail 后 pass 两条都算）。
 * - 步骤 ↔ 文件：步骤开始过就算。
 */
export declare function takenEdges(document: WorkflowDocument, state: RunState): Set<string>;
/** 实例索引 `instances.json` 里的一条（只有插件写）。 */
export interface InstanceRecord {
    id: string;
    workflow: string;
    planId: string;
    mode: ExecutionMode;
    goal?: string;
    /** 建立时的会话工作区。 */
    cwd?: string;
    /**
     * 状态文件的绝对路径。没有 = 这个实例**不记运行状态**：工作流没开「记录运行状态」时，
     * 画布上点「执行」照样建实例（图的快照 + 归属会话），只是没有状态文件。
     */
    statePath?: string;
    /** 它所属的会话（只有一个）；没有会话的调用建出来的实例没有归属。 */
    session?: string;
    /** 建立时刻（epoch 毫秒）。 */
    createdAt: number;
    /** 用户改了状态、但当时没能通知到模型时暂存的通知正文；交付后删掉。 */
    pendingNotice?: string;
}
/** 列表里的一项：索引记录 + 现读的状态摘要。 */
export interface InstanceSummary {
    id: string;
    workflow: string;
    planId: string;
    mode: ExecutionMode;
    goal?: string;
    cwd?: string;
    /** 没有 = 不记运行状态（见 `InstanceRecord.statePath`）。 */
    statePath?: string;
    session?: string;
    createdAt: number;
    /** 是不是请求方会话的当前实例。 */
    current: boolean;
    status?: RunStatus;
    done?: number;
    total?: number;
    updatedAt?: string;
    /** 状态文件读不出来：不见了，或格式不对。 */
    stateProblem?: 'missing' | 'invalid';
    /** 格式不对时具体哪里不对（最多 {@link SUMMARY_ISSUES_MAX} 条，列表里给人看原因）。 */
    stateIssues?: RunStateIssue[];
}
/** 实例列表里每个实例最多带几条状态文件的问题。 */
export declare const SUMMARY_ISSUES_MAX = 5;
/** 画布读一个实例：快照 + 解析后的状态 + 校验结论。 */
export interface InstanceView {
    summary: InstanceSummary;
    document: WorkflowDocument;
    /** 合法时的状态；不合法或文件不在时为 `null`（画布保留上一次合法的样子）。 */
    state: RunState | null;
    issues: RunStateIssue[];
    /** 状态文件的修改时间（epoch 毫秒）；文件不在时为 0。 */
    mtime: number;
    /**
     * 快照里每个资源的文件与文件夹在不在（资源 id → 按项的顺序：在 / 不在；网址、Skill、自定义是 `null`）。
     */
    files: Record<string, (boolean | null)[]>;
    /** 用户执行前对输入节点的回答（已补上默认值；输入 id → 回答）。 */
    answers: Record<string, InputAnswer>;
}
/** 用户在画布上的一处改动。`null` = 删掉这个字段。 */
export type EditValue = string | number | string[] | null;
export interface StateEdit {
    /** 字段路径：`['status']`、`['note']`、`['next']`、`['nodes', '<步骤 id>', '<字段>']`。 */
    path: string[];
    /** 改之前的值（缺省 / 没有 = `null`）：插件写之前核对文件里还是它，对不上就是冲突。 */
    from: EditValue;
    to: EditValue;
}
/** 用户能改的字段。 */
export declare const EDITABLE_TOP: readonly ["status", "note", "next"];
export declare const EDITABLE_NODE: readonly ["status", "round", "startedAt", "finishedAt", "verdict", "summary", "error"];
/** 一处改动的路径是不是用户能改的。 */
export declare function editablePath(path: readonly string[]): boolean;
/**
 * 用户把一个步骤改成某个状态时，连带要改的字段——让改完的状态照样合法、也合乎语义：
 * - `running`：从 `done` / `failed` / `pending` 进来算新的一轮（`round` +1），写开始时间；
 * - `done`：补上轮次与结束时间；
 * - `failed`：补上轮次、结束时间和失败原因（没有就写"用户标记为失败"）；
 * - `pending`（重跑）：清掉这一轮的结束时间与判定；
 * - `waiting` / `skipped`：只改状态（`waiting` 没轮次时补成 1）。
 * 返回的是字段 → 新值（`null` = 删掉）。
 */
export declare function statusFields(node: NodeRunState, to: NodeStatus, now: string): Partial<Record<(typeof EDITABLE_NODE)[number], EditValue>>;
