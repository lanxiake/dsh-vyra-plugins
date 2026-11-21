/**
 * dsh-workflow-lite — 模板编辑时的一组对话框与浮层：记忆选择、自定义文字、就地添加、设置、版本、执行前提问、计划预览。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/shell/workflowView/ShellDialogs
 */
import type { InputAnswer, Point, ResourceItem } from '../../../../shared/types.ts';
import type { Desktop } from '../../../app/desktop.ts';
import type { HostAccess } from '../../../app/host.ts';
import type { SessionRow } from '../../../app/sessions.ts';
import type { useMemoryPick } from '../../../app/useMemoryPick.ts';
import type { Workflow } from '../../../app/useWorkflow.ts';
import type { T } from '../../../i18n.ts';
import type { StepSource } from '../../../model/library.ts';
import type { WorkflowLiteRpc } from '../../../rpc.ts';
import type { AddRequest } from '../../canvas/Canvas.tsx';
export declare function ShellDialogs({ t, rpc, desktop, session, wf, host, memoryPick, textView, setTextView, quick, setQuick, size, addStep, settingsOpen, setSettingsOpen, versionsOpen, setVersionsOpen, asking, setAsking, lastAnswers, sessionRows, startRun, planOpen, setPlanOpen, sessionCwd, locate, focusCanvas, }: {
    t: T;
    rpc: WorkflowLiteRpc;
    desktop: Desktop | undefined;
    session: string | undefined;
    wf: Workflow;
    host: HostAccess;
    memoryPick: ReturnType<typeof useMemoryPick>;
    textView: ResourceItem | null;
    setTextView(value: null): void;
    quick: (AddRequest & {
        at: Point;
    }) | null;
    setQuick(value: null): void;
    /** 视图根的大小（就地添加的菜单据此不出界）。 */
    size: {
        width: number;
        height: number;
    };
    addStep(source: StepSource, position: Point, from?: string): Promise<void>;
    settingsOpen: boolean;
    setSettingsOpen(open: boolean): void;
    versionsOpen: boolean;
    setVersionsOpen(open: boolean): void;
    asking: {
        target: string | null;
    } | null;
    setAsking(value: null): void;
    lastAnswers: {
        current: Map<string, Record<string, InputAnswer>>;
    };
    sessionRows: readonly SessionRow[];
    startRun(target: string | null, answers?: Record<string, InputAnswer>): Promise<void>;
    planOpen: boolean;
    setPlanOpen(open: boolean): void;
    sessionCwd: string | undefined;
    locate(nodeId: string): void;
    focusCanvas(): void;
}): React.JSX.Element;
