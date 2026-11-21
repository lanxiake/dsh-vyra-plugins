/**
 * dsh-workflow-lite — 实例视图的撤销 / 重做：把图的撤销栈和状态草稿的撤销栈排成一条
 * （顺序怎么对齐见 `model/runHistory.ts`）。顶栏的两个按钮和 Ctrl+Z / Ctrl+Shift+Z 都走这里。
 *
 * @module @xiaoso/dsh-workflow-lite/client/app/useRunHistory
 */
import { type HistorySide, type SideHistory } from '../model/runHistory.ts';
/** 一边要交给这里的东西。 */
export interface HistorySource {
    history: SideHistory;
    undo(): void;
    redo(): void;
    dropRedo(): void;
}
export interface RunHistory {
    canUndo: boolean;
    canRedo: boolean;
    undo(): void;
    redo(): void;
}
export declare function useRunHistory(sources: Record<HistorySide, HistorySource>): RunHistory;
