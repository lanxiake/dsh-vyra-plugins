/**
 * dsh-workflow-lite — 步骤库条目的详情（右侧面板）：点一下库里的条目就在这里看它。
 *
 * - **常用步骤**是内置的：只读展示提示词与产出，不能改。能做的只有"添加到画布"和
 *   "复制为我的步骤"（复制出来的那份就可以随便改了）。连接这类只对画布上的步骤有意义的
 *   东西，这里不出现。
 * - **我的步骤**就是 `templates/nodes/<ID>.json`：可以改 ID、名称、描述、提示词、产出，
 *   显式保存（Ctrl+S 也行），也可以删除。离开时还有没保存的改动，就顺手保存一次——
 *   改了一半一点别处就丢，比"多保存了一次"糟糕得多。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/editor/StepPanel
 */
import type { NodeData } from '../../../shared/types.ts';
import type { Workflow } from '../../app/useWorkflow.ts';
import type { T } from '../../i18n.ts';
import { type LibraryFocus, type StepSource } from '../../model/library.ts';
export interface StepPanelProps {
    t: T;
    wf: Workflow;
    focus: LibraryFocus;
    onFocus(focus: LibraryFocus | null): void;
    onAddToCanvas(source: StepSource): void;
    /** 把一份内容带去新建「我的步骤」（复制内置步骤用）。 */
    onCopyToMine(seed: NodeData, name: string): void;
}
export declare function StepPanel(props: StepPanelProps): React.JSX.Element | null;
