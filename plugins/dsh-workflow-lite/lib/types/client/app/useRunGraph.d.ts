/**
 * dsh-workflow-lite — 实例视图里改图：一份只在本地的编辑器（和模板编辑同一个状态机），不自动存。
 *
 * 图的改动和状态的改动攒在同一条草稿栏里（「已改 x 处」），用户点「保存并通知模型」才一起交给 host。
 * 改到一半切走再回来接着改：改过的图按实例存在浏览器里，基线（planId）对不上就作废。
 *
 * 检查和模板用同一套规则（`shared/validate.ts` 的四级）：顶栏的检查结果列全部，画布按它标卡片；
 * 挡保存的只有保存级、编译级，而且只在改过图时才挡（没改过就是建实例时那张，不该拦着改状态）。
 *
 * @module @xiaoso/dsh-workflow-lite/client/app/useRunGraph
 */
import { type GraphChange } from '../../shared/graphDiff.ts';
import type { ValidationProblem, WorkflowDocument } from '../../shared/types.ts';
import { type Edit, type Selection } from '../model/editor.ts';
import type { SideHistory } from '../model/runHistory.ts';
export interface RunGraph {
    /** 改到现在的图；基线还没到时是 `null`。 */
    doc: WorkflowDocument | null;
    /** 改之前那版。 */
    base: WorkflowDocument | null;
    /** 改之前那版的 planId（保存时交给 host 核对）。 */
    basePlan: string | null;
    selection: Selection;
    /** 比基线改了什么（一处一项，按 `shared/graphDiff.ts` 数）。 */
    changes: GraphChange[];
    /** 改完的图保存不了的问题（保存级、编译级；没改过图时为空）：保存按钮按住。 */
    problems: ValidationProblem[];
    /** 这张图的全部检查结果（四级，和模板同一套规则）：顶栏的检查结果、画布上的标记。 */
    report: ValidationProblem[];
    /**
     * 按改到现在的图当场再查一遍挡保存的问题。`problems` / `report` 打字时晚一拍跟上（见下），
     * 保存这一下要以眼前的图为准。
     */
    problemsNow(): ValidationProblem[];
    /** 图的撤销栈。 */
    history: SideHistory;
    edit(edit: Edit): void;
    select(selection: Selection): void;
    seal(): void;
    undo(): void;
    redo(): void;
    /** 丢掉重做栈（状态那边有了新的一步）。 */
    dropRedo(): void;
    /** 单独撤回清单里的一处。 */
    revert(change: GraphChange): void;
    /** 放弃图的全部改动。 */
    discard(): void;
    /** 存好了：改到现在的图就是新的基线（`planId` 是 host 回的新图的）。 */
    commit(planId: string): void;
}
export declare function useRunGraph(id: string, 
/** host 给的快照（已补好位置）与它的 planId；还没读回来是 `null`。 */
source: {
    planId: string;
    doc: WorkflowDocument;
} | null, workflow: string | undefined): RunGraph;
