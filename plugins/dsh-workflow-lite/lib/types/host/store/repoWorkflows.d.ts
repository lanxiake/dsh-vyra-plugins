/**
 * dsh-workflow-lite — 仓储的工作流部分：读一张图（`load`）、整图保存（`save`）、建 / 改名 / 删。
 *
 * 读-改-写的骨架在 `repoCore`，这里只写图级的流程：`load` 记基线，`save` 走 `persist`，
 * `create` / `rename` / `remove` 各自在锁内完成（改名与删除连带版本、资料目录）。
 * @module @xiaoso/dsh-workflow-lite/host/store/repoWorkflows
 */
import type { ChangedEntry, ToolWarning, ValidationProblem, WorkflowDocument, WriteResult } from '../../shared/types.ts';
import type { RepoCore } from './repoCore.ts';
import { type Outcome } from './repoResult.ts';
export interface LoadResult {
    /** 名字归一后的图名（`not_found` 时也给出，便于上层报错）。 */
    name: string;
    /** 可加载时的规范化文档；**保存级问题 ⇒ `null`**。 */
    document: WorkflowDocument | null;
    /** 磁盘上的原文（供只读错误态展示）；不存在时 `null`。 */
    text: string | null;
    /** 原文的整图哈希（写前比对的基线）；不存在时 `null`。 */
    hash: string | null;
    /** 读入阶段的问题，含 `warning` / `hint`（上层按 `level` 分流）。 */
    problems: ValidationProblem[];
    /** `false` ⇒ 拒绝加载：要么保存级非空，要么文档不可用。 */
    loadable: boolean;
    /** 那个文件在不在。`loadable=false` 时用它区分 `not_found` 与 `blocked`。 */
    exists: boolean;
}
export interface SaveOptions {
    /** 加载时记录的整图哈希；`null` = 没有基线（退化为"以磁盘为基线"的合并，不报冲突）。 */
    baseHash: string | null;
    /** 画布「保留我的」：冲突也写（冲突 id 以本地为准）。**工具写路径不要传**。 */
    force?: boolean;
}
export interface SaveResult {
    /** 写回后磁盘内容的整图哈希 ⇒ 新的基线。 */
    hash: string;
    changed: ChangedEntry[];
    warnings: ToolWarning[];
}
/** `before → after` 的变更摘要（`save` 回告用）。 */
export declare function diffDocuments(before: WorkflowDocument | null, after: WorkflowDocument): ChangedEntry[];
/** 工作流部分用到的核心能力。 */
type WorkflowsCore = Pick<RepoCore, 'dataDir' | 'withLock' | 'ensureLayout' | 'resolveName' | 'validate' | 'persist' | 'pickFreeName' | 'rememberBaseline' | 'baselineFor' | 'dropBaselines'>;
export declare class WorkflowStore {
    private readonly core;
    constructor(core: WorkflowsCore);
    load(workflow: string): Promise<LoadResult>;
    save(workflow: string, next: WorkflowDocument, options: SaveOptions): Promise<Outcome<SaveResult>>;
    create(workflow: string): Promise<Outcome<WriteResult>>;
    rename(workflow: string, to: string): Promise<Outcome<WriteResult>>;
    remove(workflow: string): Promise<Outcome<WriteResult>>;
}
export {};
