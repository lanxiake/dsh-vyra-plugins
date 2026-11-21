/**
 * dsh-workflow-lite — 读写线挂在哪两个连接点上、怎么走。
 *
 * 画布的版式语法是「左右走流程，上下走文件」：步骤左右两侧只接步骤之间的线，读写线一律挂在
 * 步骤的上下边。文件卡和步骤卡一样「左进右出」：左边的空心圈接写入，右边的实心点拖出去是读取。
 * 每条线**都落在一个真实的连接点上**（点画在哪，线就接在哪），只是按两张卡当下的位置挑用哪一个：
 * - 写：文件在下方 = 步骤底边 `file` → 文件左边 `in`；文件在上方 = 步骤上边 `fileUp` → 文件左边 `in`；
 * - 读：文件右边 `out` 出发，步骤在上方落到它底边的 `read`，在下方落到上边的 `readTop`。
 *
 * 写线是直角折线：从步骤的写点竖着落下（升起）、拐个弯横着进文件卡的左边。一个步骤写的几份文件
 * 竖着挂在它下面，几条写线共用一根"树干"、各自分叉进自己的文件——像文件树，不会穿过别的卡片。
 *
 * 连接点在卡片边上的位置也定在这里（`STEP_SPOTS` / `FILE_SPOTS`），卡片组件照着摆，
 * 拖线预览照着算，三处永远一致。
 *
 * @module @xiaoso/dsh-workflow-lite/client/model/route
 */
export type Side = 'top' | 'right' | 'bottom' | 'left';
export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}
export interface Anchor {
    x: number;
    y: number;
    side: Side;
}
/** 一个连接点在卡片上的位置：在哪条边上、沿这条边走到几成处。 */
export interface Spot {
    side: Side;
    at: number;
}
/** 步骤上挂读写线的连接点（左 `in` / 右 `out` 是流程线的，不在这里）。 */
export type StepFileHandle = 'file' | 'fileUp' | 'read' | 'readTop';
/** 文件卡上的连接点：左进（被写）右出（被读）。 */
export type FileHandle = 'in' | 'out';
/**
 * 读点贴着左下角（读的文件多半来自左边的上游，从左边进来不用跨过自己的文件树），
 * 写点在它右边一点：那是文件树的树干，挂在下面的文件卡往右缩进、左边对着树干。
 * 上边的写点比底边的再靠右一点：同一列里下面的步骤往上写上面那个步骤的文件时，
 * 它的树干和上面那个步骤的树干错开，不会连成一根、看着像两个步骤连在了一起。
 */
export declare const STEP_SPOTS: Record<StepFileHandle, Spot>;
export declare const FILE_SPOTS: Record<FileHandle, Spot>;
/** 写线从写点伸出去多远才拐弯 / 横着进文件卡前留多长。 */
export declare const WRITE_REACH = 22;
/** 连接点在画布上的坐标。 */
export declare function spotOf(rect: Rect, spot: Spot): Anchor;
/**
 * 一条读写线挂在哪两个连接点上。
 * @param kind `'write'` 步骤 → 文件；`'read'` 文件 → 步骤。
 */
export declare function routeFileLink(kind: 'write' | 'read', step: Rect, file: Rect): {
    step: StepFileHandle;
    file: FileHandle;
};
/** 读写线两头的坐标（`from` 是线的起点：写 = 步骤，读 = 文件卡）——拖线预览用。 */
export declare function fileLinkEnds(kind: 'write' | 'read', step: Rect, file: Rect): {
    from: Anchor;
    to: Anchor;
};
/**
 * 写线的折点：从步骤的写点竖着出去，横着从左边进文件卡。
 *
 * - 常见的情形（文件挂在步骤下方 / 上方、左边在树干右侧）：一个直角——竖着到文件那一行，横着进去；
 * - 否则绕一下：先竖着出去一小段，横着走到文件左边外侧，再竖着对齐入口、从左边进去；
 *   横走的那段若会穿过文件卡，就改从文件卡的另一侧绕过去。
 *
 * @param from 步骤上的写点（`side` 是 `bottom` 或 `top`）。
 * @param to 文件卡左边的入口。
 * @param fileH 文件卡的高度（绕行时要避开它）。
 */
