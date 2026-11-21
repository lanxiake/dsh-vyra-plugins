/**
 * dsh-workflow-lite — 画布上的节点对象：步骤卡、资源卡、输入卡各自的数据，以及按"文档里的那个节点 + 指纹"缓存的复用。
 *
 * 没变的节点交回同一个对象，React Flow 就不会重建它的内部状态（尺寸、连接点位置）。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/canvas/flow/buildNodes
 */
import { type ResourceInfo } from '../../../../shared/resources.ts';
import type { Point, WorkflowDocument, WorkflowNode } from '../../../../shared/types.ts';
import type { T } from '../../../i18n.ts';
import type { SizeTable } from '../../../model/canvasGeometry.ts';
import type { Selection } from '../../../model/editor.ts';
import type { CanvasProps, RunDecor } from '../Canvas.tsx';
import type { FlowNode, ResourceCardData, StepData, Tone } from '../types.ts';
import type { CanvasRoutes } from './buildRoutes.ts';
import type { CanvasTexts } from './buildTexts.ts';
export interface CacheEntry {
    node: WorkflowNode;
    /** 除了文档里的节点，这张卡还取决于什么（选中、语气、文字……）：和上一次逐项比（{@link samePlain}）。 */
    signature: unknown;
    flow: FlowNode;
}
export interface NodesInput {
    doc: WorkflowDocument;
    selection: Selection;
    tones: Map<string, {
        tone: Tone;
        note: string;
    }>;
    dragging: Record<string, Point>;
    texts: CanvasTexts;
    onAdd: StepData['onAdd'];
    onFocusFile: ResourceCardData['onFocusFile'];
    onView: ResourceCardData['onView'];
    /** 悬停（或拖卡片时定住）的那个资源的读写信息。 */
    focused: ResourceInfo | undefined;
    focusFile: string | null;
    routes: CanvasRoutes;
    t: T;
    run: RunDecor | undefined;
    onRunStatus: StepData['onRunStatus'];
    memorySteps: ReadonlySet<string>;
    memoryToggle: boolean;
    onMemory: NonNullable<StepData['onMemory']>;
    /** `props.memories`。 */
    memories: CanvasProps['memories'];
    /** `props.workflow`。 */
    workflow: CanvasProps['workflow'];
    files: Map<string, ResourceInfo>;
    /** 节点对象缓存（传 ref 本身：读写的是调用那一刻的 `.current`）。 */
    cache: React.MutableRefObject<Map<string, CacheEntry>>;
    /** 量出来的卡片尺寸（见 `useCardSizes`）：带回给 React Flow，重建节点对象时就不用重新量。 */
    sizes: SizeTable;
}
export declare function buildNodes({ doc, selection, tones, dragging, texts, onAdd, onFocusFile, onView, focused, focusFile, routes, t, run, onRunStatus, memorySteps, memoryToggle, onMemory, memories, workflow, files, cache, sizes, }: NodesInput): FlowNode[];
