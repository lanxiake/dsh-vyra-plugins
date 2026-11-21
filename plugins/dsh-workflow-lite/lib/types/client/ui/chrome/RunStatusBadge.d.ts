/**
 * dsh-workflow-lite — 实例的整体状态：状态名的文案表与状态小标。
 *
 * 实例视图的顶栏与右栏、草稿栏，工作流中心的实例列表与改状态菜单都用它，
 * 放在 chrome/，让工作流中心不必回头 import 实例视图的顶栏。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/chrome/RunStatusBadge
 */
import type { RunStatus } from '../../../shared/runState.ts';
import type { LocaleKey, T } from '../../i18n.ts';
export declare const RUN_STATUS_TEXT: Record<RunStatus, LocaleKey>;
/** 实例的状态小标。 */
export declare function RunStatusBadge(props: {
    t: T;
    status: RunStatus | undefined;
    problem?: 'missing' | 'invalid' | undefined;
    /** 这个实例不记运行状态（没有状态文件）。 */
    untracked?: boolean;
}): React.JSX.Element;
