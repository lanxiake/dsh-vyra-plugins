/**
 * dsh-workflow-lite — 画布的视口：换基线时恢复上次的视角；是默认视角（新图）就看全图。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/canvas/hooks/useViewportRestore
 */
import type { ReactFlowInstance } from '@xyflow/react';
import type { WorkflowDocument } from '../../../../shared/types.ts';
import type { CanvasProps } from '../Canvas.tsx';
import type { FlowEdge, FlowNode } from '../types.ts';
export interface ViewportRestoreInput {
    flow: ReactFlowInstance<FlowNode, FlowEdge>;
    docRef: React.MutableRefObject<WorkflowDocument>;
    props: Pick<CanvasProps, 'insets' | 'onSettled' | 'loadKey'>;
    viewKey: string | undefined;
}
export declare function useViewportRestore({ flow, docRef, props, viewKey }: ViewportRestoreInput): void;
