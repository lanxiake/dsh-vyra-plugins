/**
 * dsh-workflow-lite — 两版文字逐行比：哪几行删了、哪几行加了，没变的长段折起来。
 *
 * 先去掉首尾相同的行，中间用 Myers 差分（编辑最少的那种对齐）；改得太多（超过 {@link MAX_EDITS} 处）
 * 就不再找最优，中间整段当「删了旧的、加了新的」——这么大的改动逐行对齐也没法看。
 *
 * @module @xiaoso/dsh-workflow-lite/client/model/lineDiff
 */
export interface DiffLine {
    kind: 'same' | 'add' | 'del';
    text: string;
    /** 旧版里的行号（从 1 起；加的行没有）。 */
    a?: number;
    /** 新版里的行号（删的行没有）。 */
    b?: number;
}
/** 拆行：认 `\r\n`、`\n`；末尾的换行不算多出一行空行。 */
export declare function splitLines(text: string): string[];
/** 逐行比两版文字。 */
export declare function diffLines(before: string, after: string): DiffLine[];
/** 改了几行：加的、删的。 */
export declare function diffCounts(lines: readonly DiffLine[]): {
    add: number;
    del: number;
};
/** 显示的一段：几行，或一段折起来的没变的行。 */
export type DiffChunk = {
    kind: 'lines';
    lines: DiffLine[];
} | {
    kind: 'fold';
    lines: DiffLine[];
    at: number;
};
/**
 * 没变的长段折起来：改动上下各留 `context` 行，中间超过 `2 × context + 2` 行没变的折成一段（`at` 是它在第几行起）。
 * 一处都没改时整份折成一段。
 */
export declare function foldDiff(lines: readonly DiffLine[], context?: number): DiffChunk[];
