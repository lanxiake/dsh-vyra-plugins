/**
 * dsh-workflow-lite — 工作流中心「工作流」页左边的一行：点它看这张的版本；改名、删除就在这一行上。
 *
 * - 「改名 / 删除」平时藏着，悬停或键盘移到这一行时浮在右端，和「正在编辑」的小绿点换着显示
 *   （只动透明度，名字不挪）；触屏没有悬停，一直显示。
 * - 改名只把名字那一行换成一条细输入框，下面一行换成按键提示，整行高度不变：
 *   回车或点开确认，Esc 取消（对话框不跟着关）。
 * - 删除的确认卡挂在这一行的删除按钮上（由 `HubWorkflowList` 统一管）。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/hub/HubWorkflowRow
 */
import type { WorkflowEntry } from '../../../shared/types.ts';
import type { T } from '../../i18n.ts';
export interface HubWorkflowRowProps {
    t: T;
    entry: WorkflowEntry;
    /** 列表动画认的键（改过名的行沿用旧键，见 model/rowKeys.ts）。 */
    flipKey: string;
    /** 右边正显示这张。 */
    selected: boolean;
    /** 编辑页正开着这张。 */
    open: boolean;
    editing: boolean;
    /** 这一行的确认卡开着：按钮保持显示。 */
    busy: boolean;
    /** 删除按钮的 ref：确认卡挂在它上面（只有确认卡指着这一行时才给）。 */
    deleteRef: React.RefObject<HTMLButtonElement> | undefined;
    onPick(): void;
    onEdit(): void;
    /** 提交新名字；回 `false` = 名字不行，留在输入框里。 */
    onRename(value: string): Promise<boolean>;
    onCancelEdit(): void;
    onDelete(): void;
}
export declare function HubWorkflowRow(props: HubWorkflowRowProps): React.JSX.Element;
