/**
 * dsh-workflow-lite — 连接清单的一行（模板的属性面板与实例的右栏共用）。
 *
 * 上面一行：方向箭头、对面那一步的图标与名字、回头线的环、条件小标，行尾可放一样东西
 * （实例里是对面那一步的状态）；下面一行是这条线交了什么。整行点下去选中这条线。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/panel/LinkRow
 */
import type { WorkflowEdge, WorkflowNode } from '../../../shared/types.ts';
import type { T } from '../../i18n.ts';
/** 条件的小标（和画布上那条线同色）；`always` 时只有要求才画。 */
export declare function WhenChip(props: {
    t: T;
    when: string | undefined;
    always?: boolean;
}): React.JSX.Element | null;
export declare function LinkRow(props: {
    t: T;
    edge: WorkflowEdge;
    direction: 'in' | 'out';
    /** 对面那个节点（找不到时按 id 显示）。 */
    other: WorkflowNode | undefined;
    otherId: string;
    back: boolean;
    /** 这次走过没有（实例里）；不给 = 不表态。 */
    taken?: boolean | undefined;
    takenLabel?: string | undefined;
    end?: React.ReactNode;
    testId: string;
    onPick(): void;
}): React.JSX.Element;
