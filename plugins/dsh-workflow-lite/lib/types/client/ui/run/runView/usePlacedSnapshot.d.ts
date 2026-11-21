/**
 * dsh-workflow-lite — 实例快照的补位：快照里没摆过位置的节点，照模板那边的规矩补上位置。
 * 补位是异步的（要排版），所以结果带着「哪个实例的哪一版」的键，对不上就当还没好。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/run/runView/usePlacedSnapshot
 */
import type { WorkflowDocument } from '../../../../shared/types.ts';
export interface PlacedSnapshotInput {
    id: string;
    /** `useSnapshot` 给的快照；还没读回来是 `null`。 */
    raw: {
        planId: string;
        doc: WorkflowDocument;
    } | null;
}
export declare function usePlacedSnapshot({ id, raw, }: PlacedSnapshotInput): {
    key: string;
    planId: string;
    doc: WorkflowDocument;
} | null;
