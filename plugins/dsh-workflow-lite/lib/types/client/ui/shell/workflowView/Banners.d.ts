/**
 * dsh-workflow-lite — 画布顶上的三种提示条：有冲突、本会话出现了新实例、磁盘上的文件被外部改过。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/shell/workflowView/Banners
 */
import type { Workflow } from '../../../app/useWorkflow.ts';
import type { T } from '../../../i18n.ts';
export declare function Banners({ t, wf, freshRun, openRun, setFreshRun, }: {
    t: T;
    wf: Workflow;
    /** 本会话刚出现的新实例（没有就不提示）。 */
    freshRun: string | null;
    openRun(id: string): void;
    setFreshRun(value: null): void;
}): React.JSX.Element;
