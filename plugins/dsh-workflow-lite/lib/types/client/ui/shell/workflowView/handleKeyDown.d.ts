/**
 * dsh-workflow-lite — 视图根上的快捷键：撤销重做、复制、删除、看全图、整理；输入框里一律让开。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/shell/workflowView/handleKeyDown
 */
import type { Workflow } from '../../../app/useWorkflow.ts';
import type { Selection } from '../../../model/editor.ts';
export interface KeyDownContext {
    state: Workflow['state'];
    runId: string | null;
    /** 就地添加的菜单开着没有（Esc 先关它）。 */
    quick: unknown;
    setQuick(value: null): void;
    select(selection: Selection): void;
    wf: Workflow;
    duplicate(id: string): void;
    removeSelection(): void;
    fitAll(): void;
    relayout(): void;
}
export declare function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>, { state, runId, quick, setQuick, select, wf, duplicate, removeSelection, fitAll, relayout, }: KeyDownContext): void;
