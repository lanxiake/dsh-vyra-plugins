/**
 * dsh-workflow-lite — 顶栏左边的工作流名字与它的下拉：切换、改名、删除、新建。
 *
 * 改名和删除挂在列表的每一行上（见 {@link WorkflowRow}），哪张都能直接改，不用先切过去；
 * 底下只留跟「正开着的这张」有关的「从磁盘重新加载」和「新建」。
 * 双击顶栏上的名字、或刚新建好时，名字就地变成输入框改正开着的这张。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/shell/WorkflowSwitcher
 */
import type { Runs } from '../../app/useRuns.ts';
import type { Workflow } from '../../app/useWorkflow.ts';
import type { T } from '../../i18n.ts';
export interface WorkflowSwitcherProps {
    t: T;
    wf: Workflow;
    /** 本会话的工作流实例（下拉里「本会话的实例」那一段）。 */
    runs: Runs;
    onOpenRun(id: string): void;
    /** 打开一张工作流：模板编辑里切图，实例视图里先回到模板编辑再切。 */
    onOpenWorkflow(name: string): void;
    /** 新建一张工作流（并进入编辑）。 */
    onNewWorkflow(): void;
    /** 实例视图里「从磁盘重新加载」：重读这个实例（模板编辑里重读正开着的这张，用 `wf.reload`）。 */
    onReloadRun(): void;
    /** 在实例视图里用：正在看的实例，与触发器里的内容；不给 = 模板编辑（触发器是工作流名字）。 */
    run?: {
        id: string;
        trigger(open: boolean): React.ReactNode;
    };
}
export declare function WorkflowSwitcher(props: WorkflowSwitcherProps): React.JSX.Element;
