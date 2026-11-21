/**
 * dsh-workflow-lite — 画布上的连线对象：顺序线、读写线各自的数据、聚光与淡出，以及内容没变就复用上一帧的同一个对象。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/canvas/flow/buildEdges
 */
import { type GraphAnalysis } from '../../../../shared/graph.ts';
import type { WorkflowDocument } from '../../../../shared/types.ts';
import type { T } from '../../../i18n.ts';
import type { Selection } from '../../../model/editor.ts';
import type { RunDecor } from '../Canvas.tsx';
import type { FlowEdge, HandoffActs } from '../types.ts';
import type { CanvasRoutes } from './buildRoutes.ts';
import type { CanvasTexts } from './buildTexts.ts';
/** 连线对象缓存连同它是按哪份翻译函数与回调建的（它们换了就整份作废）。 */
export interface EdgeCache {
    t: T;
    onPick: unknown;
    acts: unknown;
    /** 上一次交出去的每条线：内容没变就交回同一个对象，React Flow 不重画这条线。 */
    map: Map<string, FlowEdge>;
    /** 上一次交出去的整份数组：一条线都没变时原样交回，React Flow 就不用把所有线再过一遍。 */
    list?: FlowEdge[];
}
export interface EdgesInput {
    doc: WorkflowDocument;
    analysis: GraphAnalysis;
    selection: Selection;
    texts: CanvasTexts;
    onPick: (id: string) => void;
    acts: HandoffActs;
    focusFile: string | null;
    hoverEdge: string | null;
    routes: CanvasRoutes;
    t: T;
    run: RunDecor | undefined;
    /** 连线对象缓存（传 ref 本身：读写的是调用那一刻的 `.current`）。 */
    edgeCache: React.MutableRefObject<EdgeCache>;
}
export declare function buildEdges({ doc, analysis, selection, texts, onPick, acts, focusFile, hoverEdge, routes, t, run, edgeCache, }: EdgesInput): FlowEdge[];
