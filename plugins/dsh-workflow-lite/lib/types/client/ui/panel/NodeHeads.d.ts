/**
 * dsh-workflow-lite — 各种东西的右栏标题栏：步骤、输入、连线。
 * 资源的在 `resources/ResourceHead.tsx`，概览的在 `run/OverviewHead.tsx`（各自依赖的图标块在那两边）。
 *
 * 模板的属性面板、实例右栏的「运行」与「编辑」都用这几个，所以实例里两边切换时标题栏一点不动。
 * 右边的 `extra` 放在关闭按钮左边（实例里是「运行 / 编辑」的切换）。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/panel/NodeHeads
 */
import type { GraphAnalysis } from '../../../shared/graph.ts';
import type { InputNode, StepNode, WorkflowDocument, WorkflowEdge } from '../../../shared/types.ts';
import type { LocaleKey, T } from '../../i18n.ts';
import type { Edit } from '../../model/editor.ts';
import { type IconName } from '../kit/Icon.tsx';
export interface HeadProps {
    t: T;
    /** 关闭按钮左边的东西。 */
    extra?: React.ReactNode;
    onClose(): void;
    closeTestId?: string;
}
/** 名称会进计划里的表格：换行与竖线直接不让打进来。 */
export declare function cleanName(value: string): string | undefined;
export declare function StepHead(props: HeadProps & {
    node: StepNode;
    onEdit(edit: Edit): void;
    onSeal(): void;
}): React.JSX.Element;
export declare function InputHead(props: HeadProps & {
    node: InputNode;
}): React.JSX.Element;
/** 线的标题与图标（右栏标题栏、顶栏「在看什么」用）。 */
export declare function edgeHead(doc: WorkflowDocument, analysis: GraphAnalysis, edge: WorkflowEdge): {
    icon: IconName;
    title: LocaleKey;
};
export declare function EdgeHead(props: HeadProps & {
    doc: WorkflowDocument;
    analysis: GraphAnalysis;
    edge: WorkflowEdge;
}): React.JSX.Element;
