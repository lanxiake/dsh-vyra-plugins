/**
 * dsh-workflow-lite — 按需 skill `workflow-run-state`：运行状态的字段、`state` 动作的用法与维护规矩。
 *
 * 计划末尾的「运行状态」段只放执行时离不开的几条；字段全表、例子、恢复步骤、常见错误都在这里，
 * 模型拿不准时才读（目录里只常驻一句摘要）。状态由插件写——模型经 `workflow_lite` 的 `state`
 * 动作改，插件补时间、轮次、流水并当场校验，所以这里不教怎么手写 YAML。
 *
 * @module @xiaoso/dsh-workflow-lite/host/runs/skill
 */
import type { Context } from '@deepseek-ai/cordis';
export declare const RUN_STATE_SKILL = "workflow-run-state";
/**
 * 注册 skill；`skills` 服务不在时什么也不做（计划里的「运行状态」段照写）。
 * @returns 注销器。
 */
export declare function registerRunStateSkill(ctx: Context): () => void;
