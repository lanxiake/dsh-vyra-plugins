/**
 * dsh-workflow-lite — 顶栏下拉里的搜索与分组：一个搜索框同时过滤「实例」和「工作流」，
 * 实例默认只露出最近几个，其余折在「显示全部」后面。纯函数，不碰界面。
 *
 * @module @xiaoso/dsh-workflow-lite/client/model/switcherSearch
 */
/** 实例默认露出几个（其余折叠）。 */
export declare const RUNS_SHOWN = 3;
/** 搜索词归一：去首尾空白、不分大小写。 */
export declare function normalizeNeedle(query: string): string;
/** `needle`（已归一）在 `text` 里第一次出现的区间；没有 = `null`。空搜索词不命中任何字。 */
export declare function matchRange(text: string, needle: string): readonly [number, number] | null;
/** 工作流按名字过滤（保持传入顺序）。 */
export declare function filterWorkflows<T extends {
    name: string;
}>(list: readonly T[], needle: string): T[];
/**
 * 实例过滤：`haystacks` 给出一个实例上可以搜的几段文字（工作流名、状态文字、时间……），任一段含搜索词就算命中。
 */
export declare function filterRuns<T>(list: readonly T[], needle: string, haystacks: (item: T) => readonly string[]): T[];
/** 本会话的当前实例排最前，其余保持原来的顺序（新的在前）。 */
export declare function currentFirst<T extends {
    id: string;
}>(list: readonly T[], current: string | undefined): T[];
/**
 * 实例这一组此刻露出哪几个。
 *
 * - 展开了、或者搜索中（`expanded`）：全部；
 * - 否则最前 {@link RUNS_SHOWN} 个，再加上正在看的那个（它藏在折叠里会让人找不到选中项）；
 * - 只多出一个时直接露出：「显示全部」那一行本身就占一行，不如直接放它。
 */
export declare function visibleRuns<T extends {
    id: string;
}>(list: readonly T[], options: {
    expanded: boolean;
    active: string | null;
    limit?: number;
}): {
    shown: T[];
    hidden: number;
};
