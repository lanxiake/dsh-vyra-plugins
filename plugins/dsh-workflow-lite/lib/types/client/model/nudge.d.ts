/**
 * dsh-workflow-lite — 直角线分道（nudging）：不同颜色的线不叠在同一条道上。
 *
 * 每条直角线是各自挑路的（走廊、绕行折线），两条不同种类的线常常挑中同一条缝、同一条走廊，
 * 叠成一根分不清。这里在挑完路之后统一过一遍（libavoid 的 orthogonal nudging 那一步的简化版）：
 * - 找出**共线（或挨得不到一个道距）、又有一段重叠**的横段 / 竖段，连成一簇；
 * - 同一种颜色（`group`）的线可以继续合在一条道上（本来就是一类线，合着反而清爽）；
 * - 不同颜色的分到相邻的平行道上，道距 `GAP`，在这一簇所在的空当（上下 / 左右最近的卡片之间）里
 *   尽量居中摆开，空当窄就把道距压小；
 * - 只挪中间的段：接在连接点上的头尾两段不动，挪一段只是让它两头相邻的段变长 / 变短，线还是直角的；
 * - 道的先后按线从哪边来、往哪边去排（从上面来的走上面那条道），尽量不因为分道再多出交叉。
 *
 * 纯计算，不碰 DOM。
 * @module @xiaoso/dsh-workflow-lite/client/model/nudge
 */
import type { Rect } from './route.ts';
export interface Track {
    id: string;
    /** 颜色类（同一类的线可以合道）。 */
    group: string;
    /** 折点（含两头）。 */
    points: readonly [number, number][];
}
/**
 * 给一组直角线分道。返回挪过的线的新折点（没挪的不在结果里）；传进来的数组不改。
 * @param boxes - 卡片（道不能摆进卡片里）。
 */
export declare function nudge(tracks: readonly Track[], boxes: readonly Rect[]): Map<string, [number, number][]>;
/** 走廊线上的一块条件牌子：挂在 `y` 这条走廊上，只能在 `from`..`to` 之间挪，原本想放在 `prefer`。 */
export interface Chip {
    id: string;
    y: number;
    from: number;
    to: number;
    prefer: number;
    width: number;
}
/**
 * 走廊上的条件牌子错开摆：两条线并排走同一段走廊时（比如同一对步骤之间的「通过」和「未通过」），
 * 牌子原本落在同一个位置、一块压住另一块。按 id 依次摆，叠上了就沿着自己的走廊往两边挪，
 * 挪到走廊尽头都放不下就留在原处。返回每块牌子中心的 x。
 */
export declare function placeChips(chips: readonly Chip[]): Map<string, number>;
