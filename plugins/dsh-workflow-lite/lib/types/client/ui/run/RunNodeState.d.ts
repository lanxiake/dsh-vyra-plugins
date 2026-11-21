/**
 * dsh-workflow-lite — 实例视图里一个步骤的运行状态：状态、轮次、判定、摘要、失败原因（都能改，改动进草稿），
 * 以及谁做的、什么时候开始结束。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/run/RunNodeState
 */
import { type NodeStatus, type RunState, type StateEdit } from '../../../shared/runState.ts';
import type { Desktop } from '../../app/desktop.ts';
import type { Run } from '../../app/useRuns.ts';
import type { LocaleKey, T } from '../../i18n.ts';
import { type IconName } from '../kit/Icon.tsx';
/** 步骤状态的一句话说明（悬停提示）。 */
export declare function nodeHint(status: NodeStatus): LocaleKey;
export declare const NODE_ICON: Record<NodeStatus, IconName>;
export declare function isEdited(draft: readonly StateEdit[], path: readonly string[]): boolean;
/** 改了还没保存的字段：标题旁一个小圆点。 */
export declare function EditedDot(props: {
    on: boolean;
}): React.JSX.Element | null;
/** 状态小标（只读）：用到它的步骤、上下游里每一行行尾的那个。 */
export declare function StatusChip(props: {
    t: T;
    status: NodeStatus | undefined;
}): React.JSX.Element | null;
/** 一排状态按钮里的一个。 */
export interface ChoiceOption<V extends string> {
    value: V;
    text: string;
    /** 用哪种状态色（`data-run-status`）。 */
    status: string;
    /** 字前面的小图标 / 圆点：选中时弹一下。 */
    mark?: React.ReactNode;
    tip?: string;
    testId?: string;
}
/**
 * 一排可换行的状态按钮（单选）：选中块从旧的一个滑到新的一个，颜色跟着状态色交叉淡过去
 * （见 motion/thumb.tsx 的 PickThumb）；字和小图标的颜色是两层交叉淡（FadeText / FadeMark），
 * 字重不变，换选中时这一排不会被挤动。
 */
export declare function Choices<V extends string>(props: {
    label: string;
    value: V | null | undefined;
    options: readonly ChoiceOption<V>[];
    onPick(value: V): void;
}): React.JSX.Element;
/** 状态、轮次、判定、摘要、失败原因。 */
export declare function StepStatus(props: {
    t: T;
    current: Run;
    id: string;
    node: RunState['nodes'][string];
    verdicts: readonly string[] | undefined;
    onRerun(): void;
    /** 摘要、失败原因的弹窗：标题与图标块。 */
    name: string;
    badge: React.ReactNode;
    desktop: Desktop | undefined;
}): React.JSX.Element;
/** 谁做的、什么时候开始、什么时候结束；都没有就不画。 */
export declare function StepFacts(props: {
    t: T;
    node: RunState['nodes'][string] | undefined;
}): React.JSX.Element | null;
