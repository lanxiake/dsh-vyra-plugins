/**
 * dsh-workflow-lite — 「执行」：会话与工作区、主机访问、先存盘再建实例再发话、执行前的提问。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/shell/workflowView/useLaunch
 */
import type { InputAnswer } from '../../../../shared/types.ts';
import type { Desktop } from '../../../app/desktop.ts';
import { type HostAccess } from '../../../app/host.ts';
import { type SessionBridge, type SessionRow } from '../../../app/sessions.ts';
import type { Runs } from '../../../app/useRuns.ts';
import type { Workflow } from '../../../app/useWorkflow.ts';
import type { LocaleKey, T } from '../../../i18n.ts';
import { type WorkflowLiteRpc } from '../../../rpc.ts';
export interface LaunchInput {
    /** 视图的 props（里面的成员在依赖数组里按原样写成 props.x）。 */
    props: {
        rpc: WorkflowLiteRpc;
        session: string | undefined;
        openView(view: string, focus: string): void;
        sessions?: SessionBridge;
        desktop?: Desktop;
    };
    t: T;
    wf: Workflow;
    runs: Runs;
    openRun(id: string): void;
    /** 本会话上一次见到的当前实例（执行后先记下，免得把自己建的实例当成「新实例」提示）。 */
    seenCurrent: React.MutableRefObject<string | undefined | null>;
}
export declare function useLaunch({ props, t, wf, runs, openRun, seenCurrent }: LaunchInput): {
    sessionRows: readonly SessionRow[];
    starting: boolean;
    launchBlocked: LocaleKey | null;
    sessionCwd: string | undefined;
    host: HostAccess;
    canCreate: boolean;
    startRun(target: string | null, answers?: Record<string, InputAnswer>): Promise<void>;
    asking: {
        target: string | null;
    } | null;
    setAsking: React.Dispatch<React.SetStateAction<{
        target: string | null;
    } | null>>;
    lastAnswers: React.MutableRefObject<Map<string, Record<string, InputAnswer>>>;
    launch(target: string | null): void;
};
