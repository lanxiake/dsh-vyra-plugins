/**
 * dsh-workflow-lite — 画布的滚轮缩放：带缓动，按光标位置算目标视口。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/canvas/hooks/useWheelZoom
 */
import type { ReactFlowInstance } from '@xyflow/react';
import type { FlowEdge, FlowNode } from '../types.ts';
export declare const MIN_ZOOM = 0.2;
export declare const MAX_ZOOM = 1.5;
export interface WheelZoomInput {
    wrapRef: React.RefObject<HTMLDivElement>;
    flow: ReactFlowInstance<FlowNode, FlowEdge>;
}
export declare function useWheelZoom({ wrapRef, flow }: WheelZoomInput): void;
