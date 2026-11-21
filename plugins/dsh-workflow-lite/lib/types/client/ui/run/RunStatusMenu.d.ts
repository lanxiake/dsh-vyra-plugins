/**
 * dsh-workflow-lite — 实例视图里点步骤卡上的状态小标弹出的小菜单：改状态（有条件出边的改成完成时先问判定）、
 * 指定为下一步、重跑这一步。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/run/RunStatusMenu
 */
import { type NodeStatus } from '../../../shared/runState.ts';
import type { T } from '../../i18n.ts';
export declare function StatusMenu(props: {
    t: T;
    at: {
        x: number;
        y: number;
    };
    node: {
        status: NodeStatus;
        verdict?: string;
    };
    step: 'status' | 'verdict';
    verdicts: readonly string[];
    onStatus(status: NodeStatus): void;
    onVerdict(verdict: string): void;
    onRerun(): void;
    /** 这一步在不在用户指定的下一步里。 */
    pinned: boolean;
    onPin(): void;
    onClose(): void;
}): React.JSX.Element;
