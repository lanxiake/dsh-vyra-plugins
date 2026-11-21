/**
 * dsh-workflow-lite — 实例视图里步骤详情的「产出 / 读取」：它写哪些、读哪些资源；
 * 悬停在画布上高亮那张卡，点一下选中它（选中资源卡后的右栏见 `RunResource.tsx`）。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/run/RunFiles
 */
import { resourceGraph } from '../../../shared/resources.ts';
import type { ResourceNode, WorkflowDocument } from '../../../shared/types.ts';
import type { T } from '../../i18n.ts';
/**
 * 资源里一个文件 / 文件夹在工作区里的路径（实例的快照里产出根目录已换上实例 id）：
 * 有步骤写它时相对路径拼上产出根目录，只被读时相对工作区。
 */
export declare function itemDisplayPath(doc: WorkflowDocument, node: ResourceNode, index: number, graph?: ReturnType<typeof resourceGraph>): string;
export declare function StepResourceList(props: {
    t: T;
    snapshot: WorkflowDocument;
    step: string;
    /** 模型在状态文件里报告的产出（可能有图里没画出来的）。 */
    reported: readonly string[];
    made: Readonly<Record<string, readonly (boolean | null)[]>>;
    onSelectResource(id: string): void;
    onFocusFile(id: string | null): void;
    onViewPath(path: string): void;
}): React.JSX.Element;
