/**
 * dsh-workflow-lite — 资源详情框标题行里的小图标：按内容种类（文件夹、网址、自定义文字）换图标和颜色。
 *
 * 文件夹框（{@link FolderDialog}）、自定义文字框（{@link TextDialog}）和实例视图里的网址框都是 {@link DocViewer} 的小号，
 * 标题行的 `badge` 位放的都是它。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/files/Badge
 */
import type { ResourceItem } from '../../../shared/types.ts';
export declare function Badge(props: {
    kind: ResourceItem['kind'];
}): React.JSX.Element;
