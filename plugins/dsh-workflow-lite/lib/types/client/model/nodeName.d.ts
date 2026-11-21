/**
 * dsh-workflow-lite — 节点怎么称呼：提示条里点名用，复制出来的副本起名用。纯函数，不碰界面。
 *
 * @module @xiaoso/dsh-workflow-lite/client/model/nodeName
 */
import type { WorkflowDocument, WorkflowNode } from '../../shared/types.ts';
/** 节点的称呼：步骤 = 显示名（没有就是 id）；资源 = 名字或第一项的简称；输入 = 问题（没写就是 id）。 */
export declare function nodeTitle(node: WorkflowNode): string;
/** 复制出来的副本叫什么：原名后面接「副本」，已有就依次「副本 2」「副本 3」…（`taken` = 图里已有的名字）。 */
export declare function copyTitle(label: string, suffix: string, taken: ReadonlySet<string>): string;
/** 图里节点已用的显示名（步骤、资源的 `label`），给 {@link copyTitle} 避重。 */
export declare function takenLabels(doc: WorkflowDocument): Set<string>;
