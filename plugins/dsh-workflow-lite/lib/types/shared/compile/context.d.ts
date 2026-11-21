/**
 * dsh-workflow-lite — 计划编译器的渲染上下文：把图整理成按 `id` 查的表，以及步骤顺序、入出边顺序这些各节共用的取数。
 *
 * 同一份图 + 同一份入参 ⇒ 同一份上下文；这里不写任何措辞，跟执行环境有关的话在 `shared/dialect.ts`。
 *
 * @module @xiaoso/dsh-workflow-lite/shared/compile/context
 */
import { type Dialect } from '../dialect.ts';
import { type GraphAnalysis } from '../graph.ts';
import { type ResourceInfo } from '../resources.ts';
import type { PlanFacts, StepNode, WorkflowDocument, WorkflowEdge } from '../types.ts';
import type { SkillPlan } from './options.ts';
export interface RenderContext {
    /** 图分析（环、回边、批次、出边形态）。 */
    analysis: GraphAnalysis;
    /** 规范 `id` → 步骤。同 `id` 重复（保存级）时稳定地取文件中第一条。 */
    nodes: ReadonlyMap<string, StepNode>;
    /** `idKey` → 规范 `id`（图内大小写不敏感唯一，渲染一律用规范大小写）。 */
    keyToId: ReadonlyMap<string, string>;
    /** 目标节点（规范 `id`）→ 指向它的活边（悬空边是保存级，不参与渲染）。 */
    inEdges: ReadonlyMap<string, readonly WorkflowEdge[]>;
    /** 源节点（规范 `id`）→ 由它出发的活边。 */
    outEdges: ReadonlyMap<string, readonly WorkflowEdge[]>;
    /** 产出根目录（规范化后）；没配 = 工作区根。 */
    root: string | undefined;
    /** 原图（资源读写按它统计）。 */
    document: WorkflowDocument;
    /** 导出成 skill（见 {@link SkillPlan}）。 */
    skill: SkillPlan | undefined;
    /** 跟执行环境有关的措辞（见 `shared/dialect.ts`）。 */
    dialect: Dialect;
}
export declare function buildContext(facts: PlanFacts, analysis: GraphAnalysis, skill?: SkillPlan): RenderContext;
/** 边的源节点（规范 `id`）。 */
export declare function sourceIdOf(ctx: RenderContext, edge: WorkflowEdge): string | undefined;
/** 边的目标节点（规范 `id`）。 */
export declare function targetIdOf(ctx: RenderContext, edge: WorkflowEdge): string | undefined;
/** 条件出边按「目标 `id` → `when` → 边 `id`」排——纯 `id` 码位序，不随数组序变。 */
export declare function sortOutgoing(ctx: RenderContext, edges: readonly WorkflowEdge[]): WorkflowEdge[];
/** 入边：环外的在前、回边在后，各按源 `id` 码位序。 */
export declare function incomingInOrder(ctx: RenderContext, id: string): WorkflowEdge[];
/** 步骤的阅读顺序：按批次（同批次按 `id` 码位序），批次里没有的接在后面。 */
export declare function stepOrder(ctx: RenderContext): string[];
/** 执行方式是串行：你本人逐个做，不派子代理、不建团队。 */
export declare function isSolo(ctx: RenderContext): boolean;
/** 有内容的资源，按 id 码位序（空资源不写）。 */
export declare function nonEmptyResources(ctx: RenderContext): ResourceInfo[];
