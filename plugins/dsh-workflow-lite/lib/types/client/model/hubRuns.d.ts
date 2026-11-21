/**
 * dsh-workflow-lite — 工作流中心「运行实例」页的筛选与分组：按关键字筛，按工作区分组，挑出右边显示哪一组。
 *
 * 工作区就是实例建立时会话的 `cwd`；路径的大小写、分隔符、末尾斜杠不同也算同一个（Windows）。
 * 没记下工作区的实例归在一组（键是空串）。
 *
 * @module @xiaoso/dsh-workflow-lite/client/model/hubRuns
 */
import type { InstanceSummary } from '../../shared/runState.ts';
/** 一个工作区。 */
export interface HubWorkspace {
    /** 比较用的键（标准化后的路径；没有工作区是空串）。 */
    key: string;
    /** 原样的路径（取这一组里最新那个实例记下的写法）。 */
    path: string | undefined;
    /** 显示用的名字：路径最后一段。 */
    name: string;
    count: number;
    /** 是不是本会话所在的工作区。 */
    here: boolean;
}
/** 工作区的比较键。 */
export declare function workspaceKey(cwd: string | undefined): string;
/** 路径最后一段（`D:\a\b` → `b`；盘符根 `D:\` → `D:`）。 */
export declare function workspaceName(path: string): string;
/** 列表里出现过的工作区：本会话的在最前，其余按最近一次建实例的时间，新的在前。 */
export declare function workspacesOf(items: readonly InstanceSummary[], hereCwd: string | undefined): HubWorkspace[];
/** 关键字命中没有：工作流名、会话标题、目标、工作区路径、实例 id，忽略大小写；空白分开的几个词都要命中。 */
export declare function matchesQuery(item: InstanceSummary, sessionTitle: string | undefined, query: string): boolean;
/** 一个工作区和它的实例。 */
export interface HubGroup {
    workspace: HubWorkspace;
    /** 组内保持原顺序：新的在前。 */
    items: InstanceSummary[];
    /** 还在进行的：执行中 + 等待用户。 */
    active: number;
}
/** 按关键字挑出实例，再按工作区分组（组的顺序同 {@link workspacesOf}：本工作区在最前）。 */
export declare function groupRuns(items: readonly InstanceSummary[], options: {
    query: string;
    hereCwd: string | undefined;
    titleOf: (session: string | undefined) => string | undefined;
}): HubGroup[];
/**
 * 右边显示哪个工作区：点过的那个还在列表里就是它（搜索把它筛掉了就不算）；
 * 否则排在最前的——有本工作区就是本工作区，没有就是最近建过实例的。
 */
export declare function pickGroup(groups: readonly HubGroup[], picked: string | null): HubGroup | undefined;
