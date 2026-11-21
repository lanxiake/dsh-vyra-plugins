/**
 * dsh-workflow-lite — 实例视图的顶栏：实例与工作流的下拉、总状态与进度；撤销重做、整理、检查结果
 * （和模板编辑的顶栏同一组）；打开模板、复制状态文件路径、「在看什么」与右栏开关。
 * 状态小标与下拉里「本会话的实例」那一段，工作流中心与模板编辑的顶栏也用。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/run/RunTopBar
 */
import { type InstanceSummary, type RunState, type RunStatus } from '../../../shared/runState.ts';
import type { ValidationProblem } from '../../../shared/types.ts';
import type { RunHistory } from '../../app/useRunHistory.ts';
import type { T } from '../../i18n.ts';
import type { TopSlots } from '../kit/topSlots.ts';
import type { RunViewProps } from './RunView.tsx';
/**
 * 实例视图顶栏里和模板编辑不同的那几块：不自己画顶栏，而是填进 `TopBar`（模板编辑与实例视图共用、不卸载）
 * 留出来的三个位置——下拉触发器里的内容、左边药丸里的状态与进度、右边的两组按钮。
 * 顶栏不换，名字下拉才能跨着两个视图保持打开。
 */
export declare function RunTopBar(props: RunViewProps & {
    summary: InstanceSummary | undefined;
    state: RunState | null;
    /** 顶栏上改整体状态：挑好就调用，和右栏「整体」那一排同一条路（改进草稿，底部草稿栏给反馈）。 */
    onSetStatus(to: RunStatus): void;
    /** 右栏开关右边「在看什么」的切换（顶栏最右）。 */
    nav: React.ReactNode;
    onTogglePanel(): void;
    /** 图和状态排成一条的撤销 / 重做。 */
    history: RunHistory;
    /** 这张图的检查结果（和模板同一套规则）；图还没读回来是 `null`。 */
    problems: readonly ValidationProblem[] | null;
    onTidy(): void;
    onLocate(nodeId: string): void;
    slots: TopSlots;
}): React.JSX.Element;
/** 搜索实例时可以搜的几段字：工作流名、状态、进度、创建时间。 */
export declare function runSearchTexts(t: T, item: InstanceSummary): readonly string[];
/**
 * 下拉里的一行实例：和工作流那一行同一个骨架（图标位放状态点、名字、右端小字；
 * 悬停时右端小字换成「设为当前」，同一个位置淡入淡出）。本会话的当前实例名字后面常驻一枚图钉。
 * 直接是列表的子项（选中底块、滑动、依次浮出都要求这样）。
 */
export declare function RunMenuRow(props: {
    t: T;
    item: InstanceSummary;
    /** 正在看的实例（选中）。 */
    active: boolean;
    /** 本会话的当前实例。 */
    current: boolean;
    /** 搜索词（已归一）。 */
    needle: string;
    onOpen(event: React.MouseEvent): void;
    onBind(): void;
}): React.JSX.Element;
