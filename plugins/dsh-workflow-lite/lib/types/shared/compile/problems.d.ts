/**
 * dsh-workflow-lite — 计划的编译级问题与「注意事项」：什么情况下出不了计划，哪些警告进计划。
 *
 * @module @xiaoso/dsh-workflow-lite/shared/compile/problems
 */
import { type GraphAnalysis } from '../graph.ts';
import type { PlanFacts, ValidationCode, ValidationProblem } from '../types.ts';
import type { PlanOptions } from './options.ts';
/** 编译级问题：内部可判定的两条（`no_nodes` / `prompt_empty`）+ 调用方带进来的。 */
export declare function compileProblemsOf(facts: PlanFacts, options?: PlanOptions): ValidationProblem[];
interface PlanNote {
    level: 'warning' | 'hint';
    code: ValidationCode;
    message: string;
    node?: string;
    edge?: string;
}
/**
 * 该图的警告与提示，逐字取自校验结论（`shared/validate.ts`）；计划的「注意事项」只取其中的警告。
 * 调用方没报「循环无出口」而图里确有这种环时，这里补一条——不编含糊话，走警告。
 */
export declare function planNotes(analysis: GraphAnalysis, options?: PlanOptions): PlanNote[];
export {};
