/**
 * dsh-workflow-lite — 文本类产出换个样子看：CSV / TSV 排成表、压成一行的 JSON 展开缩进、
 * 文件更新后哪几行是新的（追加的日志、改过的行）。纯函数，展示卡和查看框共用。
 *
 * @module @xiaoso/dsh-workflow-lite/client/model/textShape
 */
/** 按扩展名能不能排成表（分隔符的细节见 {@link parseDelimited}）。 */
export { tableFormat } from '../../shared/fileKind.ts';
export interface ParsedTable {
    /** 第一行当表头。 */
    head: string[];
    /** 表体（最多 `maxRows` 行）。 */
    rows: string[][];
    /** 表体一共几行（含没排出来的）。 */
    total: number;
    /** 最宽那一行有几列（短的行按空格子补齐）。 */
    columns: number;
}
/**
 * CSV 的分隔符：`.tsv` 是制表符；`.csv` 默认逗号，第一行里分号比逗号多就用分号（欧洲区域设置导出的 Excel 常这样）。
 */
export declare function delimiterOf(format: 'csv' | 'tsv', text: string): string;
/**
 * 按 RFC 4180 拆：双引号包住的格子里可以有分隔符、换行，`""` 是一个引号；行尾认 `\r\n` 和 `\n`，末尾的空行不算。
 * 只拆到 `maxRows` 行表体为止，后面的只数行数（大文件不整份拆开）。
 */
export declare function parseDelimited(text: string, delimiter: string, maxRows: number): ParsedTable;
export declare function isNumeric(cell: string): boolean;
/** 每一列是不是数字列（非空格子里七成以上像数字）：数字列右对齐、等宽数字，一眼比得出大小。 */
export declare function numericColumns(table: ParsedTable): boolean[];
/** 列的名字（隐藏、排序按名字记，文件里列换了位置也认得）：表头没写的叫 `#3`。 */
export declare function columnName(head: readonly string[], column: number): string;
/** 格子里的数（去掉千分位、货币符号、单位）；不像数的是 `null`。 */
export declare function numberOf(cell: string): number | null;
/**
 * 按一列排：数字列比大小，别的按文字（带数字的按数字大小）；空的、不像数的总在最后。一样的保持原顺序。
 * 回的是行号的新顺序（原来的行号还用得着：新加的行亮一下认的是原来的位置）。
 */
export declare function sortOrder(rows: readonly string[][], column: number, numeric: boolean, desc: boolean): number[];
/** 超过这么大的 JSON 不展开（展开要整份解析一遍）。 */
export declare const PRETTY_JSON_MAX: number;
/**
 * 压成一行（或几行很长）的 JSON 展开成两格缩进；已经排好版的、解析不了的、太大的回 `null`（原样显示）。
 * 只改显示，文件本身不动。
 */
export declare function prettyJson(path: string, text: string): string | null;
/**
 * 文件从 `before` 变成 `after`：新的几行（`after` 里的行号，从 0 起）。
 * 在后面追加的（日志）只比较开头，不做整份差分；改得太多（超过一半）不标——那是整份重写，标了也满屏都是。
 */
export declare function newLines(before: string, after: string): Set<number>;
