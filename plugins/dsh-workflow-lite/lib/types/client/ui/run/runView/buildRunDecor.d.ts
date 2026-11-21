/**
 * dsh-workflow-lite — 实例画布上的运行装饰：每个步骤此刻的状态、走过的线、文件在不在，
 * 以及点卡片上状态小标时弹出改状态菜单的位置。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/run/runView/buildRunDecor
 */
import type { RunCursor } from '../../../../shared/runCursor.ts';
import { type RunState } from '../../../../shared/runState.ts';
import type { WorkflowDocument } from '../../../../shared/types.ts';
import type { Run } from '../../../app/useRuns.ts';
import type { T } from '../../../i18n.ts';
import type { RunDecor } from '../../canvas/Canvas.tsx';
export interface RunDecorInput {
    doc: WorkflowDocument;
    shown: RunState | null;
    cursor: RunCursor | null;
    /** 草稿里改过的步骤。 */
    edited: ReadonlySet<string>;
    /** `current.view?.files`。 */
    files: RunDecor['files'] | undefined;
    /** `current.flash`。 */
    flash: Run['flash'];
    insetRight: number;
    fresh(nodeId: string): boolean;
    /** 打开改状态小菜单（实例视图里 `menu` 的 setter）。 */
    setMenu(menu: {
        id: string;
        x: number;
        y: number;
        step: 'status' | 'verdict';
    }): void;
    t: T;
}
export declare function buildRunDecor({ doc, shown, cursor, edited, files, flash, insetRight, fresh, setMenu, t, }: RunDecorInput): RunDecor;
