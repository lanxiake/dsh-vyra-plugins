/**
 * dsh-workflow-lite — 「内容」一组里 CSV / TSV 表的那几项。
 * 位置、列（点一下隐藏）、排序、数字列画条。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/display/options/TableOptions
 */
import type { TableView } from '../../../../shared/types.ts';
import type { T } from '../../../i18n.ts';
/**
 * 表格的那几项：位置、列（一列一个小药丸，点一下藏起来 / 露出来，至少留一列）、排序（选一列 + 方向）、数字列画条。
 * 列名是卡片读到的（还没读到时只列已经藏起来的）。文件里已经没有的列，藏着的也列出来，好放出来。
 */
export declare function TableOptions(props: {
    t: T;
    value: TableView;
    headKey: string;
    onChange(table: TableView | undefined): void;
}): React.JSX.Element;
