/**
 * dsh-workflow-lite — 画布上各条线的走法：每条线挂在哪两个连接点上、绕不绕行、并排的线怎么分道、牌子怎么错开，
 * 同一对卡片之间的几条直连流程线怎么拱开。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/canvas/flow/buildRoutes
 */
import type { Point, WorkflowDocument } from '../../../../shared/types.ts';
import { type SizeTable } from '../../../model/canvasGeometry.ts';
import { type EdgeRoute } from '../lines/route.ts';
import type { LaneShift } from '../types.ts';
/** 没在拖卡片时挑好的各条线的走法：拖动中没碰到的线照用（见 `buildRoutes`）。 */
export interface RouteBase {
    doc: WorkflowDocument;
    sized: number;
    routes: Map<string, EdgeRoute | null>;
}
export interface RoutesInput {
    doc: WorkflowDocument;
    /** 拖动中的临时坐标。 */
    dragging: Record<string, Point>;
    /** 卡片尺寸量出来 / 变了就加一。 */
    sized: number;
    /** 量出来的卡片尺寸（见 `useCardSizes`）。 */
    sizes: SizeTable;
    routeBase: React.MutableRefObject<RouteBase | null>;
}
/**
 * 每条读写线挂在哪两个连接点上（按两张卡当下的位置挑，见 model/route.ts），
 * 以及每张卡上哪些点挂着线（备用的点只有挂上线才显示）。拖动中的卡按临时坐标算，线实时换点。
 */
export declare function buildRoutes({ doc, dragging, sized, sizes, routeBase }: RoutesInput): {
    handles: Map<string, {
        source: string;
        target: string;
    }>;
    used: Map<string, string[]>;
    lanes: Map<string, number>;
    bends: Map<string, [number, number][]>;
    shifts: Map<string, LaneShift>;
    labels: Map<string, number>;
    bows: Map<string, number>;
};
export type CanvasRoutes = ReturnType<typeof buildRoutes>;
