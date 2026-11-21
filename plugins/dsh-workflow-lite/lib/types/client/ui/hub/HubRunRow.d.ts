/**
 * dsh-workflow-lite — 工作流中心里的一个实例：工作流名、会话标题、建立时间、目标；进度、总状态；
 * 查看、移到本会话、删除（文字按钮在前、图标按钮成组在后；确认卡浮在删除按钮旁边，问要不要连状态文件一起删；行不挪位）。
 * 整体状态的小标能点：挑一个新状态、二次确认后直接改（{@link HubRunStatus}）。
 * 状态文件读不出来时，小标能点：行下面展开原因（找不到的路径，或哪几处写得不对）。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/hub/HubRunRow
 */
import type { InstanceSummary, RunStatus } from '../../../shared/runState.ts';
import type { T } from '../../i18n.ts';
export declare function HubRunRow(props: {
    t: T;
    /** 第几行：挂上时按这个错开着浮出来。 */
    order: number;
    item: InstanceSummary;
    /** 会话怎么称呼（标题；找不到时是"会话已不在"之类）、是不是本会话。 */
    session: {
        text: string;
        mine: boolean;
    };
    canMove: boolean;
    /** 页上有别的行能移：这一行不能移时也给「移到本会话」留出位置，各行的删除对齐。 */
    moveSlot: boolean;
    onView(): void;
    onMove(): void;
    onDelete(withState: boolean): void;
    /** 改整体状态（已经过二次确认）。 */
    onSetStatus(to: RunStatus, options: {
        notify: boolean;
        note: string;
    }): void;
}): React.JSX.Element;
