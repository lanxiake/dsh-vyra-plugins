/**
 * dsh-workflow-lite — 工作流中心「工作流」页左边的列表：选一张、就地改名、删除（确认卡挂在那一行上）。
 *
 * 改名、删除走编辑页同一套（`Workflow.rename / remove`）：正开着的那张会先把改动写下去 / 停掉排着的保存，
 * 编辑页跟着换名字或空出来；版本目录由主机跟着搬走或删掉。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/hub/HubWorkflowList
 */
import type { WorkflowEntry } from '../../../shared/types.ts';
import type { T } from '../../i18n.ts';
export declare function HubWorkflowList(props: {
    t: T;
    /** 外面那一栏另有边线时换掉列表自己的样子（见 wf.sideList）。 */
    className?: string;
    workflows: readonly WorkflowEntry[];
    selected: string;
    /** 编辑页正开着的那张。 */
    current: string | null;
    onPick(name: string): void;
    /** 回 `false` = 没改成（名字不行或主机拒了，已经提示过）。 */
    rename(from: string, to: string): Promise<boolean>;
    remove(name: string): Promise<boolean>;
}): React.JSX.Element;
