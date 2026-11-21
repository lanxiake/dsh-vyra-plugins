/**
 * dsh-workflow-lite — 计划里的用户输入：执行前问过用户的问题与回答（「本次执行」和任务描述各一种写法）。
 *
 * @module @xiaoso/dsh-workflow-lite/shared/compile/inputs
 */
import type { PlanFacts } from '../types.ts';
import { type RenderContext } from './context.ts';
/** 一个问题交给谁：没连步骤就是所有步骤，连了的按执行顺序列。 */
export declare function readersText(ctx: RenderContext, inputId: string): string;
/**
 * 用户输入：每个问题一项（`indent` 是列表的缩进），按画布上的阅读顺序。问题原样写、后面注明交给谁；
 * 回答多行时逐行引用。占位与说明是给填写的人看的，不进计划。
 */
export declare function inputLines(facts: PlanFacts, ctx: RenderContext, indent: string): string[];
/**
 * 任务描述里的「用户输入」：连到这一步的问题，加上没连线、交给所有步骤的。回答已知（插件里建实例时）
 * 就直接写上；还不知道（导出的 skill、没给回答的编译）写明由编排者转交，问题后面带上题型、选项与默认值——
 * 提示词常按选项分情况写（「回答是 A 就……」），执行者得知道可能收到哪几种回答。
 */
export declare function taskInputLines(facts: PlanFacts, id: string): string[];
