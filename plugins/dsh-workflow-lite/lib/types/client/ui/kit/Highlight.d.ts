/**
 * dsh-workflow-lite — 搜索命中的那几个字：加粗、换成强调色，不加底色（行的悬停 / 选中底色已经够多了）。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/kit/Highlight
 */
/** `needle` 是已归一的搜索词（见 `normalizeNeedle`）；空 = 原样输出。 */
export declare function Highlight(props: {
    text: string;
    needle: string;
}): React.JSX.Element;
