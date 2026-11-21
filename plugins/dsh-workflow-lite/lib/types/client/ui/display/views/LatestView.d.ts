/**
 * dsh-workflow-lite — 模板视图里的「上次执行」：那个实例里那一份，读法和实例视图一样。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/display/views/LatestView
 */
import type { ResourceItem, TableView } from '../../../../shared/types.ts';
import type { RunLatestOutput } from '../../../../shared/wire/run.ts';
import type { T } from '../../../i18n.ts';
import type { Display } from '../../../model/display.ts';
import type { WorkflowLiteRpc } from '../../../rpc.ts';
/** 模板里的「上次执行」：那个实例里那一份，读法和实例视图一样（那边的项号、修改时间）。 */
export declare function LatestView(props: {
    t: T;
    rpc: WorkflowLiteRpc;
    found: RunLatestOutput;
    node: string;
    item: ResourceItem;
    display: Display;
    interactive: boolean;
    onTable?: ((table: TableView | undefined) => void) | undefined;
}): React.JSX.Element;
