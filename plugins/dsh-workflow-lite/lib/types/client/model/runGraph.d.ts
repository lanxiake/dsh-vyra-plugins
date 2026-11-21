/**
 * dsh-workflow-lite — 实例视图里改图：单独撤回一处改动、哪些步骤不能删。
 *
 * 「已改 x 处」的清单按 `shared/graphDiff.ts` 数；这里把清单里的一行还原成改之前的样子
 * （其余改动不动），交给编辑器整张换上（进撤销历史）。
 *
 * @module @xiaoso/dsh-workflow-lite/client/model/runGraph
 */
import type { GraphChange } from '../../shared/graphDiff.ts';
import type { RunState } from '../../shared/runState.ts';
import type { WorkflowDocument } from '../../shared/types.ts';
/** 把 `doc` 里的这一处改动还原成 `base` 里的样子。 */
export declare function revertChange(base: WorkflowDocument, doc: WorkflowDocument, change: GraphChange): WorkflowDocument;
/** 删不得的步骤：执行过的（状态不是待执行，或流水里有它）。不记状态的实例没有限制。 */
export declare function lockedSteps(state: RunState | null): (id: string) => boolean;
