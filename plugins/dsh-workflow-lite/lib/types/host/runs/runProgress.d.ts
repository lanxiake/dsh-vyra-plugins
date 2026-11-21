/**
 * dsh-workflow-lite — 模型记进度：工具的 `state` 动作看或改实例的运行状态。
 *
 * @module @xiaoso/dsh-workflow-lite/host/runs/runProgress
 */
import { type CursorStep, type NextStep } from '../../shared/runCursor.ts';
import { type NodeRunState, type NodeStatus, type RunLogEntry, type RunStatus } from '../../shared/runState.ts';
import type { Outcome } from '../store/repoResult.ts';
import { type RunCore, type SessionRef } from './runCore.ts';
/** 模型经 `state` 动作对一个步骤的改动。 */
export interface NodePatch {
    status?: NodeStatus;
    summary?: string;
    outputs?: string[];
    verdict?: string;
    error?: string;
    by?: string;
}
/** 模型经 `state` 动作的一次改动；什么都不给 = 只看。 */
export interface StatePatch {
    status?: RunStatus;
    /** 空串 = 清掉。 */
    note?: string;
    nodes?: Record<string, NodePatch>;
    /** 追加一条说明（流水里记成 `note`）。 */
    log?: string;
}
/** `state` 动作回给模型的东西：当前状态的要点。 */
export interface StateReport {
    instance: string;
    workflow: string;
    status: RunStatus;
    note?: string;
    updatedAt: string;
    progress: {
        done: number;
        total: number;
        running?: string[];
        waiting?: string[];
        failed?: string[];
    };
    nodes: Record<string, NodeRunState>;
    /** 最后执行的步骤（做完了、下游还没接上的；都接上了就是最近做完的那步）。 */
    last: CursorStep[];
    /** 接下来该做的步骤（按图、判定和流水推出来的）。 */
    next: NextStep[];
    /** 最近几条流水。 */
    recentLog: RunLogEntry[];
    /** 这次改了什么（只看时没有）。 */
    applied?: string[];
    /** 这次才开始记状态（实例原本不记）。 */
    created?: true;
}
type ProgressCore = Pick<RunCore, 'store' | 'deps' | 'serial' | 'snapshot' | 'keepHistory'>;
/** 模型经 `state` 动作看或改一个实例的运行状态。 */
export declare class RunProgress {
    private readonly core;
    constructor(core: ProgressCore);
    /**
     * 工具的 `state`：看或改一个实例的运行状态。
     *
     * - 不带改动 = 只看；
     * - 改步骤状态时插件补上轮次、开始 / 结束时间（{@link statusFields}），每处状态变化记一条流水，更新 `updatedAt`；
     * - 改完整份校验，不合法就整次拒绝、回问题清单（文件不动）；
     * - 实例原本不记状态（或状态文件不见了）时，按初始状态新建再改。
     */
    state(id: string | undefined, session: SessionRef, patch: StatePatch): Promise<Outcome<StateReport>>;
    /** 把一次改动落到状态对象上（就地改），回给模型看的改动清单。 */
    private applyPatch;
}
export {};
