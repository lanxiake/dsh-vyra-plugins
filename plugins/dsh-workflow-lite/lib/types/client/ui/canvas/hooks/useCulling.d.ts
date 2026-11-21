/**
 * dsh-workflow-lite — 大图只挂视口附近的卡片和线（判断全在 `model/cull.ts`）。
 *
 * - {@link useCullRegion}：订视口，按 `decide` 换区域。视口每动一下只做几次加减比较、不重渲染画布；
 *   要换区域时才更新一次状态。判成「停下来再换」的排进 `whenStill`，插拔落在视口停下的那一刻。
 * - {@link useCulledFlow}：按区域从整份节点 / 连线对象里挑出要交给 React Flow 的；挑出来的没变就交回上一份数组。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/canvas/hooks/useCulling
 */
import type { Point, WorkflowDocument } from '../../../../shared/types.ts';
import type { SizeTable } from '../../../model/canvasGeometry.ts';
import { type Viewbox } from '../../../model/cull.ts';
import type { Selection } from '../../../model/editor.ts';
import type { CanvasRoutes } from '../flow/buildRoutes.ts';
import type { FlowEdge, FlowNode } from '../types.ts';
/** 当前要挂的区域；`enabled` 为假（小图）时是 `null`。 */
export declare function useCullRegion(enabled: boolean): Viewbox | null;
export interface CulledFlowInput {
    /** 按它挑：只在结构、位置、尺寸变了时换（`Canvas` 的 `routeDoc`），打字不重挑。 */
    doc: WorkflowDocument;
    nodes: FlowNode[];
    edges: FlowEdge[];
    sizes: SizeTable;
    /** 卡片尺寸量出来 / 变了就加一（`Canvas` 的 `sized`）。 */
    sized: number;
    routes: CanvasRoutes;
    selection: Selection;
    dragging: Record<string, Point>;
    /** 正在拖的线从哪张卡拖出来。 */
    dragFrom: string | null;
}
/** 交给 React Flow 的节点和连线：小图原样交回；大图只交视口附近的、钉住的。 */
export declare function useCulledFlow(input: CulledFlowInput): {
    nodes: FlowNode[];
    edges: FlowEdge[];
};