export declare function writePoints(from: Anchor, to: {
    x: number;
    y: number;
}, fileH: number): [number, number][];
/**
 * 往右走的流程线：一条三次贝塞尔。出口那头的控制柄拉得比入口那头长——线先横着走出一截、
 * 走到两列之间的空当里再拐下去（上来），不会斜着擦过出口下面挂着的那串文件卡（它们比步骤卡
 * 往右多伸出一截）。
 *
 * 同一对卡片之间不止一条时各自拱开 `bow`（见 {@link fanBows}）：像一片叶子的两条边，从同一个点横着出去，
 * 一道连续的弧拱到正中最高（牌子挂在那儿），再弧回来、横着进同一个入口——出入口的方向和别的流程线一样，中间没有平段。
 * @param bow - 正中比两头连线的中点往下（负数往上）拱出去多少；0 就是原来那条贝塞尔。
 * @returns `[路径, 标签 x, 标签 y]`（曲线正中）。
 */
export declare function flowPath(sx: number, sy: number, tx: number, ty: number, bow?: number): [string, number, number];
/**
 * 同一对卡片之间的几条直连流程线（比如「通过」和另一个条件都去同一步）各往上下拱多少：不分开就叠成一根，牌子也压在一起。
 * 按给的次序从上到下排，整束以原来那条曲线为中心；相邻两条隔的距离够放下它们挂的牌子。只有一条时不拱。
 * @param rows - 每条线上挂了几行牌子（0–2）。
 */
export declare function fanBows(rows: readonly number[]): number[];
/** 往回走的线：右边那条竖段离出口多远（要让过出口下面那串文件卡多伸出来的一截）。 */
export declare const LOOP_REACH = 64;
/**
 * 往回走的线横着走回来的"走廊"放在哪：从 `from` 往下找第一条横穿 `[x1, x2]` 时不压到任何卡片的 y。
 * @param boxes 画布上的卡片（含文件卡）。
 */
export declare function freeLane(boxes: readonly Rect[], x1: number, x2: number, from: number): number;
/** 贝塞尔流程线（`flowPath` 的那条）会不会压到哪张卡片（`skip` 里的不算，通常是两头自己的卡）。 */
export declare function flowBlocked(boxes: readonly Rect[], sx: number, sy: number, tx: number, ty: number, skip?: readonly Rect[]): boolean;
/**
 * 横穿 `[x1, x2]` 时不压到任何卡片、又离 `around` 最近的 y（往上往下都找）。
 * 候选就是 `around` 本身和每张挡路的卡片的上沿之上、下沿之下。
 */
export declare function nearestLane(boxes: readonly Rect[], x1: number, x2: number, around: number, skip?: readonly Rect[]): number;
type Point2 = [number, number];
/** 一条绕开卡片的直角走线：折点（含两头）与代价（长度 + 拐弯）。 */
export interface OrthoRoute {
    points: Point2[];
    cost: number;
}
/**
 * 从 `start` 到 `end` 找一条不压到任何卡片的直角折线：两头都先垂直于所在的边伸出一小段，
 * 中间最多再拐三次，走在卡片之间的缝里。候选的竖道 / 横道取自附近卡片的四边外侧，
 * 按"长度 + 拐弯"从便宜到贵逐条检查，第一条走得通的就是答案；一条都走不通返回 `null`。
 * @param boxes 画布上所有卡片（含两头自己的卡片）。
 * @param startBox / endBox 两头自己的卡片：伸出去的那一小段本来就贴着它们。
 */
export declare function orthoRoute(start: Anchor, end: Anchor, boxes: readonly Rect[], startBox: Rect, endBox: Rect): OrthoRoute | null;
/** 一串直角折点压没压到哪张卡片（不算 `skip` 里的）。 */
export declare function pointsBlocked(points: readonly Point2[], boxes: readonly Rect[], skip: readonly Rect[]): boolean;
/**
 * React Flow 的贝塞尔（`getBezierPath`，曲率 0.25）压没压到哪张卡片（不算 `skip` 里的）：
 * 读线平时就用它画，只有压到卡片时才改走直角。
 */
export declare function bezierBlocked(from: Anchor, to: Anchor, boxes: readonly Rect[], skip: readonly Rect[]): boolean;
export {};
