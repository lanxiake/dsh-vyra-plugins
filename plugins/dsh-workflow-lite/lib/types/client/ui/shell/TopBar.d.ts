/**
 * dsh-workflow-lite — 顶栏：左边是"我在哪张工作流、存好了没有"，右边是撤销重做、整理、
 * 工作流设置、检查结果，以及「预览 / 执行」组。
 *
 * 低频的文件操作（新建、改名、删除、重新加载）都收在工作流名字的下拉里（{@link WorkflowSwitcher}），
 * 顶栏上常驻的只有高频动作。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/shell/TopBar
 */
import type { Runs } from '../../app/useRuns.ts';
import type { Workflow } from '../../app/useWorkflow.ts';
import type { T } from '../../i18n.ts';
import type { TopSlots } from '../kit/topSlots.ts';
import { type LaunchProps } from './Launch.tsx';
export declare const NO_SLOTS: TopSlots;
export interface TopBarProps {
    /** 现在的内容还没存成版本（磁盘上的和任何一版都不一样，或还有没写下去的改动）：版本图标挂黄点。 */
    versionsPending: boolean;
    /** 正在看的实例；`null` = 模板编辑。顶栏同一个、不卸载，只换里面的内容。 */
    runId: string | null;
    /** 实例视图的三个位置的回调 ref。 */
    slotRefs: {
        [K in keyof TopSlots]: (el: HTMLElement | null) => void;
    };
    t: T;
    wf: Workflow;
    libraryOpen: boolean;
    onToggleLibrary(): void;
    onTidy(): void;
    onLocate(nodeId: string): void;
    onPreview(): void;
    /** 「执行」那一半要的东西。 */
    launch: Pick<LaunchProps, 'blocked' | 'starting' | 'session' | 'rows' | 'canCreate' | 'onRun'>;
    onSettings(): void;
    /** 打开这张工作流的版本。 */
    onVersions(): void;
    /** 去工作流中心导出这张工作流。 */
    onExport(): void;
    /** 本会话的工作流实例（下拉里「本会话的实例」那一段）。 */
    runs: Runs;
    onOpenRun(id: string): void;
    onOpenHub(): void;
    onOpenWorkflow(name: string): void;
    onNewWorkflow(): void;
    /** 实例视图里「从磁盘重新加载」。 */
    onReloadRun(): void;
}
export declare function TopBar(props: TopBarProps): React.JSX.Element;
