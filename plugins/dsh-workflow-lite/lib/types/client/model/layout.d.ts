/**
 * dsh-workflow-lite — 自动布局。
 *
 * 整图重排交给 ELK（`elkjs` 的 layered 算法）：分层、同层排序（减少交叉）、算坐标都是它做的。
 * 我们只把自己的版式语法喂给它：
 * - **列 = 执行批次**：用 ELK 的 interactive 分层，按批次给出横坐标，版面本身就在讲执行次序；
 * - **资源挂在写它的步骤下面**：一个步骤和它写的资源在 ELK 眼里是一整块（步骤卡 + 下面竖着一串
 *   资源卡），块的高度随资源卡的高度变，ELK 按真实高度排，谁也压不到谁；资源卡往右缩进，写线从步骤的
 *   写点竖着落下来、分叉进每张资源卡的左边（见 route.ts），不会穿过任何卡片；
 * - 没人写、只被读的资源单独成块，放在第一个读它的步骤的前一列；只被后面的步骤在原文件上更新、
 *   却被前面的步骤读的（共享的状态文档、台账）也一样——它本来就在，是输入；
 * - 读线只拉相邻一列的（或者读它的步骤没别的线拉着）：跨好几列的读线不参与排版，免得把主线挤歪；
 * - 流程线的进出口固定在步骤卡（不是整块）的半高处，ELK 才会把一条链摆成一条直线。
 * - 列距整齐划一；只有相邻两列之间的线上挂着条件牌子 / 交接标记时，把那一处拉开到放得下牌子。
 *
 * 补位（只给个别新节点找地方）仍是同步的就近规则：已经摆好的版面一律不动。
 *
 * `(0,0)` 是"还没摆过"的哨兵值（host 新建节点时的初始坐标），所以版面原点不落在它上面。
 *
 * @module @xiaoso/dsh-workflow-lite/client/model/layout
 */
import type { GraphAnalysis } from '../../shared/graph.ts';
import type { Point, ResourceData, WorkflowDocument, WorkflowNode } from '../../shared/types.ts';
/** 步骤卡的宽度（CSS 里写死同一个数）与估算高度。 */
export declare const NODE_W = 216;
export declare const NODE_H = 96;
/** 资源卡的宽度（CSS 里写死同一个数）与紧凑时的高度（只有一项、没起名字：一行，像一张文件卡）。 */
export declare const RES_W = 200;
export declare const RES_H = 56;
/** 资源卡上最多列几项，再多折成"还有 N 项"。 */
export declare const RES_SHOWN = 4;
/** 资源卡是不是紧凑的一行：没名字、没描述、最多一项。 */
export declare function isCompactResource(data: ResourceData): boolean;
/** 资源卡的估算尺寸：展示卡按展示区算，其余宽度固定。 */
export declare function resourceSize(data: ResourceData): {
    w: number;
    h: number;
};
/** 资源卡的估算高度（画布量出来之前按它排）。 */
export declare function resourceHeight(data: ResourceData): number;
/** 输入卡的宽度（CSS 里写死同一个数）与估算高度：挂在读它的步骤旁边。 */
export declare const INPUT_W = 180;
export declare const INPUT_H = 56;
/** 一张卡的标称尺寸（还没量出来时按它算）。 */
export declare function cardSize(node: WorkflowNode): {
    w: number;
    h: number;
};
/**
 * 资源卡相对写它的步骤：往右缩进 `RES_DX`（左边要让出树干和拐弯），第一张离步骤底边
 * `RES_DY`，往下每张隔 `RES_GAP`。
 */
export declare const RES_DX = 84;
/** 列距（「添加下一步」也按它往右挪一列）与行距。 */
export declare const COL_STEP: number;
export declare const ROW_STEP = 132;
/**
 * 一个资源卡该放哪：挂在写它的步骤（没人写就是读它的步骤）下面、往右缩进，被占了就往下找。
 * @param anchor - 写它 / 读它的步骤的坐标；没有就放在版面左下。
 * @param size - 这张卡多大（展示卡比普通资源卡大，按它的真实尺寸找空位）。
 */
export declare function resourceSpot(doc: WorkflowDocument, anchor: Point | undefined, skip?: string, size?: {
    w: number;
    h: number;
}): Point;
/**
 * 一个步骤的记忆卡该放哪：和产出一样挂在步骤下面、往右缩进（下面已经挂着产出就接在它们后面）。
 * 只是往下找的时候要越过别的步骤卡，写线就得绕开它——这时改放到步骤上面（写线从上边的写点出去），
 * 上面也不通才退回下面那个位置。
 */
export declare function memorySpot(doc: WorkflowDocument, step: WorkflowNode): Point;
/**
 * 一个输入卡该放哪：读它的步骤左边、和步骤上沿对齐，被占了就往下找；没有读它的步骤就放在版面左上方。
 */
export declare function inputSpot(doc: WorkflowDocument, reader: Point | undefined, skip?: string): Point;
/** 这个节点是不是还没摆过。 */
export declare function isUnplaced(position: Point): boolean;
/** 量出来的卡片尺寸（画布上已经渲染过的卡）；没有就按估算尺寸。 */
export type SizeOf = (id: string) => {
    width: number;
    height: number;
} | undefined;
/**
 * 整图重排：每个节点都重算，同一张图必然摆成同一版式。
 * @param sizeOf - 卡片的真实尺寸（步骤卡的高度随内容变）；不给就按估算尺寸。
 */
export declare function tidy(doc: WorkflowDocument, analysis: GraphAnalysis, sizeOf?: SizeOf): Promise<Record<string, Point>>;
/** 从 `want` 起往下找一个不压住任何已有卡片的位置。 */
export declare function freeSpot(occupied: readonly Point[], want: Point): Point;
/** 「添加下一步」的落点：源步骤的右边一列，被占了就往下找。 */
export declare function nextTo(doc: WorkflowDocument, source: Point): Point;
/**
 * 给**还没摆过**的节点补坐标（已有坐标的一律不动）。
 *
 * 全都没摆过 ⇒ 整图重排；只有个别没摆过（模型用工具新加了一步）⇒ 挨着它的上游放，
 * 不去动用户已经摆好的版面。
 */
export declare function placeMissing(doc: WorkflowDocument, analysis: GraphAnalysis): Promise<Record<string, Point>>;
