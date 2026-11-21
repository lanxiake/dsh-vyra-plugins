/**
 * dsh-workflow-lite — 字段级合并（文件级冲突，字段级合并）。
 *
 * 合并单位 = **`node.id` 与 `edge.id`**（大小写不敏感，与图内身份一致）。只有两种情况算冲突：
 * 1. **同一个 node 的 `data` 双方都改过**（各改成不一样的）；
 * 2. **同一个 `id` 一方删、一方改**。
 *
 * 两边改的是不同节点 / 边 ⇒ **自动合并、不报冲突**——"改 A 节点不会因为 B 节点被改而冲突"。
 * `viewport` 与 `position` 是纯视图态，**本地优先、永不冲突**（坐标与 viewport 都存盘，
 * 但它们不承载语义，没道理为"谁最后拖的"打断作者）。
 *
 * 冲突时输出文档以**本地为准**（"保留我的"）；调用方若要"用磁盘的"，直接重新加载就是了。
 * 纯函数：不碰磁盘、不改入参、不 import DSH 包。
 * @module @xiaoso/dsh-workflow-lite/host/store/merge
 */
import type { WorkflowDocument } from '../../shared/types.ts';
export interface MergeResult {
    document: WorkflowDocument;
    /** 冲突的 `node.id` / `edge.id`（按出现顺序，已去重）。 */
    conflictIds: string[];
}
/**
 * 把「本地要写回的 `mine`」与「此刻磁盘上的 `theirs`」按 `base`（加载时的基线）合并。
 */
export declare function mergeDocuments(base: WorkflowDocument, mine: WorkflowDocument, theirs: WorkflowDocument): MergeResult;
