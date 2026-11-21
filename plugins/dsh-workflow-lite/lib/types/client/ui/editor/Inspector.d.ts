/**
 * dsh-workflow-lite — 属性面板（右侧，选中东西时才出现）。
 *
 * 选中步骤：名称、提示词、产出文件、连接，底部是复制 / 存为模板 / 删除。
 * 选中连线：两端、"什么时候走这条线"、删除。
 *
 * 文本框都是受控的：每敲一个字就改文档（合并成一条撤销步），失焦时封口。
 * 不合法的值（带竖线的名称、绝对路径的产出、带空格的判据）**不写进文档**，只在原地标红——
 * 文档里永远只有能保存的东西。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/editor/Inspector
 */
import { type GraphAnalysis } from '../../../shared/graph.ts';
import type { NodeData, WorkflowDocument, WorkflowEdge } from '../../../shared/types.ts';
import type { HostAccess } from '../../app/host.ts';
import type { T } from '../../i18n.ts';
import { type Edit, type FocusFile, type Selection } from '../../model/editor.ts';
import type { PickMemory } from '../resources/ResourcePresets.tsx';
export interface InspectorProps {
    t: T;
    doc: WorkflowDocument;
    analysis: GraphAnalysis;
    selection: NonNullable<Selection>;
    /** 刚加进来的空白步骤：面板一出来就把光标放进提示词。 */
    focusPrompt: boolean;
    onEdit(edit: Edit): void;
    onSelect(selection: Selection): void;
    onSeal(): void;
    onDuplicate(id: string): void;
    onRemoveNode(id: string): void;
    onSaveTemplate(name: string, data: NodeData): Promise<boolean>;
    /** 悬停到一个资源：画布高亮用到它的步骤。 */
    onFocusFile: FocusFile;
    /** 给资源选文件、文件夹、Skill 时看主机。 */
    host: HostAccess;
    /** 标题栏里关闭按钮左边的切换（实例视图里「运行 / 编辑」）；模板编辑不给。 */
    tabs?: React.ReactNode;
    /** 工作流名（换引用的记忆时用）；实例视图不给。 */
    workflow?: string | null;
    /** 换一条记忆、把资源卡换成记忆：弹「选已有的 / 新建」。 */
    onPickMemory?: PickMemory;
}
export declare function Inspector(props: InspectorProps): React.JSX.Element | null;
/**
 * 右栏换到一条连线时的 {@link useSwap} 参数：按两端认（和面板的键一样，改判据不算换了一条），
 * 横坐标取两端中点。实例视图的右栏也用它，两边写法一致，「运行 / 编辑」来回切时不滑。
 */
export declare function edgeSwap(doc: InspectorProps['doc'], edge: WorkflowEdge): {
    key: string;
    at: number;
};
