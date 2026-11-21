/**
 * dsh-workflow-lite — 加记忆、换一条记忆：弹「选已有的 / 新建」的小菜单（`ui/resources/MemoryPicker.tsx`），选好了改图。
 *
 * 三种目标：给步骤开记忆、在画布上加一张工作流记忆、给一张卡换引用（资源卡换成记忆，或记忆卡换一条）。
 * 库里没有同类型的就不弹，直接新建；换一条时照样弹（好看清现在是哪条、也能新建）。
 * 菜单贴着点的那个按钮弹出（锚点写了 `data-pick-match` 的，菜单和它左对齐、一样宽）；没有按钮（从步骤库拖来的、快捷添加来的）就贴着最后一次按下或松手的位置。
 *
 * @module @xiaoso/dsh-workflow-lite/client/app/useMemoryPick
 */
import { type RefObject } from 'react';
import type { MemoryEntry } from '../../shared/memoryLib.ts';
import type { MemoryType, Point, WorkflowDocument } from '../../shared/types.ts';
import type { T } from '../i18n.ts';
import { type Edit } from '../model/editor.ts';
import { type MemoryStore } from './memories.ts';
export type MemoryPickTarget = {
    kind: 'step';
    step: string;
} | {
    kind: 'workflow';
    position: Point;
}
/** 一张卡换引用：资源卡换成记忆（`type` 按它连没连步骤），或记忆卡换一条。 */
 | {
    kind: 'card';
    id: string;
    type: MemoryType;
};
export interface MemoryPickState {
    target: MemoryPickTarget;
    type: MemoryType;
    at: {
        x: number;
        y: number;
        width?: number;
    };
    entries: MemoryEntry[];
    /** 换一条时现在引用的那条。 */
    current?: string;
}
/** 菜单宽度（贴着锚点弹出时据此让开右边）。 */
export declare const MEMORY_PICKER_W = 300;
export declare function useMemoryPick(options: {
    t: T;
    store: MemoryStore;
    doc: WorkflowDocument | null;
    workflow: string | null;
    root: RefObject<HTMLElement | null>;
    edit(edit: Edit): void;
    notify(text: string, tone?: 'info' | 'error'): void;
}): {
    pick: MemoryPickState | null;
    busy: boolean;
    open(target: MemoryPickTarget, anchor?: Element | null): void;
    choose(entry: MemoryEntry): void;
    create(): void;
    close(): void;
};
