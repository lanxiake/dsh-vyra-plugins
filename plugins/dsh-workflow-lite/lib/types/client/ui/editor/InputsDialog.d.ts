/**
 * dsh-workflow-lite — 「执行前填写」：图里有输入节点时，点「执行」先在这里回答问题。
 *
 * 问题按画布上从上到下、从左到右的顺序排。每题显示问题、说明（只给填写的人看）、按题型的控件：
 * 一句话 / 多行文字是输入框（占位文字是灰字提示、默认值预先填好），单选 / 多选是一列选项。
 * 必填的都有了回答才能执行；回答随「执行」一起交给插件，编译进计划的「本次执行」段。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/editor/InputsDialog
 */
import type { InputAnswer, InputNode } from '../../../shared/types.ts';
import type { T } from '../../i18n.ts';
export declare function InputsDialog(props: {
    t: T;
    name: string;
    inputs: readonly InputNode[];
    /** 上一次在这里填的回答（预先填好）。 */
    initial: Record<string, InputAnswer> | undefined;
    /** 在哪里执行（新建会话 / 本会话 / 某个会话的标题）。 */
    where: string;
    onSubmit(answers: Record<string, InputAnswer>): void;
    onClose(): void;
}): React.JSX.Element;
