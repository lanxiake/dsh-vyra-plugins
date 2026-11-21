/**
 * dsh-workflow-lite — 画布视口：看全图、定位到某一步、选中后把步骤从面板底下挪出来、整理排版。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/shell/workflowView/useViewport
 */
import type { useReactFlow } from '@xyflow/react';
import type { Workflow } from '../../../app/useWorkflow.ts';
export interface ViewportInput {
    flow: ReturnType<typeof useReactFlow>;
    rootRef: React.RefObject<HTMLDivElement>;
    insetsRef: React.MutableRefObject<{
        left: number;
        right: number;
    }>;
    state: Workflow['state'];
    analysis: Workflow['analysis'];
    wf: Workflow;
    narrow: boolean;
    inspectorW: number;
    /** 当前的图（异步排版回来时据此判断图是不是已经变了）。 */
    docRef: React.MutableRefObject<Workflow['state']['doc']>;
}
export declare function useViewport({ flow, rootRef, insetsRef, state, analysis, wf, narrow, inspectorW, docRef, }: ViewportInput): {
    focusCanvas(): void;
    fitAll(options?: {
        duration?: number;
        auto?: boolean;
    }): void;
    fitSoon(): void;
    locate(nodeId: string): void;
    relayout(): void;
};
