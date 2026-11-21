/**
 * dsh-workflow-lite — 交接：步骤之间的线把上游这一次的执行结果交给下游。
 *
 * 文件不走这里（文件是独立的卡片，见 `canvas/cards/ResourceCard.tsx`）。一条步骤间的线只有三种状态：
 * 交执行结果（缺省）/ 交执行结果并附一段交接说明 / 只管先后。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/editor/Handoff
 */
import type { WorkflowEdge } from '../../../shared/types.ts';
import type { T } from '../../i18n.ts';
import type { Edit } from '../../model/editor.ts';
/**
 * 交接：一个开关（交不交执行结果）+ 交接说明。开关关掉时说明先记着，再打开还在。
 * 说明里连续打字并成一条撤销步。
 */
export declare function HandoffField(props: {
    t: T;
    edge: WorkflowEdge;
    /** 上游的显示名。 */
    source: string;
    onEdit(edit: Edit): void;
    onSeal(): void;
}): React.JSX.Element;
