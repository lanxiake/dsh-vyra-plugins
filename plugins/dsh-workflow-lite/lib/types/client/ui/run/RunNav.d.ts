/**
 * dsh-workflow-lite — 实例顶栏最右（右栏开关右边）的「在看什么」：图标就是右栏里正在看的那个东西的图标（同色），
 * 概览是固定的概览图标；右栏收着时没有在看的东西，图标块不上色。点开按分类列出这次执行的节点
 * （概览 / 步骤 / 资源 / 输入），能搜，点一项就切过去（右栏收着就打开）。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/run/RunNav
 */
import type { GraphAnalysis } from '../../../shared/graph.ts';
import type { RunState } from '../../../shared/runState.ts';
import type { WorkflowDocument } from '../../../shared/types.ts';
import type { T } from '../../i18n.ts';
import { type Selection } from '../../model/editor.ts';
export declare function RunNav(props: {
    t: T;
    doc: WorkflowDocument;
    analysis: GraphAnalysis;
    state: RunState | null;
    selection: Selection;
    /** 右栏收着：没有在看的东西，图标块不上色（不像是开着的）。 */
    idle: boolean;
    onPick(selection: Selection): void;
}): React.JSX.Element;
