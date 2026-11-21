/**
 * dsh-workflow-lite — 展示区里的 CSV / TSV 表：表头钉在上面，按设置隐藏列、排序、画条，新加的行亮一下。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/display/views/TableView
 */
import type { TableView } from '../../../../shared/types.ts';
import type { RunLine } from '../../../../shared/wire/run.ts';
import type { T } from '../../../i18n.ts';
import type { Display } from '../../../model/display.ts';
import type { LineWindow } from '../../../model/logLines.ts';
import { type Marks } from './follow.ts';
/** 卡片上的表：读到的列名记在哪（设置浮层挑列用），进了交互点表头排序写回哪。 */
export interface TableEnv {
    headKey: string;
    onTable?: ((table: TableView | undefined) => void) | undefined;
}
/** 改表格设置里的一项（`undefined` 是去掉）；全去掉了就是 `undefined`。 */
export declare function patchTable(view: TableView, patch: Partial<TableView>): TableView | undefined;
/**
 * CSV / TSV 排成表：表头钉在上面（进了交互滚着看也在），超出的那边淡出，新加的行亮一下。
 * 按设置隐藏几列、按一列排、数字列画条；进了交互点表头排序（写回设置）。
 * 只读了末尾一截的（`tail`）：没有行号（不知道是第几行），停在最底下跟着新加的行走；排了序就不跟。
 */
export declare function TableFlow(props: {
    t: T;
    text: string;
    format: 'csv' | 'tsv';
    display: Display;
    interactive: boolean;
    env: TableEnv | undefined;
    /** 按行读的：新加的几行外面比好了给进来；不给就和上一份文字比。 */
    marks?: Marks | null;
    tail?: boolean;
    /** 表格下面那句（按行读的：前面 / 后面还有多少）；不给就数没排出来的行。 */
    note?: string | null;
}): React.JSX.Element;
/**
 * 按行读回来的表（`run/lines`）：表头是文件第一行（从头看时就是窗口第一行，看末尾时另读一行），
 * 表体是窗口里其余的行。新加的行 = 这一回窗口里多出来的行首位置（都在末尾）。
 */
export declare function TableLines(props: {
    t: T;
    win: LineWindow;
    /** 文件第一行（看末尾时另读的）。 */
    head: RunLine | null;
    format: 'csv' | 'tsv';
    display: Display;
    interactive: boolean;
    tail: boolean;
    env: TableEnv | undefined;
}): React.JSX.Element;
