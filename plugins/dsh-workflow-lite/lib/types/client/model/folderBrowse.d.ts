/**
 * dsh-workflow-lite — 文件夹浏览（实例里点开一个文件夹资源）用到的几个纯函数：
 * 相对路径怎么拼、面包屑怎么折、筛选与命中的字、键盘上下选。
 *
 * `sub` 都是相对那个文件夹的路径：`/` 分隔、没有首尾斜杠，文件夹本身是空串（和 `run/dir` 回的一致）。
 *
 * @module @xiaoso/dsh-workflow-lite/client/model/folderBrowse
 */
/** 文件夹 `sub` 下面叫 `name` 的那一项的 `sub`。 */
export declare function joinSub(sub: string, name: string): string;
/** 上一层；已经是文件夹本身就还是空串。 */
export declare function parentSub(sub: string): string;
/** 面包屑的一段：`sub` 是点它去哪儿；`null` 是被折起来的省略号（不能点）。 */
export interface Crumb {
    label: string;
    sub: string | null;
}
/** 从文件夹本身（叫 `root`）一路到 `sub` 的每一层。 */
export declare function crumbsOf(root: string, sub: string): Crumb[];
/**
 * `name` 里命中 `query` 的几段（按字符位置、合并重叠、从前到后）。
 * `query` 按空白拆成几个词，每个词都要出现（不分大小写）才算命中，否则是 `null`；`query` 为空命中一切、没有高亮。
 */
export declare function matchRanges(name: string, query: string): [number, number][] | null;
/** 留下命中的项（次序不变），连同要高亮的几段。 */
export declare function filterEntries<E extends {
    name: string;
}>(entries: readonly E[], query: string): {
    entry: E;
    ranges: [number, number][];
}[];
/** 把名字按命中的几段切开：`hit` 为真的那几块要高亮。 */
export declare function splitByRanges(name: string, ranges: readonly [number, number][]): {
    text: string;
    hit: boolean;
}[];
/**
 * 键盘上下选：从 `current` 往前 / 往后一项（到头就停在头，不绕回去）；还没选过时下键选第一项、上键选最后一项。
 * `names` 是此刻看得见的几项（筛选之后）。
 */
export declare function stepCursor(names: readonly string[], current: string | null, move: 'next' | 'prev' | 'first' | 'last'): string | null;
