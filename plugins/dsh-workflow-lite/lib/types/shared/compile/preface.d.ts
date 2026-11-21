/**
 * dsh-workflow-lite — 计划的开头三节：概览、本次执行、开始之前。
 *
 * @module @xiaoso/dsh-workflow-lite/shared/compile/preface
 */
import type { PlanFacts } from '../types.ts';
import type { RenderContext } from './context.ts';
import type { PlanOptions } from './options.ts';
/** 概览：一句话说清这是什么、有多大、任务描述在哪。 */
export declare function overviewSection(facts: PlanFacts, ctx: RenderContext, inline: boolean): string;
/**
 * 本次执行：目标（调用方给了才写——画布上点「执行」没有地方填目标）、工作区（取不到写「未指定」）、
 * 实例 id（有就写）、执行前问过用户的问题与回答。导出成 skill 时这些都要执行者自己定。
 */
export declare function runSection(facts: PlanFacts, ctx: RenderContext, inline: boolean): string;
/** 开始之前：动手前要做的事，编号逐条列；一条都没有就不出这一段。 */
export declare function beforeSection(facts: PlanFacts, ctx: RenderContext, options?: PlanOptions): string;
