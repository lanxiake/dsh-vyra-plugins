/**
 * dsh-workflow-lite — 每个步骤的任务描述，和整卷版末尾的「步骤正文」。
 *
 * 任务描述：标题与它在图里的位置、提示词原文，末尾附上通用约定、这一步读写的资源（写文件的定义在前，
 * 路径已拼好、说明原样）和回复要求。执行者只读这一份就知道写哪、怎么写，不靠编排者转述。
 *
 * @module @xiaoso/dsh-workflow-lite/shared/compile/tasks
 */
import type { PlanFacts } from '../types.ts';
import { type RenderContext } from './context.ts';
/** 整卷版：逐步骤内联正文（按执行顺序）。 */
export declare function bodySection(ctx: RenderContext): string;
/**
 * 一个步骤的任务描述：标题（步骤名）与它在图里的位置，然后是提示词原文；后面依次是
 * 用户输入（连到这一步的问题与回答）、通用约定（交给所有步骤的资源）、这一步的资源
 * （先给写文件的定义，再每个资源一个小标题）、回复要求。
 * 提示词是用户写的，原样放，不改它的标题层级。
 */
export declare function taskText(facts: PlanFacts, ctx: RenderContext, id: string, prompt: string): string;
