/**
 * dsh-workflow-lite — 磁盘上现在的内容和某一版一样吗：顶栏「版本」按钮据此提示。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/shell/workflowView/useMatchesVersion
 */
import type { Workflow } from '../../../app/useWorkflow.ts';
import type { WorkflowLiteRpc } from '../../../rpc.ts';
export interface MatchesVersionInput {
    rpc: WorkflowLiteRpc;
    state: Workflow['state'];
    versionsOpen: boolean;
}
export declare function useMatchesVersion({ rpc, state, versionsOpen, }: MatchesVersionInput): boolean | null;
