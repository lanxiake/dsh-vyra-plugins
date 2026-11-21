/**
 * dsh-workflow-lite — 往图里加东西、复制一个节点：模板编辑与实例视图共用。
 *
 * @module @xiaoso/dsh-workflow-lite/client/app/addStep
 */
import type { MemoryType, NodeData, Point, WorkflowDocument } from '../../shared/types.ts';
import type { T } from '../i18n.ts';
import { type Edit } from '../model/editor.ts';
import { type StepSource } from '../model/library.ts';
export interface AddContext {
    t: T;
    doc: WorkflowDocument | null;
    edit(edit: Edit): void;
    /** 读「我的步骤」里的一个节点模板；读不到回 `null`。 */
    loadTemplate(name: string): Promise<NodeData | null>;
    /** 工作流名：新建记忆时默认 id 要用它；没有（实例视图）就加不了记忆。 */
    workflow?: string | null;
    /** 加记忆：弹出「选已有的 / 新建」（见 `ui/resources/MemoryPicker.tsx`）；不给就加不了记忆。 */
    pickMemory?: (request: MemoryPickRequest) => void;
}
/** 要加一张什么记忆：给步骤开（`step`），或一张工作流记忆落在 `position`。 */
export type MemoryPickRequest = {
    type: Extract<MemoryType, 'step'>;
    step: string;
} | {
    type: Extract<MemoryType, 'workflow'>;
    position: Point;
};
/**
 * 一个步骤的记忆开关：开着就是关掉它的编辑（库里那条不动）；关着就是要选一条（`pick`）。
 * 步骤不在、没有工作流名时是 `null`。
 */
export declare function memoryToggle(doc: WorkflowDocument | null, workflow: string | null | undefined, step: string): {
    off: Edit;
} | {
    pick: Extract<MemoryPickRequest, {
        type: 'step';
    }>;
} | null;
/**
 * 按来源加一个节点：步骤（空白 / 内置 / 我的步骤）接在 `from` 后面；资源从步骤的「＋」加就是这一步写的产出文件；
 * 输入从步骤的「＋」加就是这一步要的输入。加完的节点接管选中。
 */
export declare function addFromSource(ctx: AddContext, source: StepSource, position: Point, from?: string): Promise<void>;
/** 就地添加菜单从哪儿来：步骤的「＋」、资源卡拖出来的线、输入，或空白处。 */
export declare function addOrigin(doc: WorkflowDocument | null, from: string | undefined): 'step' | 'resource' | 'input' | 'none';
/**
 * 复制一个节点的改动（落在原处右下方一点）；节点不在就是 `null`。
 * 给了 `suffix`（「副本」），写了名字的步骤与资源在名字后面接上它，免得两张卡一模一样分不出谁是新的。
 * 输入节点的名字是发给模型的问题，原样复制。
 */
export declare function duplicateEdit(doc: WorkflowDocument | null, id: string, suffix?: string): Edit | null;
