/**
 * dsh-workflow-lite — 实例视图里选中一个输入节点：这次执行用户是怎么回答的。
 *
 * 问题、用户的回答（执行前填的，已补上默认值），以及回答交给了哪些步骤（点一下看那一步）。
 * 回答是实例建立时定下的，这里只读。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/run/RunInput
 */
import type { RunState } from '../../../shared/runState.ts';
import type { InputAnswer, InputNode, WorkflowDocument } from '../../../shared/types.ts';
import type { T } from '../../i18n.ts';
/** 用户的回答：文字原样、多选一行一个、没填写就说没填写。 */
export declare function AnswerView(props: {
    t: T;
    answer: InputAnswer | undefined;
}): React.JSX.Element;
/** 回答的一行写法（步骤详情的「用户输入」里）：多选用顿号连起来。 */
export declare function answerLine(t: T, answer: InputAnswer | undefined): string;
export declare function RunInputDetail(props: {
    t: T;
    snapshot: WorkflowDocument;
    input: InputNode;
    answer: InputAnswer | undefined;
    state: RunState | null;
    onSelectStep(id: string): void;
}): React.JSX.Element;
