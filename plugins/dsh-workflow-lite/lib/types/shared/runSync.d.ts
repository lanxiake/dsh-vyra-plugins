/**
 * dsh-workflow-lite — 实例的图改了以后，运行状态跟着对齐的几处。
 *
 * - 新加的步骤补一项 `pending`；删掉的步骤（只能是没执行过的）去掉；
 * - 用户指定的下一步里去掉图里没有了的；
 * - 不再有条件出边的步骤去掉判定（还有条件出边、只是取值变了的不动，留给校验指出来，让用户重新选）；
 * - 身份字段 `plan` 换成新图的 planId。
 *
 * 插件保存时把这些落到 YAML 上（保留注释），画布拿它预览改完的样子、提前挑出保存不了的问题。
 *
 * @module @xiaoso/dsh-workflow-lite/shared/runSync
 */
import type { RunGraphFacts, RunState } from './runState.ts';
/** 一处对齐：`to` 为 `null` = 删掉这个字段。 */
export interface SyncOp {
    path: string[];
    to: unknown;
}
/** 步骤执行过没有（状态不是 pending，或流水里有它）：执行过的不能从图里删。 */
export declare function hasHistory(state: RunState, id: string): boolean;
/** 状态要怎么改才和新图对得上。`plan` 给了就连身份字段一起换。 */
export declare function syncOps(state: RunState, facts: RunGraphFacts, plan?: string): SyncOp[];
/** 把对齐叠到状态上（画布预览用；不改入参）。 */
export declare function applySync(state: RunState, ops: readonly SyncOp[]): RunState;
