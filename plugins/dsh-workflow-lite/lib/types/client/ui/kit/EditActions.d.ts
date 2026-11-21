/**
 * dsh-workflow-lite — 原地改名输入框末尾的「确认」「取消」两个小按钮。
 *
 * 输入框一失焦就会提交，所以按钮按下时不能抢走输入框的焦点（`mousedown` 里 `preventDefault`），
 * 不然点「取消」会先因为失焦被当成提交。键盘仍是回车确认、Esc 取消，按钮给只用鼠标的人一条明路。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/kit/EditActions
 */
import type { T } from '../../i18n.ts';
export declare function EditActions(props: {
    t: T;
    onConfirm(): void;
    onCancel(): void;
}): React.JSX.Element;
