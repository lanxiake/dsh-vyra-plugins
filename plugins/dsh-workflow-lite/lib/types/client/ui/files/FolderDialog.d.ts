/**
 * dsh-workflow-lite — 点开一个文件夹资源的详情框：左边浏览（搜索、进子目录），右边预览选中的文件。
 *
 * 框子是 {@link DocViewer} 的小号：标题行有复制路径、用其他程序打开、关闭；这一项的说明收在「说明」开关里。
 * 可以复制路径、用其他程序打开或在文件管理器里显示；实例视图、记忆库、版本对话框等处都用它。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/files/FolderDialog
 */
import type { ResourceItem } from '../../../shared/types.ts';
import type { Desktop } from '../../app/desktop.ts';
import { type BrowseSource } from '../../app/useBrowse.ts';
import type { T } from '../../i18n.ts';
/**
 * 文件夹：左边浏览（搜索、进子目录、面包屑），右边预览选中的文件，见 {@link FolderBrowser}。
 * 这一项的说明（要求写在这里的东西）收在标题行的「说明」开关里，不占正文。
 * 从哪读由 `source` 定：实例里的资源（`runFolderSource`），或记忆库里的一条（`MemoryStore.source`）。
 */
export declare function FolderDialog(props: {
    t: T;
    source: BrowseSource;
    item: ResourceItem;
    desktop: Desktop | undefined;
    /** 文件夹还不存在时的说法（缺省「文件夹不存在」）。 */
    missing?: string;
    /** 一打开先看里面的哪一份（画布图墙上点的那张）。 */
    initial?: string | undefined;
    onClose(): void;
}): React.JSX.Element;
