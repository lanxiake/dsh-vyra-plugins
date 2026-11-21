/**
 * dsh-workflow-lite — 就地添加步骤的小菜单。
 *
 * 三个入口共用它：右键点画布空白处、点步骤右侧的「＋」、把连线拖到空白处松手。
 * 后两种会把新步骤顺手连在来源后面。从步骤出发时前两项是「产出文件」（放着这一步写的文件的资源卡）和
 * 「用户输入」（执行前问用户、回答交给这一步）；从资源卡、输入卡拖出来时只列步骤（新步骤读它）；
 * 在空白处还能放一张空的资源卡或输入卡。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/canvas/QuickAdd
 */
import type { TemplateEntry } from '../../../shared/types.ts';
import type { T } from '../../i18n.ts';
import { type StepSource } from '../../model/library.ts';
export declare function QuickAdd(props: {
    t: T;
    /** 相对视图根的坐标。 */
    at: {
        x: number;
        y: number;
    };
    bounds: {
        width: number;
        height: number;
    };
    templates: readonly TemplateEntry[];
    /** 从哪儿来：步骤的「＋」/ 资源卡、输入卡拖出来的线 / 空白处。 */
    origin: 'step' | 'resource' | 'input' | 'none';
    /** 列出「记忆」：从步骤来是给它开记忆（已经开着就不列），从空白处来是全局记忆。实例视图里不给。 */
    memory?: boolean;
    onPick(source: StepSource): void;
    onClose(): void;
}): React.JSX.Element;
