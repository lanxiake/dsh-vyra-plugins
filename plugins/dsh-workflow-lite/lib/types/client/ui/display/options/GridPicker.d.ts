/**
 * dsh-workflow-lite — 文件夹图片墙的张数：8 × 6 的小方格，指针扫过去预览，点一下定下。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/display/options/GridPicker
 */
import type { T } from '../../../i18n.ts';
type Grid = {
    columns: number;
    rows: number;
};
/**
 * 挑几列几行：8 × 6 的小方格，指针扫过去预览（亮起左上角那一块），点一下定下；方向键一格一格改。
 * 第一张放大时左上角两列两行深一档（那一块是一张）。
 */
export declare function GridPicker(props: {
    t: T;
    value: Grid;
    hero: boolean;
    onChange(grid: Grid): void;
}): React.JSX.Element;
export {};
