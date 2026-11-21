/**
 * dsh-workflow-lite — 「预览计划」对话框：把当前工作流编译成派发计划给人看。
 *
 * 两个版本：「给模型」就是执行时模型拿到的那份（提示词以任务描述路径引用，工作区按本会话的写）；
 * 「给人看」把提示词内联，适合通读与存档。实例 id 执行时才有，计划里先留着 `{instance}`。
 * 打开前会先把没落盘的改动写下去——编译读的是磁盘。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/editor/PlanDialog
 */
import type { PlanBuildResponse } from '../../../shared/wire/plan.ts';
import type { T } from '../../i18n.ts';
export declare function PlanDialog(props: {
    t: T;
    name: string;
    build(full: boolean): Promise<PlanBuildResponse>;
    onLocate(nodeId: string): void;
    onClose(): void;
}): React.JSX.Element;
