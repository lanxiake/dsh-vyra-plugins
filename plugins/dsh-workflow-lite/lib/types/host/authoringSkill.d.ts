/**
 * dsh-workflow-lite — 按需 skill `workflow-authoring`：怎么设计一张工作流图。
 *
 * 工具描述只列能力（有哪些 action、参数是什么）；步骤怎么拆、产物怎么传、资源说明怎么写、
 * 建完怎么自检，都放在这里，模型要建图、改图时才读（目录里只常驻一句摘要）。
 * 内容来自真实使用里反复出现的问题：步骤拆得太碎、中间产物没接给下游、提示词说要改的文件图里没连、
 * 循环跑几轮后台账和状态文档越写越长、每轮写法都不一样、自检时反复编译留下一堆实例。
 *
 * @module @xiaoso/dsh-workflow-lite/host/authoringSkill
 */
import type { Context } from '@deepseek-ai/cordis';
export declare const AUTHORING_SKILL = "workflow-authoring";
/**
 * 注册 skill；`skills` 服务不在时由调用方跳过。
 * @returns 注销器。
 */
export declare function registerAuthoringSkill(ctx: Context): () => void;
