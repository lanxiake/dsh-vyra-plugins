/**
 * dsh-workflow-lite — 点开一个自定义文字资源的详情框：整段排版显示，可以复制。
 *
 * 框子是 {@link DocViewer} 的小号；这一项的说明收在标题行的「说明」开关里。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/files/TextDialog
 */
import type { ResourceItem } from '../../../shared/types.ts';
import type { Desktop } from '../../app/desktop.ts';
import type { T } from '../../i18n.ts';
/** 自定义文字：整段排版显示。 */
export declare function TextDialog(props: {
    t: T;
    item: ResourceItem;
    desktop: Desktop | undefined;
    onClose(): void;
}): React.JSX.Element;
