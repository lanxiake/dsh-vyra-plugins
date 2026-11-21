/**
 * dsh-workflow-lite — 两版图之间改了什么。
 *
 * 实例视图里改图时，底部的「已改 x 处」按它数；保存时插件按它写给模型的通知。
 * 按对象比：步骤、资源、输入按 id；连线先按 id，对不上再按两端认（改条件会换 id）。
 * 挪卡片合成一处「布局」：不进计划，也不用告诉模型。
 *
 * 纯函数，不碰磁盘。
 *
 * @module @xiaoso/dsh-workflow-lite/shared/graphDiff
 */
import type { WorkflowDocument } from './types.ts';
export type ChangeObject = 'step' | 'resource' | 'input' | 'edge' | 'layout';
export interface GraphChange {
    object: ChangeObject;
    kind: 'added' | 'removed' | 'changed';
    /** 节点 id 或连线 id（删掉的是原来的 id，其余是现在的）；布局是空串。 */
    id: string;
    /** 改了的连线原来的 id（改条件会换 id）。 */
    was?: string;
    /** 改了哪些字段（`changed` 才有）；布局是挪动了的节点 id。 */
    fields: string[];
}
/** 这处改动会不会让计划变样（要不要告诉模型）。 */
export declare function affectsPlan(change: GraphChange): boolean;
/** `base` → `next` 改了什么：节点按图里的顺序在前（删掉的排在最前），连线其次，布局最后。 */
export declare function graphChanges(base: WorkflowDocument, next: WorkflowDocument): GraphChange[];
/** 一处改动写成一行（不带前面的「- 」），比如「步骤 review（审查）：改了提示词、名称」。 */
export declare function describeGraphChange(change: GraphChange, base: WorkflowDocument, next: WorkflowDocument): string;
