/**
 * dsh-workflow-lite — React Flow 报上来的节点变化：记下量出的尺寸，拖动中只改临时坐标，松手一次写进文档。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/canvas/hooks/useNodeChanges
 */
import type { NodeChange } from '@xyflow/react';
import type { Point } from '../../../../shared/types.ts';
import type { Size } from '../../../model/canvasGeometry.ts';
import type { Edit } from '../../../model/editor.ts';
import type { FlowNode } from '../types.ts';
export interface NodeChangesInput {
    /** 量出来的卡片尺寸（见 `useCardSizes`）：这里记下 React Flow 报上来的。 */
    sizes: Map<string, Size>;
    draggingRef: React.MutableRefObject<Record<string, Point>>;
    setSized: React.Dispatch<React.SetStateAction<number>>;
    setDragging: React.Dispatch<React.SetStateAction<Record<string, Point>>>;
    onEdit(edit: Edit): void;
}
export declare function useNodeChanges({ sizes, draggingRef, setSized, setDragging, onEdit, }: NodeChangesInput): (changes: NodeChange<FlowNode>[]) => void;
