/**
 * dsh-workflow-lite — `workflow_lite` 工具的参数形状，以及把参数整理成内部入参的纯函数。
 *
 * 接口与 `schema.ts` 里的参数声明同构；转换函数形状不对就回一句给模型看的错（字符串），对了回仓储 / 服务的入参。
 * 资源与展示设置的转换在 `resourceArgs.ts`。
 * @module @xiaoso/dsh-workflow-lite/host/tool/args
 */
import type { JsonValue } from '@deepseek-ai/dsh-util-values';
import type { DisplaySpec } from '../../shared/display.ts';
import type { ExecutionMode, Handoff, InputAnswer, ReusePolicy } from '../../shared/types.ts';
import { type Action } from '../../shared/types.ts';
import type { StatePatch } from '../runs/runProgress.ts';
import type { InputUpsert } from '../store/repoNodes.ts';
/** 工具的参数面（与下方注册处的 `parameters` 同构；抽成具名接口好让单测直接构造）。 */
export interface WorkflowLiteArgs {
    action: Action;
    workflow?: string;
    node?: string;
    content?: string;
    label?: string;
    output?: string;
    outputs?: {
        path: string;
        rule?: string;
        display?: DisplaySpec;
    }[];
    description?: string;
    no_output?: boolean;
    from_template?: string;
    to?: string;
    source?: string;
    target?: string;
    when?: string;
    goal?: string;
    full?: boolean;
    output_root?: string;
    mode?: ExecutionMode;
    reuse?: ReusePolicy;
    set_goal?: boolean;
    handoff?: 'result' | 'none';
    handoff_note?: string;
    update?: boolean;
    run_state?: boolean;
    instance?: string;
    all?: boolean;
    status?: string;
    note?: string;
    nodes?: NodePatchArgs[];
    log?: string;
    input?: InputArgs;
    answers?: AnswerArgs[];
    resource?: ResourceArgs;
    memory?: MemoryArgs;
}
/** write_resource 的 memory（与参数声明同构）。 */
export interface MemoryArgs {
    type?: string;
    id?: string;
    step?: string;
    name?: string;
    description?: string;
}
/** write_resource 的 resource（与参数声明同构）。 */
export interface ResourceArgs {
    label?: string;
    description?: string;
    items?: {
        kind: string;
        value: string;
        note?: string;
    }[];
    display?: DisplaySpec;
}
/** write_node 的 input（与参数声明同构）。 */
export interface InputArgs {
    question?: string;
    kind?: string;
    options?: string[];
    default?: string;
    defaults?: string[];
    placeholder?: string;
    hint?: string;
    required?: boolean;
    other?: boolean;
}
/** compile 的 answers 里的一项。 */
export interface AnswerArgs {
    id: string;
    value?: string;
    values?: string[];
}
/** `state` 动作里一个步骤的改动（与参数声明同构）。 */
export interface NodePatchArgs {
    id: string;
    status?: string;
    summary?: string;
    outputs?: string[];
    verdict?: string;
    error?: string;
    by?: string;
}
/**
 * 把一个内部值**结构化地**转成无损 JSON——工具的规范返回值必须是 `JsonValue`，
 * 而我们内部用的是带具名接口的对象（它们没有索引签名，不能直接赋给 `JsonValue`）。
 * 这里逐层重建：`undefined` 丢弃（JSON 本来也没有它），非有限数字归 `null`，
 * 其余标量原样。**不做类型断言**。
 */
export declare function toJsonValue(value: unknown): JsonValue;
/** `compile` 的 answers（[{ id, value | values }]）→ 输入 id → 回答。形状不对就回一句给模型看的错。 */
export declare function answersOf(args: WorkflowLiteArgs): Record<string, InputAnswer> | string | undefined;
/** write_node 的 input 参数 → 仓储的入参。 */
export declare function inputUpsertOf(id: string, input: InputArgs): InputUpsert | string;
/** 把 `state` 的参数整理成服务的入参；状态值不认识就回一句给模型看的错。 */
export declare function statePatchOf(args: WorkflowLiteArgs): StatePatch | string;
/**
 * connect 的交接参数 → 仓储的入参：`undefined` = 不动，`null` = 回到缺省（交执行结果、不附说明），
 * `false` = 只管先后，对象 = 交执行结果并附说明。
 */
export declare function handoffOf(args: WorkflowLiteArgs): Handoff | false | null | undefined;
