/**
 * dsh-workflow-lite — 资源卡：一组给步骤用的东西，紧凑一行或带标题的清单；开了画布展示就换成展示卡。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/canvas/cards/ResourceCard
 */
import { type NodeProps } from '@xyflow/react';
import type { ResourceFlowNode } from '../types.ts';
/**
 * 资源卡：一组给步骤用的东西。左边的点接「步骤 → 资源」（写），右边的点拖出去连到步骤（读）。
 * 只放了一项、没起名字时是紧凑的一行（像一张贴了类型签的文件卡）；否则是一张小清单：
 * 标题（名字）、描述、一行一项（最多列 {@link RES_SHOWN} 项）。
 * 悬停时画布高亮所有写它、读它的步骤；一条线都没连时右上角标「全局」——它交给整个工作流。
 */
export declare const ResourceCard: import("react").NamedExoticComponent<NodeProps<ResourceFlowNode>>;
