/**
 * dsh-workflow-lite — 计划里的规矩与定义：「怎么执行」和「约定」两节，以及怎么写文件、记忆这些固定正文。
 *
 * 固定正文是字节稳定的那些行；跟执行环境有关的措辞（执行方式、复用、资源、加载 skill）不写在这里，
 * 由 `shared/dialect.ts` 按口径给出。
 *
 * @module @xiaoso/dsh-workflow-lite/shared/compile/rules
 */
import type { PlanFacts, ResourceNode } from '../types.ts';
import { type RenderContext } from './context.ts';
import type { PlanOptions } from './options.ts';
/** 怎么执行：执行方式、复用执行者、任务不是命令、派发、交接（只讲概念）、证据。 */
export declare function executionSection(facts: PlanFacts, ctx: RenderContext): string;
/** 约定：路径（skill 口径另说 `{skill}` / `{instance}`）、产出写到哪、资源怎么用、产出与更新的定义。 */
export declare function conventionsSection(ctx: RenderContext, inline: boolean, options?: PlanOptions): string;
/**
 * 一组写入用到的规矩：产出、产出到文件夹、更新、更新文件夹，按这个顺序，有才给。
 * 「产出到文件夹」只给落在产出根目录外面的文件夹（绝对路径，或者根目录就是工作区）：根目录里面是这个工作流
 * 自己的产出区，说明里常要求「每轮整目录重写」，这条反倒和它打架。
 */
export declare function rulesFor(ctx: RenderContext, all: ReadonlyArray<{
    update: boolean;
    resource: ResourceNode;
}>): string[];
