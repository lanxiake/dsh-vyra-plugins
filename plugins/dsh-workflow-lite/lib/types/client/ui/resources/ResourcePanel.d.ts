/**
 * dsh-workflow-lite — 选中资源卡时的属性面板。
 *
 * 从上到下：名字（标题栏里直接改）、ID、描述（只在卡片上显示，不进计划）、内容（一项一行，点开在模态框里改）、
 * 写它的步骤（每个带整份写出 / 在原文件上更新的开关）、读它的步骤。一条线都没连时写明「交给整个工作流」。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/resources/ResourcePanel
 */
import type { ResourceNode, WorkflowDocument } from '../../../shared/types.ts';
import type { HostAccess } from '../../app/host.ts';
import type { T } from '../../i18n.ts';
import { type Edit, type FocusFile, type Selection } from '../../model/editor.ts';
import { type PickMemory } from './ResourcePresets.tsx';
export declare function ResourcePanel(props: {
    t: T;
    doc: WorkflowDocument;
    node: ResourceNode;
    host: HostAccess;
    onEdit(edit: Edit): void;
    onSelect(selection: Selection): void;
    onSeal(): void;
    onFocusFile: FocusFile;
    onRemove(id: string): void;
    /** 标题栏里关闭按钮左边的切换（实例视图里「运行 / 编辑」）。 */
    tabs?: React.ReactNode;
    /** 工作流名；不给（实例视图）就不能换引用的记忆、也不能把资源卡换成记忆。 */
    workflow?: string | null;
    /** 换一条记忆、把资源卡换成记忆：弹「选已有的 / 新建」。 */
    onPickMemory?: PickMemory;
}): React.JSX.Element;
