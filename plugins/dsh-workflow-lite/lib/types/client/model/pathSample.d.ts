/**
 * dsh-workflow-lite — 沿一条 SVG 路径等距取点（纯计算，不碰 DOM）。
 *
 * 光带（FlowStreaks）每次线变了都要沿线重新取点；拖卡片时线每帧都在变。以前是把路径塞进一个
 * 隐形的 `<path>` 再调 `getTotalLength` / `getPointAtLength`，每次都要浏览器重新解析、量一遍，
 * 是拖动时主线程上最大的开销之一。这里直接按画布自己生成的路径算：把曲线压成细折线，按弧长取点。
 *
 * 只认画布会生成的绝对坐标命令：`M` `L` `H` `V` `Q` `C` `Z`（React Flow 的贝塞尔用逗号分隔，也认）。
 * 碰到别的命令返回 `null`，调用方自己退回 DOM 测量。
 *
 * @module @xiaoso/dsh-workflow-lite/client/model/pathSample
 */
export interface MeasuredPath {
    /** 整条路径的长度。 */
    length: number;
    /** 从起点到终点等距取 `count` 个点（含两头），每个点带它离起点的弧长。 */
    sample(count: number): {
        x: number;
        y: number;
        at: number;
    }[];
}
/** 把路径压成折线（相邻的重复点去掉）。不认识的命令 → `null`。 */
export declare function flattenPath(d: string): [number, number][] | null;
/** 量一条路径。路径为空、长度为零或认不出来时返回 `null`。 */
export declare function measurePath(d: string): MeasuredPath | null;
