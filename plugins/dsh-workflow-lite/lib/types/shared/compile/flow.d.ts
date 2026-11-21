/**
 * dsh-workflow-lite — 计划的「流程」一节：清单表、执行批次、分支、循环、交接（另有安排的线）。
 *
 * 步骤按执行顺序（批次序，同批次按 `id` 码位序）列；其余的序一律是 `id` 的**码位序**（{@link byId}）。
 * 计划里的步骤引用：「流程」表**首列**写 `label（id）`（{@link displayName}），
 * 其余位置一律写 `id`——`id` 唯一，且与载荷文件名一致。
 *
 * @module @xiaoso/dsh-workflow-lite/shared/compile/flow
 */
import type { PlanFacts, WorkflowEdge } from '../types.ts';
import { type RenderContext } from './context.ts';
/** 流程：清单表（按执行顺序）、执行批次、分支、循环、交接（另有安排的线）。 */
export declare function flowSection(facts: PlanFacts, ctx: RenderContext, inline: boolean): string;
/** 图里有没有附了交接说明的线、只管先后的线（步骤之间的线）。 */
export declare function specialHandoffs(ctx: RenderContext): {
    note: boolean;
    orderOnly: boolean;
};
/** 判定取值集合：该步骤全部带判定词的出边的取值，去重后**按码位序升序**、各自加反引号。 */
export declare function verdictValues(ctx: RenderContext, id: string): string[];
/**
 * 一条线走的条件，接在线的一端后面：`（\`VERDICT: pass\` 时，循环回来时）`；没有条件、不是回边就是空串。
 * 任务描述的位置行、计划的「流程」表与「交接」共用，同一条线几处写法一样。`back` 是回边那一截怎么说；
 * `brief` 时自然语言条件只写「满足条件时」（表格单元格里放不下一段话，原文在表下的分支里）。
 */
export declare function edgeGuard(ctx: RenderContext, edge: WorkflowEdge, back: string, brief?: boolean): string;
