/**
 * dsh-workflow-lite — `read` 的索引条目：步骤、输入节点、资源节点各一份不含正文的摘要。
 * @module @xiaoso/dsh-workflow-lite/host/tool/indexEntries
 */
import type { InputIndexEntry, NodeIndexEntry, ResourceIndexEntry, StepNode, WorkflowDocument } from '../../shared/types.ts';
/** 步骤的索引条目（不含正文）：前置步骤，以及它读、写的资源。 */
export declare function indexEntry(document: WorkflowDocument, node: StepNode): NodeIndexEntry;
/** 输入节点的索引条目：问题、题型、选项、默认值、交给谁（占位与说明是给填写的人看的，不给）。 */
export declare function inputEntries(document: WorkflowDocument): InputIndexEntry[];
/** 资源节点的索引条目：名字、内容、谁写、谁读（描述是给人看的，不给）。 */
export declare function resourceEntries(document: WorkflowDocument, missing: ReadonlySet<string>): ResourceIndexEntry[];
