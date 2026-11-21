/**
 * dsh-workflow-lite — CSV / TSV 排成表（展示卡、查看框共用）。
 *
 * 第一行当表头、钉在上面；最左一列行号、横着滚时也钉着；数字列右对齐、等宽数字；隔行一层浅底。
 * 列宽跟着内容走，太长的格子截成省略号（悬停看全文）；格子里的换行显示成 ⏎，一行还是一行。
 * 只排前 `maxRows` 行，后面的说一句「还有 N 行」。文件更新后新加的行亮一下（`marks`）。
 * 展示卡还能按设置隐藏几列（`hide`）、按一列排（`sort`，只排读到的这些行）、数字列垫一条按大小比例的浅条（`bars`）；
 * 给了 `onSort` 表头能点：点一下从小到大，再点倒过来，第三下回到原顺序。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/kit/DataTable
 */
import type { TableView } from '../../../shared/types.ts';
import type { T } from '../../i18n.ts';
type TableSort = NonNullable<TableView['sort']>;
/** 点表头时下一步：没排 → 从小到大 → 从大到小 → 不排。 */
export declare function nextSort(sort: TableSort | undefined, column: string): TableSort | undefined;
export declare function DataTable(props: {
    t: T;
    text: string;
    format: 'csv' | 'tsv';
    maxRows: number;
    /** 卡片里：字小一号、行矮一点、不接悬停。 */
    compact?: boolean;
    /** 表格下面那句「还有 N 行」怎么说（卡片里多一句「打开查看全部」）。 */
    moreText?: string;
    /** 表格下面那句直接给（按行读的：「前面还有 1.3 MB」）；给了就不数行。 */
    note?: string | null;
    /** 新加的几行（表体行号，从 0 起）：亮一下再淡下去；`parity` 每次更新换一个，高亮从头再来。 */
    marks?: {
        items: ReadonlySet<number>;
        parity: 0 | 1;
    } | null;
    /** 左边的行号（只读了末尾一截时不知道是第几行，不排）。 */
    numbers?: boolean;
    hide?: readonly string[] | undefined;
    sort?: TableSort | undefined;
    bars?: boolean | undefined;
    /** 表头能点着排（展示卡进了交互）。 */
    onSort?: ((sort: TableSort | undefined) => void) | undefined;
    /** 读到的列名（设置浮层里挑列用）。 */
    onHead?: ((names: readonly string[]) => void) | undefined;
}): React.JSX.Element;
/** 表的大小说明：「128 行 × 6 列」（查看框标题行用）。 */
export declare function tableSize(t: T, text: string, format: 'csv' | 'tsv'): string;
export {};
