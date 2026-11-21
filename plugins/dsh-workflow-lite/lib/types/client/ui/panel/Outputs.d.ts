/**
 * dsh-workflow-lite — 产出文件：面板里的清单，与编辑 / 查看单个文件的模态框。
 *
 * 清单只负责"一眼看全"：每个文件一行，路径 + 生成规则的头两行。要改哪一个就点它，
 * 在模态框里有完整的空间写路径和规则——面板那一条窄栏里塞两个输入框加一个大文本框，
 * 多来几个文件就挤成一团。模态框里的改动"完成"时才一次交出去（一次改动 = 一条撤销步），
 * 交出去的永远是合法的值。
 *
 * 画布卡片上的产出浮窗、步骤面板、「我的步骤」编辑器、内置步骤的只读详情，都走这里。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/panel/Outputs
 */
import type { NodeData, OutputSpec } from '../../../shared/types.ts';
import type { T } from '../../i18n.ts';
/** 要从外面（画布卡片的浮窗）打开哪一项：`seq` 每次请求都变，同一项点两次也能再开。 */
export interface OutputRequest {
    index: number | 'new';
    seq: number;
}
/**
 * 产出：不声明 / 写入文件 / 不产出；「写入文件」下面是文件清单。
 * 步骤面板与「我的步骤」编辑器共用它。
 */
export declare function OutputField(props: {
    t: T;
    value: NodeData['output'];
    /** 切到「写入文件」或新加一项时预填的文件名。 */
    suggest: string;
    /** 这些产出属于谁（模态框的副标题）。 */
    owner: string;
    /** 工作流设置里的产出根目录：编辑框里据此预览最终写到哪。 */
    root?: string | undefined;
    onChange(value: NodeData['output']): void;
    request?: OutputRequest | null;
    onRequestDone?: () => void;
}): React.JSX.Element;
/** 只读地列出产出：点一个文件，在模态框里看它的完整生成规则。 */
export declare function OutputList(props: {
    t: T;
    output: NodeData['output'];
    owner: string;
}): React.JSX.Element;
/**
 * 编辑（或新加）一个产出文件：路径 + 生成规则。步骤模板的产出清单用它；
 * 画布上给步骤「新建产出文件」也用它（`title` 换成那边的说法）。
 */
export declare function OutputEditor(props: {
    title?: string;
    t: T;
    owner: string;
    root: string | undefined;
    /** `null` = 新加一项。 */
    initial: OutputSpec | null;
    suggest: string;
    /** 同一步骤里其它文件的路径（查重名用）。 */
    taken: readonly string[];
    canRemove: boolean;
    onSave(spec: OutputSpec): void;
    onRemove(): void;
    onClose(): void;
}): React.JSX.Element;
