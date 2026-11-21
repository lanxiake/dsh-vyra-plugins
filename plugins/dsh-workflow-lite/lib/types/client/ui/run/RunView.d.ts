/**
 * dsh-workflow-lite — 工作流实例视图。
 *
 * 和模板是同一张图、同一套画布：每张步骤卡挂上运行状态，走过的线亮、没走过的淡。
 * 状态和图都能改，而且要顺手——卡片上的状态小标一点就改状态，右栏就地改字段；图和模板里一样拖、连、加、删，
 * 右栏切到「编辑」就是模板的属性面板。改动先攒成草稿（「已改 x 处」），确认后一次写进实例
 * （图的快照、状态文件），并以后台通知的形式告诉模型。执行过的步骤不能从图里删（改成「跳过」）。
 *
 * 顶栏和模板一样有撤销重做、整理、检查结果：撤销把图的改动和状态的改动排成一条（`useRunHistory`），
 * 检查和模板是同一套规则。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/run/RunView
 */
import type { MemoryEntry } from '../../../shared/memoryLib.ts';
import type { NodeData, TemplateEntry, WorkflowEntry } from '../../../shared/types.ts';
import type { Desktop } from '../../app/desktop.ts';
import { type Runs } from '../../app/useRuns.ts';
import type { T } from '../../i18n.ts';
import type { WorkflowLiteRpc } from '../../rpc.ts';
import type { TopSlots } from '../kit/topSlots.ts';
export interface RunViewProps {
    t: T;
    rpc: WorkflowLiteRpc;
    session: string | undefined;
    id: string;
    runs: Runs;
    /** 画布摆好视角、量完卡片（线定下来）：外层这才淡入。 */
    onSettled?(): void;
    workflows: readonly WorkflowEntry[];
    /** 「我的步骤」（就地添加菜单里列出来）。 */
    templates: readonly TemplateEntry[];
    /** 读一个「我的步骤」的内容；读不到回 `null`。 */
    loadTemplate(name: string): Promise<NodeData | null>;
    /** 把一个步骤存成「我的步骤」。 */
    onSaveTemplate(name: string, data: NodeData): Promise<boolean>;
    narrow: boolean;
    inspectorW: number;
    /** 右栏开着没有（点画布空白处收起，顶栏的开关再打开）。 */
    panelOpen: boolean;
    onPanel(open: boolean): void;
    onOpenRun(id: string): void;
    onOpenTemplate(name: string): void;
    /** 工作流（下拉里改名、删除、新建用）。 */
    onOpenHub(): void;
    /** 共用顶栏（`TopBar`）留给实例视图填的位置。 */
    slots: TopSlots;
    /** 把「重新读这个实例」交给顶栏下拉里的「从磁盘重新加载」。 */
    reloadRef: React.MutableRefObject<(() => void) | null>;
    /** 用系统程序打开产出文件；宿主没有桌面能力时不给。 */
    desktop?: Desktop;
    /** 记忆库（记忆卡上显示它的名称）；还没读回来是 `null`。 */
    memories?: readonly MemoryEntry[] | null;
}
export declare function RunView(props: RunViewProps): React.JSX.Element;
