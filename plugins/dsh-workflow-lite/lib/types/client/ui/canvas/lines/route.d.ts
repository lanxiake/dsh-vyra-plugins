/**
 * dsh-workflow-lite — 连线的路径与走法：圆角折线、写线与绕行线的路径，以及为每条线挑走廊、绕行点。
 *
 * 只有算术，不碰 React；线组件（LinkLine、FileLine、ConnectionLine）和画布共用。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/canvas/lines/route
 */
import { type InternalNode, Position } from '@xyflow/react';
import { type edgeKind } from '../../../../shared/resources.ts';
import type { WorkflowEdge } from '../../../../shared/types.ts';
import type { HandleLink } from '../../../model/connect.ts';
import type { Track } from '../../../model/nudge.ts';
import { type Rect } from '../../../model/route.ts';
import type { LaneShift } from '../types.ts';
/**
 * 写线：从步骤的写点竖着出去、横着进文件卡左边的直角折线（折点见 route.ts 的 `writePoints`）。
 * @returns `[路径, 标签 x, 标签 y]`：标签落在竖段（树干）的中间，绕行时落在横走的那段中间。
 */
export declare function writePath(sourceX: number, sourceY: number, sourcePosition: Position, targetX: number, targetY: number, cardH?: number): [string, number, number];
/**
 * 画布挑好的绕行折线（见 route.ts 的 `orthoRoute`）：两头换成 React Flow 量出来的连接点坐标
 * （和按卡片尺寸算的可能差一两个像素），伸出去的那一小段跟着对齐，线才严丝合缝地接在点上。
 * @returns `[路径, 标签 x, 标签 y]`：标签落在最长那一段的中间。
 */
export declare function routedPath(points: readonly [number, number][], sourceX: number, sourceY: number, targetX: number, targetY: number): [string, number, number];
/** 往回走的线从哪儿开始找走廊：两张卡上下错开时从两行中间找，挨在同一行时从两张卡下方找。 */
export declare function laneStart(sy: number, ty: number): number;
/** 走廊线按卡片算出来的出口 / 入口位置（分道之后据此换算竖段挪了多少）。 */
export interface Corridor {
    right: number;
    left: number;
    back: boolean;
    chip: number | null;
}
/** 一条线挑好的走法（分道之前）。 */
export interface EdgeRoute {
    /** 走廊线横着走的那一段的 y。 */
    lane?: number;
    corridor?: Corridor;
    /** 读写线改走的绕行折线。 */
    bend?: [number, number][];
    /** 参与分道的直角线。 */
    track?: Track;
    /** 直连的贝塞尔流程线：两头是哪一对卡片（同一对的几条要拱开）、线上挂了几行牌子。 */
    direct?: {
        pair: string;
        rows: number;
    };
    /** 读写线挂在哪两个连接点上，以及两张卡上各占了哪个点。 */
    handles?: {
        source: string;
        target: string;
    };
    marks?: [string, string][];
    /** 别的卡挪到 `moved` 时这条线会不会被压到（拖卡片时据此决定要不要重新挑路）。 */
    hitBy: (moved: readonly Rect[]) => boolean;
}
/** 挑一条线的走法；两头的卡不在 `rects` 里、或不是要挑路的线时返回 `null`。 */
export declare function routeEdge(edge: WorkflowEdge, kind: ReturnType<typeof edgeKind>, rects: ReadonlyMap<string, Rect>, boxes: readonly Rect[]): EdgeRoute | null;
/**
 * 往回走的线：从出口向右伸出去，拐到一条横向"走廊"上走回来，再从左边进入目标。
 * 走廊由画布按卡片的位置挑（`freeLane`：不压到任何卡片，包括步骤下面挂着的文件卡）；
 * 右边那条竖段让过出口下面那串文件卡多伸出来的一截。
 * @returns `[路径, 标签 x, 标签 y]`（标签落在走廊正中）。
 */
export declare function detour(sx: number, sy: number, tx: number, ty: number, lane: number, shift?: LaneShift | null): [string, number, number];
/**
 * 往右走、但贝塞尔会压到中间某张卡片的线（跨列的线最常见）：改走直角，先横着出去到列间的空当，
 * 竖着到一条不压卡片的走廊，横着过去，再竖着对齐入口进去。
 * @returns `[路径, 标签 x, 标签 y]`（标签落在走廊正中）。
 */
export declare function bypass(sx: number, sy: number, tx: number, ty: number, lane: number, shift?: LaneShift | null): [string, number, number];
/** 卡片在画布上的矩形（还没量出尺寸时按标称尺寸算）。 */
export declare function rectOf(node: InternalNode | undefined, width: number, height: number): Rect | null;
/** 把一次拖线摆正成 source → target（倒着从入口拖时两头对调）。 */
export declare function linkOf(fromNode: string, fromHandle: {
    id?: string | null;
    type: 'source' | 'target';
}, toNode: string, toHandle: string | null | undefined): HandleLink;
