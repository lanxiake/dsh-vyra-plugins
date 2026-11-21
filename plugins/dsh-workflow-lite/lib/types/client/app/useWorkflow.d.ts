/**
 * dsh-workflow-lite — 编辑器的"发动机"：加载、自动保存、冲突、目录。
 *
 * 状态放在一个 ref 里同步推进，再镜像进 React state 触发渲染。**不能只靠 React state**：
 * 改完文档要立刻判断"该不该排一次保存"，而 React 的 state 要等下一次渲染才更新——
 * 读到旧值就会把这次排期整个丢掉（改动永远不落盘）。
 *
 * 保存规则：
 * - 改动 → 防抖后写一次；保存中不重入，保存期间来的改动在这笔写完后补排；
 * - 换图 / 页面隐藏 / 卸载 → 立即写，不等防抖；
 * - `broken` 态绝不写盘。
 *
 * @module @xiaoso/dsh-workflow-lite/client/app/useWorkflow
 */
import { type GraphAnalysis } from '../../shared/graph.ts';
import type { NodeData } from '../../shared/types.ts';
import type { GraphListResponse } from '../../shared/wire/graph.ts';
import type { PlanBuildResponse } from '../../shared/wire/plan.ts';
import type { T } from '../i18n.ts';
import { type Edit, type EditorState, type Selection } from '../model/editor.ts';
import { type WorkflowLiteRpc } from '../rpc.ts';
export interface Toast {
    id: number;
    text: string;
    tone: 'info' | 'error';
}
export interface Workflow {
    state: EditorState;
    analysis: GraphAnalysis | null;
    catalog: GraphListResponse | null;
    /** 磁盘上的版本与本地改动冲突时的冲突 id 清单；`null` = 没有冲突。 */
    conflict: string[] | null;
    /** 本地有改动、磁盘又被别处改过。 */
    external: boolean;
    toast: Toast | null;
    /** 刚建好的工作流名字：顶栏据此直接进入改名。读完即清。 */
    fresh: string | null;
    clearFresh(): void;
    edit(edit: Edit): void;
    select(selection: Selection): void;
    undo(): void;
    redo(): void;
    /** 一次连续输入结束：断开撤销合并。 */
    seal(): void;
    open(name: string): Promise<void>;
    create(): Promise<void>;
    /** 改名：`from` 可以是任意一张（不必先打开）；改的是正开着的这张时顶栏跟着换名字。 */
    rename(from: string, to: string): Promise<boolean>;
    /** 回 `false` = 没删成（已经提示过了）。 */
    remove(name: string): Promise<boolean>;
    reload(): void;
    retrySave(): void;
    keepMine(): void;
    refreshCatalog(): Promise<void>;
    /** 预览计划；`cwd` = 执行时的工作区（计划里的工作区路径、任务描述路径按它写）。 */
    buildPlan(full: boolean, cwd?: string): Promise<PlanBuildResponse>;
    /** 把待写的改动立刻存下去（「执行」之前：实例要拿磁盘上的那份做快照）。存不下去回 `false`。 */
    flush(): Promise<boolean>;
    loadTemplate(name: string): Promise<NodeData | null>;
    saveTemplate(name: string, data: NodeData): Promise<boolean>;
    /** 读「我的步骤」给人编辑（提示词空着的半成品也能读）。 */
    loadTemplateDraft(name: string): Promise<NodeData | null>;
    /** 覆盖保存「我的步骤」；`name` 与 `from` 不同就是改名。成功返回保存后的名字。 */
    updateTemplate(name: string, data: NodeData, from: string): Promise<string | null>;
    deleteTemplate(name: string): Promise<boolean>;
    notify(text: string, tone?: Toast['tone']): void;
}
export declare function useWorkflow(rpc: WorkflowLiteRpc, t: T): Workflow;
