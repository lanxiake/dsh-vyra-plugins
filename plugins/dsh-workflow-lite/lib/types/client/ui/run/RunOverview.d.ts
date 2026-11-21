/**
 * dsh-workflow-lite — 实例视图右栏什么都没选时的概览：总状态与进度、执行位置、说明、基本信息、时间线；
 * 不记运行状态的实例只讲清楚为什么看不到进度。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/run/RunOverview
 */
import type { RunCursor } from '../../../shared/runCursor.ts';
import { type InstanceSummary, type RunState } from '../../../shared/runState.ts';
import type { WorkflowDocument } from '../../../shared/types.ts';
import type { Run } from '../../app/useRuns.ts';
import type { T } from '../../i18n.ts';
/** 不记运行状态的实例：右栏只讲清楚为什么看不到进度，再列几样基本信息。 */
export declare function Untracked(props: {
    t: T;
    summary: InstanceSummary;
    snapshot: WorkflowDocument;
}): React.JSX.Element;
export declare function Overview(props: {
    t: T;
    current: Run;
    snapshot: WorkflowDocument;
    state: RunState;
    cursor: RunCursor | null;
    summary: InstanceSummary | undefined;
    labelOf(id: string): string;
    onSelect(id: string | null): void;
}): React.JSX.Element;
