/**
 * dsh-workflow-lite — 画布上的增删改：加步骤（含记忆选择）、就地添加、复制、记忆开关、删、换选中。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/shell/workflowView/useStepEdit
 */
import type { Point } from '../../../../shared/types.ts';
import type { HostAccess } from '../../../app/host.ts';
import type { Workflow } from '../../../app/useWorkflow.ts';
import type { T } from '../../../i18n.ts';
import { type Selection } from '../../../model/editor.ts';
import type { LibraryFocus, StepSource } from '../../../model/library.ts';
import type { AddRequest } from '../../canvas/Canvas.tsx';
export interface StepEditInput {
    t: T;
    host: HostAccess;
    rootRef: React.RefObject<HTMLDivElement>;
    wf: Workflow;
    state: Workflow['state'];
    focusCanvas(): void;
    setFocusPrompt: React.Dispatch<React.SetStateAction<boolean>>;
    setQuick: React.Dispatch<React.SetStateAction<(AddRequest & {
        at: Point;
    }) | null>>;
    setFocus: React.Dispatch<React.SetStateAction<LibraryFocus | null>>;
}
export declare function useStepEdit({ t, host, rootRef, wf, state, focusCanvas, setFocusPrompt, setQuick, setFocus, }: StepEditInput): {
    memoryPick: {
        pick: import("../../../app/useMemoryPick.ts").MemoryPickState | null;
        busy: boolean;
        open(target: import("../../../app/useMemoryPick.ts").MemoryPickTarget, anchor?: Element | null): void;
        choose(entry: import("../../../../shared/memoryLib.ts").MemoryEntry): void;
        create(): void;
        close(): void;
    };
    memories: import("../../../app/memories.ts").MemorySnapshot;
    openMemoryPick: (target: import("../../../app/useMemoryPick.ts").MemoryPickTarget, anchor?: Element | null) => void;
    addStep: (source: StepSource, position: Point, from?: string) => Promise<void>;
    requestAdd: (request: AddRequest) => void;
    duplicate: (id: string) => void;
    toggleMemory: (step: string, anchor: Element) => void;
    removeNode: (id: string) => void;
    removeSelection: () => void;
    select: (selection: Selection) => void;
};
