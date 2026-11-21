/**
 * dsh-workflow-lite — 唯一的模型可见工具 `workflow_lite`。
 *
 * **一个工具 + 一个 action 枚举**：枚举本身就是能力清单，模型看枚举就知道这张图能干什么，
 * 不必先记住一长串工具名再挑；也避开 DSH 内置的 `workflow` 工具（跑 JS 编排脚本）。
 *
 * 返回通道只有三条：
 * - **被规则拒绝** → 一律 `{ error: { code, message, detail? } }`（`code ∈ {not_found, invalid_args,
 *   blocked, conflict, io_error}`）——它是**返回**而不是抛，好让模型读到结构化失败。
 * - **`problems` 只在 `compile` 里出现**，装编译级错误。
 * - **`warnings` 装警告与提示**，每条带 `level`，任何 action 都能带。
 *
 * 定位一律用 `id`；`label` 只用于显示。
 * @module @xiaoso/dsh-workflow-lite/host/tool/tool
 */
import type { Context } from '@deepseek-ai/cordis';
import type { JsonValue } from '@deepseek-ai/dsh-util-values';
import type { RunService } from '../runs/service.ts';
import type { Repository } from '../store/repository.ts';
import { type WorkflowLiteArgs } from './args.ts';
/** 工具需要的三个活依赖（`dataDir` / `maxResultBytes` 是活配置，所以取函数而不是值）。 */
export interface ToolDeps {
    repository: Repository;
    dataDir: () => string;
    maxResultBytes: () => number;
    /** 工作流实例（运行状态）；不给就当没有这块能力（`runs` / `resume` 报错，编译不建实例）。 */
    runs?: RunService;
}
/** `execute` 真正用到的那一小块执行上下文（完整 `ToolRunContext` 结构上兼容它）。 */
export interface ToolExecView {
    agent?: {
        session?: {
            header?: {
                id?: string;
                cwd?: string;
                origin?: string;
                parentSession?: string;
            };
        };
    };
}
/**
 * 工具的处理体。**抽出来是为了可单测**：单测直接调它，不必造一个 Cordis Context。
 * @param deps - 仓储与两个活配置。
 * @returns 处理一个调用并回规范 JSON 值（失败也是返回值，不抛）。
 */
export declare function createWorkflowLiteHandler(deps: ToolDeps): (args: WorkflowLiteArgs, exec?: ToolExecView) => Promise<JsonValue>;
/**
 * 注册那唯一的工具。
 * @param ctx - 插件上下文（`tools` 已就绪）。
 * @param deps - 仓储与两个活配置。
 * @returns 注销器。
 */
export declare function registerWorkflowLiteTool(ctx: Context, deps: ToolDeps): () => void;
