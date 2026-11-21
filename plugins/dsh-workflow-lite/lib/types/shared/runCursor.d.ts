/**
 * dsh-workflow-lite — 运行到哪了：按图、判定和流水推出**最后执行**的步骤与**接下来**该做的步骤。
 *
 * 只看各步骤的状态会漂：循环里每个步骤都做过一轮、都是 `done`，"第一个没完成的步骤"会跳到环外。
 * 这里改看流水（只追加，下标就是先后）：
 * - 一个步骤做完之后，它该交给的下游（无条件线、条件等于它这一轮判定的线）在那之后还没有动静，
 *   它就是**最后执行**的步骤之一，那些下游就是**接下来**的步骤（回边 = 循环回去，再做一轮）；
 * - 失败的步骤一直算最后执行（等重做或叫停）；
 * - 都接上了（下游在跑，或走到了头）时，最后执行 = 最近做完的那一步（同一次调用写下的几步一起算）。
 *
 * 另外两种「接下来」：从没开始过的入口步骤，和被改回 `pending` 的步骤（它前面的都完成了才轮到）。
 *
 * 用户也可以**指定**下一步（状态里的 `next`，流水里记一条 `next` 事件）：
 * - 指定还在时，「接下来」就是指定的这几步；
 * - 指定那一刻之前做完的步骤，交接都算已经了结——模型做完指定的步骤后，不会再绕回指定之前没接上的下游。
 * 画布上的「最后执行 / 下一步」标记与工具回给模型的进度都用它。
 *
 * @module @xiaoso/dsh-workflow-lite/shared/runCursor
 */
import { type GraphAnalysis } from './graph.ts';
import type { NodeStatus, RunState } from './runState.ts';
import type { WorkflowDocument } from './types.ts';
/** 最后执行的一步。 */
export interface CursorStep {
    node: string;
    status: NodeStatus;
    round?: number;
    verdict?: string;
    /** 结束时刻。 */
    at?: string;
}
/** 接下来的一步。 */
export interface NextStep {
    node: string;
    /** 做的话是第几轮。 */
    round: number;
    /**
     * `flow` = 上游交过来；`start` = 入口步骤还没开始；`reset` = 被改回 pending，要重做；
     * `pinned` = 用户指定。
     */
    reason: 'flow' | 'start' | 'reset' | 'pinned';
    /** 谁交过来的（`flow` 才有）。 */
    from?: string;
    /** 沿回边过来：循环回到这一步。 */
    loop?: true;
}
export interface RunCursor {
    /** 按做完的先后。 */
    last: CursorStep[];
    running: string[];
    waiting: string[];
    next: NextStep[];
}
export declare function runCursor(document: WorkflowDocument, state: RunState, analysis?: GraphAnalysis): RunCursor;
