/**
 * dsh-workflow-lite — 正在拖的那条连接线：按起点上色，落到能连的点上时预告连上后是哪种线。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/canvas/lines/ConnectionLine
 */
import { type ConnectionLineComponentProps } from '@xyflow/react';
import type { T } from '../../../i18n.ts';
import { type DragKind, type HandleLink, type LinkPreview } from '../../../model/connect.ts';
import type { FlowNode } from '../types.ts';
/** 拖线时给连接线和画布用的上下文：按当前文档预告「连上会是什么线」。 */
export interface DragContext {
    preview(link: HandleLink): LinkPreview | null;
    t: T;
}
export declare const DragInfo: import("react").Context<DragContext | null>;
/** 连上后那种线的颜色（新连的流程线没有条件，就是「总是」的蓝）。 */
export declare const PREVIEW_COLOR: Record<LinkPreview['kind'], string>;
/** 拖线起点的颜色：还没落到目标上时，先按起点预告大致是哪种线。 */
export declare function dragColor(kind: DragKind | null): string;
/**
 * 正在拖的那条线。还没落到能连的地方时：按起点上色、虚线，指针旁一句提示该往哪儿拖；
 * 落到能连的连接点上（还没松手）：变成实线、换成连上后那种线的颜色，指针旁预告这条线的含义——
 * 是流程、产出、更新还是读取，数据从谁流向谁。
 */
export declare function ConnectionLine(props: ConnectionLineComponentProps<FlowNode>): React.JSX.Element;
