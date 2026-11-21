/**
 * dsh-workflow-lite — 画布上展示卡的数据：当前的图（给异步排版回来时对照）、自定义文字的查看、「上次执行」。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/shell/workflowView/useCanvasDisplay
 */
import type { ResourceItem } from '../../../../shared/types.ts';
import type { Workflow } from '../../../app/useWorkflow.ts';
import type { WorkflowLiteRpc } from '../../../rpc.ts';
export interface CanvasDisplayInput {
    rpc: WorkflowLiteRpc;
    state: Workflow['state'];
    runId: string | null;
    openRun(id: string): void;
}
export declare function useCanvasDisplay({ rpc, state, runId, openRun }: CanvasDisplayInput): {
    docRef: import("react").MutableRefObject<import("../../../../shared/types.ts").WorkflowDocument | null>;
    textView: ResourceItem | null;
    setTextView: import("react").Dispatch<import("react").SetStateAction<ResourceItem | null>>;
    canvasDisplay: {
        run: null;
        latest: {
            rpc: WorkflowLiteRpc;
            outputs: Readonly<Record<string, import("../../../../shared/wire/run.ts").RunLatestOutput>>;
            openRun: (id: string) => void;
        };
        open: (node: string, item: number) => void;
    };
};
