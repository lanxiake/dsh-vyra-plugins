/**
 * dsh-workflow-lite — 展示卡读到的几件事（按 `displayKey`）：表格的列名、文件夹里有几张图几个文件。
 * 设置浮层要用（挑列、选排序列；「自动」现在是图片墙还是文件列表），这些只有读了才知道——
 * 卡片读到了记在这里，浮层从这里拿，不为了它们再读一次。
 *
 * @module @xiaoso/dsh-workflow-lite/client/app/cardFacts
 */
/** 文件夹：图片几张、一共几项（只看筛过之后的）。 */
export interface FolderFacts {
    images: number;
    entries: number;
}
/** 卡片读到一份表头（和上次一样就不吵醒谁）。 */
export declare function publishTableHead(key: string, head: readonly string[]): void;
/** 这张卡读到的列名；还没读到是 `null`。 */
export declare function useTableHead(key: string): readonly string[] | null;
/** 卡片列出了文件夹（和上次一样就不吵醒谁）。 */
export declare function publishFolderFacts(key: string, facts: FolderFacts): void;
/** 这张卡列出的文件夹；还没列出来是 `null`。 */
export declare function useFolderFacts(key: string): FolderFacts | null;
