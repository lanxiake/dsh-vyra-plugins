/**
 * dsh-workflow-lite — 实例视图右栏：选中一条线。
 *
 * 和模板里选中连线看到的一样，换成只读、带上本次运行：
 * - 两端（带各自的状态，点一下到那一步 / 那张卡）；
 * - 一张小表：**状态**（已流转 / 未流转，下面一行是依据：条件线看上游的判定）、
 *   **条件**（步骤之间的线）、**交接**（执行结果 / 只管先后）；连资源的线是写入方式或读取；
 * - **上游摘要**、**交接说明**：只露几行，点开看全文——下游拿到的就是它们；
 * - 用户输入的线：本次的回答；回头线说明在循环里、目标做到第几轮。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/run/RunEdge
 */
import { type GraphAnalysis } from '../../../shared/graph.ts';
import type { RunState } from '../../../shared/runState.ts';
import type { InputAnswer, WorkflowDocument, WorkflowEdge } from '../../../shared/types.ts';
import type { Desktop } from '../../app/desktop.ts';
import type { T } from '../../i18n.ts';
export declare function RunEdgeDetail(props: {
    t: T;
    snapshot: WorkflowDocument;
    analysis: GraphAnalysis;
    edge: WorkflowEdge;
    state: RunState | null;
    /** 本次经过的线；不记进度时为 `null`。 */
    taken: ReadonlySet<string> | null;
    answers: Readonly<Record<string, InputAnswer>> | undefined;
    desktop: Desktop | undefined;
    onSelectNode(id: string): void;
}): React.JSX.Element;
