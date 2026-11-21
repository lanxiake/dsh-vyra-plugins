/**
 * dsh-workflow-lite — 选中步骤时它连着的资源，与连着资源的线。
 *
 * - {@link StepResourcesField}：选中步骤时，"它写哪些资源、读哪些资源"，还有交给整个工作流的那些；
 *   能新建一个产出文件、关联图里已有的资源；
 * - {@link ResourceEdgeBody}：选中一条连着资源的线时，写入方式或读取说明；
 * - {@link ModeToggle}：整份写出 / 在原文件上更新的小开关（资源面板里写它的步骤也用它）。
 *
 * 行上悬停 = 画布高亮这个资源的上下游；点一行 = 选中那张卡。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/resources/Resources
 */
import type { ResourceNode, StepNode, WorkflowDocument, WorkflowEdge } from '../../../shared/types.ts';
import type { T } from '../../i18n.ts';
import { type Edit, type FocusFile, type Selection } from '../../model/editor.ts';
/** 资源的小图标：只有一项时用那一项的种类图标，否则是一叠。 */
export declare function ResourceIcon(props: {
    resource: ResourceNode;
    size?: number;
}): React.JSX.Element;
/** 资源的一行摘要：第一项的写法，多项时加上「等 N 项」。 */
export declare function resourceSummary(t: T, resource: ResourceNode): string;
export declare function StepResourcesField(props: {
    t: T;
    doc: WorkflowDocument;
    step: StepNode;
    onEdit(edit: Edit): void;
    onSelect(selection: Selection): void;
    onFocusFile: FocusFile;
}): React.JSX.Element;
/** 写入方式：整份写出 / 在原文件上更新（两格的小开关）。 */
export declare function ModeToggle(props: {
    t: T;
    update: boolean;
    onChange(update: boolean): void;
}): React.JSX.Element;
export declare function ResourceEdgeBody(props: {
    t: T;
    edge: WorkflowEdge;
    kind: 'write' | 'read';
    onEdit(edit: Edit): void;
}): React.JSX.Element;
