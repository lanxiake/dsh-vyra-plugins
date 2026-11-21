/**
 * dsh-workflow-lite — 展示区里文件夹的文件列表：文件夹在前，一行一项或排成格子。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/display/views/FolderList
 */
import type { GalleryView as FolderSettings } from '../../../../shared/types.ts';
import type { RunDirEntry } from '../../../../shared/wire/run.ts';
import type { T } from '../../../i18n.ts';
/**
 * 文件夹按文件列出（没有图片、或设成「文件列表」）：文件夹在前，其余按设置排。
 * 一行一项（右边大小，可带修改时间），或排成格子（大一号的类型标记、名字两行、大小）。
 */
export declare function FolderList(props: {
    t: T;
    entries: readonly RunDirEntry[];
    view: FolderSettings;
}): React.JSX.Element;
