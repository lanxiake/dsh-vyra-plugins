/**
 * dsh-workflow-lite — 步骤库（左侧浮动面板）。
 *
 * 两种手势，各管一件事：
 * - **拖**：拖到画布上哪里，步骤就落在哪里。往图里加东西只有这一条路（和右侧面板里那个
 *   明确写着「添加到画布」的按钮）——单击加节点落点不明确，容易误加。
 * - **点**：在右侧面板里看它。常用步骤只读；我的步骤可以改、可以删。
 *
 * 「基础」「常用步骤」「我的步骤」三节都能收起，收起状态记在本机；标题右边的数字是这一节里有几项，收起后也看得出。
 * 「基础」里的「记忆」拖出去后再选已有的 / 新建。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/editor/Library
 */
import type { TemplateEntry } from '../../../shared/types.ts';
import type { T } from '../../i18n.ts';
import { type LibraryFocus } from '../../model/library.ts';
export declare function Library(props: {
    t: T;
    templates: readonly TemplateEntry[];
    focus: LibraryFocus | null;
    onFocus: (focus: LibraryFocus) => void;
    onNewStep: () => void;
    onClose: () => void;
}): React.JSX.Element;
