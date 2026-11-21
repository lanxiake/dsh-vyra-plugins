/**
 * dsh-workflow-lite — 加记忆时弹出的小菜单：第一行「新建一条」，下面是记忆库里同类型的记忆（名称、几个工作流在用）。
 *
 * 选了已有的就引用它；新建由调用方去建（id 按工作流名、步骤取默认的）。库里没有同类型的时候调用方不弹它，直接新建。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/resources/MemoryPicker
 */
import { type MemoryEntry } from '../../../shared/memoryLib.ts';
import type { MemoryType } from '../../../shared/types.ts';
import type { T } from '../../i18n.ts';
/** 「N 个工作流在用」/「没被用」。 */
export declare function usedByText(t: T, entry: MemoryEntry): string;
export declare function MemoryPicker(props: {
    t: T;
    /** 弹出的位置；`width` 给了就按它的宽度（和锚点那一块一样宽），不给是 {@link MEMORY_PICKER_W}。 */
    at: {
        x: number;
        y: number;
        width?: number;
    };
    type: MemoryType;
    /** 同类型的记忆（已按名称排好）。 */
    entries: readonly MemoryEntry[];
    /** 换一条时现在引用的那条：标成选中。 */
    current?: string;
    busy: boolean;
    onPick(entry: MemoryEntry): void;
    onCreate(): void;
    onClose(): void;
}): React.JSX.Element;
