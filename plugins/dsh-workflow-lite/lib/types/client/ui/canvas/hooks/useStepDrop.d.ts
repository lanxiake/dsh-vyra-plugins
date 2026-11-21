/**
 * dsh-workflow-lite — 从步骤库把步骤拖进画布：认放置区、解出载荷、落在指针处。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/canvas/hooks/useStepDrop
 */
import type { ReactFlowInstance } from '@xyflow/react';
import type { Point } from '../../../../shared/types.ts';
import { type StepSource } from '../../../model/library.ts';
import type { FlowEdge, FlowNode } from '../types.ts';
export interface StepDropInput {
    wrapRef: React.RefObject<HTMLDivElement>;
    flow: ReactFlowInstance<FlowNode, FlowEdge>;
    onDropSource(source: StepSource, flow: Point): void;
}
export declare function useStepDrop({ wrapRef, flow, onDropSource }: StepDropInput): {
    onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
    onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
};
