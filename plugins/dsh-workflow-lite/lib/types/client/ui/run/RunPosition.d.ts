/**
 * dsh-workflow-lite — 实例总览里的「执行位置」：正在执行、最后执行、下一步各是哪几步。
 *
 * 和画布卡片右上角的小标是同一份结论（`shared/runCursor.ts`，模型 `resume` 拿到的也是它）：
 * 循环里转到第几轮、从哪一步回来的，一眼能看出来。点一行到那一步。
 * 「指定」可以改下一步：勾选的步骤进草稿（状态里的 `next`），存下后模型照它接着做。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/run/RunPosition
 */
import type { RunCursor } from '../../../shared/runCursor.ts';
import type { RunState } from '../../../shared/runState.ts';
import type { WorkflowDocument } from '../../../shared/types.ts';
import type { T } from '../../i18n.ts';
export declare function RunPosition(props: {
    t: T;
    snapshot: WorkflowDocument;
    state: RunState;
    cursor: RunCursor;
    /** 指定下一步在草稿里改过（标题旁挂小圆点）。 */
    pinEdited: boolean;
    /** 改指定的下一步（`null` = 取消指定，回到按流转推）。 */
    onPin(ids: string[] | null): void;
    onSelect(id: string): void;
}): React.JSX.Element;
