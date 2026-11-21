/**
 * dsh-workflow-lite — 图的语义分析：环、回边、执行批次、出边形态。
 *
 * 允许成环之后，编译器最要紧的四件事都在这里一次算清：
 * - **环 = 强连通分量**（SCC）。一个 SCC 就是一个循环体。
 * - **回边**＝在 SCC 内做一次 DFS，**指向当前 DFS 栈上祖先**的那条边（自环也算）。
 *   起点取该 SCC 的**入口节点**——被环外入边指向的那个；没有环外入边时按语义挑最像起点的
 *   （第一轮就跑得起来、是被条件线跳回来的），并列再取 `id` 最小者（见 `loopStart`）。
 *   一个 SCC **至少**有一条回边；简单环恰好一条，多环交叠的 SCC 可以有多条。
 * - **回边不计入汇合与批次推导**（它不是"要等它"，而是"再触发一次"）。前向边照常计入前置。
 * - **执行批次**＝在"去掉回边之后的 DAG"上做最长路径分层。
 *
 * 全篇的序一律是 **`id` 的码位序**（不是 `localeCompare`，也不是文件里的数组序）。
 *
 * 纯函数，不碰磁盘、不 import DSH 包。
 * @module @xiaoso/dsh-workflow-lite/shared/graph
 */
import type { CycleGroup, EdgeShape, ExecutionBatch, WorkflowDocument, WorkflowEdge } from './types.ts';
/** 按**码位序**比较两个字符串（`localeCompare` 会随 locale 变，不能用）。 */
export declare function compareByCodepoint(a: string, b: string): number;
/** 排序助手：按 `id` 码位序升序。 */
export declare function byId(a: string, b: string): number;
export interface GraphAnalysis {
    /** 全部**步骤** id，按 `id` 码位序（文件节点不在其中）。 */
    nodeIds: string[];
    /** 边 id → 边。 */
    edgesById: Map<string, WorkflowEdge>;
    /** 节点 id → 出边形态。 */
    shapes: Map<string, EdgeShape>;
    /** 回边 id 集合。 */
    backEdges: Set<string>;
    /** 循环体（SCC）列表，按入口 id 码位序。 */
    cycles: CycleGroup[];
    /** 执行批次，按批次序。 */
    batches: ExecutionBatch[];
    /** 节点 id → 前置 id（**含回边**），按 `id` 码位序。 */
    predecessors: Map<string, string[]>;
    /** 节点 id → 后继 id，按 `id` 码位序。 */
    successors: Map<string, string[]>;
    /** 图内是否有边指向不存在的节点（悬空 edge ⇒ 保存级）。 */
    danglingEdges: WorkflowEdge[];
}
/** 判形态：单条 = 顺序；全无条件 = 并行扇出；全有条件 = 状态分支；混用 = 歧义。 */
export declare function classifyShape(outgoing: readonly WorkflowEdge[]): EdgeShape;
/** 一条边的条件值；缺省与空串都当"无条件"。 */
export declare function edgeWhen(edge: WorkflowEdge): string | undefined;
/**
 * 分析整张图。对**悬空 edge**（端点不存在）不抛错——它由校验层判保存级，
 * 这里把这类边收进 `danglingEdges` 并从拓扑计算里排除，好让上层能同时报出
 * "图坏了"与"坏在哪"，而不是在分析阶段就崩掉。
 */
export declare function analyzeGraph(document: WorkflowDocument): GraphAnalysis;
/** 一个循环体是否**没有出口**（环上没有任何指向环外的条件边）——警告级。 */
export declare function cycleHasNoExit(cycle: CycleGroup): boolean;
