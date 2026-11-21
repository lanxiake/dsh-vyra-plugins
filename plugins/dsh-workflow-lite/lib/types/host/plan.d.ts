/**
 * dsh-workflow-lite — 编译编排。
 *
 * 纯函数编译器（`shared/compile.ts`）不认识磁盘；这一层负责**把它需要的东西凑齐**：
 * 图（从仓储读，或实例的快照）、任务描述的路径、以及该图的校验结论（警告进「注意事项」）。
 *
 * 计划永远对着一个**工作流实例**出：
 * - 给了实例（`options.instance`）：任务描述写进实例目录的 `tasks/`，产出根目录里的 `{instance}`
 *   换成实例 id，开了「记录运行状态」就带上「运行状态」段——这就是模型拿到的那份；
 * - 没给（画布预览、整卷版）：同一份计划，只是实例 id 还没有，路径与段落里留着 `{instance}`，
 *   不写任何文件。预览与执行时拿到的内容逐段对得上。
 *
 * 失败姿态：有编译级问题时 `plan` 为空串、`problems` 必填，
 * **绝不返回一份残缺计划**；写任务描述失败 ⇒ `io_error`（图本身没坏，不该是 `invalid_args`）。
 *
 * @module @xiaoso/dsh-workflow-lite/host/plan
 */
import type { InputAnswer, PlanId, ToolWarning, ValidationProblem, WorkflowDocument } from '../shared/types.ts';
import { type Outcome } from './store/repoResult.ts';
import type { Repository } from './store/repository.ts';
/** 计划对着的实例。 */
export interface PlanInstance {
    id: string;
    /** 实例目录（任务描述 `tasks/`、状态 `state.yaml`、默认产出 `out/` 都在这里）。 */
    dir: string;
    /** 记运行状态：计划末尾带「运行状态」段。 */
    tracked: boolean;
}
/** 编译入参。 */
export interface CompileOptions {
    /** `true` = 整卷版（内联正文，给人读）；缺省 = 派发版。 */
    full?: boolean;
    goal?: string;
    /** 实例：给了就按它出计划、把任务描述写进实例目录；不给是预览（留 `{instance}`，不写文件）。 */
    instance?: PlanInstance;
    /**
     * 用户对输入节点的回答。不给 = 预览（回答处写「执行时填写」）；给了 = 真的要执行
     * （没回答的用默认值，必填的还空着就是编译级）。
     */
    answers?: Readonly<Record<string, InputAnswer>>;
}
export interface CompileBundle {
    /** 内容哈希前 8 位（实例的快照把实例 id 定进了产出根目录，所以每个实例各不相同）。 */
    planId: PlanId;
    /** 派发计划（或整卷版）文本；有编译级问题时为空串。 */
    plan: string;
    /** **只装编译级问题**（阻塞编译的那几条）。 */
    problems: ValidationProblem[];
    /** 警告与提示（非阻塞），含该图读入阶段报出的那些。 */
    warnings: ToolWarning[];
    /** 任务描述路径（步骤 id → 绝对路径）；预览时路径里是 `{instance}`。 */
    payloadPaths: Record<string, string>;
}
/**
 * 编译一张图（仓储里的模板）。
 *
 * - 保存级问题 ⇒ `blocked`（图都加载不了，谈不上编译）；图不存在 ⇒ `not_found`。
 * - 编译级问题 ⇒ 成功返回但 `plan` 为空串、`problems` 非空，**且不写文件**。
 */
export declare function compileWorkflow(repository: Repository, dataDir: string, name: string, options?: CompileOptions, 
/** 执行者的工作区根；由调用方从会话取（工具从 `exec` 取，RPC 从前端给）。 */
cwd?: string): Promise<Outcome<CompileBundle>>;
/**
 * 编译一份已经读进来的图（工作流实例的快照走这里：它不在 `workflows/` 里）。
 * @param problems - 该图的校验结论（警告进「注意事项」，也进 `warnings`）。
 */
export declare function compileDocument(dataDir: string, name: string, document: WorkflowDocument, problems: readonly ValidationProblem[], options?: CompileOptions, cwd?: string): Promise<Outcome<CompileBundle>>;
