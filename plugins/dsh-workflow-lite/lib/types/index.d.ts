/**
 * dsh-workflow-lite — host 半。
 *
 * 三件事：把**文件仓储**（单文件 JSON、原子写、写前哈希 + 字段级合并）接到活配置上；
 * 注册**唯一的模型可见工具** `workflow_lite`（14 个 action，没有档位开关）；把**画布 RPC**
 * 挂到共享 Connection 的 `/api` 通道上（只在有 web 的 profile 里挂，缺它不影响工具可用）。
 *
 * 这个插件**不执行任何节点**：它只管理文件、渲染画布、把图编译成一份派发计划，
 * 拿到计划的模型自己决定怎么执行。插件不调度，就没有并发/超时/重试/锁/心跳/恢复。
 * 每次执行都是一个工作流实例：图的快照 + 工作区里的实例目录（任务描述、默认产出）。开了「记录运行状态」
 * 的图还带一份状态：主 agent 经工具的 `state` 动作记进度，用户在画布上看、改，改动通知回模型。
 *
 * @module @xiaoso/dsh-workflow-lite
 */
import type { Context } from '@deepseek-ai/cordis';
import { CONFIG_KEYS, Config, type WorkflowLiteSettings } from './host/config.ts';
/** Host 插件名（也是 profile patch 那行的 id）。 */
export declare const name = "workflow-lite";
/** 插件的配置声明——Cordis 从入口模块的命名空间上读它。 */
export { Config };
/**
 * 硬依赖只有 `tools`（工具注册是插件的存在理由）。
 *
 * `connection` **刻意不在这里**：画布 RPC 走 `ctx.inject(['connection'])` 的子上下文注册，
 * 这样在没有 web 服务的 profile 里，插件照样只带工具起来，而不是整个 fiber 停在 pending。
 */
export declare const inject: string[];
/**
 * Host 插件体。
 * @param ctx - host 插件上下文。
 * @param config - 解析后的活配置（`Volatile` 引用，写入时就地更新）。
 */
export declare function apply(ctx: Context, config: WorkflowLiteSettings): Promise<void>;
/** 六个配置键（文档与测试用）。`dataDir` 改动需要重启——仓储在装配时定住数据根。 */
export { CONFIG_KEYS };
