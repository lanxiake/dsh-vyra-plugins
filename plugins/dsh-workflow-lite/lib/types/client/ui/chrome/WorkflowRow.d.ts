/**
 * dsh-workflow-lite — 工作流下拉里的一行：点名字打开；改名、删除就在这一行上，不用先切过去。
 *
 * - 「改名 / 删除」两个小按钮平时藏着，悬停或键盘移到这一行时浮在右端，和步骤数换着显示
 *   （同一个位置淡入淡出，名字不挪）；触屏没有悬停，一直显示。
 * - 改名在原行换成输入框，高度不变：回车或点开确认，Esc 取消。
 * - 删除的确认卡挂在这一行的删除按钮上（由下拉统一管，见 `WorkflowSwitcher`）。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/chrome/WorkflowRow
 */
import type { WorkflowEntry } from '../../../shared/types.ts';
import type { T } from '../../i18n.ts';
export interface WorkflowRowProps {
    t: T;
    entry: WorkflowEntry;
    /** 正开着的这张。 */
    active: boolean;
    editing: boolean;
    /** 搜索词（已归一）：名字里命中的字加粗；空 = 不标。 */
    needle?: string;
    /** 这一行的确认卡开着：按钮保持显示。 */
    busy: boolean;
    /** 删除按钮的 ref：确认卡挂在它上面（只有确认卡指着这一行时才给）。 */
    deleteRef: React.RefObject<HTMLButtonElement> | undefined;
    onOpen(event: React.MouseEvent): void;
    onEdit(): void;
    /** 提交新名字；回 `false` = 名字不行，留在输入框里。 */
    onRename(value: string): Promise<boolean>;
    onCancelEdit(): void;
    onDelete(): void;
}
export declare function WorkflowRow(props: WorkflowRowProps): React.JSX.Element;
/** 删除确认卡上补的那句：正开着的要说编辑页会空出来，有版本的要说版本一起没。 */
export declare function deleteDesc(t: T, entry: WorkflowEntry, open: boolean): string;
