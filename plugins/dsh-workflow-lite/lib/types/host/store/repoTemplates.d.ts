/**
 * dsh-workflow-lite — 仓储的节点模板部分：读 / 建 / 存（含改名）/ 删 `templates/nodes/<名>.json`。
 *
 * 模板文件顶层就是节点的 `data` 本体（不套壳）；这里同时放它的规范化写出（`writeNodeTemplate`）、
 * 形状归一（`parseNodeData`）和结构预检（`templateProblems`）。
 * @module @xiaoso/dsh-workflow-lite/host/store/repoTemplates
 */
import type { NodeData, ValidationProblem, WriteResult } from '../../shared/types.ts';
import type { RepoCore } from './repoCore.ts';
import { type Outcome } from './repoResult.ts';
/**
 * 节点模板文件的规范化写出：固定键序（`label` / `description` / `icon` / `color` / `prompt` / `output`）、缺省项不写、
 * 末尾一个换行。与 {@link parseNodeData} 是同一套形状——**文件顶层就是 `data` 本体**，
 * 不套 `{ data: … }` 壳。`prompt` 总是写出来（空串也写）：那是这个模板的正文，
 * 缺键与空串在读者眼里是两件事，别让它含糊。
 */
export declare function writeNodeTemplate(data: NodeData): string;
/** 节点模板 = 一个 `data` 本体；这里只做形状归一，规则判定交给校验层。 */
export declare function parseNodeData(text: string): {
    data: NodeData;
    problems: ValidationProblem[];
};
/** 节点模板预检：只看结构。 */
export declare function templateProblems(text: string): ValidationProblem[];
/** 模板部分用到的核心能力。 */
type TemplatesCore = Pick<RepoCore, 'dataDir' | 'withLock' | 'ensureLayout' | 'resolveName'>;
export declare class TemplateStore {
    private readonly core;
    constructor(core: TemplatesCore);
    readTemplate(name: string): Promise<Outcome<NodeData>>;
    readNodeTemplate(name: string): Promise<Outcome<NodeData>>;
    createNodeTemplate(name: string, data: NodeData): Promise<Outcome<WriteResult>>;
    readNodeTemplateDraft(name: string): Promise<Outcome<NodeData>>;
    saveNodeTemplate(name: string, data: NodeData, from?: string): Promise<Outcome<WriteResult>>;
    deleteNodeTemplate(name: string): Promise<Outcome<WriteResult>>;
    /** 读出模板文本并做预检：坏的（保存级 / 编译级）一律 `blocked`，绝不复制半成品。 */
    private loadTemplateText;
}
export {};
