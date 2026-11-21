/**
 * dsh-workflow-lite — 资源节点与交接：图上"传了什么"的唯一解释。
 *
 * 两种东西在步骤之间传，性质不同，所以分开表达：
 * - **资源**是独立的东西，不依赖某一次运行——画成**资源节点**，一个资源里可以放好几项（文件、文件夹、
 *   网址、Skill、自定义）。步骤 → 资源 = 写它（写的是其中的文件与文件夹：产出，或在原文件上更新）；
 *   资源 → 步骤 = 读它。几个步骤连到同一个资源，它就是几步之间共用的一份；一条线都没连的资源交给
 *   整个工作流。
 * - **执行结果**是某一次运行的回复——沿**步骤 → 步骤**的线交给下游（缺省就交；可以附一段交接说明，
 *   也可以设成"只管先后"）。
 *
 * 编译器、校验、画布、工具都从这里取解释。纯函数，不碰磁盘、不 import DSH 包。
 *
 * @module @xiaoso/dsh-workflow-lite/shared/resources
 */
import { type Handoff, type OutputSpec, type ResourceData, type ResourceItem, type ResourceNode, type StepNode, type WorkflowDocument, type WorkflowEdge, type WorkflowNode } from './types.ts';
/**
 * - `flow`：步骤 → 步骤（先后，带条件与交接）；
 * - `write`：步骤 → 资源；`read`：资源 → 步骤；
 * - `ask`：输入 → 步骤（把用户的回答交给它）；
 * - `invalid`：资源 → 资源、连进输入节点、输入连到资源（保存级）；`dangling`：端点不存在。
 */
export type EdgeKind = 'flow' | 'write' | 'read' | 'ask' | 'invalid' | 'dangling';
/** 按 `idKey` 查节点（同 id 重复时取第一个）。 */
export declare function nodeIndex(document: WorkflowDocument): Map<string, WorkflowNode>;
export declare function edgeKind(nodes: ReadonlyMap<string, WorkflowNode>, edge: WorkflowEdge): EdgeKind;
/** 只留步骤 → 步骤的线（执行次序、环、批次只看它们）。 */
export declare function flowEdges(document: WorkflowDocument): WorkflowEdge[];
/** 这一项步骤能不能写（文件、文件夹）。 */
export declare function isWritable(item: ResourceItem): boolean;
/** 资源的称呼：名字；没有名字就用第一项的简称；什么都没有就是 id。 */
export declare function resourceTitle(resource: ResourceNode): string;
export interface ResourceInfo {
    resource: ResourceNode;
    /** 写它的步骤（文件中的顺序）；`update` = 在原文件上更新。 */
    writers: {
        id: string;
        update: boolean;
    }[];
    /** 读它的步骤。 */
    readers: string[];
}
/** 一个资源有没有连任何步骤：一条线都没有就交给整个工作流。 */
export declare function isShared(info: ResourceInfo): boolean;
/** 资源节点 id（规范大小写）→ 写它、读它的步骤。 */
export declare function resourceGraph(document: WorkflowDocument): Map<string, ResourceInfo>;
/**
 * 这个资源里的相对路径要不要拼产出根目录：有步骤写它的普通资源要（它是这次执行的产出）；
 * 只被读的不要（它是现成的东西）；记忆也不要（它跨执行留着，见 `shared/presets.ts`）。
 */
export declare function underOutputRoot(info: ResourceInfo | undefined): boolean;
/** 一个步骤和它连着的资源（不含交给整个工作流的那些）。 */
export interface StepResources {
    writes: {
        resource: ResourceNode;
        update: boolean;
        edge: WorkflowEdge;
    }[];
    reads: {
        resource: ResourceNode;
        edge: WorkflowEdge;
    }[];
}
export declare function stepResources(document: WorkflowDocument, stepId: string): StepResources;
/** 交给整个工作流的资源（一条线都没连的那些），按文件中的顺序。 */
export declare function sharedResources(document: WorkflowDocument): ResourceNode[];
/** 某个步骤与某个资源的关系（画布高亮用）；没关系是 `null`。 */
export type ResourceRole = 'producer' | 'updater' | 'reader';
export declare function roleOf(info: ResourceInfo | undefined, stepId: string): ResourceRole | null;
/** 一个步骤写的资源里的文件，摊成产出清单（存成步骤模板时用）。 */
export declare function outputsOf(document: WorkflowDocument, stepId: string): OutputSpec[];
/** 一个产出文件对应的资源内容：一个文件项，生成规则写进它的说明。 */
export declare function outputResource(spec: OutputSpec): ResourceData;
/** 按路径（规范化后）找放着这个文件的资源；有好几个时优先只放了它一项的。 */
export declare function resourceByPath(document: WorkflowDocument, path: string): ResourceNode | undefined;
/** 新资源节点（`(0,0)` = 还没摆过，由布局补位）。 */
export declare function newResourceNode(document: WorkflowDocument, data: ResourceData, position?: {
    x: number;
    y: number;
}): ResourceNode;
/**
 * 让一个步骤恰好写这些文件（工具的 `write_node` 与模板展开用）：
 * 路径已有资源就连上它（文件项没写过说明就补上），没有就新建一个只放这个文件的资源；
 * 不在清单里的写入线去掉，去掉之后什么都不连的资源一并删掉。**就地改** `document`。
 * @param positionOf - 新资源节点的坐标（第几个新资源 → 坐标）；缺省 `(0,0)`。
 * @returns 新建的资源节点 id。
 */
export declare function setStepOutputs(document: WorkflowDocument, stepId: string, specs: readonly OutputSpec[], positionOf?: (index: number) => {
    x: number;
    y: number;
}): string[];
/** 路径变量换成哪个目录：`workflow` 换 `{workflow}/…`，`memory` 换 `{memory}/…`；不给的那个不换。 */
export interface BoundDirs {
    workflow?: string;
    memory?: string;
}
/**
 * 把资源里的 `{workflow}/…`、`{memory}/…` 换成实际目录下的路径（编译计划、看实例里的文件、导出成 skill 时用；
 * 存盘的图不换）。没有这种路径时原样返回同一个对象。
 */
export declare function bindDirs(document: WorkflowDocument, dirs: BoundDirs): WorkflowDocument;
/** 文件、文件夹（值是一条路径的那两种）。 */
export declare function isPathItem(item: ResourceItem): boolean;
/** 把模板里的产出清单（`data.output`）挑出来，剩下的是步骤自己的 `data`。 */
export declare function splitOutputs(data: StepNode['data']): {
    data: StepNode['data'];
    outputs: OutputSpec[];
};
/** 一条步骤间的线实际交了什么。 */
export interface ResolvedHandoff {
    /** 交不交上游的执行结果。 */
    result: boolean;
    note?: string;
}
export declare function resolveHandoff(handoff: Handoff | false | undefined): ResolvedHandoff;
