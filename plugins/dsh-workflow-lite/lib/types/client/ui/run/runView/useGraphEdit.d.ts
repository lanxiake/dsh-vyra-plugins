/**
 * dsh-workflow-lite — 实例视图里改图的动作：改、加步骤、就地添加、复制、删、整理。
 * 所有动作都落到 `edit`，执行过的步骤在这里拦下不让删。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/run/runView/useGraphEdit
 */
import type { ReactFlowInstance } from '@xyflow/react';
import type { GraphAnalysis } from '../../../../shared/graph.ts';
import type { NodeData, Point, WorkflowDocument } from '../../../../shared/types.ts';
import type { RunGraph } from '../../../app/useRunGraph.ts';
import type { Run } from '../../../app/useRuns.ts';
import type { T } from '../../../i18n.ts';
import { type Edit, type Selection } from '../../../model/editor.ts';
import type { StepSource } from '../../../model/library.ts';
import type { AddRequest } from '../../canvas/Canvas.tsx';
import type { PanelMode } from '../RunModeSwitch.tsx';
export interface GraphEditInput {
    t: T;
    canvasRef: React.RefObject<HTMLDivElement | null>;
    current: Run;
    graph: RunGraph;
    doc: WorkflowDocument | null;
    analysis: GraphAnalysis | null;
    selection: Selection;
    flow: ReactFlowInstance;
    narrow: boolean;
    inspectorW: number;
    onPanel(open: boolean): void;
    loadTemplate(name: string): Promise<NodeData | null>;
    fitAll(): void;
    setMode(mode: PanelMode): void;
    setFocusPrompt(on: boolean): void;
    /** 打开就地添加菜单（实例视图里 `quick` 的 setter）。 */
    setQuick(request: AddRequest & {
        at: Point;
        bounds: {
            width: number;
            height: number;
        };
    }): void;
}
export declare function useGraphEdit({ t, canvasRef, current, graph, doc, analysis, selection, flow, narrow, inspectorW, onPanel, loadTemplate, fitAll, setMode, setFocusPrompt, setQuick, }: GraphEditInput): {
    focusCanvas: () => void;
    edit: (next: Edit) => void;
    addStep: (from: StepSource, position: Point, after?: string) => Promise<void>;
    requestAdd: (request: AddRequest) => void;
    duplicate: (nodeId: string) => void;
    removeNode: (nodeId: string) => void;
    removeSelection: () => void;
    relayout: () => void;
};
