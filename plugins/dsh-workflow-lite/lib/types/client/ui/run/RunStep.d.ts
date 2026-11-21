/**
 * dsh-workflow-lite — 实例视图右栏：选中一个步骤。
 *
 * 和模板里选中步骤看到的是同一套东西，只是都换成只读、带上本次运行的样子：
 * - 描述（最多三行）；
 * - 运行状态（能改，见 `RunNodeState.tsx`）；
 * - **提示词**：只露四行，点开看全文（可复制）；
 * - **用户输入**：问了什么、这次怎么答的，点一下看那道题；
 * - **产出 / 读取**：它写哪些、读哪些资源（`RunFiles.tsx`）；
 * - **连接**：上游、下游，和模板里同一种行（`LinkRow.tsx`），多了对面那一步的状态，箭头绿的是本次
 *   经过的线；点一行看那条线（线的两端再点一下就到对面那一步）。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/run/RunStep
 */
import type { GraphAnalysis } from '../../../shared/graph.ts';
import type { RunState } from '../../../shared/runState.ts';
import type { InputAnswer, StepNode, WorkflowDocument } from '../../../shared/types.ts';
import type { Desktop } from '../../app/desktop.ts';
import type { Run } from '../../app/useRuns.ts';
import type { T } from '../../i18n.ts';
export declare function RunStepDetail(props: {
    t: T;
    current: Run;
    snapshot: WorkflowDocument;
    analysis: GraphAnalysis;
    step: StepNode;
    state: RunState | null;
    /** 图里刚加、还没保存的步骤：没有运行状态可看。 */
    fresh?: boolean;
    /** 这次走过的线；不记进度时为 `null`。 */
    taken: ReadonlySet<string> | null;
    verdicts: readonly string[] | undefined;
    answers: Readonly<Record<string, InputAnswer>> | undefined;
    made: Readonly<Record<string, readonly (boolean | null)[]>>;
    desktop: Desktop | undefined;
    onRerun(): void;
    onSelectNode(id: string): void;
    onSelectEdge(id: string): void;
    onFocusFile(id: string | null): void;
    onViewPath(path: string): void;
    /** 改这一步的提示词（改的是这次执行的图，进草稿）。 */
    onEditPrompt(prompt: string): void;
    /** 一次编辑结束（弹窗关上）：断开撤销合并。 */
    onSeal(): void;
}): React.JSX.Element;
