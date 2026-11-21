/**
 * dsh-workflow-lite — 大图只挂视口附近的卡片和线：挂哪一块（区域）、什么时候换区域、区域里挂哪些。
 *
 * 宿主页面有条 `:has()` 规则，视图里插拔一个元素就是整页样式重算，重算的开销又和页面上的元素数成正比：
 * 几百张卡全挂着时，拖一张卡、平移一下、打开一张图都慢。只挂视口附近的一块，元素少了，每次重算就便宜。
 *
 * 和「每帧按视口重挑」的做法不同，这里的区域比视口大一圈（{@link MARGIN}）且**有滞后**：
 * 视口在区域里挪动时什么都不插拔（{@link decide} 判 `keep`）；挪到区域边上之前才当场换（`now`）；
 * 缩放了很多、偏离区域中心较远时等视口停下来再换（`later`）——插拔集中在停下来的那一刻，平移中几乎没有。
 *
 * 全是纯函数：画布那边（`ui/canvas/hooks/useCulling.ts`）只负责订视口、在停下来时重算。
 *
 * @module @xiaoso/dsh-workflow-lite/client/model/cull
 */
import type { WorkflowDocument } from '../../shared/types.ts';
import { type SizeTable } from './canvasGeometry.ts';
import type { Rect } from './route.ts';
/** 卡片数到这么多才只挂视口附近的（小图全挂，行为和以前一样）。 */
export declare const CULL_MIN_NODES = 50;
/** 区域每边比视口多出视口宽 / 高的这么多倍。 */
export declare const MARGIN = 0.75;
/** 画布坐标里的一块：看得见的视口，或要挂的区域。`zoom` 是算它时的缩放。 */
export interface Viewbox extends Rect {
    zoom: number;
}
/** 视口在画布坐标里是哪一块（React Flow 的 `transform` 是 `[平移 x, 平移 y, 缩放]`）。 */
export declare function viewOf(transform: readonly [number, number, number], width: number, height: number): Viewbox;
/** 给视口配一块区域：每边多出 {@link MARGIN}。 */
export declare function regionFor(view: Viewbox): Viewbox;
/** 换区域的时机：`keep` 不换；`later` 等视口停下来再换；`now` 当场换（快看到没挂的地方了）。 */
export type CullDecision = 'keep' | 'later' | 'now';
export declare function decide(view: Viewbox, region: Viewbox | null): CullDecision;
/** 线走过的地方（不含两头之外的那一圈 {@link LINE_PAD}）。 */
export interface LinePath {
    /** 走廊线横着走的那一段的 y。 */
    lane?: number | undefined;
    /** 绕行折线的折点。 */
    bend?: readonly (readonly [number, number])[] | undefined;
}
export interface MountInput {
    doc: Pick<WorkflowDocument, 'nodes' | 'edges'>;
    sizes: SizeTable;
    region: Rect;
    /** 无论在不在区域里都挂着的卡片（选中的、正在拖的、正在连线的）。 */
    pinnedNodes: ReadonlySet<string>;
    /** 无论在不在区域里都挂着的线（选中的）：它的两头一起挂着。 */
    pinnedEdges: ReadonlySet<string>;
    /** 线的走法（走廊、折点）：线伸出两张卡外框的部分。 */
    pathOf(edgeId: string): LinePath | undefined;
}
/** 要挂的卡片与线（都是 `idKey` 之后的 id）。 */
export interface Mounted {
    nodes: Set<string>;
    edges: Set<string>;
}
/**
 * 区域里要挂哪些：外框碰到区域的卡片和线、钉住的，以及挂着的线的两头
 * （React Flow 画一条线要两头的卡片都在；横穿视口的长线两头都在区域外，也照样挂上）。
 */
export declare function mountedIn(input: MountInput): Mounted;
/** 两次挑出来的一样吗（一样就沿用上一次交给 React Flow 的数组）。 */
export declare function sameMounted(a: Mounted, b: Mounted): boolean;
