/**
 * dsh-workflow-lite — 输入节点的属性面板，与步骤面板里「用户输入」那一小节。
 *
 * 一个输入节点 = 执行前问用户的一个问题：
 * - **问题**与用户的**回答**原样进计划，交给连着的步骤（一条没连 = 交给整个工作流）；
 * - **怎么回答**：一句话 / 多行文字 / 单选 / 多选；选择题在这里编辑选项，点选项左边的圈设成默认；
 * - **默认值**：用户没改就用它；**必填**：没有回答也没有默认值时不能执行；
 * - **占位文字**与**说明**只给填写的人看，不进计划。
 *
 * 文本框都是受控的：每敲一个字就改文档（合并成一条撤销步），失焦时封口。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/editor/InputPanel
 */
import type { InputNode, StepNode, WorkflowDocument } from '../../../shared/types.ts';
import type { T } from '../../i18n.ts';
import { type Edit, type Selection } from '../../model/editor.ts';
export interface InputPanelProps {
    t: T;
    doc: WorkflowDocument;
    node: InputNode;
    onEdit(edit: Edit): void;
    onSelect(selection: Selection): void;
    onSeal(): void;
    onRemove(id: string): void;
    /** 标题栏里关闭按钮左边的切换（实例视图里「运行 / 编辑」）。 */
    tabs?: React.ReactNode;
}
export declare function InputPanel(props: InputPanelProps): React.JSX.Element;
/**
 * 步骤面板里的「用户输入」：交给这一步的问题（点一下选中那个输入）。一个都没连就不出现。
 */
export declare function StepInputsField(props: {
    t: T;
    doc: WorkflowDocument;
    step: StepNode;
    onSelect(selection: Selection): void;
}): React.JSX.Element | null;
