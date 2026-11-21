/**
 * dsh-workflow-lite — 输入节点：执行前问用户的问题，与用户的回答。
 *
 * 一个输入节点 = 一个问题。连到哪些步骤（输入 → 步骤），回答就交给哪些步骤；一条都没连 = 交给整个工作流。
 * 用户点「执行」时按画布上从上到下、从左到右的顺序把问题摆出来填；编译时问题与回答进计划，
 * 占位与说明只给填写的人看。
 *
 * 编译器、校验、画布、工具、实例都从这里取解释。纯函数，不碰磁盘、不 import DSH 包。
 *
 * @module @xiaoso/dsh-workflow-lite/shared/inputs
 */
import type { InputAnswer, InputData, InputKind, InputNode, WorkflowDocument } from './types.ts';
/** 交互方式（缺省 = 单行文字）。 */
export declare function inputKind(data: InputData): InputKind;
/** 要从选项里选的两种。 */
export declare function isChoiceKind(kind: InputKind): boolean;
/** 图里的输入节点，按画布上的阅读顺序：从上到下、同一行从左到右，再按 id。 */
export declare function orderedInputs(document: WorkflowDocument): InputNode[];
/** 回答交给哪些步骤（按 id 码位序）；空 = 交给整个工作流。 */
export declare function inputReaders(document: WorkflowDocument, inputId: string): string[];
/** 一个步骤用到的输入节点（按阅读顺序）。 */
export declare function stepInputs(document: WorkflowDocument, stepId: string): InputNode[];
/** 这道选择题允许用户自己填写（`other`）。文字题没有这个说法。 */
export declare function allowsOther(data: InputData): boolean;
/**
 * 回答里用户自填的那部分：不在选项里的文字。没开「允许自己填写」时恒为空
 * （那样的回答在 `normalizeAnswer` 里已经被挡掉了）。
 */
export declare function customAnswers(data: InputData, answer: InputAnswer | undefined): string[];
/**
 * 一份回答按题型取形（见 `readAnswer`）。单选 / 多选只留选项里有的那些；文字题原样。
 * 允许自己填写（`other`）的选择题，不在选项里的文字也留着：多选里排在选中的选项之后，单选就是那段文字。
 * @returns 没有有效回答时 `undefined`。
 */
export declare function normalizeAnswer(data: InputData, raw: unknown): InputAnswer | undefined;
/** 实际用的回答：用户给的；没给就用默认值（默认值同样按题型取形）。 */
export declare function effectiveAnswer(input: InputNode, answers: Readonly<Record<string, InputAnswer>>): InputAnswer | undefined;
export interface AnswerCheck {
    /** 规范化后的回答（输入 id → 回答；已经补上默认值，没回答的不在里面）。 */
    answers: Record<string, InputAnswer>;
    /** 填得不对的：选了不在选项里的、对不上任何输入节点的。 */
    errors: string[];
    /** 必填却还空着的输入节点。 */
    missing: InputNode[];
}
/**
 * 核对一份回答（来自「执行」对话框或工具的 `answers`）：补上默认值、挑出填错的与漏填的。
 * @param raw - 输入 id → 回答；不是对象当没回答。
 */
export declare function checkAnswers(document: WorkflowDocument, raw: unknown): AnswerCheck;
/** 两份回答是否相同（实例复用时比）。 */
export declare function sameAnswers(a: Readonly<Record<string, InputAnswer>>, b: Readonly<Record<string, InputAnswer>>): boolean;
/** 一个问题的写法提示（给模型问用户时看）：「单选：A / B，默认 A」这类。 */
export declare function describeInput(data: InputData): string;
