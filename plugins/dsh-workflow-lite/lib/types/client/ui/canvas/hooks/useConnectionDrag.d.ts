/**
 * dsh-workflow-lite — 拖线时画布要知道的事：拖的是什么线、落到目标上会连成什么颜色，以及悬停资源的聚光。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/canvas/hooks/useConnectionDrag
 */
import type { ResourceInfo } from '../../../../shared/resources.ts';
import type { WorkflowDocument } from '../../../../shared/types.ts';
import type { T } from '../../../i18n.ts';
import { type DragContext } from '../lines/ConnectionLine.tsx';
export interface ConnectionDragInput {
    doc: WorkflowDocument;
    t: T;
    /** 指针悬停的资源卡 id（`props.focusFile`）。 */
    hoveredFile: string | null;
    /** 拖卡片时是 'hold'。 */
    streakMode: 'hold' | 'run';
    files: Map<string, ResourceInfo>;
}
export declare function useConnectionDrag({ doc, t, hoveredFile, streakMode, files }: ConnectionDragInput): {
    dragInfo: DragContext;
    drag: {
        kind: import("../../../model/connect.ts").DragKind | null;
        color: string;
    } | null;
    dragFrom: string | null;
    focusFile: string | null;
    focused: ResourceInfo | undefined;
};
