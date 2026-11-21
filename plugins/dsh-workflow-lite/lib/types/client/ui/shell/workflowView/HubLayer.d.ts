/**
 * dsh-workflow-lite — 工作流中心对话框：把工作流、实例、主机各块接到中心的各页。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/shell/workflowView/HubLayer
 */
import type { HostAccess } from '../../../app/host.ts';
import type { SessionRow } from '../../../app/sessions.ts';
import type { Runs } from '../../../app/useRuns.ts';
import type { Workflow } from '../../../app/useWorkflow.ts';
import type { T } from '../../../i18n.ts';
import type { WorkflowLiteRpc } from '../../../rpc.ts';
export declare function HubLayer({ t, rpc, host, session, sessionRows, sessionsReady, runs, openRun, wf, sessionCwd, hubExport, onClose, openTemplate, }: {
    t: T;
    rpc: WorkflowLiteRpc;
    host: HostAccess;
    session: string | undefined;
    sessionRows: readonly SessionRow[];
    sessionsReady: boolean;
    runs: Runs;
    openRun(id: string): void;
    wf: Workflow;
    sessionCwd: string | undefined;
    /** 从画布顶栏的「导出」进来：直接停在「工作流」页、右栏是导出。 */
    hubExport: boolean;
    onClose(): void;
    openTemplate(name: string): void;
}): React.JSX.Element;
