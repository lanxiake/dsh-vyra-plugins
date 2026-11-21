/**
 * dsh-workflow-lite — 文件夹展示的两件小事：按名字筛（「只看」）、按设置排。纯函数，展示卡和测试共用。
 *
 * @module @xiaoso/dsh-workflow-lite/client/model/folderView
 */
import type { GalleryView } from '../../shared/types.ts';
interface Entry {
    name: string;
    dir: boolean;
    size: number;
    mtime: number;
}
/**
 * 「只看」写的几个名字式子（逗号、空格隔开）：`*` 是任意几个字、`?` 是一个字，不分大小写；
 * 不带 `*`、`?` 的当「名字里有这几个字」。没写就是都要。
 */
export declare function nameMatcher(match: string | undefined): (name: string) => boolean;
/** 按设置排：缺省最新在前，`name` 按名字（带数字的按大小），`size` 大的在前；一样的按名字。 */
export declare function folderOrder(order: GalleryView['order']): (a: Entry, b: Entry) => number;
export {};
