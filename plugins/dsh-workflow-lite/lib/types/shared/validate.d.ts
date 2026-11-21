/**
 * dsh-workflow-lite — 四级校验。
 *
 * **本节是校验级别的唯一出处**。四条级别的语义：
 * - **保存级**：结构性破损——拒绝加载 / 拒绝写入。JSON 不合法一律走这里，
 *   新结构没有"坏一个节点"这回事。
 * - **编译级**：语义问题——**允许落盘**（画布标红），但**阻塞编译**。
 * - **警告** / **提示**：不阻塞任何操作，走同一条 `warnings` 通道、带 `level` 区分。
 *
 * 处理性失败（IO 中断、写前哈希冲突、物化失败）**不是校验级别**，不进这里。
 *
 * 纯函数，不碰磁盘、不 import DSH 包。
 * @module @xiaoso/dsh-workflow-lite/shared/validate
 */
import { type GraphAnalysis } from './graph.ts';
import type { ResourceData, ResourceItem, ValidationProblem, WorkflowDocument } from './types.ts';
export interface ValidateOptions {
    /** 图名——校验文件名约束用。 */
    workflowName: string;
    /** 单图节点数上限（`Config.maxNodes`）。 */
    maxNodes: number;
    /** `workflows/` 下存在同名**目录**（md 版遗留）——算撞名占位。 */
    dirCollision?: boolean;
    /** 记忆库里有没有这条记忆；给了才查（记忆卡引用的不在库里就给警告）。 */
    hasMemory?: (id: string) => boolean;
}
export interface ValidationReport {
    save: ValidationProblem[];
    compile: ValidationProblem[];
    warning: ValidationProblem[];
    hint: ValidationProblem[];
    /** 保存级为空才能加载。 */
    canLoad: boolean;
    /** 编译级为空才能出计划。 */
    canCompile: boolean;
}
/**
 * 校验一张图。
 * @param document - 已规范化的文档。
 * @param options - 图名与上限。
 * @param extra - 读入阶段已报出的问题（未知 `type`/字段、坐标补位、viewport 回落、
 *   旧结构检测…），按级别合进结果，避免上层再分拣一遍。
 */
export declare function validateDocument(document: WorkflowDocument, options: ValidateOptions, extra?: readonly ValidationProblem[], analysis?: GraphAnalysis): ValidationReport;
/** 资源里一项的写法与长度（保存级）。属性面板的编辑框也拿它当场提示。 */
export declare function itemProblem(item: ResourceItem): {
    message: string;
} | null;
/** 资源节点的字段规则（保存级）：名字、描述、每一项的写法与长度、项数。 */
export declare function resourceProblem(data: ResourceData): {
    message: string;
} | null;
