/**
 * dsh-workflow-lite — 「工作流设置」对话框：整张工作流的全局配置，都会编译进派发计划。
 *
 * 三块（画在 `SettingsFields.tsx`），一项一行，不堆说明——细节收在各自的「?」里：
 * - **执行方式**：自动 / 串行 / 主 agent + 子代理 / Agent 团队（四张卡），下面一行**复用执行者**：
 *   同一步骤再次执行时交回上次的子代理或队员、每次新建，或不规定；串行时用不上。
 * - **执行时**：**设定目标**（缺省开，开始前用 `create_goal` 设成会话目标）与**记录运行状态**两个开关。
 * - **产出根目录**：每个步骤的产出文件编译时都拼在它下面；说明里的拼接示例跟着输入实时变，
 *   拼接与标准化走 `shared/outputPaths.ts`（和编译器同一份）。保存成默认值 = 不写这个键。
 *
 * 「完成」时一次交出去（一次改动 = 一条撤销步）。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/editor/SettingsDialog
 */
import type { WorkflowSettings } from '../../../shared/types.ts';
import type { T } from '../../i18n.ts';
export declare function SettingsDialog(props: {
    t: T;
    name: string;
    settings: WorkflowSettings | undefined;
    /** 预览用的示例产出（图里第一个产出文件；没有就是 `plan.md`）。 */
    sample: string;
    onSave(settings: WorkflowSettings | undefined): void;
    onClose(): void;
}): React.JSX.Element;
