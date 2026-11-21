/**
 * dsh-workflow-lite — 展示卡：资源卡开了画布展示，标题行加展示区，选中时可拖右下角改大小或缩放。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/canvas/cards/DisplayCard
 */
import { type NodeProps } from '@xyflow/react';
import type { CardDisplay, ResourceFlowNode } from '../types.ts';
export declare function DisplayCard(props: NodeProps<ResourceFlowNode> & {
    display: CardDisplay;
}): React.JSX.Element;
