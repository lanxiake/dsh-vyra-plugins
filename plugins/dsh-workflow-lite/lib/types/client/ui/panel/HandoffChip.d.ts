/**
 * dsh-workflow-lite — 连接清单里一条步骤间的线交了什么：交执行结果 / 交接说明 / 只管先后。
 *
 * 属性面板（模板）与实例右栏的连接清单（{@link LinkRow}）共用；交接开关本身在 `editor/Handoff.tsx`。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/panel/HandoffChip
 */
import type { WorkflowEdge } from '../../../shared/types.ts';
import type { T } from '../../i18n.ts';
/** 一条步骤间的线交了什么（属性面板的连接清单里用）。 */
export declare function HandoffChip(props: {
    t: T;
    edge: WorkflowEdge;
}): React.JSX.Element;
