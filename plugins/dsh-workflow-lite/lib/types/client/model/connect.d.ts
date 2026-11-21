/**
 * dsh-workflow-lite — 拖线连接的规则：从哪个连接点拖出来、能落到哪些连接点上、连上会是什么线。
 *
 * 连接点各有分工（「左右走流程，上下走资源」）：
 * - 步骤左 `in`：入口——接上游步骤（流程）或资源卡（读取）；
 * - 步骤右 `out`：出口——只连下一个步骤（流程）；
 * - 步骤底 `file`：出口——只连资源卡（写入）；
 * - 资源左 `in`：入口——只接步骤的写点（写入）；
 * - 资源右 `out`：出口——只连步骤（读取）；
 * - 输入右 `out`：出口——只连步骤（把回答交给它，落点和读资源一样）。输入没有入口。
 * 步骤上还有几个备用点（上边的写点 `fileUp`、上下边的读点 `read` / `readTop`），挂哪个由画布按位置挑。
 *
 * 画布据此在拖线时只露出能连的连接点，并在松手前预告这条线的含义。
 *
 * @module @xiaoso/dsh-workflow-lite/client/model/connect
 */
import type { WorkflowDocument, WorkflowNode } from '../../shared/types.ts';
/**
 * 正在拖的是哪种线（按起点）：
 * `flow` 步骤右 → 找步骤；`write` 步骤底/上的写点 → 找资源；`read` 资源右 → 找步骤；
 * `back` 从步骤左边倒着拖 → 找步骤右 / 资源右；`writeBack` 从资源左边倒着拖 → 找步骤的写点；
 * `readBack` 从步骤的读点倒着拖 → 找资源或输入；`ask` 输入右 → 找步骤。
 */
export type DragKind = 'flow' | 'write' | 'read' | 'ask' | 'back' | 'writeBack' | 'readBack';
/** 拖线起点是哪种卡。 */
export type CardKind = 'step' | 'resource' | 'input';
export declare function dragKindOf(from: CardKind, handleId: string | null | undefined): DragKind | null;
/** React Flow 交过来的连接（已按 source → target 摆正）。 */
export interface HandleLink {
    source: string;
    sourceHandle?: string | null;
    target: string;
    targetHandle?: string | null;
}
/** 这条拖出来的线能不能连：不连自己、资源不连资源，且两头的连接点分工要对得上。 */
export declare function linkAllowed(doc: WorkflowDocument, link: HandleLink): boolean;
/** 连上之后会是什么线：流程 / 产出 / 更新 / 读取 / 交回答；`exists` = 已经连着了，松手什么也不会变。 */
export interface LinkPreview {
    kind: 'flow' | 'produce' | 'update' | 'read' | 'ask';
    source: WorkflowNode;
    target: WorkflowNode;
    exists: boolean;
}
export declare function previewLink(doc: WorkflowDocument, link: HandleLink): LinkPreview | null;
