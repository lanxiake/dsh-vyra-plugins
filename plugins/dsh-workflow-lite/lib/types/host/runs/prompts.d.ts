/**
 * dsh-workflow-lite — 写给模型的话：用户改动的描述、运行位置、「执行」时发进会话的那句话与进度摘要。
 *
 * `resume` / `compile` 回给模型的进度摘要、画布点「执行」发进会话的提示、通知模型的改动清单都在这里；
 * 纯函数，不碰磁盘。
 *
 * @module @xiaoso/dsh-workflow-lite/host/runs/prompts
 */
import { type RunCursor } from '../../shared/runCursor.ts';
import { type InstanceRecord, type RunState, type RunStateIssue, type RunStatus, type StateEdit } from '../../shared/runState.ts';
import type { WorkflowDocument } from '../../shared/types.ts';
/** 一个字段的改动，写成「status 从 done 改成 pending（要重新执行这一步）」这样的半句。 */
export declare function describeField(edit: StateEdit): string;
/** 改动按对象归组：`node` 为空串是整体。同一组里状态在前，连带改的字段跟在后面。 */
export declare function groupEdits(edits: readonly StateEdit[]): {
    node: string;
    text: string;
}[];
/**
 * 改动按对象归成几行写给模型：整体一行、每个步骤一行。
 * 返回的行数就是"改了几处"（用户改一个步骤的状态，连带改了轮次、时间，算一处）。
 */
export declare function describeEdits(edits: readonly StateEdit[]): string[];
/** 运行到哪了，写给模型的一句话（`resume` 用）。 */
export declare function cursorHint(cursor: RunCursor, status: RunStatus): string;
/**
 * 画布上点「执行」时发进会话的那句话：短、人看得懂；完整计划由模型调 `resume` 拿
 * （计划在工具结果里，对话里照样看得到）。
 */
export declare function startPrompt(record: InstanceRecord): string;
/**
 * 进度摘要（`resume` / `compile` 回给模型）：最后执行到哪、接下来做哪几步——按图、判定和流水推出来
 * （见 `shared/runCursor.ts`），不按清单顺序找"第一个没完成的"（循环里那样会跳出环）。
 * 被打断的（停在 running 的）排在 `next` 最前面：重做这一轮。
 */
export declare function progressReport(record: InstanceRecord, read: {
    state: RunState | null;
    text: string | null;
    issues: RunStateIssue[];
}, document: WorkflowDocument): Record<string, unknown>;
