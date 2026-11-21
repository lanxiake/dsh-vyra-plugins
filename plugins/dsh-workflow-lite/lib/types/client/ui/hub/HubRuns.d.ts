/**
 * dsh-workflow-lite — 工作流中心「运行实例」页：和「工作流」页同一种两栏——左边工作区，右边选中那个工作区的实例。
 *
 * - 左栏：顶上一条搜索，下面是有实例的工作区（本工作区在最前，其余按最近建实例的时间）；
 *   每项一行名字、一行「几个实例 · 几个进行中」，悬停看完整路径。
 * - 右栏：工作区名字和路径，下面是它的实例（{@link HubRunRow}）；所有行共用一套列，
 *   状态小标宽窄不一、有没有「移到本会话」，进度条和按钮都上下对齐。
 * - 搜索跨所有工作区：左栏只留有命中的工作区，右栏只列命中的实例；选中的那个被筛掉了就换到第一个。
 *
 * 打开时拉一次全部会话的实例；移动、删除之后再拉一次。不跟着外面的重绘重拉——会话列表一有动静
 * （别的会话在输出）外面就会重绘，跟着重拉会让列表一直闪。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/hub/HubRuns
 */
import type { SessionRow } from '../../app/sessions.ts';
import type { Runs } from '../../app/useRuns.ts';
import type { T } from '../../i18n.ts';
export declare function HubRuns(props: {
    t: T;
    session: string | undefined;
    sessionRows: readonly SessionRow[];
    sessionsReady: boolean;
    runs: Runs;
    onOpenRun(id: string): void;
    onNotice(text: string, tone?: 'info' | 'error'): void;
}): React.JSX.Element;
