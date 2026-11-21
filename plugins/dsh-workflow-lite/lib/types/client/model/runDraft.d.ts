/**
 * dsh-workflow-lite — 实例视图里用户攒的状态改动（草稿）。
 *
 * 改动不实时落盘：先记成"字段 → 改前 / 改后"的清单，用户确认后一次交给 host（`run/save`）。
 * 草稿期间状态文件照常刷新：模型改了别的字段，画布跟着变；模型改了用户也改过的**同一个**字段，
 * 那条就是冲突，让用户选（见 {@link rebase}）。
 *
 * 全是纯函数：实例视图只负责把它们接到界面上。
 *
 * @module @xiaoso/dsh-workflow-lite/client/model/runDraft
 */
import { type EditValue, type NodeStatus, type RunState, type StateEdit } from '../../shared/runState.ts';
/** 草稿里的一条冲突：用户以为的旧值、用户要的新值、文件里现在的值。 */
export interface DraftConflict {
    path: string[];
    from: EditValue;
    to: EditValue;
    disk: EditValue;
}
export declare function samePath(a: readonly string[], b: readonly string[]): boolean;
export declare function sameValue(a: EditValue, b: EditValue): boolean;
/** 状态里某个字段的值（没有 = `null`）。 */
export declare function valueAt(state: RunState, path: readonly string[]): EditValue;
/**
 * 记一处改动。`base` 是文件里现在的状态：同一个字段第一次改时记下它的值当"改前"；
 * 改回和"改前"一样就从草稿里撤掉。
 */
export declare function setField(draft: readonly StateEdit[], base: RunState, path: readonly string[], to: EditValue): StateEdit[];
/**
 * 把草稿叠到状态上（画布显示的就是叠完的样子）。
 * 只复制改到的那几个步骤：其余步骤交回原来的对象，画布上它们的卡片不用重算。
 */
export declare function applyDraft(state: RunState, draft: readonly StateEdit[]): RunState;
/**
 * 把一个步骤改成某个状态（连带的字段一起改，见 `statusFields`）。
 * `base` 是文件里的状态，`now` 是这一刻的时间（ISO 8601）。
 */
export declare function setNodeStatus(draft: readonly StateEdit[], base: RunState, id: string, status: NodeStatus, now: string): StateEdit[];
/**
 * "重跑这一步"：它和它下游已经做过的步骤一起改回 `pending`。
 * `downstream` 由调用方按图算好（含它自己）。
 */
export declare function rerun(draft: readonly StateEdit[], base: RunState, ids: readonly string[], now: string): StateEdit[];
/**
 * 文件刷新之后重新对一遍草稿：
 * - 文件里已经是用户要的值（模型也这么改了）→ 这条不用再存，撤掉；
 * - 文件里的值和"改前"对不上 → 冲突；
 * - 其余照旧。
 */
export declare function rebase(draft: readonly StateEdit[], disk: RunState): {
    draft: StateEdit[];
    conflicts: DraftConflict[];
};
/** 冲突的两种了结：以我的为准（改前换成文件里的值），或用文件里的（撤掉这条）。 */
export declare function resolve(draft: readonly StateEdit[], conflict: DraftConflict, keep: 'mine' | 'theirs'): StateEdit[];
/** 改了几处：按对象算（整体一处、每个步骤一处），连带改的字段不另算。 */
export declare function changeCount(draft: readonly StateEdit[]): number;
/** 一个步骤在草稿里有没有改动（卡片上挂小圆点）。 */
export declare function editedNodes(draft: readonly StateEdit[]): Set<string>;
/**
 * 草稿存下去时流水会多出来的那几条（每个改过的步骤一条，指定下一步再一条，顺序同 `run/save`），叠在 `state` 后面。
 * 只给推「最后执行 / 下一步」用：位置看流水先后，不补这几条，草稿里的改动在位置上看不出来。
 */
export declare function withDraftLog(state: RunState, draft: readonly StateEdit[]): RunState;
/** 用户指定的下一步里加上 / 去掉一步（去光了就删掉这个字段）。 */
export declare function togglePin(pinned: readonly string[], id: string): string[] | null;
/** 从某个步骤往下（沿步骤之间的线，含回边）能走到的步骤，含它自己。 */
export declare function downstreamOf(edges: readonly {
    source: string;
    target: string;
}[], steps: ReadonlySet<string>, start: string): string[];
