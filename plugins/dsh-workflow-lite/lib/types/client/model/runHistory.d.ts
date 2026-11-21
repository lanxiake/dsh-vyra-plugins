/**
 * dsh-workflow-lite — 实例视图的撤销 / 重做：图的改动和状态的改动排成一条。
 *
 * 两边各有自己的撤销栈（图：编辑器状态机；状态：草稿）。这里只记"每一步是哪一边的"，
 * 撤销时弹出最后一步、交给那一边撤；两边的栈有了变化（新的一步、到上限挤掉最早的、存完 / 放弃后清空），
 * 用 {@link reconcileOrder} 把这条顺序对齐回去。
 *
 * 新的一步之后不能再重做：哪一边有了新的一步，另一边的重做栈也要丢掉（`dropFuture` 告诉调用方丢哪边）。
 *
 * @module @xiaoso/dsh-workflow-lite/client/model/runHistory
 */
export type HistorySide = 'graph' | 'state';
export declare const HISTORY_SIDES: readonly HistorySide[];
/** 一边的撤销栈：能撤几步、能重做几步、一共压过几步（只增不减）。 */
export interface SideHistory {
    past: number;
    future: number;
    seq: number;
}
/** 排成一条的顺序：`past` 的最后一项是下一次撤销的那一边，`future` 的最后一项是下一次重做的那一边。 */
export interface HistoryOrder {
    past: HistorySide[];
    future: HistorySide[];
}
export declare const EMPTY_ORDER: HistoryOrder;
/** 两边的栈从 `before` 变成 `after` 之后，对齐这条顺序。 */
export declare function reconcileOrder(order: HistoryOrder, before: Record<HistorySide, SideHistory>, after: Record<HistorySide, SideHistory>): {
    order: HistoryOrder;
    dropFuture: HistorySide[];
};
/** 撤一步：弹出最后一步交给那一边（顺序空了但某一边还能撤，就撤那一边）。 */
export declare function undoStep(order: HistoryOrder, sides: Record<HistorySide, SideHistory>): {
    order: HistoryOrder;
    side: HistorySide;
} | null;
/** 重做一步：弹出最近撤掉的那一步。 */
export declare function redoStep(order: HistoryOrder, sides: Record<HistorySide, SideHistory>): {
    order: HistoryOrder;
    side: HistorySide;
} | null;
