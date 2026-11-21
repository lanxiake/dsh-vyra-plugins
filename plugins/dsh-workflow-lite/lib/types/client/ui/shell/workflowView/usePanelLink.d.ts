/**
 * dsh-workflow-lite — 画布与右侧面板的联动：悬停的资源、步骤库里点中的一项、「我的步骤」取名与外观、添加到画布。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/shell/workflowView/usePanelLink
 */
import type { useReactFlow } from '@xyflow/react';
import type { NodeData, Point } from '../../../../shared/types.ts';
import type { Workflow } from '../../../app/useWorkflow.ts';
import type { LibraryFocus, StepSource } from '../../../model/library.ts';
export interface PanelLinkInput {
    wf: Workflow;
    state: Workflow['state'];
    flow: ReturnType<typeof useReactFlow>;
    rootRef: React.RefObject<HTMLDivElement>;
    insetsRef: React.MutableRefObject<{
        left: number;
        right: number;
    }>;
    setFocus: React.Dispatch<React.SetStateAction<LibraryFocus | null>>;
    addStep(source: StepSource, position: Point, from?: string): Promise<void>;
}
export declare function usePanelLink({ wf, state, flow, rootRef, insetsRef, setFocus, addStep, }: PanelLinkInput): {
    focusFile: string | null;
    onFocusFile: (id: string | null) => void;
    focusLibrary: (next: LibraryFocus | null) => void;
    freeStepName: (base: string) => string;
    freshTemplateLook: () => Pick<NodeData, "icon" | "color">;
    addToCanvas: (source: StepSource) => void;
};
